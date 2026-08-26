// src/profile/editor/editorMetadata.test.js

import {
  PROFILE_CONTENT_FIELDS,
  PROFILE_VARIANT_ASSET_KINDS,
  assertJsonCompatible,
} from "../../utils/profileVariant";

import {
  CURRENT_PROFILE_EDITOR_METADATA_VERSION,
  PROFILE_EDITOR_METADATA,
  PROFILE_EDITOR_METADATA_DOCUMENT_SCHEMA,
  getProfileEditorGroup,
  getProfileEditorMetadata,
  validateProfileEditorMetadata,
} from ".";


function collectFields(
  descriptor
) {
  const fields = [];


  function walk(
    field
  ) {
    fields.push(
      field
    );


    if (
      Array.isArray(
        field.fields
      )
    ) {
      field.fields.forEach(
        walk
      );
    }


    if (
      Array.isArray(
        field.itemFields
      )
    ) {
      field.itemFields.forEach(
        walk
      );
    }
  }


  PROFILE_EDITOR_METADATA
    .groups
    .forEach(
      walk
    );


  return fields;
}


describe(
  "Profile Editor Metadata contract",
  () => {
    test(
      "current editor metadata is valid",
      () => {
        const result =
          validateProfileEditorMetadata(
            PROFILE_EDITOR_METADATA
          );


        expect(
          result.valid
        ).toBe(true);

        expect(
          result.errors
        ).toEqual([]);
      }
    );


    test(
      "editor metadata is a versioned JSON-compatible document",
      () => {
        expect(
          PROFILE_EDITOR_METADATA
            .schema
        ).toBe(
          PROFILE_EDITOR_METADATA_DOCUMENT_SCHEMA
        );


        expect(
          PROFILE_EDITOR_METADATA
            .editorMetadataVersion
        ).toBe(
          CURRENT_PROFILE_EDITOR_METADATA_VERSION
        );


        expect(
          () =>
            assertJsonCompatible(
              PROFILE_EDITOR_METADATA
            )
        ).not.toThrow();
      }
    );


    test(
      "every canonical Profile Content field has exactly one editor group",
      () => {
        const contentGroups =
          PROFILE_EDITOR_METADATA
            .groups
            .filter(
              (group) =>
                group.path
                  .startsWith(
                    "content."
                  )
            )
            .map(
              (group) =>
                group.path
                  .slice(
                    "content."
                      .length
                  )
            );


        expect(
          contentGroups
        ).toEqual(
          PROFILE_CONTENT_FIELDS
        );
      }
    );


    test(
      "target Location and Job Role are required for publish",
      () => {
        const targeting =
          getProfileEditorGroup(
            "targeting"
          );


        const location =
          targeting.fields
            .find(
              (field) =>
                field.path ===
                "location"
            );

        const jobRole =
          targeting.fields
            .find(
              (field) =>
                field.path ===
                "jobRole"
            );


        expect(
          location
            .requiredForPublish
        ).toBe(true);

        expect(
          jobRole
            .requiredForPublish
        ).toBe(true);
      }
    );


    test(
      "all Draft system fields are read-only",
      () => {
        expect(
          PROFILE_EDITOR_METADATA
            .systemFields
            .length
        ).toBeGreaterThan(0);


        for (
          const field of
            PROFILE_EDITOR_METADATA
              .systemFields
        ) {
          expect(
            field.readOnly
          ).toBe(true);
        }


        const systemPaths =
          PROFILE_EDITOR_METADATA
            .systemFields
            .map(
              (field) =>
                field.path
            );


        expect(
          systemPaths
        ).toEqual(
          expect.arrayContaining([
            "draftId",
            "baseProfileVariantId",
            "revision",
            "contentSchemaVersion",
            "createdAt",
            "updatedAt",
          ])
        );
      }
    );


    test(
      "stable identifiers that participate in platform behavior remain read-only",
      () => {
        const hero =
          getProfileEditorGroup(
            "hero"
          );

        const rotatingTitles =
          hero.fields.find(
            (field) =>
              field.path ===
              "rotatingTitles"
          );

        expect(
          rotatingTitles
            .itemFields
            .find(
              (field) =>
                field.path ===
                "id"
            )
            .readOnly
        ).toBe(true);


        for (
          const groupId of [
            "projects",
            "codeLab",
          ]
        ) {
          const group =
            getProfileEditorGroup(
              groupId
            );

          expect(
            group
              .itemFields
              .find(
                (field) =>
                  field.path ===
                  "id"
              )
              .readOnly
          ).toBe(true);
        }


        const funZone =
          getProfileEditorGroup(
            "funZone"
          );

        const games =
          funZone.fields.find(
            (field) =>
              field.path ===
              "games"
          );

        expect(
          games
            .itemFields
            .find(
              (field) =>
                field.path ===
                "id"
            )
            .readOnly
        ).toBe(true);


        const contacts =
          getProfileEditorGroup(
            "contactLinks"
          );

        expect(
          contacts
            .itemFields
            .find(
              (field) =>
                field.path ===
                "key"
            )
            .readOnly
        ).toBe(true);
      }
    );


    test(
      "asset editors only reference supported Profile Variant asset kinds",
      () => {
        const fields =
          collectFields();


        const assetFields =
          fields.filter(
            (field) =>
              field.kind ===
              "asset"
          );


        expect(
          assetFields.length
        ).toBeGreaterThan(0);


        for (
          const field of
            assetFields
        ) {
          expect(
            field.assetKinds
              .length
          ).toBeGreaterThan(0);


          for (
            const assetKind of
              field.assetKinds
          ) {
            expect(
              PROFILE_VARIANT_ASSET_KINDS
            ).toContain(
              assetKind
            );
          }
        }
      }
    );


    test(
      "metadata getters return independent copies",
      () => {
        const first =
          getProfileEditorMetadata();

        const second =
          getProfileEditorMetadata();


        expect(
          first
        ).toEqual(
          second
        );

        expect(
          first
        ).not.toBe(
          second
        );


        first
          .groups[0]
          .label =
          "Changed";


        expect(
          second
            .groups[0]
            .label
        ).not.toBe(
          "Changed"
        );


        expect(
          PROFILE_EDITOR_METADATA
            .groups[0]
            .label
        ).not.toBe(
          "Changed"
        );
      }
    );


    test(
      "validator fails closed for malformed editor metadata",
      () => {
        const broken =
          getProfileEditorMetadata();


        broken
          .groups[0]
          .fields[0]
          .kind =
          "made-up-editor";


        const result =
          validateProfileEditorMetadata(
            broken
          );


        expect(
          result.valid
        ).toBe(false);

        expect(
          result.errors.some(
            (error) =>
              error.includes(
                'kind "made-up-editor" is not supported'
              )
          )
        ).toBe(true);
      }
    );
  }
);