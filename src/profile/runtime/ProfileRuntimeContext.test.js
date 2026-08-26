import React from "react";

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";

import {
  ProfileRuntimeProvider,
  useProfileRuntime,
} from "./ProfileRuntimeContext";


/**
 * Keep these as plain functions rather than jest.fn().
 *
 * CRA/Jest can reset mock implementations between tests.
 * The orchestration under test is ProfileRuntimeProvider itself;
 * runtimeProfile transformation rules already have dedicated tests.
 */
jest.mock(
  "./runtimeProfile",
  () => {
    const repositoryRuntime = {
      source:
        "repository",

      content: {
        hero: {
          name:
            "Repository Tejas",
        },
      },

      active:
        null,

      profileVariantId:
        null,

      platformReleaseId:
        null,

      deploymentConfigurationId:
        null,

      targeting:
        null,
    };


    return {
      createRepositoryRuntimeProfile:
        () =>
          repositoryRuntime,

      createActiveRuntimeProfile:
        (response) =>
          response.__runtime,

      resolveRuntimeProfileAsset:
        (
          runtimeProfile,
          assetId
        ) =>
          `${runtimeProfile.source}:${assetId}`,
    };
  }
);


function RuntimeProbe() {
  const runtime =
    useProfileRuntime();


  return (
    <div>
      <div data-testid="source">
        {runtime.source}
      </div>

      <div data-testid="status">
        {runtime.status}
      </div>

      <div data-testid="name">
        {
          runtime.content
            ?.hero
            ?.name ||
          ""
        }
      </div>

      <div data-testid="variant-id">
        {
          runtime.profileVariantId ||
          ""
        }
      </div>

      <div data-testid="platform-release-id">
        {
          runtime.platformReleaseId ||
          ""
        }
      </div>

      <div data-testid="deployment-configuration-id">
        {
          runtime.deploymentConfigurationId ||
          ""
        }
      </div>

      <div data-testid="error">
        {
          runtime.error
            ?.message ||
          ""
        }
      </div>

      <button
        type="button"
        onClick={() =>
          runtime.refresh()
        }
      >
        Refresh
      </button>
    </div>
  );
}


function renderProvider(
  loadActiveProfile
) {
  return render(
    <ProfileRuntimeProvider
      loadActiveProfile={
        loadActiveProfile
      }
    >
      <RuntimeProbe />
    </ProfileRuntimeProvider>
  );
}


function createDeferred() {
  let resolve;
  let reject;


  const promise =
    new Promise(
      (
        nextResolve,
        nextReject
      ) => {
        resolve =
          nextResolve;

        reject =
          nextReject;
      }
    );


  return {
    promise,
    resolve,
    reject,
  };
}


function createActiveResponse({
  profileVariantId,
  name,
}) {
  return {
    configured:
      true,

    active: {
      activationId:
        `activation:${profileVariantId}`,

      profileVariantId,
    },

    variant: {
      profileVariantId,
    },

    __runtime: {
      source:
        "active",

      content: {
        hero: {
          name,
        },
      },

      active: {
        activationId:
          `activation:${profileVariantId}`,

        profileVariantId,
      },

      profileVariantId,

      platformReleaseId:
        "plr_runtime_test",

      deploymentConfigurationId:
        `cfg_${profileVariantId}`,

      targeting: {
        location:
          "Test Location",

        jobRole:
          "Test Role",
      },
    },
  };
}


describe(
  "ProfileRuntimeProvider",
  () => {
    test(
      "renders repository ProfileContent immediately while the active-profile request is pending",
      async () => {
        const request =
          createDeferred();


        const loadActiveProfile =
          jest.fn(
            () =>
              request.promise
          );


        renderProvider(
          loadActiveProfile
        );


        /**
         * Repository ProfileContent must be available immediately.
         * Network loading must never blank the portfolio.
         */
        expect(
          screen.getByTestId(
            "source"
          )
        ).toHaveTextContent(
          "repository"
        );


        expect(
          screen.getByTestId(
            "name"
          )
        ).toHaveTextContent(
          "Repository Tejas"
        );


        await waitFor(
          () => {
            expect(
              screen.getByTestId(
                "status"
              )
            ).toHaveTextContent(
              "loading"
            );
          }
        );


        expect(
          loadActiveProfile
        ).toHaveBeenCalledTimes(
          1
        );
      }
    );


    test(
      "replaces repository content with the active Profile Variant after a valid response",
      async () => {
        const loadActiveProfile =
          jest.fn(
            async () =>
              createActiveResponse({
                profileVariantId:
                  "variant_active_001",

                name:
                  "Active Tejas",
              })
          );


        renderProvider(
          loadActiveProfile
        );


        await waitFor(
          () => {
            expect(
              screen.getByTestId(
                "status"
              )
            ).toHaveTextContent(
              "active"
            );
          }
        );


        expect(
          screen.getByTestId(
            "source"
          )
        ).toHaveTextContent(
          "active"
        );


        expect(
          screen.getByTestId(
            "name"
          )
        ).toHaveTextContent(
          "Active Tejas"
        );


        expect(
          screen.getByTestId(
            "variant-id"
          )
        ).toHaveTextContent(
          "variant_active_001"
        );


        expect(
          screen.getByTestId(
            "platform-release-id"
          )
        ).toHaveTextContent(
          "plr_runtime_test"
        );


        expect(
          screen.getByTestId(
            "deployment-configuration-id"
          )
        ).toHaveTextContent(
          "cfg_variant_active_001"
        );


        expect(
          screen.getByTestId(
            "error"
          )
        ).toHaveTextContent(
          ""
        );
      }
    );


    test(
      "keeps repository content when the API is configured but no Profile Variant has been activated",
      async () => {
        const loadActiveProfile =
          jest.fn(
            async () => ({
              configured:
                true,

              active:
                null,

              variant:
                null,
            })
          );


        renderProvider(
          loadActiveProfile
        );


        await waitFor(
          () => {
            expect(
              screen.getByTestId(
                "status"
              )
            ).toHaveTextContent(
              "repository-no-activation"
            );
          }
        );


        expect(
          screen.getByTestId(
            "source"
          )
        ).toHaveTextContent(
          "repository"
        );


        expect(
          screen.getByTestId(
            "name"
          )
        ).toHaveTextContent(
          "Repository Tejas"
        );


        expect(
          screen.getByTestId(
            "variant-id"
          )
        ).toHaveTextContent(
          ""
        );


        expect(
          screen.getByTestId(
            "error"
          )
        ).toHaveTextContent(
          ""
        );
      }
    );


    test(
      "falls back to repository content when the Active Profile API fails",
      async () => {
        const loadActiveProfile =
          jest.fn(
            async () => {
              throw new Error(
                "Active Profile API unavailable"
              );
            }
          );


        renderProvider(
          loadActiveProfile
        );


        await waitFor(
          () => {
            expect(
              screen.getByTestId(
                "status"
              )
            ).toHaveTextContent(
              "repository-error"
            );
          }
        );


        expect(
          screen.getByTestId(
            "source"
          )
        ).toHaveTextContent(
          "repository"
        );


        expect(
          screen.getByTestId(
            "name"
          )
        ).toHaveTextContent(
          "Repository Tejas"
        );


        expect(
          screen.getByTestId(
            "error"
          )
        ).toHaveTextContent(
          "Active Profile API unavailable"
        );
      }
    );


    test(
      "does not allow an older request to overwrite a newer refresh result",
      async () => {
        const firstRequest =
          createDeferred();

        const secondRequest =
          createDeferred();


        const loadActiveProfile =
          jest
            .fn()
            .mockImplementationOnce(
              () =>
                firstRequest.promise
            )
            .mockImplementationOnce(
              () =>
                secondRequest.promise
            );


        renderProvider(
          loadActiveProfile
        );


        await waitFor(
          () => {
            expect(
              loadActiveProfile
            ).toHaveBeenCalledTimes(
              1
            );
          }
        );


        fireEvent.click(
          screen.getByRole(
            "button",
            {
              name:
                "Refresh",
            }
          )
        );


        await waitFor(
          () => {
            expect(
              loadActiveProfile
            ).toHaveBeenCalledTimes(
              2
            );
          }
        );


        await act(
          async () => {
            secondRequest.resolve(
              createActiveResponse({
                profileVariantId:
                  "variant_newer",

                name:
                  "Newer Active Tejas",
              })
            );


            await Promise.resolve();
          }
        );


        await waitFor(
          () => {
            expect(
              screen.getByTestId(
                "variant-id"
              )
            ).toHaveTextContent(
              "variant_newer"
            );
          }
        );


        expect(
          screen.getByTestId(
            "name"
          )
        ).toHaveTextContent(
          "Newer Active Tejas"
        );


        /**
         * Now let the older request finish.
         *
         * requestIdRef in the provider must reject this stale result
         * rather than rolling the UI backward.
         */
        await act(
          async () => {
            firstRequest.resolve(
              createActiveResponse({
                profileVariantId:
                  "variant_older",

                name:
                  "Older Active Tejas",
              })
            );


            await Promise.resolve();
          }
        );


        expect(
          screen.getByTestId(
            "variant-id"
          )
        ).toHaveTextContent(
          "variant_newer"
        );


        expect(
          screen.getByTestId(
            "source"
          )
        ).toHaveTextContent(
          "active"
        );


        expect(
          screen.getByTestId(
            "name"
          )
        ).toHaveTextContent(
          "Newer Active Tejas"
        );


        expect(
          screen.getByTestId(
            "status"
          )
        ).toHaveTextContent(
          "active"
        );
      }
    );
  }
);