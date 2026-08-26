// src/components/admin/AdminSnapshotsProfileCatalog.test.js

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
      activeProfileVariantId,
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
              "catalog-active-profile-id",
          },
          activeProfileVariantId ||
            ""
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
  "AdminSnapshots Profile Variant catalog integration",
  () => {
    test(
      "renders Profile history between activation controls and the legacy Snapshot archive",
      async () => {
        render(
          <AdminSnapshots
            activeProfile={{
              profileVariantId:
                "prv_current",

              revision:
                7,
            }}
            activeProfileVariantId="prv_current"
            onRefreshActiveProfile={
              jest.fn()
            }
          />
        );


        const activation =
          await screen.findByTestId(
            "profile-variant-activation-panel"
          );


        const catalog =
          screen.getByTestId(
            "profile-variant-catalog-panel"
          );


        const archive =
          screen.getByText(
            "Snapshot archive"
          );


        expect(
          activation.compareDocumentPosition(
            catalog
          ) &
            Node.DOCUMENT_POSITION_FOLLOWING
        ).toBeTruthy();


        expect(
          catalog.compareDocumentPosition(
            archive
          ) &
            Node.DOCUMENT_POSITION_FOLLOWING
        ).toBeTruthy();
      }
    );


    test(
      "forwards the observed ACTIVE Profile Variant identity into the historical catalog",
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
          "profile-variant-catalog-panel"
        );


        expect(
          screen.getByTestId(
            "catalog-active-profile-id"
          )
        ).toHaveTextContent(
          "prv_current"
        );
      }
    );
  }
);