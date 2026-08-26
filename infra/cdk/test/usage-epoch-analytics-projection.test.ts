import {
  marshall,
  unmarshall,
} from "@aws-sdk/util-dynamodb";

import {
  computeDeploymentConfigurationId,
  normalizeAndValidateDeploymentConfigurationDocument,
} from "../lambda/deployment-configuration-contract";

import {
  USAGE_EPOCH_TRANSITION_KIND,
  buildActiveUsageEpochPointer,
  createClosingUsageEpochDocument,
  createOpenUsageEpochDocument,
} from "../lambda/usage-epoch-contract";

import {
  createUsageEpochStorageRecord,
} from "../lambda/usage-epoch-store";

import {
  projectAnalyticsEventToUsageEpoch,
} from "../lambda/usage-epoch-analytics-projection";


const USAGE_TABLE =
  "usage-epoch-attribution-test";

const PROJECTION_TABLE =
  "usage-epoch-analytics-test";


function commandName(
  command:
    any
) {
  return (
    command
      ?.constructor
      ?.name ||
    ""
  );
}


function configuration({
  platformReleaseId,
  profileVariantId,
}: {
  platformReleaseId:
    string;

  profileVariantId:
    string;
}) {
  const stage =
    "prod" as const;

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
  });
}


function analyticsEvent(
  deploymentConfiguration:
    any,

  ts:
    number,

  overrides:
    Record<string, any> =
      {}
) {
  return {
    eventId:
      "event-projection-001",

    type:
      "section_view",

    ts,

    visitorHash:
      "visitor-hash-001",

    sessionHash:
      "session-hash-001",

    profileVariantId:
      deploymentConfiguration
        .profileVariantId,

    platformReleaseId:
      deploymentConfiguration
        .platformReleaseId,

    deploymentConfigurationId:
      deploymentConfiguration
        .deploymentConfigurationId,

    section:
      "About Me",

    ctaId:
      null,

    projectId:
      null,

    snippetId:
      null,

    depthPct:
      null,

    ms:
      null,

    path:
      null,

    hash:
      null,

    ...overrides,
  };
}


function geo() {
  return {
    countryCode:
      "US",

    regionCode:
      "TX",

    city:
      "Austin",
  };
}


function conditionalFailure() {
  const error:
    any =
      new Error(
        "Conditional check failed"
      );

  error.name =
    "ConditionalCheckFailedException";

  return error;
}


describe(
  "Usage Epoch Analytics projection",
  () => {
    test(
      "current OPEN epoch uses the strongly consistent Active pointer fast path",
      async () => {
        const config =
          configuration({
            platformReleaseId:
              "plr_current",

            profileVariantId:
              "prv_current",
          });

        const open =
          createOpenUsageEpochDocument({
            startedAt:
              "2026-08-24T01:00:00.000Z",

            deploymentConfiguration:
              config,

            openedBy: {
              kind:
                USAGE_EPOCH_TRANSITION_KIND
                  .PLATFORM_DEPLOYMENT,

              occurrenceId:
                "pdep_current",
            },
          });

        const pointer =
          buildActiveUsageEpochPointer({
            epoch:
              open,
          });

        const eventTs =
          Date.parse(
            "2026-08-24T01:30:00.000Z"
          );

        const send =
          jest.fn()
            .mockResolvedValueOnce({
              Item:
                marshall(
                  pointer
                ),
            })
            .mockResolvedValueOnce(
              {}
            );


        const result =
          await projectAnalyticsEventToUsageEpoch({
            client: {
              send,
            },

            usageEpochTableName:
              USAGE_TABLE,

            projectionTableName:
              PROJECTION_TABLE,

            stage:
              "prod",

            event:
              analyticsEvent(
                config,
                eventTs
              ),

            geo:
              geo(),
          });


        expect(
          result
        ).toMatchObject({
          projected:
            true,

          duplicate:
            false,

          usageEpochId:
            open.usageEpochId,
        });


        expect(
          send.mock.calls
            .map(
              (call) =>
                commandName(
                  call[0]
                )
            )
        ).toEqual([
          "GetItemCommand",
          "PutItemCommand",
        ]);


        const put =
          send.mock.calls[1][0];

        const stored =
          unmarshall(
            put.input.Item
          );


        expect(
          put.input.TableName
        ).toBe(
          PROJECTION_TABLE
        );

        expect(
          stored.pk
        ).toBe(
          `EPOCH#${open.usageEpochId}`
        );

        expect(
          stored.sk
        ).toMatch(
          /^EVENT#[a-f0-9]{64}$/
        );

        expect(
          stored
        ).toMatchObject({
          usageEpochId:
            open.usageEpochId,

          deploymentConfigurationId:
            config
              .deploymentConfigurationId,

          platformReleaseId:
            config.platformReleaseId,

          profileVariantId:
            config.profileVariantId,

          ts:
            eventTs,

          day:
            "2026-08-24",

          visitorHash:
            "visitor-hash-001",

          sessionHash:
            "session-hash-001",

          countryCode:
            "US",

          regionCode:
            "TX",

          city:
            "Austin",
        });


        expect(
          stored
        ).not.toHaveProperty(
          "eventId"
        );

        expect(
          stored
        ).not.toHaveProperty(
          "visitorId"
        );

        expect(
          stored
        ).not.toHaveProperty(
          "sessionId"
        );
      }
    );


    test(
      "delayed event resolves a previous recurring configuration epoch through GSI then strongly verifies the base record",
      async () => {
        const configA =
          configuration({
            platformReleaseId:
              "plr_A",

            profileVariantId:
              "prv_A",
          });

        const configB =
          configuration({
            platformReleaseId:
              "plr_B",

            profileVariantId:
              "prv_B",
          });


        const oldOpen =
          createOpenUsageEpochDocument({
            startedAt:
              "2026-08-24T09:00:00.000Z",

            deploymentConfiguration:
              configA,

            openedBy: {
              kind:
                USAGE_EPOCH_TRANSITION_KIND
                  .PLATFORM_DEPLOYMENT,

              occurrenceId:
                "pdep_A",
            },
          });


        const oldClosing =
          createClosingUsageEpochDocument({
            epoch:
              oldOpen,

            endedAt:
              "2026-08-24T10:00:00.000Z",

            closedBy: {
              kind:
                USAGE_EPOCH_TRANSITION_KIND
                  .PROFILE_ACTIVATION,

              occurrenceId:
                "act_A_close",
            },
          });


        const currentOpen =
          createOpenUsageEpochDocument({
            startedAt:
              "2026-08-24T10:00:00.000Z",

            deploymentConfiguration:
              configB,

            openedBy: {
              kind:
                USAGE_EPOCH_TRANSITION_KIND
                  .PROFILE_ACTIVATION,

              occurrenceId:
                "act_B_open",
            },
          });


        const currentPointer =
          buildActiveUsageEpochPointer({
            epoch:
              currentOpen,
          });


        const send =
          jest.fn()
            .mockResolvedValueOnce({
              Item:
                marshall(
                  currentPointer
                ),
            })
            .mockResolvedValueOnce({
              Items: [
                marshall(
                  createUsageEpochStorageRecord(
                    oldClosing
                  )
                ),
              ],
            })
            .mockResolvedValueOnce({
              Item:
                marshall(
                  createUsageEpochStorageRecord(
                    oldClosing
                  )
                ),
            })
            .mockResolvedValueOnce(
              {}
            );


        const result =
          await projectAnalyticsEventToUsageEpoch({
            client: {
              send,
            },

            usageEpochTableName:
              USAGE_TABLE,

            projectionTableName:
              PROJECTION_TABLE,

            stage:
              "prod",

            event:
              analyticsEvent(
                configA,

                Date.parse(
                  "2026-08-24T09:30:00.000Z"
                )
              ),

            geo:
              geo(),
          });


        expect(
          result
            .usageEpochId
        ).toBe(
          oldClosing
            .usageEpochId
        );


        expect(
          send.mock.calls
            .map(
              (call) =>
                commandName(
                  call[0]
                )
            )
        ).toEqual([
          "GetItemCommand",
          "QueryCommand",
          "GetItemCommand",
          "PutItemCommand",
        ]);


        const query =
          send.mock.calls[1][0];

        expect(
          query.input
            .IndexName
        ).toBe(
          "ByDeploymentConfiguration"
        );

        expect(
          query.input
            .ScanIndexForward
        ).toBe(false);

        expect(
          query.input
            .Limit
        ).toBe(1);


        const exactRead =
          send.mock.calls[2][0];

        expect(
          exactRead.input
            .ConsistentRead
        ).toBe(true);
      }
    );


    test(
      "Usage Epoch interval is right-open so an event at endedAt is not assigned to the old epoch",
      async () => {
        const configA =
          configuration({
            platformReleaseId:
              "plr_boundary_A",

            profileVariantId:
              "prv_boundary_A",
          });

        const configB =
          configuration({
            platformReleaseId:
              "plr_boundary_B",

            profileVariantId:
              "prv_boundary_B",
          });


        const oldOpen =
          createOpenUsageEpochDocument({
            startedAt:
              "2026-08-24T09:00:00.000Z",

            deploymentConfiguration:
              configA,

            openedBy: {
              kind:
                USAGE_EPOCH_TRANSITION_KIND
                  .PLATFORM_DEPLOYMENT,

              occurrenceId:
                "pdep_boundary_A",
            },
          });


        const oldClosing =
          createClosingUsageEpochDocument({
            epoch:
              oldOpen,

            endedAt:
              "2026-08-24T10:00:00.000Z",

            closedBy: {
              kind:
                USAGE_EPOCH_TRANSITION_KIND
                  .PROFILE_ACTIVATION,

              occurrenceId:
                "act_boundary_close",
            },
          });


        const currentOpen =
          createOpenUsageEpochDocument({
            startedAt:
              "2026-08-24T10:00:00.000Z",

            deploymentConfiguration:
              configB,

            openedBy: {
              kind:
                USAGE_EPOCH_TRANSITION_KIND
                  .PROFILE_ACTIVATION,

              occurrenceId:
                "act_boundary_B",
            },
          });


        const send =
          jest.fn()
            .mockResolvedValueOnce({
              Item:
                marshall(
                  buildActiveUsageEpochPointer({
                    epoch:
                      currentOpen,
                  })
                ),
            })
            .mockResolvedValueOnce({
              Items: [
                marshall(
                  createUsageEpochStorageRecord(
                    oldClosing
                  )
                ),
              ],
            })
            .mockResolvedValueOnce({
              Item:
                marshall(
                  createUsageEpochStorageRecord(
                    oldClosing
                  )
                ),
            });


        const result =
          await projectAnalyticsEventToUsageEpoch({
            client: {
              send,
            },

            usageEpochTableName:
              USAGE_TABLE,

            projectionTableName:
              PROJECTION_TABLE,

            stage:
              "prod",

            event:
              analyticsEvent(
                configA,

                Date.parse(
                  "2026-08-24T10:00:00.000Z"
                )
              ),

            geo:
              geo(),
          });


        expect(
          result
        ).toMatchObject({
          projected:
            false,

          reason:
            "no_matching_usage_epoch",
        });


        expect(
          send.mock.calls
            .map(
              (call) =>
                commandName(
                  call[0]
                )
            )
        ).not.toContain(
          "PutItemCommand"
        );
      }
    );


    test(
      "legacy or incomplete formal runtime identity remains live-analytics-only",
      async () => {
        const send =
          jest.fn();


        const result =
          await projectAnalyticsEventToUsageEpoch({
            client: {
              send,
            },

            usageEpochTableName:
              USAGE_TABLE,

            projectionTableName:
              PROJECTION_TABLE,

            stage:
              "prod",

            event: {
              eventId:
                "legacy-event",

              ts:
                Date.parse(
                  "2026-08-24T10:00:00.000Z"
                ),

              visitorHash:
                "visitor",

              sessionHash:
                "session",

              type:
                "session_start",

              profileVariantId:
                null,

              platformReleaseId:
                null,

              deploymentConfigurationId:
                null,
            },

            geo:
              geo(),
          });


        expect(
          result.reason
        ).toBe(
          "incomplete_runtime_identity"
        );

        expect(
          send
        ).not.toHaveBeenCalled();
      }
    );


    test(
      "retrying one projected event is idempotent",
      async () => {
        const config =
          configuration({
            platformReleaseId:
              "plr_retry",

            profileVariantId:
              "prv_retry",
          });

        const open =
          createOpenUsageEpochDocument({
            startedAt:
              "2026-08-24T01:00:00.000Z",

            deploymentConfiguration:
              config,

            openedBy: {
              kind:
                USAGE_EPOCH_TRANSITION_KIND
                  .PLATFORM_DEPLOYMENT,

              occurrenceId:
                "pdep_retry",
            },
          });


        const send =
          jest.fn()
            .mockResolvedValueOnce({
              Item:
                marshall(
                  buildActiveUsageEpochPointer({
                    epoch:
                      open,
                  })
                ),
            })
            .mockRejectedValueOnce(
              conditionalFailure()
            );


        const result =
          await projectAnalyticsEventToUsageEpoch({
            client: {
              send,
            },

            usageEpochTableName:
              USAGE_TABLE,

            projectionTableName:
              PROJECTION_TABLE,

            stage:
              "prod",

            event:
              analyticsEvent(
                config,

                Date.parse(
                  "2026-08-24T01:10:00.000Z"
                )
              ),

            geo:
              geo(),
          });


        expect(
          result
        ).toMatchObject({
          projected:
            true,

          duplicate:
            true,

          usageEpochId:
            open.usageEpochId,
        });
      }
    );
  }
);