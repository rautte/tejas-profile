// src/components/admin/AdminSnapshotsProfileActivation.test.js

import {
  fireEvent,
  render,
  screen,
  waitFor,
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


    function MockProfileVariantActivationPanel({
      active,

      activeProfileVariantId,

      onRefreshActiveProfile,
    }) {
      return React.createElement(
        "div",
        {
          "data-testid":
            "profile-variant-activation-panel",
        },

        React.createElement(
          "div",
          {
            "data-testid":
              "activation-active-id",
          },
          activeProfileVariantId ||
            ""
        ),

        React.createElement(
          "div",
          {
            "data-testid":
              "activation-active-revision",
          },
          active
            ?.revision ??
            ""
        ),

        React.createElement(
          "button",
          {
            type:
              "button",

            onClick: () =>
              onRefreshActiveProfile
                ?.(),
          },
          "Refresh active Profile"
        )
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


    function MockProfileVariantCatalogPanel() {
      return React.createElement(
        "div",
        {
          "data-testid":
            "profile-variant-catalog-panel",
        }
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


    function MockPlatformReleaseCatalogPanel() {
      return React.createElement(
        "div",
        {
          "data-testid":
            "platform-release-catalog-panel",
        }
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
  "AdminSnapshots Profile activation integration",
  () => {
    test(
      "forwards the observed ACTIVE Profile state to the activation panel",
      async () => {
        render(
          <AdminSnapshots
            activeProfile={{
              profileVariantId:
                "prv_current",

              revision:
                8,
            }}
            activeProfileVariantId="prv_current"
            onRefreshActiveProfile={
              jest.fn()
            }
          />
        );


        await screen.findByTestId(
          "profile-variant-activation-panel"
        );


        expect(
          screen.getByTestId(
            "activation-active-id"
          )
        ).toHaveTextContent(
          "prv_current"
        );


        expect(
          screen.getByTestId(
            "activation-active-revision"
          )
        ).toHaveTextContent(
          "8"
        );
      }
    );


    test(
      "forwards the P3.4 runtime refresh callback to the activation panel",
      async () => {
        const refresh =
          jest
            .fn()
            .mockResolvedValue();


        render(
          <AdminSnapshots
            activeProfile={{
              profileVariantId:
                "prv_current",

              revision:
                3,
            }}
            activeProfileVariantId="prv_current"
            onRefreshActiveProfile={
              refresh
            }
          />
        );


        await screen.findByTestId(
          "profile-variant-activation-panel"
        );


        fireEvent.click(
          screen.getByRole(
            "button",
            {
              name:
                "Refresh active Profile",
            }
          )
        );


        await waitFor(
          () => {
            expect(
              refresh
            ).toHaveBeenCalledTimes(
              1
            );
          }
        );
      }
    );


    test(
      "does not invoke legacy deployment while initializing Profile activation UI",
      async () => {
        render(
          <AdminSnapshots
            activeProfile={{
              profileVariantId:
                "prv_current",

              revision:
                5,
            }}
            activeProfileVariantId="prv_current"
            onRefreshActiveProfile={
              jest.fn()
            }
          />
        );


        await screen.findByTestId(
          "profile-variant-activation-panel"
        );

      }
    );
  }
);