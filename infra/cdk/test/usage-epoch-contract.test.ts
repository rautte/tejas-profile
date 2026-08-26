import {
  computeDeploymentConfigurationId,
} from "../lambda/deployment-configuration-contract";

import {
  USAGE_EPOCH_DOCUMENT_SCHEMA,
  USAGE_EPOCH_SCHEMA_ID_V1,
  USAGE_EPOCH_STATE,
  USAGE_EPOCH_TRANSITION_KIND,
  computeUsageEpochId,
  createClosingUsageEpochDocument,
  createOpenUsageEpochDocument,
  finalizeUsageEpochDocument,
  normalizeAndValidateUsageEpochDocument,
  ACTIVE_USAGE_EPOCH_POINTER_DOCUMENT_SCHEMA,
  USAGE_EPOCH_ACTIVE_SK,
  USAGE_EPOCH_CONTROL_PK,
  buildActiveUsageEpochPointer,
  validateActiveUsageEpochPointer,
} from "../lambda/usage-epoch-contract";


function configuration({
  stage =
    "prod",

  platformReleaseId =
    "plr_usage_epoch_001",

  profileVariantId =
    "prv_usage_epoch_001",
}: {
  stage?:
    | "dev"
    | "prod";

  platformReleaseId?:
    string;

  profileVariantId?:
    string;
} = {}) {
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


function openEpoch() {
  return createOpenUsageEpochDocument({
    startedAt:
      "2026-08-24T01:00:00.000Z",

    deploymentConfiguration:
      configuration(),

    openedBy: {
      kind:
        USAGE_EPOCH_TRANSITION_KIND
          .PLATFORM_DEPLOYMENT,

      occurrenceId:
        "pdep_usage_epoch_001",
    },
  });
}


describe(
  "Usage Epoch contract",
  () => {
    test(
      "builds one OPEN self-describing Usage Epoch from an authoritative Deployment Configuration",
      () => {
        const epoch =
          openEpoch();


        expect(
          epoch
        ).toMatchObject({
          schema:
            USAGE_EPOCH_DOCUMENT_SCHEMA,

          schemaId:
            USAGE_EPOCH_SCHEMA_ID_V1,

          stage:
            "prod",

          platformReleaseId:
            "plr_usage_epoch_001",

          profileVariantId:
            "prv_usage_epoch_001",

          state:
            USAGE_EPOCH_STATE.OPEN,

          endedAt:
            null,

          report:
            null,

          openedBy: {
            kind:
              "platform_deployment",

            occurrenceId:
              "pdep_usage_epoch_001",
          },
        });


        expect(
          epoch
            .usageEpochId
        ).toMatch(
          /^uep_[a-f0-9]{64}$/
        );
      }
    );


    test(
      "same configuration and opening occurrence always produce the same Usage Epoch identity",
      () => {
        const config =
          configuration();

        const openedBy = {
          kind:
            USAGE_EPOCH_TRANSITION_KIND
              .PLATFORM_DEPLOYMENT,

          occurrenceId:
            "pdep_stable",
        };


        const first =
          createOpenUsageEpochDocument({
            startedAt:
              "2026-08-24T01:00:00.000Z",

            deploymentConfiguration:
              config,

            openedBy,
          });

        const retry =
          createOpenUsageEpochDocument({
            startedAt:
              "2026-08-24T01:00:01.000Z",

            deploymentConfiguration:
              config,

            openedBy,
          });


        expect(
          retry
            .usageEpochId
        ).toBe(
          first
            .usageEpochId
        );
      }
    );


    test(
      "different configuration or opening occurrence creates a different Usage Epoch identity",
      () => {
        const first =
          openEpoch();

        const otherOccurrence =
          createOpenUsageEpochDocument({
            startedAt:
              "2026-08-24T02:00:00.000Z",

            deploymentConfiguration:
              configuration(),

            openedBy: {
              kind:
                USAGE_EPOCH_TRANSITION_KIND
                  .PLATFORM_DEPLOYMENT,

              occurrenceId:
                "pdep_usage_epoch_002",
            },
          });

        const otherConfiguration =
          createOpenUsageEpochDocument({
            startedAt:
              "2026-08-24T03:00:00.000Z",

            deploymentConfiguration:
              configuration({
                profileVariantId:
                  "prv_usage_epoch_002",
              }),

            openedBy: {
              kind:
                USAGE_EPOCH_TRANSITION_KIND
                  .PROFILE_ACTIVATION,

              occurrenceId:
                "act_usage_epoch_002",
            },
          });


        expect(
          otherOccurrence
            .usageEpochId
        ).not.toBe(
          first
            .usageEpochId
        );

        expect(
          otherConfiguration
            .usageEpochId
        ).not.toBe(
          first
            .usageEpochId
        );
      }
    );


    test(
      "OPEN transitions to CLOSING with a half-open end boundary",
      () => {
        const closing =
          createClosingUsageEpochDocument({
            epoch:
              openEpoch(),

            endedAt:
              "2026-08-24T02:00:00.000Z",

            closedBy: {
              kind:
                USAGE_EPOCH_TRANSITION_KIND
                  .PROFILE_ACTIVATION,

              occurrenceId:
                "act_close_epoch",
            },
          });


        expect(
          closing.state
        ).toBe(
          USAGE_EPOCH_STATE
            .CLOSING
        );

        expect(
          closing.endedAt
        ).toBe(
          "2026-08-24T02:00:00.000Z"
        );

        expect(
          closing.report
        ).toBeNull();
      }
    );


    test(
      "CLOSING transitions to CLOSED only with immutable report evidence",
      () => {
        const closing =
          createClosingUsageEpochDocument({
            epoch:
              openEpoch(),

            endedAt:
              "2026-08-24T02:00:00.000Z",

            closedBy: {
              kind:
                USAGE_EPOCH_TRANSITION_KIND
                  .PROFILE_ACTIVATION,

              occurrenceId:
                "act_close_epoch",
            },
          });


        const closed =
          finalizeUsageEpochDocument({
            epoch:
              closing,

            reportId:
              "car_usage_epoch_001",

            reportSha256:
              "b".repeat(
                64
              ),

            finalizedAt:
              "2026-08-24T02:05:00.000Z",
          });


        expect(
          closed
        ).toMatchObject({
          state:
            USAGE_EPOCH_STATE
              .CLOSED,

          report: {
            reportId:
              "car_usage_epoch_001",

            reportSha256:
              "b".repeat(
                64
              ),

            finalizedAt:
              "2026-08-24T02:05:00.000Z",
          },
        });
      }
    );


    test(
      "invalid lifecycle combinations fail closed",
      () => {
        const epoch =
          openEpoch();


        expect(
          () =>
            normalizeAndValidateUsageEpochDocument({
              ...epoch,

              state:
                USAGE_EPOCH_STATE
                  .OPEN,

              endedAt:
                "2026-08-24T02:00:00.000Z",
            })
        ).toThrow(
          "OPEN Usage Epoch cannot"
        );


        expect(
          () =>
            createClosingUsageEpochDocument({
              epoch,

              endedAt:
                "2026-08-23T23:00:00.000Z",

              closedBy: {
                kind:
                  USAGE_EPOCH_TRANSITION_KIND
                    .PROFILE_ACTIVATION,

                occurrenceId:
                  "act_invalid_time",
              },
            })
        ).toThrow(
          "endedAt cannot precede startedAt"
        );
      }
    );


    test(
      "identity and unknown-field tampering fail closed",
      () => {
        const epoch =
          openEpoch();


        expect(
          () =>
            normalizeAndValidateUsageEpochDocument({
              ...epoch,

              usageEpochId:
                computeUsageEpochId({
                  stage:
                    "prod",

                  deploymentConfigurationId:
                    epoch
                      .deploymentConfigurationId,

                  openedBy: {
                    kind:
                      USAGE_EPOCH_TRANSITION_KIND
                        .PROFILE_ACTIVATION,

                    occurrenceId:
                      "act_other",
                  },
                }),
            })
        ).toThrow(
          "usageEpochId must be"
        );


        expect(
          () =>
            normalizeAndValidateUsageEpochDocument({
              ...epoch,

              invented:
                true,
            })
        ).toThrow(
          "Usage Epoch.invented is not supported"
        );
      }
    );

    test(
      "builds revision-one Active Usage Epoch pointer from an OPEN epoch",
      () => {
        const deploymentConfiguration =
          configuration();

        const epoch =
          createOpenUsageEpochDocument({
            startedAt:
              "2026-08-24T10:00:00.000Z",

            deploymentConfiguration,

            openedBy: {
              kind:
                USAGE_EPOCH_TRANSITION_KIND
                  .PLATFORM_DEPLOYMENT,

              occurrenceId:
                "pdep_pointer",
            },
          });


        const pointer =
          buildActiveUsageEpochPointer({
            epoch,
          });


        expect(
          pointer
        ).toEqual(
          expect.objectContaining({
            pk:
              USAGE_EPOCH_CONTROL_PK,

            sk:
              USAGE_EPOCH_ACTIVE_SK,

            schema:
              ACTIVE_USAGE_EPOCH_POINTER_DOCUMENT_SCHEMA,

            revision:
              1,

            usageEpochId:
              epoch.usageEpochId,

            deploymentConfigurationId:
              deploymentConfiguration
                .deploymentConfigurationId,
          })
        );


        expect(
          validateActiveUsageEpochPointer(
            pointer
          )
        ).toBe(true);
      }
    );


    test(
      "Active Usage Epoch pointer cannot reference a CLOSING epoch",
      () => {
        const deploymentConfiguration =
          configuration();

        const open =
          createOpenUsageEpochDocument({
            startedAt:
              "2026-08-24T10:00:00.000Z",

            deploymentConfiguration,

            openedBy: {
              kind:
                USAGE_EPOCH_TRANSITION_KIND
                  .PLATFORM_DEPLOYMENT,

              occurrenceId:
                "pdep_pointer_open",
            },
          });

        const closing =
          createClosingUsageEpochDocument({
            epoch:
              open,

            endedAt:
              "2026-08-24T11:00:00.000Z",

            closedBy: {
              kind:
                USAGE_EPOCH_TRANSITION_KIND
                  .PROFILE_ACTIVATION,

              occurrenceId:
                "act_pointer_close",
            },
          });


        expect(
          () =>
            buildActiveUsageEpochPointer({
              epoch:
                closing,
            })
        ).toThrow(
          /OPEN Usage Epoch/
        );
      }
    );

  }
);