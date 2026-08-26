// infra/cdk/test/profile-activation-contract.test.ts

import {
  ACTIVE_PROFILE_POINTER_DOCUMENT_SCHEMA,
  PROFILE_ACTIVATION_ACTIVE_SK,
  PROFILE_ACTIVATION_CONTROL_PK,
  PROFILE_ACTIVATION_DOCUMENT_SCHEMA,
  PROFILE_ACTIVATION_LEDGER_PK,
  buildProfileActivationTransition,
  createActivationLedgerSortKey,
  createActivationVariantIndexPk,
  validateActiveProfilePointer,
  validateProfileActivationRecord,
} from "../lambda/profile-activation-contract";


const HASH_A =
  "a".repeat(
    64
  );

const HASH_B =
  "b".repeat(
    64
  );


describe(
  "Profile Activation contract",
  () => {
    test(
      "activation ledger keys are chronologically sortable",
      () => {
        expect(
          createActivationLedgerSortKey(
            "2026-08-22T10:00:00.000Z",
            "act_one"
          )
        ).toBe(
          "2026-08-22T10:00:00.000Z#act_one"
        );


        expect(
          createActivationLedgerSortKey(
            "2026-08-22T11:00:00.000Z",
            "act_two"
          ) >
            createActivationLedgerSortKey(
              "2026-08-22T10:00:00.000Z",
              "act_one"
            )
        ).toBe(true);
      }
    );


    test(
      "variant index groups repeated activations of the same Profile Variant",
      () => {
        expect(
          createActivationVariantIndexPk(
            "prv_dubai"
          )
        ).toBe(
          "VARIANT#prv_dubai"
        );
      }
    );


    test(
      "first activation creates revision one with no previous activation",
      () => {
        const out =
          buildProfileActivationTransition({
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


        expect(
          out.expectedPreviousRevision
        ).toBeNull();


        expect(
          out.pointer
        ).toEqual(
          expect.objectContaining({
            pk:
              PROFILE_ACTIVATION_CONTROL_PK,

            sk:
              PROFILE_ACTIVATION_ACTIVE_SK,

            schema:
              ACTIVE_PROFILE_POINTER_DOCUMENT_SCHEMA,

            revision:
              1,

            activationId:
              "act_first",

            profileVariantId:
              "prv_dubai",
          })
        );


        expect(
          out.ledger
        ).toEqual(
          expect.objectContaining({
            pk:
              PROFILE_ACTIVATION_LEDGER_PK,

            schema:
              PROFILE_ACTIVATION_DOCUMENT_SCHEMA,

            previousActivationId:
              null,

            previousProfileVariantId:
              null,
          })
        );
      }
    );


    test(
      "next activation increments revision and links to previous state",
      () => {
        const first =
          buildProfileActivationTransition({
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


        expect(
          second
            .expectedPreviousRevision
        ).toBe(1);


        expect(
          second
            .pointer
            .revision
        ).toBe(2);


        expect(
          second
            .ledger
            .previousActivationId
        ).toBe(
          "act_first"
        );


        expect(
          second
            .ledger
            .previousProfileVariantId
        ).toBe(
          "prv_dubai"
        );
      }
    );


    test(
      "same Profile Variant may be activated again as a new activation",
      () => {
        const first =
          buildProfileActivationTransition({
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


        const second =
          buildProfileActivationTransition({
            currentPointer:
              first.pointer,

            activationId:
              "act_second",

            profileVariantId:
              "prv_dubai",

            activatedAt:
              "2026-08-22T11:00:00.000Z",

            contentSchemaVersion:
              1,

            contentHash:
              HASH_A,
          });


        expect(
          second
            .pointer
            .profileVariantId
        ).toBe(
          "prv_dubai"
        );


        expect(
          second
            .pointer
            .activationId
        ).not.toBe(
          first
            .pointer
            .activationId
        );


        expect(
          second
            .pointer
            .revision
        ).toBe(2);
      }
    );


    test(
      "generated pointer and ledger independently validate",
      () => {
        const out =
          buildProfileActivationTransition({
            activationId:
              "act_valid",

            profileVariantId:
              "prv_valid",

            activatedAt:
              "2026-08-22T12:00:00.000Z",

            contentSchemaVersion:
              1,

            contentHash:
              HASH_A,
          });


        expect(
          validateActiveProfilePointer(
            out.pointer
          )
        ).toBe(true);


        expect(
          validateProfileActivationRecord(
            out.ledger
          )
        ).toBe(true);
      }
    );


    test(
      "non-canonical timestamps fail closed",
      () => {
        expect(
          () =>
            buildProfileActivationTransition({
              activationId:
                "act_bad_time",

              profileVariantId:
                "prv_test",

              activatedAt:
                "2026-08-22 12:00:00",

              contentSchemaVersion:
                1,

              contentHash:
                HASH_A,
            })
        ).toThrow(
          "canonical UTC ISO timestamp"
        );
      }
    );


    test(
      "invalid IDs, hashes and schema versions fail closed",
      () => {
        expect(
          () =>
            buildProfileActivationTransition({
              activationId:
                "../bad",

              profileVariantId:
                "prv_test",

              activatedAt:
                "2026-08-22T12:00:00.000Z",

              contentSchemaVersion:
                1,

              contentHash:
                HASH_A,
            })
        ).toThrow(
          "activationId is invalid"
        );


        expect(
          () =>
            buildProfileActivationTransition({
              activationId:
                "act_valid",

              profileVariantId:
                "prv_test",

              activatedAt:
                "2026-08-22T12:00:00.000Z",

              contentSchemaVersion:
                0,

              contentHash:
                HASH_A,
            })
        ).toThrow(
          "contentSchemaVersion"
        );


        expect(
          () =>
            buildProfileActivationTransition({
              activationId:
                "act_valid",

              profileVariantId:
                "prv_test",

              activatedAt:
                "2026-08-22T12:00:00.000Z",

              contentSchemaVersion:
                1,

              contentHash:
                "not-a-hash",
            })
        ).toThrow(
          "contentHash"
        );
      }
    );
  }
);