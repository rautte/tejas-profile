// infra/cdk/lambda/usage-epoch-analytics-projection.ts

import {
  PutItemCommand,
  QueryCommand,
} from "@aws-sdk/client-dynamodb";

import {
  marshall,
  unmarshall,
} from "@aws-sdk/util-dynamodb";

import * as crypto from "node:crypto";

import {
  USAGE_EPOCH_STATE,
} from "./usage-epoch-contract";

import {
  createUsageEpochConfigurationIndexPk,
  createUsageEpochPartitionKey,
  createUsageEpochStorageRecord,
  readActiveUsageEpochPointer,
  readUsageEpochRecord,
} from "./usage-epoch-store";

import {
  normalizeTrafficEvidence,
} from "./traffic-classification";


export const USAGE_EPOCH_ANALYTICS_EVENT_DOCUMENT_SCHEMA =
  "tejas-profile.usage-epoch-analytics-event";

export const USAGE_EPOCH_ANALYTICS_EVENT_SCHEMA_ID_V1 =
  "tejas-profile.usage-epoch-analytics-event.v1";

export const USAGE_EPOCH_ANALYTICS_EVENT_SCHEMA_ID_V2 =
  "tejas-profile.usage-epoch-analytics-event.v2";

export const USAGE_EPOCH_CONFIGURATION_INDEX_NAME =
  "ByDeploymentConfiguration";


const ID_RE =
  /^[A-Za-z0-9._:-]+$/;


type DynamoDbSender = {
  send:
    (
      command:
        any
    ) => Promise<any>;
};


type Stage =
  | "dev"
  | "prod";


type UsageEpochAttribution = {
  usageEpochId:
    string;

  stage:
    Stage;

  deploymentConfigurationId:
    string;

  platformReleaseId:
    string;

  profileVariantId:
    string;

  startedAt:
    string;

  endedAt:
    string |
    null;
};


function cleanString(
  value:
    unknown
) {
  return String(
    value ?? ""
  ).trim();
}


function optionalString(
  value:
    unknown
) {
  const normalized =
    cleanString(
      value
    );

  return normalized ||
    null;
}


function requireTableName(
  value:
    unknown,
  field:
    string
) {
  const normalized =
    cleanString(
      value
    );

  if (!normalized) {
    throw new Error(
      `${field} is required.`
    );
  }

  return normalized;
}


function normalizeId(
  value:
    unknown
) {
  const normalized =
    cleanString(
      value
    );

  if (
    !normalized ||
    normalized.length >
      160 ||
    !ID_RE.test(
      normalized
    )
  ) {
    return null;
  }

  return normalized;
}


function requireStage(
  value:
    unknown
): Stage {
  const normalized =
    cleanString(
      value
    );

  if (
    normalized !==
      "dev" &&
    normalized !==
      "prod"
  ) {
    throw new Error(
      'Analytics Usage Epoch stage must be "dev" or "prod".'
    );
  }

  return normalized;
}


function requireEventTimestamp(
  value:
    unknown
) {
  const timestamp =
    Number(
      value
    );

  if (
    !Number.isFinite(
      timestamp
    ) ||
    timestamp <= 0
  ) {
    throw new Error(
      "Analytics event timestamp is invalid."
    );
  }

  const normalized =
    Math.round(
      timestamp
    );

  const date =
    new Date(
      normalized
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    throw new Error(
      "Analytics event timestamp is invalid."
    );
  }

  return normalized;
}


function sha256(
  value:
    string
) {
  return crypto
    .createHash(
      "sha256"
    )
    .update(
      value,
      "utf8"
    )
    .digest(
      "hex"
    );
}


function usageEpochContainsEvent({
  epoch,
  eventTs,
  stage,
  deploymentConfigurationId,
  platformReleaseId,
  profileVariantId,
}: {
  epoch:
    any;

  eventTs:
    number;

  stage:
    Stage;

  deploymentConfigurationId:
    string;

  platformReleaseId:
    string;

  profileVariantId:
    string;
}) {
  if (
    epoch.stage !==
      stage ||
    epoch
      .deploymentConfigurationId !==
      deploymentConfigurationId ||
    epoch.platformReleaseId !==
      platformReleaseId ||
    epoch.profileVariantId !==
      profileVariantId
  ) {
    return false;
  }

  if (
    epoch.state !==
      USAGE_EPOCH_STATE.OPEN &&
    epoch.state !==
      USAGE_EPOCH_STATE.CLOSING
  ) {
    return false;
  }

  const startedAt =
    Date.parse(
      epoch.startedAt
    );

  if (
    !Number.isFinite(
      startedAt
    ) ||
    eventTs <
      startedAt
  ) {
    return false;
  }

  if (
    epoch.state ===
      USAGE_EPOCH_STATE.CLOSING
  ) {
    const endedAt =
      Date.parse(
        epoch.endedAt
      );

    if (
      !Number.isFinite(
        endedAt
      ) ||
      eventTs >=
        endedAt
    ) {
      return false;
    }
  }

  return true;
}


function attributionFromActivePointer(
  pointer:
    any
): UsageEpochAttribution {
  return {
    usageEpochId:
      pointer
        .usageEpochId,

    stage:
      pointer.stage,

    deploymentConfigurationId:
      pointer
        .deploymentConfigurationId,

    platformReleaseId:
      pointer
        .platformReleaseId,

    profileVariantId:
      pointer
        .profileVariantId,

    startedAt:
      pointer.startedAt,

    endedAt:
      null,
  };
}


function attributionFromEpoch(
  epoch:
    any
): UsageEpochAttribution {
  return {
    usageEpochId:
      epoch.usageEpochId,

    stage:
      epoch.stage,

    deploymentConfigurationId:
      epoch
        .deploymentConfigurationId,

    platformReleaseId:
      epoch
        .platformReleaseId,

    profileVariantId:
      epoch.profileVariantId,

    startedAt:
      epoch.startedAt,

    endedAt:
      epoch.endedAt ||
      null,
  };
}


export function createUsageEpochAnalyticsPartitionKey(
  usageEpochId:
    string
) {
  const normalized =
    normalizeId(
      usageEpochId
    );

  if (!normalized) {
    throw new Error(
      "usageEpochId is invalid."
    );
  }

  return (
    "EPOCH#" +
    normalized
  );
}


export function createUsageEpochAnalyticsEventSortKey(
  eventId:
    string
) {
  const normalized =
    cleanString(
      eventId
    );

  if (!normalized) {
    throw new Error(
      "eventId is required."
    );
  }

  return (
    "EVENT#" +
    sha256(
      normalized
    )
  );
}


export async function resolveUsageEpochForAnalyticsEvent({
  client,
  usageEpochTableName,
  stage,
  eventTs,
  deploymentConfigurationId,
  platformReleaseId,
  profileVariantId,
}: {
  client:
    DynamoDbSender;

  usageEpochTableName:
    string;

  stage:
    Stage;

  eventTs:
    number;

  deploymentConfigurationId:
    string;

  platformReleaseId:
    string;

  profileVariantId:
    string;
}): Promise<
  UsageEpochAttribution |
  null
> {
  const table =
    requireTableName(
      usageEpochTableName,
      "Usage Epoch table name"
    );

  const normalizedStage =
    requireStage(
      stage
    );

  const normalizedTs =
    requireEventTimestamp(
      eventTs
    );

  const configurationId =
    normalizeId(
      deploymentConfigurationId
    );

  const releaseId =
    normalizeId(
      platformReleaseId
    );

  const variantId =
    normalizeId(
      profileVariantId
    );

  if (
    !configurationId ||
    !releaseId ||
    !variantId
  ) {
    return null;
  }


  /**
   * Fast path.
   *
   * Most events belong to the currently OPEN epoch.
   *
   * The Active pointer is read strongly consistently and was itself
   * moved atomically with the Profile/Platform control-plane transition.
   */
  const activePointer =
    await readActiveUsageEpochPointer({
      client,

      tableName:
        table,
    });


  if (
    activePointer &&
    activePointer.stage ===
      normalizedStage &&
    activePointer
      .deploymentConfigurationId ===
      configurationId &&
    activePointer
      .platformReleaseId ===
      releaseId &&
    activePointer
      .profileVariantId ===
      variantId
  ) {
    const startedAt =
      Date.parse(
        activePointer
          .startedAt
      );

    if (
      Number.isFinite(
        startedAt
      ) &&
      normalizedTs >=
        startedAt
    ) {
      return attributionFromActivePointer(
        activePointer
      );
    }
  }


  /**
   * Historical/delayed-event fallback.
   *
   * The same Deployment Configuration may recur in multiple Usage Epochs.
   *
   * GSI1 is ordered by startedAt, so find the most recent epoch whose
   * start is <= the event timestamp.
   *
   * GSI reads are eventually consistent. We therefore use the GSI only
   * to discover the candidate ID, then strongly read the base record
   * before accepting attribution.
   */
  const eventIso =
    new Date(
      normalizedTs
    ).toISOString();

  const query =
    await client.send(
      new QueryCommand({
        TableName:
          table,

        IndexName:
          USAGE_EPOCH_CONFIGURATION_INDEX_NAME,

        KeyConditionExpression:
          "#gsi1pk = :gsi1pk AND #gsi1sk <= :upperBound",

        ExpressionAttributeNames: {
          "#gsi1pk":
            "gsi1pk",

          "#gsi1sk":
            "gsi1sk",
        },

        ExpressionAttributeValues:
          marshall({
            ":gsi1pk":
              createUsageEpochConfigurationIndexPk(
                configurationId
              ),

            ":upperBound":
              (
                "STARTED#" +
                eventIso +
                "#\uffff"
              ),
          }),

        ScanIndexForward:
          false,

        Limit:
          1,
      })
    );


  const rawCandidate =
    query.Items?.[0];

  if (!rawCandidate) {
    return null;
  }


  const candidate =
    unmarshall(
      rawCandidate
    );

  const candidateId =
    normalizeId(
      candidate
        ?.usageEpochId
    );

  if (!candidateId) {
    throw new Error(
      "Usage Epoch configuration index returned an invalid Usage Epoch identity."
    );
  }


  const epoch =
    await readUsageEpochRecord({
      client,

      tableName:
        table,

      usageEpochId:
        candidateId,
    });


  if (
    !usageEpochContainsEvent({
      epoch,

      eventTs:
        normalizedTs,

      stage:
        normalizedStage,

      deploymentConfigurationId:
        configurationId,

      platformReleaseId:
        releaseId,

      profileVariantId:
        variantId,
    })
  ) {
    return null;
  }


  return attributionFromEpoch(
    epoch
  );
}


export function createUsageEpochAnalyticsEventRecord({
  attribution,
  event,
  geo,
}: {
  attribution:
    UsageEpochAttribution;

  event:
    any;

  geo: {
    countryCode:
      string |
      null;

    regionCode:
      string |
      null;

    city:
      string |
      null;
  };
}) {
  const eventId =
    cleanString(
      event?.eventId
    );

  if (!eventId) {
    throw new Error(
      "Analytics projection eventId is required."
    );
  }


  const eventTs =
    requireEventTimestamp(
      event?.ts
    );

  const visitorHash =
    cleanString(
      event?.visitorHash
    );

  const sessionHash =
    cleanString(
      event?.sessionHash
    );

  const type =
    cleanString(
      event?.type
    );


  if (
    !visitorHash ||
    !sessionHash ||
    !type
  ) {
    throw new Error(
      "Analytics projection event identity is incomplete."
    );
  }


  const eventFingerprint =
    sha256(
      eventId
    );


  return {
    pk:
      createUsageEpochAnalyticsPartitionKey(
        attribution
          .usageEpochId
      ),

    sk:
      createUsageEpochAnalyticsEventSortKey(
        eventId
      ),

    schema:
      USAGE_EPOCH_ANALYTICS_EVENT_DOCUMENT_SCHEMA,

    /**
     * V2 adds only privacy-safe traffic-classification evidence.
     *
     * Existing V1 records remain immutable and valid. Event identity
     * and the DynamoDB EVENT# sort key are unchanged, so retries of
     * events originally projected as V1 remain idempotent rather than
     * mutating historical rows into V2.
     */
    schemaId:
      USAGE_EPOCH_ANALYTICS_EVENT_SCHEMA_ID_V2,

    usageEpochId:
      attribution
        .usageEpochId,

    stage:
      attribution.stage,

    deploymentConfigurationId:
      attribution
        .deploymentConfigurationId,

    platformReleaseId:
      attribution
        .platformReleaseId,

    profileVariantId:
      attribution
        .profileVariantId,

    eventFingerprint,

    ts:
      eventTs,

    day:
      new Date(
        eventTs
      )
        .toISOString()
        .slice(
          0,
          10
        ),

    visitorHash,

    sessionHash,

    type,

    /**
     * Coarse, bounded evidence only.
     *
     * No raw User-Agent, IP address, pointer coordinates,
     * keyboard contents, or browser fingerprint material.
     */
    trafficEvidence:
      normalizeTrafficEvidence(
        event
          ?.trafficEvidence
      ),

    countryCode:
      optionalString(
        geo?.countryCode
      ),

    regionCode:
      optionalString(
        geo?.regionCode
      ),

    city:
      optionalString(
        geo?.city
      ),

    section:
      optionalString(
        event?.section
      ),

    ctaId:
      optionalString(
        event?.ctaId
      ),

    projectId:
      optionalString(
        event?.projectId
      ),

    snippetId:
      optionalString(
        event?.snippetId
      ),

    depthPct:
      typeof event?.depthPct ===
          "number"
        ? event.depthPct
        : null,

    ms:
      typeof event?.ms ===
          "number"
        ? event.ms
        : null,

    path:
      optionalString(
        event?.path
      ),

    hash:
      optionalString(
        event?.hash
      ),
  };
}


export async function writeUsageEpochAnalyticsEvent({
  client,
  projectionTableName,
  record,
}: {
  client:
    DynamoDbSender;

  projectionTableName:
    string;

  record:
    any;
}) {
  const table =
    requireTableName(
      projectionTableName,
      "Usage Epoch Analytics table name"
    );


  try {
    await client.send(
      new PutItemCommand({
        TableName:
          table,

        Item:
          marshall(
            record
          ),

        ExpressionAttributeNames: {
          "#pk":
            "pk",

          "#sk":
            "sk",
        },

        ConditionExpression:
          "attribute_not_exists(#pk) AND attribute_not_exists(#sk)",
      })
    );


    return {
      written:
        true,

      duplicate:
        false,
    };
  } catch (
    error:
      any
  ) {
    /**
     * Analytics eventId is the existing ingest idempotency key.
     *
     * First write wins for the same event ID inside one Usage Epoch,
     * matching the live Analytics deduplication contract.
     */
    if (
      error?.name ===
        "ConditionalCheckFailedException"
    ) {
      return {
        written:
          false,

        duplicate:
          true,
      };
    }


    throw error;
  }
}


export async function projectAnalyticsEventToUsageEpoch({
  client,
  usageEpochTableName,
  projectionTableName,
  stage,
  event,
  geo,
}: {
  client:
    DynamoDbSender;

  usageEpochTableName:
    string;

  projectionTableName:
    string;

  stage:
    string;

  event:
    any;

  geo: {
    countryCode:
      string |
      null;

    regionCode:
      string |
      null;

    city:
      string |
      null;
  };
}) {
  /**
   * Keeps local/pre-P8 tests and partially configured environments
   * backward-compatible.
   *
   * Production infrastructure wires both values together.
   */
  if (
    !cleanString(
      usageEpochTableName
    ) ||
    !cleanString(
      projectionTableName
    )
  ) {
    return {
      projected:
        false,

      duplicate:
        false,

      reason:
        "unconfigured" as const,

      usageEpochId:
        null,
    };
  }


  const deploymentConfigurationId =
    normalizeId(
      event
        ?.deploymentConfigurationId
    );

  const platformReleaseId =
    normalizeId(
      event
        ?.platformReleaseId
    );

  const profileVariantId =
    normalizeId(
      event
        ?.profileVariantId
    );


  /**
   * Legacy/pre-formal Analytics remains valid for the live dashboard,
   * but cannot be assigned to immutable Usage Epoch history.
   */
  if (
    !deploymentConfigurationId ||
    !platformReleaseId ||
    !profileVariantId
  ) {
    return {
      projected:
        false,

      duplicate:
        false,

      reason:
        "incomplete_runtime_identity" as const,

      usageEpochId:
        null,
    };
  }


  const attribution =
    await resolveUsageEpochForAnalyticsEvent({
      client,

      usageEpochTableName,

      stage:
        requireStage(
          stage
        ),

      eventTs:
        event.ts,

      deploymentConfigurationId,

      platformReleaseId,

      profileVariantId,
    });


  if (!attribution) {
    return {
      projected:
        false,

      duplicate:
        false,

      reason:
        "no_matching_usage_epoch" as const,

      usageEpochId:
        null,
    };
  }


  const record =
    createUsageEpochAnalyticsEventRecord({
      attribution,

      event,

      geo,
    });


  const write =
    await writeUsageEpochAnalyticsEvent({
      client,

      projectionTableName,

      record,
    });


  return {
    projected:
      true,

    duplicate:
      write.duplicate,

    reason:
      null,

    usageEpochId:
      attribution
        .usageEpochId,
  };
}