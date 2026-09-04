import {
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";

import {
  canonicalJsonStringify,
  hexSha256ToBase64,
  sha256Hex,
} from "../lambda/profile-variants-contract";

import {
  computeDeploymentConfigurationId,
} from "../lambda/deployment-configuration-contract";

import {
  USAGE_EPOCH_TRANSITION_KIND,
  createClosingUsageEpochDocument,
  createOpenUsageEpochDocument,
} from "../lambda/usage-epoch-contract";

import {
  createConfigurationAnalyticsReportDocument,
} from "../lambda/configuration-analytics-report-contract";

import {
  ConfigurationAnalyticsReportConflictError,
  readConfigurationAnalyticsReport,
  writeImmutableConfigurationAnalyticsReport,
} from "../lambda/configuration-analytics-report-store";


const BUCKET =
  "configuration-analytics-report-test-bucket";


function configuration() {
  const stage =
    "prod" as const;

  const platformReleaseId =
    "plr_store_001";

  const profileVariantId =
    "prv_store_001";

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
      "2026-08-24T00:00:00.000Z",

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


function report() {
  const open =
    createOpenUsageEpochDocument({
      startedAt:
        "2026-08-24T01:00:00.000Z",

      deploymentConfiguration:
        configuration(),

      openedBy: {
        kind:
          USAGE_EPOCH_TRANSITION_KIND
            .PLATFORM_DEPLOYMENT,

        occurrenceId:
          "pdep_store_001",
      },
    });

  const closing =
    createClosingUsageEpochDocument({
      epoch:
        open,

      endedAt:
        "2026-08-24T02:00:00.000Z",

      closedBy: {
        kind:
          USAGE_EPOCH_TRANSITION_KIND
            .PROFILE_ACTIVATION,

        occurrenceId:
          "act_store_close_001",
      },
    });


  return createConfigurationAnalyticsReportDocument({
    epoch:
      closing,

    analytics: {
      overview: {
        uniqueVisitors:
          1,

        sessions:
          1,

        activeMs:
          5000,

        eventCount:
          3,
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


/**
 * The shape S3 actually returns for a GetObject on a missing key
 * when the caller lacks s3:ListBucket -- masks the true NotFound as
 * AccessDenied instead. This bucket is deliberately GetObject/
 * PutObject-only with no ListBucket grant, so this is the real-world
 * error shape for a not-yet-written report, not notFoundError() above.
 */
function accessDeniedMaskingMissingKey() {
  const error:
    any =
      new Error(
        "Access Denied"
      );

  error.name =
    "AccessDenied";

  error.$metadata = {
    httpStatusCode:
      403,
  };


  return error;
}


function preconditionError() {
  const error:
    any =
      new Error(
        "Precondition failed"
      );

  error.name =
    "PreconditionFailed";

  error.$metadata = {
    httpStatusCode:
      412,
  };


  return error;
}


function storedObject(
  value:
    any
) {
  const body =
    canonicalJsonStringify(
      value
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
  "Configuration Analytics Report immutable store",
  () => {
    test(
      "creates a canonical checksum-protected object with create-only semantics",
      async () => {
        const value =
          report();

        const send =
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
                "Unexpected command."
              );
            }
          );


        const result =
          await writeImmutableConfigurationAnalyticsReport({
            client: {
              send,
            },

            bucketName:
              BUCKET,

            report:
              value,
          });


        expect(
          result.alreadyExists
        ).toBe(false);

        expect(
          result.key
        ).toBe(
          `reports/${value.reportId}.json`
        );

        expect(
          result.reportSha256
        ).toMatch(
          /^[a-f0-9]{64}$/
        );


        const put =
          send.mock.calls
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
          put
        ).toBeDefined();

        expect(
          put.input
        ).toMatchObject({
          Bucket:
            BUCKET,

          Key:
            `reports/${value.reportId}.json`,

          ContentType:
            "application/json",

          IfNoneMatch:
            "*",
        });

        expect(
          put.input
            .ChecksumSHA256
        ).toBe(
          hexSha256ToBase64(
            result
              .reportSha256
          )
        );

        expect(
          put.input.Body
        ).toBe(
          canonicalJsonStringify(
            value
          )
        );
      }
    );


    test(
      "treats a missing report masked as S3 AccessDenied the same as a clean NotFound",
      async () => {
        const value =
          report();

        const send =
          jest.fn(
            async (
              command:
                any
            ) => {
              if (
                command instanceof
                  GetObjectCommand
              ) {
                throw accessDeniedMaskingMissingKey();
              }


              if (
                command instanceof
                  PutObjectCommand
              ) {
                return {};
              }


              throw new Error(
                "Unexpected command."
              );
            }
          );


        const result =
          await writeImmutableConfigurationAnalyticsReport({
            client: {
              send,
            },

            bucketName:
              BUCKET,

            report:
              value,
          });


        expect(
          result.alreadyExists
        ).toBe(false);

        const put =
          send.mock.calls
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
            );

        expect(
          put
        ).toBeDefined();
      }
    );


    test(
      "an existing byte-identical report is an idempotent success",
      async () => {
        const value =
          report();

        const send =
          jest.fn(
            async (
              command:
                any
            ) => {
              if (
                command instanceof
                  GetObjectCommand
              ) {
                return storedObject(
                  value
                );
              }


              throw new Error(
                "PutObject must not run."
              );
            }
          );


        const result =
          await writeImmutableConfigurationAnalyticsReport({
            client: {
              send,
            },

            bucketName:
              BUCKET,

            report:
              value,
          });


        expect(
          result.alreadyExists
        ).toBe(true);

        expect(
          send
        ).toHaveBeenCalledTimes(
          1
        );
      }
    );


    test(
      "same deterministic reportId with different immutable bytes is a conflict",
      async () => {
        const value =
          report();

        const different = {
          ...value,

          analytics: {
            ...value.analytics,

            overview: {
              ...value.analytics
                .overview,

              uniqueVisitors:
                99,
            },
          },
        };

        const send =
          jest.fn(
            async (
              command:
                any
            ) => {
              if (
                command instanceof
                  GetObjectCommand
              ) {
                return storedObject(
                  value
                );
              }


              throw new Error(
                "Unexpected command."
              );
            }
          );


        await expect(
          writeImmutableConfigurationAnalyticsReport({
            client: {
              send,
            },

            bucketName:
              BUCKET,

            report:
              different,
          })
        ).rejects.toBeInstanceOf(
          ConfigurationAnalyticsReportConflictError
        );
      }
    );


    test(
      "a concurrent identical create winner is treated as idempotent success",
      async () => {
        const value =
          report();

        let call =
          0;

        const send =
          jest.fn(
            async (
              command:
                any
            ) => {
              call += 1;


              if (
                call ===
                  1 &&
                command instanceof
                  GetObjectCommand
              ) {
                throw notFoundError();
              }


              if (
                call ===
                  2 &&
                command instanceof
                  PutObjectCommand
              ) {
                throw preconditionError();
              }


              if (
                call ===
                  3 &&
                command instanceof
                  GetObjectCommand
              ) {
                return storedObject(
                  value
                );
              }


              throw new Error(
                "Unexpected command sequence."
              );
            }
          );


        const result =
          await writeImmutableConfigurationAnalyticsReport({
            client: {
              send,
            },

            bucketName:
              BUCKET,

            report:
              value,
          });


        expect(
          result.alreadyExists
        ).toBe(true);

        expect(
          send
        ).toHaveBeenCalledTimes(
          3
        );
      }
    );


    test(
      "stored checksum corruption fails closed",
      async () => {
        const value =
          report();

        const stored =
          storedObject(
            value
          );

        const send =
          jest.fn()
            .mockResolvedValue({
              ...stored,

              ChecksumSHA256:
                hexSha256ToBase64(
                  "f".repeat(
                    64
                  )
                ),
            });


        await expect(
          readConfigurationAnalyticsReport({
            client: {
              send,
            },

            bucketName:
              BUCKET,

            reportId:
              value.reportId,
          })
        ).rejects.toThrow(
          /checksum does not match/
        );
      }
    );


    test(
      "stored non-canonical JSON fails closed",
      async () => {
        const value =
          report();

        const nonCanonical =
          JSON.stringify(
            value,
            null,
            2
          );

        const send =
          jest.fn()
            .mockResolvedValue({
              Body: {
                transformToString:
                  async () =>
                    nonCanonical,
              },

              ChecksumSHA256:
                hexSha256ToBase64(
                  sha256Hex(
                    nonCanonical
                  )
                ),
            });


        await expect(
          readConfigurationAnalyticsReport({
            client: {
              send,
            },

            bucketName:
              BUCKET,

            reportId:
              value.reportId,
          })
        ).rejects.toThrow(
          /not canonical JSON/
        );
      }
    );
  }
);