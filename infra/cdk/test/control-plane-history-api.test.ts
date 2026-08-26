import {
  marshall,
} from "@aws-sdk/util-dynamodb";

import {
  buildProfileActivationTransition,
} from "../lambda/profile-activation-contract";

import {
  buildPlatformDeploymentTransition,
} from "../lambda/platform-deployment-contract";


const mockDynamoSend =
  jest.fn();


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
  "profile-activation-history-test";

const PLATFORM_TABLE =
  "platform-deployment-history-test";

const OWNER_TOKEN =
  "owner-history-test-token";


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

    queryStringParameters,

    headers: {
      "x-owner-token":
        OWNER_TOKEN,
    },
  };
}


function responseBody(
  response:
    any
) {
  return JSON.parse(
    String(
      response
        ?.body ||
      "{}"
    )
  );
}


function activationLedger({
  activationId =
    "act_history_001",

  profileVariantId =
    "prv_history_001",

  activatedAt =
    "2026-08-24T01:00:00.000Z",
} = {}) {
  return buildProfileActivationTransition({
    activationId,

    profileVariantId,

    activatedAt,

    contentSchemaVersion:
      1,

    contentHash:
      "a".repeat(
        64
      ),
  }).ledger;
}


function deploymentLedger({
  deploymentId =
    "pdep_history_001",

  platformReleaseId =
    "plr_history_001",

  deployedAt =
    "2026-08-24T02:00:00.000Z",
} = {}) {
  return buildPlatformDeploymentTransition({
    deploymentId,

    platformReleaseId,

    deployedAt,

    platformReleaseSha256:
      "b".repeat(
        64
      ),
  }).ledger;
}


function tokenFor({
  scope,

  key,
}: {
  scope:
    string;

  key:
    any;
}) {
  return Buffer
    .from(
      JSON.stringify({
        scope,

        key,
      }),
      "utf8"
    )
    .toString(
      "base64url"
    );
}


describe(
  "P7B control-plane history APIs",
  () => {
    beforeEach(
      () => {
        jest.resetModules();

        mockDynamoSend
          .mockReset();


        process.env
          .OWNER_TOKEN =
          OWNER_TOKEN;

        process.env
          .PROFILE_ACTIVATION_TABLE =
          PROFILE_TABLE;

        process.env
          .PLATFORM_DEPLOYMENT_TABLE =
          PLATFORM_TABLE;

        process.env
          .STAGE =
          "prod";

        process.env
          .ALLOWED_ORIGINS =
          "";


        handler =
          require(
            "../lambda/snapshots-handler"
          ).handler;
      }
    );


    test(
      "lists complete Profile Activation ledger newest first",
      async () => {
        const ledger =
          activationLedger();


        mockDynamoSend
          .mockResolvedValueOnce({
            Items: [
              marshall(
                ledger
              ),
            ],

            LastEvaluatedKey: {
              pk: {
                S:
                  "ACTIVATION",
              },

              sk: {
                S:
                  ledger.sk,
              },
            },
          });


        const response =
          await handler(
            ownerEvent({
              path:
                "/profile-activations/list",

              queryStringParameters: {
                limit:
                  "25",
              },
            })
          );


        expect(
          response.statusCode
        ).toBe(
          200
        );


        const body =
          responseBody(
            response
          );


        expect(
          body.filter
        ).toEqual({
          profileVariantId:
            null,
        });


        expect(
          body.activations
        ).toEqual([
          {
            activationId:
              ledger.activationId,

            profileVariantId:
              ledger.profileVariantId,

            activatedAt:
              ledger.activatedAt,

            revision:
              ledger.revision,

            previousActivationId:
              null,

            previousProfileVariantId:
              null,

            contentSchemaVersion:
              ledger.contentSchemaVersion,

            contentHash:
              ledger.contentHash,
          },
        ]);


        expect(
          body.nextToken
        ).toEqual(
          expect.any(
            String
          )
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
        ).toMatchObject({
          TableName:
            PROFILE_TABLE,

          KeyConditionExpression:
            "#pk = :pk",

          Limit:
            25,

          ScanIndexForward:
            false,
        });


        expect(
          query.input
            .IndexName
        ).toBeUndefined();


        expect(
          query.input
            .ExpressionAttributeValues[
              ":pk"
            ]
        ).toEqual({
          S:
            "ACTIVATION",
        });
      }
    );


    test(
      "lists Profile Activation history through ByProfileVariant and accepts only a scope-matched token",
      async () => {
        const profileVariantId =
          "prv_history_target";

        const startKey = {
          pk: {
            S:
              "ACTIVATION",
          },

          sk: {
            S:
              "2026-08-24T00:00:00.000Z#act_previous",
          },

          gsi1pk: {
            S:
              `VARIANT#${profileVariantId}`,
          },

          gsi1sk: {
            S:
              "2026-08-24T00:00:00.000Z#act_previous",
          },
        };


        mockDynamoSend
          .mockResolvedValueOnce({
            Items:
              [],
          });


        const response =
          await handler(
            ownerEvent({
              path:
                "/profile-activations/list",

              queryStringParameters: {
                profileVariantId,

                nextToken:
                  tokenFor({
                    scope:
                      `profile-activations:${profileVariantId}`,

                    key:
                      startKey,
                  }),
              },
            })
          );


        expect(
          response.statusCode
        ).toBe(
          200
        );


        const query =
          mockDynamoSend
            .mock
            .calls[0][0];


        expect(
          query.input
            .IndexName
        ).toBe(
          "ByProfileVariant"
        );


        expect(
          query.input
            .ExpressionAttributeValues[
              ":indexPk"
            ]
        ).toEqual({
          S:
            `VARIANT#${profileVariantId}`,
        });


        expect(
          query.input
            .ExclusiveStartKey
        ).toEqual(
          startKey
        );


        expect(
          responseBody(
            response
          ).filter
        ).toEqual({
          profileVariantId,
        });
      }
    );


    test(
      "rejects invalid Profile Activation selector, limit and cross-scope token before querying DynamoDB",
      async () => {
        const invalidId =
          await handler(
            ownerEvent({
              path:
                "/profile-activations/list",

              queryStringParameters: {
                profileVariantId:
                  "../bad",
              },
            })
          );


        expect(
          invalidId.statusCode
        ).toBe(
          400
        );


        const invalidLimit =
          await handler(
            ownerEvent({
              path:
                "/profile-activations/list",

              queryStringParameters: {
                limit:
                  "101",
              },
            })
          );


        expect(
          invalidLimit.statusCode
        ).toBe(
          400
        );


        const invalidToken =
          await handler(
            ownerEvent({
              path:
                "/profile-activations/list",

              queryStringParameters: {
                nextToken:
                  tokenFor({
                    scope:
                      "platform-deployments:all",

                    key: {
                      pk: {
                        S:
                          "DEPLOYMENT",
                      },
                    },
                  }),
              },
            })
          );


        expect(
          invalidToken.statusCode
        ).toBe(
          400
        );


        expect(
          mockDynamoSend
        ).not
          .toHaveBeenCalled();
      }
    );


    test(
      "lists complete Platform Deployment ledger newest first",
      async () => {
        const ledger =
          deploymentLedger();


        mockDynamoSend
          .mockResolvedValueOnce({
            Items: [
              marshall(
                ledger
              ),
            ],

            LastEvaluatedKey: {
              pk: {
                S:
                  "DEPLOYMENT",
              },

              sk: {
                S:
                  ledger.sk,
              },
            },
          });


        const response =
          await handler(
            ownerEvent({
              path:
                "/platform-deployments/list",
            })
          );


        expect(
          response.statusCode
        ).toBe(
          200
        );


        const body =
          responseBody(
            response
          );


        expect(
          body.filter
        ).toEqual({
          platformReleaseId:
            null,
        });


        expect(
          body.deployments
        ).toEqual([
          {
            deploymentId:
              ledger.deploymentId,

            platformReleaseId:
              ledger.platformReleaseId,

            deployedAt:
              ledger.deployedAt,

            revision:
              ledger.revision,

            platformReleaseSha256:
              ledger.platformReleaseSha256,

            previousDeploymentId:
              null,

            previousPlatformReleaseId:
              null,
          },
        ]);


        expect(
          body.nextToken
        ).toEqual(
          expect.any(
            String
          )
        );


        const query =
          mockDynamoSend
            .mock
            .calls[0][0];


        expect(
          query.input
        ).toMatchObject({
          TableName:
            PLATFORM_TABLE,

          KeyConditionExpression:
            "#pk = :pk",

          Limit:
            50,

          ScanIndexForward:
            false,
        });


        expect(
          query.input
            .IndexName
        ).toBeUndefined();


        expect(
          query.input
            .ExpressionAttributeValues[
              ":pk"
            ]
        ).toEqual({
          S:
            "DEPLOYMENT",
        });
      }
    );


    test(
      "lists Platform Deployment history through ByPlatformRelease with scoped pagination",
      async () => {
        const platformReleaseId =
          "plr_history_target";

        const startKey = {
          pk: {
            S:
              "DEPLOYMENT",
          },

          sk: {
            S:
              "2026-08-24T00:00:00.000Z#pdep_previous",
          },

          gsi1pk: {
            S:
              `RELEASE#${platformReleaseId}`,
          },

          gsi1sk: {
            S:
              "2026-08-24T00:00:00.000Z#pdep_previous",
          },
        };


        mockDynamoSend
          .mockResolvedValueOnce({
            Items:
              [],
          });


        const response =
          await handler(
            ownerEvent({
              path:
                "/platform-deployments/list",

              queryStringParameters: {
                platformReleaseId,

                nextToken:
                  tokenFor({
                    scope:
                      `platform-deployments:${platformReleaseId}`,

                    key:
                      startKey,
                  }),
              },
            })
          );


        expect(
          response.statusCode
        ).toBe(
          200
        );


        const query =
          mockDynamoSend
            .mock
            .calls[0][0];


        expect(
          query.input
            .IndexName
        ).toBe(
          "ByPlatformRelease"
        );


        expect(
          query.input
            .ExpressionAttributeValues[
              ":indexPk"
            ]
        ).toEqual({
          S:
            `RELEASE#${platformReleaseId}`,
        });


        expect(
          query.input
            .ExclusiveStartKey
        ).toEqual(
          startKey
        );


        expect(
          responseBody(
            response
          ).filter
        ).toEqual({
          platformReleaseId,
        });
      }
    );


    test(
      "rejects invalid Platform Deployment selector and cross-scope token before querying DynamoDB",
      async () => {
        const invalidId =
          await handler(
            ownerEvent({
              path:
                "/platform-deployments/list",

              queryStringParameters: {
                platformReleaseId:
                  "../bad",
              },
            })
          );


        expect(
          invalidId.statusCode
        ).toBe(
          400
        );


        const invalidToken =
          await handler(
            ownerEvent({
              path:
                "/platform-deployments/list",

              queryStringParameters: {
                nextToken:
                  tokenFor({
                    scope:
                      "profile-activations:all",

                    key: {
                      pk: {
                        S:
                          "ACTIVATION",
                      },
                    },
                  }),
              },
            })
          );


        expect(
          invalidToken.statusCode
        ).toBe(
          400
        );


        expect(
          mockDynamoSend
        ).not
          .toHaveBeenCalled();
      }
    );
  }
);