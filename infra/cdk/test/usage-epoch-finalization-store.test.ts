import {
  QueryCommand,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";

import {
  marshall,
} from "@aws-sdk/util-dynamodb";

import {
  computeDeploymentConfigurationId,
  normalizeAndValidateDeploymentConfigurationDocument,
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
  UsageEpochFinalizationConflictError,
  finalizeUsageEpochRecord,
  listSettledClosingUsageEpochIds,
} from "../lambda/usage-epoch-finalization-store";


const TABLE =
  "usage-epoch-finalization-test";


function configuration() {
  const stage =
    "prod" as const;

  const platformReleaseId =
    "plr_finalization";

  const profileVariantId =
    "prv_finalization";

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
          "pdep_finalization",
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
        "act_finalization_close",
    },
  });
}


function conditionalConflict() {
  const error:
    any =
      new Error(
        "Conditional conflict"
      );

  error.name =
    "ConditionalCheckFailedException";

  return error;
}


describe(
  "Usage Epoch finalization store",
  () => {
    test(
      "discovers settled CLOSING epochs through ByState without scanning",
      async () => {
        const epoch =
          closingEpoch();

        const send =
          jest.fn()
            .mockResolvedValue({
              Items: [
                marshall({
                  usageEpochId:
                    epoch.usageEpochId,
                }),
              ],
            });


        const ids =
          await listSettledClosingUsageEpochIds({
            client: {
              send,
            },

            tableName:
              TABLE,

            cutoffIso:
              "2026-08-20T02:00:00.000Z",

            limit:
              10,
          });


        expect(
          ids
        ).toEqual([
          epoch.usageEpochId,
        ]);


        const command =
          send.mock.calls[0][0];


        expect(
          command
        ).toBeInstanceOf(
          QueryCommand
        );

        expect(
          command.input
            .IndexName
        ).toBe(
          "ByState"
        );

        expect(
          command.input
            .ScanIndexForward
        ).toBe(true);

        expect(
          command.input
            .Limit
        ).toBe(
          10
        );
      }
    );


    test(
      "conditionally commits CLOSING to CLOSED without replacing immutable epoch identity",
      async () => {
        const epoch =
          closingEpoch();

        const send =
          jest.fn()
            .mockResolvedValue(
              {}
            );


        const result =
          await finalizeUsageEpochRecord({
            client: {
              send,
            },

            tableName:
              TABLE,

            epoch,

            reportId:
              `car_${"b".repeat(
                64
              )}`,

            reportSha256:
              "c".repeat(
                64
              ),

            finalizedAt:
              "2026-08-21T02:00:00.000Z",
          });


        expect(
          result
            .alreadyFinalized
        ).toBe(false);

        expect(
          result
            .epoch
            .state
        ).toBe(
          USAGE_EPOCH_STATE
            .CLOSED
        );


        const command =
          send.mock.calls[0][0];


        expect(
          command
        ).toBeInstanceOf(
          UpdateItemCommand
        );

        expect(
          command.input
            .UpdateExpression
        ).toContain(
          "#report = :report"
        );

        expect(
          command.input
            .ConditionExpression
        ).toContain(
          "#state = :expectedState"
        );

        expect(
          command.input
            .ConditionExpression
        ).toContain(
          "#gsi2sk = :expectedGsi2sk"
        );
      }
    );


    test(
      "a concurrent identical CLOSED winner is an idempotent success",
      async () => {
        const epoch =
          closingEpoch();

        const reportId =
          `car_${"d".repeat(
            64
          )}`;

        const reportSha256 =
          "e".repeat(
            64
          );

        const closed =
          finalizeUsageEpochDocument({
            epoch,

            reportId,

            reportSha256,

            finalizedAt:
              "2026-08-21T02:00:00.000Z",
          });


        const send =
          jest.fn()
            .mockRejectedValueOnce(
              conditionalConflict()
            )
            .mockResolvedValueOnce({
              Item:
                marshall(
                  createUsageEpochStorageRecord(
                    closed
                  )
                ),
            });


        const result =
          await finalizeUsageEpochRecord({
            client: {
              send,
            },

            tableName:
              TABLE,

            epoch,

            reportId,

            reportSha256,

            finalizedAt:
              "2026-08-21T02:01:00.000Z",
          });


        expect(
          result
            .alreadyFinalized
        ).toBe(true);

        expect(
          result
            .epoch
            .report
            ?.reportId
        ).toBe(
          reportId
        );
      }
    );


    test(
      "a concurrent different CLOSED report is a hard conflict",
      async () => {
        const epoch =
          closingEpoch();

        const winner =
          finalizeUsageEpochDocument({
            epoch,

            reportId:
              "car_winner",

            reportSha256:
              "a".repeat(
                64
              ),

            finalizedAt:
              "2026-08-21T02:00:00.000Z",
          });


        const send =
          jest.fn()
            .mockRejectedValueOnce(
              conditionalConflict()
            )
            .mockResolvedValueOnce({
              Item:
                marshall(
                  createUsageEpochStorageRecord(
                    winner
                  )
                ),
            });


        await expect(
          finalizeUsageEpochRecord({
            client: {
              send,
            },

            tableName:
              TABLE,

            epoch,

            reportId:
              "car_expected",

            reportSha256:
              "b".repeat(
                64
              ),

            finalizedAt:
              "2026-08-21T02:01:00.000Z",
          })
        ).rejects.toBeInstanceOf(
          UsageEpochFinalizationConflictError
        );
      }
    );
  }
);