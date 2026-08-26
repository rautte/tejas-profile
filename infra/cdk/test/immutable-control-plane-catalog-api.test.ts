import {
  Readable,
} from "node:stream";

import {
  canonicalJsonStringify,
  computeProfileVariantContentHash,
  hexSha256ToBase64,
  sha256Hex,
} from "../lambda/profile-variants-contract";

import {
  createPlatformReleaseDocument,
  createPlatformReleaseDocumentV2,
} from "../lambda/platform-release-contract";


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
  profileVariantId:
    string,

  createdAt =
    "2026-08-24T01:00:00.000Z"
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

      createdAt,

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


function validReleaseV1(
  platformReleaseId:
    string
) {
  return createPlatformReleaseDocument({
    platformReleaseId,

    stage:
      "prod",

    createdAt:
      "2026-08-24T02:00:00.000Z",

    source: {
      repository:
        "rautte/tejas-profile",

      gitSha:
        "2".repeat(
          40
        ),

      gitRef:
        "refs/heads/main",

      checkpointTag:
        "checkpoint-catalog",
    },

    build: {
      buildTime:
        "2026-08-24T01:59:00.000Z",

      frontendArtifactSha256:
        "a".repeat(
          64
        ),

      githubRunId:
        "100",

      repoArtifactKey:
        "profiles/catalog/repo.zip",

      repoArtifactSha256:
        "b".repeat(
          64
        ),

      diffFiles: {
        infra:
          [],

        data:
          [],

        uiux:
          [],

        githubWorkflow:
          [],
      },

      diffTagValue:
        "none",
    },

    legacy: {
      profileVersionId:
        "pv_catalog",
    },
  });
}


function validReleaseV2(
  platformReleaseId:
    string
) {
  const v1 =
    validReleaseV1(
      platformReleaseId
    );


  return createPlatformReleaseDocumentV2({
    platformReleaseId,

    stage:
      v1.stage,

    createdAt:
      v1.createdAt,

    source:
      v1.source,

    build:
      v1.build,

    profileRuntime: {
      ppsVersion:
        1,
    },

    legacy:
      v1.legacy,
  });
}


function storedResponse(
  document:
    any
) {
  const body =
    canonicalJsonStringify(
      document
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


function ownerEvent({
  path,

  queryStringParameters =
    {},
}: {
  path:
    string;

  queryStringParameters?:
    Record<
      string,
      string
    >;
}) {
  return {
    rawPath:
      path,

    requestContext: {
      http: {
        method:
          "GET",

        path,
      },
    },

    headers: {
      "x-owner-token":
        "catalog-owner-token",
    },

    queryStringParameters,
  };
}


function body(
  response:
    any
) {
  return JSON.parse(
    response.body
  );
}


function catalogToken(
  scope:
    string,

  continuationToken:
    string
) {
  return Buffer
    .from(
      JSON.stringify({
        scope,

        continuationToken,
      }),
      "utf8"
    )
    .toString(
      "base64url"
    );
}


beforeAll(
  async () => {
    process.env.OWNER_TOKEN =
      "catalog-owner-token";

    process.env.PROFILE_VARIANTS_BUCKET =
      "profile-catalog-bucket";

    process.env.PLATFORM_RELEASES_BUCKET =
      "platform-catalog-bucket";

    process.env.STAGE =
      "prod";


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


describe(
  "P7C immutable control-plane catalogs",
  () => {
    test(
      "enumerates only canonical Profile Variant manifest prefixes with scoped S3 pagination",
      async () => {
        const first =
          validVariant(
            "prv_catalog_a"
          );

        const second =
          validVariant(
            "prv_catalog_b"
          );


        mockS3Send
          .mockResolvedValueOnce({
            CommonPrefixes: [
              {
                Prefix:
                  "variants/prv_catalog_a/",
              },
              {
                Prefix:
                  "variants/prv_catalog_b/",
              },
            ],

            NextContinuationToken:
              "profile-s3-next",
          })
          .mockResolvedValueOnce(
            storedResponse(
              first
            )
          )
          .mockResolvedValueOnce(
            storedResponse(
              second
            )
          );


        const response =
          await handler(
            ownerEvent({
              path:
                "/profile-variants/list",
            })
          );


        expect(
          response.statusCode
        ).toBe(
          200
        );


        const parsed =
          body(
            response
          );


        expect(
          parsed.order
        ).toBe(
          "objectKeyAscending"
        );


        expect(
          parsed.variants.map(
            (
              item:
                any
            ) =>
              item.profileVariantId
          )
        ).toEqual([
          "prv_catalog_a",
          "prv_catalog_b",
        ]);


        expect(
          parsed.nextToken
        ).toEqual(
          expect.any(
            String
          )
        );


        const listCommand =
          mockS3Send
            .mock
            .calls[0][0];


        expect(
          listCommand
            .constructor
            .name
        ).toBe(
          "ListObjectsV2Command"
        );


        expect(
          listCommand.input
        ).toMatchObject({
          Bucket:
            "profile-catalog-bucket",

          Prefix:
            "variants/",

          Delimiter:
            "/",

          MaxKeys:
            25,
        });


        const nextToken =
          parsed.nextToken;


        mockS3Send
          .mockReset()
          .mockResolvedValueOnce({
            CommonPrefixes:
              [],
          });


        const nextResponse =
          await handler(
            ownerEvent({
              path:
                "/profile-variants/list",

              queryStringParameters: {
                nextToken,
              },
            })
          );


        expect(
          nextResponse.statusCode
        ).toBe(
          200
        );


        expect(
          mockS3Send
            .mock
            .calls[0][0]
            .input
            .ContinuationToken
        ).toBe(
          "profile-s3-next"
        );
      }
    );


    test(
      "enumerates historical v1 and PPS-qualified v2 Platform Releases truthfully",
      async () => {
        const v1 =
          validReleaseV1(
            "plr_catalog_v1"
          );

        const v2 =
          validReleaseV2(
            "plr_catalog_v2"
          );


        mockS3Send
          .mockResolvedValueOnce({
            Contents: [
              {
                Key:
                  "releases/plr_catalog_v1.json",
              },
              {
                Key:
                  "releases/plr_catalog_v2.json",
              },
            ],
          })
          .mockResolvedValueOnce(
            storedResponse(
              v1
            )
          )
          .mockResolvedValueOnce(
            storedResponse(
              v2
            )
          );


        const response =
          await handler(
            ownerEvent({
              path:
                "/platform-releases/list",

              queryStringParameters: {
                limit:
                  "10",
              },
            })
          );


        expect(
          response.statusCode
        ).toBe(
          200
        );


        expect(
          body(
            response
          ).releases
        ).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              platformReleaseId:
                "plr_catalog_v1",

              schemaId:
                "tejas-profile.platform-release.v1",

              ppsVersion:
                null,
            }),

            expect.objectContaining({
              platformReleaseId:
                "plr_catalog_v2",

              schemaId:
                "tejas-profile.platform-release.v2",

              ppsVersion:
                1,
            }),
          ])
        );


        expect(
          mockS3Send
            .mock
            .calls[0][0]
            .input
        ).toMatchObject({
          Bucket:
            "platform-catalog-bucket",

          Prefix:
            "releases/",

          MaxKeys:
            10,
        });
      }
    );


    test(
      "rejects invalid limits and cross-catalog pagination tokens before calling S3",
      async () => {
        const invalidLimit =
          await handler(
            ownerEvent({
              path:
                "/profile-variants/list",

              queryStringParameters: {
                limit:
                  "51",
              },
            })
          );


        expect(
          invalidLimit.statusCode
        ).toBe(
          400
        );


        const wrongScope =
          await handler(
            ownerEvent({
              path:
                "/platform-releases/list",

              queryStringParameters: {
                nextToken:
                  catalogToken(
                    "profile-variants",
                    "profile-token"
                  ),
              },
            })
          );


        expect(
          wrongScope.statusCode
        ).toBe(
          400
        );


        expect(
          mockS3Send
        ).not
          .toHaveBeenCalled();
      }
    );


    test(
      "fails closed when a Profile Variant manifest identity does not match its catalog key",
      async () => {
        mockS3Send
          .mockResolvedValueOnce({
            CommonPrefixes: [
              {
                Prefix:
                  "variants/prv_expected/",
              },
            ],
          })
          .mockResolvedValueOnce(
            storedResponse(
              validVariant(
                "prv_other"
              )
            )
          );


        const response =
          await handler(
            ownerEvent({
              path:
                "/profile-variants/list",
            })
          );


        expect(
          response.statusCode
        ).toBe(
          500
        );


        expect(
          body(
            response
          ).error
        ).toBe(
          "Failed to enumerate Profile Variant catalog."
        );
      }
    );


    test(
      "fails closed when Platform Release bytes do not match the listed object identity",
      async () => {
        mockS3Send
          .mockResolvedValueOnce({
            Contents: [
              {
                Key:
                  "releases/plr_expected.json",
              },
            ],
          })
          .mockResolvedValueOnce(
            storedResponse(
              validReleaseV2(
                "plr_other"
              )
            )
          );


        const response =
          await handler(
            ownerEvent({
              path:
                "/platform-releases/list",
            })
          );


        expect(
          response.statusCode
        ).toBe(
          500
        );


        expect(
          body(
            response
          ).error
        ).toBe(
          "Failed to enumerate Platform Release catalog."
        );
      }
    );
  }
);