#!/usr/bin/env node

import {
  execFileSync,
} from "node:child_process";

import {
  BatchWriteItemCommand,
  DynamoDBClient,
  ScanCommand,
} from "@aws-sdk/client-dynamodb";

import {
  DeleteObjectsCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";


const RAW_PREFIX =
  "analytics-events/";

const DYNAMO_BATCH_SIZE =
  25;

const S3_DELETE_BATCH_SIZE =
  1000;

const MAX_DYNAMO_RETRIES =
  8;

const STACKS = {
  dev:
    "TejasProfileSnapshotsStackDev",

  prod:
    "TejasProfileSnapshotsStackProd",
};


function usage() {
  console.log(`
Usage:

  Dry run:
    npm run analytics:purge -- --stage dev --dry-run

  DEV hard purge:
    npm run analytics:purge -- \\
      --stage dev \\
      --confirm DELETE-DEV-ANALYTICS

  PROD hard purge:
    npm run analytics:purge -- \\
      --stage prod \\
      --confirm DELETE-PROD-ANALYTICS

Optional:
  --profile <aws-profile>
  --region <aws-region>

Examples:
  npm run analytics:purge -- \\
    --stage dev \\
    --dry-run \\
    --profile tejas-sso

  npm run analytics:purge -- \\
    --stage dev \\
    --confirm DELETE-DEV-ANALYTICS \\
    --profile tejas-sso
`);
}


function parseArgs(argv) {
  const options = {
    stage: "",
    confirm: "",
    dryRun: false,
    profile: "",
    region:
      process.env.AWS_REGION ||
      process.env.AWS_DEFAULT_REGION ||
      "us-east-1",
  };

  function valueAfter(
    index,
    flag
  ) {
    const value =
      argv[index + 1];

    if (
      !value ||
      value.startsWith("--")
    ) {
      throw new Error(
        `${flag} requires a value.`
      );
    }

    return value;
  }

  for (
    let i = 0;
    i < argv.length;
    i += 1
  ) {
    const arg =
      argv[i];

    switch (arg) {
      case "--stage":
        options.stage =
          valueAfter(
            i,
            arg
          );

        i += 1;
        break;

      case "--confirm":
        options.confirm =
          valueAfter(
            i,
            arg
          );

        i += 1;
        break;

      case "--profile":
        options.profile =
          valueAfter(
            i,
            arg
          );

        i += 1;
        break;

      case "--region":
        options.region =
          valueAfter(
            i,
            arg
          );

        i += 1;
        break;

      case "--dry-run":
        options.dryRun =
          true;
        break;

      case "--help":
      case "-h":
        usage();
        process.exit(0);
        break;

      default:
        throw new Error(
          `Unknown argument: ${arg}`
        );
    }
  }

  if (
    options.stage !== "dev" &&
    options.stage !== "prod"
  ) {
    throw new Error(
      "--stage must be exactly 'dev' or 'prod'."
    );
  }

  return options;
}


function chunk(
  values,
  size
) {
  const chunks = [];

  for (
    let i = 0;
    i < values.length;
    i += size
  ) {
    chunks.push(
      values.slice(
        i,
        i + size
      )
    );
  }

  return chunks;
}


function sleep(ms) {
  return new Promise(
    (resolve) =>
      setTimeout(
        resolve,
        ms
      )
  );
}


function cleanCliValue(
  value
) {
  const clean =
    String(
      value || ""
    ).trim();

  if (
    !clean ||
    clean === "None" ||
    clean === "null"
  ) {
    return "";
  }

  return clean;
}


async function main() {
  const options =
    parseArgs(
      process.argv.slice(2)
    );

  const {
    stage,
    dryRun,
    region,
  } = options;

  const profile =
    options.profile ||
    process.env.AWS_PROFILE ||
    "";

  const stackName =
    STACKS[stage];

  const requiredConfirmation =
    `DELETE-${stage.toUpperCase()}-ANALYTICS`;

  // Never default into destructive mode.
  if (
    !dryRun &&
    options.confirm !==
      requiredConfirmation
  ) {
    throw new Error(
      [
        "Hard purge confirmation did not match.",
        "",
        `Required: ${requiredConfirmation}`,
        "",
        "Nothing was deleted.",
      ].join("\n")
    );
  }

  if (profile) {
    process.env.AWS_PROFILE =
      profile;
  }

  process.env.AWS_REGION =
    region;

  process.env.AWS_DEFAULT_REGION =
    region;

  process.env.AWS_SDK_LOAD_CONFIG =
    "1";

  function awsCli(
    args
  ) {
    const commandArgs = [
      ...args,
      "--region",
      region,
    ];

    if (profile) {
      commandArgs.push(
        "--profile",
        profile
      );
    }

    return execFileSync(
      "aws",
      commandArgs,
      {
        encoding: "utf8",
        stdio: [
          "ignore",
          "pipe",
          "pipe",
        ],
      }
    ).trim();
  }

  // -----------------------------
  // Resolve the exact Analytics
  // Lambda belonging to this stack.
  // -----------------------------

  const analyticsFunctionName =
    cleanCliValue(
      awsCli([
        "cloudformation",
        "list-stack-resources",

        "--stack-name",
        stackName,

        "--query",
        "StackResourceSummaries[?ResourceType=='AWS::Lambda::Function' && contains(LogicalResourceId, 'AnalyticsApiHandler')].PhysicalResourceId | [0]",

        "--output",
        "text",
      ])
    );

  if (
    !analyticsFunctionName
  ) {
    throw new Error(
      `Could not resolve AnalyticsApiHandler from ${stackName}.`
    );
  }

  const lambdaConfig =
    JSON.parse(
      awsCli([
        "lambda",
        "get-function-configuration",

        "--function-name",
        analyticsFunctionName,

        "--output",
        "json",
      ])
    );

  const lambdaEnv =
    lambdaConfig
      ?.Environment
      ?.Variables ||
    {};

  const tableName =
    cleanCliValue(
      lambdaEnv
        .ANALYTICS_TABLE
    );

  const bucketName =
    cleanCliValue(
      lambdaEnv
        .ANALYTICS_EVENTS_BUCKET
    );

  const lambdaStage =
    cleanCliValue(
      lambdaEnv.STAGE
    );

  // Strong cross-stage safety check.
  if (
    lambdaStage !== stage
  ) {
    throw new Error(
      [
        "Stage safety check failed.",
        `Requested stage: ${stage}`,
        `Lambda stage: ${lambdaStage || "(missing)"}`,
        "Nothing was deleted.",
      ].join("\n")
    );
  }

  if (
    !tableName ||
    !bucketName
  ) {
    throw new Error(
      "Analytics Lambda is missing ANALYTICS_TABLE or ANALYTICS_EVENTS_BUCKET."
    );
  }

  const accountId =
    cleanCliValue(
      awsCli([
        "sts",
        "get-caller-identity",

        "--query",
        "Account",

        "--output",
        "text",
      ])
    );

  console.log("");
  console.log(
    "Analytics purge target"
  );

  console.log(
    "----------------------"
  );

  console.log(
    `Mode:    ${
      dryRun
        ? "DRY RUN"
        : "HARD DELETE"
    }`
  );

  console.log(
    `Stage:   ${stage}`
  );

  console.log(
    `Stack:   ${stackName}`
  );

  console.log(
    `Account: ${accountId}`
  );

  console.log(
    `Region:  ${region}`
  );

  console.log(
    `Profile: ${profile || "(default credential chain)"}`
  );

  console.log(
    `Lambda:  ${analyticsFunctionName}`
  );

  console.log(
    `Table:   ${tableName}`
  );

  console.log(
    `Bucket:  ${bucketName}`
  );

  console.log(
    `Prefix:  ${RAW_PREFIX}`
  );

  console.log("");

  if (
    stage === "prod"
  ) {
    console.log(
      "!!! PROD ANALYTICS TARGET !!!"
    );

    console.log("");
  }

  const ddb =
    new DynamoDBClient({
      region,
    });

  const s3 =
    new S3Client({
      region,
    });

  // -----------------------------
  // Dynamo helpers
  // -----------------------------

  async function scanAnalyticsKeys() {
    const keys = [];

    let exclusiveStartKey;

    do {
      const result =
        await ddb.send(
          new ScanCommand({
            TableName:
              tableName,

            ProjectionExpression:
              "#pk, #sk",

            ExpressionAttributeNames: {
              "#pk":
                "pk",

              "#sk":
                "sk",
            },

            ConsistentRead:
              true,

            ExclusiveStartKey:
              exclusiveStartKey,
          })
        );

      for (
        const item of
          result.Items || []
      ) {
        if (
          item.pk &&
          item.sk
        ) {
          keys.push({
            pk:
              item.pk,

            sk:
              item.sk,
          });
        }
      }

      exclusiveStartKey =
        result.LastEvaluatedKey;
    } while (
      exclusiveStartKey
    );

    return keys;
  }


  async function deleteDynamoKeys(
    keys
  ) {
    let deleted = 0;

    for (
      const keyBatch of
        chunk(
          keys,
          DYNAMO_BATCH_SIZE
        )
    ) {
      let pending =
        keyBatch.map(
          (key) => ({
            DeleteRequest: {
              Key: key,
            },
          })
        );

      for (
        let attempt = 0;
        pending.length > 0 &&
        attempt <
          MAX_DYNAMO_RETRIES;
        attempt += 1
      ) {
        const result =
          await ddb.send(
            new BatchWriteItemCommand({
              RequestItems: {
                [tableName]:
                  pending,
              },
            })
          );

        pending =
          result
            .UnprocessedItems
            ?.[tableName] ||
          [];

        if (
          pending.length > 0
        ) {
          await sleep(
            50 *
              Math.pow(
                2,
                attempt
              )
          );
        }
      }

      if (
        pending.length > 0
      ) {
        throw new Error(
          `DynamoDB still has ${pending.length} unprocessed deletes after retries.`
        );
      }

      deleted +=
        keyBatch.length;

      console.log(
        `Dynamo deleted: ${deleted}/${keys.length}`
      );
    }

    return deleted;
  }


  // -----------------------------
  // S3 helpers
  // -----------------------------

  async function listRawKeys() {
    const keys = [];

    let continuationToken;

    do {
      const result =
        await s3.send(
          new ListObjectsV2Command({
            Bucket:
              bucketName,

            Prefix:
              RAW_PREFIX,

            ContinuationToken:
              continuationToken,
          })
        );

      for (
        const object of
          result.Contents || []
      ) {
        if (
          object.Key
        ) {
          keys.push(
            object.Key
          );
        }
      }

      continuationToken =
        result.IsTruncated
          ? result
              .NextContinuationToken
          : undefined;
    } while (
      continuationToken
    );

    return keys;
  }


  async function deleteRawKeys(
    keys
  ) {
    let deleted = 0;

    for (
      const keyBatch of
        chunk(
          keys,
          S3_DELETE_BATCH_SIZE
        )
    ) {
      const result =
        await s3.send(
          new DeleteObjectsCommand({
            Bucket:
              bucketName,

            Delete: {
              Quiet:
                true,

              Objects:
                keyBatch.map(
                  (Key) => ({
                    Key,
                  })
                ),
            },
          })
        );

      const errors =
        result.Errors ||
        [];

      if (
        errors.length > 0
      ) {
        throw new Error(
          [
            `S3 reported ${errors.length} deletion errors.`,
            JSON.stringify(
              errors,
              null,
              2
            ),
          ].join("\n")
        );
      }

      deleted +=
        keyBatch.length;

      console.log(
        `S3 deleted: ${deleted}/${keys.length}`
      );
    }

    return deleted;
  }


  // -----------------------------
  // Discovery / dry run
  // -----------------------------

  console.log(
    "Scanning analytics data..."
  );

  const dynamoKeys =
    await scanAnalyticsKeys();

  const rawKeys =
    await listRawKeys();

  console.log("");
  console.log(
    "Matched analytics data"
  );

  console.log(
    "----------------------"
  );

  console.log(
    `Dynamo rows:    ${dynamoKeys.length}`
  );

  console.log(
    `Raw S3 objects: ${rawKeys.length}`
  );

  console.log("");

  if (dryRun) {
    console.log(
      "DRY RUN COMPLETE"
    );

    console.log(
      "No data was deleted."
    );

    return;
  }


  // -----------------------------
  // Destructive operation
  // -----------------------------

  console.log(
    "Starting hard purge..."
  );

  console.log("");

  const deletedDynamo =
    await deleteDynamoKeys(
      dynamoKeys
    );

  const deletedS3 =
    await deleteRawKeys(
      rawKeys
    );


  // -----------------------------
  // Verification
  // -----------------------------

  console.log("");
  console.log(
    "Verifying purge..."
  );

  const remainingDynamo =
    await scanAnalyticsKeys();

  const remainingRaw =
    await listRawKeys();

  console.log("");
  console.log(
    "Verification"
  );

  console.log(
    "------------"
  );

  console.log(
    `Dynamo rows remaining:    ${remainingDynamo.length}`
  );

  console.log(
    `Raw S3 objects remaining: ${remainingRaw.length}`
  );

  if (
    remainingDynamo.length >
      0 ||
    remainingRaw.length >
      0
  ) {
    throw new Error(
      [
        "Hard purge verification failed.",
        "One or more analytics records remain.",
        "",
        "Do not assume the purge completed successfully.",
      ].join("\n")
    );
  }

  console.log("");
  console.log(
    "HARD PURGE COMPLETE"
  );

  console.log(
    `Deleted Dynamo rows: ${deletedDynamo}`
  );

  console.log(
    `Deleted S3 objects:  ${deletedS3}`
  );
}


main().catch(
  (error) => {
    console.error("");
    console.error(
      "Analytics purge failed."
    );

    console.error(
      String(
        error?.message ||
        error
      )
    );

    process.exitCode =
      1;
  }
);