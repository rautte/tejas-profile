// src/components/admin/ProfileVariantCatalogPanel.test.js

import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";

import ProfileVariantCatalogPanel from "./ProfileVariantCatalogPanel";

import {
  getPlatformRelease,
  getProfileVariant,
  listDeploymentConfigurations,
  listProfileActivations,
  listProfileVariants,
} from "../../utils/snapshots/controlPlaneCatalogApi";


jest.mock(
  "../../utils/snapshots/controlPlaneCatalogApi",
  () => ({
    getPlatformRelease:
      jest.fn(),

    getProfileVariant:
      jest.fn(),

    listDeploymentConfigurations:
      jest.fn(),

    listProfileActivations:
      jest.fn(),

    listProfileVariants:
      jest.fn(),
  })
);


const VARIANT_ID =
  "prv_history_target";

const RELEASE_ID =
  "plr_history_target";

const CONFIG_ID =
  "cfg_history_target";


function catalogVariant({
  profileVariantId =
    VARIANT_ID,
} = {}) {
  return {
    profileVariantId,

    schemaId:
      "tejas-profile.profile-variant.v1",

    contentSchemaVersion:
      1,

    contentHash:
      "a".repeat(
        64
      ),

    createdAt:
      "2026-08-24T01:00:00.000Z",

    targeting: {
      location:
        "Austin, TX",

      jobRole:
        "Backend Engineer",
    },

    manifestSha256:
      "b".repeat(
        64
      ),
  };
}


function fullVariant() {
  return {
    ...catalogVariant(),

    content:
      {},
  };
}


function configuration({
  deploymentConfigurationId =
    CONFIG_ID,
} = {}) {
  return {
    deploymentConfigurationId,

    stage:
      "prod",

    createdAt:
      "2026-08-24T02:00:00.000Z",

    platformReleaseId:
      RELEASE_ID,

    profileVariantId:
      VARIANT_ID,

    contentSchemaVersion:
      1,

    contentHash:
      "a".repeat(
        64
      ),

    targeting: {
      location:
        "Austin, TX",

      jobRole:
        "Backend Engineer",
    },

    configurationSha256:
      "c".repeat(
        64
      ),
  };
}


function release() {
  return {
    platformReleaseId:
      RELEASE_ID,

    schemaId:
      "tejas-profile.platform-release.v2",

    profileRuntime: {
      ppsVersion:
        1,
    },

    source: {
      gitSha:
        "d".repeat(
          40
        ),
    },
  };
}


beforeEach(
  () => {
    jest.clearAllMocks();


    listProfileVariants
      .mockResolvedValue({
        ok:
          true,

        variants: [
          catalogVariant(),
        ],

        nextToken:
          null,
      });


    getProfileVariant
      .mockResolvedValue({
        ok:
          true,

        manifestSha256:
          "b".repeat(
            64
          ),

        variant:
          fullVariant(),
      });


    listProfileActivations
      .mockResolvedValue({
        ok:
          true,

        activations: [
          {
            activationId:
              "act_history_target",

            profileVariantId:
              VARIANT_ID,

            activatedAt:
              "2026-08-24T03:00:00.000Z",

            revision:
              4,

            previousProfileVariantId:
              "prv_previous",
          },
        ],

        nextToken:
          null,
      });


    listDeploymentConfigurations
      .mockResolvedValue({
        ok:
          true,

        configurations: [
          configuration(),
        ],

        nextToken:
          null,
      });


    getPlatformRelease
      .mockResolvedValue({
        ok:
          true,

        release:
          release(),
      });
  }
);


describe(
  "ProfileVariantCatalogPanel",
  () => {
    test(
      "loads the immutable Profile Variant catalog and marks the observed ACTIVE variant",
      async () => {
        render(
          <ProfileVariantCatalogPanel
            activeProfileVariantId={
              VARIANT_ID
            }
          />
        );


        await screen.findByText(
          VARIANT_ID
        );


        expect(
          listProfileVariants
        ).toHaveBeenCalledWith({
          limit:
            25,
        });


        expect(
          screen.getByText(
            "Austin, TX · Backend Engineer"
          )
        ).toBeInTheDocument();


        expect(
          screen.getByText(
            "Active"
          )
        ).toBeInTheDocument();
      }
    );


    test(
      "loads authoritative variant, activation history, configurations and referenced Platform Release after selection",
      async () => {
        render(
          <ProfileVariantCatalogPanel
            activeProfileVariantId={
              VARIANT_ID
            }
          />
        );


        const rowId =
          await screen.findByText(
            VARIANT_ID
          );


        fireEvent.click(
          rowId
        );


        await screen.findByText(
          "act_history_target"
        );


        expect(
          getProfileVariant
        ).toHaveBeenCalledWith(
          VARIANT_ID
        );


        expect(
          listProfileActivations
        ).toHaveBeenCalledWith({
          profileVariantId:
            VARIANT_ID,

          limit:
            50,
        });


        expect(
          listDeploymentConfigurations
        ).toHaveBeenCalledWith({
          profileVariantId:
            VARIANT_ID,

          limit:
            50,
        });


        await waitFor(
          () => {
            expect(
              getPlatformRelease
            ).toHaveBeenCalledWith(
              RELEASE_ID
            );
          }
        );


        expect(
          await screen.findByText(
            CONFIG_ID
          )
        ).toBeInTheDocument();


        expect(
          screen.getByText(
            "PPS 1"
          )
        ).toBeInTheDocument();


        expect(
          screen.getByText(
            "tejas-profile.platform-release.v2"
          )
        ).toBeInTheDocument();
      }
    );


    test(
      "does not expose Profile activation as a historical-catalog action",
      async () => {
        render(
          <ProfileVariantCatalogPanel
            activeProfileVariantId=""
          />
        );


        await screen.findByText(
          VARIANT_ID
        );


        expect(
          screen.queryByRole(
            "button",
            {
              name:
                /activate/i,
            }
          )
        ).not.toBeInTheDocument();
      }
    );


    test(
      "paginates Profile Variant catalog explicitly",
      async () => {
        listProfileVariants
          .mockResolvedValueOnce({
            ok:
              true,

            variants: [
              catalogVariant(),
            ],

            nextToken:
              "catalog-next",
          })
          .mockResolvedValueOnce({
            ok:
              true,

            variants: [
              catalogVariant({
                profileVariantId:
                  "prv_history_second",
              }),
            ],

            nextToken:
              null,
          });


        render(
          <ProfileVariantCatalogPanel />
        );


        await screen.findByText(
          VARIANT_ID
        );


        fireEvent.click(
          screen.getByRole(
            "button",
            {
              name:
                "Load more Profile Variants",
            }
          )
        );


        await screen.findByText(
          "prv_history_second"
        );


        expect(
          listProfileVariants
        ).toHaveBeenNthCalledWith(
          2,
          {
            limit:
              25,

            nextToken:
              "catalog-next",
          }
        );
      }
    );


    test(
      "paginates activation history without reloading the selected Profile Variant",
      async () => {
        listProfileActivations
          .mockResolvedValueOnce({
            ok:
              true,

            activations: [
              {
                activationId:
                  "act_first",

                profileVariantId:
                  VARIANT_ID,

                activatedAt:
                  "2026-08-24T03:00:00.000Z",

                revision:
                  2,
              },
            ],

            nextToken:
              "activation-next",
          })
          .mockResolvedValueOnce({
            ok:
              true,

            activations: [
              {
                activationId:
                  "act_second",

                profileVariantId:
                  VARIANT_ID,

                activatedAt:
                  "2026-08-23T03:00:00.000Z",

                revision:
                  1,
              },
            ],

            nextToken:
              null,
          });


        render(
          <ProfileVariantCatalogPanel />
        );


        fireEvent.click(
          await screen.findByText(
            VARIANT_ID
          )
        );


        await screen.findByText(
          "act_first"
        );


        fireEvent.click(
          screen.getAllByRole(
            "button",
            {
              name:
                "Load more",
            }
          )[0]
        );


        await screen.findByText(
          "act_second"
        );


        expect(
          getProfileVariant
        ).toHaveBeenCalledTimes(
          1
        );


        expect(
          listProfileActivations
        ).toHaveBeenNthCalledWith(
          2,
          {
            profileVariantId:
              VARIANT_ID,

            limit:
              50,

            nextToken:
              "activation-next",
          }
        );
      }
    );


    test(
      "loads referenced releases for additional Deployment Configuration pages",
      async () => {
        listDeploymentConfigurations
          .mockResolvedValueOnce({
            ok:
              true,

            configurations: [
              configuration(),
            ],

            nextToken:
              "config-next",
          })
          .mockResolvedValueOnce({
            ok:
              true,

            configurations: [
              {
                ...configuration({
                  deploymentConfigurationId:
                    "cfg_history_second",
                }),

                platformReleaseId:
                  "plr_history_second",
              },
            ],

            nextToken:
              null,
          });


        getPlatformRelease
          .mockImplementation(
            async (
              id
            ) => ({
              ok:
                true,

              release: {
                ...release(),

                platformReleaseId:
                  id,
              },
            })
          );


        render(
          <ProfileVariantCatalogPanel />
        );


        fireEvent.click(
          await screen.findByText(
            VARIANT_ID
          )
        );


        await screen.findByText(
          CONFIG_ID
        );


        fireEvent.click(
          screen.getByRole(
            "button",
            {
              name:
                "Load more",
            }
          )
        );


        await screen.findByText(
          "cfg_history_second"
        );


        expect(
          getPlatformRelease
        ).toHaveBeenCalledWith(
          "plr_history_second"
        );


        expect(
          listDeploymentConfigurations
        ).toHaveBeenNthCalledWith(
          2,
          {
            profileVariantId:
              VARIANT_ID,

            limit:
              50,

            nextToken:
              "config-next",
          }
        );
      }
    );


    test(
      "surfaces catalog failures without attempting historical reads",
      async () => {
        listProfileVariants
          .mockRejectedValueOnce(
            new Error(
              "catalog unavailable"
            )
          );


        render(
          <ProfileVariantCatalogPanel />
        );


        expect(
          await screen.findByText(
            "catalog unavailable"
          )
        ).toBeInTheDocument();


        expect(
          getProfileVariant
        ).not
          .toHaveBeenCalled();


        expect(
          listProfileActivations
        ).not
          .toHaveBeenCalled();


        expect(
          listDeploymentConfigurations
        ).not
          .toHaveBeenCalled();
      }
    );

    test(
      "supports externally requested Profile Variant selection",
      async () => {
        render(
          <ProfileVariantCatalogPanel
            selectionRequest={{
              id:
                VARIANT_ID,

              requestId:
                1,
            }}
          />
        );


        await screen.findByText(
          "act_history_target"
        );


        expect(
          getProfileVariant
        ).toHaveBeenCalledWith(
          VARIANT_ID
        );
      }
    );


    test(
      "requests Platform Release cross-navigation from a Deployment Configuration",
      async () => {
        const onOpenPlatformRelease =
          jest.fn();


        render(
          <ProfileVariantCatalogPanel
            onOpenPlatformRelease={
              onOpenPlatformRelease
            }
          />
        );


        fireEvent.click(
          await screen.findByText(
            VARIANT_ID
          )
        );


        const releaseButton =
          await screen.findByRole(
            "button",
            {
              name:
                RELEASE_ID,
            }
          );


        fireEvent.click(
          releaseButton
        );


        expect(
          onOpenPlatformRelease
        ).toHaveBeenCalledWith(
          RELEASE_ID
        );
      }
    );

  }
);