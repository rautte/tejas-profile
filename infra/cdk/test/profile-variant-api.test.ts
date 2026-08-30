import {
  Readable,
} from "node:stream";

import {
  canonicalJsonStringify,
  computeProfileVariantContentHash,
  hexSha256ToBase64,
  sha256Hex,
} from "../lambda/profile-variants-contract";


const mockS3Send =
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


let handler:
  any;


function profileContent() {
  return {
    hero:
      {},

    aboutMe:
      {},

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


function validVariant(
  profileVariantId =
    "prv_api_first_write"
) {
  const variant:
    any = {
      schema:
        "tejas-profile.profile-variant",

      schemaId:
        "tejas-profile.profile-variant.v1",

      contentSchemaVersion:
        1,

      profileVariantId,

      contentHash:
        "",

      createdAt:
        "2026-08-30T10:00:00.000Z",

      targeting: {
        location:
          "Austin",

        jobRole:
          "Backend Engineer",
      },

      provenance: {
        gitSha:
          "1".repeat(
            40
          ),
      },

      content:
        profileContent(),

      assets:
        [],
    };


  variant.contentHash =
    computeProfileVariantContentHash(
      variant
    );


  return variant;
}


function ownerEvent(
  variant:
    any
) {
  return {
    rawPath:
      "/profile-variants/publish",

    requestContext: {
      http: {
        method:
          "POST",

        path:
          "/profile-variants/publish",
      },
    },

    headers: {
      "x-owner-token":
        "test-owner-token",
    },

    queryStringParameters:
      {},

    body:
      JSON.stringify({
        variant,
      }),
  };
}


function parsedBody(
  response:
    any
) {
  return JSON.parse(
    response.body
  );
}


function storedResponse(
  value:
    any
) {
  const body =
    canonicalJsonStringify(
      value
    );


  return {
    Body:
      Readable.from([
        Buffer.from(
          body,
          "utf8"
        ),
      ]),

    ContentType:
      "application/json",

    ChecksumSHA256:
      hexSha256ToBase64(
        sha256Hex(
          body
        )
      ),
  };
}


beforeAll(
  async () => {
    process.env.OWNER_TOKEN =
      "test-owner-token";

    process.env.PROFILE_VARIANTS_BUCKET =
      "profile-variant-test-bucket";

    process.env.PLATFORM_RELEASES_BUCKET =
      "platform-release-test-bucket";

    process.env.PROFILE_ACTIVATION_TABLE =
      "profile-activation-test-table";

    process.env.STAGE =
      "dev";


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
  }
);


afterAll(
  () => {
    delete process.env.OWNER_TOKEN;
    delete process.env.PROFILE_VARIANTS_BUCKET;
    delete process.env.PLATFORM_RELEASES_BUCKET;
    delete process.env.PROFILE_ACTIVATION_TABLE;
    delete process.env.STAGE;
  }
);


describe(
  "Profile Variant immutable publication",
  () => {
    test(
      "publishes a new manifest with one conditional PUT and no pre-read",
      async () => {
        const variant =
          validVariant();


        mockS3Send
          .mockResolvedValueOnce(
            {}
          );


        const response =
          await handler(
            ownerEvent(
              variant
            )
          );


        expect(
          response.statusCode
        ).toBe(
          201
        );


        expect(
          parsedBody(
            response
          )
        ).toMatchObject({
          ok:
            true,

          alreadyPublished:
            false,

          profileVariantId:
            variant
              .profileVariantId,
        });


        expect(
          mockS3Send
        ).toHaveBeenCalledTimes(
          1
        );


        const put =
          mockS3Send
            .mock
            .calls[0][0];


        expect(
          put
            .constructor
            .name
        ).toBe(
          "PutObjectCommand"
        );


        expect(
          put.input
            .IfNoneMatch
        ).toBe(
          "*"
        );


        expect(
          put.input
            .Key
        ).toBe(
          `variants/${variant.profileVariantId}/manifest.json`
        );
      }
    );


    test(
      "an identical existing manifest resolves idempotently after 412",
      async () => {
        const variant =
          validVariant(
            "prv_api_existing"
          );


        mockS3Send
          .mockRejectedValueOnce({
            name:
              "PreconditionFailed",

            $metadata: {
              httpStatusCode:
                412,
            },
          })
          .mockResolvedValueOnce(
            storedResponse(
              variant
            )
          );


        const response =
          await handler(
            ownerEvent(
              variant
            )
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
            .alreadyPublished
        ).toBe(
          true
        );


        expect(
          mockS3Send
        ).toHaveBeenCalledTimes(
          2
        );
      }
    );


    test(
      "different immutable bytes under the same ID remain a conflict",
      async () => {
        const incoming =
          validVariant(
            "prv_api_conflict"
          );

        const existing = {
          ...incoming,

          createdAt:
            "2026-08-30T09:00:00.000Z",
        };


        mockS3Send
          .mockRejectedValueOnce({
            name:
              "PreconditionFailed",

            $metadata: {
              httpStatusCode:
                412,
            },
          })
          .mockResolvedValueOnce(
            storedResponse(
              existing
            )
          );


        const response =
          await handler(
            ownerEvent(
              incoming
            )
          );


        expect(
          response.statusCode
        ).toBe(
          409
        );


        expect(
          parsedBody(
            response
          ).error
        ).toMatch(
          /different immutable content/
        );
      }
    );
  }
);