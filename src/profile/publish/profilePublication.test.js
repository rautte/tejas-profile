// src/profile/publish/profilePublication.test.js

const fs =
  require("fs");

const path =
  require("path");

const {
  createHash,
  webcrypto,
} =
  require("crypto");

const {
  TextEncoder,
} =
  require("util");


import {
  PROFILE_ASSET_CATALOG,
} from "../../data/profileAssets";

import {
  buildProfileContent,
} from "../content";

import {
  createProfileDraft,
} from "../draft";

import {
  validateProfileVariantDocument,
} from "../../utils/profileVariant";

import {
  CURRENT_PROFILE_PUBLICATION_PACKAGE_VERSION,
  PROFILE_PUBLICATION_PACKAGE_SCHEMA,
  PROFILE_VARIANT_STORAGE_PREFIXES,
  buildProfilePublicationPackage,
  collectProfileAssetIds,
  materializePublishedProfileAssets,
  resolveProfileAssetDefinitions,
} from ".";


const HASH_OPTIONS = {
  subtle:
    webcrypto.subtle,

  TextEncoderImpl:
    TextEncoder,
};


const EXPECTED_CURRENT_ASSET_IDS = [
  "education.neu",
  "education.student-special-achiever-2018-2019",
  "education.utaustin",
  "education.vit",
  "profile.primary",
  "resume.primary",
];


async function readRepoAssetBytes(
  definition
) {
  const absolutePath =
    path.resolve(
      process.cwd(),
      definition
        .sourcePath
    );


  return fs.promises
    .readFile(
      absolutePath
    );
}


function nodeSha256(
  bytes
) {
  return createHash(
    "sha256"
  )
    .update(
      bytes
    )
    .digest(
      "hex"
    );
}


function publishableDraft() {
  return createProfileDraft({
    draftId:
      "draft_publication_test",

    targeting: {
      location:
        "Test Location",

      jobRole:
        "Software Engineer",
    },

    content:
      buildProfileContent(),

    createdAt:
      "2026-08-21T12:00:00.000Z",
  });
}


describe(
  "Profile publication package",
  () => {
    test(
      "current ProfileContent exposes exactly the expected profile-owned asset references",
      () => {
        const ids =
          collectProfileAssetIds(
            buildProfileContent()
          );


        expect(
          ids
        ).toEqual(
          EXPECTED_CURRENT_ASSET_IDS
        );
      }
    );


    test(
      "every current ProfileContent asset reference resolves through the asset catalog",
      () => {
        const definitions =
          resolveProfileAssetDefinitions(
            buildProfileContent()
          );


        expect(
          definitions.map(
            (definition) =>
              definition.id
          )
        ).toEqual(
          EXPECTED_CURRENT_ASSET_IDS
        );


        for (
          const definition of
            definitions
        ) {
          expect(
            definition
              .sourcePath
          ).toEqual(
            expect.any(
              String
            )
          );

          expect(
            definition
              .contentType
          ).toEqual(
            expect.any(
              String
            )
          );
        }
      }
    );


    test(
      "all current catalog-backed Profile assets exist and hash their real repository bytes",
      async () => {
        const assets =
          await materializePublishedProfileAssets({
            content:
              buildProfileContent(),

            readAssetBytes:
              readRepoAssetBytes,

            hashOptions:
              HASH_OPTIONS,
          });


        expect(
          assets
        ).toHaveLength(
          EXPECTED_CURRENT_ASSET_IDS
            .length
        );


        for (
          const asset of
            assets
        ) {
          const absolutePath =
            path.resolve(
              process.cwd(),
              asset
                .sourcePath
            );


          expect(
            fs.existsSync(
              absolutePath
            )
          ).toBe(true);


          const bytes =
            await fs.promises
              .readFile(
                absolutePath
              );


          expect(
            asset.sha256
          ).toBe(
            nodeSha256(
              bytes
            )
          );


          expect(
            asset.objectKey
              .startsWith(
                PROFILE_VARIANT_STORAGE_PREFIXES
                  .assets
              )
          ).toBe(true);


          expect(
            asset.objectKey
          ).toContain(
            asset.sha256
          );
        }
      }
    );


    test(
      "published asset object keys exclude platform game and geo namespaces",
      async () => {
        const assets =
          await materializePublishedProfileAssets({
            content:
              buildProfileContent(),

            readAssetBytes:
              readRepoAssetBytes,

            hashOptions:
              HASH_OPTIONS,
          });


        const serialized =
          JSON.stringify(
            assets
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


    test(
      "builds a complete immutable publication package from real current assets",
      async () => {
        const publication =
          await buildProfilePublicationPackage({
            draft:
              publishableDraft(),

            profileVariantId:
              "prv_local_publication_test",

            provenance: {
              platformVersionId:
                "platform_test",

              legacyProfileVersionId:
                "pv_test",

              gitSha:
                "1111111111111111111111111111111111111111",
            },

            createdAt:
              "2026-08-21T13:00:00.000Z",

            readAssetBytes:
              readRepoAssetBytes,

            hashOptions:
              HASH_OPTIONS,
          });


        expect(
          publication.schema
        ).toBe(
          PROFILE_PUBLICATION_PACKAGE_SCHEMA
        );


        expect(
          publication
            .packageVersion
        ).toBe(
          CURRENT_PROFILE_PUBLICATION_PACKAGE_VERSION
        );


        expect(
          publication
            .assetUploads
        ).toHaveLength(
          EXPECTED_CURRENT_ASSET_IDS
            .length
        );


        expect(
          publication
            .variant
            .assets
        ).toHaveLength(
          EXPECTED_CURRENT_ASSET_IDS
            .length
        );


        expect(
          validateProfileVariantDocument(
            publication.variant
          ).valid
        ).toBe(true);


        expect(
          publication
            .manifestUpload
            .objectKey
        ).toBe(
          "variants/prv_local_publication_test/manifest.json"
        );


        expect(
          JSON.parse(
            publication
              .manifestUpload
              .body
          )
        ).toEqual(
          publication.variant
        );
      }
    );


    test(
      "manifest byte checksum matches its exact canonical JSON body",
      async () => {
        const publication =
          await buildProfilePublicationPackage({
            draft:
              publishableDraft(),

            profileVariantId:
              "prv_manifest_hash_test",

            createdAt:
              "2026-08-21T13:00:00.000Z",

            readAssetBytes:
              readRepoAssetBytes,

            hashOptions:
              HASH_OPTIONS,
          });


        expect(
          publication
            .manifestUpload
            .sha256
        ).toBe(
          nodeSha256(
            Buffer.from(
              publication
                .manifestUpload
                .body,
              "utf8"
            )
          )
        );
      }
    );


    test(
      "same semantic profile and asset bytes retain the same content identity across publication IDs",
      async () => {
        const draft =
          publishableDraft();


        const first =
          await buildProfilePublicationPackage({
            draft,

            profileVariantId:
              "prv_publication_one",

            createdAt:
              "2026-08-21T13:00:00.000Z",

            readAssetBytes:
              readRepoAssetBytes,

            hashOptions:
              HASH_OPTIONS,
          });


        const second =
          await buildProfilePublicationPackage({
            draft,

            profileVariantId:
              "prv_publication_two",

            createdAt:
              "2026-08-22T13:00:00.000Z",

            readAssetBytes:
              readRepoAssetBytes,

            hashOptions:
              HASH_OPTIONS,
          });


        expect(
          first.contentHash
        ).toBe(
          second.contentHash
        );


        expect(
          first.assetUploads.map(
            (asset) =>
              asset.objectKey
          )
        ).toEqual(
          second.assetUploads.map(
            (asset) =>
              asset.objectKey
          )
        );


        expect(
          first
            .manifestUpload
            .sha256
        ).not.toBe(
          second
            .manifestUpload
            .sha256
        );
      }
    );


    test(
      "changing actual profile asset bytes changes the semantic content hash",
      async () => {
        const draft =
          publishableDraft();


        const baseline =
          await buildProfilePublicationPackage({
            draft,

            profileVariantId:
              "prv_asset_baseline",

            readAssetBytes:
              readRepoAssetBytes,

            hashOptions:
              HASH_OPTIONS,
          });


        const modified =
          await buildProfilePublicationPackage({
            draft,

            profileVariantId:
              "prv_asset_modified",

            readAssetBytes:
              async (
                definition
              ) => {
                const original =
                  await readRepoAssetBytes(
                    definition
                  );


                if (
                  definition.id !==
                    "resume.primary"
                ) {
                  return original;
                }


                return Buffer.concat([
                  original,

                  Buffer.from([
                    0,
                  ]),
                ]);
              },

            hashOptions:
              HASH_OPTIONS,
          });


        expect(
          baseline
            .contentHash
        ).not.toBe(
          modified
            .contentHash
        );
      }
    );


    test(
      "missing asset catalog definitions fail closed",
      () => {
        const content =
          buildProfileContent();


        content
          .aboutMe
          .profilePhotoAssetId =
          "missing.profile.asset";


        expect(
          () =>
            resolveProfileAssetDefinitions(
              content,
              PROFILE_ASSET_CATALOG
            )
        ).toThrow(
          'Profile asset "missing.profile.asset" is referenced by ProfileContent but is missing from the asset catalog.'
        );
      }
    );


    test(
      "reuses already-materialized assetUploads without reading bytes or requiring a catalog, and retargeting alone still changes contentHash",
      async () => {
        const sourcePublication =
          await buildProfilePublicationPackage({
            draft:
              publishableDraft(),

            profileVariantId:
              "prv_source_for_retargeting",

            createdAt:
              "2026-08-21T13:00:00.000Z",

            readAssetBytes:
              readRepoAssetBytes,

            hashOptions:
              HASH_OPTIONS,
          });


        const retargetedDraft =
          createProfileDraft({
            draftId:
              "draft_retargeted",

            targeting: {
              location:
                "Austin, TX",

              jobRole:
                "Platform Engineer",
            },

            content:
              sourcePublication
                .variant
                .content,

            createdAt:
              "2026-09-01T09:00:00.000Z",
          });


        const failingReader =
          () => {
            throw new Error(
              "readAssetBytes must not be called when assetUploads is supplied."
            );
          };


        const retargetedPublication =
          await buildProfilePublicationPackage({
            draft:
              retargetedDraft,

            profileVariantId:
              "prv_retargeted",

            assetUploads:
              sourcePublication
                .variant
                .assets,

            readAssetBytes:
              failingReader,

            createdAt:
              "2026-09-01T09:00:00.000Z",

            hashOptions:
              HASH_OPTIONS,
          });


        expect(
          validateProfileVariantDocument(
            retargetedPublication.variant
          ).valid
        ).toBe(true);


        expect(
          retargetedPublication
            .variant
            .assets
        ).toEqual(
          sourcePublication
            .variant
            .assets
        );


        expect(
          retargetedPublication
            .variant
            .content
        ).toEqual(
          sourcePublication
            .variant
            .content
        );


        expect(
          retargetedPublication
            .contentHash
        ).not.toBe(
          sourcePublication
            .contentHash
        );
      }
    );
  }
);