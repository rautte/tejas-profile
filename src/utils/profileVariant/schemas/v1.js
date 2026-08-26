// src/utils/profileVariant/schemas/v1.js

import {
  PROFILE_VARIANT_ASSET_KINDS,
  PROFILE_VARIANT_DOCUMENT_SCHEMA,
} from "../constants";

export const PROFILE_VARIANT_SCHEMA_ID_V1 =
  "tejas-profile.profile-variant.v1";


/**
 * Canonical Profile Variant content schema v1.
 *
 * This object intentionally follows JSON Schema conventions so it can
 * later be consumed by a standards-based validator such as AJV without
 * changing the persisted Profile Variant contract.
 *
 * The current browser validator remains the runtime enforcement layer
 * during P1/P1.5.
 */
export const PROFILE_VARIANT_SCHEMA_V1 =
  Object.freeze({
    $id:
      PROFILE_VARIANT_SCHEMA_ID_V1,

    $schema:
      "https://json-schema.org/draft/2020-12/schema",

    title:
      "Tejas Profile Variant v1",

    type:
      "object",

    additionalProperties:
      false,

    required: [
      "schema",
      "schemaId",
      "contentSchemaVersion",
      "profileVariantId",
      "contentHash",
      "createdAt",
      "targeting",
      "provenance",
      "content",
      "assets",
    ],

    properties: {
      schema: {
        const:
          PROFILE_VARIANT_DOCUMENT_SCHEMA,
      },

      schemaId: {
        const:
            PROFILE_VARIANT_SCHEMA_ID_V1,
      },

      contentSchemaVersion: {
        const:
          1,
      },

      profileVariantId: {
        type:
          "string",

        minLength:
          1,

        maxLength:
          160,

        pattern:
          "^[A-Za-z0-9._:-]+$",
      },

      contentHash: {
        type:
            "string",

        pattern:
            "^[a-fA-F0-9]{64}$",
      },

      createdAt: {
        type:
          "string",

        format:
          "date-time",
      },

      targeting: {
        type:
          "object",

        additionalProperties:
          false,

        required: [
          "location",
          "jobRole",
        ],

        properties: {
          location: {
            type:
              "string",
          },

          jobRole: {
            type:
              "string",
          },
        },
      },

      provenance: {
        type:
          "object",

        additionalProperties:
          false,

        required: [
          "legacyProfileVersionId",
          "platformVersionId",
          "gitSha",
          "checkpointTag",
          "sourceSnapshotKey",
        ],

        properties: {
          legacyProfileVersionId: {
            type: [
              "string",
              "null",
            ],
          },

          platformVersionId: {
            type: [
              "string",
              "null",
            ],
          },

          gitSha: {
            type: [
              "string",
              "null",
            ],
          },

          checkpointTag: {
            type: [
              "string",
              "null",
            ],
          },

          sourceSnapshotKey: {
            type: [
              "string",
              "null",
            ],
          },
        },
      },

      content: {
        type:
          "object",

        additionalProperties:
          false,

        required: [
            "hero",
            "aboutMe",
            "experience",
            "education",
            "skills",
            "resume",
            "projects",
            "codeLab",
            "funZone",
            "timeline",
            "contactLinks",
        ],

        properties: {
          hero: {
            type:
                "object",
          },

          aboutMe: {
            type:
              "object",
          },

          experience: {
            type:
              "array",
          },

          education: {
            type:
              "array",
          },

          skills: {
            type:
              "array",
          },

          resume: {
            type:
              "object",
          },

          projects: {
            type:
              "array",
          },

          codeLab: {
            type:
              "array",
          },

          funZone: {
            type:
                "object",
          },

          timeline: {
            type:
              "array",
          },

          contactLinks: {
            type:
              "array",
          },
        },
      },

      assets: {
        type:
          "array",

        items: {
          type:
            "object",

          additionalProperties:
            false,

          required: [
            "id",
            "kind",
            "objectKey",
            "sha256",
            "contentType",
          ],

          properties: {
            id: {
              type:
                "string",

              minLength:
                1,
            },

            kind: {
              type:
                "string",

              enum:
                PROFILE_VARIANT_ASSET_KINDS,
            },

            sourcePath: {
              type: [
                "string",
                "null",
              ],
            },

            objectKey: {
              type: [
                "string",
                "null",
              ],
            },

            sha256: {
              type: [
                "string",
                "null",
              ],

              pattern:
                "^[a-fA-F0-9]{64}$",
            },

            contentType: {
              type: [
                "string",
                "null",
              ],
            },
          },
        },
      },
    },
  });