// infra/cdk/lambda/configuration-analytics-report-contract.ts

import * as crypto from "node:crypto";

import {
  computeDeploymentConfigurationId,
} from "./deployment-configuration-contract";

import {
  USAGE_EPOCH_STATE,
  USAGE_EPOCH_TRANSITION_KIND,
  computeUsageEpochId,
  normalizeAndValidateUsageEpochDocument,
} from "./usage-epoch-contract";

import {
  TRAFFIC_CLASSIFIER_VERSION,
} from "./traffic-classification";


export const CONFIGURATION_ANALYTICS_REPORT_DOCUMENT_SCHEMA =
  "tejas-profile.configuration-analytics-report";

export const CONFIGURATION_ANALYTICS_REPORT_SCHEMA_ID_V1 =
  "tejas-profile.configuration-analytics-report.v1";

export const CONFIGURATION_ANALYTICS_REPORT_SCHEMA_ID_V2 =
  "tejas-profile.configuration-analytics-report.v2";


const TRAFFIC_REPORT_KEYS =
  [
    "all",
    "likely_human",
    "likely_automated",
    "uncertain",
  ] as const;


const ID_RE =
  /^[A-Za-z0-9._:-]+$/;

const REPORT_ID_RE =
  /^car_[a-f0-9]{64}$/;


const ARCHIVED_ANALYTICS_KEYS =
  [
    "overview",
    "sections",
    "ctas",
    "projects",
    "snippets",
    "deepLinks",
    "depthMilestones",
    "countries",
    "cities",
    "daily",
  ] as const;


/**
 * Added after V2 shipped, so they are allowed but never required --
 * reports finalized before this field existed simply omit them.
 * "engagement" is the Outreach Score session-quality input; "outreachScore"
 * is the score computed once at finalization time from this exact
 * slice's own overview/sections/ctas/projects/deepLinks/engagement,
 * then permanently fixed like the rest of the report.
 */
const ARCHIVED_ANALYTICS_OPTIONAL_KEYS =
  [
    "engagement",
    "outreachScore",
  ] as const;


type PlainObject =
  Record<
    string,
    any
  >;


function cleanString(
  value:
    unknown
) {
  return String(
    value ?? ""
  ).trim();
}


function isPlainObject(
  value:
    unknown
): value is PlainObject {
  if (
    !value ||
    typeof value !==
      "object" ||
    Array.isArray(
      value
    )
  ) {
    return false;
  }


  const proto =
    Object.getPrototypeOf(
      value
    );


  return (
    proto ===
      Object.prototype ||
    proto ===
      null
  );
}


function assertAllowedKeys(
  input:
    PlainObject,

  allowed:
    Set<string>,

  field:
    string
) {
  for (
    const key of
      Object.keys(
        input
      )
  ) {
    if (
      !allowed.has(
        key
      )
    ) {
      throw new Error(
        `${field}.${key} is not supported.`
      );
    }
  }
}


function requireString(
  value:
    unknown,

  field:
    string,

  maxLength:
    number
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


  if (
    normalized.length >
      maxLength
  ) {
    throw new Error(
      `${field} is too long.`
    );
  }


  return normalized;
}


function requireId(
  value:
    unknown,

  field:
    string
) {
  const normalized =
    requireString(
      value,
      field,
      160
    );


  if (
    !ID_RE.test(
      normalized
    )
  ) {
    throw new Error(
      `${field} is invalid.`
    );
  }


  return normalized;
}


function requireReportId(
  value:
    unknown
) {
  const normalized =
    requireString(
      value,
      "reportId",
      68
    );


  if (
    !REPORT_ID_RE.test(
      normalized
    )
  ) {
    throw new Error(
      "reportId is invalid."
    );
  }


  return normalized;
}


function requireReportSchemaId(
  value:
    unknown
) {
  const normalized =
    cleanString(
      value
    );


  if (
    normalized !==
      CONFIGURATION_ANALYTICS_REPORT_SCHEMA_ID_V1 &&
    normalized !==
      CONFIGURATION_ANALYTICS_REPORT_SCHEMA_ID_V2
  ) {
    throw new Error(
      `schemaId must be "${CONFIGURATION_ANALYTICS_REPORT_SCHEMA_ID_V1}" or "${CONFIGURATION_ANALYTICS_REPORT_SCHEMA_ID_V2}".`
    );
  }


  return normalized;
}


function requireStage(
  value:
    unknown
) {
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
      'stage must be "dev" or "prod".'
    );
  }


  return normalized as
    | "dev"
    | "prod";
}


function requireCanonicalTimestamp(
  value:
    unknown,

  field:
    string
) {
  const normalized =
    requireString(
      value,
      field,
      64
    );

  const parsed =
    new Date(
      normalized
    );


  if (
    Number.isNaN(
      parsed.getTime()
    ) ||
    parsed.toISOString() !==
      normalized
  ) {
    throw new Error(
      `${field} must be a canonical UTC ISO timestamp.`
    );
  }


  return normalized;
}


function normalizeTransition(
  input:
    unknown,

  field:
    string
) {
  if (
    !isPlainObject(
      input
    )
  ) {
    throw new Error(
      `${field} must be an object.`
    );
  }


  assertAllowedKeys(
    input,
    new Set([
      "kind",
      "occurrenceId",
    ]),
    field
  );


  const kind =
    cleanString(
      input.kind
    );


  if (
    kind !==
      USAGE_EPOCH_TRANSITION_KIND
        .PROFILE_ACTIVATION &&
    kind !==
      USAGE_EPOCH_TRANSITION_KIND
        .PLATFORM_DEPLOYMENT
  ) {
    throw new Error(
      `${field}.kind is invalid.`
    );
  }


  return {
    kind,

    occurrenceId:
      requireId(
        input.occurrenceId,
        `${field}.occurrenceId`
      ),
  };
}


function normalizeJsonValue(
  value:
    unknown,

  field:
    string
): any {
  if (
    value === null ||
    typeof value ===
      "string" ||
    typeof value ===
      "boolean"
  ) {
    return value;
  }


  if (
    typeof value ===
      "number"
  ) {
    if (
      !Number.isFinite(
        value
      )
    ) {
      throw new Error(
        `${field} must contain only finite JSON numbers.`
      );
    }


    return value;
  }


  if (
    Array.isArray(
      value
    )
  ) {
    return value.map(
      (
        entry,
        index
      ) =>
        normalizeJsonValue(
          entry,
          `${field}[${index}]`
        )
    );
  }


  if (
    isPlainObject(
      value
    )
  ) {
    const out:
      PlainObject =
        {};


    for (
      const [
        key,
        entry,
      ] of Object.entries(
        value
      )
    ) {
      out[key] =
        normalizeJsonValue(
          entry,
          `${field}.${key}`
        );
    }


    return out;
  }


  throw new Error(
    `${field} must contain only JSON-safe values.`
  );
}


function normalizeAnalytics(
  input:
    unknown
) {
  if (
    !isPlainObject(
      input
    )
  ) {
    throw new Error(
      "analytics must be an object."
    );
  }


  const allowed =
    new Set<string>([
      ...ARCHIVED_ANALYTICS_KEYS,
      ...ARCHIVED_ANALYTICS_OPTIONAL_KEYS,
    ]);


  assertAllowedKeys(
    input,
    allowed,
    "analytics"
  );


  for (
    const key of
      ARCHIVED_ANALYTICS_KEYS
  ) {
    if (
      !Object.prototype
        .hasOwnProperty
        .call(
          input,
          key
        )
    ) {
      throw new Error(
        `analytics.${key} is required.`
      );
    }
  }


  if (
    !isPlainObject(
      input.overview
    )
  ) {
    throw new Error(
      "analytics.overview must be an object."
    );
  }


  const arrayFields =
    ARCHIVED_ANALYTICS_KEYS
      .filter(
        (
          key
        ) =>
          key !==
          "overview"
      );


  for (
    const key of
      arrayFields
  ) {
    if (
      !Array.isArray(
        input[key]
      )
    ) {
      throw new Error(
        `analytics.${key} must be an array.`
      );
    }
  }


  return {
    overview:
      normalizeJsonValue(
        input.overview,
        "analytics.overview"
      ),

    sections:
      normalizeJsonValue(
        input.sections,
        "analytics.sections"
      ),

    ctas:
      normalizeJsonValue(
        input.ctas,
        "analytics.ctas"
      ),

    projects:
      normalizeJsonValue(
        input.projects,
        "analytics.projects"
      ),

    snippets:
      normalizeJsonValue(
        input.snippets,
        "analytics.snippets"
      ),

    deepLinks:
      normalizeJsonValue(
        input.deepLinks,
        "analytics.deepLinks"
      ),

    depthMilestones:
      normalizeJsonValue(
        input.depthMilestones,
        "analytics.depthMilestones"
      ),

    countries:
      normalizeJsonValue(
        input.countries,
        "analytics.countries"
      ),

    cities:
      normalizeJsonValue(
        input.cities,
        "analytics.cities"
      ),

    daily:
      normalizeJsonValue(
        input.daily,
        "analytics.daily"
      ),

    ...(
      Object.prototype
        .hasOwnProperty
        .call(
          input,
          "engagement"
        )
        ? {
            engagement:
              normalizeJsonValue(
                input.engagement,
                "analytics.engagement"
              ),
          }
        : {}
    ),

    ...(
      Object.prototype
        .hasOwnProperty
        .call(
          input,
          "outreachScore"
        )
        ? {
            outreachScore:
              normalizeJsonValue(
                input.outreachScore,
                "analytics.outreachScore"
              ),
          }
        : {}
    ),
  };
}


function requireNonNegativeInteger(
  value:
    unknown,

  field:
    string
) {
  const normalized =
    Number(
      value
    );


  if (
    !Number.isInteger(
      normalized
    ) ||
    normalized <
      0
  ) {
    throw new Error(
      `${field} must be a non-negative integer.`
    );
  }


  return normalized;
}


function normalizeTrafficSummaryBucket(
  input:
    unknown,

  field:
    string
) {
  if (
    !isPlainObject(
      input
    )
  ) {
    throw new Error(
      `${field} must be an object.`
    );
  }


  assertAllowedKeys(
    input,
    new Set([
      "uniqueVisitors",
      "sessions",
      "eventCount",
      "activeMs",
    ]),
    field
  );


  return {
    uniqueVisitors:
      requireNonNegativeInteger(
        input.uniqueVisitors,
        `${field}.uniqueVisitors`
      ),

    sessions:
      requireNonNegativeInteger(
        input.sessions,
        `${field}.sessions`
      ),

    eventCount:
      requireNonNegativeInteger(
        input.eventCount,
        `${field}.eventCount`
      ),

    activeMs:
      requireNonNegativeInteger(
        input.activeMs,
        `${field}.activeMs`
      ),
  };
}


function normalizeTrafficReport(
  input:
    unknown
) {
  if (
    !isPlainObject(
      input
    )
  ) {
    throw new Error(
      "traffic must be an object."
    );
  }


  assertAllowedKeys(
    input,
    new Set([
      "classifierVersion",
      "summary",
    ]),
    "traffic"
  );


  const classifierVersion =
    requireString(
      input.classifierVersion,
      "traffic.classifierVersion",
      120
    );


  /**
   * Report V2 is deliberately bound to classifier.v1.
   *
   * A future classifier algorithm must advance the immutable report
   * schema instead of silently rebuilding identical report IDs with
   * different classification semantics.
   */
  if (
    classifierVersion !==
      TRAFFIC_CLASSIFIER_VERSION
  ) {
    throw new Error(
      `traffic.classifierVersion must be "${TRAFFIC_CLASSIFIER_VERSION}" for report V2.`
    );
  }


  if (
    !isPlainObject(
      input.summary
    )
  ) {
    throw new Error(
      "traffic.summary must be an object."
    );
  }


  assertAllowedKeys(
    input.summary,
    new Set<string>(
      TRAFFIC_REPORT_KEYS
    ),
    "traffic.summary"
  );


  for (
    const key of
      TRAFFIC_REPORT_KEYS
  ) {
    if (
      !Object.prototype
        .hasOwnProperty
        .call(
          input.summary,
          key
        )
    ) {
      throw new Error(
        `traffic.summary.${key} is required.`
      );
    }
  }


  return {
    classifierVersion,

    summary: {
      all:
        normalizeTrafficSummaryBucket(
          input.summary.all,
          "traffic.summary.all"
        ),

      likely_human:
        normalizeTrafficSummaryBucket(
          input.summary
            .likely_human,
          "traffic.summary.likely_human"
        ),

      likely_automated:
        normalizeTrafficSummaryBucket(
          input.summary
            .likely_automated,
          "traffic.summary.likely_automated"
        ),

      uncertain:
        normalizeTrafficSummaryBucket(
          input.summary.uncertain,
          "traffic.summary.uncertain"
        ),
    },
  };
}


function normalizeAnalyticsByTraffic(
  input:
    unknown
) {
  if (
    !isPlainObject(
      input
    )
  ) {
    throw new Error(
      "analyticsByTraffic must be an object."
    );
  }


  assertAllowedKeys(
    input,
    new Set<string>(
      TRAFFIC_REPORT_KEYS
    ),
    "analyticsByTraffic"
  );


  for (
    const key of
      TRAFFIC_REPORT_KEYS
  ) {
    if (
      !Object.prototype
        .hasOwnProperty
        .call(
          input,
          key
        )
    ) {
      throw new Error(
        `analyticsByTraffic.${key} is required.`
      );
    }
  }


  return {
    all:
      normalizeAnalytics(
        input.all
      ),

    likely_human:
      normalizeAnalytics(
        input
          .likely_human
      ),

    likely_automated:
      normalizeAnalytics(
        input
          .likely_automated
      ),

    uncertain:
      normalizeAnalytics(
        input.uncertain
      ),
  };
}


function assertTrafficReportConsistency(
  traffic:
    ReturnType<
      typeof normalizeTrafficReport
    >,

  analyticsByTraffic:
    ReturnType<
      typeof normalizeAnalyticsByTraffic
    >
) {
  const fields = [
    "uniqueVisitors",
    "sessions",
    "eventCount",
    "activeMs",
  ] as const;


  for (
    const key of
      TRAFFIC_REPORT_KEYS
  ) {
    const summary =
      traffic
        .summary[key];

    const overview =
      analyticsByTraffic[
        key
      ].overview;


    for (
      const field of
        fields
    ) {
      const actual =
        requireNonNegativeInteger(
          overview?.[field],
          `analyticsByTraffic.${key}.overview.${field}`
        );


      if (
        actual !==
          summary[field]
      ) {
        throw new Error(
          `traffic.summary.${key}.${field} does not match analyticsByTraffic.${key}.overview.${field}.`
        );
      }
    }
  }


  /**
   * Sessions are assigned to exactly one classification.
   *
   * Events and active time therefore partition exactly as well.
   * Unique visitors intentionally do NOT have additive semantics:
   * one visitor can own sessions in multiple traffic classes.
   */
  for (
    const field of [
      "sessions",
      "eventCount",
      "activeMs",
    ] as const
  ) {
    const expected =
      traffic
        .summary
        .likely_human[
          field
        ] +
      traffic
        .summary
        .likely_automated[
          field
        ] +
      traffic
        .summary
        .uncertain[
          field
        ];


    if (
      traffic
        .summary
        .all[field] !==
      expected
    ) {
      throw new Error(
        `traffic.summary.${field} classes must partition All traffic exactly.`
      );
    }
  }


  const classifiedUniqueSum =
    traffic
      .summary
      .likely_human
      .uniqueVisitors +
    traffic
      .summary
      .likely_automated
      .uniqueVisitors +
    traffic
      .summary
      .uncertain
      .uniqueVisitors;

  const largestClassUnique =
    Math.max(
      traffic
        .summary
        .likely_human
        .uniqueVisitors,

      traffic
        .summary
        .likely_automated
        .uniqueVisitors,

      traffic
        .summary
        .uncertain
        .uniqueVisitors
    );


  if (
    traffic
      .summary
      .all
      .uniqueVisitors <
        largestClassUnique ||
    traffic
      .summary
      .all
      .uniqueVisitors >
        classifiedUniqueSum
  ) {
    throw new Error(
      "traffic.summary unique visitor overlap semantics are invalid."
    );
  }
}


function normalizeInterval(
  input:
    unknown
) {
  if (
    !isPlainObject(
      input
    )
  ) {
    throw new Error(
      "interval must be an object."
    );
  }


  assertAllowedKeys(
    input,
    new Set([
      "startedAt",
      "endedAt",
    ]),
    "interval"
  );


  const startedAt =
    requireCanonicalTimestamp(
      input.startedAt,
      "interval.startedAt"
    );

  const endedAt =
    requireCanonicalTimestamp(
      input.endedAt,
      "interval.endedAt"
    );


  if (
    new Date(
      endedAt
    ).getTime() <
    new Date(
      startedAt
    ).getTime()
  ) {
    throw new Error(
      "interval.endedAt cannot precede interval.startedAt."
    );
  }


  return {
    startedAt,
    endedAt,
  };
}


type ConfigurationAnalyticsReportCommon = {
  schema:
    typeof CONFIGURATION_ANALYTICS_REPORT_DOCUMENT_SCHEMA;

  reportId:
    string;

  stage:
    | "dev"
    | "prod";

  usageEpochId:
    string;

  deploymentConfigurationId:
    string;

  platformReleaseId:
    string;

  profileVariantId:
    string;

  interval:
    ReturnType<
      typeof normalizeInterval
    >;

  openedBy:
    ReturnType<
      typeof normalizeTransition
    >;

  closedBy:
    ReturnType<
      typeof normalizeTransition
    >;
};


export type ConfigurationAnalyticsReportV1Document =
  ConfigurationAnalyticsReportCommon & {
    schemaId:
      typeof CONFIGURATION_ANALYTICS_REPORT_SCHEMA_ID_V1;

    analytics:
      ReturnType<
        typeof normalizeAnalytics
      >;
  };


export type ConfigurationAnalyticsReportV2Document =
  ConfigurationAnalyticsReportCommon & {
    schemaId:
      typeof CONFIGURATION_ANALYTICS_REPORT_SCHEMA_ID_V2;

    traffic:
      ReturnType<
        typeof normalizeTrafficReport
      >;

    analyticsByTraffic:
      ReturnType<
        typeof normalizeAnalyticsByTraffic
      >;
  };


export type ConfigurationAnalyticsReportDocument =
  | ConfigurationAnalyticsReportV1Document
  | ConfigurationAnalyticsReportV2Document;


export function computeConfigurationAnalyticsReportId({
  stage,

  usageEpochId,

  schemaId =
    CONFIGURATION_ANALYTICS_REPORT_SCHEMA_ID_V1,
}: {
  stage:
    | "dev"
    | "prod";

  usageEpochId:
    string;

  schemaId?:
    string;
}) {
  const normalizedStage =
    requireStage(
      stage
    );

  const normalizedUsageEpochId =
    requireId(
      usageEpochId,
      "usageEpochId"
    );

  const normalizedSchemaId =
    requireReportSchemaId(
      schemaId
    );


  const identityMaterial =
    [
      normalizedSchemaId,

      normalizedStage,

      normalizedUsageEpochId,
    ].join(
      "\n"
    );


  const digest =
    crypto
      .createHash(
        "sha256"
      )
      .update(
        identityMaterial,
        "utf8"
      )
      .digest(
        "hex"
      );


  return `car_${digest}`;
}


export function createConfigurationAnalyticsReportObjectKey(
  reportId:
    string
) {
  const normalized =
    requireReportId(
      reportId
    );


  return (
    `reports/${normalized}.json`
  );
}


export function normalizeAndValidateConfigurationAnalyticsReportDocument(
  input:
    unknown
): ConfigurationAnalyticsReportDocument {
  if (
    !isPlainObject(
      input
    )
  ) {
    throw new Error(
      "Configuration Analytics Report must be an object."
    );
  }


  if (
    input.schema !==
      CONFIGURATION_ANALYTICS_REPORT_DOCUMENT_SCHEMA
  ) {
    throw new Error(
      `schema must be "${CONFIGURATION_ANALYTICS_REPORT_DOCUMENT_SCHEMA}".`
    );
  }


  const schemaId =
    requireReportSchemaId(
      input.schemaId
    );

  const isV2 =
    schemaId ===
      CONFIGURATION_ANALYTICS_REPORT_SCHEMA_ID_V2;


  assertAllowedKeys(
    input,
    new Set(
      isV2
        ? [
            "schema",
            "schemaId",
            "reportId",
            "stage",
            "usageEpochId",
            "deploymentConfigurationId",
            "platformReleaseId",
            "profileVariantId",
            "interval",
            "openedBy",
            "closedBy",
            "traffic",
            "analyticsByTraffic",
          ]
        : [
            "schema",
            "schemaId",
            "reportId",
            "stage",
            "usageEpochId",
            "deploymentConfigurationId",
            "platformReleaseId",
            "profileVariantId",
            "interval",
            "openedBy",
            "closedBy",
            "analytics",
          ]
    ),
    "Configuration Analytics Report"
  );


  const stage =
    requireStage(
      input.stage
    );

  const usageEpochId =
    requireId(
      input.usageEpochId,
      "usageEpochId"
    );

  const deploymentConfigurationId =
    requireId(
      input.deploymentConfigurationId,
      "deploymentConfigurationId"
    );

  const platformReleaseId =
    requireId(
      input.platformReleaseId,
      "platformReleaseId"
    );

  const profileVariantId =
    requireId(
      input.profileVariantId,
      "profileVariantId"
    );

  const interval =
    normalizeInterval(
      input.interval
    );

  const openedBy =
    normalizeTransition(
      input.openedBy,
      "openedBy"
    );

  const closedBy =
    normalizeTransition(
      input.closedBy,
      "closedBy"
    );

  const analytics =
    isV2
      ? null
      : normalizeAnalytics(
          input.analytics
        );

  const traffic =
    isV2
      ? normalizeTrafficReport(
          input.traffic
        )
      : null;

  const analyticsByTraffic =
    isV2
      ? normalizeAnalyticsByTraffic(
          input
            .analyticsByTraffic
        )
      : null;


  if (
    isV2 &&
    traffic &&
    analyticsByTraffic
  ) {
    assertTrafficReportConsistency(
      traffic,
      analyticsByTraffic
    );
  }


  const expectedConfigurationId =
    computeDeploymentConfigurationId({
      stage,

      platformReleaseId,

      profileVariantId,
    });


  if (
    deploymentConfigurationId !==
      expectedConfigurationId
  ) {
    throw new Error(
      `deploymentConfigurationId must be "${expectedConfigurationId}" for this report composition.`
    );
  }


  const expectedUsageEpochId =
    computeUsageEpochId({
      stage,

      deploymentConfigurationId,

      openedBy,
    });


  if (
    usageEpochId !==
      expectedUsageEpochId
  ) {
    throw new Error(
      `usageEpochId must be "${expectedUsageEpochId}" for this report Usage Epoch identity.`
    );
  }


  const reportId =
    requireReportId(
      input.reportId
    );

  const expectedReportId =
    computeConfigurationAnalyticsReportId({
      stage,

      usageEpochId,

      schemaId,
    });


  if (
    reportId !==
      expectedReportId
  ) {
    throw new Error(
      `reportId must be "${expectedReportId}" for this Configuration Analytics Report identity.`
    );
  }


  const common:
    ConfigurationAnalyticsReportCommon = {
    schema:
      CONFIGURATION_ANALYTICS_REPORT_DOCUMENT_SCHEMA,

    reportId,

    stage,

    usageEpochId,

    deploymentConfigurationId,

    platformReleaseId,

    profileVariantId,

    interval,

    openedBy,

    closedBy,
  };


  if (
    isV2
  ) {
    return {
      ...common,

      schemaId:
        CONFIGURATION_ANALYTICS_REPORT_SCHEMA_ID_V2,

      traffic:
        traffic!,

      analyticsByTraffic:
        analyticsByTraffic!,
    };
  }


  return {
    ...common,

    schemaId:
      CONFIGURATION_ANALYTICS_REPORT_SCHEMA_ID_V1,

    analytics:
      analytics!,
  };
}


function normalizeAndRequireConfigurationAnalyticsReportV1(
  input:
    unknown
): ConfigurationAnalyticsReportV1Document {
  const report =
    normalizeAndValidateConfigurationAnalyticsReportDocument(
      input
    );


  if (
    report.schemaId !==
      CONFIGURATION_ANALYTICS_REPORT_SCHEMA_ID_V1
  ) {
    throw new Error(
      "Configuration Analytics Report V1 creator produced an unexpected schema."
    );
  }


  return report;
}


function normalizeAndRequireConfigurationAnalyticsReportV2(
  input:
    unknown
): ConfigurationAnalyticsReportV2Document {
  const report =
    normalizeAndValidateConfigurationAnalyticsReportDocument(
      input
    );


  if (
    report.schemaId !==
      CONFIGURATION_ANALYTICS_REPORT_SCHEMA_ID_V2
  ) {
    throw new Error(
      "Configuration Analytics Report V2 creator produced an unexpected schema."
    );
  }


  return report;
}


export function createConfigurationAnalyticsReportDocument({
  epoch,

  analytics,
}: {
  epoch:
    unknown;

  analytics:
    unknown;
}): ConfigurationAnalyticsReportV1Document {
  const normalizedEpoch =
    normalizeAndValidateUsageEpochDocument(
      epoch
    );


  if (
    normalizedEpoch.state !==
      USAGE_EPOCH_STATE
        .CLOSING
  ) {
    throw new Error(
      "Configuration Analytics Report can only be created from a CLOSING Usage Epoch."
    );
  }


  if (
    !normalizedEpoch.endedAt ||
    !normalizedEpoch.closedBy
  ) {
    throw new Error(
      "CLOSING Usage Epoch is missing report boundaries."
    );
  }


  const reportId =
    computeConfigurationAnalyticsReportId({
      stage:
        normalizedEpoch.stage,

      usageEpochId:
        normalizedEpoch
          .usageEpochId,

      schemaId:
        CONFIGURATION_ANALYTICS_REPORT_SCHEMA_ID_V1,
    });


  return normalizeAndRequireConfigurationAnalyticsReportV1({
    schema:
      CONFIGURATION_ANALYTICS_REPORT_DOCUMENT_SCHEMA,

    schemaId:
      CONFIGURATION_ANALYTICS_REPORT_SCHEMA_ID_V1,

    reportId,

    stage:
      normalizedEpoch.stage,

    usageEpochId:
      normalizedEpoch
        .usageEpochId,

    deploymentConfigurationId:
      normalizedEpoch
        .deploymentConfigurationId,

    platformReleaseId:
      normalizedEpoch
        .platformReleaseId,

    profileVariantId:
      normalizedEpoch
        .profileVariantId,

    interval: {
      startedAt:
        normalizedEpoch
          .startedAt,

      endedAt:
        normalizedEpoch
          .endedAt,
    },

    openedBy:
      normalizedEpoch
        .openedBy,

    closedBy:
      normalizedEpoch
        .closedBy,

    analytics,
  });
}


export function createConfigurationAnalyticsReportV2Document({
  epoch,

  traffic,

  analyticsByTraffic,
}: {
  epoch:
    unknown;

  traffic:
    unknown;

  analyticsByTraffic:
    unknown;
}): ConfigurationAnalyticsReportV2Document {
  const normalizedEpoch =
    normalizeAndValidateUsageEpochDocument(
      epoch
    );


  if (
    normalizedEpoch.state !==
      USAGE_EPOCH_STATE
        .CLOSING
  ) {
    throw new Error(
      "Configuration Analytics Report can only be created from a CLOSING Usage Epoch."
    );
  }


  if (
    !normalizedEpoch.endedAt ||
    !normalizedEpoch.closedBy
  ) {
    throw new Error(
      "CLOSING Usage Epoch is missing report boundaries."
    );
  }


  const reportId =
    computeConfigurationAnalyticsReportId({
      stage:
        normalizedEpoch.stage,

      usageEpochId:
        normalizedEpoch
          .usageEpochId,

      schemaId:
        CONFIGURATION_ANALYTICS_REPORT_SCHEMA_ID_V2,
    });


  return normalizeAndRequireConfigurationAnalyticsReportV2({
    schema:
      CONFIGURATION_ANALYTICS_REPORT_DOCUMENT_SCHEMA,

    schemaId:
      CONFIGURATION_ANALYTICS_REPORT_SCHEMA_ID_V2,

    reportId,

    stage:
      normalizedEpoch.stage,

    usageEpochId:
      normalizedEpoch
        .usageEpochId,

    deploymentConfigurationId:
      normalizedEpoch
        .deploymentConfigurationId,

    platformReleaseId:
      normalizedEpoch
        .platformReleaseId,

    profileVariantId:
      normalizedEpoch
        .profileVariantId,

    interval: {
      startedAt:
        normalizedEpoch
          .startedAt,

      endedAt:
        normalizedEpoch
          .endedAt,
    },

    openedBy:
      normalizedEpoch
        .openedBy,

    closedBy:
      normalizedEpoch
        .closedBy,

    traffic,

    analyticsByTraffic,
  });
}
