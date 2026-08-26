import {
  Readable,
} from "node:stream";

import {
  createPlatformReleaseDocument,
  createPlatformReleaseDocumentV2,
} from "../lambda/platform-release-contract";

import {
  canonicalJsonStringify,
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


function validRelease(
  platformReleaseId =
    "plr_api_001",
  stage:
    "dev" |
    "prod" =
      "prod",
  createdAt =
    "2026-08-23T02:00:00.000Z"
) {
  return createPlatformReleaseDocument({
    platformReleaseId,

    stage,

    createdAt,

    source: {
      repository:
        "rautte/tejas-profile",

      gitSha:
        "1".repeat(
          40
        ),

      gitRef:
        "refs/heads/main",

      checkpointTag:
        "checkpoint-test",
    },

    build: {
      buildTime:
        "2026-08-23T01:59:00.000Z",

      frontendArtifactSha256:
        "a".repeat(
          64
        ),

      githubRunId:
        "12345",

      repoArtifactKey:
        "profiles/legacy/repo/test.zip",

      repoArtifactSha256:
        "b".repeat(
          64
        ),

      diffFiles: {
        infra: [],

        data: [],

        uiux: [],

        githubWorkflow: [],
      },

      diffTagValue:
        "none",
    },

    legacy: {
      profileVersionId:
        "pv_1234567",
    },
  });
}


function validReleaseV2(
  platformReleaseId =
    "plr_api_v2_001"
) {
  return createPlatformReleaseDocumentV2({
    platformReleaseId,

    stage:
      "prod",

    createdAt:
      "2026-08-23T02:00:00.000Z",

    source: {
      repository:
        "rautte/tejas-profile",

      gitSha:
        "1".repeat(
          40
        ),

      gitRef:
        "refs/heads/main",

      checkpointTag:
        "checkpoint-test",
    },

    build: {
      buildTime:
        "2026-08-23T01:59:00.000Z",

      frontendArtifactSha256:
        "a".repeat(
          64
        ),

      githubRunId:
        "12345",

      repoArtifactKey:
        "profiles/legacy/repo/test.zip",

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

    profileRuntime: {
      ppsVersion:
        1,
    },

    legacy: {
      profileVersionId:
        "pv_1234567",
    },
  });
}


function ownerEvent({
  method,
  path,
  body,
  queryStringParameters,
}: {
  method:
    string;

  path:
    string;

  body?:
    unknown;

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
        method,
        path,
      },
    },

    headers: {
      "x-owner-token":
        "test-owner-token",
    },

    queryStringParameters:
      queryStringParameters ||
      {},

    body:
      body ===
        undefined
        ? null
        : JSON.stringify(
            body
          ),
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
  release:
    any
) {
  const body =
    canonicalJsonStringify(
      release
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

    process.env.PLATFORM_RELEASES_BUCKET =
      "platform-release-test-bucket";

    process.env.PROFILE_VARIANTS_BUCKET =
      "profile-variant-test-bucket";

    process.env.PROFILE_ACTIVATION_TABLE =
      "profile-activation-test-table";

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


afterAll(
  () => {
    delete process.env.OWNER_TOKEN;
    delete process.env.PLATFORM_RELEASES_BUCKET;
    delete process.env.PROFILE_VARIANTS_BUCKET;
    delete process.env.PROFILE_ACTIVATION_TABLE;
    delete process.env.STAGE;
  }
);


describe(
  "Platform Release API",
  () => {
    test(
      "registers a new immutable release with first-write-only S3 semantics",
      async () => {
        const release =
          validRelease();


        mockS3Send
          .mockRejectedValueOnce({
            name:
              "NoSuchKey",

            $metadata: {
              httpStatusCode:
                404,
            },
          })
          .mockResolvedValueOnce(
            {}
          );


        const response =
          await handler(
            ownerEvent({
              method:
                "POST",

              path:
                "/platform-releases/register",

              body: {
                release,
              },
            })
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

          alreadyRegistered:
            false,

          platformReleaseId:
            "plr_api_001",

          key:
            "releases/plr_api_001.json",
        });


        expect(
          mockS3Send
        ).toHaveBeenCalledTimes(
          2
        );


        const putCommand =
          mockS3Send
            .mock
            .calls[1][0];


        expect(
          putCommand
            .constructor
            .name
        ).toBe(
          "PutObjectCommand"
        );


        expect(
          putCommand.input
        ).toMatchObject({
          Bucket:
            "platform-release-test-bucket",

          Key:
            "releases/plr_api_001.json",

          ContentType:
            "application/json",

          IfNoneMatch:
            "*",
        });


        expect(
          typeof putCommand
            .input
            .ChecksumSHA256
        ).toBe(
          "string"
        );
      }
    );


    test(
      "registers a PPS-qualified Platform Release v2 without rewriting its contract",
      async () => {
        const release =
          validReleaseV2();


        mockS3Send
          .mockRejectedValueOnce({
            name:
              "NoSuchKey",

            $metadata: {
              httpStatusCode:
                404,
            },
          })
          .mockResolvedValueOnce(
            {}
          );


        const response =
          await handler(
            ownerEvent({
              method:
                "POST",

              path:
                "/platform-releases/register",

              body: {
                release,
              },
            })
          );


        expect(
          response.statusCode
        ).toBe(
          201
        );


        const putCommand =
          mockS3Send
            .mock
            .calls[1][0];


        const storedRelease =
          JSON.parse(
            String(
              putCommand
                .input
                .Body
            )
          );


        expect(
          storedRelease
        ).toMatchObject({
          schemaId:
            "tejas-profile.platform-release.v2",

          platformReleaseId:
            "plr_api_v2_001",

          profileRuntime: {
            ppsVersion:
              1,
          },
        });
      }
    );


    test(
      "re-registering identical immutable content is idempotent",
      async () => {
        const release =
          validRelease(
            "plr_same"
          );


        mockS3Send
          .mockResolvedValueOnce(
            storedResponse(
              release
            )
          );


        const response =
          await handler(
            ownerEvent({
              method:
                "POST",

              path:
                "/platform-releases/register",

              body: {
                release,
              },
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
            .alreadyRegistered
        ).toBe(
          true
        );


        expect(
          mockS3Send
        ).toHaveBeenCalledTimes(
          1
        );
      }
    );


    test(
      "the same Platform Release ID cannot be reused for different immutable content",
      async () => {
        const existing =
          validRelease(
            "plr_conflict",
            "prod",
            "2026-08-23T02:00:00.000Z"
          );

        const incoming =
          validRelease(
            "plr_conflict",
            "prod",
            "2026-08-23T03:00:00.000Z"
          );


        mockS3Send
          .mockResolvedValueOnce(
            storedResponse(
              existing
            )
          );


        const response =
          await handler(
            ownerEvent({
              method:
                "POST",

              path:
                "/platform-releases/register",

              body: {
                release:
                  incoming,
              },
            })
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


        expect(
          mockS3Send
        ).toHaveBeenCalledTimes(
          1
        );
      }
    );


    test(
      "a concurrent identical registration resolves idempotently",
      async () => {
        const release =
          validRelease(
            "plr_race"
          );


        mockS3Send
          .mockRejectedValueOnce({
            name:
              "NoSuchKey",

            $metadata: {
              httpStatusCode:
                404,
            },
          })
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
              release
            )
          );


        const response =
          await handler(
            ownerEvent({
              method:
                "POST",

              path:
                "/platform-releases/register",

              body: {
                release,
              },
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
            .alreadyRegistered
        ).toBe(
          true
        );


        expect(
          mockS3Send
        ).toHaveBeenCalledTimes(
          3
        );
      }
    );


    test(
      "reads and validates one immutable Platform Release",
      async () => {
        const release =
          validRelease(
            "plr_get"
          );


        mockS3Send
          .mockResolvedValueOnce(
            storedResponse(
              release
            )
          );


        const response =
          await handler(
            ownerEvent({
              method:
                "GET",

              path:
                "/platform-releases/get",

              queryStringParameters: {
                platformReleaseId:
                  "plr_get",
              },
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

          platformReleaseId:
            "plr_get",

          key:
            "releases/plr_get.json",

          release: {
            platformReleaseId:
              "plr_get",

            stage:
              "prod",
          },
        });
      }
    );


    test(
      "retrieves a PPS-qualified Platform Release v2 without downgrading it to v1",
      async () => {
        const release =
          validReleaseV2(
            "plr_get_v2"
          );


        mockS3Send
          .mockResolvedValueOnce(
            storedResponse(
              release
            )
          );


        const response =
          await handler(
            ownerEvent({
              method:
                "GET",

              path:
                "/platform-releases/get",

              queryStringParameters: {
                platformReleaseId:
                  "plr_get_v2",
              },
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
            .release
        ).toMatchObject({
          schemaId:
            "tejas-profile.platform-release.v2",

          platformReleaseId:
            "plr_get_v2",

          profileRuntime: {
            ppsVersion:
              1,
          },
        });
      }
    );


    test(
      "rejects a release intended for the other environment",
      async () => {
        const release =
          validRelease(
            "plr_wrong_stage",
            "dev"
          );


        const response =
          await handler(
            ownerEvent({
              method:
                "POST",

              path:
                "/platform-releases/register",

              body: {
                release,
              },
            })
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
          /does not match API stage/
        );


        expect(
          mockS3Send
        ).not.toHaveBeenCalled();
      }
    );
  }
);