import {
  BatchGetItemCommand,
  GetItemCommand,
  QueryCommand,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";

import {
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";

import {
  marshall,
} from "@aws-sdk/util-dynamodb";

import {
  canonicalJsonStringify,
  hexSha256ToBase64,
  sha256Hex,
} from "../lambda/profile-variants-contract";

import {
  computeDeploymentConfigurationId,
  normalizeAndValidateDeploymentConfigurationDocument,
} from "../lambda/deployment-configuration-contract";

import {
  USAGE_EPOCH_TRANSITION_KIND,
  createClosingUsageEpochDocument,
  createOpenUsageEpochDocument,
} from "../lambda/usage-epoch-contract";

import {
  createUsageEpochStorageRecord,
} from "../lambda/usage-epoch-store";

import {
  createUsageEpochAnalyticsEventRecord,
} from "../lambda/usage-epoch-analytics-projection";

import {
  aggregateUsageEpochAnalyticsTrafficReport,
} from "../lambda/usage-epoch-analytics-aggregator";

import {
  CONFIGURATION_ANALYTICS_REPORT_SCHEMA_ID_V2,
  createConfigurationAnalyticsReportV2Document,
} from "../lambda/configuration-analytics-report-contract";

import {
  USAGE_EPOCH_FINALIZATION_SETTLEMENT_MS,
  finalizeConfigurationAnalyticsReportForEpoch,
  runConfigurationAnalyticsReportFinalizer,
} from "../lambda/configuration-analytics-report-finalizer";


const USAGE_TABLE =
  "usage-finalizer-test";

const PROJECTION_TABLE =
  "projection-finalizer-test";

const ANALYTICS_TABLE =
  "analytics-finalizer-test";

const REPORT_BUCKET =
  "report-finalizer-test";


function configuration() {
  const stage =
    "prod" as const;

  const platformReleaseId =
    "plr_worker";

  const profileVariantId =
    "prv_worker";

  const deploymentConfigurationId =
    computeDeploymentConfigurationId({
      stage,

      platformReleaseId,

      profileVariantId,
    });


  return normalizeAndValidateDeploymentConfigurationDocument({
    schema:
      "tejas-profile.deployment-configuration",

    schemaId:
      "tejas-profile.deployment-configuration.v1",

    deploymentConfigurationId,

    stage,

    createdAt:
      "2026-08-20T00:00:00.000Z",

    platformReleaseId,

    profileVariantId,

    profile: {
      contentSchemaVersion:
        1,

      contentHash:
        "a".repeat(
          64
        ),

      targeting: {
        location:
          "Austin",

        jobRole:
          "Backend Engineer",
      },
    },
  });
}


function closingEpoch() {
  const open =
    createOpenUsageEpochDocument({
      startedAt:
        "2026-08-20T00:00:00.000Z",

      deploymentConfiguration:
        configuration(),

      openedBy: {
        kind:
          USAGE_EPOCH_TRANSITION_KIND
            .PLATFORM_DEPLOYMENT,

        occurrenceId:
          "pdep_worker",
      },
    });


  return createClosingUsageEpochDocument({
    epoch:
      open,

    endedAt:
      "2026-08-20T01:00:00.000Z",

    closedBy: {
      kind:
        USAGE_EPOCH_TRANSITION_KIND
          .PROFILE_ACTIVATION,

      occurrenceId:
        "act_worker_close",
    },
  });
}


function projectionRecord() {
  const epoch =
    closingEpoch();

  const ts =
    Date.parse(
      "2026-08-20T00:10:00.000Z"
    );


  return createUsageEpochAnalyticsEventRecord({
    attribution: {
      usageEpochId:
        epoch.usageEpochId,

      stage:
        epoch.stage,

      deploymentConfigurationId:
        epoch
          .deploymentConfigurationId,

      platformReleaseId:
        epoch.platformReleaseId,

      profileVariantId:
        epoch.profileVariantId,

      startedAt:
        epoch.startedAt,

      endedAt:
        epoch.endedAt,
    },

    event: {
      eventId:
        "worker-event",

      ts,

      visitorHash:
        "visitor-worker",

      sessionHash:
        "session-worker",

      type:
        "session_start",
    },

    geo: {
      countryCode:
        "US",

      regionCode:
        "TX",

      city:
        "Austin",
    },
  });
}


function notFoundError() {
  const error:
    any =
      new Error(
        "Not found"
      );

  error.name =
    "NoSuchKey";

  error.$metadata = {
    httpStatusCode:
      404,
  };


  return error;
}


function storedReportObject(
  report:
    any
) {
  const body =
    canonicalJsonStringify(
      report
    );

  const digest =
    sha256Hex(
      body
    );


  return {
    Body: {
      transformToString:
        async () =>
          body,
    },

    ChecksumSHA256:
      hexSha256ToBase64(
        digest
      ),
  };
}


describe(
  "Configuration Analytics Report finalizer",
  () => {
    test(
      "scheduled run discovers a settled epoch, writes its immutable report, then closes the epoch",
      async () => {
        const epoch =
          closingEpoch();

        const projected =
          projectionRecord();

        const nowMs =
          Date.parse(
            epoch.endedAt!
          ) +
          USAGE_EPOCH_FINALIZATION_SETTLEMENT_MS +
          60_000;


        const ddbSend =
          jest.fn(
            async (
              command:
                any
            ) => {
              if (
                command instanceof
                  QueryCommand &&
                command.input
                  .IndexName ===
                  "ByState"
              ) {
                return {
                  Items: [
                    marshall({
                      usageEpochId:
                        epoch
                          .usageEpochId,
                    }),
                  ],
                };
              }


              if (
                command instanceof
                  GetItemCommand
              ) {
                return {
                  Item:
                    marshall(
                      createUsageEpochStorageRecord(
                        epoch
                      )
                    ),
                };
              }


              if (
                command instanceof
                  QueryCommand &&
                command.input
                  .TableName ===
                  PROJECTION_TABLE
              ) {
                return {
                  Items: [
                    marshall(
                      projected
                    ),
                  ],
                };
              }


              if (
                command instanceof
                  BatchGetItemCommand
              ) {
                return {
                  Responses: {
                    [ANALYTICS_TABLE]: [
                      marshall({
                        visitorHash:
                          "visitor-worker",

                        firstSeenAt:
                          projected.ts,
                      }),
                    ],
                  },

                  UnprocessedKeys:
                    {},
                };
              }


              if (
                command instanceof
                  UpdateItemCommand
              ) {
                return {};
              }


              throw new Error(
                `Unexpected DynamoDB command: ${command?.constructor?.name}`
              );
            }
          );


        const s3Send =
          jest.fn(
            async (
              command:
                any
            ) => {
              if (
                command instanceof
                  GetObjectCommand
              ) {
                throw notFoundError();
              }


              if (
                command instanceof
                  PutObjectCommand
              ) {
                return {};
              }


              throw new Error(
                "Unexpected S3 command."
              );
            }
          );


        const summary =
          await runConfigurationAnalyticsReportFinalizer({
            ddbClient: {
              send:
                ddbSend,
            },

            s3Client: {
              send:
                s3Send,
            },

            usageEpochsTableName:
              USAGE_TABLE,

            usageEpochAnalyticsTableName:
              PROJECTION_TABLE,

            analyticsTableName:
              ANALYTICS_TABLE,

            reportsBucketName:
              REPORT_BUCKET,

            stage:
              "prod",

            nowMs,
          });


        expect(
          summary
        ).toMatchObject({
          candidates:
            1,

          finalized:
            1,

          alreadyFinalized:
            0,

          skipped:
            0,

          failures:
            [],
        });


        const reportPut =
          s3Send.mock.calls
            .map(
              (
                call
              ) =>
                call[0]
            )
            .find(
              (
                command
              ) =>
                command instanceof
                  PutObjectCommand
            ) as
            PutObjectCommand;


        expect(
          reportPut
        ).toBeDefined();


        expect(
          JSON.parse(
            String(
              reportPut
                .input
                .Body
            )
          )
          .schemaId
        ).toBe(
          CONFIGURATION_ANALYTICS_REPORT_SCHEMA_ID_V2
        );


        expect(
          ddbSend.mock.calls
            .map(
              (
                call
              ) =>
                call[0]
            )
            .some(
              (
                command
              ) =>
                command instanceof
                  UpdateItemCommand
            )
        ).toBe(true);
      }
    );


    test(
      "retry after S3 success reuses the identical report and completes the DynamoDB close",
      async () => {
        const epoch =
          closingEpoch();

        const projected =
          projectionRecord();

        const nowMs =
          Date.parse(
            epoch.endedAt!
          ) +
          USAGE_EPOCH_FINALIZATION_SETTLEMENT_MS +
          60_000;


        const reportData =
          aggregateUsageEpochAnalyticsTrafficReport({
            epoch,

            events: [
              projected,
            ],

            visitorFirstSeenByHash:
              new Map([
                [
                  "visitor-worker",
                  projected.ts,
                ],
              ]),
          });


        const expectedReport =
          createConfigurationAnalyticsReportV2Document({
            epoch,

            traffic:
              reportData
                .traffic,

            analyticsByTraffic:
              reportData
                .analyticsByTraffic,
          });


        const ddbSend =
          jest.fn(
            async (
              command:
                any
            ) => {
              if (
                command instanceof
                  GetItemCommand
              ) {
                return {
                  Item:
                    marshall(
                      createUsageEpochStorageRecord(
                        epoch
                      )
                    ),
                };
              }


              if (
                command instanceof
                  QueryCommand
              ) {
                return {
                  Items: [
                    marshall(
                      projected
                    ),
                  ],
                };
              }


              if (
                command instanceof
                  BatchGetItemCommand
              ) {
                return {
                  Responses: {
                    [ANALYTICS_TABLE]: [
                      marshall({
                        visitorHash:
                          "visitor-worker",

                        firstSeenAt:
                          projected.ts,
                      }),
                    ],
                  },

                  UnprocessedKeys:
                    {},
                };
              }


              if (
                command instanceof
                  UpdateItemCommand
              ) {
                return {};
              }


              throw new Error(
                "Unexpected DynamoDB command."
              );
            }
          );


        const s3Send =
          jest.fn(
            async (
              command:
                any
            ) => {
              if (
                command instanceof
                  GetObjectCommand
              ) {
                return storedReportObject(
                  expectedReport
                );
              }


              if (
                command instanceof
                  PutObjectCommand
              ) {
                throw new Error(
                  "Retry must not rewrite an existing identical immutable report."
                );
              }


              throw new Error(
                "Unexpected S3 command."
              );
            }
          );


        const result =
          await finalizeConfigurationAnalyticsReportForEpoch({
            ddbClient: {
              send:
                ddbSend,
            },

            s3Client: {
              send:
                s3Send,
            },

            usageEpochsTableName:
              USAGE_TABLE,

            usageEpochAnalyticsTableName:
              PROJECTION_TABLE,

            analyticsTableName:
              ANALYTICS_TABLE,

            reportsBucketName:
              REPORT_BUCKET,

            stage:
              "prod",

            usageEpochId:
              epoch.usageEpochId,

            nowMs,
          });


        expect(
          result.status
        ).toBe(
          "finalized"
        );

        expect(
          result.reportAlreadyExists
        ).toBe(true);

        expect(
          result.reportId
        ).toBe(
          expectedReport
            .reportId
        );


        expect(
          s3Send
        ).toHaveBeenCalledTimes(
          1
        );
      }
    );


    test(
      "an epoch cannot finalize before the delayed-event settlement watermark",
      async () => {
        const epoch =
          closingEpoch();

        const nowMs =
          Date.parse(
            epoch.endedAt!
          ) +
          USAGE_EPOCH_FINALIZATION_SETTLEMENT_MS -
          1;


        const ddbSend =
          jest.fn()
            .mockResolvedValue({
              Item:
                marshall(
                  createUsageEpochStorageRecord(
                    epoch
                  )
                ),
            });


        const s3Send =
          jest.fn();


        const result =
          await finalizeConfigurationAnalyticsReportForEpoch({
            ddbClient: {
              send:
                ddbSend,
            },

            s3Client: {
              send:
                s3Send,
            },

            usageEpochsTableName:
              USAGE_TABLE,

            usageEpochAnalyticsTableName:
              PROJECTION_TABLE,

            analyticsTableName:
              ANALYTICS_TABLE,

            reportsBucketName:
              REPORT_BUCKET,

            stage:
              "prod",

            usageEpochId:
              epoch.usageEpochId,

            nowMs,
          });


        expect(
          result.status
        ).toBe(
          "unsettled"
        );

        expect(
          ddbSend
        ).toHaveBeenCalledTimes(
          1
        );

        expect(
          s3Send
        ).not.toHaveBeenCalled();
      }
    );
  }
);