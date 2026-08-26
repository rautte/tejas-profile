// src/components/admin/AdminSnapshotsControlPlaneCatalog.test.js

import {
  fireEvent,
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
  "./ProfileVariantActivationPanel",
  () => {
    const React =
      require(
        "react"
      );


    function MockProfileVariantActivationPanel() {
      return React.createElement(
        "div",
        {
          "data-testid":
            "profile-variant-activation-panel",
        }
      );
    }


    return {
      __esModule:
        true,

      default:
        MockProfileVariantActivationPanel,
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


    function MockProfileVariantCatalogPanel({
      selectionRequest,
      onOpenPlatformRelease,
    }) {
      return React.createElement(
        "div",
        {
          "data-testid":
            "profile-variant-catalog-panel",
        },

        React.createElement(
          "div",
          {
            "data-testid":
              "profile-selection-request",
          },
          selectionRequest
            ?.id ||
            ""
        ),

        React.createElement(
          "button",
          {
            type:
              "button",

            onClick:
              () =>
                onOpenPlatformRelease(
                  "plr_jump"
                ),
          },
          "Open Platform"
        )
      );
    }


    return {
      __esModule:
        true,

      default:
        MockProfileVariantCatalogPanel,
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


    function MockPlatformReleaseCatalogPanel({
      activePlatformReleaseId,
      selectionRequest,
      onOpenProfileVariant,
    }) {
      return React.createElement(
        "div",
        {
          "data-testid":
            "platform-release-catalog-panel",
        },

        React.createElement(
          "div",
          {
            "data-testid":
              "active-platform-release-id",
          },
          activePlatformReleaseId ||
            ""
        ),

        React.createElement(
          "div",
          {
            "data-testid":
              "platform-selection-request",
          },
          selectionRequest
            ?.id ||
            ""
        ),

        React.createElement(
          "button",
          {
            type:
              "button",

            onClick:
              () =>
                onOpenProfileVariant(
                  "prv_jump"
                ),
          },
          "Open Profile"
        )
      );
    }


    return {
      __esModule:
        true,

      default:
        MockPlatformReleaseCatalogPanel,
    };
  }
);


beforeEach(
  () => {
    jest.clearAllMocks();

    localStorage.clear();


    listSnapshots
      .mockResolvedValue(
        []
      );


    listTrashSnapshots
      .mockResolvedValue(
        []
      );


    getDeployHistory
      .mockResolvedValue({
        active:
          null,

        previous:
          null,
      });
  }
);


describe(
  "AdminSnapshots formal control-plane catalog integration",
  () => {
    test(
      "renders Profile and Platform history before the legacy Snapshot archive",
      async () => {
        render(
          <AdminSnapshots
            activeProfileVariantId="prv_active"
            activePlatformReleaseId="plr_active"
          />
        );


        const profile =
          await screen.findByTestId(
            "profile-variant-catalog-panel"
          );


        const platform =
          screen.getByTestId(
            "platform-release-catalog-panel"
          );


        const archive =
          screen.getByText(
            "Snapshot archive"
          );


        expect(
          profile.compareDocumentPosition(
            platform
          ) &
            Node.DOCUMENT_POSITION_FOLLOWING
        ).toBeTruthy();


        expect(
          platform.compareDocumentPosition(
            archive
          ) &
            Node.DOCUMENT_POSITION_FOLLOWING
        ).toBeTruthy();
      }
    );


    test(
      "forwards the complete explicit runtime composition without legacy inference",
      async () => {
        render(
          <AdminSnapshots
            activeProfileVariantId="prv_runtime_active"
            activePlatformReleaseId="plr_runtime_active"
            activeDeploymentConfigurationId="cfg_runtime_active"
          />
        );


        await screen.findByTestId(
          "platform-release-catalog-panel"
        );


        expect(
          screen.getByTestId(
            "active-platform-release-id"
          )
        ).toHaveTextContent(
          "plr_runtime_active"
        );


        expect(
          screen.getByTestId(
            "runtime-profile-variant-id"
          )
        ).toHaveTextContent(
          "prv_runtime_active"
        );


        expect(
          screen.getByTestId(
            "runtime-platform-release-id"
          )
        ).toHaveTextContent(
          "plr_runtime_active"
        );


        expect(
          screen.getByTestId(
            "runtime-deployment-configuration-id"
          )
        ).toHaveTextContent(
          "cfg_runtime_active"
        );
      }
    );


    test(
      "coordinates Profile to Platform cross-navigation",
      async () => {
        render(
          <AdminSnapshots
            activeProfileVariantId="prv_active"
            activePlatformReleaseId="plr_active"
          />
        );


        await screen.findByTestId(
          "profile-variant-catalog-panel"
        );


        fireEvent.click(
          screen.getByRole(
            "button",
            {
              name:
                "Open Platform",
            }
          )
        );


        expect(
          screen.getByTestId(
            "platform-selection-request"
          )
        ).toHaveTextContent(
          "plr_jump"
        );
      }
    );


    test(
      "coordinates Platform to Profile cross-navigation",
      async () => {
        render(
          <AdminSnapshots
            activeProfileVariantId="prv_active"
            activePlatformReleaseId="plr_active"
          />
        );


        await screen.findByTestId(
          "platform-release-catalog-panel"
        );


        fireEvent.click(
          screen.getByRole(
            "button",
            {
              name:
                "Open Profile",
            }
          )
        );


        expect(
          screen.getByTestId(
            "profile-selection-request"
          )
        ).toHaveTextContent(
          "prv_jump"
        );
      }
    );
  }
);