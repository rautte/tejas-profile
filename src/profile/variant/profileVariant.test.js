// src/profile/variant/profileVariant.test.js

const {
  TextEncoder,
} =
  require("util");

const {
  webcrypto,
} =
  require("crypto");


import {
  buildProfileContent,
} from "../content";

import {
  createProfileDraft,
} from "../draft";

import {
  PROFILE_VARIANT_SCHEMA_ID_V1,
  canonicalJsonStringify,
  validateProfileVariantDocument,
  sha256BytesHex,
} from "../../utils/profileVariant";

import {
  buildProfileVariantFromDraft,
  computeProfileVariantContentHash,
  createProfileVariantContentIdentityPayload,
  normalizePublishedAssets,
} from ".";


const HASH_OPTIONS = {
  subtle:
    webcrypto.subtle,

  TextEncoderImpl:
    TextEncoder,
};


const ASSETS = [
  {
    id:
      "resume.primary",

    kind:
      "resume_pdf",

    objectKey:
      "profile-variants/assets/resume/abc.pdf",

    sha256:
      "1".repeat(64),

    contentType:
      "application/pdf",
  },

  {
    id:
      "profile.primary",

    kind:
      "profile_photo",

    objectKey:
      "profile-variants/assets/profile/abc.jpg",

    sha256:
      "2".repeat(64),

    contentType:
      "image/jpeg",
  },
];


function publishableDraft() {
  return createProfileDraft({
    draftId:
      "draft_publish_test",

    targeting: {
      location:
        "Dubai",

      jobRole:
        "Software Development Engineer 1",
    },

    content:
      buildProfileContent(),

    createdAt:
      "2026-08-21T10:00:00.000Z",
  });
}


describe(
  "Immutable Profile Variant builder",
  () => {
    test(
      "canonical JSON is independent of object key insertion order",
      () => {
        expect(
          canonicalJsonStringify({
            b: 2,
            a: {
              z: 3,
              y: 4,
            },
          })
        ).toBe(
          canonicalJsonStringify({
            a: {
              y: 4,
              z: 3,
            },
            b: 2,
          })
        );
      }
    );


    test(
      "SHA-256 helper produces the standard digest",
      async () => {
        const digest =
          await computeProfileVariantContentHash(
            {
              hello:
                "world",
            },
            HASH_OPTIONS
          );


        expect(
          digest
        ).toMatch(
          /^[a-f0-9]{64}$/
        );


        expect(
          digest
        ).toBe(
          "93a23971a914e5eacbf0a8d25154cda309c3c1c72fbb9914d47c60f3cb681588"
        );
      }
    );


    test(
        "binary SHA-256 hashes exact bytes rather than string coercion",
        async () => {
            const bytes =
            new Uint8Array([
                0,
                1,
                2,
                3,
                255,
            ]);


            const digest =
            await sha256BytesHex(
                bytes,
                HASH_OPTIONS
            );


            expect(
                digest
            ).toBe(
                "ff5d8507b6a72bee2debce2c0054798deaccdc5d8a1b945b6280ce8aa9cba52e"
            );
        }
    );


    test(
      "published asset normalization is deterministic",
      () => {
        const normalized =
          normalizePublishedAssets(
            ASSETS
          );


        expect(
          normalized.map(
            (asset) =>
              asset.id
          )
        ).toEqual([
          "profile.primary",
          "resume.primary",
        ]);
      }
    );


    test(
      "content identity excludes object keys and publication provenance",
      () => {
        const draft =
          publishableDraft();


        const payload =
          createProfileVariantContentIdentityPayload({
            targeting:
              draft.targeting,

            content:
              draft.content,

            assets:
              ASSETS,
          });


        expect(
          payload.assets[0]
        ).not.toHaveProperty(
          "objectKey"
        );

        expect(
          payload
        ).not.toHaveProperty(
          "createdAt"
        );

        expect(
          payload
        ).not.toHaveProperty(
          "gitSha"
        );

        expect(
          payload
        ).not.toHaveProperty(
          "profileVariantId"
        );
      }
    );


    test(
      "builds a valid immutable Profile Variant from a publish-ready Draft",
      async () => {
        const variant =
          await buildProfileVariantFromDraft({
            draft:
              publishableDraft(),

            profileVariantId:
              "prv_dubai_001",

            assets:
              ASSETS,

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

            createdAt:
              "2026-08-21T11:00:00.000Z",

            hashOptions:
              HASH_OPTIONS,
          });


        expect(
          variant.schemaId
        ).toBe(
          PROFILE_VARIANT_SCHEMA_ID_V1
        );


        expect(
          variant.contentHash
        ).toMatch(
          /^[a-f0-9]{64}$/
        );


        expect(
          validateProfileVariantDocument(
            variant
          ).valid
        ).toBe(true);
      }
    );


    test(
      "same semantic profile receives same content hash across publication identity and provenance",
      async () => {
        const draft =
          publishableDraft();


        const first =
          await buildProfileVariantFromDraft({
            draft,

            profileVariantId:
              "prv_one",

            assets:
              ASSETS,

            provenance: {
              gitSha:
                "1111111111111111111111111111111111111111",
            },

            createdAt:
              "2026-08-21T11:00:00.000Z",

            hashOptions:
              HASH_OPTIONS,
          });


        const second =
          await buildProfileVariantFromDraft({
            draft,

            profileVariantId:
              "prv_two",

            assets:
              ASSETS.map(
                (asset) => ({
                  ...asset,

                  objectKey:
                    `different/${asset.id}`,
                })
              ),

            provenance: {
              gitSha:
                "2222222222222222222222222222222222222222",
            },

            createdAt:
              "2026-08-22T11:00:00.000Z",

            hashOptions:
              HASH_OPTIONS,
          });


        expect(
          first.contentHash
        ).toBe(
          second.contentHash
        );
      }
    );


    test(
      "changing recruiter-facing content changes the content hash",
      async () => {
        const firstDraft =
          publishableDraft();

        const secondDraft =
          publishableDraft();

        secondDraft
          .content
          .hero
          .name =
          "Different Name";


        const first =
          await buildProfileVariantFromDraft({
            draft:
              firstDraft,

            profileVariantId:
              "prv_one",

            assets:
              ASSETS,

            hashOptions:
              HASH_OPTIONS,
          });


        const second =
          await buildProfileVariantFromDraft({
            draft:
              secondDraft,

            profileVariantId:
              "prv_two",

            assets:
              ASSETS,

            hashOptions:
              HASH_OPTIONS,
          });


        expect(
          first.contentHash
        ).not.toBe(
          second.contentHash
        );
      }
    );


    test(
      "changing immutable asset bytes changes the content hash",
      async () => {
        const draft =
          publishableDraft();


        const first =
          await buildProfileVariantFromDraft({
            draft,

            profileVariantId:
              "prv_one",

            assets:
              ASSETS,

            hashOptions:
              HASH_OPTIONS,
          });


        const changedAssets =
          ASSETS.map(
            (asset) =>
              asset.id ===
              "resume.primary"
                ? {
                    ...asset,

                    sha256:
                      "9".repeat(64),
                  }
                : asset
          );


        const second =
          await buildProfileVariantFromDraft({
            draft,

            profileVariantId:
              "prv_two",

            assets:
              changedAssets,

            hashOptions:
              HASH_OPTIONS,
          });


        expect(
          first.contentHash
        ).not.toBe(
          second.contentHash
        );
      }
    );


    test(
      "incomplete targeting cannot be published",
      async () => {
        const draft =
          createProfileDraft({
            draftId:
              "draft_incomplete",

            targeting: {
              location:
                "",

              jobRole:
                "",
            },

            content:
              buildProfileContent(),

            createdAt:
              "2026-08-21T10:00:00.000Z",
          });


        await expect(
          buildProfileVariantFromDraft({
            draft,

            profileVariantId:
              "prv_invalid",

            assets:
              ASSETS,

            hashOptions:
              HASH_OPTIONS,
          })
        ).rejects.toThrow(
          "missing targeting metadata location, jobRole"
        );
      }
    );


    test(
      "duplicate published asset IDs fail closed",
      () => {
        expect(
          () =>
            normalizePublishedAssets([
              ASSETS[0],
              {
                ...ASSETS[0],
              },
            ])
        ).toThrow(
          'Duplicate published Profile Variant asset ID "resume.primary".'
        );
      }
    );
  }
);