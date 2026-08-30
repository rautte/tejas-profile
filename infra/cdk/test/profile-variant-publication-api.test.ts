import {
  createProfileVariantAssetObjectKey,
  hexSha256ToBase64,
} from "../lambda/profile-variants-contract";


const mockS3Send =
  jest.fn();

const mockGetSignedUrl =
  jest.fn();


jest.mock(
  "@aws-sdk/client-s3",
  () => {
    const actual:
      any =
      jest.requireActual(
        "@aws-sdk/client-s3"
      );


    return {
      ...actual,

      S3Client:
        jest.fn(
          () => ({
            send:
              mockS3Send,
          })
        ),
    };
  }
);


jest.mock(
  "@aws-sdk/s3-request-presigner",
  () => ({
    getSignedUrl:
      (
        ...args:
          any[]
      ) =>
        mockGetSignedUrl(
          ...args
        ),
  })
);


const OWNER_TOKEN =
  "profile-asset-owner-token";

const PROFILE_BUCKET =
  "profile-variant-publication-test-bucket";


let handler:
  any;


function parsedBody(
  response:
    any
) {
  return JSON.parse(
    response.body
  );
}


function ownerPresignEvent({
  sha256,
  contentType,
}: {
  sha256:
    string;

  contentType:
    string;
}) {
  return {
    requestContext: {
      http: {
        method:
          "POST",

        path:
          "/profile-variants/assets/presign-put",
      },
    },

    rawPath:
      "/profile-variants/assets/presign-put",

    headers: {
      "x-owner-token":
        OWNER_TOKEN,
    },

    body:
      JSON.stringify({
        sha256,
        contentType,
      }),
  };
}


describe(
  "Profile Variant publication asset API",
  () => {
    beforeAll(
      async () => {
        process.env
          .OWNER_TOKEN =
          OWNER_TOKEN;

        process.env
          .PROFILE_VARIANTS_BUCKET =
          PROFILE_BUCKET;

        process.env
          .STAGE =
          "dev";

        process.env
          .ALLOWED_ORIGINS =
          "";


        jest.resetModules();


        ({
          handler,
        } =
          await import(
            "../lambda/snapshots-handler"
          ));
      }
    );


    beforeEach(
      () => {
        mockS3Send
          .mockReset();

        mockGetSignedUrl
          .mockReset();

        mockGetSignedUrl
          .mockResolvedValue(
            "https://signed.example/upload"
          );
      }
    );


    afterAll(
      () => {
        delete process.env
          .OWNER_TOKEN;

        delete process.env
          .PROFILE_VARIANTS_BUCKET;

        delete process.env
          .STAGE;

        delete process.env
          .ALLOWED_ORIGINS;
      }
    );


    test(
      "uses an exact-key ListObjectsV2 probe before presigning a missing immutable asset",
      async () => {
        const sha256 =
          "a".repeat(
            64
          );

        const contentType =
          "image/jpeg";

        const key =
          createProfileVariantAssetObjectKey({
            sha256,
            contentType,
          });


        mockS3Send
          .mockImplementation(
            async (
              command:
                any
            ) => {
              expect(
                command
                  ?.constructor
                  ?.name
              ).toBe(
                "ListObjectsV2Command"
              );


              return {
                Contents:
                  [],
              };
            }
          );


        const response =
          await handler(
            ownerPresignEvent({
              sha256,
              contentType,
            })
          );


        expect(
          response.statusCode
        ).toBe(
          200
        );


        expect(
          parsedBody(
            response
          )
        ).toMatchObject({
          ok:
            true,

          key,

          alreadyExists:
            false,

          url:
            "https://signed.example/upload",
        });


        expect(
          mockS3Send
        ).toHaveBeenCalledTimes(
          1
        );


        expect(
          mockS3Send
            .mock
            .calls[0][0]
            .input
        ).toMatchObject({
          Bucket:
            PROFILE_BUCKET,

          Prefix:
            key,

          MaxKeys:
            1,
        });


        expect(
          mockGetSignedUrl
        ).toHaveBeenCalledTimes(
          1
        );


        const putCommand =
          mockGetSignedUrl
            .mock
            .calls[0][1];


        expect(
          putCommand
            ?.constructor
            ?.name
        ).toBe(
          "PutObjectCommand"
        );


        expect(
          putCommand.input
        ).toMatchObject({
          Bucket:
            PROFILE_BUCKET,

          Key:
            key,

          ContentType:
            contentType,

          ChecksumSHA256:
            hexSha256ToBase64(
              sha256
            ),

          IfNoneMatch:
            "*",
        });
      }
    );


    test(
      "HEAD-verifies checksum and content type only when the exact immutable asset already exists",
      async () => {
        const sha256 =
          "b".repeat(
            64
          );

        const contentType =
          "application/pdf";

        const key =
          createProfileVariantAssetObjectKey({
            sha256,
            contentType,
          });


        mockS3Send
          .mockImplementation(
            async (
              command:
                any
            ) => {
              const name =
                command
                  ?.constructor
                  ?.name;


              if (
                name ===
                "ListObjectsV2Command"
              ) {
                return {
                  Contents: [
                    {
                      Key:
                        key,
                    },
                  ],
                };
              }


              if (
                name ===
                "HeadObjectCommand"
              ) {
                return {
                  ChecksumSHA256:
                    hexSha256ToBase64(
                      sha256
                    ),

                  ContentType:
                    contentType,
                };
              }


              throw new Error(
                `Unexpected S3 command: ${name}`
              );
            }
          );


        const response =
          await handler(
            ownerPresignEvent({
              sha256,
              contentType,
            })
          );


        expect(
          response.statusCode
        ).toBe(
          200
        );


        expect(
          parsedBody(
            response
          )
        ).toEqual({
          ok:
            true,

          key,

          alreadyExists:
            true,
        });


        expect(
          mockS3Send
        ).toHaveBeenCalledTimes(
          2
        );


        expect(
          mockGetSignedUrl
        ).not
          .toHaveBeenCalled();
      }
    );


    test(
      "fails closed when the exact-key existence probe is unauthorized",
      async () => {
        const sha256 =
          "c".repeat(
            64
          );

        const contentType =
          "image/jpeg";


        mockS3Send
          .mockRejectedValue(
            Object.assign(
              new Error(
                "AccessDenied"
              ),
              {
                name:
                  "AccessDenied",

                $metadata: {
                  httpStatusCode:
                    403,
                },
              }
            )
          );


        const response =
          await handler(
            ownerPresignEvent({
              sha256,
              contentType,
            })
          );


        expect(
          response.statusCode
        ).toBe(
          500
        );


        expect(
          parsedBody(
            response
          )
            .error
        ).toBe(
          "Failed to inspect Profile Variant asset."
        );


        expect(
          mockGetSignedUrl
        ).not
          .toHaveBeenCalled();
      }
    );
  }
);
