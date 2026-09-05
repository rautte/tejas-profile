// src/profile/content/buildProfileContentSnapshot.test.js
//
// Verifies the safety contract of the activeSnapshot.json overlay
// added to buildProfileContent(): use it when present and valid,
// but never let a missing/empty/malformed snapshot break the
// hand-authored repository fallback that existed before it.

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


function loadBuildProfileContent() {
  jest.resetModules();
  return require(".").buildProfileContent;
}


// A fully valid ProfileContent, built from the same real repository
// data buildProfileContent() itself would use -- so it's guaranteed
// to pass validateProfileContent() -- with only hero swapped out,
// so tests can tell "used the snapshot" apart from "used the
// hand-authored fallback".
function validSnapshotContent() {
  return {
    hero: {
      greeting: "Yo",
      name: "Snapshot Person",
    },
    aboutMe: ABOUT_ME,
    experience: EXPERIENCE,
    education: EDUCATION,
    skills: SKILLS,
    resume: RESUME_DATA,
    projects: PROJECTS,
    codeLab: CODE_LAB_SNIPPETS,
    funZone: FUN_ZONE_DATA,
    timeline: timelineData,
    contactLinks: FOOTER_LINKS,
  };
}


describe(
  "buildProfileContent -- activeSnapshot.json overlay",
  () => {
    afterEach(
      () => {
        jest.dontMock(
          "./activeSnapshot.json"
        );
      }
    );


    test(
      "falls back to the hand-authored repository data when the snapshot has no content",
      () => {
        jest.doMock(
          "./activeSnapshot.json",
          () => (
            {
              syncedAt:
                null,

              profileVariantId:
                null,

              contentSchemaVersion:
                null,

              content:
                null,
            }
          ),
          {
            virtual:
              true,
          }
        );

        const buildProfileContent =
          loadBuildProfileContent();

        const content =
          buildProfileContent();

        expect(
          content.hero
            .name
        ).toBe(
          HERO_DATA.name
        );
      }
    );


    test(
      "falls back to the hand-authored repository data when the snapshot fails validation",
      () => {
        jest.doMock(
          "./activeSnapshot.json",
          () => (
            {
              syncedAt:
                "2026-01-01T00:00:00.000Z",

              profileVariantId:
                "prv_broken",

              contentSchemaVersion:
                1,

              // Wrong type for a required field -- must fail
              // validateProfileContent() and be rejected, not
              // thrown from or silently accepted. (Empty/missing
              // fields alone are NOT invalid -- createProfileContent
              // fills them with valid empty defaults -- so this
              // needs an actual type violation.)
              content: {
                hero:
                  "not an object",
              },
            }
          ),
          {
            virtual:
              true,
          }
        );

        const buildProfileContent =
          loadBuildProfileContent();

        const content =
          buildProfileContent();

        expect(
          content.hero
            .name
        ).toBe(
          HERO_DATA.name
        );
      }
    );


    test(
      "uses the snapshot's content when it is present and valid",
      () => {
        jest.doMock(
          "./activeSnapshot.json",
          () => (
            {
              syncedAt:
                "2026-01-01T00:00:00.000Z",

              profileVariantId:
                "prv_synced_test",

              contentSchemaVersion:
                1,

              content:
                validSnapshotContent(),
            }
          ),
          {
            virtual:
              true,
          }
        );

        const buildProfileContent =
          loadBuildProfileContent();

        const content =
          buildProfileContent();

        expect(
          content.hero
            .name
        ).toBe(
          "Snapshot Person"
        );

        expect(
          content.hero
            .name
        ).not.toBe(
          HERO_DATA.name
        );
      }
    );
  }
);
