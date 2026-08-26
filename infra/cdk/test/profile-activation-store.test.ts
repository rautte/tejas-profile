// infra/cdk/test/profile-activation-store.test.ts

import {
  marshall,
  unmarshall,
} from "@aws-sdk/util-dynamodb";

import {
  buildProfileActivationTransition,
} from "../lambda/profile-activation-contract";

import {
  buildPlatformDeploymentTransition,
} from "../lambda/platform-deployment-contract";

import {
  createProfileActivationTransaction,
  isProfileActivationConflict,
  readActiveProfilePointer,
} from "../lambda/profile-activation-store";


const TABLE =
  "unit-test-profile-activations";


const HASH_A =
  "a".repeat(
    64
  );

const HASH_B =
  "b".repeat(
    64
  );


function firstTransition() {
  return buildProfileActivationTransition({
    activationId:
      "act_first",

    profileVariantId:
      "prv_dubai",

    activatedAt:
      "2026-08-22T10:00:00.000Z",

    contentSchemaVersion:
      1,

    contentHash:
      HASH_A,
  });
}


describe(
  "Profile Activation store",
  () => {
    test(
      "active pointer is read strongly consistently and validated",
      async () => {
        const transition =
          firstTransition();


        let captured:
          any;


        const client = {
          send:
            jest.fn(
              async (
                command: any
              ) => {
                captured =
                  command.input;

                return {
                  Item:
                    marshall(
                      transition.pointer
                    ),
                };
              }
            ),
        };


        const pointer =
          await readActiveProfilePointer({
            client,

            tableName:
              TABLE,
          });


        expect(
          captured
            .TableName
        ).toBe(
          TABLE
        );


        expect(
          captured
            .ConsistentRead
        ).toBe(true);


        expect(
          unmarshall(
            captured.Key
          )
        ).toEqual({
          pk:
            "CONTROL",

          sk:
            "ACTIVE",
        });


        expect(
          pointer
        ).toEqual(
          transition.pointer
        );
      }
    );


    test(
      "missing ACTIVE pointer returns null",
      async () => {
        const client = {
          send:
            jest.fn(
              async () => ({})
            ),
        };


        await expect(
          readActiveProfilePointer({
            client,

            tableName:
              TABLE,
          })
        ).resolves.toBeNull();
      }
    );


    test(
      "first activation atomically appends ledger and creates absent ACTIVE pointer",
      () => {
        const transition =
          firstTransition();


        const input =
          createProfileActivationTransaction({
            tableName:
              TABLE,

            transition,
          });


        expect(
          input.TransactItems
        ).toHaveLength(2);


        const ledger =
          input
            .TransactItems?.[0]
            ?.Put;


        const pointer =
          input
            .TransactItems?.[1]
            ?.Put;


        expect(
          ledger
            ?.ConditionExpression
        ).toContain(
          "attribute_not_exists"
        );


        expect(
          pointer
            ?.ConditionExpression
        ).toContain(
          "attribute_not_exists"
        );


        expect(
          unmarshall(
            ledger?.Item || {}
          )
        ).toEqual(
          transition.ledger
        );


        expect(
          unmarshall(
            pointer?.Item || {}
          )
        ).toEqual(
          transition.pointer
        );
      }
    );


    test(
      "subsequent activation conditionally replaces only the exact previous pointer",
      () => {
        const first =
          firstTransition();


        const second =
          buildProfileActivationTransition({
            currentPointer:
              first.pointer,

            activationId:
              "act_second",

            profileVariantId:
              "prv_pune",

            activatedAt:
              "2026-08-22T11:00:00.000Z",

            contentSchemaVersion:
              1,

            contentHash:
              HASH_B,
          });


        const input =
          createProfileActivationTransaction({
            tableName:
              TABLE,

            transition:
              second,
          });


        const pointer =
          input
            .TransactItems?.[1]
            ?.Put;


        expect(
          pointer
            ?.ConditionExpression
        ).toContain(
          "#revision = :expectedRevision"
        );


        expect(
          pointer
            ?.ConditionExpression
        ).toContain(
          "#activationId = :expectedActivationId"
        );


        expect(
          pointer
            ?.ConditionExpression
        ).toContain(
          "#profileVariantId = :expectedProfileVariantId"
        );


        expect(
          pointer
            ?.ExpressionAttributeValues
            ?.[
              ":expectedRevision"
            ]
        ).toEqual({
          N:
            "1",
        });


        expect(
          pointer
            ?.ExpressionAttributeValues
            ?.[
              ":expectedActivationId"
            ]
        ).toEqual({
          S:
            "act_first",
        });


        expect(
          pointer
            ?.ExpressionAttributeValues
            ?.[
              ":expectedProfileVariantId"
            ]
        ).toEqual({
          S:
            "prv_dubai",
        });
      }
    );

    test(
      "activation transaction condition-checks the exact Active Platform pointer when a guard is supplied",
      () => {
        const platformPointer =
          buildPlatformDeploymentTransition({
            deploymentId:
              "pdep_guard",

            platformReleaseId:
              "plr_guard",

            deployedAt:
              "2026-08-22T09:00:00.000Z",

            platformReleaseSha256:
              "c".repeat(
                64
              ),
          }).pointer;


        const input =
          createProfileActivationTransaction({
            tableName:
              TABLE,

            transition:
              firstTransition(),

            platformGuard: {
              tableName:
                "unit-test-platform-deployments",

              pointer:
                platformPointer,
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
          "unit-test-platform-deployments"
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
          "#deploymentId = :expectedDeploymentId"
        );


        expect(
          guard
            ?.ConditionExpression
        ).toContain(
          "#platformReleaseId = :expectedPlatformReleaseId"
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
            ?.[":expectedDeploymentId"]
        ).toEqual({
          S:
            "pdep_guard",
        });


        expect(
          guard
            ?.ExpressionAttributeValues
            ?.[":expectedPlatformReleaseId"]
        ).toEqual({
          S:
            "plr_guard",
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
      "activation transaction condition-checks that Platform state remains absent when absence was observed",
      () => {
        const input =
          createProfileActivationTransaction({
            tableName:
              TABLE,

            transition:
              firstTransition(),

            platformGuard: {
              tableName:
                "unit-test-platform-deployments",

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
      "activation transaction contains only immutable ledger and pointer Put operations",
      () => {
        const input =
          createProfileActivationTransaction({
            tableName:
              TABLE,

            transition:
              firstTransition(),
          });


        const serialized =
          JSON.stringify(
            input
          );


        expect(
          serialized
        ).toContain(
          '"Put"'
        );


        expect(
          serialized
        ).not.toContain(
          '"Delete"'
        );


        expect(
          serialized
        ).not.toContain(
          '"Update"'
        );


        expect(
          serialized
        ).not.toContain(
          '"ConditionCheck"'
        );
      }
    );


    test(
      "transaction conflicts are classified without swallowing unrelated failures",
      () => {
        expect(
          isProfileActivationConflict({
            name:
              "TransactionCanceledException",
          })
        ).toBe(true);


        expect(
          isProfileActivationConflict({
            name:
              "TransactionConflictException",
          })
        ).toBe(true);


        expect(
          isProfileActivationConflict({
            name:
              "ConditionalCheckFailedException",
          })
        ).toBe(true);


        expect(
          isProfileActivationConflict({
            name:
              "AccessDeniedException",
          })
        ).toBe(false);
      }
    );
  }
);