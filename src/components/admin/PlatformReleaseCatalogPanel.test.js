// src/components/admin/PlatformReleaseCatalogPanel.test.js

import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";

import PlatformReleaseCatalogPanel from "./PlatformReleaseCatalogPanel";

import {
  getPlatformRelease,
  getProfileVariant,
  listDeploymentConfigurations,
  listPlatformDeployments,
  listPlatformReleases,
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

    listPlatformDeployments:
      jest.fn(),

    listPlatformReleases:
      jest.fn(),
  })
);


const RELEASE_ID =
  "plr_history_target";

const VARIANT_ID =
  "prv_history_target";

const CONFIG_ID =
  "cfg_history_target";


function catalogRelease({
  platformReleaseId =
    RELEASE_ID,

  schemaId =
    "tejas-profile.platform-release.v2",

  ppsVersion =
    1,
} = {}) {
  return {
    platformReleaseId,

    schemaId,

    stage:
      "prod",

    createdAt:
      "2026-08-24T01:00:00.000Z",

    ppsVersion,

    source: {
      repository:
        "rautte/tejas-profile",

      gitSha:
        "a".repeat(
          40
        ),

      gitRef:
        "refs/heads/main",

      checkpointTag:
        "checkpoint-history",
    },

    buildTime:
      "2026-08-24T00:59:00.000Z",

    frontendArtifactSha256:
      "b".repeat(
        64
      ),

    releaseSha256:
      "c".repeat(
        64
      ),
  };
}


function fullRelease({
  platformReleaseId =
    RELEASE_ID,

  schemaId =
    "tejas-profile.platform-release.v2",

  ppsVersion =
    1,
} = {}) {
  const release = {
    schema:
      "tejas-profile.platform-release",

    schemaId,

    platformReleaseId,

    stage:
      "prod",

    createdAt:
      "2026-08-24T01:00:00.000Z",

    source: {
      repository:
        "rautte/tejas-profile",

      gitSha:
        "a".repeat(
          40
        ),

      gitRef:
        "refs/heads/main",

      checkpointTag:
        "checkpoint-history",
    },

    build: {
      buildTime:
        "2026-08-24T00:59:00.000Z",

      frontendArtifactSha256:
        "b".repeat(
          64
        ),
    },
  };


  if (
    Number.isInteger(
      ppsVersion
    )
  ) {
    release.profileRuntime = {
      ppsVersion,
    };
  }


  return release;
}


function configuration({
  deploymentConfigurationId =
    CONFIG_ID,

  profileVariantId =
    VARIANT_ID,
} = {}) {
  return {
    deploymentConfigurationId,

    stage:
      "prod",

    createdAt:
      "2026-08-24T02:00:00.000Z",

    platformReleaseId:
      RELEASE_ID,

    profileVariantId,

    contentSchemaVersion:
      1,

    contentHash:
      "d".repeat(
        64
      ),

    targeting: {
      location:
        "Austin, TX",

      jobRole:
        "Backend Engineer",
    },
  };
}


function profileVariant({
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
      "d".repeat(
        64
      ),

    targeting: {
      location:
        "Austin, TX",

      jobRole:
        "Backend Engineer",
    },
  };
}


beforeEach(
  () => {
    jest.clearAllMocks();


    listPlatformReleases
      .mockResolvedValue({
        ok:
          true,

        releases: [
          catalogRelease(),
        ],

        nextToken:
          null,
      });


    getPlatformRelease
      .mockResolvedValue({
        ok:
          true,

        releaseSha256:
          "c".repeat(
            64
          ),

        release:
          fullRelease(),
      });


    listPlatformDeployments
      .mockResolvedValue({
        ok:
          true,

        deployments: [
          {
            deploymentId:
              "pdep_history_target",

            platformReleaseId:
              RELEASE_ID,

            deployedAt:
              "2026-08-24T03:00:00.000Z",

            revision:
              4,

            platformReleaseSha256:
              "c".repeat(
                64
              ),

            previousPlatformReleaseId:
              "plr_previous",
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


    getProfileVariant
      .mockResolvedValue({
        ok:
          true,

        variant:
          profileVariant(),
      });
  }
);


describe(
  "PlatformReleaseCatalogPanel",
  () => {
    test(
      "loads Platform Release catalog and marks the observed ACTIVE release",
      async () => {
        render(
          <PlatformReleaseCatalogPanel
            activePlatformReleaseId={
              RELEASE_ID
            }
          />
        );


        await screen.findByText(
          RELEASE_ID
        );


        expect(
          listPlatformReleases
        ).toHaveBeenCalledWith({
          limit:
            25,
        });


        expect(
          screen.getByText(
            "Active"
          )
        ).toBeInTheDocument();


        expect(
          screen.getByText(
            "PPS 1"
          )
        ).toBeInTheDocument();
      }
    );


    test(
      "loads authoritative release, deployment history, configurations and referenced Profile Variant",
      async () => {
        render(
          <PlatformReleaseCatalogPanel
            activePlatformReleaseId={
              RELEASE_ID
            }
          />
        );


        fireEvent.click(
          await screen.findByText(
            RELEASE_ID
          )
        );


        await screen.findByText(
          "pdep_history_target"
        );


        expect(
          getPlatformRelease
        ).toHaveBeenCalledWith(
          RELEASE_ID
        );


        expect(
          listPlatformDeployments
        ).toHaveBeenCalledWith({
          platformReleaseId:
            RELEASE_ID,

          limit:
            50,
        });


        expect(
          listDeploymentConfigurations
        ).toHaveBeenCalledWith({
          platformReleaseId:
            RELEASE_ID,

          limit:
            50,
        });


        await waitFor(
          () => {
            expect(
              getProfileVariant
            ).toHaveBeenCalledWith(
              VARIANT_ID
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
            "Austin, TX · Backend Engineer"
          )
        ).toBeInTheDocument();
      }
    );


    test(
      "preserves historical v1 release as PPS-unqualified",
      async () => {
        listPlatformReleases
          .mockResolvedValueOnce({
            ok:
              true,

            releases: [
              catalogRelease({
                platformReleaseId:
                  "plr_v1",

                schemaId:
                  "tejas-profile.platform-release.v1",

                ppsVersion:
                  null,
              }),
            ],

            nextToken:
              null,
          });


        getPlatformRelease
          .mockResolvedValueOnce({
            ok:
              true,

            releaseSha256:
              "c".repeat(
                64
              ),

            release:
              fullRelease({
                platformReleaseId:
                  "plr_v1",

                schemaId:
                  "tejas-profile.platform-release.v1",

                ppsVersion:
                  null,
              }),
          });


        render(
          <PlatformReleaseCatalogPanel />
        );


        expect(
          await screen.findByText(
            "Unqualified / historical"
          )
        ).toBeInTheDocument();


        fireEvent.click(
          screen.getByText(
            "plr_v1"
          )
        );


        await waitFor(
          () => {
            expect(
              getPlatformRelease
            ).toHaveBeenCalledWith(
              "plr_v1"
            );
          }
        );


        expect(
          screen.getAllByText(
            "Unqualified / historical"
          ).length
        ).toBeGreaterThan(
          0
        );
      }
    );


    test(
      "never exposes Platform deployment as a catalog action",
      async () => {
        render(
          <PlatformReleaseCatalogPanel />
        );


        await screen.findByText(
          RELEASE_ID
        );


        expect(
          screen.queryByRole(
            "button",
            {
              name:
                /deploy/i,
            }
          )
        ).not.toBeInTheDocument();
      }
    );


    test(
      "supports externally requested Platform Release selection",
      async () => {
        render(
          <PlatformReleaseCatalogPanel
            selectionRequest={{
              id:
                RELEASE_ID,

              requestId:
                1,
            }}
          />
        );


        await screen.findByText(
          "pdep_history_target"
        );


        expect(
          getPlatformRelease
        ).toHaveBeenCalledWith(
          RELEASE_ID
        );
      }
    );


    test(
      "requests Profile Variant cross-navigation from a Deployment Configuration",
      async () => {
        const onOpenProfileVariant =
          jest.fn();


        render(
          <PlatformReleaseCatalogPanel
            onOpenProfileVariant={
              onOpenProfileVariant
            }
          />
        );


        fireEvent.click(
          await screen.findByText(
            RELEASE_ID
          )
        );


        const profileButton =
          await screen.findByRole(
            "button",
            {
              name:
                VARIANT_ID,
            }
          );


        fireEvent.click(
          profileButton
        );


        expect(
          onOpenProfileVariant
        ).toHaveBeenCalledWith(
          VARIANT_ID
        );
      }
    );


    test(
      "paginates Platform Release catalog and deployment history explicitly",
      async () => {
        listPlatformReleases
          .mockResolvedValueOnce({
            ok:
              true,

            releases: [
              catalogRelease(),
            ],

            nextToken:
              "release-next",
          })
          .mockResolvedValueOnce({
            ok:
              true,

            releases: [
              catalogRelease({
                platformReleaseId:
                  "plr_second",
              }),
            ],

            nextToken:
              null,
          });


        listPlatformDeployments
          .mockResolvedValueOnce({
            ok:
              true,

            deployments: [
              {
                deploymentId:
                  "pdep_first",

                platformReleaseId:
                  RELEASE_ID,

                revision:
                  2,
              },
            ],

            nextToken:
              "deployment-next",
          })
          .mockResolvedValueOnce({
            ok:
              true,

            deployments: [
              {
                deploymentId:
                  "pdep_second",

                platformReleaseId:
                  RELEASE_ID,

                revision:
                  1,
              },
            ],

            nextToken:
              null,
          });


        render(
          <PlatformReleaseCatalogPanel />
        );


        await screen.findByText(
          RELEASE_ID
        );


        fireEvent.click(
          screen.getByRole(
            "button",
            {
              name:
                "Load more Platform Releases",
            }
          )
        );


        await screen.findByText(
          "plr_second"
        );


        expect(
          listPlatformReleases
        ).toHaveBeenNthCalledWith(
          2,
          {
            limit:
              25,

            nextToken:
              "release-next",
          }
        );


        fireEvent.click(
          screen.getByText(
            RELEASE_ID
          )
        );


        await screen.findByText(
          "pdep_first"
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
          "pdep_second"
        );


        expect(
          listPlatformDeployments
        ).toHaveBeenNthCalledWith(
          2,
          {
            platformReleaseId:
              RELEASE_ID,

            limit:
              50,

            nextToken:
              "deployment-next",
          }
        );
      }
    );


    test(
      "surfaces catalog failures without historical reads",
      async () => {
        listPlatformReleases
          .mockRejectedValueOnce(
            new Error(
              "platform catalog unavailable"
            )
          );


        render(
          <PlatformReleaseCatalogPanel />
        );


        expect(
          await screen.findByText(
            "platform catalog unavailable"
          )
        ).toBeInTheDocument();


        expect(
          getPlatformRelease
        ).not
          .toHaveBeenCalled();


        expect(
          listPlatformDeployments
        ).not
          .toHaveBeenCalled();


        expect(
          listDeploymentConfigurations
        ).not
          .toHaveBeenCalled();
      }
    );
  }
);