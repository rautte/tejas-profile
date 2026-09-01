// infra/cdk/lambda/usage-epoch-analytics-aggregator.ts

import {
  BatchGetItemCommand,
  QueryCommand,
} from "@aws-sdk/client-dynamodb";

import {
  marshall,
  unmarshall,
} from "@aws-sdk/util-dynamodb";

import {
  ALLOWED_EVENT_TYPES,
  PUBLIC_SECTION_ORDER,
  PUBLIC_SECTIONS,
  canonicalizeDeepLinkValue,
} from "./analytics-domain";

import {
  USAGE_EPOCH_STATE,
  normalizeAndValidateUsageEpochDocument,
} from "./usage-epoch-contract";

import {
  USAGE_EPOCH_ANALYTICS_EVENT_DOCUMENT_SCHEMA,
  USAGE_EPOCH_ANALYTICS_EVENT_SCHEMA_ID_V1,
  USAGE_EPOCH_ANALYTICS_EVENT_SCHEMA_ID_V2,
  createUsageEpochAnalyticsPartitionKey,
} from "./usage-epoch-analytics-projection";

import {
  TRAFFIC_CLASSIFICATION,
  TRAFFIC_CLASSIFIER_VERSION,
  classifyTrafficSession,
  normalizeTrafficEvidence,
} from "./traffic-classification";


const DAY_MS =
  24 * 60 * 60 * 1000;

const MAX_BATCH_GET_KEYS =
  100;

const VISITOR_BATCH_GET_RETRIES =
  5;

const EVENT_FINGERPRINT_RE =
  /^[a-f0-9]{64}$/;


const JOURNEY_EVENT_TYPES =
  new Set([
    "section_view",
    "cta_click",
    "project_open",
    "code_snippet_view",
    "deep_link",
  ]);


type DynamoDbSender = {
  send:
    (
      command:
        any
    ) => Promise<any>;
};


type InteractionState = {
  count:
    number;

  visitors:
    Set<string>;

  sessions:
    Set<string>;
};


function cleanString(
  value:
    unknown,

  max =
    240
) {
  return String(
    value ?? ""
  )
    .trim()
    .slice(
      0,
      max
    );
}


function requireTableName(
  value:
    unknown,

  field:
    string
) {
  const normalized =
    cleanString(
      value,
      255
    );


  if (!normalized) {
    throw new Error(
      `${field} is required.`
    );
  }


  return normalized;
}


function utcDay(
  ts:
    number
) {
  return new Date(
    ts
  )
    .toISOString()
    .slice(
      0,
      10
    );
}


function requireClosingEpoch(
  input:
    unknown
) {
  const epoch =
    normalizeAndValidateUsageEpochDocument(
      input
    );


  if (
    epoch.state !==
      USAGE_EPOCH_STATE
        .CLOSING ||
    !epoch.endedAt
  ) {
    throw new Error(
      "Usage Epoch Analytics aggregation requires a CLOSING Usage Epoch."
    );
  }


  return epoch;
}


function enumerateEpochDays(
  startedAt:
    string,

  endedAt:
    string
) {
  const startTs =
    Date.parse(
      startedAt
    );

  const endTs =
    Date.parse(
      endedAt
    );


  if (
    !Number.isFinite(
      startTs
    ) ||
    !Number.isFinite(
      endTs
    ) ||
    endTs <
      startTs
  ) {
    throw new Error(
      "Usage Epoch interval is invalid."
    );
  }


  const firstDay =
    Date.parse(
      `${utcDay(
        startTs
      )}T00:00:00.000Z`
    );


  /**
   * Epoch interval is right-open:
   *
   *   startedAt <= event.ts < endedAt
   *
   * If endedAt is exactly midnight, the new day does not belong
   * to this epoch.
   */
  const effectiveLastTs =
    endTs > startTs
      ? endTs - 1
      : startTs;

  const lastDay =
    Date.parse(
      `${utcDay(
        effectiveLastTs
      )}T00:00:00.000Z`
    );


  const days:
    string[] =
      [];


  for (
    let ts =
      firstDay;

    ts <=
      lastDay;

    ts +=
      DAY_MS
  ) {
    days.push(
      utcDay(
        ts
      )
    );
  }


  return days;
}


function normalizeProjectedTrafficEvidence({
  raw,
  schemaId,
}: {
  raw:
    any;

  schemaId:
    string;
}) {
  const source =
    raw
      ?.trafficEvidence;


  const values =
    source instanceof
      Set
      ? [
          ...source,
        ]
      : Array.isArray(
          source
        )
        ? source
        : source == null
          ? []
          : null;


  if (
    values ===
      null
  ) {
    throw new Error(
      "Usage Epoch Analytics projection traffic evidence must be an array."
    );
  }


  const canonicalInput =
    values.map(
      (
        value
      ) =>
        cleanString(
          value,
          80
        )
    );


  const normalized =
    normalizeTrafficEvidence(
      canonicalInput
    );


  /**
   * Projection rows are immutable evidence, so do not silently
   * discard unknown/non-canonical evidence during report creation.
   */
  const canonicalObserved =
    [
      ...new Set(
        canonicalInput
          .filter(
            Boolean
          )
      ),
    ].sort(
      (
        left,
        right
      ) =>
        left.localeCompare(
          right
        )
    );


  if (
    JSON.stringify(
      canonicalObserved
    ) !==
    JSON.stringify(
      normalized
    )
  ) {
    throw new Error(
      "Usage Epoch Analytics projection traffic evidence is invalid."
    );
  }


  if (
    schemaId ===
      USAGE_EPOCH_ANALYTICS_EVENT_SCHEMA_ID_V1
  ) {
    if (
      normalized.length >
      0
    ) {
      throw new Error(
        "Usage Epoch Analytics V1 projection cannot contain traffic evidence."
      );
    }


    return [];
  }


  /**
   * V2 always materializes the field, even when the evidence set is
   * empty. This prevents absence from acquiring ambiguous semantics.
   */
  if (
    source == null
  ) {
    throw new Error(
      "Usage Epoch Analytics V2 projection is missing traffic evidence."
    );
  }


  return normalized;
}


function normalizeProjectedEvent({
  raw,
  epoch,
}: {
  raw:
    any;

  epoch:
    any;
}) {
  if (
    !raw ||
    typeof raw !==
      "object" ||
    Array.isArray(
      raw
    )
  ) {
    throw new Error(
      "Usage Epoch Analytics projection row must be an object."
    );
  }


  const expectedPk =
    createUsageEpochAnalyticsPartitionKey(
      epoch.usageEpochId
    );


  if (
    raw.pk !==
      expectedPk
  ) {
    throw new Error(
      "Usage Epoch Analytics projection partition identity is invalid."
    );
  }


  const schemaId =
    cleanString(
      raw.schemaId,
      120
    );


  if (
    raw.schema !==
      USAGE_EPOCH_ANALYTICS_EVENT_DOCUMENT_SCHEMA ||
    (
      schemaId !==
        USAGE_EPOCH_ANALYTICS_EVENT_SCHEMA_ID_V1 &&
      schemaId !==
        USAGE_EPOCH_ANALYTICS_EVENT_SCHEMA_ID_V2
    )
  ) {
    throw new Error(
      "Usage Epoch Analytics projection schema is invalid."
    );
  }


  const trafficEvidence =
    normalizeProjectedTrafficEvidence({
      raw,

      schemaId,
    });


  if (
    raw.usageEpochId !==
      epoch.usageEpochId ||
    raw.stage !==
      epoch.stage ||
    raw.deploymentConfigurationId !==
      epoch.deploymentConfigurationId ||
    raw.platformReleaseId !==
      epoch.platformReleaseId ||
    raw.profileVariantId !==
      epoch.profileVariantId
  ) {
    throw new Error(
      "Usage Epoch Analytics projection runtime identity does not match its Usage Epoch."
    );
  }


  const eventFingerprint =
    cleanString(
      raw.eventFingerprint,
      64
    );


  if (
    !EVENT_FINGERPRINT_RE.test(
      eventFingerprint
    ) ||
    raw.sk !==
      `EVENT#${eventFingerprint}`
  ) {
    throw new Error(
      "Usage Epoch Analytics projection event identity is invalid."
    );
  }


  const ts =
    Number(
      raw.ts
    );

  const startedAt =
    Date.parse(
      epoch.startedAt
    );

  const endedAt =
    Date.parse(
      epoch.endedAt
    );


  if (
    !Number.isInteger(
      ts
    ) ||
    ts <
      startedAt ||
    ts >=
      endedAt
  ) {
    throw new Error(
      "Usage Epoch Analytics projection event is outside the Usage Epoch interval."
    );
  }


  const day =
    utcDay(
      ts
    );


  if (
    raw.day !==
      day
  ) {
    throw new Error(
      "Usage Epoch Analytics projection day does not match event timestamp."
    );
  }


  const visitorHash =
    cleanString(
      raw.visitorHash,
      80
    );

  const sessionHash =
    cleanString(
      raw.sessionHash,
      80
    );

  const type =
    cleanString(
      raw.type,
      64
    );


  if (
    !visitorHash ||
    !sessionHash ||
    !ALLOWED_EVENT_TYPES.has(
      type
    )
  ) {
    throw new Error(
      "Usage Epoch Analytics projection event dimensions are invalid."
    );
  }


  const section =
    cleanString(
      raw.section,
      80
    ) ||
    null;


  if (
    section &&
    !PUBLIC_SECTIONS.has(
      section
    )
  ) {
    throw new Error(
      "Usage Epoch Analytics projection section is invalid."
    );
  }


  if (
    (
      type ===
        "section_view" ||
      type ===
        "section_time" ||
      type ===
        "scroll_depth"
    ) &&
    !section
  ) {
    throw new Error(
      "Usage Epoch Analytics section event is missing its section."
    );
  }


  const rawMs =
    raw.ms == null
      ? null
      : Number(
          raw.ms
        );

  const ms =
    rawMs !==
      null &&
    Number.isFinite(
      rawMs
    ) &&
    rawMs >=
      0
      ? rawMs
      : null;


  if (
    raw.ms != null &&
    ms ===
      null
  ) {
    throw new Error(
      "Usage Epoch Analytics projection active time is invalid."
    );
  }


  const rawDepth =
    raw.depthPct == null
      ? null
      : Number(
          raw.depthPct
        );

  const depthPct =
    rawDepth !==
      null &&
    Number.isInteger(
      rawDepth
    ) &&
    rawDepth >=
      0 &&
    rawDepth <=
      100
      ? rawDepth
      : null;


  if (
    raw.depthPct != null &&
    depthPct ===
      null
  ) {
    throw new Error(
      "Usage Epoch Analytics projection depth milestone is invalid."
    );
  }


  const rawCountry =
    cleanString(
      raw.countryCode,
      2
    )
      .toUpperCase();

  const countryCode =
    rawCountry ||
    null;


  if (
    countryCode &&
    !/^[A-Z]{2}$/.test(
      countryCode
    )
  ) {
    throw new Error(
      "Usage Epoch Analytics projection country code is invalid."
    );
  }


  const regionCode =
    cleanString(
      raw.regionCode,
      8
    )
      .toUpperCase() ||
    null;

  const city =
    cleanString(
      raw.city,
      120
    ) ||
    null;


  return {
    /**
     * Preserve the canonical storage/epoch identity after validation.
     *
     * queryUsageEpochAnalyticsEvents() validates DynamoDB rows before
     * returning them, while aggregateUsageEpochAnalyticsEvents() also
     * validates caller-supplied rows. Keeping these fields makes the
     * validated representation safely re-validatable instead of
     * weakening either boundary.
     */
    pk:
      expectedPk,

    sk:
      `EVENT#${eventFingerprint}`,

    schema:
      USAGE_EPOCH_ANALYTICS_EVENT_DOCUMENT_SCHEMA,

    schemaId,

    usageEpochId:
      epoch.usageEpochId,

    stage:
      epoch.stage,

    deploymentConfigurationId:
      epoch.deploymentConfigurationId,

    platformReleaseId:
      epoch.platformReleaseId,

    profileVariantId:
      epoch.profileVariantId,

    eventFingerprint,

    ts,

    day,

    visitorHash,

    sessionHash,

    type,

    trafficEvidence,

    countryCode,

    regionCode,

    city,

    section,

    ctaId:
      cleanString(
        raw.ctaId,
        80
      ) ||
      null,

    projectId:
      cleanString(
        raw.projectId,
        120
      ) ||
      null,

    snippetId:
      cleanString(
        raw.snippetId,
        160
      ) ||
      null,

    depthPct,

    ms,

    path:
      cleanString(
        raw.path,
        240
      ) ||
      null,

    hash:
      cleanString(
        raw.hash,
        240
      ) ||
      null,
  };
}


export async function queryUsageEpochAnalyticsEvents({
  client,
  projectionTableName,
  epoch:
    inputEpoch,
}: {
  client:
    DynamoDbSender;

  projectionTableName:
    string;

  epoch:
    unknown;
}) {
  const table =
    requireTableName(
      projectionTableName,
      "Usage Epoch Analytics table name"
    );

  const epoch =
    requireClosingEpoch(
      inputEpoch
    );

  const events:
    any[] =
      [];

  let lastEvaluatedKey:
    Record<string, any> |
    undefined;


  do {
    const response =
      await client.send(
        new QueryCommand({
          TableName:
            table,

          KeyConditionExpression:
            "#pk = :pk AND begins_with(#sk, :eventPrefix)",

          ExpressionAttributeNames: {
            "#pk":
              "pk",

            "#sk":
              "sk",
          },

          ExpressionAttributeValues:
            marshall({
              ":pk":
                createUsageEpochAnalyticsPartitionKey(
                  epoch
                    .usageEpochId
                ),

              ":eventPrefix":
                "EVENT#",
            }),

          ConsistentRead:
            true,

          ExclusiveStartKey:
            lastEvaluatedKey,
        })
      );


    for (
      const item of
        response.Items ||
        []
    ) {
      events.push(
        normalizeProjectedEvent({
          raw:
            unmarshall(
              item
            ),

          epoch,
        })
      );
    }


    lastEvaluatedKey =
      response
        .LastEvaluatedKey;
  } while (
    lastEvaluatedKey
  );


  events.sort(
    (
      a,
      b
    ) =>
      a.ts -
        b.ts ||
      a.eventFingerprint
        .localeCompare(
          b.eventFingerprint
        )
  );


  return events;
}


export async function readVisitorFirstSeenByHash({
  client,
  analyticsTableName,
  visitorHashes:
    inputVisitorHashes,
}: {
  client:
    DynamoDbSender;

  analyticsTableName:
    string;

  visitorHashes:
    string[];
}) {
  const table =
    requireTableName(
      analyticsTableName,
      "Analytics table name"
    );

  const visitorHashes =
    [
      ...new Set(
        inputVisitorHashes
          .map(
            (
              value
            ) =>
              cleanString(
                value,
                80
              )
          )
          .filter(
            Boolean
          )
      ),
    ];


  const result =
    new Map<
      string,
      number
    >();


  for (
    let offset = 0;
    offset <
      visitorHashes.length;
    offset +=
      MAX_BATCH_GET_KEYS
  ) {
    let pendingKeys =
      visitorHashes
        .slice(
          offset,
          offset +
            MAX_BATCH_GET_KEYS
        )
        .map(
          (
            visitorHash
          ) =>
            marshall({
              pk:
                `VISITOR#${visitorHash}`,

              sk:
                "META",
            })
        );


    for (
      let attempt = 0;

      attempt <
        VISITOR_BATCH_GET_RETRIES &&
      pendingKeys.length >
        0;

      attempt +=
        1
    ) {
      const response =
        await client.send(
          new BatchGetItemCommand({
            RequestItems: {
              [table]: {
                Keys:
                  pendingKeys,

                ConsistentRead:
                  true,

                ProjectionExpression:
                  "#visitorHash, #firstSeenAt",

                ExpressionAttributeNames: {
                  "#visitorHash":
                    "visitorHash",

                  "#firstSeenAt":
                    "firstSeenAt",
                },
              },
            },
          })
        );


      for (
        const raw of
          response
            .Responses
            ?.[table] ||
          []
      ) {
        const item =
          unmarshall(
            raw
          );

        const visitorHash =
          cleanString(
            item
              ?.visitorHash,
            80
          );

        const firstSeenAt =
          Number(
            item
              ?.firstSeenAt
          );


        if (
          visitorHash &&
          Number.isFinite(
            firstSeenAt
          )
        ) {
          const current =
            result.get(
              visitorHash
            );


          if (
            current ===
              undefined ||
            firstSeenAt <
              current
          ) {
            result.set(
              visitorHash,
              firstSeenAt
            );
          }
        }
      }


      pendingKeys =
        response
          .UnprocessedKeys
          ?.[table]
          ?.Keys ||
        [];
    }


    if (
      pendingKeys.length >
      0
    ) {
      throw new Error(
        "Unable to load all visitor metadata for Usage Epoch Analytics."
      );
    }
  }


  return result;
}


function interactionState(
  map:
    Map<
      string,
      InteractionState
    >,

  key:
    string
) {
  let value =
    map.get(
      key
    );


  if (!value) {
    value = {
      count:
        0,

      visitors:
        new Set<string>(),

      sessions:
        new Set<string>(),
    };

    map.set(
      key,
      value
    );
  }


  return value;
}


function classifyUsageEpochLogicalSessions({
  epoch,

  events:
    inputEvents,
}: {
  epoch:
    any;

  events:
    any[];
}) {
  type SessionState = {
    visitorHash:
      string;

    eventCount:
      number;

    activeMs:
      number;

    sections:
      Set<string>;

    journeyEventCount:
      number;

    trafficEvidence:
      Set<string>;
  };


  const normalizedEvents =
    inputEvents.map(
      (
        event
      ) =>
        normalizeProjectedEvent({
          raw:
            event,

          epoch,
        })
    );


  const sessions =
    new Map<
      string,
      SessionState
    >();


  for (
    const event of
      normalizedEvents
  ) {
    let state =
      sessions.get(
        event.sessionHash
      );


    if (!state) {
      state = {
        visitorHash:
          event.visitorHash,

        eventCount:
          0,

        activeMs:
          0,

        sections:
          new Set<string>(),

        journeyEventCount:
          0,

        trafficEvidence:
          new Set<string>(),
      };


      sessions.set(
        event.sessionHash,
        state
      );
    } else if (
      state.visitorHash !==
        event.visitorHash
    ) {
      throw new Error(
        "Usage Epoch logical Analytics session maps to multiple visitors."
      );
    }


    state.eventCount +=
      1;


    if (
      event.type ===
        "section_time" &&
      typeof event.ms ===
        "number" &&
      event.ms >
        0
    ) {
      state.activeMs +=
        event.ms;
    }


    if (
      event.section
    ) {
      state.sections.add(
        event.section
      );
    }


    if (
      JOURNEY_EVENT_TYPES.has(
        event.type
      )
    ) {
      state.journeyEventCount +=
        1;
    }


    for (
      const evidence of
        event.trafficEvidence
    ) {
      state
        .trafficEvidence
        .add(
          evidence
        );
    }
  }


  const classificationBySessionHash =
    new Map<
      string,
      ReturnType<
        typeof classifyTrafficSession
      >
    >();


  for (
    const [
      sessionHash,
      state,
    ] of sessions.entries()
  ) {
    classificationBySessionHash.set(
      sessionHash,

      classifyTrafficSession({
        evidence:
          state
            .trafficEvidence,

        eventCount:
          state
            .eventCount,

        activeMs:
          state
            .activeMs,

        sectionCount:
          state
            .sections
            .size,

        journeyEventCount:
          state
            .journeyEventCount,
      })
    );
  }


  return {
    normalizedEvents,

    classificationBySessionHash,
  };
}


function trafficSummaryFromAnalytics(
  analytics:
    any
) {
  return {
    uniqueVisitors:
      Number(
        analytics
          ?.overview
          ?.uniqueVisitors ||
        0
      ),

    sessions:
      Number(
        analytics
          ?.overview
          ?.sessions ||
        0
      ),

    eventCount:
      Number(
        analytics
          ?.overview
          ?.eventCount ||
        0
      ),

    activeMs:
      Number(
        analytics
          ?.overview
          ?.activeMs ||
        0
      ),
  };
}


export function aggregateUsageEpochAnalyticsEvents({
  epoch:
    inputEpoch,

  events:
    inputEvents,

  visitorFirstSeenByHash =
    new Map<
      string,
      number
    >(),
}: {
  epoch:
    unknown;

  events:
    any[];

  visitorFirstSeenByHash?:
    Map<
      string,
      number
    >;
}) {
  const epoch =
    requireClosingEpoch(
      inputEpoch
    );

  const events =
    inputEvents.map(
      (
        event
      ) =>
        normalizeProjectedEvent({
          raw:
            event,

          epoch,
        })
    );


  const seenFingerprints =
    new Set<string>();


  for (
    const event of
      events
  ) {
    if (
      seenFingerprints.has(
        event
          .eventFingerprint
      )
    ) {
      throw new Error(
        "Duplicate Usage Epoch Analytics event fingerprint encountered."
      );
    }


    seenFingerprints.add(
      event
        .eventFingerprint
    );
  }


  events.sort(
    (
      a,
      b
    ) =>
      a.ts -
        b.ts ||
      a.eventFingerprint
        .localeCompare(
          b.eventFingerprint
        )
  );


  const visitors =
    new Set<string>();

  const sessions =
    new Set<string>();

  const sessionSections =
    new Map<
      string,
      Set<string>
    >();


  type SectionState = {
    visits:
      number;

    activeMs:
      number;

    visitors:
      Set<string>;

    sessions:
      Set<string>;
  };


  const sections =
    new Map<
      string,
      SectionState
    >();


  for (
    const section of
      PUBLIC_SECTION_ORDER
  ) {
    sections.set(
      section,
      {
        visits:
          0,

        activeMs:
          0,

        visitors:
          new Set<string>(),

        sessions:
          new Set<string>(),
      }
    );
  }


  const ctas =
    new Map<
      string,
      InteractionState
    >();

  const projects =
    new Map<
      string,
      InteractionState
    >();

  const snippets =
    new Map<
      string,
      InteractionState
    >();

  const deepLinks =
    new Map<
      string,
      InteractionState
    >();


  const depth =
    new Map<
      string,
      {
        section:
          string;

        depthPct:
          number;

        visitors:
          Set<string>;

        sessions:
          Set<string>;
      }
    >();


  const countries =
    new Map<
      string,
      {
        visitors:
          Set<string>;

        sessions:
          Set<string>;

        activeMs:
          number;
      }
    >();


  const cities =
    new Map<
      string,
      {
        city:
          string;

        countryCode:
          string |
          null;

        regionCode:
          string |
          null;

        visitors:
          Set<string>;

        sessions:
          Set<string>;

        activeMs:
          number;
      }
    >();


  const days =
    enumerateEpochDays(
      epoch.startedAt,
      epoch.endedAt!
    );


  const daily =
    days.map(
      (
        day
      ) => ({
        day,

        visitors:
          new Set<string>(),

        sessions:
          new Set<string>(),

        activeMs:
          0,

        eventCount:
          0,
      })
    );


  const dailyByDay =
    new Map(
      daily.map(
        (
          value
        ) => [
          value.day,
          value,
        ]
      )
    );


  let totalActiveMs =
    0;


  function touchSection(
    section:
      string,

    visitorHash:
      string,

    sessionHash:
      string
  ) {
    const state =
      sections.get(
        section
      );


    if (!state) {
      return;
    }


    state.visitors.add(
      visitorHash
    );

    state.sessions.add(
      sessionHash
    );


    let reached =
      sessionSections.get(
        sessionHash
      );


    if (!reached) {
      reached =
        new Set<string>();

      sessionSections.set(
        sessionHash,
        reached
      );
    }


    reached.add(
      section
    );
  }


  function addInteraction(
    target:
      Map<
        string,
        InteractionState
      >,

    key:
      string,

    visitorHash:
      string,

    sessionHash:
      string
  ) {
    const normalizedKey =
      cleanString(
        key,
        240
      );


    if (!normalizedKey) {
      return;
    }


    const state =
      interactionState(
        target,
        normalizedKey
      );


    state.count +=
      1;

    state.visitors.add(
      visitorHash
    );

    state.sessions.add(
      sessionHash
    );
  }


  for (
    const event of
      events
  ) {
    visitors.add(
      event.visitorHash
    );

    sessions.add(
      event.sessionHash
    );


    const dailyState =
      dailyByDay.get(
        event.day
      );


    if (!dailyState) {
      throw new Error(
        "Usage Epoch Analytics event day is outside the report interval."
      );
    }


    dailyState
      .visitors
      .add(
        event.visitorHash
      );

    dailyState
      .sessions
      .add(
        event.sessionHash
      );

    dailyState.eventCount +=
      1;


    if (
      event.section
    ) {
      touchSection(
        event.section,
        event.visitorHash,
        event.sessionHash
      );
    }


    let eventActiveMs =
      0;


    if (
      event.type ===
        "section_view" &&
      event.section
    ) {
      sections
        .get(
          event.section
        )!
        .visits +=
        1;
    }


    if (
      event.type ===
        "section_time" &&
      event.section &&
      typeof event.ms ===
        "number" &&
      event.ms >
        0
    ) {
      eventActiveMs =
        event.ms;

      totalActiveMs +=
        event.ms;

      dailyState.activeMs +=
        event.ms;

      sections
        .get(
          event.section
        )!
        .activeMs +=
        event.ms;
    }


    if (
      event.type ===
        "cta_click" &&
      event.ctaId
    ) {
      addInteraction(
        ctas,
        event.ctaId,
        event.visitorHash,
        event.sessionHash
      );
    }


    if (
      event.type ===
        "project_open" &&
      event.projectId
    ) {
      addInteraction(
        projects,
        event.projectId,
        event.visitorHash,
        event.sessionHash
      );
    }


    if (
      event.type ===
        "code_snippet_view" &&
      event.snippetId
    ) {
      addInteraction(
        snippets,
        event.snippetId,
        event.visitorHash,
        event.sessionHash
      );
    }


    if (
      event.type ===
        "deep_link"
    ) {
      const value =
        canonicalizeDeepLinkValue(
          event.hash ||
          event.path ||
          ""
        );


      if (value) {
        addInteraction(
          deepLinks,
          value,
          event.visitorHash,
          event.sessionHash
        );
      }
    }


    if (
      event.type ===
        "scroll_depth" &&
      event.section &&
      typeof event.depthPct ===
        "number" &&
      [
        25,
        50,
        75,
        100,
      ].includes(
        event.depthPct
      )
    ) {
      const key =
        `${event.section}|${event.depthPct}`;

      let state =
        depth.get(
          key
        );


      if (!state) {
        state = {
          section:
            event.section,

          depthPct:
            event.depthPct,

          visitors:
            new Set<string>(),

          sessions:
            new Set<string>(),
        };

        depth.set(
          key,
          state
        );
      }


      state.visitors.add(
        event.visitorHash
      );

      state.sessions.add(
        event.sessionHash
      );
    }


    if (
      event.countryCode
    ) {
      let country =
        countries.get(
          event.countryCode
        );


      if (!country) {
        country = {
          visitors:
            new Set<string>(),

          sessions:
            new Set<string>(),

          activeMs:
            0,
        };

        countries.set(
          event.countryCode,
          country
        );
      }


      country.visitors.add(
        event.visitorHash
      );

      country.sessions.add(
        event.sessionHash
      );

      country.activeMs +=
        eventActiveMs;
    }


    if (
      event.city
    ) {
      const key =
        JSON.stringify([
          event.countryCode,
          event.regionCode,
          event.city,
        ]);

      let city =
        cities.get(
          key
        );


      if (!city) {
        city = {
          city:
            event.city,

          countryCode:
            event.countryCode,

          regionCode:
            event.regionCode,

          visitors:
            new Set<string>(),

          sessions:
            new Set<string>(),

          activeMs:
            0,
        };

        cities.set(
          key,
          city
        );
      }


      city.visitors.add(
        event.visitorHash
      );

      city.sessions.add(
        event.sessionHash
      );

      city.activeMs +=
        eventActiveMs;
    }
  }


  const uniqueVisitors =
    visitors.size;

  const sessionCount =
    sessions.size;


  const epochStartTs =
    Date.parse(
      epoch.startedAt
    );

  const epochEndTs =
    Date.parse(
      epoch.endedAt!
    );


  let newVisitors =
    0;

  let returningVisitors =
    0;

  let unclassifiedVisitors =
    0;


  for (
    const visitorHash of
      visitors
  ) {
    const firstSeenAt =
      visitorFirstSeenByHash.get(
        visitorHash
      );


    /**
     * Preserve the live Analytics truthfulness rule:
     *
     * missing historical visitor evidence is unclassified,
     * never guessed as new or returning.
     */
    if (
      !Number.isFinite(
        firstSeenAt
      ) ||
      firstSeenAt! >=
        epochEndTs
    ) {
      unclassifiedVisitors +=
        1;

      continue;
    }


    if (
      firstSeenAt! <
        epochStartTs
    ) {
      returningVisitors +=
        1;
    } else {
      newVisitors +=
        1;
    }
  }


  const classifiedVisitors =
    newVisitors +
    returningVisitors;

  const returningVisitorPct =
    classifiedVisitors
      ? Number(
          (
            (
              returningVisitors /
              classifiedVisitors
            ) *
            100
          ).toFixed(
            1
          )
        )
      : 0;


  const avgActiveMsPerSession =
    sessionCount
      ? Math.round(
          totalActiveMs /
          sessionCount
        )
      : 0;


  const totalUniqueSections =
    [
      ...sessionSections.values(),
    ].reduce(
      (
        total,
        value
      ) =>
        total +
        value.size,

      0
    );

  const avgSectionsPerSession =
    sessionCount
      ? totalUniqueSections /
        sessionCount
      : 0;


  const sectionOutput =
    PUBLIC_SECTION_ORDER.map(
      (
        section
      ) => {
        const value =
          sections.get(
            section
          )!;


        return {
          section,

          visits:
            value.visits,

          visitors:
            value.visitors.size,

          sessions:
            value.sessions.size,

          activeMs:
            value.activeMs,

          visitorReachPct:
            uniqueVisitors
              ? Number(
                  (
                    (
                      value
                        .visitors
                        .size /
                      uniqueVisitors
                    ) *
                    100
                  ).toFixed(
                    1
                  )
                )
              : 0,

          sessionReachPct:
            sessionCount
              ? Number(
                  (
                    (
                      value
                        .sessions
                        .size /
                      sessionCount
                    ) *
                    100
                  ).toFixed(
                    1
                  )
                )
              : 0,
        };
      }
    );


  const topSection =
    [
      ...sectionOutput,
    ]
      .sort(
        (
          a,
          b
        ) =>
          b.visits -
            a.visits ||
          b.visitors -
            a.visitors ||
          b.activeMs -
            a.activeMs
      )[0];


  function interactionOutput(
    source:
      Map<
        string,
        InteractionState
      >,

    idField:
      string
  ) {
    return [
      ...source.entries(),
    ]
      .map(
        ([
          id,
          value,
        ]) => ({
          [idField]:
            id,

          count:
            value.count,

          visitors:
            value.visitors.size,

          sessions:
            value.sessions.size,
        })
      )
      .sort(
        (
          a,
          b
        ) =>
          Number(
            b.count
          ) -
            Number(
              a.count
            ) ||
          String(
            a[idField]
          ).localeCompare(
            String(
              b[idField]
            )
          )
      );
  }


  return {
    overview: {
      uniqueVisitors,

      newVisitors,

      returningVisitors,

      classifiedVisitors,

      unclassifiedVisitors,

      returningVisitorPct,

      sessions:
        sessionCount,

      activeMs:
        totalActiveMs,

      avgActiveMsPerSession,

      avgSectionsPerSession:
        Number(
          avgSectionsPerSession
            .toFixed(
              2
            )
        ),

      eventCount:
        events.length,

      topSection:
        topSection &&
        (
          topSection.visits >
            0 ||
          topSection.visitors >
            0
        )
          ? topSection.section
          : null,
    },

    sections:
      sectionOutput,

    ctas:
      interactionOutput(
        ctas,
        "ctaId"
      ),

    projects:
      interactionOutput(
        projects,
        "projectId"
      ),

    snippets:
      interactionOutput(
        snippets,
        "snippetId"
      ),

    deepLinks:
      interactionOutput(
        deepLinks,
        "path"
      ),

    depthMilestones:
      [
        ...depth.values(),
      ]
        .map(
          (
            value
          ) => ({
            section:
              value.section,

            depthPct:
              value.depthPct,

            visitors:
              value.visitors.size,

            sessions:
              value.sessions.size,
          })
        )
        .sort(
          (
            a,
            b
          ) =>
            PUBLIC_SECTION_ORDER
              .indexOf(
                a.section as
                  any
              ) -
              PUBLIC_SECTION_ORDER
                .indexOf(
                  b.section as
                    any
                ) ||
            a.depthPct -
              b.depthPct
        ),

    countries:
      [
        ...countries.entries(),
      ]
        .map(
          ([
            countryCode,
            value,
          ]) => ({
            countryCode,

            visitors:
              value.visitors.size,

            sessions:
              value.sessions.size,

            activeMs:
              value.activeMs,
          })
        )
        .sort(
          (
            a,
            b
          ) =>
            b.visitors -
              a.visitors ||
            b.sessions -
              a.sessions ||
            a.countryCode
              .localeCompare(
                b.countryCode
              )
        ),

    cities:
      [
        ...cities.values(),
      ]
        .map(
          (
            value
          ) => ({
            city:
              value.city,

            countryCode:
              value.countryCode,

            regionCode:
              value.regionCode,

            visitors:
              value.visitors.size,

            sessions:
              value.sessions.size,

            activeMs:
              value.activeMs,
          })
        )
        .sort(
          (
            a,
            b
          ) =>
            b.visitors -
              a.visitors ||
            b.sessions -
              a.sessions ||
            String(
              a.countryCode ||
              ""
            ).localeCompare(
              String(
                b.countryCode ||
                ""
              )
            ) ||
            String(
              a.regionCode ||
              ""
            ).localeCompare(
              String(
                b.regionCode ||
                ""
              )
            ) ||
            a.city.localeCompare(
              b.city
            )
        ),

    daily:
      daily.map(
        (
          value
        ) => ({
          day:
            value.day,

          uniqueVisitors:
            value.visitors.size,

          sessions:
            value.sessions.size,

          activeMs:
            value.activeMs,

          avgActiveMsPerSession:
            value.sessions.size
              ? Math.round(
                  value.activeMs /
                  value.sessions.size
                )
              : 0,

          eventCount:
            value.eventCount,
        })
      ),
  };
}


export function aggregateUsageEpochAnalyticsTrafficReport({
  epoch:
    inputEpoch,

  events:
    inputEvents,

  visitorFirstSeenByHash =
    new Map<
      string,
      number
    >(),
}: {
  epoch:
    unknown;

  events:
    any[];

  visitorFirstSeenByHash?:
    Map<
      string,
      number
    >;
}) {
  const epoch =
    requireClosingEpoch(
      inputEpoch
    );


  /**
   * All-traffic aggregation executes first so the existing
   * projection-integrity and duplicate-event guards remain
   * authoritative before classification affects any slice.
   */
  const all =
    aggregateUsageEpochAnalyticsEvents({
      epoch,

      events:
        inputEvents,

      visitorFirstSeenByHash,
    });


  const {
    normalizedEvents,

    classificationBySessionHash,
  } =
    classifyUsageEpochLogicalSessions({
      epoch,

      events:
        inputEvents,
    });


  function eventsFor(
    classification:
      string
  ) {
    return normalizedEvents.filter(
      (
        event
      ) =>
        classificationBySessionHash
          .get(
            event.sessionHash
          )
          ?.classification ===
        classification
    );
  }


  const likelyHuman =
    aggregateUsageEpochAnalyticsEvents({
      epoch,

      events:
        eventsFor(
          TRAFFIC_CLASSIFICATION
            .LIKELY_HUMAN
        ),

      visitorFirstSeenByHash,
    });


  const likelyAutomated =
    aggregateUsageEpochAnalyticsEvents({
      epoch,

      events:
        eventsFor(
          TRAFFIC_CLASSIFICATION
            .LIKELY_AUTOMATED
        ),

      visitorFirstSeenByHash,
    });


  const uncertain =
    aggregateUsageEpochAnalyticsEvents({
      epoch,

      events:
        eventsFor(
          TRAFFIC_CLASSIFICATION
            .UNCERTAIN
        ),

      visitorFirstSeenByHash,
    });


  const analyticsByTraffic = {
    all,

    likely_human:
      likelyHuman,

    likely_automated:
      likelyAutomated,

    uncertain,
  };


  return {
    traffic: {
      classifierVersion:
        TRAFFIC_CLASSIFIER_VERSION,

      summary: {
        all:
          trafficSummaryFromAnalytics(
            all
          ),

        likely_human:
          trafficSummaryFromAnalytics(
            likelyHuman
          ),

        likely_automated:
          trafficSummaryFromAnalytics(
            likelyAutomated
          ),

        uncertain:
          trafficSummaryFromAnalytics(
            uncertain
          ),
      },
    },

    analyticsByTraffic,
  };
}


export async function buildUsageEpochAnalyticsReportV2Data({
  client,

  projectionTableName,

  analyticsTableName,

  epoch:
    inputEpoch,
}: {
  client:
    DynamoDbSender;

  projectionTableName:
    string;

  analyticsTableName:
    string;

  epoch:
    unknown;
}) {
  const epoch =
    requireClosingEpoch(
      inputEpoch
    );


  const events =
    await queryUsageEpochAnalyticsEvents({
      client,

      projectionTableName,

      epoch,
    });


  const visitorHashes =
    [
      ...new Set(
        events.map(
          (
            event
          ) =>
            event.visitorHash
        )
      ),
    ];


  const visitorFirstSeenByHash =
    await readVisitorFirstSeenByHash({
      client,

      analyticsTableName,

      visitorHashes,
    });


  return aggregateUsageEpochAnalyticsTrafficReport({
    epoch,

    events,

    visitorFirstSeenByHash,
  });
}


export async function buildUsageEpochAnalyticsReportData({
  client,
  projectionTableName,
  analyticsTableName,
  epoch:
    inputEpoch,
}: {
  client:
    DynamoDbSender;

  projectionTableName:
    string;

  analyticsTableName:
    string;

  epoch:
    unknown;
}) {
  const epoch =
    requireClosingEpoch(
      inputEpoch
    );


  const events =
    await queryUsageEpochAnalyticsEvents({
      client,

      projectionTableName,

      epoch,
    });


  const visitorHashes =
    [
      ...new Set(
        events.map(
          (
            event
          ) =>
            event.visitorHash
        )
      ),
    ];


  const visitorFirstSeenByHash =
    await readVisitorFirstSeenByHash({
      client,

      analyticsTableName,

      visitorHashes,
    });


  return aggregateUsageEpochAnalyticsEvents({
    epoch,

    events,

    visitorFirstSeenByHash,
  });
}