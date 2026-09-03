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

import {
  buildProfilePublicationPackage,
  publishProfilePublication,
} from "../../profile/publish";


jest.mock(
  "../../utils/snapshots/snapshotsApi",
  () => ({
    getProfileVariant:
      jest.fn(),
  })
);


jest.mock(
  "../../profile/publish",
  () => ({
    buildProfilePublicationPackage:
      jest.fn(),

    publishProfilePublication:
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


test(
  "editing a draft allows adding a new record to a top-level collection and editing its fields",
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
            "Experience",
        }
      )
    );

    await screen.findByDisplayValue(
      "Acme Corp"
    );

    expect(
      screen.getByText(
        "Experience (1)"
      )
    ).toBeInTheDocument();


    fireEvent.click(
      screen.getByRole(
        "button",
        {
          name:
            "+ Add entry",
        }
      )
    );

    expect(
      await screen.findByText(
        "Experience (2)"
      )
    ).toBeInTheDocument();


    const companyInputs =
      screen.getAllByDisplayValue(
        ""
      );

    // The newly added item's blank Company field.
    fireEvent.change(
      companyInputs[0],
      {
        target: {
          value:
            "Newco",
        },
      }
    );

    expect(
      screen.getByDisplayValue(
        "Newco"
      )
    ).toBeInTheDocument();
  }
);


test(
  "removing an item from a collection drops it from the draft",
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
            "Experience",
        }
      )
    );

    await screen.findByDisplayValue(
      "Acme Corp"
    );


    fireEvent.click(
      screen.getByRole(
        "button",
        {
          name:
            "Remove entry",
        }
      )
    );

    await waitFor(
      () => {
        expect(
          screen.queryByDisplayValue(
            "Acme Corp"
          )
        ).not.toBeInTheDocument();
      }
    );

    expect(
      screen.getByText(
        "No entries in this section yet."
      )
    ).toBeInTheDocument();
  }
);


test(
  "reordering collection items with move up/down swaps their order",
  async () => {
    getProfileVariant
      .mockResolvedValue(
        {
          ok:
            true,

          variant:
            mockVariant(
              {
                experience:
                  [
                    {
                      company:
                        "Acme Corp",

                      role:
                        "Backend Engineer",

                      employmentType:
                        "",

                      duration:
                        "",

                      location:
                        "",

                      highlights:
                        [],

                      tags:
                        [],
                    },

                    {
                      company:
                        "Globex Corp",

                      role:
                        "Platform Engineer",

                      employmentType:
                        "",

                      duration:
                        "",

                      location:
                        "",

                      highlights:
                        [],

                      tags:
                        [],
                    },
                  ],
              }
            ),
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
            "Experience",
        }
      )
    );

    await screen.findByDisplayValue(
      "Acme Corp"
    );


    function currentOrder() {
      return screen
        .getAllByDisplayValue(
          /Corp$/
        )
        .map(
          (
            el
          ) =>
            el.value
        );
    }

    expect(
      currentOrder()
    ).toEqual(
      [
        "Acme Corp",
        "Globex Corp",
      ]
    );


    fireEvent.click(
      screen.getAllByRole(
        "button",
        {
          name:
            "Move entry down",
        }
      )[0]
    );

    await waitFor(
      () => {
        expect(
          currentOrder()
        ).toEqual(
          [
            "Globex Corp",
            "Acme Corp",
          ]
        );
      }
    );
  }
);


test(
  "editing a draft makes a string-list field editable via TagEditor, supporting add and remove",
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
            "Experience",
        }
      )
    );

    await screen.findByDisplayValue(
      "Built X"
    );


    fireEvent.click(
      screen.getByRole(
        "button",
        {
          name:
            'Remove "Built X"',
        }
      )
    );

    await waitFor(
      () => {
        expect(
          screen.queryByDisplayValue(
            "Built X"
          )
        ).not.toBeInTheDocument();
      }
    );

    expect(
      screen.getByDisplayValue(
        "Shipped Y"
      )
    ).toBeInTheDocument();


    // Highlights renders before Tags in the item's field order, and
    // both are string-list fields sharing this placeholder.
    const tagInput =
      screen.getAllByPlaceholderText(
        "Add an entry…"
      )[0];

    fireEvent.change(
      tagInput,
      {
        target: {
          value:
            "Led migration",
        },
      }
    );

    fireEvent.click(
      screen.getAllByRole(
        "button",
        {
          name:
            "Add",
        }
      )[0]
    );

    expect(
      await screen.findByDisplayValue(
        "Led migration"
      )
    ).toBeInTheDocument();
  }
);


test(
  "editing a draft keeps read-only system IDs display-only and makes Project Status a constrained dropdown",
  async () => {
    getProfileVariant
      .mockResolvedValue(
        {
          ok:
            true,

          variant:
            mockVariant(
              {
                projects:
                  [
                    {
                      id:
                        "proj_1",

                      title:
                        "Portfolio Site",

                      description:
                        "",

                      techStack:
                        [],

                      domain:
                        "",

                      industry:
                        "",

                      demo:
                        "",

                      github:
                        "",

                      status:
                        "Deployed",
                    },
                  ],
              }
            ),
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
            "Projects",
        }
      )
    );

    // Still plain text, not an editable input — proves field.readOnly
    // is enforced even while a draft is active.
    expect(
      await screen.findByText(
        "proj_1"
      )
    ).toBeInTheDocument();

    const statusSelect =
      screen.getByDisplayValue(
        "Deployed"
      );

    expect(
      statusSelect.tagName
    ).toBe(
      "SELECT"
    );

    fireEvent.change(
      statusSelect,
      {
        target: {
          value:
            "In-Progress",
        },
      }
    );

    expect(
      screen.getByDisplayValue(
        "In-Progress"
      )
    ).toBeInTheDocument();
  }
);


test(
  "editing a draft makes the Code Lab snippet body editable",
  async () => {
    getProfileVariant
      .mockResolvedValue(
        {
          ok:
            true,

          variant:
            mockVariant(
              {
                codeLab:
                  [
                    {
                      id:
                        "snippet_1",

                      title:
                        "Binary search",

                      lang:
                        "python",

                      from:
                        "",

                      why:
                        "",

                      code:
                        "def f(x):\n    return x",

                      technology:
                        [],
                    },
                  ],
              }
            ),
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
            "Code Lab",
        }
      )
    );

    await screen.findByText(
      "snippet_1"
    );

    // getByDisplayValue's default normalizer collapses embedded
    // newlines, so an exact multiline match needs the textarea
    // looked up directly rather than through that text matcher.
    function findCodeTextarea() {
      return screen
        .getAllByRole(
          "textbox"
        )
        .find(
          (
            el
          ) =>
            el.tagName ===
              "TEXTAREA" &&
            el.value.includes(
              "def f(x):"
            )
        );
    }

    const codeBox =
      findCodeTextarea();

    expect(
      codeBox
    ).toBeTruthy();

    expect(
      codeBox.value
    ).toBe(
      "def f(x):\n    return x"
    );

    fireEvent.change(
      codeBox,
      {
        target: {
          value:
            "def f(x):\n    return x + 1",
        },
      }
    );

    expect(
      findCodeTextarea().value
    ).toBe(
      "def f(x):\n    return x + 1"
    );
  }
);


test(
  "editing a draft lets the Resume page's own Experience/Education/Projects/Skills sections be reordered independently of the site's Structure",
  async () => {
    getProfileVariant
      .mockResolvedValue(
        {
          ok:
            true,

          variant:
            mockVariant(
              {
                resume:
                  {
                    pdfAssetId:
                      "resume.primary",

                    header:
                      {
                        name:
                          "Tejas Raut",
                      },

                    experience:
                      [
                        {
                          company:
                            "Acme Corp",

                          title:
                            "Engineer",

                          location:
                            "Remote",

                          dates:
                            "2023 - 2025",

                          bullets:
                            [],
                        },
                      ],

                    education:
                      [
                        {
                          school:
                            "State University",

                          location:
                            "",

                          date:
                            "",

                          degree:
                            "",

                          program:
                            "",
                        },
                      ],

                    skills:
                      {},

                    projects:
                      [
                        {
                          name:
                            "Portfolio",

                          dates:
                            "",

                          stack:
                            [],

                          bullets:
                            [],
                        },
                      ],
                  },
              }
            ),
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
            "Resume",
        }
      )
    );

    function resumeSectionOrder() {
      return screen
        .getAllByText(
          /^Resume (Experience|Education|Projects) \(1\)$/
        )
        .map(
          (
            el
          ) =>
            el.textContent
        );
    }

    await waitFor(
      () => {
        expect(
          resumeSectionOrder()
        ).toEqual(
          [
            "Resume Experience (1)",
            "Resume Education (1)",
            "Resume Projects (1)",
          ]
        );
      }
    );

    fireEvent.click(
      screen.getByRole(
        "button",
        {
          name:
            "Move the Resume Education section up",
        }
      )
    );

    await waitFor(
      () => {
        expect(
          resumeSectionOrder()
        ).toEqual(
          [
            "Resume Education (1)",
            "Resume Experience (1)",
            "Resume Projects (1)",
          ]
        );
      }
    );
  }
);


beforeEach(
  () => {
    buildProfilePublicationPackage
      .mockReset();

    publishProfilePublication
      .mockReset();
  }
);


test(
  "publishing a ready draft shows a diff review, mints a new Profile Variant on confirm, and clears the draft",
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

    buildProfilePublicationPackage
      .mockResolvedValue(
        {
          schema:
            "tejas-profile.profile-publication-package",

          variant: {
            profileVariantId:
              "prv_republished",
          },
        }
      );

    publishProfilePublication
      .mockResolvedValue(
        {
          ok:
            true,

          profileVariantId:
            "prv_republished",

          contentHash:
            "b".repeat(
              64
            ),
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

    fireEvent.click(
      await screen.findByRole(
        "button",
        {
          name:
            "Publish…",
        }
      )
    );

    expect(
      await screen.findByText(
        "hero.greeting"
      )
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole(
        "button",
        {
          name:
            "Confirm & publish",
        }
      )
    );

    expect(
      await screen.findByText(
        "prv_republished"
      )
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        /is now stored\. It is not yet live/
      )
    ).toBeInTheDocument();

    // Draft was cleared by the publish -- back to a clean, no-draft view.
    expect(
      screen.queryByRole(
        "button",
        {
          name:
            "Discard draft",
        }
      )
    ).not.toBeInTheDocument();

    expect(
      screen.getByRole(
        "button",
        {
          name:
            "Start draft",
        }
      )
    ).toBeInTheDocument();
  }
);


test(
  "a failed publish keeps the draft intact and surfaces the error",
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

    buildProfilePublicationPackage
      .mockResolvedValue(
        {
          schema:
            "tejas-profile.profile-publication-package",

          variant: {
            profileVariantId:
              "prv_republished",
          },
        }
      );

    publishProfilePublication
      .mockRejectedValue(
        new Error(
          "network error"
        )
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

    fireEvent.click(
      await screen.findByRole(
        "button",
        {
          name:
            "Publish…",
        }
      )
    );

    fireEvent.click(
      await screen.findByRole(
        "button",
        {
          name:
            "Confirm & publish",
        }
      )
    );

    expect(
      await screen.findByText(
        "network error"
      )
    ).toBeInTheDocument();

    // Draft survives a failed publish -- nothing was discarded.
    expect(
      screen.getByRole(
        "button",
        {
          name:
            "Discard draft",
        }
      )
    ).toBeInTheDocument();

    expect(
      screen.getByDisplayValue(
        "Hello there"
      )
    ).toBeInTheDocument();
  }
);


test(
  "Resume Skills (a record-string-list) renders its grouped tags instead of appearing empty",
  async () => {
    getProfileVariant
      .mockResolvedValue(
        {
          ok:
            true,

          variant:
            mockVariant(
              {
                resume:
                  {
                    pdfAssetId:
                      "resume.primary",

                    header:
                      {
                        name:
                          "Tejas Raut",
                      },

                    skills:
                      {
                        Cloud:
                          [
                            "AWS",
                            "GCP",
                          ],

                        Languages:
                          [
                            "Python",
                          ],
                      },
                  },
              }
            ),
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
            "Resume",
        }
      )
    );

    expect(
      await screen.findByText(
        "Cloud"
      )
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        "AWS"
      )
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        "GCP"
      )
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        "Languages"
      )
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        "Python"
      )
    ).toBeInTheDocument();
  }
);


test(
  "editing a draft allows reordering, recategorizing, hiding, and showing sections in Structure",
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
            "Names, order & visibility",
        }
      )
    );

    function categoryOrder() {
      return screen
        .getAllByRole(
          "combobox"
        )
        .map(
          (
            el
          ) =>
            el.getAttribute(
              "aria-label"
            )
        );
    }

    await waitFor(
      () => {
        expect(
          categoryOrder()[0]
        ).toBe(
          "About Me category"
        );
      }
    );

    expect(
      categoryOrder()[1]
    ).toBe(
      "Experience category"
    );

    expect(
      screen.getByText(
        "Default landing section"
      )
    ).toBeInTheDocument();


    // Reorder: move Experience above About Me.
    fireEvent.click(
      screen.getByRole(
        "button",
        {
          name:
            "Move Experience up",
        }
      )
    );

    await waitFor(
      () => {
        expect(
          categoryOrder()[0]
        ).toBe(
          "Experience category"
        );
      }
    );

    expect(
      categoryOrder()[1]
    ).toBe(
      "About Me category"
    );


    // Recategorize: Experience moves from Recruiter to Hiring Manager.
    fireEvent.change(
      screen.getByRole(
        "combobox",
        {
          name:
            "Experience category",
        }
      ),
      {
        target: {
          value:
            "hiringManager",
        },
      }
    );

    expect(
      screen.getByRole(
        "combobox",
        {
          name:
            "Experience category",
        }
      ).value
    ).toBe(
      "hiringManager"
    );


    // Hide About Me (the current default section) -- default falls
    // back to whichever section is now first (Experience).
    fireEvent.click(
      screen.getByRole(
        "button",
        {
          name:
            "Hide About Me",
        }
      )
    );

    await waitFor(
      () => {
        expect(
          screen.queryByRole(
            "combobox",
            {
              name:
                "About Me category",
            }
          )
        ).not.toBeInTheDocument();
      }
    );

    expect(
      screen.getByText(
        "Hidden from public navigation"
      )
    ).toBeInTheDocument();

    expect(
      screen.getByRole(
        "button",
        {
          name:
            "Show About Me",
        }
      )
    ).toBeInTheDocument();


    // Re-show it.
    fireEvent.click(
      screen.getByRole(
        "button",
        {
          name:
            "Show About Me",
        }
      )
    );

    await waitFor(
      () => {
        expect(
          screen.getByRole(
            "combobox",
            {
              name:
                "About Me category",
            }
          )
        ).toBeInTheDocument();
      }
    );
  }
);
