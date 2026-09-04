// src/components/admin/ProfileVariantActivationPanel.test.js

import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";

import ProfileVariantActivationPanel from "./ProfileVariantActivationPanel";

import {
  activateProfileVariant,
  createDeploymentConfiguration,
  getProfileVariant,
} from "../../utils/snapshots/snapshotsApi";


jest.mock(
  "../../utils/snapshots/snapshotsApi",
  () => ({
    activateProfileVariant:
      jest.fn(),

    createDeploymentConfiguration:
      jest.fn(),

    getProfileVariant:
      jest.fn(),
  })
);


const TARGET_ID =
  "prv_target";


const TARGET_RESPONSE = {
  ok:
    true,

  manifestSha256:
    "a".repeat(
      64
    ),

  variant: {
    profileVariantId:
      TARGET_ID,

    contentHash:
      "b".repeat(
        64
      ),

    createdAt:
      "2026-08-23T00:00:00.000Z",

    targeting: {
      location:
        "Austin, TX",

      jobRole:
        "Software Engineer",
    },
  },
};


async function loadTargetVariant() {
  fireEvent.change(
    screen.getByLabelText(
      "Published Profile Variant ID"
    ),
    {
      target: {
        value:
          TARGET_ID,
      },
    }
  );


  fireEvent.click(
    screen.getByRole(
      "button",
      {
        name:
          "Load variant",
      }
    )
  );


  await screen.findByText(
    /Austin, TX/
  );
}


async function confirmActivation() {
  fireEvent.click(
    screen.getByRole(
      "button",
      {
        name:
          "Review activation",
      }
    )
  );


  fireEvent.click(
    screen.getByRole(
      "button",
      {
        name:
          "Activate Profile Variant",
      }
    )
  );
}


beforeEach(
  () => {
    jest.clearAllMocks();


    getProfileVariant
      .mockResolvedValue(
        TARGET_RESPONSE
      );


    activateProfileVariant
      .mockResolvedValue({
        ok:
          true,

        active: {
          profileVariantId:
            TARGET_ID,

          revision:
            1,
        },
      });
  }
);


describe(
  "ProfileVariantActivationPanel",
  () => {
    test(
      "uses expectedRevision 0 when no ACTIVE pointer was observed",
      async () => {
        const refresh =
          jest
            .fn()
            .mockResolvedValue();


        render(
          <ProfileVariantActivationPanel
            active={
              null
            }
            activeProfileVariantId=""
            onRefreshActiveProfile={
              refresh
            }
          />
        );


        expect(
          screen.getByText(
            "0 (no active pointer)"
          )
        ).toBeInTheDocument();


        await loadTargetVariant();

        await confirmActivation();


        await waitFor(
          () => {
            expect(
              activateProfileVariant
            ).toHaveBeenCalledWith({
              profileVariantId:
                TARGET_ID,

              expectedRevision:
                0,
            });
          }
        );


        expect(
          activateProfileVariant
        ).toHaveBeenCalledTimes(
          1
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
      "uses the observed ACTIVE revision when a pointer already exists",
      async () => {
        const refresh =
          jest
            .fn()
            .mockResolvedValue();


        render(
          <ProfileVariantActivationPanel
            active={{
              profileVariantId:
                "prv_current",

              revision:
                7,
            }}
            activeProfileVariantId="prv_current"
            onRefreshActiveProfile={
              refresh
            }
          />
        );


        await loadTargetVariant();

        await confirmActivation();


        await waitFor(
          () => {
            expect(
              activateProfileVariant
            ).toHaveBeenCalledWith({
              profileVariantId:
                TARGET_ID,

              expectedRevision:
                7,
            });
          }
        );
      }
    );


    test(
        "reflects the newly ACTIVE variant after the runtime refresh updates parent state",
        async () => {
            const refresh =
            jest
                .fn()
                .mockResolvedValue();


            const {
            rerender,
            } =
            render(
                <ProfileVariantActivationPanel
                active={{
                    profileVariantId:
                    "prv_current",

                    revision:
                    2,
                }}
                activeProfileVariantId="prv_current"
                onRefreshActiveProfile={
                    refresh
                }
                />
            );


            await loadTargetVariant();

            await confirmActivation();


            await waitFor(
            () => {
                expect(
                activateProfileVariant
                ).toHaveBeenCalledWith({
                profileVariantId:
                    TARGET_ID,

                expectedRevision:
                    2,
                });
            }
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


            /**
             * Simulate ProfileRuntimeContext.refresh() completing and
             * propagating the new ACTIVE pointer back through App.js.
             */
            rerender(
            <ProfileVariantActivationPanel
                active={{
                profileVariantId:
                    TARGET_ID,

                revision:
                    3,
                }}
                activeProfileVariantId={
                TARGET_ID
                }
                onRefreshActiveProfile={
                refresh
                }
            />
            );


            const alreadyActiveButton =
            screen.getByRole(
                "button",
                {
                name:
                    "Already active",
                }
            );


            expect(
            alreadyActiveButton
            ).toBeDisabled();


            expect(
            screen.getByText(
                `Profile Variant "${TARGET_ID}" is now active.`
            )
            ).toBeInTheDocument();


            expect(
            activateProfileVariant
            ).toHaveBeenCalledTimes(
            1
            );
        }
        );


    test(
      "refreshes ACTIVE state on a 409 conflict without automatically retrying",
      async () => {
        const conflict =
          new Error(
            "Profile activation revision conflict."
          );


        conflict.code =
          "PROFILE_ACTIVATION_CONFLICT";

        conflict.status =
          409;


        activateProfileVariant
          .mockRejectedValueOnce(
            conflict
          );


        const refresh =
          jest
            .fn()
            .mockResolvedValue();


        render(
          <ProfileVariantActivationPanel
            active={{
              profileVariantId:
                "prv_current",

              revision:
                4,
            }}
            activeProfileVariantId="prv_current"
            onRefreshActiveProfile={
              refresh
            }
          />
        );


        await loadTargetVariant();

        await confirmActivation();


        await screen.findByText(
          /Active Profile changed before this activation committed/
        );


        expect(
          activateProfileVariant
        ).toHaveBeenCalledTimes(
          1
        );


        expect(
          refresh
        ).toHaveBeenCalledTimes(
          1
        );
      }
    );


    test(
      "offers to create the Deployment Configuration when activation fails because one is missing",
      async () => {
        const missing =
          new Error(
            "Deployment Configuration for the active Platform Release and requested Profile Variant does not exist."
          );


        missing.code =
          "DEPLOYMENT_CONFIGURATION_MISSING";

        missing.status =
          409;

        missing.platformReleaseId =
          "plr_test";

        missing.profileVariantId =
          TARGET_ID;


        activateProfileVariant
          .mockRejectedValueOnce(
            missing
          );

        createDeploymentConfiguration
          .mockResolvedValueOnce(
            {
              ok:
                true,
            }
          );


        render(
          <ProfileVariantActivationPanel
            active={{
              profileVariantId:
                "prv_current",

              revision:
                4,
            }}
            activeProfileVariantId="prv_current"
          />
        );


        await loadTargetVariant();

        await confirmActivation();


        await screen.findByText(
          missing.message
        );

        expect(
          screen.queryByText(
            /Active Profile changed before this activation committed/
          )
        ).not.toBeInTheDocument();


        fireEvent.click(
          screen.getByRole(
            "button",
            {
              name:
                "Create Deployment Configuration",
            }
          )
        );


        await waitFor(
          () => {
            expect(
              createDeploymentConfiguration
            ).toHaveBeenCalledWith(
              {
                platformReleaseId:
                  "plr_test",

                profileVariantId:
                  TARGET_ID,
              }
            );
          }
        );


        expect(
          screen.queryByRole(
            "button",
            {
              name:
                "Create Deployment Configuration",
            }
          )
        ).not.toBeInTheDocument();
      }
    );


    test(
        "uses the refreshed ACTIVE revision only after an explicit retry following a conflict",
        async () => {
            const conflict =
            new Error(
                "Profile activation revision conflict."
            );


            conflict.code =
            "PROFILE_ACTIVATION_CONFLICT";

            conflict.status =
            409;


            activateProfileVariant
            .mockRejectedValueOnce(
                conflict
            );


            const refresh =
            jest
                .fn()
                .mockResolvedValue();


            const {
            rerender,
            } =
            render(
                <ProfileVariantActivationPanel
                active={{
                    profileVariantId:
                    "prv_current",

                    revision:
                    4,
                }}
                activeProfileVariantId="prv_current"
                onRefreshActiveProfile={
                    refresh
                }
                />
            );


            await loadTargetVariant();

            await confirmActivation();


            await screen.findByText(
            /Active Profile changed before this activation committed/
            );


            /**
             * The conflict itself must never cause an automatic retry.
             */
            expect(
            activateProfileVariant
            ).toHaveBeenCalledTimes(
            1
            );


            expect(
            activateProfileVariant
            ).toHaveBeenNthCalledWith(
            1,
            {
                profileVariantId:
                TARGET_ID,

                expectedRevision:
                4,
            }
            );


            expect(
            refresh
            ).toHaveBeenCalledTimes(
            1
            );


            /**
             * Simulate the refreshed ACTIVE pointer showing that another
             * owner/device advanced the revision.
             */
            rerender(
            <ProfileVariantActivationPanel
                active={{
                profileVariantId:
                    "prv_other",

                revision:
                    5,
                }}
                activeProfileVariantId="prv_other"
                onRefreshActiveProfile={
                refresh
                }
            />
            );


            activateProfileVariant
            .mockResolvedValueOnce({
                ok:
                true,

                active: {
                profileVariantId:
                    TARGET_ID,

                revision:
                    6,
                },
            });


            /**
             * This second click is the owner's explicit retry.
             */
            fireEvent.click(
            screen.getByRole(
                "button",
                {
                name:
                    "Activate Profile Variant",
                }
            )
            );


            await waitFor(
            () => {
                expect(
                activateProfileVariant
                ).toHaveBeenCalledTimes(
                2
                );
            }
            );


            expect(
            activateProfileVariant
            ).toHaveBeenNthCalledWith(
            2,
            {
                profileVariantId:
                TARGET_ID,

                expectedRevision:
                5,
            }
            );
        }
        );


    test(
      "does not offer activation when the loaded variant is already ACTIVE",
      async () => {
        render(
          <ProfileVariantActivationPanel
            active={{
              profileVariantId:
                TARGET_ID,

              revision:
                3,
            }}
            activeProfileVariantId={
              TARGET_ID
            }
            onRefreshActiveProfile={
              jest.fn()
            }
          />
        );


        await loadTargetVariant();


        const button =
          screen.getByRole(
            "button",
            {
              name:
                "Already active",
            }
          );


        expect(
          button
        ).toBeDisabled();


        expect(
          activateProfileVariant
        ).not.toHaveBeenCalled();
      }
    );
  }
);