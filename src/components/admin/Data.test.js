// src/components/admin/Data.test.js

import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";

import AdminData from "./Data";

import {
  getProfileVariant,
} from "../../utils/snapshots/snapshotsApi";

import {
  createProfileDraft,
  saveDraftToStorage,
  updateProfileDraft,
} from "../../profile/draft";


jest.mock(
  "../../utils/snapshots/snapshotsApi",
  () => ({
    getProfileVariant:
      jest.fn(),
  })
);


const RESUME_ASSET_SHA256 =
  "a".repeat(64);


function mockVariant(
  overrides = {}
) {
  return {
    profileVariantId:
      "prv_test",

    contentSchemaVersion:
      1,

    createdAt:
      "2026-08-30T14:11:57.000Z",

    targeting: {
      location:
        "Bangalore, India",

      jobRole:
        "Backend / Infrastructure Engineer",
    },

    content: {
      hero: {
        greeting:
          "Hi, I'm",

        name:
          "Tejas Raut",

        rotatingTitles:
          [
            {
              id:
                "t1",

              text:
                "Software Engineer",
            },
          ],
      },

      resume: {
        pdfAssetId:
          "resume.primary",

        header: {
          name:
            "Tejas Raut",
        },
      },

      experience: [
        {
          company:
            "Acme Corp",

          role:
            "Backend Engineer",

          employmentType:
            "Full-time",

          duration:
            "2023 - 2025",

          location:
            "Remote",

          highlights:
            [
              "Built X",
              "Shipped Y",
            ],

          tags:
            [
              "AWS",
              "Node",
            ],
        },
      ],

      education: [
        {
          school:
            "State University",

          degree:
            "B.S. Computer Science",

          attachment: {
            title:
              "Special Achiever",

            assetId:
              "education.special-achiever",
          },
        },
      ],

      ...overrides,
    },

    assets: [
      {
        id:
          "resume.primary",

        kind:
          "resume_pdf",

        objectKey:
          "assets/sha256/aaaa/application_pdf",

        sha256:
          RESUME_ASSET_SHA256,

        contentType:
          "application/pdf",
      },
    ],
  };
}


beforeEach(
  () => {
    jest.clearAllMocks();

    window.localStorage.clear();
  }
);


test(
  "shows a message when no active Profile Variant is configured",
  () => {
    render(
      <AdminData />
    );

    expect(
      screen.getByText(
        "No active Profile Variant is configured."
      )
    ).toBeInTheDocument();

    expect(
      getProfileVariant
    ).not.toHaveBeenCalled();
  }
);


test(
  "loads the active Profile Variant and displays header context",
  async () => {
    getProfileVariant
      .mockResolvedValue(
        {
          ok:
            true,

          variant:
            mockVariant(),
        }
      );

    render(
      <AdminData
        activeProfileVariantId="prv_test"
        activeProfileTargeting={{
          location:
            "Bangalore, India",

          jobRole:
            "Backend / Infrastructure Engineer",
        }}
      />
    );

    expect(
      getProfileVariant
    ).toHaveBeenCalledWith(
      "prv_test"
    );

    expect(
      await screen.findByText(
        "v1"
      )
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        "prv_test"
      )
    ).toBeInTheDocument();
  }
);


test(
  "renders the default section's fields and switches sections on click",
  async () => {
    getProfileVariant
      .mockResolvedValue(
        {
          ok:
            true,

          variant:
            mockVariant(),
        }
      );

    render(
      <AdminData
        activeProfileVariantId="prv_test"
      />
    );

    expect(
      await screen.findByText(
        "Tejas Raut"
      )
    ).toBeInTheDocument();


    fireEvent.click(
      screen.getByRole(
        "button",
        {
          name:
            "Experience",
        }
      )
    );

    expect(
      await screen.findByText(
        "Acme Corp"
      )
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        "Built X"
      )
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        "AWS"
      )
    ).toBeInTheDocument();
  }
);


test(
  "renders a nested object field and cross-references asset metadata",
  async () => {
    getProfileVariant
      .mockResolvedValue(
        {
          ok:
            true,

          variant:
            mockVariant(),
        }
      );

    render(
      <AdminData
        activeProfileVariantId="prv_test"
      />
    );

    fireEvent.click(
      await screen.findByRole(
        "button",
        {
          name:
            "Resume",
        }
      )
    );

    // Nested object field (resume.header.name).
    expect(
      await screen.findByText(
        "Tejas Raut"
      )
    ).toBeInTheDocument();

    // Asset field cross-referenced against variant.assets.
    expect(
      screen.getByText(
        "resume.primary"
      )
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        /resume_pdf/
      )
    ).toBeInTheDocument();
  }
);


test(
  "flags an asset field referenced by content but missing from the variant's published assets",
  async () => {
    getProfileVariant
      .mockResolvedValue(
        {
          ok:
            true,

          variant:
            mockVariant(),
        }
      );

    render(
      <AdminData
        activeProfileVariantId="prv_test"
      />
    );

    fireEvent.click(
      await screen.findByRole(
        "button",
        {
          name:
            "Education",
        }
      )
    );

    expect(
      await screen.findByText(
        "education.special-achiever"
      )
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        "Referenced but not found among this variant's published assets."
      )
    ).toBeInTheDocument();
  }
);


test(
  "Structure view lists sections read-only, excluding the admin group",
  async () => {
    getProfileVariant
      .mockResolvedValue(
        {
          ok:
            true,

          variant:
            mockVariant(),
        }
      );

    render(
      <AdminData
        activeProfileVariantId="prv_test"
      />
    );

    fireEvent.click(
      await screen.findByRole(
        "button",
        {
          name:
            "Names, order & visibility",
        }
      )
    );

    // "About Me" now appears twice: the left-nav Content button
    // (still visible) and the read-only Structure list item.
    expect(
      screen.getAllByText(
        "About Me"
      ).length
    ).toBeGreaterThanOrEqual(
      2
    );

    expect(
      screen.queryByText(
        "Snapshots"
      )
    ).not.toBeInTheDocument();
  }
);


test(
  "Assets view consolidates object-group asset fields",
  async () => {
    getProfileVariant
      .mockResolvedValue(
        {
          ok:
            true,

          variant:
            mockVariant(),
        }
      );

    render(
      <AdminData
        activeProfileVariantId="prv_test"
      />
    );

    fireEvent.click(
      await screen.findByRole(
        "button",
        {
          name:
            "Documents & images",
        }
      )
    );

    expect(
      await screen.findByText(
        "Resume PDF"
      )
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        "resume.primary"
      )
    ).toBeInTheDocument();
  }
);


test(
  "surfaces a fetch error without crashing",
  async () => {
    getProfileVariant
      .mockRejectedValue(
        new Error(
          "Profile Variant read failed (404)"
        )
      );

    render(
      <AdminData
        activeProfileVariantId="prv_test"
      />
    );

    expect(
      await screen.findByText(
        "Profile Variant read failed (404)"
      )
    ).toBeInTheDocument();
  }
);


test(
  "Start draft makes a plain-text field editable and typing updates it live",
  async () => {
    getProfileVariant
      .mockResolvedValue(
        {
          ok:
            true,

          variant:
            mockVariant(),
        }
      );

    render(
      <AdminData
        activeProfileVariantId="prv_test"
      />
    );

    await screen.findByText(
      "Tejas Raut"
    );

    expect(
      screen.getByText(
        "Hi, I'm"
      )
    ).toBeInTheDocument();


    fireEvent.click(
      screen.getByRole(
        "button",
        {
          name:
            "Start draft",
        }
      )
    );

    expect(
      await screen.findByRole(
        "button",
        {
          name:
            "Discard draft",
        }
      )
    ).toBeInTheDocument();


    const greetingInput =
      await screen.findByDisplayValue(
        "Hi, I'm"
      );

    fireEvent.change(
      greetingInput,
      {
        target: {
          value:
            "Hello there",
        },
      }
    );

    expect(
      greetingInput.value
    ).toBe(
      "Hello there"
    );


    expect(
      await screen.findByText(
        "Draft — ready"
      )
    ).toBeInTheDocument();
  }
);


test(
  "resuming a previously saved draft restores its edited value and clears the resumable banner",
  async () => {
    const variant =
      mockVariant();

    getProfileVariant
      .mockResolvedValue(
        {
          ok:
            true,

          variant,
        }
      );

    const seedDraft =
      createProfileDraft(
        {
          draftId:
            "draft_seed",

          baseProfileVariantId:
            "prv_test",

          targeting:
            variant.targeting,

          content:
            variant.content,

          createdAt:
            "2020-01-01T00:00:00.000Z",
        }
      );

    const editedDraft =
      updateProfileDraft(
        seedDraft,
        {
          content: {
            hero: {
              ...variant
                .content
                .hero,

              greeting:
                "Resumed greeting",
            },
          },
        },
        {
          expectedRevision:
            1,
        }
      );

    saveDraftToStorage(
      editedDraft
    );


    render(
      <AdminData
        activeProfileVariantId="prv_test"
      />
    );

    expect(
      await screen.findByText(
        "A saved draft from a previous session is available."
      )
    ).toBeInTheDocument();


    fireEvent.click(
      screen.getByRole(
        "button",
        {
          name:
            "Resume draft",
        }
      )
    );

    await waitFor(
      () => {
        expect(
          screen.queryByText(
            "A saved draft from a previous session is available."
          )
        ).not.toBeInTheDocument();
      }
    );

    expect(
      await screen.findByDisplayValue(
        "Resumed greeting"
      )
    ).toBeInTheDocument();
  }
);


test(
  "discarding a draft clears storage and returns fields to read-only",
  async () => {
    getProfileVariant
      .mockResolvedValue(
        {
          ok:
            true,

          variant:
            mockVariant(),
        }
      );

    render(
      <AdminData
        activeProfileVariantId="prv_test"
      />
    );

    await screen.findByText(
      "Tejas Raut"
    );


    fireEvent.click(
      screen.getByRole(
        "button",
        {
          name:
            "Start draft",
        }
      )
    );

    await screen.findByRole(
      "button",
      {
        name:
          "Discard draft",
      }
    );


    fireEvent.click(
      screen.getByRole(
        "button",
        {
          name:
            "Discard draft",
        }
      )
    );

    expect(
      await screen.findByRole(
        "button",
        {
          name:
            "Start draft",
        }
      )
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        "Hi, I'm"
      )
    ).toBeInTheDocument();

    expect(
      window.localStorage.getItem(
        "tejas-profile:owner-draft:prv_test"
      )
    ).toBeNull();
  }
);
