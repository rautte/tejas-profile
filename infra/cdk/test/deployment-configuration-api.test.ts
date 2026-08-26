// infra/cdk/test/deployment-configuration-api.test.ts

import {
  Readable,
} from "node:stream";

import {
  computeProfileVariantContentHash,
  canonicalJsonStringify,
  hexSha256ToBase64,
  sha256Hex,
} from "../lambda/profile-variants-contract";

import {
  createPlatformReleaseDocumentV2,
  normalizeAndValidatePlatformReleaseDocument,
  PLATFORM_RELEASE_SCHEMA_ID_V1,
} from "../lambda/platform-release-contract";

import {
  createDeploymentConfigurationDocument,
  computeDeploymentConfigurationId,
} from "../lambda/deployment-configuration-contract";


const mockS3Send =
  jest.fn();

const mockDynamoSend =
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
  "@aws-sdk/client-dynamodb",
  () => {
    const actual:
      any =
      jest.requireActual(
        "@aws-sdk/client-dynamodb"
      );


    return {
      ...actual,

      DynamoDBClient:
        jest.fn(
          () => ({
            send:
              mockDynamoSend,
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
    "prv_api_001"
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
        "2026-08-23T10:00:00.000Z",

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


function validRelease(
  platformReleaseId =
    "plr_api_001",

  ppsVersion =
    1
) {
  return createPlatformReleaseDocumentV2({
    platformReleaseId,

    stage:
      "prod",

    createdAt:
      "2026-08-23T09:00:00.000Z",

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
        "checkpoint-test",
    },

    build: {
      buildTime:
        "2026-08-23T08:59:00.000Z",

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
      ppsVersion,
    },

    legacy: {
      profileVersionId:
        "pv_1234567",
    },
  });
}

function validReleaseV1(
  platformReleaseId =
    "plr_api_v1"
) {
  const release:
    any =
      {
        ...validRelease(
          platformReleaseId
        ),
      };


  delete release
    .profileRuntime;


  release.schemaId =
    PLATFORM_RELEASE_SCHEMA_ID_V1;


  return normalizeAndValidatePlatformReleaseDocument(
    release
  );
}


function validConfiguration({
  platformReleaseId =
    "plr_api_001",

  profileVariantId =
    "prv_api_001",

  createdAt =
    "2026-08-23T11:00:00.000Z",
} = {}) {
  return createDeploymentConfigurationDocument({
    stage:
      "prod",

    createdAt,

    platformRelease:
      validRelease(
        platformReleaseId
      ),

    profileVariant:
      validVariant(
        profileVariantId
      ),
  });
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


function notFound() {
  return {
    name:
      "NoSuchKey",

    $metadata: {
      httpStatusCode:
        404,
    },
  };
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


beforeAll(
  async () => {
    process.env.OWNER_TOKEN =
      "test-owner-token";

    process.env.PLATFORM_RELEASES_BUCKET =
      "platform-release-test-bucket";

    process.env.PROFILE_VARIANTS_BUCKET =
      "profile-variant-test-bucket";

    process.env.DEPLOYMENT_CONFIGURATIONS_BUCKET =
      "deployment-configuration-test-bucket";

    process.env.DEPLOYMENT_CONFIGURATIONS_TABLE =
      "deployment-configuration-test-table";

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

    mockDynamoSend
      .mockReset();
  }
);


afterAll(
  () => {
    delete process.env.OWNER_TOKEN;
    delete process.env.PLATFORM_RELEASES_BUCKET;
    delete process.env.PROFILE_VARIANTS_BUCKET;
    delete process.env.DEPLOYMENT_CONFIGURATIONS_BUCKET;
    delete process.env.DEPLOYMENT_CONFIGURATIONS_TABLE;
    delete process.env.PROFILE_ACTIVATION_TABLE;
    delete process.env.STAGE;
  }
);


describe(
  "Deployment Configuration API",
  () => {
    test(
      "creates a configuration from authoritative Platform Release and Profile Variant identities only",
      async () => {
        const release =
          validRelease();

        const variant =
          validVariant();


        mockS3Send
          .mockRejectedValueOnce(
            notFound()
          )
          .mockResolvedValueOnce(
            storedResponse(
              release
            )
          )
          .mockResolvedValueOnce(
            storedResponse(
              variant
            )
          )
          .mockResolvedValueOnce(
            {}
          );


        mockDynamoSend
          .mockResolvedValueOnce(
            {}
          );


        const response =
          await handler(
            ownerEvent({
              method:
                "POST",

              path:
                "/deployment-configurations/create",

              body: {
                platformReleaseId:
                  "plr_api_001",

                profileVariantId:
                  "prv_api_001",
              },
            })
          );


        expect(
          response.statusCode
        ).toBe(
          201
        );


        const body =
          parsedBody(
            response
          );


        expect(
          body
        ).toMatchObject({
          ok:
            true,

          alreadyCreated:
            false,

          configuration: {
            platformReleaseId:
              "plr_api_001",

            profileVariantId:
              "prv_api_001",

            profile: {
              contentSchemaVersion:
                1,

              targeting: {
                location:
                  "Austin",

                jobRole:
                  "Backend Engineer",
              },
            },
          },
        });


        expect(
          body
            .deploymentConfigurationId
        ).toBe(
          computeDeploymentConfigurationId({
            stage:
              "prod",

            platformReleaseId:
              "plr_api_001",

            profileVariantId:
              "prv_api_001",
          })
        );


        const put =
          mockS3Send
            .mock
            .calls[3][0];


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
            .Bucket
        ).toBe(
          "deployment-configuration-test-bucket"
        );


        expect(
          mockDynamoSend
            .mock
            .calls[0][0]
            .constructor
            .name
        ).toBe(
          "PutItemCommand"
        );
      }
    );


    test(
      "re-selecting an existing composition returns its original immutable document instead of rebuilding createdAt",
      async () => {
        const existing =
          validConfiguration({
            createdAt:
              "2026-08-01T00:00:00.000Z",
          });

        const release =
          validRelease();


        mockS3Send
          .mockResolvedValueOnce(
            storedResponse(
              existing
            )
          )
          .mockResolvedValueOnce(
            storedResponse(
              release
            )
          );

        mockDynamoSend
          .mockResolvedValueOnce(
            {}
          );


        const response =
          await handler(
            ownerEvent({
              method:
                "POST",

              path:
                "/deployment-configurations/create",

              body: {
                platformReleaseId:
                  "plr_api_001",

                profileVariantId:
                  "prv_api_001",
              },
            })
          );


        expect(
          response.statusCode
        ).toBe(
          200
        );


        const body =
          parsedBody(
            response
          );


        expect(
          body
            .alreadyCreated
        ).toBe(
          true
        );


        expect(
          body
            .configuration
            .createdAt
        ).toBe(
          "2026-08-01T00:00:00.000Z"
        );


        expect(
          mockS3Send
        ).toHaveBeenCalledTimes(
          2
        );


        expect(
          mockDynamoSend
        ).toHaveBeenCalledTimes(
          1
        );
      }
    );

    test(
      "rejects a historical unqualified Platform Release v1 before creating a configuration",
      async () => {
        const release =
          validReleaseV1(
            "plr_unqualified"
          );


        mockS3Send
          .mockRejectedValueOnce(
            notFound()
          )
          .mockResolvedValueOnce(
            storedResponse(
              release
            )
          )
          .mockResolvedValueOnce(
            storedResponse(
              validVariant(
                "prv_api_001"
              )
            )
          );


        const response =
          await handler(
            ownerEvent({
              method:
                "POST",

              path:
                "/deployment-configurations/create",

              body: {
                platformReleaseId:
                  "plr_unqualified",

                profileVariantId:
                  "prv_api_001",
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
          )
            .code
        ).toBe(
          "PPS_DECLARATION_REQUIRED"
        );


        expect(
          mockDynamoSend
        ).not.toHaveBeenCalled();


        const putCalls =
          mockS3Send
            .mock
            .calls
            .filter(
              (
                call
              ) =>
                call[0]
                  ?.constructor
                  ?.name ===
                "PutObjectCommand"
            );


        expect(
          putCalls
        ).toHaveLength(
          0
        );
      }
    );

    test(
      "rejects a Platform Release that declares an unsupported future PPS version",
      async () => {
        const release =
          validRelease(
            "plr_future_pps",
            2
          );

        const variant =
          validVariant();


        mockS3Send
          .mockRejectedValueOnce(
            notFound()
          )
          .mockResolvedValueOnce(
            storedResponse(
              release
            )
          )
          .mockResolvedValueOnce(
            storedResponse(
              variant
            )
          );


        const response =
          await handler(
            ownerEvent({
              method:
                "POST",

              path:
                "/deployment-configurations/create",

              body: {
                platformReleaseId:
                  "plr_future_pps",

                profileVariantId:
                  "prv_api_001",
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
          )
            .code
        ).toBe(
          "PPS_VERSION_UNSUPPORTED"
        );


        expect(
          mockDynamoSend
        ).not.toHaveBeenCalled();
      }
    );

    test(
      "existing immutable configuration does not bypass PPS qualification policy",
      async () => {
        const release =
          validReleaseV1(
            "plr_existing_v1"
          );

        const variant =
          validVariant(
            "prv_existing_v1"
          );

        const existing =
          createDeploymentConfigurationDocument({
            stage:
              "prod",

            createdAt:
              "2026-08-01T00:00:00.000Z",

            platformRelease:
              release,

            profileVariant:
              variant,
          });


        mockS3Send
          .mockResolvedValueOnce(
            storedResponse(
              existing
            )
          )
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
                "/deployment-configurations/create",

              body: {
                platformReleaseId:
                  "plr_existing_v1",

                profileVariantId:
                  "prv_existing_v1",
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
          )
            .code
        ).toBe(
          "PPS_DECLARATION_REQUIRED"
        );


        expect(
          mockDynamoSend
        ).not.toHaveBeenCalled();
      }
    );


    test(
      "rejects client-supplied derived configuration metadata",
      async () => {
        const response =
          await handler(
            ownerEvent({
              method:
                "POST",

              path:
                "/deployment-configurations/create",

              body: {
                platformReleaseId:
                  "plr_api_001",

                profileVariantId:
                  "prv_api_001",

                contentSchemaVersion:
                  999,
              },
            })
          );


        expect(
          response.statusCode
        ).toBe(
          400
        );


        expect(
          parsedBody(
            response
          ).error
        ).toMatch(
          /contentSchemaVersion is not supported/
        );


        expect(
          mockS3Send
        ).not.toHaveBeenCalled();

        expect(
          mockDynamoSend
        ).not.toHaveBeenCalled();
      }
    );


    test(
      "returns 404 when the authoritative Platform Release does not exist",
      async () => {
        mockS3Send
          .mockRejectedValueOnce(
            notFound()
          )
          .mockRejectedValueOnce(
            notFound()
          );


        const response =
          await handler(
            ownerEvent({
              method:
                "POST",

              path:
                "/deployment-configurations/create",

              body: {
                platformReleaseId:
                  "plr_missing",

                profileVariantId:
                  "prv_api_001",
              },
            })
          );


        expect(
          response.statusCode
        ).toBe(
          404
        );


        expect(
          parsedBody(
            response
          ).error
        ).toBe(
          "Platform Release not found."
        );
      }
    );


    test(
      "concurrent creation resolves to the immutable winning configuration",
      async () => {
        const release =
          validRelease();

        const variant =
          validVariant();

        const winner =
          validConfiguration({
            createdAt:
              "2026-08-23T11:00:00.000Z",
          });


        mockS3Send
          .mockRejectedValueOnce(
            notFound()
          )
          .mockResolvedValueOnce(
            storedResponse(
              release
            )
          )
          .mockResolvedValueOnce(
            storedResponse(
              variant
            )
          )
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
              winner
            )
          );


        mockDynamoSend
          .mockResolvedValueOnce(
            {}
          );


        const response =
          await handler(
            ownerEvent({
              method:
                "POST",

              path:
                "/deployment-configurations/create",

              body: {
                platformReleaseId:
                  "plr_api_001",

                profileVariantId:
                  "prv_api_001",
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
            .alreadyCreated
        ).toBe(
          true
        );


        expect(
          parsedBody(
            response
          )
            .configuration
            .createdAt
        ).toBe(
          winner.createdAt
        );
      }
    );


    test(
      "gets one authoritative immutable Deployment Configuration",
      async () => {
        const configuration =
          validConfiguration();


        mockS3Send
          .mockResolvedValueOnce(
            storedResponse(
              configuration
            )
          );


        const response =
          await handler(
            ownerEvent({
              method:
                "GET",

              path:
                "/deployment-configurations/get",

              queryStringParameters: {
                deploymentConfigurationId:
                  configuration
                    .deploymentConfigurationId,
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
            .configuration
            .deploymentConfigurationId
        ).toBe(
          configuration
            .deploymentConfigurationId
        );
      }
    );


    test(
      "lists configurations by Profile Variant through the reverse-lookup index",
      async () => {
        mockDynamoSend
          .mockResolvedValueOnce({
            Items: [
              {
                deploymentConfigurationId: {
                  S:
                    "cfg_example",
                },

                stage: {
                  S:
                    "prod",
                },

                createdAt: {
                  S:
                    "2026-08-23T11:00:00.000Z",
                },

                platformReleaseId: {
                  S:
                    "plr_api_001",
                },

                profileVariantId: {
                  S:
                    "prv_api_001",
                },

                contentSchemaVersion: {
                  N:
                    "1",
                },

                contentHash: {
                  S:
                    "c".repeat(
                      64
                    ),
                },

                profileTargetingLocation: {
                  S:
                    "Austin",
                },

                profileTargetingJobRole: {
                  S:
                    "Backend Engineer",
                },

                objectKey: {
                  S:
                    "configurations/cfg_example.json",
                },

                configurationSha256: {
                  S:
                    "d".repeat(
                      64
                    ),
                },
              },
            ],
          });


        const response =
          await handler(
            ownerEvent({
              method:
                "GET",

              path:
                "/deployment-configurations/list",

              queryStringParameters: {
                profileVariantId:
                  "prv_api_001",
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
            .configurations
        ).toHaveLength(
          1
        );


        const query =
          mockDynamoSend
            .mock
            .calls[0][0];


        expect(
          query
            .constructor
            .name
        ).toBe(
          "QueryCommand"
        );


        expect(
          query.input
            .IndexName
        ).toBe(
          "ByProfileVariant"
        );
      }
    );


    test(
      "lists configurations by Platform Release and requires exactly one selector",
      async () => {
        mockDynamoSend
          .mockResolvedValueOnce({
            Items:
              [],
          });


        const byPlatform =
          await handler(
            ownerEvent({
              method:
                "GET",

              path:
                "/deployment-configurations/list",

              queryStringParameters: {
                platformReleaseId:
                  "plr_api_001",
              },
            })
          );


        expect(
          byPlatform.statusCode
        ).toBe(
          200
        );


        expect(
          mockDynamoSend
            .mock
            .calls[0][0]
            .input
            .IndexName
        ).toBe(
          "ByPlatformRelease"
        );


        mockDynamoSend
          .mockReset();


        const neither =
          await handler(
            ownerEvent({
              method:
                "GET",

              path:
                "/deployment-configurations/list",
            })
          );


        expect(
          neither.statusCode
        ).toBe(
          400
        );


        const both =
          await handler(
            ownerEvent({
              method:
                "GET",

              path:
                "/deployment-configurations/list",

              queryStringParameters: {
                profileVariantId:
                  "prv_api_001",

                platformReleaseId:
                  "plr_api_001",
              },
            })
          );


        expect(
          both.statusCode
        ).toBe(
          400
        );
      }
    );
  }
);