import {
  GetItemCommand,
  TransactWriteItemsCommand,
} from "@aws-sdk/client-dynamodb";

import {
  marshall,
  unmarshall,
} from "@aws-sdk/util-dynamodb";

import {
  buildPlatformDeploymentTransition,
} from "../lambda/platform-deployment-contract";

import {
  buildProfileActivationTransition,
} from "../lambda/profile-activation-contract";

import {
  commitPlatformDeploymentTransition,
  createPlatformDeploymentTransaction,
  isPlatformDeploymentConflict,
  readActivePlatformReleasePointer,
} from "../lambda/platform-deployment-store";


const RELEASE_SHA =
  "a".repeat(
    64
  );


function firstTransition() {
  return buildPlatformDeploymentTransition({
    deploymentId:
      "pdep_first",

    platformReleaseId:
      "plr_first",

    deployedAt:
      "2026-08-23T12:00:00.000Z",

    platformReleaseSha256:
      RELEASE_SHA,
  });
}


describe(
  "Platform Deployment store",
  () => {
    test(
      "strongly reads the Active Platform Release pointer",
      async () => {
        const transition =
          firstTransition();


        const send =
          jest.fn()
            .mockResolvedValueOnce({
              Item:
                marshall(
                  transition.pointer
                ),
            });


        const result =
          await readActivePlatformReleasePointer({
            client: {
              send,
            },

            tableName:
              "platform-deployment-table",
          });


        expect(
          result
        ).toEqual(
          transition.pointer
        );


        const command =
          send
            .mock
            .calls[0][0];


        expect(
          command
        ).toBeInstanceOf(
          GetItemCommand
        );


        expect(
          command.input
            .ConsistentRead
        ).toBe(
          true
        );
      }
    );


    test(
      "returns null when no Active Platform pointer exists",
      async () => {
        const send =
          jest.fn()
            .mockResolvedValueOnce(
              {}
            );


        await expect(
          readActivePlatformReleasePointer({
            client: {
              send,
            },

            tableName:
              "platform-deployment-table",
          })
        ).resolves.toBeNull();
      }
    );


    test(
      "first deployment transaction atomically appends ledger and creates an absent ACTIVE pointer",
      () => {
        const input =
          createPlatformDeploymentTransaction({
            tableName:
              "platform-deployment-table",

            transition:
              firstTransition(),
          });


        expect(
          input.TransactItems
        ).toHaveLength(
          2
        );


        expect(
          input
            .TransactItems
            ?.[0]
            ?.Put
            ?.ConditionExpression
        ).toBe(
          "attribute_not_exists(#pk) AND attribute_not_exists(#sk)"
        );


        expect(
          input
            .TransactItems
            ?.[1]
            ?.Put
            ?.ConditionExpression
        ).toBe(
          "attribute_not_exists(#pk) AND attribute_not_exists(#sk)"
        );
      }
    );


    test(
      "subsequent deployment transaction protects revision and previous Platform identity",
      () => {
        const first =
          firstTransition();

        const second =
          buildPlatformDeploymentTransition({
            currentPointer:
              first.pointer,

            deploymentId:
              "pdep_second",

            platformReleaseId:
              "plr_second",

            deployedAt:
              "2026-08-23T13:00:00.000Z",

            platformReleaseSha256:
              "b".repeat(
                64
              ),
          });


        const input =
          createPlatformDeploymentTransaction({
            tableName:
              "platform-deployment-table",

            transition:
              second,
          });


        const pointerPut =
          input
            .TransactItems
            ?.[1]
            ?.Put;


        expect(
          pointerPut
            ?.ConditionExpression
        ).toContain(
          "#revision = :expectedRevision"
        );


        expect(
          pointerPut
            ?.ConditionExpression
        ).toContain(
          "#deploymentId = :expectedDeploymentId"
        );


        expect(
          pointerPut
            ?.ConditionExpression
        ).toContain(
          "#platformReleaseId = :expectedPlatformReleaseId"
        );


        expect(
          pointerPut
            ?.ExpressionAttributeValues
            ?.[":expectedRevision"]
        ).toEqual({
          N:
            "1",
        });


        expect(
          pointerPut
            ?.ExpressionAttributeValues
            ?.[":expectedDeploymentId"]
        ).toEqual({
          S:
            "pdep_first",
        });


        expect(
          pointerPut
            ?.ExpressionAttributeValues
            ?.[":expectedPlatformReleaseId"]
        ).toEqual({
          S:
            "plr_first",
        });
      }
    );

    test(
      "Platform deployment transaction condition-checks the exact Active Profile pointer when a guard is supplied",
      () => {
        const profilePointer =
          buildProfileActivationTransition({
            activationId:
              "act_guard",

            profileVariantId:
              "prv_guard",

            activatedAt:
              "2026-08-23T11:30:00.000Z",

            contentSchemaVersion:
              1,

            contentHash:
              "c".repeat(
                64
              ),
          }).pointer;


        const input =
          createPlatformDeploymentTransaction({
            tableName:
              "platform-deployment-table",

            transition:
              firstTransition(),

            profileGuard: {
              tableName:
                "profile-activation-table",

              pointer:
                profilePointer,
            },
          });


        expect(
          input.TransactItems
        ).toHaveLength(
          3
        );


        const guard =
          input
            .TransactItems?.[0]
            ?.ConditionCheck;


        expect(
          guard
            ?.TableName
        ).toBe(
          "profile-activation-table"
        );


        expect(
          unmarshall(
            guard
              ?.Key ||
            {}
          )
        ).toEqual({
          pk:
            "CONTROL",

          sk:
            "ACTIVE",
        });


        expect(
          guard
            ?.ConditionExpression
        ).toContain(
          "#revision = :expectedRevision"
        );


        expect(
          guard
            ?.ConditionExpression
        ).toContain(
          "#activationId = :expectedActivationId"
        );


        expect(
          guard
            ?.ConditionExpression
        ).toContain(
          "#profileVariantId = :expectedProfileVariantId"
        );


        expect(
          guard
            ?.ExpressionAttributeValues
            ?.[":expectedRevision"]
        ).toEqual({
          N:
            "1",
        });


        expect(
          guard
            ?.ExpressionAttributeValues
            ?.[":expectedActivationId"]
        ).toEqual({
          S:
            "act_guard",
        });


        expect(
          guard
            ?.ExpressionAttributeValues
            ?.[":expectedProfileVariantId"]
        ).toEqual({
          S:
            "prv_guard",
        });


        expect(
          input
            .TransactItems?.[1]
            ?.Put
        ).toBeDefined();


        expect(
          input
            .TransactItems?.[2]
            ?.Put
        ).toBeDefined();
      }
    );


    test(
      "Platform deployment transaction condition-checks that Profile state remains absent when absence was observed",
      () => {
        const input =
          createPlatformDeploymentTransaction({
            tableName:
              "platform-deployment-table",

            transition:
              firstTransition(),

            profileGuard: {
              tableName:
                "profile-activation-table",

              pointer:
                null,
            },
          });


        expect(
          input.TransactItems
        ).toHaveLength(
          3
        );


        const guard =
          input
            .TransactItems?.[0]
            ?.ConditionCheck;


        expect(
          guard
            ?.ConditionExpression
        ).toBe(
          "attribute_not_exists(#pk) AND attribute_not_exists(#sk)"
        );


        expect(
          unmarshall(
            guard
              ?.Key ||
            {}
          )
        ).toEqual({
          pk:
            "CONTROL",

          sk:
            "ACTIVE",
        });
      }
    );


    test(
      "commit uses DynamoDB transaction and conflict detection recognizes optimistic concurrency failures",
      async () => {
        const send =
          jest.fn()
            .mockResolvedValueOnce(
              {}
            );


        await commitPlatformDeploymentTransition({
          client: {
            send,
          },

          tableName:
            "platform-deployment-table",

          transition:
            firstTransition(),
        });


        expect(
          send
            .mock
            .calls[0][0]
        ).toBeInstanceOf(
          TransactWriteItemsCommand
        );


        expect(
          isPlatformDeploymentConflict({
            name:
              "TransactionCanceledException",
          })
        ).toBe(
          true
        );


        expect(
          isPlatformDeploymentConflict({
            name:
              "TransactionConflictException",
          })
        ).toBe(
          true
        );


        expect(
          isPlatformDeploymentConflict({
            name:
              "ConditionalCheckFailedException",
          })
        ).toBe(
          true
        );


        expect(
          isPlatformDeploymentConflict({
            name:
              "AccessDeniedException",
          })
        ).toBe(
          false
        );
      }
    );
  }
);