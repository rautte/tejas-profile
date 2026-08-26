import {
  marshall,
  unmarshall,
} from "@aws-sdk/util-dynamodb";

import {
  computeDeploymentConfigurationId,
  normalizeAndValidateDeploymentConfigurationDocument,
} from "../lambda/deployment-configuration-contract";

import {
  USAGE_EPOCH_STATE,
  USAGE_EPOCH_TRANSITION_KIND,
  buildActiveUsageEpochPointer,
  createClosingUsageEpochDocument,
  createOpenUsageEpochDocument,
} from "../lambda/usage-epoch-contract";

import {
  USAGE_EPOCH_LIFECYCLE_MODE,
  createUsageEpochStorageRecord,
  createUsageEpochTransactionItems,
  prepareUsageEpochLifecycle,
} from "../lambda/usage-epoch-store";


const TABLE =
  "usage-epoch-test-table";


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
      "2026-08-24T01:00:00.000Z",

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


function existingEpoch(
  deploymentConfiguration:
    any
) {
  return createOpenUsageEpochDocument({
    startedAt:
      "2026-08-24T02:00:00.000Z",

    deploymentConfiguration,

    openedBy: {
      kind:
        USAGE_EPOCH_TRANSITION_KIND
          .PLATFORM_DEPLOYMENT,

      occurrenceId:
        "pdep_existing",
    },
  });
}


describe(
  "Usage Epoch store lifecycle",
  () => {
    test(
      "no effective composition keeps Usage Epoch pointer absent and guards that absence atomically",
      async () => {
        const send =
          jest.fn()
            .mockResolvedValueOnce(
              {}
            );


        const plan =
          await prepareUsageEpochLifecycle({
            client: {
              send,
            },

            tableName:
              TABLE,

            stage:
              "prod",

            currentDeploymentConfigurationId:
              null,

            targetDeploymentConfiguration:
              null,

            transitionAt:
              "2026-08-24T03:00:00.000Z",

            transition: {
              kind:
                USAGE_EPOCH_TRANSITION_KIND
                  .PROFILE_ACTIVATION,

              occurrenceId:
                "act_no_platform",
            },
          });


        expect(
          plan.mode
        ).toBe(
          USAGE_EPOCH_LIFECYCLE_MODE
            .NO_COMPOSITION
        );


        const read =
          send.mock.calls[0][0];


        expect(
          read.input
            .ConsistentRead
        ).toBe(true);


        const items:
          any[] =
          createUsageEpochTransactionItems({
            tableName:
              TABLE,

            plan,
          });


        expect(
          items
        ).toHaveLength(
          1
        );

        expect(
          items[0]
            .ConditionCheck
            .ConditionExpression
        ).toBe(
          "attribute_not_exists(#pk) AND attribute_not_exists(#sk)"
        );
      }
    );


    test(
      "first tracked effective composition opens one deterministic Usage Epoch and revision-one pointer",
      async () => {
        const target =
          configuration({
            platformReleaseId:
              "plr_a",

            profileVariantId:
              "prv_a",
          });


        const send =
          jest.fn()
            .mockResolvedValueOnce(
              {}
            );


        const plan =
          await prepareUsageEpochLifecycle({
            client: {
              send,
            },

            tableName:
              TABLE,

            stage:
              "prod",

            currentDeploymentConfigurationId:
              null,

            targetDeploymentConfiguration:
              target,

            transitionAt:
              "2026-08-24T03:00:00.000Z",

            transition: {
              kind:
                USAGE_EPOCH_TRANSITION_KIND
                  .PLATFORM_DEPLOYMENT,

              occurrenceId:
                "pdep_open",
            },
          });


        expect(
          plan.mode
        ).toBe(
          USAGE_EPOCH_LIFECYCLE_MODE
            .OPEN
        );

        expect(
          plan.openingEpoch
            .state
        ).toBe(
          USAGE_EPOCH_STATE.OPEN
        );

        expect(
          plan.nextPointer
            .revision
        ).toBe(
          1
        );

        expect(
          plan.nextPointer
            .deploymentConfigurationId
        ).toBe(
          target
            .deploymentConfigurationId
        );


        const items:
          any[] =
          createUsageEpochTransactionItems({
            tableName:
              TABLE,

            plan,
          });


        expect(
          items
        ).toHaveLength(
          2
        );


        const epochItem =
          unmarshall(
            items[0]
              .Put
              .Item
          );


        expect(
          epochItem
            .gsi1pk
        ).toBe(
          `CONFIG#${target.deploymentConfigurationId}`
        );

        expect(
          epochItem
            .gsi2pk
        ).toBe(
          "STATE#OPEN"
        );
      }
    );


    test(
      "same effective Deployment Configuration keeps the existing OPEN epoch unchanged",
      async () => {
        const target =
          configuration({
            platformReleaseId:
              "plr_same",

            profileVariantId:
              "prv_same",
          });

        const epoch =
          existingEpoch(
            target
          );

        const pointer =
          buildActiveUsageEpochPointer({
            epoch,
          });


        const send =
          jest.fn()
            .mockResolvedValueOnce({
              Item:
                marshall(
                  pointer
                ),
            })
            .mockResolvedValueOnce({
              Item:
                marshall(
                  createUsageEpochStorageRecord(
                    epoch
                  )
                ),
            });


        const plan =
          await prepareUsageEpochLifecycle({
            client: {
              send,
            },

            tableName:
              TABLE,

            stage:
              "prod",

            currentDeploymentConfigurationId:
              target
                .deploymentConfigurationId,

            targetDeploymentConfiguration:
              target,

            transitionAt:
              "2026-08-24T04:00:00.000Z",

            transition: {
              kind:
                USAGE_EPOCH_TRANSITION_KIND
                  .PROFILE_ACTIVATION,

              occurrenceId:
                "act_same_config",
            },
          });


        expect(
          plan.mode
        ).toBe(
          USAGE_EPOCH_LIFECYCLE_MODE
            .UNCHANGED
        );

        expect(
          plan.openingEpoch
        ).toBeNull();

        expect(
          plan.closingEpoch
        ).toBeNull();


        const items:
          any[] =
          createUsageEpochTransactionItems({
            tableName:
              TABLE,

            plan,
          });


        expect(
          items
        ).toHaveLength(
          1
        );

        expect(
          items[0]
            .ConditionCheck
        ).toBeDefined();

        expect(
          items.some(
            (
              item:
                any
            ) =>
              Boolean(
                item.Put
              )
          )
        ).toBe(false);
      }
    );


    test(
      "configuration change atomically moves old OPEN epoch to CLOSING and opens the new epoch",
      async () => {
        const previous =
          configuration({
            platformReleaseId:
              "plr_old",

            profileVariantId:
              "prv_same",
          });

        const target =
          configuration({
            platformReleaseId:
              "plr_new",

            profileVariantId:
              "prv_same",
          });

        const currentEpoch =
          existingEpoch(
            previous
          );

        const currentPointer =
          buildActiveUsageEpochPointer({
            epoch:
              currentEpoch,
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
              Item:
                marshall(
                  createUsageEpochStorageRecord(
                    currentEpoch
                  )
                ),
            });


        const plan =
          await prepareUsageEpochLifecycle({
            client: {
              send,
            },

            tableName:
              TABLE,

            stage:
              "prod",

            currentDeploymentConfigurationId:
              previous
                .deploymentConfigurationId,

            targetDeploymentConfiguration:
              target,

            transitionAt:
              "2026-08-24T05:00:00.000Z",

            transition: {
              kind:
                USAGE_EPOCH_TRANSITION_KIND
                  .PLATFORM_DEPLOYMENT,

              occurrenceId:
                "pdep_rotate",
            },
          });


        expect(
          plan.mode
        ).toBe(
          USAGE_EPOCH_LIFECYCLE_MODE
            .ROTATE
        );

        expect(
          plan.closingEpoch
            .state
        ).toBe(
          USAGE_EPOCH_STATE.CLOSING
        );

        expect(
          plan.closingEpoch
            .endedAt
        ).toBe(
          "2026-08-24T05:00:00.000Z"
        );

        expect(
          plan.openingEpoch
            .state
        ).toBe(
          USAGE_EPOCH_STATE.OPEN
        );

        expect(
          plan.nextPointer
            .revision
        ).toBe(
          2
        );


        const items:
          any[] =
          createUsageEpochTransactionItems({
            tableName:
              TABLE,

            plan,
          });


        expect(
          items
        ).toHaveLength(
          3
        );


        const closingItem =
          unmarshall(
            items[0]
              .Put
              .Item
          );

        const openingItem =
          unmarshall(
            items[1]
              .Put
              .Item
          );

        const pointerItem =
          unmarshall(
            items[2]
              .Put
              .Item
          );


        expect(
          closingItem.gsi2pk
        ).toBe(
          "STATE#CLOSING"
        );

        expect(
          openingItem.gsi2pk
        ).toBe(
          "STATE#OPEN"
        );

        expect(
          pointerItem
            .deploymentConfigurationId
        ).toBe(
          target
            .deploymentConfigurationId
        );
      }
    );


    test(
      "fails closed when Usage Epoch pointer disagrees with current effective configuration",
      async () => {
        const previous =
          configuration({
            platformReleaseId:
              "plr_pointer",

            profileVariantId:
              "prv_pointer",
          });

        const different =
          configuration({
            platformReleaseId:
              "plr_other",

            profileVariantId:
              "prv_pointer",
          });

        const epoch =
          existingEpoch(
            previous
          );

        const pointer =
          buildActiveUsageEpochPointer({
            epoch,
          });


        const send =
          jest.fn()
            .mockResolvedValueOnce({
              Item:
                marshall(
                  pointer
                ),
            });


        await expect(
          prepareUsageEpochLifecycle({
            client: {
              send,
            },

            tableName:
              TABLE,

            stage:
              "prod",

            currentDeploymentConfigurationId:
              different
                .deploymentConfigurationId,

            targetDeploymentConfiguration:
              different,

            transitionAt:
              "2026-08-24T06:00:00.000Z",

            transition: {
              kind:
                USAGE_EPOCH_TRANSITION_KIND
                  .PLATFORM_DEPLOYMENT,

              occurrenceId:
                "pdep_mismatch",
            },
          })
        ).rejects.toThrow(
          /current effective Deployment Configuration/
        );
      }
    );


    test(
      "fails closed when ACTIVE pointer references a non-OPEN epoch",
      async () => {
        const target =
          configuration({
            platformReleaseId:
              "plr_closing",

            profileVariantId:
              "prv_closing",
          });

        const openEpoch =
          existingEpoch(
            target
          );

        const pointer =
          buildActiveUsageEpochPointer({
            epoch:
              openEpoch,
          });

        const closingEpoch =
          createClosingUsageEpochDocument({
            epoch:
              openEpoch,

            endedAt:
              "2026-08-24T07:00:00.000Z",

            closedBy: {
              kind:
                USAGE_EPOCH_TRANSITION_KIND
                  .PROFILE_ACTIVATION,

              occurrenceId:
                "act_closing",
            },
          });


        const send =
          jest.fn()
            .mockResolvedValueOnce({
              Item:
                marshall(
                  pointer
                ),
            })
            .mockResolvedValueOnce({
              Item:
                marshall(
                  createUsageEpochStorageRecord(
                    closingEpoch
                  )
                ),
            });


        await expect(
          prepareUsageEpochLifecycle({
            client: {
              send,
            },

            tableName:
              TABLE,

            stage:
              "prod",

            currentDeploymentConfigurationId:
              target
                .deploymentConfigurationId,

            targetDeploymentConfiguration:
              target,

            transitionAt:
              "2026-08-24T08:00:00.000Z",

            transition: {
              kind:
                USAGE_EPOCH_TRANSITION_KIND
                  .PROFILE_ACTIVATION,

              occurrenceId:
                "act_after_closing",
            },
          })
        ).rejects.toThrow(
          /OPEN Usage Epoch/
        );
      }
    );
  }
);