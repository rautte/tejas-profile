// src/utils/hashRouting.test.js

import {
  canonicalizeAnalyticsHash,
  hashPathFromHash,
  parseFunZoneRoute,
  resolveSectionLabelFromHash,
  toSectionSlug,
} from "./hashRouting";

describe(
  "hash routing",
  () => {
    test(
      "resolves canonical public sections",
      () => {
        expect(
          resolveSectionLabelFromHash(
            "#/about-me"
          )
        ).toBe("About Me");

        expect(
          resolveSectionLabelFromHash(
            "#/experience"
          )
        ).toBe("Experience");

        expect(
          resolveSectionLabelFromHash(
            "#/skills"
          )
        ).toBe("Skills");

        expect(
          resolveSectionLabelFromHash(
            "#/education"
          )
        ).toBe("Education");

        expect(
          resolveSectionLabelFromHash(
            "#/resume"
          )
        ).toBe("Resume");

        expect(
          resolveSectionLabelFromHash(
            "#/projects"
          )
        ).toBe("Projects");

        expect(
          resolveSectionLabelFromHash(
            "#/code-lab"
          )
        ).toBe("Code Lab");

        expect(
          resolveSectionLabelFromHash(
            "#/fun-zone"
          )
        ).toBe("Fun Zone");

        expect(
          resolveSectionLabelFromHash(
            "#/timeline"
          )
        ).toBe("Timeline");
      }
    );

    test(
      "maps nested Fun Zone routes to the Fun Zone parent section",
      () => {
        expect(
          resolveSectionLabelFromHash(
            "#/fun-zone/minesweeper"
          )
        ).toBe("Fun Zone");

        expect(
          resolveSectionLabelFromHash(
            "#/fun-zone/tictactoe"
          )
        ).toBe("Fun Zone");

        expect(
          resolveSectionLabelFromHash(
            "#/fun-zone/battleship"
          )
        ).toBe("Fun Zone");

        expect(
          resolveSectionLabelFromHash(
            "#/fun-zone/battleship-AX9G"
          )
        ).toBe("Fun Zone");
      }
    );

    test(
      "parses Battleship room codes without losing routing information",
      () => {
        expect(
          parseFunZoneRoute(
            "fun-zone/battleship-ax9g"
          )
        ).toEqual({
          game: "battleship",
          code: "AX9G",
        });
      }
    );

    test(
      "ignores hash query parameters for top-level section routing",
      () => {
        expect(
          hashPathFromHash(
            "#/code-lab?from=battleship"
          )
        ).toBe("code-lab");

        expect(
          resolveSectionLabelFromHash(
            "#/code-lab?from=battleship"
          )
        ).toBe("Code Lab");
      }
    );

    test(
      "unknown routes fall back only when explicitly requested",
      () => {
        expect(
          resolveSectionLabelFromHash(
            "#/not-real"
          )
        ).toBeNull();

        expect(
          resolveSectionLabelFromHash(
            "#/not-real",
            {
              fallbackToDefault: true,
            }
          )
        ).toBe("About Me");
      }
    );


    test(
      "honors an owner-declared default section, and still falls back to the platform default when none is given",
      () => {
        expect(
          resolveSectionLabelFromHash(
            "#/not-real",
            {
              fallbackToDefault: true,

              defaultSection:
                "Projects",
            }
          )
        ).toBe("Projects");

        expect(
          resolveSectionLabelFromHash(
            "#/not-real",
            {
              fallbackToDefault: true,
            }
          )
        ).toBe("About Me");
      }
    );

    test(
      "canonicalizes Battleship invite hashes only for analytics",
      () => {
        expect(
          canonicalizeAnalyticsHash(
            "#/fun-zone/battleship-AX9G"
          )
        ).toBe(
          "#/fun-zone/battleship"
        );

        expect(
          canonicalizeAnalyticsHash(
            "#/fun-zone/battleship"
          )
        ).toBe(
          "#/fun-zone/battleship"
        );

        expect(
          canonicalizeAnalyticsHash(
            "#/fun-zone/tictactoe"
          )
        ).toBe(
          "#/fun-zone/tictactoe"
        );
      }
    );

    test(
      "uses the canonical navigation slug format",
      () => {
        expect(
          toSectionSlug("Code Lab")
        ).toBe("code-lab");

        expect(
          toSectionSlug("Fun Zone")
        ).toBe("fun-zone");
      }
    );
  }
);