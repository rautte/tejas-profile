// infra/cdk/test/deployment-configuration-contract.test.ts

import {
  computeProfileVariantContentHash,
  normalizeAndValidateProfileVariantDocument,
} from "../lambda/profile-variants-contract";

import {
  createPlatformReleaseDocument,
} from "../lambda/platform-release-contract";

import {
  computeDeploymentConfigurationId,
  createDeploymentConfigurationDocument,
  createDeploymentConfigurationObjectKey,
  normalizeAndValidateDeploymentConfigurationDocument,
} from "../lambda/deployment-configuration-contract";


function profileContent() {
  return {
    hero:
      {},

    aboutMe:
      {},

    experience:
      [],

    education:
      [],

    skills:
      [],

    resume:
      {},

    projects:
      [],

    codeLab:
      [],

    funZone:
      {},

    timeline:
      [],

    contactLinks:
      [],
  };
}


function validVariant(
  profileVariantId =
    "prv_austin_backend_001"
) {
  const variant:
    any = {
      schema:
        "tejas-profile.profile-variant",

      schemaId:
        "tejas-profile.profile-variant.v1",

      contentSchemaVersion:
        1,

      profileVariantId,

      contentHash:
        "",

      createdAt:
        "2026-08-23T02:00:00.000Z",

      targeting: {
        location:
          "Austin",

        jobRole:
          "Backend Engineer",
      },

      provenance: {
        gitSha:
          "1".repeat(
            40
          ),
      },

      content:
        profileContent(),

      assets:
        [],
    };


  variant.contentHash =
    computeProfileVariantContentHash(
      variant
    );


  return normalizeAndValidateProfileVariantDocument(
    variant
  );
}


function validRelease({
  platformReleaseId =
    "plr_platform_001",

  stage =
    "prod",
}: {
  platformReleaseId?:
    string;

  stage?:
    "dev" |
    "prod";
} = {}) {
  return createPlatformReleaseDocument({
    platformReleaseId,

    stage,

    createdAt:
      "2026-08-23T01:00:00.000Z",

    source: {
      repository:
        "rautte/tejas-profile",

      gitSha:
        "2".repeat(
          40
        ),

      gitRef:
        "refs/heads/main",

      checkpointTag:
        "checkpoint-test",
    },

    build: {
      buildTime:
        "2026-08-23T00:59:00.000Z",

      frontendArtifactSha256:
        "a".repeat(
          64
        ),

      githubRunId:
        "12345",

      repoArtifactKey:
        "profiles/legacy/repo/test.zip",

      repoArtifactSha256:
        "b".repeat(
          64
        ),

      diffFiles: {
        infra:
          [],

        data:
          [],

        uiux:
          [],

        githubWorkflow:
          [],
      },

      diffTagValue:
        "none",
    },

    legacy: {
      profileVersionId:
        "pv_1234567",
    },
  });
}


function validConfiguration({
  platformReleaseId =
    "plr_platform_001",

  profileVariantId =
    "prv_austin_backend_001",

  stage =
    "prod",

  createdAt =
    "2026-08-23T03:00:00.000Z",
}: {
  platformReleaseId?:
    string;

  profileVariantId?:
    string;

  stage?:
    "dev" |
    "prod";

  createdAt?:
    string;
} = {}) {
  return createDeploymentConfigurationDocument({
    stage,

    createdAt,

    platformRelease:
      validRelease({
        platformReleaseId,

        stage,
      }),

    profileVariant:
      validVariant(
        profileVariantId
      ),
  });
}


describe(
  "Deployment Configuration contract",
  () => {
    test(
      "builds one immutable self-describing Platform Release + Profile Variant composition",
      () => {
        const config =
          validConfiguration();


        expect(
          config
        ).toMatchObject({
          schema:
            "tejas-profile.deployment-configuration",

          schemaId:
            "tejas-profile.deployment-configuration.v1",

          stage:
            "prod",

          platformReleaseId:
            "plr_platform_001",

          profileVariantId:
            "prv_austin_backend_001",

          profile: {
            contentSchemaVersion:
              1,

            targeting: {
              location:
                "Austin",

              jobRole:
                "Backend Engineer",
            },
          },
        });


        expect(
          config
            .profile
            .contentHash
        ).toMatch(
          /^[a-f0-9]{64}$/
        );


        expect(
          config
            .deploymentConfigurationId
        ).toMatch(
          /^cfg_[a-f0-9]{64}$/
        );
      }
    );


    test(
      "the exact same stage + Platform Release + Profile Variant always resolves to the same configuration identity",
      () => {
        const first =
          validConfiguration({
            createdAt:
              "2026-08-23T03:00:00.000Z",
          });

        const second =
          validConfiguration({
            createdAt:
              "2026-09-01T10:00:00.000Z",
          });


        expect(
          first
            .deploymentConfigurationId
        ).toBe(
          second
            .deploymentConfigurationId
        );


        expect(
          first.createdAt
        ).not.toBe(
          second.createdAt
        );
      }
    );


    test(
      "changing Platform Release creates a different configuration identity",
      () => {
        const first =
          validConfiguration({
            platformReleaseId:
              "plr_platform_001",
          });

        const second =
          validConfiguration({
            platformReleaseId:
              "plr_platform_002",
          });


        expect(
          first
            .deploymentConfigurationId
        ).not.toBe(
          second
            .deploymentConfigurationId
        );
      }
    );


    test(
      "changing Profile Variant creates a different configuration identity",
      () => {
        const first =
          validConfiguration({
            profileVariantId:
              "prv_austin_backend_001",
          });

        const second =
          validConfiguration({
            profileVariantId:
              "prv_austin_backend_002",
          });


        expect(
          first
            .deploymentConfigurationId
        ).not.toBe(
          second
            .deploymentConfigurationId
        );
      }
    );


    test(
      "DEV and PROD compositions are separate identities",
      () => {
        const devId =
          computeDeploymentConfigurationId({
            stage:
              "dev",

            platformReleaseId:
              "plr_same",

            profileVariantId:
              "prv_same",
          });

        const prodId =
          computeDeploymentConfigurationId({
            stage:
              "prod",

            platformReleaseId:
              "plr_same",

            profileVariantId:
              "prv_same",
          });


        expect(
          devId
        ).not.toBe(
          prodId
        );
      }
    );


    test(
      "rejects a deploymentConfigurationId that does not match its immutable composition",
      () => {
        const config =
          validConfiguration();


        expect(
          () =>
            normalizeAndValidateDeploymentConfigurationDocument({
              ...config,

              deploymentConfigurationId:
                "cfg_fake",
            })
        ).toThrow(
          /deploymentConfigurationId must be/
        );
      }
    );


    test(
      "compatibility, activation and usage state are intentionally not part of Deployment Configuration",
      () => {
        const config =
          validConfiguration();


        for (
          const field of [
            "compatibility",
            "active",
            "usageEpochId",
          ]
        ) {
          expect(
            () =>
              normalizeAndValidateDeploymentConfigurationDocument({
                ...config,

                [field]:
                  {},
              })
          ).toThrow(
            new RegExp(
              `Deployment Configuration\\.${field} is not supported`
            )
          );
        }
      }
    );


    test(
      "builder rejects a Platform Release from another stage",
      () => {
        expect(
          () =>
            createDeploymentConfigurationDocument({
              stage:
                "prod",

              createdAt:
                "2026-08-23T03:00:00.000Z",

              platformRelease:
                validRelease({
                  platformReleaseId:
                    "plr_dev",

                  stage:
                    "dev",
                }),

              profileVariant:
                validVariant(),
            })
        ).toThrow(
          /does not match Deployment Configuration stage/
        );
      }
    );


    test(
      "configuration object keys are deterministic and reject unsafe IDs",
      () => {
        const config =
          validConfiguration();


        expect(
          createDeploymentConfigurationObjectKey(
            config
              .deploymentConfigurationId
          )
        ).toBe(
          `configurations/${config.deploymentConfigurationId}.json`
        );


        expect(
          () =>
            createDeploymentConfigurationObjectKey(
              "../bad"
            )
        ).toThrow(
          /deploymentConfigurationId is invalid/
        );
      }
    );


    test(
      "self-describing Profile metadata remains structurally strict",
      () => {
        const config =
          validConfiguration();


        expect(
          () =>
            normalizeAndValidateDeploymentConfigurationDocument({
              ...config,

              profile: {
                ...config.profile,

                contentHash:
                  "bad",
              },
            })
        ).toThrow(
          /64-character SHA-256/
        );


        expect(
          () =>
            normalizeAndValidateDeploymentConfigurationDocument({
              ...config,

              profile: {
                ...config.profile,

                targeting: {
                  ...config
                    .profile
                    .targeting,

                  location:
                    " Austin ",
                },
              },
            })
        ).toThrow(
          /location must be trimmed/
        );
      }
    );
  }
);