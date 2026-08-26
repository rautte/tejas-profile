import * as crypto from "node:crypto";

import {
  normalizeAndValidateDeploymentConfigurationDocument,
} from "./deployment-configuration-contract";


export const USAGE_EPOCH_DOCUMENT_SCHEMA =
  "tejas-profile.usage-epoch";

export const USAGE_EPOCH_SCHEMA_ID_V1 =
  "tejas-profile.usage-epoch.v1";

export const ACTIVE_USAGE_EPOCH_POINTER_DOCUMENT_SCHEMA =
  "tejas-profile.active-usage-epoch-pointer";

export const CURRENT_ACTIVE_USAGE_EPOCH_POINTER_SCHEMA_VERSION =
  1;

export const USAGE_EPOCH_CONTROL_PK =
  "CONTROL";

export const USAGE_EPOCH_ACTIVE_SK =
  "ACTIVE";

export const USAGE_EPOCH_STATE = {
  OPEN:
    "OPEN",

  CLOSING:
    "CLOSING",

  CLOSED:
    "CLOSED",
} as const;


export const USAGE_EPOCH_TRANSITION_KIND = {
  PROFILE_ACTIVATION:
    "profile_activation",

  PLATFORM_DEPLOYMENT:
    "platform_deployment",
} as const;


const ID_RE =
  /^[A-Za-z0-9._:-]+$/;

const SHA256_RE =
  /^[a-f0-9]{64}$/;


type PlainObject =
  Record<
    string,
    any
  >;


type UsageEpochState =
  typeof USAGE_EPOCH_STATE[
    keyof typeof USAGE_EPOCH_STATE
  ];


export type UsageEpochTransitionKind =
  typeof USAGE_EPOCH_TRANSITION_KIND[
    keyof typeof USAGE_EPOCH_TRANSITION_KIND
  ];


function cleanString(
  value:
    unknown
) {
  return String(
    value ??
      ""
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
  value:
    PlainObject,

  allowed:
    Set<string>,

  field:
    string
) {
  for (
    const key of
      Object.keys(
        value
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

  maxLength =
    240
) {
  const normalized =
    cleanString(
      value
    );


  if (
    !normalized
  ) {
    throw new Error(
      `${field} is required.`
    );
  }


  if (
    normalized.length >
      maxLength
  ) {
    throw new Error(
      `${field} exceeds ${maxLength} characters.`
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


function requireSha256(
  value:
    unknown,

  field:
    string
) {
  const normalized =
    cleanString(
      value
    ).toLowerCase();


  if (
    !SHA256_RE.test(
      normalized
    )
  ) {
    throw new Error(
      `${field} must be a 64-character SHA-256 digest.`
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

function requireRevision(
  value:
    unknown
) {
  const revision =
    Number(
      value
    );


  if (
    !Number.isInteger(
      revision
    ) ||
    revision <=
      0
  ) {
    throw new Error(
      "revision must be a positive integer."
    );
  }


  return revision;
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


function timestampMs(
  value:
    string
) {
  return new Date(
    value
  ).getTime();
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
    kind:
      kind as
        UsageEpochTransitionKind,

    occurrenceId:
      requireId(
        input.occurrenceId,
        `${field}.occurrenceId`
      ),
  };
}


function normalizeState(
  value:
    unknown
): UsageEpochState {
  const normalized =
    cleanString(
      value
    );


  if (
    normalized !==
      USAGE_EPOCH_STATE.OPEN &&
    normalized !==
      USAGE_EPOCH_STATE.CLOSING &&
    normalized !==
      USAGE_EPOCH_STATE.CLOSED
  ) {
    throw new Error(
      "state is invalid."
    );
  }


  return normalized as
    UsageEpochState;
}


function normalizeReport(
  input:
    unknown
) {
  if (
    !isPlainObject(
      input
    )
  ) {
    throw new Error(
      "report must be an object."
    );
  }


  assertAllowedKeys(
    input,
    new Set([
      "reportId",
      "reportSha256",
      "finalizedAt",
    ]),
    "report"
  );


  return {
    reportId:
      requireId(
        input.reportId,
        "report.reportId"
      ),

    reportSha256:
      requireSha256(
        input.reportSha256,
        "report.reportSha256"
      ),

    finalizedAt:
      requireCanonicalTimestamp(
        input.finalizedAt,
        "report.finalizedAt"
      ),
  };
}


export function computeUsageEpochId({
  stage,

  deploymentConfigurationId,

  openedBy,
}: {
  stage:
    | "dev"
    | "prod";

  deploymentConfigurationId:
    string;

  openedBy: {
    kind:
      UsageEpochTransitionKind;

    occurrenceId:
      string;
  };
}) {
  const normalizedStage =
    requireStage(
      stage
    );

  const normalizedConfigurationId =
    requireId(
      deploymentConfigurationId,
      "deploymentConfigurationId"
    );

  const normalizedOpenedBy =
    normalizeTransition(
      openedBy,
      "openedBy"
    );


  /**
   * Usage Epoch identity describes one occurrence of one
   * immutable Deployment Configuration becoming the effective
   * runtime composition.
   *
   * startedAt deliberately does NOT participate.
   *
   * This means retrying the same control-plane occurrence cannot
   * manufacture another Usage Epoch merely because wall-clock time
   * advanced between retries.
   */
  const identityMaterial =
    [
      USAGE_EPOCH_SCHEMA_ID_V1,

      normalizedStage,

      normalizedConfigurationId,

      normalizedOpenedBy
        .kind,

      normalizedOpenedBy
        .occurrenceId,
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


  return `uep_${digest}`;
}


export function normalizeAndValidateUsageEpochDocument(
  input:
    unknown
) {
  if (
    !isPlainObject(
      input
    )
  ) {
    throw new Error(
      "Usage Epoch must be an object."
    );
  }


  assertAllowedKeys(
    input,
    new Set([
      "schema",
      "schemaId",
      "usageEpochId",
      "stage",
      "deploymentConfigurationId",
      "platformReleaseId",
      "profileVariantId",
      "startedAt",
      "state",
      "endedAt",
      "openedBy",
      "closedBy",
      "report",
    ]),
    "Usage Epoch"
  );


  if (
    input.schema !==
      USAGE_EPOCH_DOCUMENT_SCHEMA
  ) {
    throw new Error(
      `schema must be "${USAGE_EPOCH_DOCUMENT_SCHEMA}".`
    );
  }


  if (
    input.schemaId !==
      USAGE_EPOCH_SCHEMA_ID_V1
  ) {
    throw new Error(
      `schemaId must be "${USAGE_EPOCH_SCHEMA_ID_V1}".`
    );
  }


  const stage =
    requireStage(
      input.stage
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

  const startedAt =
    requireCanonicalTimestamp(
      input.startedAt,
      "startedAt"
    );

  const openedBy =
    normalizeTransition(
      input.openedBy,
      "openedBy"
    );

  const usageEpochId =
    requireId(
      input.usageEpochId,
      "usageEpochId"
    );

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
      `usageEpochId must be "${expectedUsageEpochId}" for this Usage Epoch identity.`
    );
  }


  const state =
    normalizeState(
      input.state
    );


  let endedAt:
    string |
    null =
      null;

  let closedBy:
    ReturnType<
      typeof normalizeTransition
    > |
    null =
      null;

  let report:
    ReturnType<
      typeof normalizeReport
    > |
    null =
      null;


  if (
    input.endedAt !==
      null &&
    input.endedAt !==
      undefined
  ) {
    endedAt =
      requireCanonicalTimestamp(
        input.endedAt,
        "endedAt"
      );
  }


  if (
    input.closedBy !==
      null &&
    input.closedBy !==
      undefined
  ) {
    closedBy =
      normalizeTransition(
        input.closedBy,
        "closedBy"
      );
  }


  if (
    input.report !==
      null &&
    input.report !==
      undefined
  ) {
    report =
      normalizeReport(
        input.report
      );
  }


  if (
    endedAt &&
    timestampMs(
      endedAt
    ) <
      timestampMs(
        startedAt
      )
  ) {
    throw new Error(
      "endedAt cannot precede startedAt."
    );
  }


  if (
    state ===
      USAGE_EPOCH_STATE.OPEN
  ) {
    if (
      endedAt ||
      closedBy ||
      report
    ) {
      throw new Error(
        "OPEN Usage Epoch cannot have endedAt, closedBy, or report."
      );
    }
  }


  if (
    state ===
      USAGE_EPOCH_STATE.CLOSING
  ) {
    if (
      !endedAt ||
      !closedBy
    ) {
      throw new Error(
        "CLOSING Usage Epoch requires endedAt and closedBy."
      );
    }


    if (
      report
    ) {
      throw new Error(
        "CLOSING Usage Epoch cannot have a finalized report."
      );
    }
  }


  if (
    state ===
      USAGE_EPOCH_STATE.CLOSED
  ) {
    if (
      !endedAt ||
      !closedBy ||
      !report
    ) {
      throw new Error(
        "CLOSED Usage Epoch requires endedAt, closedBy, and report."
      );
    }


    if (
      timestampMs(
        report.finalizedAt
      ) <
      timestampMs(
        endedAt
      )
    ) {
      throw new Error(
        "report.finalizedAt cannot precede endedAt."
      );
    }
  }


  return {
    schema:
      USAGE_EPOCH_DOCUMENT_SCHEMA,

    schemaId:
      USAGE_EPOCH_SCHEMA_ID_V1,

    usageEpochId,

    stage,

    deploymentConfigurationId,

    platformReleaseId,

    profileVariantId,

    startedAt,

    state,

    endedAt,

    openedBy,

    closedBy,

    report,
  };
}


export function createOpenUsageEpochDocument({
  startedAt,

  deploymentConfiguration,

  openedBy,
}: {
  startedAt:
    string;

  deploymentConfiguration:
    unknown;

  openedBy: {
    kind:
      UsageEpochTransitionKind;

    occurrenceId:
      string;
  };
}) {
  const configuration =
    normalizeAndValidateDeploymentConfigurationDocument(
      deploymentConfiguration
    );

  const normalizedOpenedBy =
    normalizeTransition(
      openedBy,
      "openedBy"
    );

  const usageEpochId =
    computeUsageEpochId({
      stage:
        configuration.stage,

      deploymentConfigurationId:
        configuration
          .deploymentConfigurationId,

      openedBy:
        normalizedOpenedBy,
    });


  return normalizeAndValidateUsageEpochDocument({
    schema:
      USAGE_EPOCH_DOCUMENT_SCHEMA,

    schemaId:
      USAGE_EPOCH_SCHEMA_ID_V1,

    usageEpochId,

    stage:
      configuration.stage,

    deploymentConfigurationId:
      configuration
        .deploymentConfigurationId,

    platformReleaseId:
      configuration
        .platformReleaseId,

    profileVariantId:
      configuration
        .profileVariantId,

    startedAt,

    state:
      USAGE_EPOCH_STATE.OPEN,

    endedAt:
      null,

    openedBy:
      normalizedOpenedBy,

    closedBy:
      null,

    report:
      null,
  });
}


export function createClosingUsageEpochDocument({
  epoch,

  endedAt,

  closedBy,
}: {
  epoch:
    unknown;

  endedAt:
    string;

  closedBy: {
    kind:
      UsageEpochTransitionKind;

    occurrenceId:
      string;
  };
}) {
  const current =
    normalizeAndValidateUsageEpochDocument(
      epoch
    );


  if (
    current.state !==
      USAGE_EPOCH_STATE.OPEN
  ) {
    throw new Error(
      "Only an OPEN Usage Epoch can begin closing."
    );
  }


  return normalizeAndValidateUsageEpochDocument({
    ...current,

    state:
      USAGE_EPOCH_STATE.CLOSING,

    endedAt,

    closedBy,

    report:
      null,
  });
}


export function finalizeUsageEpochDocument({
  epoch,

  reportId,

  reportSha256,

  finalizedAt,
}: {
  epoch:
    unknown;

  reportId:
    string;

  reportSha256:
    string;

  finalizedAt:
    string;
}) {
  const current =
    normalizeAndValidateUsageEpochDocument(
      epoch
    );


  if (
    current.state !==
      USAGE_EPOCH_STATE.CLOSING
  ) {
    throw new Error(
      "Only a CLOSING Usage Epoch can be finalized."
    );
  }


  return normalizeAndValidateUsageEpochDocument({
    ...current,

    state:
      USAGE_EPOCH_STATE.CLOSED,

    report: {
      reportId,

      reportSha256,

      finalizedAt,
    },
  });
}

export function validateActiveUsageEpochPointer(
  pointer:
    any
) {
  if (
    !pointer ||
    typeof pointer !==
      "object" ||
    Array.isArray(
      pointer
    )
  ) {
    throw new Error(
      "Active Usage Epoch pointer must be an object."
    );
  }


  if (
    pointer.pk !==
      USAGE_EPOCH_CONTROL_PK ||
    pointer.sk !==
      USAGE_EPOCH_ACTIVE_SK
  ) {
    throw new Error(
      "Active Usage Epoch pointer has invalid DynamoDB keys."
    );
  }


  if (
    pointer.schema !==
      ACTIVE_USAGE_EPOCH_POINTER_DOCUMENT_SCHEMA
  ) {
    throw new Error(
      "Active Usage Epoch pointer schema is invalid."
    );
  }


  if (
    pointer
      .pointerSchemaVersion !==
      CURRENT_ACTIVE_USAGE_EPOCH_POINTER_SCHEMA_VERSION
  ) {
    throw new Error(
      "Active Usage Epoch pointer schema version is unsupported."
    );
  }


  const revision =
    requireRevision(
      pointer.revision
    );

  const stage =
    requireStage(
      pointer.stage
    );

  const usageEpochId =
    requireId(
      pointer.usageEpochId,
      "usageEpochId"
    );

  const deploymentConfigurationId =
    requireId(
      pointer.deploymentConfigurationId,
      "deploymentConfigurationId"
    );

  const platformReleaseId =
    requireId(
      pointer.platformReleaseId,
      "platformReleaseId"
    );

  const profileVariantId =
    requireId(
      pointer.profileVariantId,
      "profileVariantId"
    );

  const startedAt =
    requireCanonicalTimestamp(
      pointer.startedAt,
      "startedAt"
    );


  if (
    pointer.revision !==
      revision ||
    pointer.stage !==
      stage ||
    pointer.usageEpochId !==
      usageEpochId ||
    pointer
      .deploymentConfigurationId !==
      deploymentConfigurationId ||
    pointer.platformReleaseId !==
      platformReleaseId ||
    pointer.profileVariantId !==
      profileVariantId ||
    pointer.startedAt !==
      startedAt
  ) {
    throw new Error(
      "Active Usage Epoch pointer is not canonical."
    );
  }


  return true;
}


export function buildActiveUsageEpochPointer({
  currentPointer =
    null,

  epoch,
}: {
  currentPointer?:
    any |
    null;

  epoch:
    unknown;
}) {
  if (
    currentPointer
  ) {
    validateActiveUsageEpochPointer(
      currentPointer
    );
  }


  const normalizedEpoch =
    normalizeAndValidateUsageEpochDocument(
      epoch
    );


  if (
    normalizedEpoch.state !==
      USAGE_EPOCH_STATE.OPEN
  ) {
    throw new Error(
      "Active Usage Epoch pointer must reference an OPEN Usage Epoch."
    );
  }


  const pointer = {
    pk:
      USAGE_EPOCH_CONTROL_PK,

    sk:
      USAGE_EPOCH_ACTIVE_SK,

    schema:
      ACTIVE_USAGE_EPOCH_POINTER_DOCUMENT_SCHEMA,

    pointerSchemaVersion:
      CURRENT_ACTIVE_USAGE_EPOCH_POINTER_SCHEMA_VERSION,

    revision:
      currentPointer
        ? currentPointer.revision +
          1
        : 1,

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

    startedAt:
      normalizedEpoch
        .startedAt,
  };


  validateActiveUsageEpochPointer(
    pointer
  );


  return pointer;
}