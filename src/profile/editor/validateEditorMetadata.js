// src/profile/editor/validateEditorMetadata.js

import {
  CURRENT_PROFILE_CONTENT_SCHEMA_VERSION,
  PROFILE_VARIANT_ASSET_KINDS,
  assertJsonCompatible,
} from "../../utils/profileVariant";

import {
  CURRENT_PROFILE_EDITOR_METADATA_VERSION,
  PROFILE_EDITOR_FIELD_KINDS,
  PROFILE_EDITOR_METADATA_DOCUMENT_SCHEMA,
} from "./constants";


function isPlainObject(
  value
) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return false;
  }

  const proto =
    Object.getPrototypeOf(
      value
    );

  return (
    proto === Object.prototype ||
    proto === null
  );
}


function nonEmpty(
  value
) {
  return Boolean(
    String(
      value || ""
    ).trim()
  );
}


function unknownKeys(
  object,
  allowed
) {
  if (
    !isPlainObject(object)
  ) {
    return [];
  }

  const allowedSet =
    new Set(allowed);

  return Object.keys(
    object
  ).filter(
    (key) =>
      !allowedSet.has(key)
  );
}


const FIELD_KEYS =
  Object.freeze([
    "path",
    "label",
    "kind",
    "description",
    "readOnly",
    "required",
    "requiredForPublish",
    "reorderable",
    "itemKey",
    "assetKinds",
    "options",
    "fields",
    "itemFields",
  ]);


function validateFieldList(
  fields,
  path,
  errors
) {
  if (
    !Array.isArray(fields)
  ) {
    errors.push(
      `${path} must be an array.`
    );

    return;
  }


  const seenPaths =
    new Set();


  fields.forEach(
    (
      field,
      index
    ) => {
      const fieldPath =
        `${path}[${index}]`;

      validateField(
        field,
        fieldPath,
        errors
      );


      if (
        isPlainObject(field) &&
        nonEmpty(field.path)
      ) {
        if (
          seenPaths.has(
            field.path
          )
        ) {
          errors.push(
            `${path} contains duplicate field path "${field.path}".`
          );
        }

        seenPaths.add(
          field.path
        );
      }
    }
  );
}


function validateField(
  field,
  path,
  errors
) {
  if (
    !isPlainObject(field)
  ) {
    errors.push(
      `${path} must be an object.`
    );

    return;
  }


  for (
    const key of
      unknownKeys(
        field,
        FIELD_KEYS
      )
  ) {
    errors.push(
      `${path}.${key} is not supported editor metadata.`
    );
  }


  if (
    !nonEmpty(
      field.path
    )
  ) {
    errors.push(
      `${path}.path is required.`
    );
  }


  if (
    !nonEmpty(
      field.label
    )
  ) {
    errors.push(
      `${path}.label is required.`
    );
  }


  if (
    !PROFILE_EDITOR_FIELD_KINDS
      .includes(
        field.kind
      )
  ) {
    errors.push(
      `${path}.kind "${field.kind}" is not supported.`
    );

    return;
  }


  for (
    const booleanField of [
      "readOnly",
      "required",
      "requiredForPublish",
      "reorderable",
    ]
  ) {
    if (
      field[
        booleanField
      ] !== undefined &&
      typeof field[
        booleanField
      ] !== "boolean"
    ) {
      errors.push(
        `${path}.${booleanField} must be a boolean.`
      );
    }
  }


  if (
    field.itemKey !==
      undefined &&
    !nonEmpty(
      field.itemKey
    )
  ) {
    errors.push(
      `${path}.itemKey must be a non-empty string when provided.`
    );
  }


  if (
    field.kind ===
      "object"
  ) {
    validateFieldList(
      field.fields,
      `${path}.fields`,
      errors
    );
  } else if (
    field.fields !==
      undefined
  ) {
    errors.push(
      `${path}.fields is only valid for object editors.`
    );
  }


  if (
    field.kind ===
      "collection"
  ) {
    validateFieldList(
      field.itemFields,
      `${path}.itemFields`,
      errors
    );
  } else if (
    field.itemFields !==
      undefined
  ) {
    errors.push(
      `${path}.itemFields is only valid for collection editors.`
    );
  }


  if (
    field.kind ===
      "asset"
  ) {
    if (
      !Array.isArray(
        field.assetKinds
      ) ||
      field.assetKinds.length ===
        0
    ) {
      errors.push(
        `${path}.assetKinds must contain at least one supported Profile Variant asset kind.`
      );
    } else {
      for (
        const assetKind of
          field.assetKinds
      ) {
        if (
          !PROFILE_VARIANT_ASSET_KINDS
            .includes(
              assetKind
            )
        ) {
          errors.push(
            `${path}.assetKinds contains unsupported asset kind "${assetKind}".`
          );
        }
      }
    }
  } else if (
    field.assetKinds !==
      undefined
  ) {
    errors.push(
      `${path}.assetKinds is only valid for asset editors.`
    );
  }


  if (
    field.kind ===
      "select"
  ) {
    if (
      !Array.isArray(
        field.options
      ) ||
      field.options.length ===
        0 ||
      field.options.some(
        (option) =>
          !nonEmpty(option)
      )
    ) {
      errors.push(
        `${path}.options must contain at least one non-empty option.`
      );
    }
  } else if (
    field.options !==
      undefined
  ) {
    errors.push(
      `${path}.options is only valid for select editors.`
    );
  }
}


export function validateProfileEditorMetadata(
  metadata
) {
  const errors = [];
  const warnings = [];


  try {
    assertJsonCompatible(
      metadata
    );
  } catch (error) {
    errors.push(
      String(
        error?.message ||
        error
      )
    );
  }


  if (
    !isPlainObject(
      metadata
    )
  ) {
    errors.push(
      "Profile Editor Metadata must be an object."
    );

    return {
      valid: false,
      errors,
      warnings,
    };
  }


  const allowedTopLevel = [
    "schema",
    "editorMetadataVersion",
    "contentSchemaVersion",
    "systemFields",
    "groups",
  ];


  for (
    const key of
      unknownKeys(
        metadata,
        allowedTopLevel
      )
  ) {
    errors.push(
      `${key} is not a supported Profile Editor Metadata field.`
    );
  }


  if (
    metadata.schema !==
      PROFILE_EDITOR_METADATA_DOCUMENT_SCHEMA
  ) {
    errors.push(
      `schema must be "${PROFILE_EDITOR_METADATA_DOCUMENT_SCHEMA}".`
    );
  }


  if (
    metadata.editorMetadataVersion !==
      CURRENT_PROFILE_EDITOR_METADATA_VERSION
  ) {
    errors.push(
      `editorMetadataVersion must be ${CURRENT_PROFILE_EDITOR_METADATA_VERSION}.`
    );
  }


  if (
    metadata.contentSchemaVersion !==
      CURRENT_PROFILE_CONTENT_SCHEMA_VERSION
  ) {
    errors.push(
      `Profile Editor Metadata must target current content schema v${CURRENT_PROFILE_CONTENT_SCHEMA_VERSION}.`
    );
  }


  validateFieldList(
    metadata.systemFields,
    "systemFields",
    errors
  );


  if (
    Array.isArray(
      metadata.systemFields
    )
  ) {
    for (
      const [
        index,
        field,
      ] of
        metadata
          .systemFields
          .entries()
    ) {
      if (
        field?.readOnly !==
          true
      ) {
        errors.push(
          `systemFields[${index}] must be readOnly.`
        );
      }
    }
  }


  if (
    !Array.isArray(
      metadata.groups
    )
  ) {
    errors.push(
      "groups must be an array."
    );
  } else {
    const seenIds =
      new Set();

    const seenPaths =
      new Set();


    metadata.groups.forEach(
      (
        group,
        index
      ) => {
        const path =
          `groups[${index}]`;


        if (
          !isPlainObject(
            group
          )
        ) {
          errors.push(
            `${path} must be an object.`
          );

          return;
        }


        if (
          !nonEmpty(
            group.id
          )
        ) {
          errors.push(
            `${path}.id is required.`
          );
        } else if (
          seenIds.has(
            group.id
          )
        ) {
          errors.push(
            `groups contains duplicate id "${group.id}".`
          );
        } else {
          seenIds.add(
            group.id
          );
        }


        const fieldShape = {
          ...group,
        };

        delete fieldShape.id;

        validateField(
          fieldShape,
          path,
          errors
        );


        if (
          nonEmpty(
            group.path
          )
        ) {
          if (
            seenPaths.has(
              group.path
            )
          ) {
            errors.push(
              `groups contains duplicate path "${group.path}".`
            );
          }

          seenPaths.add(
            group.path
          );
        }
      }
    );
  }


  return {
    valid:
      errors.length === 0,

    errors,

    warnings,
  };
}