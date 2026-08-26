// infra/cdk/test/profile-variants-contract.test.ts

import {
  PROFILE_VARIANT_DOCUMENT_SCHEMA,
  PROFILE_VARIANT_SCHEMA_ID_V1,
  canonicalJsonStringify,
  collectProfileAssetIds,
  computeProfileVariantContentHash,
  createProfileVariantAssetObjectKey,
  createProfileVariantManifestKey,
  hexSha256ToBase64,
  base64Sha256ToHex,
  normalizeAndValidateProfileVariantDocument,
} from "../lambda/profile-variants-contract";


const ASSET_SHA =
  "1".repeat(64);


function content() {
  return {
    hero: {},

    aboutMe: {
      profilePhotoAssetId:
        "profile.primary",
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
  };
}


function validVariant() {
  const variant: any = {
    schema:
      PROFILE_VARIANT_DOCUMENT_SCHEMA,

    schemaId:
      PROFILE_VARIANT_SCHEMA_ID_V1,

    contentSchemaVersion:
      1,

    profileVariantId:
      "prv_test_001",

    contentHash:
      "",

    createdAt:
      "2026-08-21T14:00:00.000Z",

    targeting: {
      location:
        "Dubai",

      jobRole:
        "Software Engineer",
    },

    provenance: {
      gitSha:
        "1111111111111111111111111111111111111111",
    },

    content:
      content(),

    assets: [
      {
        id:
          "profile.primary",

        kind:
          "profile_photo",

        objectKey:
          createProfileVariantAssetObjectKey({
            sha256:
              ASSET_SHA,

            contentType:
              "image/jpeg",
          }),

        sha256:
          ASSET_SHA,

        contentType:
          "image/jpeg",
      },
    ],
  };


  variant.contentHash =
    computeProfileVariantContentHash(
      variant
    );


  return variant;
}


describe(
  "Profile Variant backend contract",
  () => {
    test(
      "canonical JSON ignores object insertion order but preserves array order",
      () => {
        expect(
          canonicalJsonStringify({
            b: 2,
            a: {
              y: 1,
              x: 2,
            },
          })
        ).toBe(
          canonicalJsonStringify({
            a: {
              x: 2,
              y: 1,
            },
            b: 2,
          })
        );


        expect(
          canonicalJsonStringify([
            "a",
            "b",
          ])
        ).not.toBe(
          canonicalJsonStringify([
            "b",
            "a",
          ])
        );
      }
    );


    test(
      "content-addressed asset keys match the frontend publication convention",
      () => {
        expect(
          createProfileVariantAssetObjectKey({
            sha256:
              ASSET_SHA,

            contentType:
              "image/jpeg",
          })
        ).toBe(
          `assets/sha256/${ASSET_SHA}/image_jpeg`
        );
      }
    );


    test(
      "manifest keys accept safe IDs and reject unsafe IDs",
      () => {
        expect(
          createProfileVariantManifestKey(
            "prv_test:001"
          )
        ).toBe(
          "variants/prv_test:001/manifest.json"
        );


        expect(
          () =>
            createProfileVariantManifestKey(
              "../bad"
            )
        ).toThrow(
          "Invalid profileVariantId."
        );
      }
    );


    test(
      "SHA-256 hex/base64 conversion round-trips exactly",
      () => {
        expect(
          base64Sha256ToHex(
            hexSha256ToBase64(
              ASSET_SHA
            )
          )
        ).toBe(
          ASSET_SHA
        );
      }
    );


    test(
      "recursive asset discovery finds stable AssetId references",
      () => {
        expect(
          collectProfileAssetIds(
            content()
          )
        ).toEqual([
          "profile.primary",
        ]);
      }
    );


    test(
      "a complete frontend-compatible Profile Variant validates",
      () => {
        const normalized =
          normalizeAndValidateProfileVariantDocument(
            validVariant()
          );


        expect(
          normalized
            .profileVariantId
        ).toBe(
          "prv_test_001"
        );


        expect(
          normalized
            .assets
            .map(
              (
                asset: any
              ) =>
                asset.id
            )
        ).toEqual([
          "profile.primary",
        ]);
      }
    );


    test(
      "server rejects a client-supplied contentHash that does not match semantic content",
      () => {
        const variant =
          validVariant();


        variant.content.hero = {
          name:
            "Changed after hashing",
        };


        expect(
          () =>
            normalizeAndValidateProfileVariantDocument(
              variant
            )
        ).toThrow(
          "contentHash mismatch"
        );
      }
    );


    test(
      "server rejects missing, extra or incorrectly addressed assets",
      () => {
        const missing =
          validVariant();

        missing.assets = [];


        expect(
          () =>
            normalizeAndValidateProfileVariantDocument(
              missing
            )
        ).toThrow(
          "assets must exactly match asset references"
        );


        const wrongKey =
          validVariant();

        wrongKey.assets[0]
          .objectKey =
          "assets/sha256/not-canonical";


        expect(
          () =>
            normalizeAndValidateProfileVariantDocument(
              wrongKey
            )
        ).toThrow(
          ".objectKey must be"
        );
      }
    );
  }
);