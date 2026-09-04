// src/utils/snapshots/snapshotsApi.test.js

import {
  OWNER_SESSION_KEY,
  OWNER_SESSION_EXPIRES_AT_KEY,
  OWNER_SESSION_TOKEN_KEY,
} from "../../config/owner";


const ORIGINAL_ENV =
  process.env;


function response(
  {
    status = 200,
    body = {},
    text,
  } = {}
) {
  return {
    ok:
      status >= 200 &&
      status < 300,

    status,

    json:
      jest.fn(
        async () =>
          body
      ),

    text:
      jest.fn(
        async () =>
          text ??
          JSON.stringify(
            body
          )
      ),
  };
}


describe(
  "Snapshots API Profile Variant transport primitives",
  () => {
    beforeEach(
      () => {
        jest
          .resetModules();

        process.env = {
          ...ORIGINAL_ENV,

          REACT_APP_SNAPSHOTS_API:
            "https://api.example.test/",
        };

        sessionStorage.clear();

        sessionStorage.setItem(
          OWNER_SESSION_KEY,
          "1"
        );

        sessionStorage.setItem(
          OWNER_SESSION_TOKEN_KEY,
          "owner-test-token"
        );

        sessionStorage.setItem(
          OWNER_SESSION_EXPIRES_AT_KEY,
          String(
            Date.now() +
            60 * 60 * 1000
          )
        );

        global.fetch =
          jest.fn();
      }
    );


    afterAll(
      () => {
        process.env =
          ORIGINAL_ENV;
      }
    );


    test(
      "presign request uses owner auth and immutable asset identity",
      async () => {
        global.fetch.mockResolvedValue(
          response({
            body: {
              ok:
                true,

              key:
                "assets/sha256/test/image_jpeg",

              alreadyExists:
                true,
            },
          })
        );


        const {
          presignProfileVariantAssetPut,
        } =
          require(
            "./snapshotsApi"
          );


        await presignProfileVariantAssetPut({
          sha256:
            "a".repeat(
              64
            ),

          contentType:
            "image/jpeg",
        });


        expect(
          global.fetch
        ).toHaveBeenCalledTimes(
          1
        );


        const [
          url,
          options,
        ] =
          global
            .fetch
            .mock
            .calls[0];


        expect(url).toBe(
          "https://api.example.test/profile-variants/assets/presign-put"
        );


        expect(
          options.method
        ).toBe(
          "POST"
        );


        expect(
          options
            .headers[
              "x-owner-token"
            ]
        ).toBe(
          "owner-test-token"
        );


        expect(
          JSON.parse(
            options.body
          )
        ).toEqual({
          sha256:
            "a".repeat(
              64
            ),

          contentType:
            "image/jpeg",
        });
      }
    );


    test(
      "S3 upload forwards only backend-required presigned headers",
      async () => {
        global.fetch.mockResolvedValue(
          response({
            status:
              200,
          })
        );


        const {
          uploadProfileVariantAssetToS3,
        } =
          require(
            "./snapshotsApi"
          );


        const bytes =
          new Uint8Array([
            1,
            2,
            3,
          ]);


        await uploadProfileVariantAssetToS3({
          url:
            "https://s3.example.test/object",

          body:
            bytes,

          requiredHeaders: {
            "content-type":
              "image/jpeg",

            "x-amz-checksum-sha256":
              "checksum",

            "if-none-match":
              "*",
          },
        });


        const [
          url,
          options,
        ] =
          global
            .fetch
            .mock
            .calls[0];


        expect(url).toBe(
          "https://s3.example.test/object"
        );


        expect(
          options.method
        ).toBe(
          "PUT"
        );


        expect(
          options.body
        ).toBe(
          bytes
        );


        expect(
          options.headers
        ).toEqual({
          "content-type":
            "image/jpeg",

          "x-amz-checksum-sha256":
            "checksum",

          "if-none-match":
            "*",
        });


        expect(
          options.headers[
            "x-owner-token"
          ]
        ).toBeUndefined();
      }
    );


    test(
      "publish request sends immutable variant through owner API",
      async () => {
        global.fetch.mockResolvedValue(
          response({
            body: {
              ok:
                true,

              profileVariantId:
                "prv_test",
            },
          })
        );


        const {
          publishProfileVariant,
        } =
          require(
            "./snapshotsApi"
          );


        const variant = {
          profileVariantId:
            "prv_test",
        };


        await publishProfileVariant(
          variant
        );


        const [
          url,
          options,
        ] =
          global
            .fetch
            .mock
            .calls[0];


        expect(url).toBe(
          "https://api.example.test/profile-variants/publish"
        );


        expect(
          options.method
        ).toBe(
          "POST"
        );


        expect(
          options
            .headers[
              "x-owner-token"
            ]
        ).toBe(
          "owner-test-token"
        );


        expect(
          JSON.parse(
            options.body
          )
        ).toEqual({
          variant,
        });
      }
    );


    test(
      "owner read encodes profileVariantId and disables caching",
      async () => {
        global.fetch.mockResolvedValue(
          response({
            body: {
              ok:
                true,

              variant: {
                profileVariantId:
                  "prv:one",
              },
            },
          })
        );


        const {
          getProfileVariant,
        } =
          require(
            "./snapshotsApi"
          );


        await getProfileVariant(
          "prv:one"
        );


        const [
          url,
          options,
        ] =
          global
            .fetch
            .mock
            .calls[0];


        expect(url).toBe(
          "https://api.example.test/profile-variants/get?profileVariantId=prv%3Aone"
        );


        expect(
          options.method
        ).toBe(
          "GET"
        );


        expect(
          options.cache
        ).toBe(
          "no-store"
        );
      }
    );


    test(
      "Profile Variant API failures surface backend error messages",
      async () => {
        global.fetch.mockResolvedValue(
          response({
            status:
              409,

            body: {
              ok:
                false,

              error:
                "immutable conflict",
            },
          })
        );


        const {
          publishProfileVariant,
        } =
          require(
            "./snapshotsApi"
          );


        await expect(
          publishProfileVariant({
            profileVariantId:
              "prv_test",
          })
        ).rejects.toThrow(
          "immutable conflict"
        );
      }
    );


    test(
      "getProfileVariantsBatch posts deduplicated IDs and returns the resolved variants",
      async () => {
        global.fetch.mockResolvedValue(
          response({
            body: {
              ok:
                true,

              variants: [
                {
                  profileVariantId:
                    "prv:one",

                  targeting: {
                    location:
                      "Austin, TX",

                    jobRole:
                      "Backend Engineer",
                  },
                },
              ],
            },
          })
        );


        const {
          getProfileVariantsBatch,
        } =
          require(
            "./snapshotsApi"
          );


        const result =
          await getProfileVariantsBatch(
            [
              "prv:one",
              "prv:one",
              "  ",
            ]
          );


        expect(
          result
        ).toEqual(
          [
            {
              profileVariantId:
                "prv:one",

              targeting: {
                location:
                  "Austin, TX",

                jobRole:
                  "Backend Engineer",
              },
            },
          ]
        );


        const [
          url,
          options,
        ] =
          global
            .fetch
            .mock
            .calls[0];


        expect(url).toBe(
          "https://api.example.test/profile-variants/get-batch"
        );

        expect(
          options.method
        ).toBe(
          "POST"
        );

        expect(
          JSON.parse(
            options.body
          )
        ).toEqual(
          {
            profileVariantIds: [
              "prv:one",
            ],
          }
        );
      }
    );


    test(
      "getProfileVariantsBatch returns an empty array without calling fetch when given no IDs",
      async () => {
        const {
          getProfileVariantsBatch,
        } =
          require(
            "./snapshotsApi"
          );


        const result =
          await getProfileVariantsBatch(
            []
          );


        expect(
          result
        ).toEqual(
          []
        );

        expect(
          global.fetch
        ).not
          .toHaveBeenCalled();
      }
    );


    test(
      "requestOwnerPasscodeChange posts to the request-change endpoint with the owner session header",
      async () => {
        global.fetch.mockResolvedValue(
          response(
            {
              body: {
                ok:
                  true,

                expiresInSeconds:
                  600,
              },
            }
          )
        );

        const {
          requestOwnerPasscodeChange,
        } =
          require(
            "./snapshotsApi"
          );

        const result =
          await requestOwnerPasscodeChange();

        expect(
          result.expiresInSeconds
        ).toBe(
          600
        );

        const [
          url,
          options,
        ] =
          global
            .fetch
            .mock
            .calls[0];

        expect(
          url
        ).toBe(
          "https://api.example.test/owner/passcode/request-change"
        );

        expect(
          options.method
        ).toBe(
          "POST"
        );

        expect(
          options
            .headers[
              "x-owner-token"
            ]
        ).toBe(
          "owner-test-token"
        );
      }
    );


    test(
      "requestOwnerPasscodeChange surfaces a rate-limit error",
      async () => {
        global.fetch.mockResolvedValue(
          response(
            {
              status:
                429,

              body: {
                ok:
                  false,

                error:
                  "Please wait a minute before requesting another.",
              },
            }
          )
        );

        const {
          requestOwnerPasscodeChange,
        } =
          require(
            "./snapshotsApi"
          );

        await expect(
          requestOwnerPasscodeChange()
        ).rejects.toThrow(
          "Please wait a minute before requesting another."
        );
      }
    );


    test(
      "requestOwnerPasscodeChange attaches retryAfterSeconds from a rate-limit response",
      async () => {
        global.fetch.mockResolvedValue(
          response(
            {
              status:
                429,

              body: {
                ok:
                  false,

                error:
                  "Please wait a minute before requesting another.",

                retryAfterSeconds:
                  37,
              },
            }
          )
        );

        const {
          requestOwnerPasscodeChange,
        } =
          require(
            "./snapshotsApi"
          );

        let caught =
          null;

        try {
          await requestOwnerPasscodeChange();
        } catch (
          error
        ) {
          caught =
            error;
        }

        expect(
          caught
            ?.retryAfterSeconds
        ).toBe(
          37
        );
      }
    );


    test(
      "confirmOwnerPasscodeChange posts the code and new passcode to the confirm-change endpoint",
      async () => {
        global.fetch.mockResolvedValue(
          response(
            {
              body: {
                ok:
                  true,
              },
            }
          )
        );

        const {
          confirmOwnerPasscodeChange,
        } =
          require(
            "./snapshotsApi"
          );

        await confirmOwnerPasscodeChange(
          {
            code:
              "482913",

            newPasscode:
              "a-strong-new-passcode",
          }
        );

        const [
          url,
          options,
        ] =
          global
            .fetch
            .mock
            .calls[0];

        expect(
          url
        ).toBe(
          "https://api.example.test/owner/passcode/confirm-change"
        );

        expect(
          JSON.parse(
            options.body
          )
        ).toEqual(
          {
            code:
              "482913",

            newPasscode:
              "a-strong-new-passcode",
          }
        );
      }
    );


    test(
      "confirmOwnerPasscodeChange surfaces an incorrect-code error",
      async () => {
        global.fetch.mockResolvedValue(
          response(
            {
              status:
                401,

              body: {
                ok:
                  false,

                error:
                  "Incorrect code",
              },
            }
          )
        );

        const {
          confirmOwnerPasscodeChange,
        } =
          require(
            "./snapshotsApi"
          );

        await expect(
          confirmOwnerPasscodeChange(
            {
              code:
                "000000",

              newPasscode:
                "a-strong-new-passcode",
            }
          )
        ).rejects.toThrow(
          "Incorrect code"
        );
      }
    );
  }
);