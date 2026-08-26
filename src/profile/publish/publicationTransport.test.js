// src/profile/publish/publicationTransport.test.js

const {
  webcrypto,
} =
  require("crypto");


import {
  sha256BytesHex,
} from "../../utils/profileVariant";

import {
  PROFILE_PUBLICATION_PACKAGE_SCHEMA,
  CURRENT_PROFILE_PUBLICATION_PACKAGE_VERSION,
  publishProfilePublication,
} from ".";


const HASH_OPTIONS = {
  subtle:
    webcrypto.subtle,
};


const ASSET_BYTES =
  new Uint8Array([
    1,
    2,
    3,
    4,
    5,
  ]);


async function publication() {
  const sha256 =
    await sha256BytesHex(
      ASSET_BYTES,
      HASH_OPTIONS
    );


  const objectKey =
    `assets/sha256/${sha256}/image_jpeg`;


  return {
    schema:
      PROFILE_PUBLICATION_PACKAGE_SCHEMA,

    packageVersion:
      CURRENT_PROFILE_PUBLICATION_PACKAGE_VERSION,

    profileVariantId:
      "prv_transport_test",

    contentHash:
      "a".repeat(
        64
      ),

    variant: {
      profileVariantId:
        "prv_transport_test",

      contentHash:
        "a".repeat(
          64
        ),
    },

    manifestUpload: {
      objectKey:
        "variants/prv_transport_test/manifest.json",

      sha256:
        "b".repeat(
          64
        ),

      contentType:
        "application/json",

      body:
        "{}",
    },

    assetUploads: [
      {
        id:
          "profile.primary",

        kind:
          "profile_photo",

        objectKey,

        sha256,

        contentType:
          "image/jpeg",

        sourcePath:
          "src/assets/images/profile.jpg",
      },
    ],
  };
}


function apiFor(
  pub,
  overrides = {}
) {
  const asset =
    pub
      .assetUploads[0];


  return {
    presignProfileVariantAssetPut:
      jest.fn(
        async () => ({
          ok:
            true,

          key:
            asset.objectKey,

          alreadyExists:
            false,

          url:
            "https://example.test/upload",

          requiredHeaders: {
            "content-type":
              asset.contentType,

            "x-amz-checksum-sha256":
              "test-base64",
          },
        })
      ),

    uploadProfileVariantAssetToS3:
      jest.fn(
        async () =>
          true
      ),

    publishProfileVariant:
      jest.fn(
        async () => ({
          ok:
            true,

          alreadyPublished:
            false,

          profileVariantId:
            pub.profileVariantId,

          contentHash:
            pub.contentHash,

          key:
            pub
              .manifestUpload
              .objectKey,

          manifestSha256:
            pub
              .manifestUpload
              .sha256,
        })
      ),

    getProfileVariant:
      jest.fn(
        async () => ({
          ok:
            true,

          key:
            pub
              .manifestUpload
              .objectKey,

          manifestSha256:
            pub
              .manifestUpload
              .sha256,

          variant: {
            profileVariantId:
              pub
                .profileVariantId,

            contentHash:
              pub
                .contentHash,
          },
        })
      ),

    ...overrides,
  };
}


describe(
  "Profile publication transport",
  () => {
    test(
      "uploads missing immutable assets, publishes manifest last and verifies stored identity",
      async () => {
        const pub =
          await publication();

        const api =
          apiFor(
            pub
          );

        const calls = [];


        api
          .presignProfileVariantAssetPut
          .mockImplementation(
            async () => {
              calls.push(
                "presign"
              );

              return {
                ok:
                  true,

                key:
                  pub
                    .assetUploads[0]
                    .objectKey,

                alreadyExists:
                  false,

                url:
                  "https://example.test/upload",

                requiredHeaders: {
                  "content-type":
                    "image/jpeg",
                },
              };
            }
          );


        api
          .uploadProfileVariantAssetToS3
          .mockImplementation(
            async () => {
              calls.push(
                "upload"
              );

              return true;
            }
          );


        api
          .publishProfileVariant
          .mockImplementation(
            async () => {
              calls.push(
                "publish"
              );

              return {
                ok:
                  true,

                alreadyPublished:
                  false,

                profileVariantId:
                  pub
                    .profileVariantId,

                contentHash:
                  pub
                    .contentHash,

                key:
                  pub
                    .manifestUpload
                    .objectKey,

                manifestSha256:
                  pub
                    .manifestUpload
                    .sha256,
              };
            }
          );


        api
          .getProfileVariant
          .mockImplementation(
            async () => {
              calls.push(
                "read"
              );

              return {
                ok:
                  true,

                key:
                  pub
                    .manifestUpload
                    .objectKey,

                manifestSha256:
                  pub
                    .manifestUpload
                    .sha256,

                variant: {
                  profileVariantId:
                    pub
                      .profileVariantId,

                  contentHash:
                    pub
                      .contentHash,
                },
              };
            }
          );


        const result =
          await publishProfilePublication({
            publication:
              pub,

            readAssetBytes:
              async () =>
                ASSET_BYTES,

            api,

            hashOptions:
              HASH_OPTIONS,
          });


        expect(
          calls
        ).toEqual([
          "presign",
          "upload",
          "publish",
          "read",
        ]);


        expect(
          result.ok
        ).toBe(true);


        expect(
          result
            .assets[0]
        ).toEqual(
          expect.objectContaining({
            assetId:
              "profile.primary",

            uploaded:
              true,

            alreadyExists:
              false,
          })
        );
      }
    );


    test(
      "does not re-upload content-addressed assets already verified by backend",
      async () => {
        const pub =
          await publication();


        const api =
          apiFor(
            pub,
            {
              presignProfileVariantAssetPut:
                jest.fn(
                  async () => ({
                    ok:
                      true,

                    key:
                      pub
                        .assetUploads[0]
                        .objectKey,

                    alreadyExists:
                      true,
                  })
                ),
            }
          );


        await publishProfilePublication({
          publication:
            pub,

          readAssetBytes:
            async () => {
              throw new Error(
                "reader must not run"
              );
            },

          api,

          hashOptions:
            HASH_OPTIONS,
        });


        expect(
          api
            .uploadProfileVariantAssetToS3
        ).not.toHaveBeenCalled();
      }
    );


    test(
      "fails closed if backend presign resolves a different object key",
      async () => {
        const pub =
          await publication();


        const api =
          apiFor(
            pub,
            {
              presignProfileVariantAssetPut:
                jest.fn(
                  async () => ({
                    ok:
                      true,

                    key:
                      "assets/sha256/wrong",

                    alreadyExists:
                      true,
                  })
                ),
            }
          );


        await expect(
          publishProfilePublication({
            publication:
              pub,

            readAssetBytes:
              async () =>
                ASSET_BYTES,

            api,

            hashOptions:
              HASH_OPTIONS,
          })
        ).rejects.toThrow(
          "presign key does not match publication package"
        );


        expect(
          api
            .publishProfileVariant
        ).not.toHaveBeenCalled();
      }
    );


    test(
      "detects source bytes changing after publication package creation",
      async () => {
        const pub =
          await publication();

        const api =
          apiFor(
            pub
          );


        await expect(
          publishProfilePublication({
            publication:
              pub,

            readAssetBytes:
              async () =>
                new Uint8Array([
                  99,
                  98,
                  97,
                ]),

            api,

            hashOptions:
              HASH_OPTIONS,
          })
        ).rejects.toThrow(
          "bytes changed after publication package creation"
        );


        expect(
          api
            .uploadProfileVariantAssetToS3
        ).not.toHaveBeenCalled();


        expect(
          api
            .publishProfileVariant
        ).not.toHaveBeenCalled();
      }
    );


    test(
      "rejects publication response with a different content identity",
      async () => {
        const pub =
          await publication();


        const api =
          apiFor(
            pub,
            {
              publishProfileVariant:
                jest.fn(
                  async () => ({
                    ok:
                      true,

                    profileVariantId:
                      pub
                        .profileVariantId,

                    contentHash:
                      "c".repeat(
                        64
                      ),

                    key:
                      pub
                        .manifestUpload
                        .objectKey,

                    manifestSha256:
                      pub
                        .manifestUpload
                        .sha256,
                  })
                ),
            }
          );


        await expect(
          publishProfilePublication({
            publication:
              pub,

            readAssetBytes:
              async () =>
                ASSET_BYTES,

            api,

            hashOptions:
              HASH_OPTIONS,
          })
        ).rejects.toThrow(
          "contentHash does not match"
        );


        expect(
          api
            .getProfileVariant
        ).not.toHaveBeenCalled();
      }
    );


    test(
      "rejects publication response with a different manifest checksum",
      async () => {
        const pub =
          await publication();


        const api =
          apiFor(
            pub,
            {
              publishProfileVariant:
                jest.fn(
                  async () => ({
                    ok:
                      true,

                    profileVariantId:
                      pub
                        .profileVariantId,

                    contentHash:
                      pub
                        .contentHash,

                    key:
                      pub
                        .manifestUpload
                        .objectKey,

                    manifestSha256:
                      "c".repeat(
                        64
                      ),
                  })
                ),
            }
          );


        await expect(
          publishProfilePublication({
            publication:
              pub,

            readAssetBytes:
              async () =>
                ASSET_BYTES,

            api,

            hashOptions:
              HASH_OPTIONS,
          })
        ).rejects.toThrow(
          "manifest checksum does not match"
        );
      }
    );


    test(
      "requires read-after-write Profile Variant identity to match publication",
      async () => {
        const pub =
          await publication();


        const api =
          apiFor(
            pub,
            {
              getProfileVariant:
                jest.fn(
                  async () => ({
                    ok:
                      true,

                    key:
                      pub
                        .manifestUpload
                        .objectKey,

                    manifestSha256:
                      pub
                        .manifestUpload
                        .sha256,

                    variant: {
                      profileVariantId:
                        pub
                          .profileVariantId,

                      contentHash:
                        "d".repeat(
                          64
                        ),
                    },
                  })
                ),
            }
          );


        await expect(
          publishProfilePublication({
            publication:
              pub,

            readAssetBytes:
              async () =>
                ASSET_BYTES,

            api,

            hashOptions:
              HASH_OPTIONS,
          })
        ).rejects.toThrow(
          "contentHash failed read-after-write verification"
        );
      }
    );


    test(
      "rejects malformed publication packages before making API calls",
      async () => {
        const api = {
          presignProfileVariantAssetPut:
            jest.fn(),

          uploadProfileVariantAssetToS3:
            jest.fn(),

          publishProfileVariant:
            jest.fn(),

          getProfileVariant:
            jest.fn(),
        };


        await expect(
          publishProfilePublication({
            publication: {
              schema:
                "wrong",
            },

            readAssetBytes:
              async () =>
                ASSET_BYTES,

            api,

            hashOptions:
              HASH_OPTIONS,
          })
        ).rejects.toThrow(
          "Profile publication package schema"
        );


        expect(
          api
            .presignProfileVariantAssetPut
        ).not.toHaveBeenCalled();
      }
    );
  }
);