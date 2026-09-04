import {
  Readable,
} from "node:stream";

import {
  marshall,
} from "@aws-sdk/util-dynamodb";

import {
  canonicalJsonStringify,
  computeProfileVariantContentHash,
  createProfileVariantManifestKey,
  hexSha256ToBase64,
  sha256Hex,
} from "../lambda/profile-variants-contract";

import {
  createPlatformReleaseDocument,
  createPlatformReleaseDocumentV2,
} from "../lambda/platform-release-contract";

import {
  createDeploymentConfigurationDocument,
} from "../lambda/deployment-configuration-contract";

import {
  buildProfileActivationTransition,
} from "../lambda/profile-activation-contract";

import {
  buildPlatformDeploymentTransition,
} from "../lambda/platform-deployment-contract";


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


const PROFILE_TABLE =
  "profile-activation-test-table";

const PLATFORM_TABLE =
  "platform-deployment-test-table";

const USAGE_EPOCH_TABLE =
  "usage-epoch-test-table";


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
    "prv_p5f2"
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
        "2026-08-24T01:00:00.000Z",

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
    "plr_p5f2",

  ppsVersion =
    1
) {
  return createPlatformReleaseDocumentV2({
    platformReleaseId,

    stage:
      "prod",

    createdAt:
      "2026-08-24T00:55:00.000Z",

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
        "checkpoint-p5f2",
    },

    build: {
      buildTime:
        "2026-08-24T00:54:00.000Z",

      frontendArtifactSha256:
        "a".repeat(
          64
        ),

      githubRunId:
        "98765",

      repoArtifactKey:
        "profiles/legacy/repo/p5f2.zip",

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
        "pv_p5f2",
    },
  });
}

function validReleaseV1(
  platformReleaseId =
    "plr_p5f2_v1"
) {
  const qualified =
    validRelease(
      platformReleaseId
    );


  return createPlatformReleaseDocument({
    platformReleaseId:
      qualified
        .platformReleaseId,

    stage:
      qualified.stage,

    createdAt:
      qualified.createdAt,

    source:
      qualified.source,

    build:
      qualified.build,

    legacy:
      qualified.legacy,
  });
}


function validConfiguration(
  release:
    any,

  variant:
    any
) {
  return createDeploymentConfigurationDocument({
    stage:
      "prod",

    createdAt:
      "2026-08-24T01:01:00.000Z",

    platformRelease:
      release,

    profileVariant:
      variant,
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


function noSuchKey() {
  return {
    name:
      "NoSuchKey",

    $metadata: {
      httpStatusCode:
        404,
    },
  };
}


/**
 * The shape S3 actually returns for a GetObject on a missing key
 * when the caller lacks s3:ListBucket -- masks the true NotFound as
 * AccessDenied instead. The Deployment Configuration bucket is
 * deliberately GetObject-only with no ListBucket grant, so this is
 * the real-world error shape for a missing Deployment Configuration,
 * not noSuchKey() above.
 */
function accessDeniedMaskingMissingKey() {
  return {
    name:
      "AccessDenied",

    $metadata: {
      httpStatusCode:
        403,
    },
  };
}


function ownerEvent({
  path,
  body,
}: {
  path:
    string;

  body:
    unknown;
}) {
  return {
    rawPath:
      path,

    requestContext: {
      http: {
        method:
          "POST",

        path,
      },
    },

    headers: {
      "x-owner-token":
        "test-owner-token",
    },

    body:
      JSON.stringify(
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


function profilePointer(
  variant:
    any
) {
  return buildProfileActivationTransition({
    activationId:
      "act_existing",

    profileVariantId:
      variant.profileVariantId,

    activatedAt:
      "2026-08-24T01:02:00.000Z",

    contentSchemaVersion:
      variant.contentSchemaVersion,

    contentHash:
      variant.contentHash,
  }).pointer;
}


function platformPointer(
  release:
    any,
  deploymentId =
    "pdep_existing"
) {
  const releaseBody =
    canonicalJsonStringify(
      release
    );


  return buildPlatformDeploymentTransition({
    deploymentId,

    platformReleaseId:
      release.platformReleaseId,

    deployedAt:
      "2026-08-24T01:03:00.000Z",

    platformReleaseSha256:
      sha256Hex(
        releaseBody
      ),
  }).pointer;
}


beforeAll(
  async () => {
    process.env.OWNER_TOKEN =
      "test-owner-token";

    process.env.SNAPSHOTS_BUCKET =
      "snapshot-test-bucket";

    process.env.PROFILE_VARIANTS_BUCKET =
      "profile-variant-test-bucket";

    process.env.PLATFORM_RELEASES_BUCKET =
      "platform-release-test-bucket";

    process.env.DEPLOYMENT_CONFIGURATIONS_BUCKET =
      "deployment-configuration-test-bucket";

    process.env.DEPLOYMENT_CONFIGURATIONS_TABLE =
      "deployment-configuration-test-table";

    process.env.PROFILE_ACTIVATION_TABLE =
      PROFILE_TABLE;

    process.env.PLATFORM_DEPLOYMENT_TABLE =
      PLATFORM_TABLE;

    process.env.USAGE_EPOCHS_TABLE =
      USAGE_EPOCH_TABLE;

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
    delete process.env.SNAPSHOTS_BUCKET;
    delete process.env.PROFILE_VARIANTS_BUCKET;
    delete process.env.PLATFORM_RELEASES_BUCKET;
    delete process.env.DEPLOYMENT_CONFIGURATIONS_BUCKET;
    delete process.env.DEPLOYMENT_CONFIGURATIONS_TABLE;
    delete process.env.PROFILE_ACTIVATION_TABLE;
    delete process.env.PLATFORM_DEPLOYMENT_TABLE;
    delete process.env.USAGE_EPOCHS_TABLE;
    delete process.env.STAGE;
  }
);


describe(
  "P5F2 Platform/Profile composition-safe control plane",
  () => {
    test(
      "commits Platform deployment only with the exact active Profile composition guarded atomically",
      async () => {
        const release =
          validRelease();

        const variant =
          validVariant();

        const configuration =
          validConfiguration(
            release,
            variant
          );

        const activeProfile =
          profilePointer(
            variant
          );


        mockS3Send
          .mockImplementation(
            async (
              command:
                any
            ) => {
              const key =
                command
                  ?.input
                  ?.Key;


              if (
                key ===
                  `releases/${release.platformReleaseId}.json`
              ) {
                return storedResponse(
                  release
                );
              }


              if (
                key ===
                  `configurations/${configuration.deploymentConfigurationId}.json`
              ) {
                return storedResponse(
                  configuration
                );
              }


              throw noSuchKey();
            }
          );


        mockDynamoSend
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
                  "GetItemCommand"
              ) {
                if (
                  command
                    .input
                    .TableName ===
                  PLATFORM_TABLE
                ) {
                  return {};
                }


                if (
                  command
                    .input
                    .TableName ===
                  PROFILE_TABLE
                ) {
                  return {
                    Item:
                      marshall(
                        activeProfile
                      ),
                  };
                }

                if (
                    command
                        .input
                        .TableName ===
                    USAGE_EPOCH_TABLE
                    ) {
                    return {};
                }

              }


              if (
                name ===
                  "TransactWriteItemsCommand"
              ) {
                return {};
              }


              throw new Error(
                `Unexpected DynamoDB command: ${name}`
              );
            }
          );


        const response =
          await handler(
            ownerEvent({
              path:
                "/platform-deployments/commit",

              body: {
                deploymentId:
                  "pdep_api_001",

                platformReleaseId:
                  release.platformReleaseId,

                expectedRevision:
                  0,
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

          alreadyCommitted:
            false,

          deploymentConfigurationId:
            configuration
              .deploymentConfigurationId,
        });


        const transaction =
          mockDynamoSend
            .mock
            .calls
            .map(
              (
                call:
                  any[]
              ) =>
                call[0]
            )
            .find(
              (
                command:
                  any
              ) =>
                command
                  ?.constructor
                  ?.name ===
                "TransactWriteItemsCommand"
            );


        expect(
          transaction
        ).toBeDefined();


        expect(
          transaction
            .input
            .TransactItems
        ).toHaveLength(
          5
        );


        expect(
          transaction
            .input
            .TransactItems[0]
            .ConditionCheck
            .TableName
        ).toBe(
          PROFILE_TABLE
        );


        expect(
          transaction
            .input
            .TransactItems[0]
            .ConditionCheck
            .ConditionExpression
        ).toContain(
          "#activationId = :expectedActivationId"
        );


        expect(
          transaction
            .input
            .TransactItems[1]
            .Put
            .TableName
        ).toBe(
          PLATFORM_TABLE
        );


        expect(
          transaction
            .input
            .TransactItems[2]
            .Put
            .TableName
        ).toBe(
          PLATFORM_TABLE
        );

        expect(
            transaction
                .input
                .TransactItems[3]
                .Put
                .TableName
            ).toBe(
            USAGE_EPOCH_TABLE
        );


            expect(
            transaction
                .input
                .TransactItems[4]
                .Put
                .TableName
            ).toBe(
            USAGE_EPOCH_TABLE
        );

      }
    );


    test(
      "rejects Platform deployment when active Profile composition has no Deployment Configuration",
      async () => {
        const release =
          validRelease(
            "plr_missing_cfg"
          );

        const variant =
          validVariant(
            "prv_missing_cfg"
          );

        const activeProfile =
          profilePointer(
            variant
          );


        mockS3Send
          .mockImplementation(
            async (
              command:
                any
            ) => {
              const key =
                command
                  ?.input
                  ?.Key;


              if (
                key ===
                  `releases/${release.platformReleaseId}.json`
              ) {
                return storedResponse(
                  release
                );
              }


              throw noSuchKey();
            }
          );


        mockDynamoSend
          .mockImplementation(
            async (
              command:
                any
            ) => {
              if (
                command
                  ?.constructor
                  ?.name ===
                "GetItemCommand"
              ) {
                if (
                  command
                    .input
                    .TableName ===
                  PLATFORM_TABLE
                ) {
                  return {};
                }


                return {
                  Item:
                    marshall(
                      activeProfile
                    ),
                };
              }


              throw new Error(
                "Platform deployment must not transact without configuration."
              );
            }
          );


        const response =
          await handler(
            ownerEvent({
              path:
                "/platform-deployments/commit",

              body: {
                deploymentId:
                  "pdep_missing_cfg",

                platformReleaseId:
                  release.platformReleaseId,
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
          /Deployment Configuration/
        );


        expect(
          mockDynamoSend
            .mock
            .calls
            .some(
              (
                call:
                  any[]
              ) =>
                call[0]
                  ?.constructor
                  ?.name ===
                "TransactWriteItemsCommand"
            )
        ).toBe(
          false
        );
      }
    );


    test(
      "Platform deployment remains valid with no active Profile and atomically guards Profile absence",
      async () => {
        const release =
          validRelease(
            "plr_no_profile"
          );


        mockS3Send
          .mockResolvedValueOnce(
            storedResponse(
              release
            )
          );


        mockDynamoSend
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
                  "GetItemCommand"
              ) {
                return {};
              }


              if (
                name ===
                  "TransactWriteItemsCommand"
              ) {
                return {};
              }


              throw new Error(
                `Unexpected DynamoDB command: ${name}`
              );
            }
          );


        const response =
          await handler(
            ownerEvent({
              path:
                "/platform-deployments/commit",

              body: {
                deploymentId:
                  "pdep_no_profile",

                platformReleaseId:
                  release.platformReleaseId,
              },
            })
          );


        expect(
          response.statusCode
        ).toBe(
          201
        );


        const transaction =
          mockDynamoSend
            .mock
            .calls
            .map(
              (
                call:
                  any[]
              ) =>
                call[0]
            )
            .find(
              (
                command:
                  any
              ) =>
                command
                  ?.constructor
                  ?.name ===
                "TransactWriteItemsCommand"
            );

        expect(
            transaction
            ).toBeDefined();


            expect(
            transaction
                .input
                .TransactItems
            ).toHaveLength(
            4
        );


        expect(
          transaction
            .input
            .TransactItems[0]
            .ConditionCheck
            .ConditionExpression
        ).toBe(
          "attribute_not_exists(#pk) AND attribute_not_exists(#sk)"
        );

        expect(
            transaction
                .input
                .TransactItems[3]
                .ConditionCheck
                .TableName
            ).toBe(
            USAGE_EPOCH_TABLE
        );


        expect(
            transaction
                .input
                .TransactItems[3]
                .ConditionCheck
                .ConditionExpression
            ).toBe(
            "attribute_not_exists(#pk) AND attribute_not_exists(#sk)"
        );

      }
    );


    test(
      "retries the already-active deployment occurrence idempotently",
      async () => {
        const release =
          validRelease(
            "plr_retry"
          );

        const existing =
          platformPointer(
            release,
            "pdep_retry"
          );


        mockS3Send
          .mockResolvedValueOnce(
            storedResponse(
              release
            )
          );


        mockDynamoSend
          .mockResolvedValueOnce({
            Item:
              marshall(
                existing
              ),
          });


        const response =
          await handler(
            ownerEvent({
              path:
                "/platform-deployments/commit",

              body: {
                deploymentId:
                  "pdep_retry",

                platformReleaseId:
                  release.platformReleaseId,

                expectedRevision:
                  0,
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

          alreadyCommitted:
            true,

          active: {
            deploymentId:
              "pdep_retry",

            platformReleaseId:
              "plr_retry",
          },
        });


        expect(
          mockDynamoSend
        ).toHaveBeenCalledTimes(
          1
        );
      }
    );


    test(
      "Profile activation with an active Platform requires configuration and condition-checks exact Platform state",
      async () => {
        const release =
          validRelease(
            "plr_profile_activate"
          );

        const variant =
          validVariant(
            "prv_profile_activate"
          );

        const configuration =
          validConfiguration(
            release,
            variant
          );

        const activePlatform =
          platformPointer(
            release
          );


        mockS3Send
          .mockImplementation(
            async (
              command:
                any
            ) => {
              const key =
                command
                  ?.input
                  ?.Key;


              if (
                key ===
                    createProfileVariantManifestKey(
                    variant.profileVariantId
                    )
              ) {
                return storedResponse(
                  variant
                );
              }


              if (
                key ===
                  `releases/${release.platformReleaseId}.json`
              ) {
                return storedResponse(
                  release
                );
              }


              if (
                key ===
                  `configurations/${configuration.deploymentConfigurationId}.json`
              ) {
                return storedResponse(
                  configuration
                );
              }


              throw noSuchKey();
            }
          );


        mockDynamoSend
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
                  "GetItemCommand"
              ) {
                if (
                  command
                    .input
                    .TableName ===
                  PLATFORM_TABLE
                ) {
                  return {
                    Item:
                      marshall(
                        activePlatform
                      ),
                  };
                }


                if (
                  command
                    .input
                    .TableName ===
                  PROFILE_TABLE
                ) {
                  return {};
                }

                if (
                    command
                        .input
                        .TableName ===
                    USAGE_EPOCH_TABLE
                    ) {
                    return {};
                }

              }


              if (
                name ===
                  "TransactWriteItemsCommand"
              ) {
                return {};
              }


              throw new Error(
                `Unexpected DynamoDB command: ${name}`
              );
            }
          );


        const response =
          await handler(
            ownerEvent({
              path:
                "/profile-variants/activate",

              body: {
                profileVariantId:
                  variant.profileVariantId,

                expectedRevision:
                  0,
              },
            })
          );


        expect(
          response.statusCode
        ).toBe(
          201
        );


        const transaction =
          mockDynamoSend
            .mock
            .calls
            .map(
              (
                call:
                  any[]
              ) =>
                call[0]
            )
            .find(
              (
                command:
                  any
              ) =>
                command
                  ?.constructor
                  ?.name ===
                "TransactWriteItemsCommand"
            );


        expect(
          transaction
            .input
            .TransactItems
        ).toHaveLength(
          5
        );


        expect(
          transaction
            .input
            .TransactItems[0]
            .ConditionCheck
            .TableName
        ).toBe(
          PLATFORM_TABLE
        );


        expect(
          transaction
            .input
            .TransactItems[0]
            .ConditionCheck
            .ConditionExpression
        ).toContain(
          "#deploymentId = :expectedDeploymentId"
        );

        expect(
            transaction
                .input
                .TransactItems[1]
                .Put
                .TableName
            ).toBe(
            PROFILE_TABLE
        );


        expect(
            transaction
                .input
                .TransactItems[2]
                .Put
                .TableName
            ).toBe(
            PROFILE_TABLE
        );


        expect(
            transaction
                .input
                .TransactItems[3]
                .Put
                .TableName
            ).toBe(
            USAGE_EPOCH_TABLE
        );


        expect(
            transaction
                .input
                .TransactItems[4]
                .Put
                .TableName
            ).toBe(
            USAGE_EPOCH_TABLE
        );

      }
    );


    test(
      "Profile activation rejects a missing Deployment Configuration while Platform is active",
      async () => {
        const release =
          validRelease(
            "plr_profile_missing"
          );

        const variant =
          validVariant(
            "prv_profile_missing"
          );

        const activePlatform =
          platformPointer(
            release
          );


        mockS3Send
          .mockImplementation(
            async (
              command:
                any
            ) => {
              if (
                command
                    ?.input
                    ?.Key ===
                createProfileVariantManifestKey(
                    variant.profileVariantId
                )
              ) {
                return storedResponse(
                    variant
                );
              }

              if (
                command
                  ?.input
                  ?.Key ===
                  `releases/${release.platformReleaseId}.json`
              ) {
                return storedResponse(
                  release
                );
              }


              throw noSuchKey();
            }
          );


        mockDynamoSend
          .mockImplementation(
            async (
              command:
                any
            ) => {
              if (
                command
                  ?.constructor
                  ?.name ===
                  "GetItemCommand"
              ) {
                return {
                  Item:
                    marshall(
                      activePlatform
                    ),
                };
              }


              throw new Error(
                "Profile activation must not transact without configuration."
              );
            }
          );


        const response =
          await handler(
            ownerEvent({
              path:
                "/profile-variants/activate",

              body: {
                profileVariantId:
                  variant.profileVariantId,
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
          /Deployment Configuration/
        );


        expect(
          parsedBody(
            response
          ).code
        ).toBe(
          "DEPLOYMENT_CONFIGURATION_MISSING"
        );
      }
    );


    test(
      "Profile activation recognizes a missing Deployment Configuration masked as S3 AccessDenied",
      async () => {
        const release =
          validRelease(
            "plr_profile_masked"
          );

        const variant =
          validVariant(
            "prv_profile_masked"
          );

        const activePlatform =
          platformPointer(
            release
          );


        mockS3Send
          .mockImplementation(
            async (
              command:
                any
            ) => {
              if (
                command
                    ?.input
                    ?.Key ===
                createProfileVariantManifestKey(
                    variant.profileVariantId
                )
              ) {
                return storedResponse(
                    variant
                );
              }

              if (
                command
                  ?.input
                  ?.Key ===
                  `releases/${release.platformReleaseId}.json`
              ) {
                return storedResponse(
                  release
                );
              }

              if (
                command
                  ?.constructor
                  ?.name ===
                  "GetObjectCommand"
              ) {
                throw accessDeniedMaskingMissingKey();
              }


              throw noSuchKey();
            }
          );


        mockDynamoSend
          .mockImplementation(
            async (
              command:
                any
            ) => {
              if (
                command
                  ?.constructor
                  ?.name ===
                  "GetItemCommand"
              ) {
                return {
                  Item:
                    marshall(
                      activePlatform
                    ),
                };
              }


              throw new Error(
                "Profile activation must not transact without configuration."
              );
            }
          );


        const response =
          await handler(
            ownerEvent({
              path:
                "/profile-variants/activate",

              body: {
                profileVariantId:
                  variant.profileVariantId,
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
          /Deployment Configuration/
        );


        expect(
          parsedBody(
            response
          ).code
        ).toBe(
          "DEPLOYMENT_CONFIGURATION_MISSING"
        );


        expect(
          parsedBody(
            response
          ).platformReleaseId
        ).toBe(
          release.platformReleaseId
        );


        expect(
          parsedBody(
            response
          ).profileVariantId
        ).toBe(
          variant.profileVariantId
        );
      }
    );

    test(
      "rejects a new Platform deployment for an unqualified historical v1 release even when no Profile is active",
      async () => {
        const release =
          validReleaseV1(
            "plr_new_v1_rejected"
          );


        mockS3Send
          .mockResolvedValueOnce(
            storedResponse(
              release
            )
          );


        mockDynamoSend
          .mockImplementation(
            async (
              command:
                any
            ) => {
              if (
                command
                  ?.constructor
                  ?.name ===
                "GetItemCommand"
              ) {
                return {};
              }


              throw new Error(
                "Unqualified Platform Release must not reach a transaction."
              );
            }
          );


        const response =
          await handler(
            ownerEvent({
              path:
                "/platform-deployments/commit",

              body: {
                deploymentId:
                  "pdep_new_v1_rejected",

                platformReleaseId:
                  release
                    .platformReleaseId,
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
            .mock
            .calls
            .some(
              (
                call:
                  any[]
              ) =>
                call[0]
                  ?.constructor
                  ?.name ===
                "TransactWriteItemsCommand"
            )
        ).toBe(
          false
        );
      }
    );

    test(
      "keeps an already-active historical v1 Platform deployment occurrence idempotently retryable",
      async () => {
        const release =
          validReleaseV1(
            "plr_v1_retry"
          );

        const existing =
          platformPointer(
            release,
            "pdep_v1_retry"
          );


        mockS3Send
          .mockResolvedValueOnce(
            storedResponse(
              release
            )
          );


        mockDynamoSend
          .mockResolvedValueOnce({
            Item:
              marshall(
                existing
              ),
          });


        const response =
          await handler(
            ownerEvent({
              path:
                "/platform-deployments/commit",

              body: {
                deploymentId:
                  "pdep_v1_retry",

                platformReleaseId:
                  release
                    .platformReleaseId,
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
            .alreadyCommitted
        ).toBe(
          true
        );


        expect(
          mockDynamoSend
        ).toHaveBeenCalledTimes(
          1
        );
      }
    );

    test(
      "rejects Profile activation when the active Platform Release is historical and PPS-unqualified",
      async () => {
        const release =
          validReleaseV1(
            "plr_active_v1"
          );

        const variant =
          validVariant(
            "prv_active_v1"
          );

        const activePlatform =
          platformPointer(
            release
          );


        mockS3Send
          .mockImplementation(
            async (
              command:
                any
            ) => {
              const key =
                command
                  ?.input
                  ?.Key;


              if (
                key ===
                  createProfileVariantManifestKey(
                    variant
                      .profileVariantId
                  )
              ) {
                return storedResponse(
                  variant
                );
              }


              if (
                key ===
                  `releases/${release.platformReleaseId}.json`
              ) {
                return storedResponse(
                  release
                );
              }


              throw noSuchKey();
            }
          );


        mockDynamoSend
          .mockImplementation(
            async (
              command:
                any
            ) => {
              if (
                command
                  ?.constructor
                  ?.name ===
                "GetItemCommand" &&
                command
                  .input
                  .TableName ===
                PLATFORM_TABLE
              ) {
                return {
                  Item:
                    marshall(
                      activePlatform
                    ),
                };
              }


              throw new Error(
                "Unqualified active Platform must block Profile activation before transaction."
              );
            }
          );


        const response =
          await handler(
            ownerEvent({
              path:
                "/profile-variants/activate",

              body: {
                profileVariantId:
                  variant
                    .profileVariantId,
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
      }
    );

    test(
      "rejects Profile activation when authoritative Platform Release bytes do not match the active Platform pointer",
      async () => {
        const release =
          validRelease(
            "plr_checksum_mismatch"
          );

        const variant =
          validVariant(
            "prv_checksum_mismatch"
          );

        const activePlatform:
          any =
            platformPointer(
              release
            );


        activePlatform
          .platformReleaseSha256 =
          "f".repeat(
            64
          );


        mockS3Send
          .mockImplementation(
            async (
              command:
                any
            ) => {
              const key =
                command
                  ?.input
                  ?.Key;


              if (
                key ===
                  createProfileVariantManifestKey(
                    variant
                      .profileVariantId
                  )
              ) {
                return storedResponse(
                  variant
                );
              }


              if (
                key ===
                  `releases/${release.platformReleaseId}.json`
              ) {
                return storedResponse(
                  release
                );
              }


              throw noSuchKey();
            }
          );


        mockDynamoSend
          .mockImplementation(
            async (
              command:
                any
            ) => {
              if (
                command
                  ?.constructor
                  ?.name ===
                "GetItemCommand" &&
                command
                  .input
                  .TableName ===
                PLATFORM_TABLE
              ) {
                return {
                  Item:
                    marshall(
                      activePlatform
                    ),
                };
              }


              throw new Error(
                "Checksum mismatch must block activation before transaction."
              );
            }
          );


        const response =
          await handler(
            ownerEvent({
              path:
                "/profile-variants/activate",

              body: {
                profileVariantId:
                  variant
                    .profileVariantId,
              },
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
        ).toMatch(
          /checksum does not match/
        );
      }
    );


    test(
      "Profile activation remains valid with no active Platform and atomically guards Platform absence",
      async () => {
        const variant =
          validVariant(
            "prv_no_platform"
          );


        mockS3Send
          .mockResolvedValueOnce(
            storedResponse(
              variant
            )
          );


        mockDynamoSend
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
                  "GetItemCommand"
              ) {
                return {};
              }


              if (
                name ===
                  "TransactWriteItemsCommand"
              ) {
                return {};
              }


              throw new Error(
                `Unexpected DynamoDB command: ${name}`
              );
            }
          );


        const response =
          await handler(
            ownerEvent({
              path:
                "/profile-variants/activate",

              body: {
                profileVariantId:
                  variant.profileVariantId,

                expectedRevision:
                  0,
              },
            })
          );


        expect(
          response.statusCode
        ).toBe(
          201
        );


        const transaction =
          mockDynamoSend
            .mock
            .calls
            .map(
              (
                call:
                  any[]
              ) =>
                call[0]
            )
            .find(
              (
                command:
                  any
              ) =>
                command
                  ?.constructor
                  ?.name ===
                "TransactWriteItemsCommand"
            );

            expect(
                transaction
                    .input
                    .TransactItems
                ).toHaveLength(
                4
            );


        expect(
          transaction
            .input
            .TransactItems[0]
            .ConditionCheck
            .TableName
        ).toBe(
          PLATFORM_TABLE
        );

        expect(
            transaction
                .input
                .TransactItems[3]
                .ConditionCheck
                .TableName
            ).toBe(
            USAGE_EPOCH_TABLE
        );


        expect(
            transaction
                .input
                .TransactItems[3]
                .ConditionCheck
                .ConditionExpression
            ).toBe(
            "attribute_not_exists(#pk) AND attribute_not_exists(#sk)"
        );


        expect(
          transaction
            .input
            .TransactItems[0]
            .ConditionCheck
            .ConditionExpression
        ).toBe(
          "attribute_not_exists(#pk) AND attribute_not_exists(#sk)"
        );
      }
    );
  }
);