// src/utils/profileVariant/authoringData.test.js

import {
  ABOUT_ME,
} from "../../data/aboutMe";

import {
  CODE_LAB_SNIPPETS,
} from "../../data/codeLab";

import {
  EDUCATION,
} from "../../data/education";

import {
  EXPERIENCE,
} from "../../data/experience";

import {
  FOOTER_LINKS,
} from "../../data/footer";

import {
  FUN_ZONE_DATA,
} from "../../data/funZone";

import {
  HERO_DATA,
} from "../../data/hero";

import {
  PROFILE_ASSET_CATALOG,
  getProfileAssetDefinition,
} from "../../data/profileAssets";

import {
  PROJECTS,
} from "../../data/projects";

import {
  RESUME_DATA,
} from "../../data/resume";

import {
  SKILLS,
} from "../../data/skills";

import {
  timelineData,
} from "../../data/timeline";

import {
  PROFILE_VARIANT_ASSET_KINDS,
  assertJsonCompatible,
} from ".";

import {
  buildProfileContent,
} from "../../profile/content";


describe(
  "Profile Variant authoring data",
  () => {
    test(
      "all recruiter-facing authoring content is JSON compatible",
      () => {
        expect(
          () =>
            assertJsonCompatible(
              buildProfileContent()
            )
        ).not.toThrow();
      }
    );


    test(
      "authoring data contains no React presentation objects",
      () => {
        for (
          const skill of
            SKILLS
        ) {
          expect(
            skill
          ).not.toHaveProperty(
            "icon"
          );
        }


        for (
          const education of
            EDUCATION
        ) {
          expect(
            education
          ).not.toHaveProperty(
            "logo"
          );

          expect(
            education
          ).not.toHaveProperty(
            "badgeIcon"
          );

          if (
            education
              .attachment
          ) {
            expect(
              education
                .attachment
            ).not.toHaveProperty(
              "image"
            );
          }
        }


        for (
          const link of
            FOOTER_LINKS
        ) {
          expect(
            link
          ).not.toHaveProperty(
            "colorClass"
          );
        }


        for (
          const item of
            HERO_DATA
              .rotatingTitles
        ) {
          expect(
            item
          ).not.toHaveProperty(
            "icon"
          );

          expect(
            item
          ).not.toHaveProperty(
            "className"
          );
        }


        for (
          const game of
            FUN_ZONE_DATA.games
        ) {
          expect(
            game
          ).not.toHaveProperty(
            "preview"
          );

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
        }
      }
    );


    test(
      "hero content is portable semantic profile data",
      () => {
        expect(
          HERO_DATA
            .name
        ).toBe(
          "Tejas Raut"
        );

        expect(
          HERO_DATA
            .rotatingTitles
            .length
        ).toBeGreaterThan(
          0
        );

        for (
          const item of
            HERO_DATA
              .rotatingTitles
        ) {
          expect(
            item
              .id
          ).toEqual(
            expect.any(
              String
            )
          );

          expect(
            item
              .text
          ).toEqual(
            expect.any(
              String
            )
          );
        }

        expect(
          () =>
            assertJsonCompatible(
              HERO_DATA
            )
        ).not.toThrow();
      }
    );


    test(
      "Fun Zone content exposes semantic catalog data without platform runtime implementation",
      () => {
        expect(
          FUN_ZONE_DATA
            .subtitle
        ).toEqual(
          expect.any(
            String
          )
        );

        expect(
          FUN_ZONE_DATA
            .games
            .length
        ).toBeGreaterThan(
          0
        );

        for (
          const game of
            FUN_ZONE_DATA.games
        ) {
          expect(
            game.id
          ).toEqual(
            expect.any(
              String
            )
          );

          expect(
            game.title
          ).toEqual(
            expect.any(
              String
            )
          );

          expect(
            typeof game.enabled
          ).toBe(
            "boolean"
          );

          expect(
            game.githubUrl
          ).toEqual(
            expect.any(
              String
            )
          );
        }

        expect(
          () =>
            assertJsonCompatible(
              FUN_ZONE_DATA
            )
        ).not.toThrow();
      }
    );


    test(
      "every profile-owned asset reference exists in the asset catalog",
      () => {
        const referencedIds = [
          ABOUT_ME
            .profilePhotoAssetId,

          RESUME_DATA
            .pdfAssetId,

          ...EDUCATION.flatMap(
            (education) => [
              education
                .logoAssetId,

              education
                .attachment
                ?.assetId,
            ]
          ),
        ].filter(Boolean);


        for (
          const assetId of
            referencedIds
        ) {
          expect(
            getProfileAssetDefinition(
              assetId
            )
          ).not.toBeNull();
        }
      }
    );


    test(
      "profile asset catalog uses supported Profile Variant asset kinds",
      () => {
        for (
          const definition of
            Object.values(
              PROFILE_ASSET_CATALOG
            )
        ) {
          expect(
            PROFILE_VARIANT_ASSET_KINDS
          ).toContain(
            definition.kind
          );

          expect(
            definition.sourcePath
          ).toEqual(
            expect.any(
              String
            )
          );

          expect(
            definition.contentType
          ).toEqual(
            expect.any(
              String
            )
          );
        }


        expect(
          () =>
            assertJsonCompatible(
              PROFILE_ASSET_CATALOG
            )
        ).not.toThrow();
      }
    );


    test(
      "platform and game assets do not leak into the Profile Variant asset catalog",
      () => {
        const serialized =
          JSON.stringify(
            PROFILE_ASSET_CATALOG
          );

        expect(
          serialized
        ).not.toContain(
          "/ships/"
        );

        expect(
          serialized
        ).not.toContain(
          "firebase-config"
        );

        expect(
          serialized
        ).not.toContain(
          "/games/"
        );

        expect(
          serialized
        ).not.toContain(
          "/geo/"
        );
      }
    );
  }
);