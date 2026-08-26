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
} from "../lambda/deployment-configuration-contract";

import {
  USAGE_EPOCH_STATE,
  USAGE_EPOCH_TRANSITION_KIND,
  createClosingUsageEpochDocument,
  createOpenUsageEpochDocument,
  finalizeUsageEpochDocument,
} from "../lambda/usage-epoch-contract";

import {
  createUsageEpochStorageRecord,
} from "../lambda/usage-epoch-store";

import {
  createConfigurationAnalyticsReportDocument,
} from "../lambda/configuration-analytics-report-contract";


const mockDynamoSend =
  jest.fn();

const mockS3Send =
  jest.fn();


jest.mock(
  "@aws-sdk/client-dynamodb",
  () => {
    const actual:
      any =
      jest.requireActual(
        "@aws-sdk/client-dynamodb"
      );


    return {
      ...actual,

      DynamoDBClient:
        jest.fn(
          () => ({
            send:
              mockDynamoSend,
          })
        ),
    };
  }
);


jest.mock(
  "@aws-sdk/client-s3",
  () => {
    const actual:
      any =
      jest.requireActual(
        "@aws-sdk/client-s3"
      );


    return {
      ...actual,

      S3Client:
        jest.fn(
          () => ({
            send:
              mockS3Send,
          })
        ),
    };
  }
);


const OWNER_TOKEN =
  "p8f-owner-token";

const USAGE_TABLE =
  "p8f-usage-epochs";

const REPORT_BUCKET =
  "p8f-configuration-analytics-reports";


let handler:
  any;


function configuration() {
  const stage =
    "prod" as const;

  const platformReleaseId =
    "plr_p8f";

  const profileVariantId =
    "prv_p8f";

  const deploymentConfigurationId =
    computeDeploymentConfigurationId({
      stage,

      platformReleaseId,

      profileVariantId,
    });


  return {
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
  };
}


function closingEpoch() {
  const open =
    createOpenUsageEpochDocument({
      startedAt:
        "2026-08-20T01:00:00.000Z",

      deploymentConfiguration:
        configuration(),

      openedBy: {
        kind:
          USAGE_EPOCH_TRANSITION_KIND
            .PLATFORM_DEPLOYMENT,

        occurrenceId:
          "pdep_p8f",
      },
    });


  return createClosingUsageEpochDocument({
    epoch:
      open,

    endedAt:
      "2026-08-20T02:00:00.000Z",

    closedBy: {
      kind:
        USAGE_EPOCH_TRANSITION_KIND
          .PROFILE_ACTIVATION,

      occurrenceId:
        "act_p8f_close",
    },
  });
}


function reportFixture() {
  const closing =
    closingEpoch();


  const report =
    createConfigurationAnalyticsReportDocument({
      epoch:
        closing,

      analytics: {
        overview: {
          uniqueVisitors:
            2,

          sessions:
            2,

          activeMs:
            5000,

          eventCount:
            4,
        },

        sections:
          [],

        ctas:
          [],

        projects:
          [],

        snippets:
          [],

        deepLinks:
          [],

        depthMilestones:
          [],

        countries:
          [],

        cities:
          [],

        daily:
          [],
      },
    });


  const reportSha256 =
    sha256Hex(
      canonicalJsonStringify(
        report
      )
    );


  const closed =
    finalizeUsageEpochDocument({
      epoch:
        closing,

      reportId:
        report.reportId,

      reportSha256,

      finalizedAt:
        "2026-08-21T03:00:00.000Z",
    });


  return {
    closing,

    report,

    reportSha256,

    closed,
  };
}


function storedReport(
  report:
    any
) {
  const body =
    canonicalJsonStringify(
      report
    );


  return {
    Body: {
      transformToString:
        async () =>
          body,
    },

    ChecksumSHA256:
      hexSha256ToBase64(
        sha256Hex(
          body
        )
      ),
  };
}


function ownerEvent({
  path,

  query =
    {},
}: {
  path:
    string;

  query?:
    Record<
      string,
      string
    >;
}) {
  return {
    rawPath:
      path,

    requestContext: {
      http: {
        method:
          "GET",

        path,
      },
    },

    queryStringParameters:
      query,

    headers: {
      "x-owner-token":
        OWNER_TOKEN,
    },
  };
}


function body(
  response:
    any
) {
  return JSON.parse(
    String(
      response?.body ||
      "{}"
    )
  );
}


function tokenFor(
  scope:
    string,

  key:
    any
) {
  return Buffer
    .from(
      JSON.stringify({
        scope,

        key,
      }),
      "utf8"
    )
    .toString(
      "base64url"
    );
}


describe(
  "P8F Configuration Analytics archive read APIs",
  () => {
    beforeEach(
      () => {
        jest.resetModules();

        mockDynamoSend
          .mockReset();

        mockS3Send
          .mockReset();


        process.env.OWNER_TOKEN =
          OWNER_TOKEN;

        process.env.USAGE_EPOCHS_TABLE =
          USAGE_TABLE;

        process.env.CONFIGURATION_ANALYTICS_REPORTS_BUCKET =
          REPORT_BUCKET;

        process.env.STAGE =
          "prod";

        process.env.ALLOWED_ORIGINS =
          "";


        handler =
          require(
            "../lambda/snapshots-handler"
          ).handler;
      }
    );


    test(
      "defaults Usage Epoch history to CLOSED and queries ByState newest first",
      async () => {
        const {
          closed,
        } =
          reportFixture();

        const storage =
          createUsageEpochStorageRecord(
            closed
          );

        const lastKey =
          marshall({
            pk:
              storage.pk,

            sk:
              storage.sk,

            gsi2pk:
              storage.gsi2pk,

            gsi2sk:
              storage.gsi2sk,
          });


        mockDynamoSend
          .mockResolvedValueOnce({
            Items: [
              marshall(
                storage
              ),
            ],

            LastEvaluatedKey:
              lastKey,
          });


        const response =
          await handler(
            ownerEvent({
              path:
                "/usage-epochs/list",

              query: {
                limit:
                  "25",
              },
            })
          );


        expect(
          response.statusCode
        ).toBe(
          200
        );


        const parsed =
          body(
            response
          );


        expect(
          parsed.filter
        ).toEqual({
          deploymentConfigurationId:
            null,

          state:
            USAGE_EPOCH_STATE
              .CLOSED,
        });


        expect(
          parsed.order
        ).toBe(
          "stateTimestampDescending"
        );


        expect(
          parsed.epochs
        ).toHaveLength(
          1
        );

        expect(
          parsed.epochs[0]
        ).toMatchObject({
          usageEpochId:
            closed.usageEpochId,

          deploymentConfigurationId:
            closed
              .deploymentConfigurationId,

          state:
            USAGE_EPOCH_STATE
              .CLOSED,

          report: {
            reportId:
              closed.report
                ?.reportId,
          },
        });


        expect(
          parsed.nextToken
        ).toEqual(
          expect.any(
            String
          )
        );


        const command =
          mockDynamoSend
            .mock
            .calls[0][0];


        expect(
          command
            ?.constructor
            ?.name
        ).toBe(
          "QueryCommand"
        );

        expect(
          command.input
        ).toMatchObject({
          TableName:
            USAGE_TABLE,

          IndexName:
            "ByState",

          Limit:
            25,

          ScanIndexForward:
            false,
        });


        expect(
          command.input
            .ExpressionAttributeValues[
              ":indexPk"
            ]
        ).toEqual({
          S:
            "STATE#CLOSED",
        });
      }
    );


    test(
      "lists recurrence history through ByDeploymentConfiguration with scope-bound pagination",
      async () => {
        const closing =
          closingEpoch();

        const deploymentConfigurationId =
          closing
            .deploymentConfigurationId;

        const startKey = {
          pk: {
            S:
              `EPOCH#${closing.usageEpochId}`,
          },

          sk: {
            S:
              "EPOCH",
          },

          gsi1pk: {
            S:
              `CONFIG#${deploymentConfigurationId}`,
          },

          gsi1sk: {
            S:
              `STARTED#${closing.startedAt}#EPOCH#${closing.usageEpochId}`,
          },
        };


        mockDynamoSend
          .mockResolvedValueOnce({
            Items:
              [],
          });


        const response =
          await handler(
            ownerEvent({
              path:
                "/usage-epochs/list",

              query: {
                deploymentConfigurationId,

                nextToken:
                  tokenFor(
                    `usage-epochs:configuration:${deploymentConfigurationId}`,

                    startKey
                  ),
              },
            })
          );


        expect(
          response.statusCode
        ).toBe(
          200
        );


        const command =
          mockDynamoSend
            .mock
            .calls[0][0];


        expect(
          command.input
            .IndexName
        ).toBe(
          "ByDeploymentConfiguration"
        );

        expect(
          command.input
            .ExpressionAttributeValues[
              ":indexPk"
            ]
        ).toEqual({
          S:
            `CONFIG#${deploymentConfigurationId}`,
        });

        expect(
          command.input
            .ExclusiveStartKey
        ).toEqual(
          startKey
        );


        expect(
          body(
            response
          ).filter
        ).toEqual({
          deploymentConfigurationId,

          state:
            null,
        });
      }
    );


    test(
      "rejects ambiguous selectors and cross-scope Usage Epoch tokens before DynamoDB",
      async () => {
        const configurationId =
          closingEpoch()
            .deploymentConfigurationId;


        const ambiguous =
          await handler(
            ownerEvent({
              path:
                "/usage-epochs/list",

              query: {
                deploymentConfigurationId:
                  configurationId,

                state:
                  "CLOSED",
              },
            })
          );


        expect(
          ambiguous.statusCode
        ).toBe(
          400
        );


        const invalidToken =
          await handler(
            ownerEvent({
              path:
                "/usage-epochs/list",

              query: {
                nextToken:
                  tokenFor(
                    "usage-epochs:state:OPEN",

                    {
                      pk: {
                        S:
                          "EPOCH#old",
                      },
                    }
                  ),
              },
            })
          );


        expect(
          invalidToken.statusCode
        ).toBe(
          400
        );


        expect(
          mockDynamoSend
        ).not
          .toHaveBeenCalled();
      }
    );


    test(
      "resolves one CLOSED Usage Epoch to its checksum-bound immutable report",
      async () => {
        const {
          closed,
          report,
          reportSha256,
        } =
          reportFixture();


        mockDynamoSend
          .mockImplementation(
            async (
              command:
                any
            ) => {
              if (
                command
                  ?.constructor
                  ?.name ===
                  "GetItemCommand"
              ) {
                return {
                  Item:
                    marshall(
                      createUsageEpochStorageRecord(
                        closed
                      )
                    ),
                };
              }


              throw new Error(
                "Unexpected DynamoDB command."
              );
            }
          );


        mockS3Send
          .mockImplementation(
            async (
              command:
                any
            ) => {
              if (
                command
                  ?.constructor
                  ?.name ===
                  "GetObjectCommand"
              ) {
                return storedReport(
                  report
                );
              }


              throw new Error(
                "Unexpected S3 command."
              );
            }
          );


        const response =
          await handler(
            ownerEvent({
              path:
                "/configuration-analytics-reports/get",

              query: {
                usageEpochId:
                  closed
                    .usageEpochId,
              },
            })
          );


        expect(
          response.statusCode
        ).toBe(
          200
        );


        const parsed =
          body(
            response
          );


        expect(
          parsed
        ).toMatchObject({
          ok:
            true,

          reportSha256,

          usageEpoch: {
            usageEpochId:
              closed
                .usageEpochId,

            state:
              USAGE_EPOCH_STATE
                .CLOSED,
          },

          report: {
            reportId:
              report.reportId,

            usageEpochId:
              closed
                .usageEpochId,
          },
        });


        const getEpoch =
          mockDynamoSend
            .mock
            .calls[0][0];


        expect(
          getEpoch.input
            .ConsistentRead
        ).toBe(
          true
        );


        const getReport =
          mockS3Send
            .mock
            .calls[0][0];


        expect(
          getReport.input
        ).toMatchObject({
          Bucket:
            REPORT_BUCKET,

          Key:
            `reports/${report.reportId}.json`,

          ChecksumMode:
            "ENABLED",
        });
      }
    );


    test(
      "does not expose an immutable report before the Usage Epoch reaches CLOSED",
      async () => {
        const closing =
          closingEpoch();


        mockDynamoSend
          .mockResolvedValueOnce({
            Item:
              marshall(
                createUsageEpochStorageRecord(
                  closing
                )
              ),
          });


        const response =
          await handler(
            ownerEvent({
              path:
                "/configuration-analytics-reports/get",

              query: {
                usageEpochId:
                  closing
                    .usageEpochId,
              },
            })
          );


        expect(
          response.statusCode
        ).toBe(
          409
        );


        expect(
          body(
            response
          )
        ).toMatchObject({
          state:
            USAGE_EPOCH_STATE
              .CLOSING,
        });


        expect(
          mockS3Send
        ).not
          .toHaveBeenCalled();
      }
    );


    test(
      "fails closed when CLOSED epoch checksum evidence disagrees with the immutable report",
      async () => {
        const {
          closing,
          report,
        } =
          reportFixture();


        const inconsistentClosed =
          finalizeUsageEpochDocument({
            epoch:
              closing,

            reportId:
              report.reportId,

            reportSha256:
              "f".repeat(
                64
              ),

            finalizedAt:
              "2026-08-21T03:00:00.000Z",
          });


        mockDynamoSend
          .mockResolvedValueOnce({
            Item:
              marshall(
                createUsageEpochStorageRecord(
                  inconsistentClosed
                )
              ),
          });


        mockS3Send
          .mockResolvedValueOnce(
            storedReport(
              report
            )
          );


        const response =
          await handler(
            ownerEvent({
              path:
                "/configuration-analytics-reports/get",

              query: {
                usageEpochId:
                  inconsistentClosed
                    .usageEpochId,
              },
            })
          );


        expect(
          response.statusCode
        ).toBe(
          500
        );
      }
    );
  }
);