import {
  GetItemCommand,
  type TransactWriteItem,
} from "@aws-sdk/client-dynamodb";

import {
  marshall,
  unmarshall,
} from "@aws-sdk/util-dynamodb";

import {
  normalizeAndValidateDeploymentConfigurationDocument,
} from "./deployment-configuration-contract";

import {
  USAGE_EPOCH_ACTIVE_SK,
  USAGE_EPOCH_CONTROL_PK,
  USAGE_EPOCH_STATE,
  USAGE_EPOCH_TRANSITION_KIND,
  buildActiveUsageEpochPointer,
  createClosingUsageEpochDocument,
  createOpenUsageEpochDocument,
  normalizeAndValidateUsageEpochDocument,
  validateActiveUsageEpochPointer,
  type UsageEpochTransitionKind,
} from "./usage-epoch-contract";


export const USAGE_EPOCH_ITEM_SK =
  "EPOCH";

export const USAGE_EPOCH_PK_PREFIX =
  "EPOCH#";

export const USAGE_EPOCH_CONFIGURATION_INDEX_PK_PREFIX =
  "CONFIG#";

export const USAGE_EPOCH_STATE_INDEX_PK_PREFIX =
  "STATE#";


export const USAGE_EPOCH_LIFECYCLE_MODE = {
  NO_COMPOSITION:
    "NO_COMPOSITION",

  OPEN:
    "OPEN",

  UNCHANGED:
    "UNCHANGED",

  ROTATE:
    "ROTATE",
} as const;


type UsageEpochLifecycleMode =
  typeof USAGE_EPOCH_LIFECYCLE_MODE[
    keyof typeof USAGE_EPOCH_LIFECYCLE_MODE
  ];


export type UsageEpochLifecyclePlan = {
  mode:
    UsageEpochLifecycleMode;

  currentPointer:
    any |
    null;

  currentEpoch:
    any |
    null;

  closingEpoch:
    any |
    null;

  openingEpoch:
    any |
    null;

  nextPointer:
    any |
    null;
};


type DynamoDbSender = {
  send:
    (
      command:
        any
    ) => Promise<any>;
};


const ID_RE =
  /^[A-Za-z0-9._:-]+$/;


function requireTableName(
  tableName:
    string
) {
  const normalized =
    String(
      tableName ||
      ""
    ).trim();


  if (
    !normalized
  ) {
    throw new Error(
      "Usage Epoch table name is required."
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
    String(
      value ??
        ""
    ).trim();


  if (
    !normalized ||
    normalized.length >
      160 ||
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


function requireStage(
  value:
    unknown
) {
  const stage =
    String(
      value ||
      ""
    ).trim();


  if (
    stage !==
      "dev" &&
    stage !==
      "prod"
  ) {
    throw new Error(
      'Usage Epoch stage must be "dev" or "prod".'
    );
  }


  return stage as
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
    String(
      value ||
      ""
    ).trim();

  const parsed =
    new Date(
      normalized
    );


  if (
    !normalized ||
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


function normalizeTransition({
  kind,
  occurrenceId,
}: {
  kind:
    UsageEpochTransitionKind;

  occurrenceId:
    string;
}) {
  if (
    kind !==
      USAGE_EPOCH_TRANSITION_KIND
        .PROFILE_ACTIVATION &&
    kind !==
      USAGE_EPOCH_TRANSITION_KIND
        .PLATFORM_DEPLOYMENT
  ) {
    throw new Error(
      "Usage Epoch transition kind is invalid."
    );
  }


  return {
    kind,

    occurrenceId:
      requireId(
        occurrenceId,
        "occurrenceId"
      ),
  };
}


export function createUsageEpochPartitionKey(
  usageEpochId:
    string
) {
  return (
    USAGE_EPOCH_PK_PREFIX +
    requireId(
      usageEpochId,
      "usageEpochId"
    )
  );
}


export function createUsageEpochConfigurationIndexPk(
  deploymentConfigurationId:
    string
) {
  return (
    USAGE_EPOCH_CONFIGURATION_INDEX_PK_PREFIX +
    requireId(
      deploymentConfigurationId,
      "deploymentConfigurationId"
    )
  );
}


export function createUsageEpochConfigurationIndexSk(
  startedAt:
    string,

  usageEpochId:
    string
) {
  return (
    "STARTED#" +
    requireCanonicalTimestamp(
      startedAt,
      "startedAt"
    ) +
    "#EPOCH#" +
    requireId(
      usageEpochId,
      "usageEpochId"
    )
  );
}


export function createUsageEpochStateIndexPk(
  state:
    string
) {
  if (
    state !==
      USAGE_EPOCH_STATE.OPEN &&
    state !==
      USAGE_EPOCH_STATE.CLOSING &&
    state !==
      USAGE_EPOCH_STATE.CLOSED
  ) {
    throw new Error(
      "Usage Epoch state is invalid."
    );
  }


  return (
    USAGE_EPOCH_STATE_INDEX_PK_PREFIX +
    state
  );
}


function usageEpochStateTimestamp(
  epoch:
    any
) {
  const normalized =
    normalizeAndValidateUsageEpochDocument(
      epoch
    );


  if (
    normalized.state ===
      USAGE_EPOCH_STATE.OPEN
  ) {
    return normalized.startedAt;
  }


  if (
    normalized.state ===
      USAGE_EPOCH_STATE.CLOSING
  ) {
    return normalized.endedAt!;
  }


  return normalized
    .report!
    .finalizedAt;
}


export function createUsageEpochStateIndexSk(
  epoch:
    unknown
) {
  const normalized =
    normalizeAndValidateUsageEpochDocument(
      epoch
    );


  return (
    usageEpochStateTimestamp(
      normalized
    ) +
    "#EPOCH#" +
    normalized.usageEpochId
  );
}


export function createUsageEpochStorageRecord(
  epoch:
    unknown
) {
  const normalized =
    normalizeAndValidateUsageEpochDocument(
      epoch
    );


  return {
    pk:
      createUsageEpochPartitionKey(
        normalized
          .usageEpochId
      ),

    sk:
      USAGE_EPOCH_ITEM_SK,

    gsi1pk:
      createUsageEpochConfigurationIndexPk(
        normalized
          .deploymentConfigurationId
      ),

    gsi1sk:
      createUsageEpochConfigurationIndexSk(
        normalized.startedAt,
        normalized.usageEpochId
      ),

    gsi2pk:
      createUsageEpochStateIndexPk(
        normalized.state
      ),

    gsi2sk:
      createUsageEpochStateIndexSk(
        normalized
      ),

    ...normalized,
  };
}


function normalizeUsageEpochStorageRecord(
  record:
    any
) {
  if (
    !record ||
    typeof record !==
      "object" ||
    Array.isArray(
      record
    )
  ) {
    throw new Error(
      "Usage Epoch storage record must be an object."
    );
  }


  const {
    pk,
    sk,
    gsi1pk,
    gsi1sk,
    gsi2pk,
    gsi2sk,
    ...document
  } =
    record;


  const epoch =
    normalizeAndValidateUsageEpochDocument(
      document
    );

  const expected =
    createUsageEpochStorageRecord(
      epoch
    );


  if (
    pk !== expected.pk ||
    sk !== expected.sk ||
    gsi1pk !== expected.gsi1pk ||
    gsi1sk !== expected.gsi1sk ||
    gsi2pk !== expected.gsi2pk ||
    gsi2sk !== expected.gsi2sk
  ) {
    throw new Error(
      "Usage Epoch storage indexes are invalid."
    );
  }


  return {
    epoch,

    record:
      expected,
  };
}


export function validateUsageEpochStorageRecord(
  record:
    any
) {
  normalizeUsageEpochStorageRecord(
    record
  );


  return true;
}


export async function readActiveUsageEpochPointer({
  client,
  tableName,
}: {
  client:
    DynamoDbSender;

  tableName:
    string;
}) {
  const table =
    requireTableName(
      tableName
    );


  const out =
    await client.send(
      new GetItemCommand({
        TableName:
          table,

        Key:
          marshall({
            pk:
              USAGE_EPOCH_CONTROL_PK,

            sk:
              USAGE_EPOCH_ACTIVE_SK,
          }),

        ConsistentRead:
          true,
      })
    );


  if (
    !out.Item
  ) {
    return null;
  }


  const pointer =
    unmarshall(
      out.Item
    );


  validateActiveUsageEpochPointer(
    pointer
  );


  return pointer;
}


export async function readUsageEpochRecord({
  client,
  tableName,
  usageEpochId,
}: {
  client:
    DynamoDbSender;

  tableName:
    string;

  usageEpochId:
    string;
}) {
  const table =
    requireTableName(
      tableName
    );

  const normalizedId =
    requireId(
      usageEpochId,
      "usageEpochId"
    );


  const out =
    await client.send(
      new GetItemCommand({
        TableName:
          table,

        Key:
          marshall({
            pk:
              createUsageEpochPartitionKey(
                normalizedId
              ),

            sk:
              USAGE_EPOCH_ITEM_SK,
          }),

        ConsistentRead:
          true,
      })
    );


  if (
    !out.Item
  ) {
    throw new Error(
      "Active Usage Epoch record does not exist."
    );
  }


  return normalizeUsageEpochStorageRecord(
    unmarshall(
      out.Item
    )
  ).epoch;
}


function assertPointerMatchesEpoch({
  pointer,
  epoch,
}: {
  pointer:
    any;

  epoch:
    any;
}) {
  validateActiveUsageEpochPointer(
    pointer
  );

  const normalized =
    normalizeAndValidateUsageEpochDocument(
      epoch
    );


  if (
    normalized.state !==
      USAGE_EPOCH_STATE.OPEN
  ) {
    throw new Error(
      "Active Usage Epoch pointer must reference an OPEN Usage Epoch."
    );
  }


  if (
    pointer.stage !==
      normalized.stage ||
    pointer.usageEpochId !==
      normalized.usageEpochId ||
    pointer
      .deploymentConfigurationId !==
      normalized
        .deploymentConfigurationId ||
    pointer.platformReleaseId !==
      normalized.platformReleaseId ||
    pointer.profileVariantId !==
      normalized.profileVariantId ||
    pointer.startedAt !==
      normalized.startedAt
  ) {
    throw new Error(
      "Active Usage Epoch pointer does not match its Usage Epoch record."
    );
  }
}


function exactPointerCondition(
  pointer:
    any
) {
  validateActiveUsageEpochPointer(
    pointer
  );


  return {
    ConditionExpression:
      "#revision = :expectedRevision AND " +
      "#usageEpochId = :expectedUsageEpochId AND " +
      "#deploymentConfigurationId = :expectedDeploymentConfigurationId AND " +
      "#platformReleaseId = :expectedPlatformReleaseId AND " +
      "#profileVariantId = :expectedProfileVariantId AND " +
      "#startedAt = :expectedStartedAt",

    ExpressionAttributeNames: {
      "#revision":
        "revision",

      "#usageEpochId":
        "usageEpochId",

      "#deploymentConfigurationId":
        "deploymentConfigurationId",

      "#platformReleaseId":
        "platformReleaseId",

      "#profileVariantId":
        "profileVariantId",

      "#startedAt":
        "startedAt",
    },

    ExpressionAttributeValues: {
      ":expectedRevision": {
        N:
          String(
            pointer.revision
          ),
      },

      ":expectedUsageEpochId": {
        S:
          pointer.usageEpochId,
      },

      ":expectedDeploymentConfigurationId": {
        S:
          pointer
            .deploymentConfigurationId,
      },

      ":expectedPlatformReleaseId": {
        S:
          pointer.platformReleaseId,
      },

      ":expectedProfileVariantId": {
        S:
          pointer.profileVariantId,
      },

      ":expectedStartedAt": {
        S:
          pointer.startedAt,
      },
    },
  };
}


export async function prepareUsageEpochLifecycle({
  client,
  tableName,
  stage,
  currentDeploymentConfigurationId =
    null,
  targetDeploymentConfiguration =
    null,
  transitionAt,
  transition,
}: {
  client:
    DynamoDbSender;

  tableName:
    string;

  stage:
    "dev" |
    "prod";

  currentDeploymentConfigurationId?:
    string |
    null;

  targetDeploymentConfiguration?:
    any |
    null;

  transitionAt:
    string;

  transition: {
    kind:
      UsageEpochTransitionKind;

    occurrenceId:
      string;
  };
}): Promise<UsageEpochLifecyclePlan> {
  requireTableName(
    tableName
  );

  const normalizedStage =
    requireStage(
      stage
    );

  const normalizedTransitionAt =
    requireCanonicalTimestamp(
      transitionAt,
      "transitionAt"
    );

  const normalizedTransition =
    normalizeTransition(
      transition
    );


  const currentConfigurationId =
    currentDeploymentConfigurationId ===
      null ||
    currentDeploymentConfigurationId ===
      undefined
      ? null
      : requireId(
          currentDeploymentConfigurationId,
          "currentDeploymentConfigurationId"
        );


  const targetConfiguration =
    targetDeploymentConfiguration ===
      null ||
    targetDeploymentConfiguration ===
      undefined
      ? null
      : normalizeAndValidateDeploymentConfigurationDocument(
          targetDeploymentConfiguration
        );


  if (
    targetConfiguration &&
    targetConfiguration.stage !==
      normalizedStage
  ) {
    throw new Error(
      "Target Deployment Configuration belongs to a different stage."
    );
  }


  const currentPointer =
    await readActiveUsageEpochPointer({
      client,

      tableName,
    });


  let currentEpoch:
    any |
    null =
      null;


  if (
    currentPointer
  ) {
    if (
      currentPointer.stage !==
        normalizedStage
    ) {
      throw new Error(
        "Active Usage Epoch pointer belongs to a different stage."
      );
    }


    if (
      !currentConfigurationId
    ) {
      throw new Error(
        "Active Usage Epoch exists without a current effective Deployment Configuration."
      );
    }


    if (
      currentPointer
        .deploymentConfigurationId !==
      currentConfigurationId
    ) {
      throw new Error(
        "Active Usage Epoch does not match the current effective Deployment Configuration."
      );
    }


    currentEpoch =
      await readUsageEpochRecord({
        client,

        tableName,

        usageEpochId:
          currentPointer
            .usageEpochId,
      });


    assertPointerMatchesEpoch({
      pointer:
        currentPointer,

      epoch:
        currentEpoch,
    });
  }


  /**
   * Current control-plane APIs never intentionally remove one side
   * of an effective composition.
   *
   * Therefore a transition to "no composition" is valid only when
   * there was no current composition and no Usage Epoch either.
   *
   * A future explicit deactivation feature can add CLOSE_ONLY
   * semantics rather than silently overloading this path.
   */
  if (
    !targetConfiguration
  ) {
    if (
      currentPointer ||
      currentConfigurationId
    ) {
      throw new Error(
        "Usage Epoch lifecycle cannot remove an effective Deployment Configuration."
      );
    }


    return {
      mode:
        USAGE_EPOCH_LIFECYCLE_MODE
          .NO_COMPOSITION,

      currentPointer:
        null,

      currentEpoch:
        null,

      closingEpoch:
        null,

      openingEpoch:
        null,

      nextPointer:
        null,
    };
  }


  /**
   * No Usage pointer exists yet.
   *
   * This is either:
   *
   * - the first complete Profile/Platform composition, or
   * - the forward-only P8 bootstrap boundary for a composition that
   *   pre-dated Usage Epoch tracking.
   *
   * We start at THIS control-plane occurrence. We do not manufacture
   * a historical start timestamp.
   *
   * P9 deliberately preserves pre-epoch history as legacy evidence
   * rather than fabricating historical Usage Epoch boundaries.
   */
  if (
    !currentPointer
  ) {
    const openingEpoch =
      createOpenUsageEpochDocument({
        startedAt:
          normalizedTransitionAt,

        deploymentConfiguration:
          targetConfiguration,

        openedBy:
          normalizedTransition,
      });


    const nextPointer =
      buildActiveUsageEpochPointer({
        epoch:
          openingEpoch,
      });


    return {
      mode:
        USAGE_EPOCH_LIFECYCLE_MODE
          .OPEN,

      currentPointer:
        null,

      currentEpoch:
        null,

      closingEpoch:
        null,

      openingEpoch,

      nextPointer,
    };
  }


  /**
   * The control-plane occurrence is real, but the effective immutable
   * Deployment Configuration did not change.
   *
   * Keep the existing epoch OPEN. Creating another epoch here would
   * falsely split one continuous usage interval.
   */
  if (
    currentPointer
      .deploymentConfigurationId ===
    targetConfiguration
      .deploymentConfigurationId
  ) {
    if (
      currentPointer
        .platformReleaseId !==
        targetConfiguration
          .platformReleaseId ||
      currentPointer
        .profileVariantId !==
        targetConfiguration
          .profileVariantId
    ) {
      throw new Error(
        "Usage Epoch Deployment Configuration evidence is inconsistent."
      );
    }


    return {
      mode:
        USAGE_EPOCH_LIFECYCLE_MODE
          .UNCHANGED,

      currentPointer,

      currentEpoch,

      closingEpoch:
        null,

      openingEpoch:
        null,

      nextPointer:
        currentPointer,
    };
  }


  const closingEpoch =
    createClosingUsageEpochDocument({
      epoch:
        currentEpoch,

      endedAt:
        normalizedTransitionAt,

      closedBy:
        normalizedTransition,
    });


  const openingEpoch =
    createOpenUsageEpochDocument({
      startedAt:
        normalizedTransitionAt,

      deploymentConfiguration:
        targetConfiguration,

      openedBy:
        normalizedTransition,
    });


  const nextPointer =
    buildActiveUsageEpochPointer({
      currentPointer,

      epoch:
        openingEpoch,
    });


  return {
    mode:
      USAGE_EPOCH_LIFECYCLE_MODE
        .ROTATE,

    currentPointer,

    currentEpoch,

    closingEpoch,

    openingEpoch,

    nextPointer,
  };
}


export function createUsageEpochTransactionItems({
  tableName,
  plan,
}: {
  tableName:
    string;

  plan:
    UsageEpochLifecyclePlan;
}): TransactWriteItem[] {
  const table =
    requireTableName(
      tableName
    );


  if (
    !plan ||
    typeof plan !==
      "object"
  ) {
    throw new Error(
      "Usage Epoch lifecycle plan is required."
    );
  }


  if (
    plan.mode ===
      USAGE_EPOCH_LIFECYCLE_MODE
        .NO_COMPOSITION
  ) {
    if (
      plan.currentPointer ||
      plan.currentEpoch ||
      plan.closingEpoch ||
      plan.openingEpoch ||
      plan.nextPointer
    ) {
      throw new Error(
        "NO_COMPOSITION Usage Epoch plan is invalid."
      );
    }


    return [
      {
        ConditionCheck: {
          TableName:
            table,

          Key:
            marshall({
              pk:
                USAGE_EPOCH_CONTROL_PK,

              sk:
                USAGE_EPOCH_ACTIVE_SK,
            }),

          ConditionExpression:
            "attribute_not_exists(#pk) AND attribute_not_exists(#sk)",

          ExpressionAttributeNames: {
            "#pk":
              "pk",

            "#sk":
              "sk",
          },
        },
      },
    ];
  }


  if (
    plan.mode ===
      USAGE_EPOCH_LIFECYCLE_MODE
        .OPEN
  ) {
    if (
      plan.currentPointer ||
      plan.currentEpoch ||
      plan.closingEpoch ||
      !plan.openingEpoch ||
      !plan.nextPointer
    ) {
      throw new Error(
        "OPEN Usage Epoch plan is invalid."
      );
    }


    const openingEpoch =
      normalizeAndValidateUsageEpochDocument(
        plan.openingEpoch
      );

    validateActiveUsageEpochPointer(
      plan.nextPointer
    );


    if (
      openingEpoch.state !==
        USAGE_EPOCH_STATE.OPEN ||
      plan.nextPointer.revision !==
        1
    ) {
      throw new Error(
        "OPEN Usage Epoch plan has invalid initial state."
      );
    }


    assertPointerMatchesEpoch({
      pointer:
        plan.nextPointer,

      epoch:
        openingEpoch,
    });


    return [
      {
        Put: {
          TableName:
            table,

          Item:
            marshall(
              createUsageEpochStorageRecord(
                openingEpoch
              )
            ),

          ConditionExpression:
            "attribute_not_exists(#pk) AND attribute_not_exists(#sk)",

          ExpressionAttributeNames: {
            "#pk":
              "pk",

            "#sk":
              "sk",
          },
        },
      },

      {
        Put: {
          TableName:
            table,

          Item:
            marshall(
              plan.nextPointer
            ),

          ConditionExpression:
            "attribute_not_exists(#pk) AND attribute_not_exists(#sk)",

          ExpressionAttributeNames: {
            "#pk":
              "pk",

            "#sk":
              "sk",
          },
        },
      },
    ];
  }


  if (
    plan.mode ===
      USAGE_EPOCH_LIFECYCLE_MODE
        .UNCHANGED
  ) {
    if (
      !plan.currentPointer ||
      !plan.currentEpoch ||
      plan.closingEpoch ||
      plan.openingEpoch
    ) {
      throw new Error(
        "UNCHANGED Usage Epoch plan is invalid."
      );
    }


    assertPointerMatchesEpoch({
      pointer:
        plan.currentPointer,

      epoch:
        plan.currentEpoch,
    });


    return [
      {
        ConditionCheck: {
          TableName:
            table,

          Key:
            marshall({
              pk:
                USAGE_EPOCH_CONTROL_PK,

              sk:
                USAGE_EPOCH_ACTIVE_SK,
            }),

          ...exactPointerCondition(
            plan.currentPointer
          ),
        },
      },
    ];
  }


  if (
    plan.mode ===
      USAGE_EPOCH_LIFECYCLE_MODE
        .ROTATE
  ) {
    if (
      !plan.currentPointer ||
      !plan.currentEpoch ||
      !plan.closingEpoch ||
      !plan.openingEpoch ||
      !plan.nextPointer
    ) {
      throw new Error(
        "ROTATE Usage Epoch plan is invalid."
      );
    }


    assertPointerMatchesEpoch({
      pointer:
        plan.currentPointer,

      epoch:
        plan.currentEpoch,
    });


    const closingEpoch =
      normalizeAndValidateUsageEpochDocument(
        plan.closingEpoch
      );

    const openingEpoch =
      normalizeAndValidateUsageEpochDocument(
        plan.openingEpoch
      );


    if (
      closingEpoch.state !==
        USAGE_EPOCH_STATE.CLOSING ||
      openingEpoch.state !==
        USAGE_EPOCH_STATE.OPEN ||
      closingEpoch.usageEpochId !==
        plan.currentPointer
          .usageEpochId ||
      closingEpoch
        .deploymentConfigurationId !==
        plan.currentPointer
          .deploymentConfigurationId
    ) {
      throw new Error(
        "ROTATE Usage Epoch documents are inconsistent with current state."
      );
    }


    validateActiveUsageEpochPointer(
      plan.nextPointer
    );


    if (
      plan.nextPointer.revision !==
        plan.currentPointer.revision +
          1
    ) {
      throw new Error(
        "ROTATE Usage Epoch pointer revision is invalid."
      );
    }


    assertPointerMatchesEpoch({
      pointer:
        plan.nextPointer,

      epoch:
        openingEpoch,
    });


    const pointerCondition =
      exactPointerCondition(
        plan.currentPointer
      );


    return [
      {
        Put: {
          TableName:
            table,

          Item:
            marshall(
              createUsageEpochStorageRecord(
                closingEpoch
              )
            ),

          ConditionExpression:
            "#state = :expectedState AND " +
            "#usageEpochId = :expectedUsageEpochId AND " +
            "#deploymentConfigurationId = :expectedDeploymentConfigurationId",

          ExpressionAttributeNames: {
            "#state":
              "state",

            "#usageEpochId":
              "usageEpochId",

            "#deploymentConfigurationId":
              "deploymentConfigurationId",
          },

          ExpressionAttributeValues: {
            ":expectedState": {
              S:
                USAGE_EPOCH_STATE.OPEN,
            },

            ":expectedUsageEpochId": {
              S:
                plan.currentPointer
                  .usageEpochId,
            },

            ":expectedDeploymentConfigurationId": {
              S:
                plan.currentPointer
                  .deploymentConfigurationId,
            },
          },
        },
      },

      {
        Put: {
          TableName:
            table,

          Item:
            marshall(
              createUsageEpochStorageRecord(
                openingEpoch
              )
            ),

          ConditionExpression:
            "attribute_not_exists(#pk) AND attribute_not_exists(#sk)",

          ExpressionAttributeNames: {
            "#pk":
              "pk",

            "#sk":
              "sk",
          },
        },
      },

      {
        Put: {
          TableName:
            table,

          Item:
            marshall(
              plan.nextPointer
            ),

          ...pointerCondition,
        },
      },
    ];
  }


  throw new Error(
    "Usage Epoch lifecycle mode is unsupported."
  );
}