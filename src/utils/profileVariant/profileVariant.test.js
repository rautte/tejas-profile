// src/utils/profileVariant/profileVariant.test.js

import {
  CURRENT_PROFILE_CONTENT_SCHEMA_VERSION,
  PROFILE_VARIANT_COMPATIBILITY,
  PROFILE_VARIANT_DOCUMENT_SCHEMA,
  createProfileVariantDocument,
  migrateProfileVariantToCurrent,
  runProfileVariantMigrations,
  validateProfileContent,
  validateProfileVariantDocument,
  PROFILE_VARIANT_SCHEMA_ID_V1,
} from ".";


function validVariant(
  overrides = {}
) {
  return createProfileVariantDocument({
    profileVariantId:
      "prv_test",

    schemaId:
      PROFILE_VARIANT_SCHEMA_ID_V1,

    contentHash:
      "a".repeat(64),

    createdAt:
      "2026-08-21T08:00:00.000Z",

    targeting: {
      location:
        "Dubai",

      jobRole:
        "Software Development Engineer 1",
    },

    provenance: {
      legacyProfileVersionId:
        "pv_c341be8",

      platformVersionId:
        "platform_c341be8",

      gitSha:
        "c341be871fbf61598eb20fb0fce1f103a8fc1a62",

      checkpointTag:
        "checkpoint-test",
    },

    content: {
      hero: {},

      aboutMe: {
        name:
          "Tejas",
      },

      experience: [],

      education: [],

      skills: [],

      resume: {},

      projects: [],

      codeLab: [],

      funZone: {},

      timeline: [],

      contactLinks: [],
    },

    assets: [],

    ...overrides,
  });
}


describe(
  "Profile Variant contract",
  () => {
    test(
      "creates a valid publishable schema-v1 document",
      () => {
        const document =
          validVariant();

        const result =
          validateProfileVariantDocument(
            document
          );

        expect(
          document.schema
        ).toBe(
          PROFILE_VARIANT_DOCUMENT_SCHEMA
        );

        expect(
          document
            .contentSchemaVersion
        ).toBe(
          CURRENT_PROFILE_CONTENT_SCHEMA_VERSION
        );

        expect(result).toMatchObject({
          valid:
            true,

          publishable:
            true,

          compatibility:
            PROFILE_VARIANT_COMPATIBILITY
              .READY,

          requiresMigration:
            false,

          missingTargeting:
            [],
        });

        expect(
          result.errors
        ).toEqual([]);
      }
    );


    test(
      "historical variant may be structurally valid while needing targeting metadata",
      () => {
        const document =
          validVariant({
            targeting: {
              location: "",
              jobRole: "",
            },
          });

        const result =
          validateProfileVariantDocument(
            document
          );

        expect(
          result.valid
        ).toBe(true);

        expect(
          result.publishable
        ).toBe(false);

        expect(
          result.compatibility
        ).toBe(
          PROFILE_VARIANT_COMPATIBILITY
            .NEEDS_METADATA
        );

        expect(
          result.missingTargeting
        ).toEqual([
          "location",
          "jobRole",
        ]);
      }
    );


    test(
      "rejects an invalid current-schema content shape",
      () => {
        const document =
          validVariant();

        document.content.experience =
          {};

        const result =
          validateProfileVariantDocument(
            document
          );

        expect(
          result.valid
        ).toBe(false);

        expect(
          result.compatibility
        ).toBe(
          PROFILE_VARIANT_COMPATIBILITY
            .INCOMPATIBLE
        );

        expect(
          result.errors
        ).toContain(
          "content.experience must be an array."
        );
      }
    );


    test(
      "rejects unknown schema-v1 content fields instead of silently accepting typos",
      () => {
        const document =
          validVariant();

        document.content
          .experiance =
          [];

        const result =
          validateProfileVariantDocument(
            document
          );

        expect(
          result.valid
        ).toBe(false);

        expect(
          result.errors
        ).toContain(
          "content.experiance is not supported by content schema v1."
        );
      }
    );


    test(
      "rejects React-style or other non-JSON values",
      () => {
        const document =
          validVariant();

        document
          .content
          .skills = [
            {
              category:
                "AWS",

              icon:
                Symbol.for(
                  "react.element"
                ),
            },
          ];

        const result =
          validateProfileVariantDocument(
            document
          );

        expect(
          result.valid
        ).toBe(false);

        expect(
          result.errors.some(
            (error) =>
              error.includes(
                "unsupported JSON value type"
              )
          )
        ).toBe(true);
      }
    );


    test(
      "validates immutable asset checksum format",
      () => {
        const document =
          validVariant({
            assets: [
              {
                id:
                  "resume",

                kind:
                  "resume_pdf",

                sourcePath:
                  "public/downloads/Tejas_Resume.pdf",

                objectKey:
                  "profiles/prv_test/assets/resume.pdf",

                sha256:
                  "not-a-sha256",

                contentType:
                  "application/pdf",
              },
            ],
          });

        const result =
          validateProfileVariantDocument(
            document
          );

        expect(
          result.valid
        ).toBe(false);

        expect(
          result.errors
        ).toContain(
          "assets[0].sha256 must be a 64-character hexadecimal SHA-256 digest."
        );
      }
    );


    test(
      "rejects a future content schema",
      () => {
        const document =
          validVariant();

        document
          .contentSchemaVersion =
          CURRENT_PROFILE_CONTENT_SCHEMA_VERSION +
          1;

        const result =
          validateProfileVariantDocument(
            document
          );

        expect(
          result.valid
        ).toBe(false);

        expect(
          result.compatibility
        ).toBe(
          PROFILE_VARIANT_COMPATIBILITY
            .INCOMPATIBLE
        );
      }
    );


    test(
      "migration runner applies sequential migrations without mutating source",
      () => {
        const source = {
          contentSchemaVersion:
            1,

          value:
            "original",
        };

        const migrations = {
          1: (document) => ({
            ...document,

            contentSchemaVersion:
              2,

            addedInV2:
              true,
          }),

          2: (document) => ({
            ...document,

            contentSchemaVersion:
              3,

            addedInV3:
              true,
          }),
        };

        const result =
          runProfileVariantMigrations(
            source,
            {
              targetVersion:
                3,

              migrations,
            }
          );

        expect(result).toEqual({
          contentSchemaVersion:
            3,

          value:
            "original",

          addedInV2:
            true,

          addedInV3:
            true,
        });

        expect(source).toEqual({
          contentSchemaVersion:
            1,

          value:
            "original",
        });
      }
    );


    test(
      "migration runner fails closed when a required migration is missing",
      () => {
        expect(
          () =>
            runProfileVariantMigrations(
              {
                contentSchemaVersion:
                  1,
              },
              {
                targetVersion:
                  2,

                migrations:
                  {},
              }
            )
        ).toThrow(
          "Missing Profile Variant migration v1 → v2."
        );
      }
    );


    test(
      "current-schema migration returns an independent validated copy",
      () => {
        const source =
          validVariant();

        const migrated =
          migrateProfileVariantToCurrent(
            source
          );

        expect(
          migrated
        ).toEqual(
          source
        );

        expect(
          migrated
        ).not.toBe(
          source
        );

        migrated
          .content
          .projects
          .push({
            id:
              "new-project",
          });

        expect(
          source
            .content
            .projects
        ).toEqual([]);
      }
    );

    test(
      "standalone ProfileContent validation rejects missing canonical fields",
      () => {
        const result =
          validateProfileContent({
            hero: {},
            aboutMe: {},
          });

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
