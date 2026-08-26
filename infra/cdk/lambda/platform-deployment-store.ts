// infra/cdk/lambda/platform-deployment-store.ts

import {
  GetItemCommand,
  TransactWriteItemsCommand,
  type ConditionCheck,
  type TransactWriteItemsCommandInput,
} from "@aws-sdk/client-dynamodb";

import {
  marshall,
  unmarshall,
} from "@aws-sdk/util-dynamodb";

import {
  PLATFORM_DEPLOYMENT_ACTIVE_SK,
  PLATFORM_DEPLOYMENT_CONTROL_PK,
  validateActivePlatformReleasePointer,
  validatePlatformDeploymentRecord,
} from "./platform-deployment-contract";

import {
  createUsageEpochTransactionItems,
} from "./usage-epoch-store";

import {
  PROFILE_ACTIVATION_ACTIVE_SK,
  PROFILE_ACTIVATION_CONTROL_PK,
  validateActiveProfilePointer,
} from "./profile-activation-contract";


type DynamoDbSender = {
  send:
    (
      command:
        any
    ) => Promise<any>;
};


function requireTableName(
  tableName:
    string
) {
  const normalized =
    String(
      tableName ||
      ""
    ).trim();


  if (!normalized) {
    throw new Error(
      "Platform Deployment table name is required."
    );
  }


  return normalized;
}


function requireCrossTableName(
  tableName:
    string,

  label:
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
      `${label} is required.`
    );
  }


  return normalized;
}


function createProfilePointerConditionCheck({
  tableName,
  pointer,
}: {
  tableName:
    string;

  pointer:
    any |
    null;
}): ConditionCheck {
  const table =
    requireCrossTableName(
      tableName,
      "Profile Activation table name"
    );


  const key =
    marshall({
      pk:
        PROFILE_ACTIVATION_CONTROL_PK,

      sk:
        PROFILE_ACTIVATION_ACTIVE_SK,
    });


  /**
   * If Profile state was absent when composition safety was checked,
   * it must still be absent when Platform deployment commits.
   */
  if (
    pointer ===
      null
  ) {
    return {
      TableName:
        table,

      Key:
        key,

      ConditionExpression:
        "attribute_not_exists(#pk) AND attribute_not_exists(#sk)",

      ExpressionAttributeNames: {
        "#pk":
          "pk",

        "#sk":
          "sk",
      },
    };
  }


  validateActiveProfilePointer(
    pointer
  );


  return {
    TableName:
      table,

    Key:
      key,

    ConditionExpression:
      "#revision = :expectedRevision AND " +
      "#activationId = :expectedActivationId AND " +
      "#profileVariantId = :expectedProfileVariantId",

    ExpressionAttributeNames: {
      "#revision":
        "revision",

      "#activationId":
        "activationId",

      "#profileVariantId":
        "profileVariantId",
    },

    ExpressionAttributeValues: {
      ":expectedRevision": {
        N:
          String(
            pointer.revision
          ),
      },

      ":expectedActivationId": {
        S:
          String(
            pointer.activationId
          ),
      },

      ":expectedProfileVariantId": {
        S:
          String(
            pointer.profileVariantId
          ),
      },
    },
  };
}


export async function readActivePlatformReleasePointer({
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
              PLATFORM_DEPLOYMENT_CONTROL_PK,

            sk:
              PLATFORM_DEPLOYMENT_ACTIVE_SK,
          }),

        /**
         * Active Platform state is control-plane truth.
         *
         * Runtime/deployment decisions must never use a stale
         * eventually-consistent pointer.
         */
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


  validateActivePlatformReleasePointer(
    pointer
  );


  return pointer;
}


export function createPlatformDeploymentTransaction({
  tableName,
  transition,
  profileGuard =
    null,
  usageEpochLifecycle =
    null,
}: {
  tableName:
    string;

  transition:
    any;

  /**
   * Optional until P5F2 wires composition-safe deployment.
   *
   * When supplied, the exact Profile CONTROL / ACTIVE state observed
   * during Deployment Configuration verification is condition-checked
   * in the same transaction as the Platform transition.
   */
  profileGuard?: {
    tableName:
      string;

    pointer:
      any |
      null;
  } |
  null;

  usageEpochLifecycle?: {
    tableName:
      string;

    plan:
      any;
  } |
  null;

}): TransactWriteItemsCommandInput {
  const table =
    requireTableName(
      tableName
    );


  validateActivePlatformReleasePointer(
    transition
      ?.pointer
  );

  validatePlatformDeploymentRecord(
    transition
      ?.ledger
  );


  const expectedPreviousRevision =
    transition
      .expectedPreviousRevision;


  const ledgerPut = {
    TableName:
      table,

    Item:
      marshall(
        transition
          .ledger
      ),

    /**
     * Platform deployment history is append-only.
     */
    ConditionExpression:
      "attribute_not_exists(#pk) AND attribute_not_exists(#sk)",

    ExpressionAttributeNames: {
      "#pk":
        "pk",

      "#sk":
        "sk",
    },
  };


  let pointerPut:
    any;


  if (
    expectedPreviousRevision ===
      null
  ) {
    pointerPut = {
      TableName:
        table,

      Item:
        marshall(
          transition
            .pointer
        ),

      ConditionExpression:
        "attribute_not_exists(#pk) AND attribute_not_exists(#sk)",

      ExpressionAttributeNames: {
        "#pk":
          "pk",

        "#sk":
          "sk",
      },
    };
  } else {
    const previousDeploymentId =
      transition
        ?.ledger
        ?.previousDeploymentId;

    const previousPlatformReleaseId =
      transition
        ?.ledger
        ?.previousPlatformReleaseId;


    if (
      typeof expectedPreviousRevision !==
        "number" ||
      !Number.isInteger(
        expectedPreviousRevision
      ) ||
      expectedPreviousRevision <=
        0 ||
      !previousDeploymentId ||
      !previousPlatformReleaseId
    ) {
      throw new Error(
        "Platform Deployment transition has invalid previous state."
      );
    }


    pointerPut = {
      TableName:
        table,

      Item:
        marshall(
          transition
            .pointer
        ),

      ConditionExpression:
        "#revision = :expectedRevision AND " +
        "#deploymentId = :expectedDeploymentId AND " +
        "#platformReleaseId = :expectedPlatformReleaseId",

      ExpressionAttributeNames: {
        "#revision":
          "revision",

        "#deploymentId":
          "deploymentId",

        "#platformReleaseId":
          "platformReleaseId",
      },

      ExpressionAttributeValues: {
        ":expectedRevision": {
          N:
            String(
              expectedPreviousRevision
            ),
        },

        ":expectedDeploymentId": {
          S:
            String(
              previousDeploymentId
            ),
        },

        ":expectedPlatformReleaseId": {
          S:
            String(
              previousPlatformReleaseId
            ),
        },
      },
    };
  }

  const profileConditionCheck =
    profileGuard
      ? createProfilePointerConditionCheck({
          tableName:
            profileGuard
              .tableName,

          pointer:
            profileGuard
              .pointer,
        })
      : null;


  const transactItems:
    NonNullable<
      TransactWriteItemsCommandInput[
        "TransactItems"
      ]
    > = [];


  if (
    profileConditionCheck
  ) {
    transactItems.push({
      ConditionCheck:
        profileConditionCheck,
    });
  }


  transactItems.push(
    {
      Put:
        ledgerPut,
    },

    {
      Put:
        pointerPut,
    }
  );

  if (
    usageEpochLifecycle
  ) {
    transactItems.push(
      ...createUsageEpochTransactionItems({
        tableName:
          usageEpochLifecycle
            .tableName,

        plan:
          usageEpochLifecycle
            .plan,
      })
    );
  }


  return {
    TransactItems:
      transactItems,
  };
}


export async function commitPlatformDeploymentTransition({
  client,
  tableName,
  transition,
  profileGuard =
    null,
  usageEpochLifecycle =
    null,
}: {
  client:
    DynamoDbSender;

  tableName:
    string;

  transition:
    any;

  profileGuard?: {
    tableName:
      string;

    pointer:
      any |
      null;
  } |
  null;

  usageEpochLifecycle?: {
    tableName:
      string;

    plan:
      any;
  } |
  null;
}) {
  const input =
    createPlatformDeploymentTransaction({
      tableName,
      transition,
      profileGuard,
      usageEpochLifecycle,
    });


  return client.send(
    new TransactWriteItemsCommand(
      input
    )
  );
}


export function isPlatformDeploymentConflict(
  error:
    any
) {
  const name =
    String(
      error?.name ||
      ""
    );


  return (
    name ===
      "TransactionCanceledException" ||
    name ===
      "TransactionConflictException" ||
    name ===
      "ConditionalCheckFailedException"
  );
}