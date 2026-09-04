// src/components/admin/ProfileVariantPublicationPanel.test.js

import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";

import ProfileVariantPublicationPanel from "./ProfileVariantPublicationPanel";

import {
  buildProfilePublicationPackage,
  publishProfilePublication,
} from "../../profile/publish";

import {
  activateProfileVariant,
  getProfileVariant,
} from "../../utils/snapshots/snapshotsApi";

import {
  buildProfileContent,
} from "../../profile/content";


jest.mock(
  "../../profile/publish",
  () => ({
    buildProfilePublicationPackage:
      jest.fn(),

    publishProfilePublication:
      jest.fn(),
  })
);


jest.mock(
  "../../utils/snapshots/snapshotsApi",
  () => ({
    getProfileVariant:
      jest.fn(),

    activateProfileVariant:
      jest.fn(),
  })
);


const SOURCE_ID =
  "prv_source";


function stubLoadProfileVariants(
  variants = []
) {
  return jest
    .fn()
    .mockResolvedValue({
      ok:
        true,

      variants,

      nextToken:
        null,
    });
}


function sourceResponse() {
  return {
    ok:
      true,

    variant: {
      profileVariantId:
        SOURCE_ID,

      contentHash:
        "a".repeat(
          64
        ),

      targeting: {
        location:
          "Bangalore, India",

        jobRole:
          "Backend / Infrastructure Engineer",
      },

      provenance: {
        gitSha:
          "1".repeat(
            40
          ),
      },

      content:
        buildProfileContent(),

      assets: [
        {
          id:
            "resume.primary",

          kind:
            "resume_pdf",

          objectKey:
            "assets/sha256/deadbeef/application_pdf",

          sha256:
            "deadbeef".repeat(
              8
            ),

          contentType:
            "application/pdf",
        },
      ],
    },
  };
}


async function loadSource() {
  fireEvent.change(
    screen.getByLabelText(
      "Source Profile Variant ID"
    ),
    {
      target: {
        value:
          SOURCE_ID,
      },
    }
  );


  fireEvent.click(
    screen.getByRole(
      "button",
      {
        name:
          "Load source content",
      }
    )
  );


  await screen.findByText(
    "Bangalore, India · Backend / Infrastructure Engineer"
  );
}


beforeEach(
  () => {
    jest.clearAllMocks();


    getProfileVariant
      .mockResolvedValue(
        sourceResponse()
      );
  }
);


describe(
  "ProfileVariantPublicationPanel",
  () => {
    test(
      "loads source targeting as the editable defaults for the new variant",
      async () => {
        render(
          <ProfileVariantPublicationPanel
            activeProfileVariantId={
              SOURCE_ID
            }
            loadProfileVariants={stubLoadProfileVariants()}
          />
        );


        await loadSource();


        expect(
          screen.getByLabelText(
            "New target location"
          ).value
        ).toBe(
          "Bangalore, India"
        );


        expect(
          screen.getByLabelText(
            "New target job role"
          ).value
        ).toBe(
          "Backend / Infrastructure Engineer"
        );
      }
    );


    test(
      "blocks validation when the new target location is cleared",
      async () => {
        render(
          <ProfileVariantPublicationPanel
            loadProfileVariants={stubLoadProfileVariants()}
          />
        );


        await loadSource();


        fireEvent.change(
          screen.getByLabelText(
            "New target location"
          ),
          {
            target: {
              value:
                "",
            },
          }
        );


        fireEvent.click(
          screen.getByRole(
            "button",
            {
              name:
                "Validate",
            }
          )
        );


        expect(
          await screen.findByText(
            /Target location is required\./
          )
        ).toBeInTheDocument();


        expect(
          screen.getByRole(
            "button",
            {
              name:
                "Publish new Profile Variant",
            }
          )
        ).toBeDisabled();


        expect(
          buildProfilePublicationPackage
        ).not.toHaveBeenCalled();
      }
    );


    test(
      "publishes with reused content/assets under new targeting after validation",
      async () => {
        buildProfilePublicationPackage
          .mockResolvedValue({
            schema:
              "tejas-profile.profile-publication-package",

            variant: {
              profileVariantId:
                "prv_retargeted",
            },
          });


        publishProfilePublication
          .mockResolvedValue({
            ok:
              true,

            profileVariantId:
              "prv_retargeted",

            contentHash:
              "b".repeat(
                64
              ),
          });


        render(
          <ProfileVariantPublicationPanel
            loadProfileVariants={stubLoadProfileVariants()}
          />
        );


        await loadSource();


        fireEvent.change(
          screen.getByLabelText(
            "New target location"
          ),
          {
            target: {
              value:
                "Austin, TX",
            },
          }
        );


        fireEvent.change(
          screen.getByLabelText(
            "New target job role"
          ),
          {
            target: {
              value:
                "Platform Engineer",
            },
          }
        );


        fireEvent.click(
          screen.getByRole(
            "button",
            {
              name:
                "Validate",
            }
          )
        );


        await screen.findByText(
          "Ready to publish."
        );


        fireEvent.click(
          screen.getByRole(
            "button",
            {
              name:
                "Publish new Profile Variant",
            }
          )
        );


        await screen.findByText(
          "Published"
        );


        expect(
          screen.getAllByText(
            "prv_retargeted"
          ).length
        ).toBeGreaterThan(
          0
        );


        expect(
          buildProfilePublicationPackage
        ).toHaveBeenCalledTimes(
          1
        );


        const call =
          buildProfilePublicationPackage
            .mock
            .calls[0][0];


        expect(
          call
            .draft
            .targeting
        ).toEqual({
          location:
            "Austin, TX",

          jobRole:
            "Platform Engineer",
        });


        expect(
          call
            .draft
            .content
        ).toEqual(
          buildProfileContent()
        );


        expect(
          call
            .assetUploads
        ).toEqual(
          sourceResponse()
            .variant
            .assets
        );


        expect(
          call
            .provenance
        ).toEqual(
          sourceResponse()
            .variant
            .provenance
        );


        expect(
          publishProfilePublication
        ).toHaveBeenCalledTimes(
          1
        );
      }
    );


    test(
      "a shortcut button activates the newly-published variant straight into PROD",
      async () => {
        buildProfilePublicationPackage
          .mockResolvedValue({
            schema:
              "tejas-profile.profile-publication-package",

            variant: {
              profileVariantId:
                "prv_retargeted",
            },
          });


        publishProfilePublication
          .mockResolvedValue({
            ok:
              true,

            profileVariantId:
              "prv_retargeted",

            contentHash:
              "b".repeat(
                64
              ),
          });


        activateProfileVariant
          .mockResolvedValue({
            ok:
              true,

            active: {
              profileVariantId:
                "prv_retargeted",

              revision:
                4,
            },
          });


        const onRefreshActiveProfile =
          jest.fn().mockResolvedValue();


        render(
          <ProfileVariantPublicationPanel
            activeProfileVariantId="prv_test"
            activeProfile={
              {
                profileVariantId:
                  "prv_test",

                revision:
                  3,
              }
            }
            onRefreshActiveProfile={
              onRefreshActiveProfile
            }
            loadProfileVariants={stubLoadProfileVariants()}
          />
        );


        await loadSource();


        fireEvent.change(
          screen.getByLabelText(
            "New target location"
          ),
          {
            target: {
              value:
                "Austin, TX",
            },
          }
        );


        fireEvent.change(
          screen.getByLabelText(
            "New target job role"
          ),
          {
            target: {
              value:
                "Platform Engineer",
            },
          }
        );


        fireEvent.click(
          screen.getByRole(
            "button",
            {
              name:
                "Validate",
            }
          )
        );


        await screen.findByText(
          "Ready to publish."
        );


        fireEvent.click(
          screen.getByRole(
            "button",
            {
              name:
                "Publish new Profile Variant",
            }
          )
        );


        await screen.findByText(
          "Published"
        );


        fireEvent.click(
          screen.getByRole(
            "button",
            {
              name:
                "Activate to PROD",
            }
          )
        );


        fireEvent.click(
          screen.getByRole(
            "button",
            {
              name:
                "Confirm activate",
            }
          )
        );


        await waitFor(
          () => {
            expect(
              activateProfileVariant
            ).toHaveBeenCalledWith(
              {
                profileVariantId:
                  "prv_retargeted",

                expectedRevision:
                  3,
              }
            );
          }
        );


        expect(
          onRefreshActiveProfile
        ).toHaveBeenCalledTimes(
          1
        );


        expect(
          await screen.findByText(
            "Published & activated"
          )
        ).toBeInTheDocument();
      }
    );


    test(
      "surfaces a publish failure without crashing",
      async () => {
        buildProfilePublicationPackage
          .mockResolvedValue({
            variant: {
              profileVariantId:
                "prv_retargeted",
            },
          });


        publishProfilePublication
          .mockRejectedValue(
            new Error(
              "profileVariantId already exists with different immutable content."
            )
          );


        render(
          <ProfileVariantPublicationPanel
            loadProfileVariants={stubLoadProfileVariants()}
          />
        );


        await loadSource();


        fireEvent.click(
          screen.getByRole(
            "button",
            {
              name:
                "Validate",
            }
          )
        );


        await screen.findByText(
          "Ready to publish."
        );


        fireEvent.click(
          screen.getByRole(
            "button",
            {
              name:
                "Publish new Profile Variant",
            }
          )
        );


        expect(
          await screen.findByText(
            /profileVariantId already exists with different immutable content\./
          )
        ).toBeInTheDocument();
      }
    );


    test(
      "auto-suggests a new Profile Variant ID from location + job role, following the prv_<location>_<jobRole>_<timestamp> convention, and keeps it in sync until manually edited",
      async () => {
        render(
          <ProfileVariantPublicationPanel
            loadProfileVariants={stubLoadProfileVariants()}
          />
        );


        await loadSource();


        const idInput =
          screen.getByLabelText(
            "New Profile Variant ID"
          );


        await waitFor(
          () => {
            expect(
              idInput.value
            ).toMatch(
              /^prv_bangalore_india_backend_infrastructure_engineer_\d{8}T\d{6}Z$/
            );
          }
        );


        fireEvent.change(
          screen.getByLabelText(
            "New target location"
          ),
          {
            target: {
              value:
                "Austin, TX",
            },
          }
        );


        await waitFor(
          () => {
            expect(
              idInput.value
            ).toMatch(
              /^prv_austin_tx_backend_infrastructure_engineer_\d{8}T\d{6}Z$/
            );
          }
        );
      }
    );


    test(
      "manually editing the Profile Variant ID stops it from auto-updating when location/job role change afterward",
      async () => {
        render(
          <ProfileVariantPublicationPanel
            loadProfileVariants={stubLoadProfileVariants()}
          />
        );


        await loadSource();


        const idInput =
          screen.getByLabelText(
            "New Profile Variant ID"
          );


        fireEvent.change(
          idInput,
          {
            target: {
              value:
                "prv_my_custom_id",
            },
          }
        );


        expect(
          screen.getByText(
            "Edited manually — no longer auto-updates from location/job role."
          )
        ).toBeInTheDocument();


        fireEvent.change(
          screen.getByLabelText(
            "New target location"
          ),
          {
            target: {
              value:
                "Austin, TX",
            },
          }
        );


        expect(
          idInput.value
        ).toBe(
          "prv_my_custom_id"
        );
      }
    );


    test(
      "offers previously-used location and job role values as autocomplete suggestions",
      async () => {
        const { container } =
          render(
            <ProfileVariantPublicationPanel
              loadProfileVariants={stubLoadProfileVariants(
                [
                  {
                    profileVariantId:
                      "prv_a",

                    targeting: {
                      location:
                        "Austin, TX",

                      jobRole:
                        "Platform Engineer",
                    },
                  },

                  {
                    profileVariantId:
                      "prv_b",

                    targeting: {
                      location:
                        "Pune, India",

                      jobRole:
                        "AI Engineer",
                    },
                  },
                ]
              )}
            />
          );


        await loadSource();


        await waitFor(
          () => {
            const locationOptions =
              Array.from(
                container.querySelectorAll(
                  "#profile-variant-publication-known-locations option"
                )
              ).map(
                (
                  option
                ) =>
                  option.value
              );

            expect(
              locationOptions
            ).toEqual(
              expect.arrayContaining(
                [
                  "Austin, TX",
                  "Pune, India",
                ]
              )
            );
          }
        );


        const jobRoleOptions =
          Array.from(
            container.querySelectorAll(
              "#profile-variant-publication-known-job-roles option"
            )
          ).map(
            (
              option
            ) =>
              option.value
          );

        expect(
          jobRoleOptions
        ).toEqual(
          expect.arrayContaining(
            [
              "Platform Engineer",
              "AI Engineer",
            ]
          )
        );
      }
    );


    test(
      "seedPublishResult from an external publish (e.g. the Data page's draft editor) surfaces through this card's Published/Activate UI",
      async () => {
        const { rerender } =
          render(
            <ProfileVariantPublicationPanel
              activeProfileVariantId="prv_test"
              activeProfile={
                {
                  profileVariantId:
                    "prv_test",

                  revision:
                    3,
                }
              }
              loadProfileVariants={stubLoadProfileVariants()}
            />
          );

        expect(
          screen.queryByText(
            "Published"
          )
        ).not.toBeInTheDocument();

        rerender(
          <ProfileVariantPublicationPanel
            activeProfileVariantId="prv_test"
            activeProfile={
              {
                profileVariantId:
                  "prv_test",

                revision:
                  3,
              }
            }
            loadProfileVariants={stubLoadProfileVariants()}
            seedPublishResult={
              {
                profileVariantId:
                  "prv_from_data_page",

                contentHash:
                  "c".repeat(
                    64
                  ),
              }
            }
          />
        );

        expect(
          await screen.findByText(
            "Published"
          )
        ).toBeInTheDocument();

        expect(
          screen.getAllByText(
            "prv_from_data_page"
          ).length
        ).toBeGreaterThan(
          0
        );

        expect(
          screen.getByRole(
            "button",
            {
              name:
                "Activate to PROD",
            }
          )
        ).toBeInTheDocument();
      }
    );
  }
);
