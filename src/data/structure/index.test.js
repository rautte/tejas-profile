// src/data/structure/index.test.js

import {
  DEFAULT_SECTION,
  PUBLIC_SECTION_ORDER,
  SIDEBAR_GROUPS,
  defaultSiteStructure,
  resolveSiteStructure,
} from ".";


test(
  "resolves the platform default when given nothing",
  () => {
    expect(
      resolveSiteStructure(
        undefined
      )
    ).toEqual(
      defaultSiteStructure()
    );
  }
);


test(
  "resolves the platform default when given a malformed value",
  () => {
    expect(
      resolveSiteStructure(
        "not an object"
      )
    ).toEqual(
      defaultSiteStructure()
    );
  }
);


test(
  "honors an owner-declared order and drops unknown section names",
  () => {
    const resolved =
      resolveSiteStructure(
        {
          order: [
            "Experience",
            "About Me",
            "Not A Real Section",
            "Experience",
          ],
        }
      );

    expect(
      resolved.order
    ).toEqual(
      [
        "Experience",
        "About Me",
      ]
    );
  }
);


test(
  "hiding a section (omitting it from order) drops it from groups too",
  () => {
    const resolved =
      resolveSiteStructure(
        {
          order:
            PUBLIC_SECTION_ORDER.filter(
              (
                label
              ) =>
                label !==
                "Timeline"
            ),

          groups:
            SIDEBAR_GROUPS,
        }
      );

    expect(
      resolved.order
    ).not.toContain(
      "Timeline"
    );

    expect(
      Object.values(
        resolved.groups
      ).flat()
    ).not.toContain(
      "Timeline"
    );
  }
);


test(
  "a visible section missing from every group lands in explore instead of disappearing",
  () => {
    const resolved =
      resolveSiteStructure(
        {
          order:
            PUBLIC_SECTION_ORDER,

          groups: {
            pinned: [
              "About Me",
            ],
          },
        }
      );

    expect(
      resolved.groups
        .explore
    ).toEqual(
      expect.arrayContaining(
        [
          "Experience",
          "Skills",
          "Education",
          "Resume",
          "Projects",
          "Code Lab",
          "Fun Zone",
          "Timeline",
        ]
      )
    );
  }
);


test(
  "falls back to the platform default section when the declared one is hidden",
  () => {
    const resolved =
      resolveSiteStructure(
        {
          order:
            PUBLIC_SECTION_ORDER.filter(
              (
                label
              ) =>
                label !==
                DEFAULT_SECTION
            ),

          defaultSection:
            DEFAULT_SECTION,
        }
      );

    expect(
      resolved.defaultSection
    ).toBe(
      "Experience"
    );
  }
);


test(
  "a group's display order follows the flat order, not the stored group array's own sequence",
  () => {
    // Simulates the real bug: the owner reordered Resume above Skills
    // in the flat order (e.g. via the Structure editor's up/down
    // arrows), but the stored "recruiter" group array still lists
    // them in their old sequence. The group's effective order must
    // still come out Resume-before-Skills.
    const resolved =
      resolveSiteStructure(
        {
          order: [
            "About Me",
            "Experience",
            "Resume",
            "Skills",
            "Education",
            "Projects",
            "Code Lab",
            "Fun Zone",
            "Timeline",
          ],

          groups: {
            pinned: [
              "About Me",
            ],

            recruiter: [
              "Experience",
              "Skills",
              "Education",
              "Resume",
            ],

            hiringManager: [
              "Projects",
              "Code Lab",
              "Fun Zone",
            ],

            explore: [
              "Timeline",
            ],
          },
        }
      );

    expect(
      resolved.groups
        .recruiter
    ).toEqual(
      [
        "Experience",
        "Resume",
        "Skills",
        "Education",
      ]
    );
  }
);


test(
  "recategorizing a section into a new group still respects that group's position in the flat order",
  () => {
    // Simulates moving Projects from hiringManager to recruiter: the
    // raw group array gets Projects appended at the end, but its
    // effective position among recruiter sections must follow where
    // "Projects" actually sits in the flat order.
    const resolved =
      resolveSiteStructure(
        {
          order:
            PUBLIC_SECTION_ORDER,

          groups: {
            pinned: [
              "About Me",
            ],

            recruiter: [
              "Experience",
              "Skills",
              "Education",
              "Resume",
              "Projects",
            ],

            hiringManager: [
              "Code Lab",
              "Fun Zone",
            ],

            explore: [
              "Timeline",
            ],
          },
        }
      );

    expect(
      resolved.groups
        .recruiter
    ).toEqual(
      [
        "Experience",
        "Skills",
        "Education",
        "Resume",
        "Projects",
      ]
    );
  }
);


test(
  "honors a valid owner-declared default section",
  () => {
    const resolved =
      resolveSiteStructure(
        {
          order:
            PUBLIC_SECTION_ORDER,

          defaultSection:
            "Projects",
        }
      );

    expect(
      resolved.defaultSection
    ).toBe(
      "Projects"
    );
  }
);
