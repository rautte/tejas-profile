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


export const CONFIGURATION_ANALYTICS_REPORT_DOCUMENT_SCHEMA =
  "tejas-profile.configuration-analytics-report";

export const CONFIGURATION_ANALYTICS_REPORT_SCHEMA_ID_V1 =
  "tejas-profile.configuration-analytics-report.v1";


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
    new Set<string>(
      ARCHIVED_ANALYTICS_KEYS
    );


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
  };
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


export function computeConfigurationAnalyticsReportId({
  stage,

  usageEpochId,
}: {
  stage:
    | "dev"
    | "prod";

  usageEpochId:
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


  const identityMaterial =
    [
      CONFIGURATION_ANALYTICS_REPORT_SCHEMA_ID_V1,

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
) {
  if (
    !isPlainObject(
      input
    )
  ) {
    throw new Error(
      "Configuration Analytics Report must be an object."
    );
  }


  assertAllowedKeys(
    input,
    new Set([
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
    ]),
    "Configuration Analytics Report"
  );


  if (
    input.schema !==
      CONFIGURATION_ANALYTICS_REPORT_DOCUMENT_SCHEMA
  ) {
    throw new Error(
      `schema must be "${CONFIGURATION_ANALYTICS_REPORT_DOCUMENT_SCHEMA}".`
    );
  }


  if (
    input.schemaId !==
      CONFIGURATION_ANALYTICS_REPORT_SCHEMA_ID_V1
  ) {
    throw new Error(
      `schemaId must be "${CONFIGURATION_ANALYTICS_REPORT_SCHEMA_ID_V1}".`
    );
  }


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
    normalizeAnalytics(
      input.analytics
    );


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
    });


  if (
    reportId !==
      expectedReportId
  ) {
    throw new Error(
      `reportId must be "${expectedReportId}" for this Configuration Analytics Report identity.`
    );
  }


  return {
    schema:
      CONFIGURATION_ANALYTICS_REPORT_DOCUMENT_SCHEMA,

    schemaId:
      CONFIGURATION_ANALYTICS_REPORT_SCHEMA_ID_V1,

    reportId,

    stage,

    usageEpochId,

    deploymentConfigurationId,

    platformReleaseId,

    profileVariantId,

    interval,

    openedBy,

    closedBy,

    analytics,
  };
}


export function createConfigurationAnalyticsReportDocument({
  epoch,

  analytics,
}: {
  epoch:
    unknown;

  analytics:
    unknown;
}) {
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
    });


  return normalizeAndValidateConfigurationAnalyticsReportDocument({
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