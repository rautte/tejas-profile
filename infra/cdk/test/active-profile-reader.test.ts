// infra/cdk/test/active-profile-reader.test.ts

import {
  marshall,
} from "@aws-sdk/util-dynamodb";

import {
  buildProfileActivationTransition,
} from "../lambda/profile-activation-contract";

import {
  computeProfileVariantContentHash,
  createProfileVariantAssetObjectKey,
  normalizeAndValidateProfileVariantDocument,
} from "../lambda/profile-variants-contract";

import {
  readPublicActiveProfile,
} from "../lambda/active-profile-reader";


const ASSET_SHA =
  "1".repeat(
    64
  );


function content() {
  return {
    hero:
      {},

    aboutMe: {
      profilePhotoAssetId:
        "profile.primary",
    },

    experience:
      [],

    education:
      [],

    skills:
      [],

    resume:
      {},

    projects:
      [],

    codeLab:
      [],

    funZone:
      {},

    timeline:
      [],

    contactLinks:
      [],
  };
}


function variant() {
  const document:
    any = {
    schema:
      "tejas-profile.profile-variant",

    schemaId:
      "tejas-profile.profile-variant.v1",

    contentSchemaVersion:
      1,

    profileVariantId:
      "prv_public_test",

    contentHash:
      "",

    createdAt:
      "2026-08-22T10:00:00.000Z",

    targeting: {
      location:
        "Dubai",

      jobRole:
        "Software Engineer",
    },

    provenance: {
      gitSha:
        "1111111111111111111111111111111111111111",

      internal:
        "must-not-leak",
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

        sourcePath:
          "src/assets/images/private-path.jpg",
      },
    ],
  };


  document.contentHash =
    computeProfileVariantContentHash(
      document
    );


  return normalizeAndValidateProfileVariantDocument(
    document
  );
}


function pointer(
  doc =
    variant()
) {
  return buildProfileActivationTransition({
    activationId:
      "act_public_test",

    profileVariantId:
      doc
        .profileVariantId,

    activatedAt:
      "2026-08-22T11:00:00.000Z",

    contentSchemaVersion:
      doc
        .contentSchemaVersion,

    contentHash:
      doc
        .contentHash,
  })
    .pointer;
}


function activationClientFor(
  activePointer:
    any | null
) {
  return {
    send:
      jest.fn(
        async () =>
          activePointer
            ? {
                Item:
                  marshall(
                    activePointer
                  ),
              }
            : {}
      ),
  };
}


function s3ClientFor(
  doc:
    any
) {
  return {
    send:
      jest.fn(
        async () => ({
          Body: {
            transformToString:
              async () =>
                JSON.stringify(
                  doc
                ),
          },
        })
      ),
  };
}


describe(
  "Public active Profile reader",
  () => {
    test(
      "no active pointer is a valid empty state and does not read S3",
      async () => {
        const activationClient =
          activationClientFor(
            null
          );

        const s3Client =
          s3ClientFor(
            variant()
          );


        const result =
          await readPublicActiveProfile({
            activationClient,

            s3Client,

            activationTableName:
              "activation-table",

            profileVariantsBucket:
              "variant-bucket",

            presignAssetUrl:
              jest.fn(),
          });


        expect(
          result
        ).toBeNull();


        expect(
          s3Client.send
        ).not.toHaveBeenCalled();
      }
    );


    test(
      "returns only the currently active validated Profile Variant",
      async () => {
        const doc =
          variant();


        const result =
          await readPublicActiveProfile({
            activationClient:
              activationClientFor(
                pointer(
                  doc
                )
              ),

            s3Client:
              s3ClientFor(
                doc
              ),

            activationTableName:
              "activation-table",

            profileVariantsBucket:
              "variant-bucket",

            presignAssetUrl:
              jest.fn(
                async () =>
                  "https://assets.example.test/profile.jpg"
              ),
          });


        expect(
          result
            ?.active
            .profileVariantId
        ).toBe(
          "prv_public_test"
        );


        expect(
          result
            ?.variant
            .content
        ).toEqual(
          doc.content
        );


        expect(
          result
            ?.variant
            .assets[0]
            .url
        ).toBe(
          "https://assets.example.test/profile.jpg"
        );
      }
    );


    test(
      "public response does not leak provenance, source paths or internal object keys",
      async () => {
        const doc =
          variant();


        const result =
          await readPublicActiveProfile({
            activationClient:
              activationClientFor(
                pointer(
                  doc
                )
              ),

            s3Client:
              s3ClientFor(
                doc
              ),

            activationTableName:
              "activation-table",

            profileVariantsBucket:
              "variant-bucket",

            presignAssetUrl:
              jest.fn(
                async () =>
                  "https://assets.example.test/profile.jpg"
              ),
          });


        const serialized =
          JSON.stringify(
            result
          );


        expect(
          serialized
        ).not.toContain(
          "provenance"
        );


        expect(
          serialized
        ).not.toContain(
          "sourcePath"
        );


        expect(
          serialized
        ).not.toContain(
          "assets/sha256/"
        );


        expect(
          serialized
        ).not.toContain(
          "must-not-leak"
        );
      }
    );


    test(
      "active pointer and immutable manifest identity must match",
      async () => {
        const doc =
          variant();

        const badPointer = {
          ...pointer(
            doc
          ),

          contentHash:
            "f".repeat(
              64
            ),
        };


        await expect(
          readPublicActiveProfile({
            activationClient:
              activationClientFor(
                badPointer
              ),

            s3Client:
              s3ClientFor(
                doc
              ),

            activationTableName:
              "activation-table",

            profileVariantsBucket:
              "variant-bucket",

            presignAssetUrl:
              jest.fn(),
          })
        ).rejects.toThrow(
          "contentHash does not match active pointer"
        );
      }
    );


    test(
      "only assets in the active immutable manifest receive public URLs",
      async () => {
        const doc =
          variant();


        const presignAssetUrl =
          jest.fn(
            async () =>
              "https://assets.example.test/profile.jpg"
          );


        await readPublicActiveProfile({
          activationClient:
            activationClientFor(
              pointer(
                doc
              )
            ),

          s3Client:
            s3ClientFor(
              doc
            ),

          activationTableName:
            "activation-table",

          profileVariantsBucket:
            "variant-bucket",

          presignAssetUrl,
        });


        expect(
          presignAssetUrl
        ).toHaveBeenCalledTimes(
          1
        );


        expect(
          presignAssetUrl
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            assetId:
              "profile.primary",

            objectKey:
              doc
                .assets[0]
                .objectKey,
          })
        );
      }
    );
  }
);