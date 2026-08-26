// src/utils/profileVariant/schemaRegistry.test.js

import {
  CURRENT_PROFILE_CONTENT_SCHEMA_VERSION,
  PROFILE_VARIANT_DOCUMENT_SCHEMA,
  PROFILE_VARIANT_SCHEMA_V1,
  assertCurrentProfileVariantSchemaRegistered,
  getProfileVariantSchema,
  hasProfileVariantSchema,
  listProfileVariantSchemaVersions,
  PROFILE_VARIANT_SCHEMA_ID_V1,
} from ".";


describe(
  "Profile Variant schema registry",
  () => {
    test(
      "registers schema v1 as the current schema",
      () => {
        expect(
          CURRENT_PROFILE_CONTENT_SCHEMA_VERSION
        ).toBe(1);

        expect(
          getProfileVariantSchema(
            1
          )
        ).toBe(
          PROFILE_VARIANT_SCHEMA_V1
        );

        expect(
          hasProfileVariantSchema(
            1
          )
        ).toBe(true);

        expect(
          listProfileVariantSchemaVersions()
        ).toEqual([
          1,
        ]);
      }
    );


    test(
      "schema v1 declares the canonical document identity and version",
      () => {
        expect(
          PROFILE_VARIANT_SCHEMA_V1
            .properties
            .schema
            .const
        ).toBe(
          PROFILE_VARIANT_DOCUMENT_SCHEMA
        );

        expect(
          PROFILE_VARIANT_SCHEMA_V1
            .properties
            .contentSchemaVersion
            .const
        ).toBe(1);

        expect(
          PROFILE_VARIANT_SCHEMA_V1
            .$id
          ).toBe(
          PROFILE_VARIANT_SCHEMA_ID_V1
        );


        expect(
          PROFILE_VARIANT_SCHEMA_V1
            .properties
            .schemaId
            .const
          ).toBe(
          PROFILE_VARIANT_SCHEMA_ID_V1
        );
      }
    );


    test(
      "unknown or invalid schema versions fail closed",
      () => {
        expect(
          getProfileVariantSchema(
            999
          )
        ).toBeNull();

        expect(
          getProfileVariantSchema(
            0
          )
        ).toBeNull();

        expect(
          getProfileVariantSchema(
            "invalid"
          )
        ).toBeNull();

        expect(
          hasProfileVariantSchema(
            999
          )
        ).toBe(false);
      }
    );


    test(
      "current platform schema is guaranteed to be registered",
      () => {
        expect(
          assertCurrentProfileVariantSchemaRegistered()
        ).toBe(
          PROFILE_VARIANT_SCHEMA_V1
        );
      }
    );


    test(
      "schema registry definitions remain JSON serializable",
      () => {
        const serialized =
          JSON.stringify(
            PROFILE_VARIANT_SCHEMA_V1
          );

        expect(
          typeof serialized
        ).toBe(
          "string"
        );

        expect(
          JSON.parse(
            serialized
          )
        ).toMatchObject({
          $id:
            "tejas-profile.profile-variant.v1",

          type:
            "object",
        });
      }
    );
  }
);