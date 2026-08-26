import {
  createDeploymentConfigurationDocument,
} from "../lambda/deployment-configuration-contract";

import {
  createPlatformReleaseDocument,
  createPlatformReleaseDocumentV2,
} from "../lambda/platform-release-contract";

import {
  computeProfileVariantContentHash,
  normalizeAndValidateProfileVariantDocument,
} from "../lambda/profile-variants-contract";

import {
  assertDeclaredProfilePlatformCompatible,
  assertProfilePlatformCompatible,
  evaluateProfilePlatformCompatibility,
  isProfilePlatformCompatibilityError,
  isProfilePlatformCompatibilityGateError,
  isProfilePlatformPolicyError,
  PROFILE_PLATFORM_COMPATIBILITY_REASON_CODES,
  PROFILE_PLATFORM_COMPATIBILITY_SCHEMA_ID_V1,
  PROFILE_PLATFORM_POLICY_ERROR_CODES,
  PROFILE_PLATFORM_SPECIFICATION_SCHEMA_ID_V1,
requireDeclaredProfilePlatformSpecification,
  PROFILE_PLATFORM_SPECIFICATION_VERSION_V1,
  PPS_V1_SUPPORTED_PROFILE_CONTENT_SCHEMA_VERSIONS,
} from "../lambda/profile-platform-specification";


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
    "prv_pps_001"
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
      "2026-08-24T01:00:00.000Z",

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
    "plr_pps_001",

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
      "2026-08-24T00:55:00.000Z",

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
        "checkpoint-pps",
    },

    build: {
      buildTime:
        "2026-08-24T00:54:00.000Z",

      frontendArtifactSha256:
        "a".repeat(
          64
        ),

      githubRunId:
        "12345",

      repoArtifactKey:
        "profiles/legacy/repo/pps.zip",

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
        "pv_pps",
    },
  });
}

function validReleaseV2({
  platformReleaseId =
    "plr_pps_v2_001",

  stage =
    "prod",

  ppsVersion =
    1,
}: {
  platformReleaseId?:
    string;

  stage?:
    "dev" |
    "prod";

  ppsVersion?:
    number;
} = {}) {
  const base =
    validRelease({
      platformReleaseId,

      stage,
    });


  return createPlatformReleaseDocumentV2({
    platformReleaseId:
      base.platformReleaseId,

    stage:
      base.stage,

    createdAt:
      base.createdAt,

    source:
      base.source,

    build:
      base.build,

    profileRuntime: {
      ppsVersion,
    },

    legacy:
      base.legacy,
  });
}


function validConfiguration({
  release =
    validRelease(),

  variant =
    validVariant(),
}: {
  release?:
    any;

  variant?:
    any;
} = {}) {
  return createDeploymentConfigurationDocument({
    stage:
      release.stage,

    createdAt:
      "2026-08-24T01:05:00.000Z",

    platformRelease:
      release,

    profileVariant:
      variant,
  });
}


describe(
  "Profile Platform Specification v1",
  () => {
    test(
      "locks PPS v1 to Profile content schema version 1",
      () => {
        expect(
          PROFILE_PLATFORM_SPECIFICATION_VERSION_V1
        ).toBe(
          1
        );


        expect(
          PROFILE_PLATFORM_SPECIFICATION_SCHEMA_ID_V1
        ).toBe(
          "tejas-profile.profile-platform-specification.v1"
        );


        expect(
          [
            ...PPS_V1_SUPPORTED_PROFILE_CONTENT_SCHEMA_VERSIONS,
          ]
        ).toEqual([
          1,
        ]);
      }
    );


    test(
      "returns a deterministic compatible result for a PPS v1 composition",
      () => {
        const release =
          validRelease();

        const configuration =
          validConfiguration({
            release,
          });


        const first =
          evaluateProfilePlatformCompatibility({
            specificationVersion:
              1,

            platformRelease:
              release,

            deploymentConfiguration:
              configuration,
          });


        const second =
          evaluateProfilePlatformCompatibility({
            specificationVersion:
              1,

            platformRelease:
              release,

            deploymentConfiguration:
              configuration,
          });


        expect(
          first
        ).toEqual(
          second
        );


        expect(
          first
        ).toMatchObject({
          schemaId:
            PROFILE_PLATFORM_COMPATIBILITY_SCHEMA_ID_V1,

          specification: {
            version:
              1,
          },

          deploymentConfigurationId:
            configuration
              .deploymentConfigurationId,

          platformReleaseId:
            release
              .platformReleaseId,

          profileVariantId:
            configuration
              .profileVariantId,

          compatible:
            true,

          reasons:
            [],

          evidence: {
            stage:
              "prod",

            contentSchemaVersion:
              1,
          },
        });


        expect(
          first
            .compatibilityId
        ).toMatch(
          /^ppsc_[a-f0-9]{64}$/
        );
      }
    );


    test(
      "rejects an unsupported Profile content schema as incompatible rather than corrupt",
      () => {
        const release =
          validRelease();

        const configuration:
          any =
            validConfiguration({
              release,
            });


        configuration.profile =
          {
            ...configuration.profile,

            contentSchemaVersion:
              2,
          };


        const result =
          evaluateProfilePlatformCompatibility({
            specificationVersion:
              1,

            platformRelease:
              release,

            deploymentConfiguration:
              configuration,
          });


        expect(
          result.compatible
        ).toBe(
          false
        );


        expect(
          result.reasons
        ).toEqual([
          {
            code:
              PROFILE_PLATFORM_COMPATIBILITY_REASON_CODES
                .UNSUPPORTED_PROFILE_CONTENT_SCHEMA_VERSION,

            actualContentSchemaVersion:
              2,

            supportedContentSchemaVersions: [
              1,
            ],
          },
        ]);
      }
    );


    test(
      "different compatibility-relevant evidence produces a different compatibility identity",
      () => {
        const release =
          validRelease();

        const configuration:
          any =
            validConfiguration({
              release,
            });


        const compatible =
          evaluateProfilePlatformCompatibility({
            specificationVersion:
              1,

            platformRelease:
              release,

            deploymentConfiguration:
              configuration,
          });


        const changed:
          any =
            {
              ...configuration,

              profile: {
                ...configuration.profile,

                contentSchemaVersion:
                  2,
              },
            };


        const incompatible =
          evaluateProfilePlatformCompatibility({
            specificationVersion:
              1,

            platformRelease:
              release,

            deploymentConfiguration:
              changed,
          });


        expect(
          compatible
            .compatibilityId
        ).not.toBe(
          incompatible
            .compatibilityId
        );
      }
    );


    test(
      "throws when Deployment Configuration belongs to a different Platform Release",
      () => {
        const release =
          validRelease({
            platformReleaseId:
              "plr_pps_expected",
          });

        const otherRelease =
          validRelease({
            platformReleaseId:
              "plr_pps_other",
          });

        const configuration =
          validConfiguration({
            release:
              otherRelease,
          });


        expect(
          () =>
            evaluateProfilePlatformCompatibility({
              specificationVersion:
                1,

              platformRelease:
                release,

              deploymentConfiguration:
                configuration,
            })
        ).toThrow(
          /Platform Release does not match/
        );
      }
    );


    test(
      "throws when Deployment Configuration stage does not match Platform Release stage",
      () => {
        const prodRelease =
          validRelease({
            platformReleaseId:
              "plr_pps_stage",

            stage:
              "prod",
          });

        const devRelease =
          validRelease({
            platformReleaseId:
              "plr_pps_stage",

            stage:
              "dev",
          });

        const configuration =
          validConfiguration({
            release:
              devRelease,
          });


        expect(
          () =>
            evaluateProfilePlatformCompatibility({
              specificationVersion:
                1,

              platformRelease:
                prodRelease,

              deploymentConfiguration:
                configuration,
            })
        ).toThrow(
          /stage does not match/
        );
      }
    );


    test(
      "fails closed for an unknown PPS version",
      () => {
        const release =
          validRelease();

        const configuration =
          validConfiguration({
            release,
          });


        expect(
          () =>
            evaluateProfilePlatformCompatibility({
              specificationVersion:
                2,

              platformRelease:
                release,

              deploymentConfiguration:
                configuration,
            })
        ).toThrow(
          /Unsupported Profile Platform Specification version/
        );
      }
    );


    test(
      "assert helper exposes a typed incompatibility result",
      () => {
        const release =
          validRelease();

        const configuration:
          any =
            validConfiguration({
              release,
            });


        configuration.profile =
          {
            ...configuration.profile,

            contentSchemaVersion:
              2,
          };


        try {
          assertProfilePlatformCompatible({
            specificationVersion:
              1,

            platformRelease:
              release,

            deploymentConfiguration:
              configuration,
          });


          throw new Error(
            "Expected incompatibility."
          );
        } catch (
          error:
            any
        ) {
          expect(
            isProfilePlatformCompatibilityError(
              error
            )
          ).toBe(
            true
          );


          expect(
            error.code
          ).toBe(
            "PPS_INCOMPATIBLE"
          );


          expect(
            error
              .compatibility
              .compatible
          ).toBe(
            false
          );
        }
      }
    );

    test(
      "declared operational gate accepts an explicitly PPS-qualified v2 release",
      () => {
        const release =
          validReleaseV2();

        const configuration =
          validConfiguration({
            release,
          });


        const result =
          assertDeclaredProfilePlatformCompatible({
            platformRelease:
              release,

            deploymentConfiguration:
              configuration,
          });


        expect(
          result.compatible
        ).toBe(
          true
        );


        expect(
          result
            .specification
            .version
        ).toBe(
          1
        );
      }
    );


    test(
      "declared operational gate rejects historical Platform Release v1 as unqualified",
      () => {
        const release =
          validRelease();

        const configuration =
          validConfiguration({
            release,
          });


        try {
          assertDeclaredProfilePlatformCompatible({
            platformRelease:
              release,

            deploymentConfiguration:
              configuration,
          });


          throw new Error(
            "Expected PPS declaration rejection."
          );
        } catch (
          error: any
        ) {
          expect(
            isProfilePlatformPolicyError(
              error
            )
          ).toBe(
            true
          );


          expect(
            isProfilePlatformCompatibilityGateError(
              error
            )
          ).toBe(
            true
          );


          expect(
            error.code
          ).toBe(
            PROFILE_PLATFORM_POLICY_ERROR_CODES
              .DECLARATION_REQUIRED
          );
        }
      }
    );


    test(
      "declared operational gate fails closed for a future unsupported PPS declaration",
      () => {
        const release =
          validReleaseV2({
            platformReleaseId:
              "plr_pps_future",

            ppsVersion:
              2,
          });

        const configuration =
          validConfiguration({
            release,
          });


        try {
          assertDeclaredProfilePlatformCompatible({
            platformRelease:
              release,

            deploymentConfiguration:
              configuration,
          });


          throw new Error(
            "Expected unsupported PPS rejection."
          );
        } catch (
          error: any
        ) {
          expect(
            isProfilePlatformPolicyError(
              error
            )
          ).toBe(
            true
          );


          expect(
            error.code
          ).toBe(
            PROFILE_PLATFORM_POLICY_ERROR_CODES
              .VERSION_UNSUPPORTED
          );


          expect(
            error
              .declaredPpsVersion
          ).toBe(
            2
          );
        }
      }
    );


    test(
      "declared gate classifier recognizes deterministic PPS incompatibility",
      () => {
        const release =
          validReleaseV2();

        const configuration:
          any =
            validConfiguration({
              release,
            });


        configuration.profile =
          {
            ...configuration.profile,

            contentSchemaVersion:
              2,
          };


        try {
          assertDeclaredProfilePlatformCompatible({
            platformRelease:
              release,

            deploymentConfiguration:
              configuration,
          });


          throw new Error(
            "Expected incompatibility."
          );
        } catch (
          error: any
        ) {
          expect(
            isProfilePlatformCompatibilityError(
              error
            )
          ).toBe(
            true
          );


          expect(
            isProfilePlatformCompatibilityGateError(
              error
            )
          ).toBe(
            true
          );


          expect(
            error.code
          ).toBe(
            "PPS_INCOMPATIBLE"
          );
        }
      }
    );

    test(
      "release-only PPS resolver accepts a qualified v2 release without requiring a configuration",
      () => {
        const release =
          validReleaseV2();


        const resolved =
          requireDeclaredProfilePlatformSpecification(
            release
          );


        expect(
          resolved
            .specificationVersion
        ).toBe(
          1
        );


        expect(
          resolved
            .platformRelease
            .platformReleaseId
        ).toBe(
          release
            .platformReleaseId
        );
      }
    );


    test(
      "release-only PPS resolver rejects an unqualified historical v1 release",
      () => {
        const release =
          validRelease();


        expect(
          () =>
            requireDeclaredProfilePlatformSpecification(
              release
            )
        ).toThrow(
          /does not explicitly declare a Profile Platform Specification/
        );
      }
    );

  }
);