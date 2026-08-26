// src/profile/content/buildProfileContent.test.js

import {
  ABOUT_ME,
} from "../../data/aboutMe";

import {
  FUN_ZONE_DATA,
} from "../../data/funZone";

import {
  HERO_DATA,
} from "../../data/hero";

import {
  PROFILE_ASSET_CATALOG,
} from "../../data/profileAssets";

import {
  PROJECTS,
} from "../../data/projects";

import {
  PROFILE_CONTENT_FIELDS,
  assertJsonCompatible,
  validateProfileContent,
} from "../../utils/profileVariant";

import {
  buildProfileContent,
} from ".";


describe(
  "buildProfileContent",
  () => {
    test(
      "builds a valid canonical ProfileContent DTO",
      () => {
        const content =
          buildProfileContent();

        const validation =
          validateProfileContent(
            content
          );

        expect(
          validation
            .valid
        ).toBe(true);

        expect(
          validation
            .errors
        ).toEqual([]);
      }
    );


    test(
      "contains every canonical Profile Content field and no extra top-level fields",
      () => {
        const content =
          buildProfileContent();

        expect(
          Object.keys(
            content
          )
        ).toEqual(
          PROFILE_CONTENT_FIELDS
        );
      }
    );


    test(
      "assembled content is fully JSON compatible",
      () => {
        const content =
          buildProfileContent();

        expect(
          () =>
            assertJsonCompatible(
              content
            )
        ).not.toThrow();

        expect(
          () =>
            JSON.stringify(
              content
            )
        ).not.toThrow();
      }
    );


    test(
      "repository authoring data is copied instead of returned by reference",
      () => {
        const content =
          buildProfileContent();

        expect(
          content.hero
        ).not.toBe(
          HERO_DATA
        );

        expect(
          content.aboutMe
        ).not.toBe(
          ABOUT_ME
        );

        expect(
          content.projects
        ).not.toBe(
          PROJECTS
        );

        expect(
          content.funZone
        ).not.toBe(
          FUN_ZONE_DATA
        );


        const originalName =
          HERO_DATA.name;

        content.hero.name =
          "Changed only in assembled content";

        expect(
          HERO_DATA.name
        ).toBe(
          originalName
        );
      }
    );


    test(
      "multiple builds are deterministic but independently mutable copies",
      () => {
        const first =
          buildProfileContent();

        const second =
          buildProfileContent();


        expect(
          first
        ).toEqual(
          second
        );

        expect(
          first
        ).not.toBe(
          second
        );

        expect(
          first.projects
        ).not.toBe(
          second.projects
        );


        first.projects.push({
          id:
            "temporary-test-project",

          title:
            "Temporary",
        });


        expect(
          second.projects.some(
            (project) =>
              project.id ===
              "temporary-test-project"
          )
        ).toBe(false);
      }
    );


    test(
      "ProfileContent does not accidentally embed the asset catalog or platform runtime configuration",
      () => {
        const content =
          buildProfileContent();

        expect(
          content
        ).not.toHaveProperty(
          "assets"
        );

        expect(
          content
        ).not.toHaveProperty(
          "assetCatalog"
        );

        expect(
          content
        ).not.toHaveProperty(
          "profileAssets"
        );


        const serialized =
          JSON.stringify(
            content
          );

        expect(
          serialized
        ).not.toContain(
          JSON.stringify(
            PROFILE_ASSET_CATALOG
          )
        );

        for (
          const game of
            content.funZone.games
        ) {
          expect(
            game
          ).not.toHaveProperty(
            "playHref"
          );

          expect(
            game
          ).not.toHaveProperty(
            "codeHref"
          );

          expect(
            game
          ).not.toHaveProperty(
            "analytics"
          );

          expect(
            game
          ).not.toHaveProperty(
            "Preview"
          );
        }
      }
    );
  }
);