// src/profile/draft/draftStatus.test.js

import {
  buildProfileContent,
} from "../content";

import {
  createProfileDraft,
  updateProfileDraft,
} from "./profileDraft";

import {
  PROFILE_DRAFT_STATUS,
  deriveProfileDraftStatus,
} from "./draftStatus";


const BASE_TARGETING = {
  location:
    "Bangalore, India",

  jobRole:
    "Backend / Infrastructure Engineer",
};


function baseContent() {
  return buildProfileContent();
}


function freshDraft() {
  return createProfileDraft(
    {
      draftId:
        "draft_test",

      baseProfileVariantId:
        "prv_base",

      targeting:
        BASE_TARGETING,

      content:
        baseContent(),

      // Deliberately far in the past, not "today" — updateProfileDraft
      // defaults updatedAt to the real wall clock, which must never
      // land before this fixture regardless of when tests run.
      createdAt:
        "2020-01-01T00:00:00.000Z",
    }
  );
}


describe(
  "deriveProfileDraftStatus",
  () => {
    test(
      "CLEAN when there is no draft at all",
      () => {
        expect(
          deriveProfileDraftStatus(
            {
              draft:
                null,

              baseProfileVariantId:
                "prv_base",

              baseTargeting:
                BASE_TARGETING,

              baseContent:
                baseContent(),
            }
          )
        ).toBe(
          PROFILE_DRAFT_STATUS.CLEAN
        );
      }
    );


    test(
      "CLEAN when a draft exists but matches its base exactly",
      () => {
        expect(
          deriveProfileDraftStatus(
            {
              draft:
                freshDraft(),

              baseProfileVariantId:
                "prv_base",

              baseTargeting:
                BASE_TARGETING,

              baseContent:
                baseContent(),
            }
          )
        ).toBe(
          PROFILE_DRAFT_STATUS.CLEAN
        );
      }
    );


    test(
      "READY when the draft has changes and targeting is complete",
      () => {
        const edited =
          updateProfileDraft(
            freshDraft(),
            {
              content: {
                hero: {
                  ...baseContent()
                    .hero,

                  greeting:
                    "Edited greeting",
                },
              },
            },
            {
              expectedRevision:
                1,
            }
          );

        expect(
          deriveProfileDraftStatus(
            {
              draft:
                edited,

              baseProfileVariantId:
                "prv_base",

              baseTargeting:
                BASE_TARGETING,

              baseContent:
                baseContent(),
            }
          )
        ).toBe(
          PROFILE_DRAFT_STATUS.READY
        );
      }
    );


    test(
      "DRAFT when there are changes but targeting is incomplete",
      () => {
        const edited =
          updateProfileDraft(
            freshDraft(),
            {
              targeting: {
                location:
                  "",

                jobRole:
                  BASE_TARGETING.jobRole,
              },
            },
            {
              expectedRevision:
                1,
            }
          );

        expect(
          deriveProfileDraftStatus(
            {
              draft:
                edited,

              baseProfileVariantId:
                "prv_base",

              baseTargeting:
                BASE_TARGETING,

              baseContent:
                baseContent(),
            }
          )
        ).toBe(
          PROFILE_DRAFT_STATUS.DRAFT
        );
      }
    );


    test(
      "DRAFT_WITH_ERRORS when the stored draft fails structural validation",
      () => {
        const invalid = {
          ...freshDraft(),

          revision:
            -1,
        };

        expect(
          deriveProfileDraftStatus(
            {
              draft:
                invalid,

              baseProfileVariantId:
                "prv_base",

              baseTargeting:
                BASE_TARGETING,

              baseContent:
                baseContent(),
            }
          )
        ).toBe(
          PROFILE_DRAFT_STATUS.DRAFT_WITH_ERRORS
        );
      }
    );


    test(
      "STALE when the draft's base no longer matches the current active variant",
      () => {
        expect(
          deriveProfileDraftStatus(
            {
              draft:
                freshDraft(),

              baseProfileVariantId:
                "prv_now_different",

              baseTargeting:
                BASE_TARGETING,

              baseContent:
                baseContent(),
            }
          )
        ).toBe(
          PROFILE_DRAFT_STATUS.STALE
        );
      }
    );
  }
);
