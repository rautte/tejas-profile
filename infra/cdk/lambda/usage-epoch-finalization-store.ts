// infra/cdk/lambda/usage-epoch-finalization-store.ts

import {
  QueryCommand,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";

import {
  marshall,
  unmarshall,
} from "@aws-sdk/util-dynamodb";

import {
  USAGE_EPOCH_STATE,
  finalizeUsageEpochDocument,
  normalizeAndValidateUsageEpochDocument,
} from "./usage-epoch-contract";

import {
  USAGE_EPOCH_ITEM_SK,
  createUsageEpochPartitionKey,
  createUsageEpochStateIndexPk,
  createUsageEpochStorageRecord,
  readUsageEpochRecord,
} from "./usage-epoch-store";


export const USAGE_EPOCH_STATE_INDEX_NAME =
  "ByState";


const ID_RE =
  /^[A-Za-z0-9._:-]+$/;


type DynamoDbSender = {
  send:
    (
      command:
        any
    ) => Promise<any>;
};


export class UsageEpochFinalizationConflictError
  extends Error {
  readonly code =
    "USAGE_EPOCH_FINALIZATION_CONFLICT";


  constructor(
    message =
      "Usage Epoch finalization conflict."
  ) {
    super(
      message
    );

    this.name =
      "UsageEpochFinalizationConflictError";
  }
}


function cleanString(
  value:
    unknown
) {
  return String(
    value ?? ""
  ).trim();
}


function requireTableName(
  value:
    unknown
) {
  const normalized =
    cleanString(
      value
    );


  if (!normalized) {
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
    throw new Error(
      `${field} is invalid.`
    );
  }


  return normalized;
}


function requireCanonicalTimestamp(
  value:
    unknown,

  field:
    string
) {
  const normalized =
    cleanString(
      value
    );

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


function requireLimit(
  value:
    unknown
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
      1 ||
    normalized >
      100
  ) {
    throw new Error(
      "Usage Epoch finalization query limit must be between 1 and 100."
    );
  }


  return normalized;
}


function isConditionalConflict(
  error:
    any
) {
  return (
    error?.name ===
      "ConditionalCheckFailedException"
  );
}


/**
 * Discover CLOSING epochs whose endedAt is at or before the supplied
 * settlement cutoff.
 *
 * ByState is eventually consistent, so this function returns IDs only.
 * Every candidate is strongly re-read before report generation.
 */
export async function listSettledClosingUsageEpochIds({
  client,

  tableName,

  cutoffIso,

  limit =
    10,
}: {
  client:
    DynamoDbSender;

  tableName:
    string;

  cutoffIso:
    string;

  limit?:
    number;
}) {
  const table =
    requireTableName(
      tableName
    );

  const cutoff =
    requireCanonicalTimestamp(
      cutoffIso,
      "cutoffIso"
    );

  const normalizedLimit =
    requireLimit(
      limit
    );


  const out =
    await client.send(
      new QueryCommand({
        TableName:
          table,

        IndexName:
          USAGE_EPOCH_STATE_INDEX_NAME,

        KeyConditionExpression:
          "#gsi2pk = :statePk AND #gsi2sk <= :cutoff",

        ExpressionAttributeNames: {
          "#gsi2pk":
            "gsi2pk",

          "#gsi2sk":
            "gsi2sk",

          "#usageEpochId":
            "usageEpochId",
        },

        ExpressionAttributeValues:
          marshall({
            ":statePk":
              createUsageEpochStateIndexPk(
                USAGE_EPOCH_STATE
                  .CLOSING
              ),

            ":cutoff":
              `${cutoff}#\uffff`,
          }),

        ProjectionExpression:
          "#usageEpochId",

        ScanIndexForward:
          true,

        Limit:
          normalizedLimit,
      })
    );


  const ids:
    string[] =
      [];


  for (
    const raw of
      out.Items ||
      []
  ) {
    const item =
      unmarshall(
        raw
      );

    ids.push(
      requireId(
        item
          ?.usageEpochId,
        "usageEpochId"
      )
    );
  }


  return [
    ...new Set(
      ids
    ),
  ];
}


/**
 * Conditionally commits one CLOSING Usage Epoch to CLOSED.
 *
 * This is deliberately separate from P8C's control-plane transaction
 * implementation. Profile/Platform activation never waits for Analytics
 * report generation.
 *
 * UpdateItem changes only:
 *
 *   state
 *   report
 *   gsi2pk
 *   gsi2sk
 *
 * All immutable Usage Epoch identity/evidence remains untouched.
 */
export async function finalizeUsageEpochRecord({
  client,

  tableName,

  epoch:
    inputEpoch,

  reportId,

  reportSha256,

  finalizedAt,
}: {
  client:
    DynamoDbSender;

  tableName:
    string;

  epoch:
    unknown;

  reportId:
    string;

  reportSha256:
    string;

  finalizedAt:
    string;
}) {
  const table =
    requireTableName(
      tableName
    );

  const current =
    normalizeAndValidateUsageEpochDocument(
      inputEpoch
    );


  if (
    current.state !==
      USAGE_EPOCH_STATE
        .CLOSING
  ) {
    throw new Error(
      "Only a CLOSING Usage Epoch can be committed by the report finalizer."
    );
  }


  const closed =
    finalizeUsageEpochDocument({
      epoch:
        current,

      reportId,

      reportSha256,

      finalizedAt,
    });


  const currentStorage =
    createUsageEpochStorageRecord(
      current
    );

  const closedStorage =
    createUsageEpochStorageRecord(
      closed
    );


  try {
    await client.send(
      new UpdateItemCommand({
        TableName:
          table,

        Key:
          marshall({
            pk:
              createUsageEpochPartitionKey(
                current
                  .usageEpochId
              ),

            sk:
              USAGE_EPOCH_ITEM_SK,
          }),

        ConditionExpression:
          "#state = :expectedState AND " +
          "#usageEpochId = :expectedUsageEpochId AND " +
          "#deploymentConfigurationId = :expectedDeploymentConfigurationId AND " +
          "#platformReleaseId = :expectedPlatformReleaseId AND " +
          "#profileVariantId = :expectedProfileVariantId AND " +
          "#startedAt = :expectedStartedAt AND " +
          "#endedAt = :expectedEndedAt AND " +
          "#gsi2pk = :expectedGsi2pk AND " +
          "#gsi2sk = :expectedGsi2sk",

        UpdateExpression:
          "SET " +
          "#state = :closedState, " +
          "#report = :report, " +
          "#gsi2pk = :closedGsi2pk, " +
          "#gsi2sk = :closedGsi2sk",

        ExpressionAttributeNames: {
          "#state":
            "state",

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

          "#endedAt":
            "endedAt",

          "#report":
            "report",

          "#gsi2pk":
            "gsi2pk",

          "#gsi2sk":
            "gsi2sk",
        },

        ExpressionAttributeValues:
          marshall({
            ":expectedState":
              USAGE_EPOCH_STATE
                .CLOSING,

            ":expectedUsageEpochId":
              current
                .usageEpochId,

            ":expectedDeploymentConfigurationId":
              current
                .deploymentConfigurationId,

            ":expectedPlatformReleaseId":
              current
                .platformReleaseId,

            ":expectedProfileVariantId":
              current
                .profileVariantId,

            ":expectedStartedAt":
              current
                .startedAt,

            ":expectedEndedAt":
              current
                .endedAt,

            ":expectedGsi2pk":
              currentStorage
                .gsi2pk,

            ":expectedGsi2sk":
              currentStorage
                .gsi2sk,

            ":closedState":
              USAGE_EPOCH_STATE
                .CLOSED,

            ":report":
              closed.report,

            ":closedGsi2pk":
              closedStorage
                .gsi2pk,

            ":closedGsi2sk":
              closedStorage
                .gsi2sk,
          }),
      })
    );


    return {
      epoch:
        closed,

      alreadyFinalized:
        false,
    };
  } catch (
    error:
      any
  ) {
    if (
      !isConditionalConflict(
        error
      )
    ) {
      throw error;
    }
  }


  /**
   * Concurrent-finalizer convergence.
   *
   * A second worker may lose the conditional update after both workers
   * wrote/read the same deterministic immutable S3 report.
   *
   * Strongly re-read the epoch. Matching CLOSED evidence is success.
   */
  const latest =
    await readUsageEpochRecord({
      client,

      tableName:
        table,

      usageEpochId:
        current
          .usageEpochId,
    });


  if (
    latest.state ===
      USAGE_EPOCH_STATE
        .CLOSED &&
    latest.report
      ?.reportId ===
      closed.report
        ?.reportId &&
    latest.report
      ?.reportSha256 ===
      closed.report
        ?.reportSha256
  ) {
    return {
      epoch:
        latest,

      alreadyFinalized:
        true,
    };
  }


  throw new UsageEpochFinalizationConflictError(
    `Usage Epoch "${current.usageEpochId}" changed while its Configuration Analytics Report was being finalized.`
  );
}