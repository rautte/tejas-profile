// src/components/admin/AdminSnapshotsHistoricalTruth.test.js


import {
  render,
  screen,
} from "@testing-library/react";

import AdminSnapshots from "./Snapshots";

import {
  getDeployHistory,
  listSnapshots,
  listTrashSnapshots,
} from "../../utils/snapshots/snapshotsApi";


jest.mock(
  "../../utils/snapshots/snapshotsApi",
  () => ({
    listSnapshots:
      jest.fn(),

    fetchSnapshotJson:
      jest.fn(),

    deleteSnapshot:
      jest.fn(),

    restoreSnapshot:
      jest.fn(),

    listTrashSnapshots:
      jest.fn(),

    getDeployHistory:
      jest.fn(),

    purgeSnapshot:
      jest.fn(),

    updateSnapshotRemark:
      jest.fn(),

    presignRepoGet:
      jest.fn(),
  })
);


jest.mock(
  "./CurrentRuntimeCompositionCard",
  () => {
    const React =
      require(
        "react"
      );


    return {
      __esModule:
        true,

      default:
        function MockCurrentRuntimeCompositionCard() {
          return React.createElement(
            "div",
            {
              "data-testid":
                "current-runtime-composition-card",
            }
          );
        },
    };
  }
);


jest.mock(
  "./ProfileVariantActivationPanel",
  () => {
    const React =
      require(
        "react"
      );


    return {
      __esModule:
        true,

      default:
        function MockProfileVariantActivationPanel() {
          return React.createElement(
            "div",
            {
              "data-testid":
                "profile-variant-activation-panel",
            }
          );
        },
    };
  }
);


jest.mock(
  "./ProfileVariantCatalogPanel",
  () => {
    const React =
      require(
        "react"
      );


    return {
      __esModule:
        true,

      default:
        function MockProfileVariantCatalogPanel() {
          return React.createElement(
            "div",
            {
              "data-testid":
                "profile-variant-catalog-panel",
            }
          );
        },
    };
  }
);


jest.mock(
  "./PlatformReleaseCatalogPanel",
  () => {
    const React =
      require(
        "react"
      );


    return {
      __esModule:
        true,

      default:
        function MockPlatformReleaseCatalogPanel() {
          return React.createElement(
            "div",
            {
              "data-testid":
                "platform-release-catalog-panel",
            }
          );
        },
    };
  }
);


beforeEach(
  () => {
    jest.clearAllMocks();

    localStorage.clear();


    listSnapshots
      .mockResolvedValue([
        {
          key:
            "snapshots/ci_deploy/from_a_to_b/example.json",

          filename:
            "example.json",

          scope:
            "snapshots",

          name:
            "ci_deploy",

          from:
            "2026-08-20",

          to:
            "2026-08-20",

          createdAt:
            "2026-08-20T10:00:00.000Z",

          size:
            100,

          lastModified:
            "2026-08-20T10:00:00.000Z",

          meta: {
            profileVersionId:
              "pv_legacy",

            gitSha:
              "a".repeat(
                40
              ),

            checkpointTag:
              "checkpoint-legacy",
          },

          historicalTruth: {
            sourceKind:
              "legacy",

            classification:
              "LEGACY_UNMAPPED",

            formalIdentity:
              null,

            candidateFormalIdentities:
              [],

            legacyEvidence: {
              profileVersionId:
                "pv_legacy",

              gitSha:
                "a".repeat(
                  40
                ),
            },

            invalidReasons:
              [],
          },
        },
      ]);


    listTrashSnapshots
      .mockResolvedValue(
        []
      );


    getDeployHistory
      .mockResolvedValue({
        active: {
          gitSha:
            "b".repeat(
              40
            ),

          profileVersionId:
            "pv_linked",

          deployedAt:
            "2026-08-24T10:00:00.000Z",

          source:
            "promote",

          platformReleaseId:
            "plr_gha_400_1",

          deploymentId:
            "pdep_gha_400_1",

          historicalTruth: {
            sourceKind:
              "legacy",

            classification:
              "LEGACY_LINKED",

            formalIdentity:
              null,

            candidateFormalIdentities: [
              {
                kind:
                  "platform_deployment",

                id:
                  "pdep_gha_400_1",
              },

              {
                kind:
                  "platform_release",

                id:
                  "plr_gha_400_1",
              },
            ],

            legacyEvidence: {
              profileVersionId:
                "pv_linked",

              gitSha:
                "b".repeat(
                  40
                ),
            },

            invalidReasons:
              [],
          },
        },

        previous:
          null,

        timeline:
          [],
      });
  }
);


describe(
  "AdminSnapshots historical truth integration",
  () => {
    test(
      "shows legacy Snapshot truth without converting the Snapshot into formal history",
      async () => {
        render(
          <AdminSnapshots />
        );


        expect(
          await screen.findByText(
            "Legacy · Unmapped"
          )
        ).toBeInTheDocument();


        expect(
          screen.getByText(
            "pv_legacy"
          )
        ).toBeInTheDocument();


        expect(
          screen.queryByText(
            "prv_legacy"
          )
        ).not.toBeInTheDocument();
      }
    );


    test(
      "shows explicitly linked deploy-history formal identities",
      async () => {
        render(
          <AdminSnapshots />
        );


        expect(
          await screen.findByTestId(
            "legacy-deploy-history-truth-panel"
          )
        ).toBeInTheDocument();


        expect(
          screen.getByText(
            "Legacy · Linked"
          )
        ).toBeInTheDocument();


        expect(
          screen.getByText(
            "plr_gha_400_1"
          )
        ).toBeInTheDocument();


        expect(
          screen.getByText(
            "pdep_gha_400_1"
          )
        ).toBeInTheDocument();
      }
    );


    test(
      "keeps authoritative formal catalogs before the legacy Snapshot archive",
      async () => {
        render(
          <AdminSnapshots />
        );


        const platformCatalog =
          await screen.findByTestId(
            "platform-release-catalog-panel"
          );


        const archive =
          screen.getByText(
            "Snapshot archive"
          );


        expect(
          platformCatalog
            .compareDocumentPosition(
              archive
            ) &
            Node
              .DOCUMENT_POSITION_FOLLOWING
        ).toBeTruthy();
      }
    );
  }
);