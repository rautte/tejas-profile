// src/utils/snapshots/controlPlaneCatalogViewModel.test.js

import {
  buildPlatformReleaseCatalogRows,
  buildPlatformReleaseHistoryModel,
  buildProfileVariantCatalogRows,
  buildProfileVariantHistoryModel,
} from "./controlPlaneCatalogViewModel";


describe(
  "controlPlaneCatalogViewModel",
  () => {
    test(
      "marks only the observed ACTIVE Profile Variant",
      () => {
        const rows =
          buildProfileVariantCatalogRows({
            variants: [
              {
                profileVariantId:
                  "prv_a",
              },

              {
                profileVariantId:
                  "prv_b",
              },
            ],

            activeProfileVariantId:
              "prv_b",
          });


        expect(
          rows
        ).toEqual([
          expect.objectContaining({
            profileVariantId:
              "prv_a",

            isActive:
              false,
          }),

          expect.objectContaining({
            profileVariantId:
              "prv_b",

            isActive:
              true,
          }),
        ]);
      }
    );


    test(
      "preserves historical Platform Release v1 as PPS-unqualified",
      () => {
        const rows =
          buildPlatformReleaseCatalogRows({
            releases: [
              {
                platformReleaseId:
                  "plr_v1",

                schemaId:
                  "tejas-profile.platform-release.v1",
              },

              {
                platformReleaseId:
                  "plr_v2",

                schemaId:
                  "tejas-profile.platform-release.v2",

                ppsVersion:
                  1,
              },
            ],

            activePlatformReleaseId:
              "plr_v2",
          });


        expect(
          rows[0]
            .ppsVersion
        ).toBeNull();


        expect(
          rows[0]
            .isActive
        ).toBe(
          false
        );


        expect(
          rows[1]
            .ppsVersion
        ).toBe(
          1
        );


        expect(
          rows[1]
            .isActive
        ).toBe(
          true
        );
      }
    );


    test(
      "builds Profile Variant history from only matching ledger and configuration records",
      () => {
        const model =
          buildProfileVariantHistoryModel({
            variant: {
              profileVariantId:
                "prv_target",
            },

            activeProfileVariantId:
              "prv_target",

            activations: [
              {
                activationId:
                  "act_target",

                profileVariantId:
                  "prv_target",
              },

              {
                activationId:
                  "act_other",

                profileVariantId:
                  "prv_other",
              },
            ],

            configurations: [
              {
                deploymentConfigurationId:
                  "cfg_target",

                profileVariantId:
                  "prv_target",

                platformReleaseId:
                  "plr_known",
              },

              {
                deploymentConfigurationId:
                  "cfg_missing",

                profileVariantId:
                  "prv_target",

                platformReleaseId:
                  "plr_missing",
              },

              {
                deploymentConfigurationId:
                  "cfg_other",

                profileVariantId:
                  "prv_other",

                platformReleaseId:
                  "plr_known",
              },
            ],

            platformReleases: [
              {
                platformReleaseId:
                  "plr_known",
              },
            ],
          });


        expect(
          model.isActive
        ).toBe(
          true
        );


        expect(
          model.activations
        ).toEqual([
          expect.objectContaining({
            activationId:
              "act_target",
          }),
        ]);


        expect(
          model.configurations
        ).toHaveLength(
          2
        );


        expect(
          model
            .configurations[0]
            .platformRelease
            ?.platformReleaseId
        ).toBe(
          "plr_known"
        );


        expect(
          model
            .configurations[1]
            .platformRelease
        ).toBeNull();


        expect(
          model
            .missingPlatformReleaseIds
        ).toEqual([
          "plr_missing",
        ]);
      }
    );


    test(
      "builds Platform Release history from only matching deployment and configuration records",
      () => {
        const model =
          buildPlatformReleaseHistoryModel({
            release: {
              platformReleaseId:
                "plr_target",

              schemaId:
                "tejas-profile.platform-release.v2",

              profileRuntime: {
                ppsVersion:
                  1,
              },
            },

            activePlatformReleaseId:
              "plr_target",

            deployments: [
              {
                deploymentId:
                  "pdep_target",

                platformReleaseId:
                  "plr_target",
              },

              {
                deploymentId:
                  "pdep_other",

                platformReleaseId:
                  "plr_other",
              },
            ],

            configurations: [
              {
                deploymentConfigurationId:
                  "cfg_target",

                platformReleaseId:
                  "plr_target",

                profileVariantId:
                  "prv_known",
              },

              {
                deploymentConfigurationId:
                  "cfg_missing",

                platformReleaseId:
                  "plr_target",

                profileVariantId:
                  "prv_missing",
              },

              {
                deploymentConfigurationId:
                  "cfg_other",

                platformReleaseId:
                  "plr_other",

                profileVariantId:
                  "prv_known",
              },
            ],

            profileVariants: [
              {
                profileVariantId:
                  "prv_known",
              },
            ],
          });


        expect(
          model.isActive
        ).toBe(
          true
        );


        expect(
          model.ppsVersion
        ).toBe(
          1
        );


        expect(
          model.deployments
        ).toEqual([
          expect.objectContaining({
            deploymentId:
              "pdep_target",
          }),
        ]);


        expect(
          model.configurations
        ).toHaveLength(
          2
        );


        expect(
          model
            .configurations[0]
            .profileVariant
            ?.profileVariantId
        ).toBe(
          "prv_known"
        );


        expect(
          model
            .configurations[1]
            .profileVariant
        ).toBeNull();


        expect(
          model
            .missingProfileVariantIds
        ).toEqual([
          "prv_missing",
        ]);
      }
    );


    test(
      "does not invent PPS qualification for a historical v1 detail model",
      () => {
        const model =
          buildPlatformReleaseHistoryModel({
            release: {
              platformReleaseId:
                "plr_historical",

              schemaId:
                "tejas-profile.platform-release.v1",
            },
          });


        expect(
          model.ppsVersion
        ).toBeNull();
      }
    );


    test(
      "fails closed when a selected history entity has no canonical identity",
      () => {
        expect(
          () =>
            buildProfileVariantHistoryModel({
              variant:
                {},
            })
        ).toThrow(
          "Profile Variant history model requires profileVariantId."
        );


        expect(
          () =>
            buildPlatformReleaseHistoryModel({
              release:
                {},
            })
        ).toThrow(
          "Platform Release history model requires platformReleaseId."
        );
      }
    );
  }
);