// infra/cdk/lambda/profile-activation-store.ts

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
  PROFILE_ACTIVATION_ACTIVE_SK,
  PROFILE_ACTIVATION_CONTROL_PK,
  validateActiveProfilePointer,
  validateProfileActivationRecord,
} from "./profile-activation-contract";

import {
  PLATFORM_DEPLOYMENT_ACTIVE_SK,
  PLATFORM_DEPLOYMENT_CONTROL_PK,
  validateActivePlatformReleasePointer,
} from "./platform-deployment-contract";

import {
  createUsageEpochTransactionItems,
} from "./usage-epoch-store";


type DynamoDbSender = {
  send:
    (
      command: any
    ) => Promise<any>;
};


function requireTableName(
  tableName: string
) {
  const normalized =
    String(
      tableName || ""
    ).trim();


  if (!normalized) {
    throw new Error(
      "Profile Activation table name is required."
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


function createPlatformPointerConditionCheck({
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
      "Platform Deployment table name"
    );


  const key =
    marshall({
      pk:
        PLATFORM_DEPLOYMENT_CONTROL_PK,

      sk:
        PLATFORM_DEPLOYMENT_ACTIVE_SK,
    });


  /**
   * If Platform state was absent when composition safety was checked,
   * it must still be absent when Profile activation commits.
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


  validateActivePlatformReleasePointer(
    pointer
  );


  /**
   * Exact opposite control-plane snapshot.
   *
   * Revision is the optimistic-concurrency token.
   * Deployment/release identity protects against corrupted or stale
   * state accidentally satisfying only a numeric revision.
   */
  return {
    TableName:
      table,

    Key:
      key,

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
            pointer.revision
          ),
      },

      ":expectedDeploymentId": {
        S:
          String(
            pointer.deploymentId
          ),
      },

      ":expectedPlatformReleaseId": {
        S:
          String(
            pointer.platformReleaseId
          ),
      },
    },
  };
}


export async function readActiveProfilePointer({
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
              PROFILE_ACTIVATION_CONTROL_PK,

            sk:
              PROFILE_ACTIVATION_ACTIVE_SK,
          }),

        /**
         * Activation is control-plane state.
         *
         * We must not make a transition from a stale eventually
         * consistent pointer.
         */
        ConsistentRead:
          true,
      })
    );


  if (!out.Item) {
    return null;
  }


  const pointer =
    unmarshall(
      out.Item
    );


  validateActiveProfilePointer(
    pointer
  );


  return pointer;
}


export function createProfileActivationTransaction({
  tableName,
  transition,
  platformGuard =
    null,
  usageEpochLifecycle =
    null,
}: {
  tableName:
    string;

  transition:
    any;

  /**
   * Optional until P5F2 wires composition-safe activation.
   *
   * When supplied, the exact Platform CONTROL / ACTIVE state observed
   * during Deployment Configuration verification is condition-checked
   * inside this same DynamoDB transaction.
   */
  platformGuard?: {
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


  validateActiveProfilePointer(
    transition?.pointer
  );

  validateProfileActivationRecord(
    transition?.ledger
  );


  const expectedPreviousRevision =
    transition
      .expectedPreviousRevision;


  const ledgerPut = {
    TableName:
      table,

    Item:
      marshall(
        transition.ledger
      ),

    /**
     * Ledger records are append-only.
     *
     * An existing item at this exact key can never be replaced.
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
    /**
     * First activation.
     *
     * The ACTIVE pointer must still be absent when the
     * transaction commits.
     */
    pointerPut = {
      TableName:
        table,

      Item:
        marshall(
          transition.pointer
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
    const previousActivationId =
      transition
        ?.ledger
        ?.previousActivationId;

    const previousProfileVariantId =
      transition
        ?.ledger
        ?.previousProfileVariantId;


    if (
      typeof expectedPreviousRevision !==
        "number" ||
      !Number.isInteger(
        expectedPreviousRevision
      ) ||
      expectedPreviousRevision <=
        0 ||
      !previousActivationId ||
      !previousProfileVariantId
    ) {
      throw new Error(
        "Profile Activation transition has invalid previous state."
      );
    }


    /**
     * Existing activation.
     *
     * Revision is the optimistic-concurrency token.
     * Previous identity is checked as additional corruption/
     * stale-state protection.
     */
    pointerPut = {
      TableName:
        table,

      Item:
        marshall(
          transition.pointer
        ),

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
              expectedPreviousRevision
            ),
        },

        ":expectedActivationId": {
          S:
            String(
              previousActivationId
            ),
        },

        ":expectedProfileVariantId": {
          S:
            String(
              previousProfileVariantId
            ),
        },
      },
    };
  }

  const platformConditionCheck =
    platformGuard
      ? createPlatformPointerConditionCheck({
          tableName:
            platformGuard
              .tableName,

          pointer:
            platformGuard
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
    platformConditionCheck
  ) {
    transactItems.push({
      ConditionCheck:
        platformConditionCheck,
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


export async function commitProfileActivationTransition({
  client,
  tableName,
  transition,
  platformGuard =
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

  platformGuard?: {
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
    createProfileActivationTransaction({
      tableName,
      transition,
      platformGuard,
      usageEpochLifecycle,
    });


  return client.send(
    new TransactWriteItemsCommand(
      input
    )
  );
}


export function isProfileActivationConflict(
  error: any
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