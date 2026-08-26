// src/profile/draft/profileDraft.test.js

import {
  buildProfileContent,
} from "../content";

import {
  CURRENT_PROFILE_CONTENT_SCHEMA_VERSION,
} from "../../utils/profileVariant";

import {
  CURRENT_PROFILE_DRAFT_SCHEMA_VERSION,
  PROFILE_DRAFT_DOCUMENT_SCHEMA,
  createProfileDraft,
  evaluateProfileDraftReadiness,
  updateProfileDraft,
  validateProfileDraft,
} from ".";


const CREATED_AT =
  "2026-08-21T10:00:00.000Z";

const UPDATED_AT =
  "2026-08-21T10:05:00.000Z";


function currentDraft(
  overrides = {}
) {
  return createProfileDraft({
    draftId:
      "draft_test_001",

    baseProfileVariantId:
      "prv_existing_001",

    targeting: {
      location:
        "Dubai",

      jobRole:
        "Software Development Engineer 1",
    },

    content:
      buildProfileContent(),

    createdAt:
      CREATED_AT,

    updatedAt:
      CREATED_AT,

    ...overrides,
  });
}


describe(
  "Profile Draft contract",
  () => {
    test(
      "creates a valid Draft using the current Profile Content schema",
      () => {
        const draft =
          currentDraft();

        const result =
          validateProfileDraft(
            draft
          );


        expect(
          result.valid
        ).toBe(true);

        expect(
          result.errors
        ).toEqual([]);


        expect(
          draft.schema
        ).toBe(
          PROFILE_DRAFT_DOCUMENT_SCHEMA
        );

        expect(
          draft
            .draftSchemaVersion
        ).toBe(
          CURRENT_PROFILE_DRAFT_SCHEMA_VERSION
        );

        expect(
          draft
            .contentSchemaVersion
        ).toBe(
          CURRENT_PROFILE_CONTENT_SCHEMA_VERSION
        );

        expect(
          draft.revision
        ).toBe(1);
      }
    );


    test(
      "Draft may be structurally valid while targeting is incomplete",
      () => {
        const draft =
          currentDraft({
            targeting: {
              location:
                "",

              jobRole:
                "",
            },
          });


        const result =
          evaluateProfileDraftReadiness(
            draft
          );


        expect(
          result.valid
        ).toBe(true);

        expect(
          result.publishable
        ).toBe(false);

        expect(
          result.missingTargeting
        ).toEqual([
          "location",
          "jobRole",
        ]);
      }
    );


    test(
      "Draft becomes publish-ready when required targeting is present",
      () => {
        const result =
          evaluateProfileDraftReadiness(
            currentDraft()
          );


        expect(
          result.valid
        ).toBe(true);

        expect(
          result.publishable
        ).toBe(true);

        expect(
          result.missingTargeting
        ).toEqual([]);
      }
    );


    test(
      "new Draft may have no base Profile Variant",
      () => {
        const draft =
          currentDraft({
            baseProfileVariantId:
              null,
          });


        expect(
          draft
            .baseProfileVariantId
        ).toBeNull();

        expect(
          validateProfileDraft(
            draft
          ).valid
        ).toBe(true);
      }
    );


    test(
      "Draft content is copied and does not mutate repository authoring data",
      () => {
        const source =
          buildProfileContent();

        const draft =
          createProfileDraft({
            draftId:
              "draft_copy_test",

            content:
              source,

            targeting: {
              location:
                "Pune",

              jobRole:
                "Software Engineer",
            },

            createdAt:
              CREATED_AT,
          });


        expect(
          draft.content
        ).not.toBe(
          source
        );

        expect(
          draft
            .content
            .projects
        ).not.toBe(
          source.projects
        );


        draft
          .content
          .projects
          .push({
            id:
              "draft-only",
          });


        expect(
          source
            .projects
            .some(
              (project) =>
                project.id ===
                "draft-only"
            )
        ).toBe(false);
      }
    );


    test(
      "owner edit increments revision without mutating the previous Draft",
      () => {
        const original =
          currentDraft();


        const updated =
          updateProfileDraft(
            original,
            {
              targeting: {
                location:
                  "Pune",
              },
            },
            {
              expectedRevision:
                1,

              updatedAt:
                UPDATED_AT,
            }
          );


        expect(
          original.revision
        ).toBe(1);

        expect(
          original
            .targeting
            .location
        ).toBe(
          "Dubai"
        );


        expect(
          updated.revision
        ).toBe(2);

        expect(
          updated
            .targeting
            .location
        ).toBe(
          "Pune"
        );

        expect(
          updated
            .targeting
            .jobRole
        ).toBe(
          "Software Development Engineer 1"
        );

        expect(
          updated.updatedAt
        ).toBe(
          UPDATED_AT
        );
      }
    );


    test(
      "content patches can update one canonical section without replacing all Profile Content",
      () => {
        const original =
          currentDraft();


        const nextProjects = [
          ...original
            .content
            .projects,

          {
            id:
              "new-profile-project",

            title:
              "New Profile Project",
          },
        ];


        const updated =
          updateProfileDraft(
            original,
            {
              content: {
                projects:
                  nextProjects,
              },
            },
            {
              expectedRevision:
                1,

              updatedAt:
                UPDATED_AT,
            }
          );


        expect(
          updated
            .content
            .projects
            .some(
              (project) =>
                project.id ===
                "new-profile-project"
            )
        ).toBe(true);


        expect(
          updated
            .content
            .aboutMe
        ).toEqual(
          original
            .content
            .aboutMe
        );


        expect(
          updated
            .content
            .hero
        ).toEqual(
          original
            .content
            .hero
        );
      }
    );


    test(
      "stale owner save is rejected by optimistic concurrency",
      () => {
        const draft =
          currentDraft();


        expect(
          () =>
            updateProfileDraft(
              draft,
              {
                targeting: {
                  location:
                    "Pune",
                },
              },
              {
                expectedRevision:
                  2,

                updatedAt:
                  UPDATED_AT,
              }
            )
        ).toThrow(
          "Profile Draft revision conflict: expected 2, current 1."
        );
      }
    );


    test(
      "owner patch cannot modify system-managed Draft fields",
      () => {
        const draft =
          currentDraft();


        expect(
          () =>
            updateProfileDraft(
              draft,
              {
                revision:
                  999,
              },
              {
                expectedRevision:
                  1,

                updatedAt:
                  UPDATED_AT,
              }
            )
        ).toThrow(
          'Profile Draft field "revision" is system-managed and cannot be edited.'
        );


        expect(
          () =>
            updateProfileDraft(
              draft,
              {
                draftId:
                  "hijacked",
              },
              {
                expectedRevision:
                  1,

                updatedAt:
                  UPDATED_AT,
              }
            )
        ).toThrow(
          'Profile Draft field "draftId" is system-managed and cannot be edited.'
        );
      }
    );


    test(
      "Draft rejects non-current Profile Content schemas",
      () => {
        expect(
          () =>
            currentDraft({
              contentSchemaVersion:
                CURRENT_PROFILE_CONTENT_SCHEMA_VERSION +
                1,
            })
        ).toThrow(
          `Profile Draft contentSchemaVersion must be the current schema v${CURRENT_PROFILE_CONTENT_SCHEMA_VERSION}.`
        );
      }
    );


    test(
      "Draft rejects malformed canonical Profile Content",
      () => {
        const draft =
          currentDraft();

        const broken = {
          ...draft,

          content: {
            hero: {},
          },
        };


        const result =
          validateProfileDraft(
            broken
          );


        expect(
          result.valid
        ).toBe(false);

        expect(
          result.errors
        ).toContain(
          "content.experience is required."
        );

        expect(
          result.errors
        ).toContain(
          "content.funZone is required."
        );
      }
    );
  }
);