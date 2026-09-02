// src/components/admin/ProfileVariantPublicationPanel.test.js

import {
  fireEvent,
  render,
  screen,
} from "@testing-library/react";

import ProfileVariantPublicationPanel from "./ProfileVariantPublicationPanel";

import {
  buildProfilePublicationPackage,
  publishProfilePublication,
} from "../../profile/publish";

import {
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
  })
);


const SOURCE_ID =
  "prv_source";


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
          <ProfileVariantPublicationPanel />
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
          <ProfileVariantPublicationPanel />
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
          <ProfileVariantPublicationPanel />
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
  }
);
