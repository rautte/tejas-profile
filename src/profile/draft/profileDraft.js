// src/profile/draft/profileDraft.js

import {
  CURRENT_PROFILE_CONTENT_SCHEMA_VERSION,
  assertJsonCompatible,
  cloneJson,
  createProfileContent,
  validateProfileContent,
} from "../../utils/profileVariant";

import {
  CURRENT_PROFILE_DRAFT_SCHEMA_VERSION,
  PROFILE_DRAFT_DOCUMENT_SCHEMA,
  PROFILE_DRAFT_EDITABLE_FIELDS,
} from "./constants";


const ID_RE =
  /^[A-Za-z0-9._:-]+$/;


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


function cleanString(
  value
) {
  return String(
    value || ""
  ).trim();
}


function nullableId(
  value
) {
  const normalized =
    cleanString(
      value
    );

  return (
    normalized ||
    null
  );
}


function validId(
  value
) {
  const normalized =
    cleanString(
      value
    );

  return (
    normalized.length > 0 &&
    normalized.length <= 160 &&
    ID_RE.test(
      normalized
    )
  );
}


function validTimestamp(
  value
) {
  const normalized =
    cleanString(
      value
    );

  return (
    Boolean(
      normalized
    ) &&
    !Number.isNaN(
      Date.parse(
        normalized
      )
    )
  );
}


function normalizeTargeting(
  targeting = {}
) {
  const source =
    isPlainObject(
      targeting
    )
      ? targeting
      : {};

  return {
    location:
      cleanString(
        source.location
      ),

    jobRole:
      cleanString(
        source.jobRole
      ),
  };
}


function unknownKeys(
  object,
  allowed
) {
  if (
    !isPlainObject(
      object
    )
  ) {
    return [];
  }

  const allowedSet =
    new Set(
      allowed
    );

  return Object.keys(
    object
  ).filter(
    (key) =>
      !allowedSet.has(
        key
      )
  );
}


/**
 * Validates the mutable Profile Draft envelope.
 *
 * A Draft may have incomplete targeting metadata.
 * That makes it non-publishable, not structurally invalid.
 *
 * Draft content itself always uses the CURRENT canonical
 * Profile Content schema so the future Admin editor only
 * needs to understand one content representation.
 */
export function validateProfileDraft(
  draft
) {
  const errors = [];
  const warnings = [];

  try {
    assertJsonCompatible(
      draft
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
      draft
    )
  ) {
    errors.push(
      "Profile Draft must be an object."
    );

    return {
      valid: false,
      errors,
      warnings,
    };
  }


  const allowedFields = [
    "schema",
    "draftSchemaVersion",
    "draftId",
    "baseProfileVariantId",
    "revision",
    "contentSchemaVersion",
    "targeting",
    "content",
    "createdAt",
    "updatedAt",
  ];


  for (
    const key of
      unknownKeys(
        draft,
        allowedFields
      )
  ) {
    errors.push(
      `${key} is not a supported Profile Draft field.`
    );
  }


  if (
    draft.schema !==
      PROFILE_DRAFT_DOCUMENT_SCHEMA
  ) {
    errors.push(
      `schema must be "${PROFILE_DRAFT_DOCUMENT_SCHEMA}".`
    );
  }


  if (
    draft.draftSchemaVersion !==
      CURRENT_PROFILE_DRAFT_SCHEMA_VERSION
  ) {
    errors.push(
      `draftSchemaVersion must be ${CURRENT_PROFILE_DRAFT_SCHEMA_VERSION}.`
    );
  }


  if (
    !validId(
      draft.draftId
    )
  ) {
    errors.push(
      "draftId is required and may contain only letters, numbers, '.', '_', ':', or '-' and must be at most 160 characters."
    );
  }


  if (
    draft.baseProfileVariantId !==
      null &&
    draft.baseProfileVariantId !==
      undefined &&
    !validId(
      draft.baseProfileVariantId
    )
  ) {
    errors.push(
      "baseProfileVariantId must be null or a valid Profile Variant ID."
    );
  }


  if (
    !Number.isInteger(
      draft.revision
    ) ||
    draft.revision < 1
  ) {
    errors.push(
      "revision must be a positive integer."
    );
  }


  if (
    draft.contentSchemaVersion !==
      CURRENT_PROFILE_CONTENT_SCHEMA_VERSION
  ) {
    errors.push(
      `Profile Draft contentSchemaVersion must be the current schema v${CURRENT_PROFILE_CONTENT_SCHEMA_VERSION}.`
    );
  }


  if (
    !isPlainObject(
      draft.targeting
    )
  ) {
    errors.push(
      "targeting must be an object."
    );
  } else {
    for (
      const key of
        unknownKeys(
          draft.targeting,
          [
            "location",
            "jobRole",
          ]
        )
    ) {
      errors.push(
        `targeting.${key} is not supported.`
      );
    }


    if (
      typeof draft
        .targeting
        .location !==
        "string"
    ) {
      errors.push(
        "targeting.location must be a string."
      );
    }


    if (
      typeof draft
        .targeting
        .jobRole !==
        "string"
    ) {
      errors.push(
        "targeting.jobRole must be a string."
      );
    }
  }


  const contentValidation =
    validateProfileContent(
      draft.content
    );

  errors.push(
    ...contentValidation.errors
  );

  warnings.push(
    ...contentValidation.warnings
  );


  if (
    !validTimestamp(
      draft.createdAt
    )
  ) {
    errors.push(
      "createdAt must be a valid timestamp."
    );
  }


  if (
    !validTimestamp(
      draft.updatedAt
    )
  ) {
    errors.push(
      "updatedAt must be a valid timestamp."
    );
  }


  if (
    validTimestamp(
      draft.createdAt
    ) &&
    validTimestamp(
      draft.updatedAt
    ) &&
    Date.parse(
      draft.updatedAt
    ) <
      Date.parse(
        draft.createdAt
      )
  ) {
    errors.push(
      "updatedAt cannot be earlier than createdAt."
    );
  }


  return {
    valid:
      errors.length === 0,

    errors,

    warnings,
  };
}


/**
 * Draft validity and publish readiness are deliberately
 * separate concepts.
 *
 * A user should be able to save an incomplete draft.
 */
export function evaluateProfileDraftReadiness(
  draft
) {
  const validation =
    validateProfileDraft(
      draft
    );

  const missingTargeting =
    [];


  if (
    !cleanString(
      draft
        ?.targeting
        ?.location
    )
  ) {
    missingTargeting.push(
      "location"
    );
  }


  if (
    !cleanString(
      draft
        ?.targeting
        ?.jobRole
    )
  ) {
    missingTargeting.push(
      "jobRole"
    );
  }


  return {
    valid:
      validation.valid,

    publishable:
      validation.valid &&
      missingTargeting.length ===
        0,

    missingTargeting,

    errors:
      validation.errors,

    warnings:
      validation.warnings,
  };
}


/**
 * Creates a mutable Profile Draft.
 *
 * draftId is intentionally supplied by the caller.
 * Later the backend will generate it.
 *
 * createdAt / updatedAt are injectable so deterministic tests,
 * imports and server-side workflows do not depend on ambient time.
 */
export function createProfileDraft(
  {
    draftId,

    baseProfileVariantId =
      null,

    revision =
      1,

    contentSchemaVersion =
      CURRENT_PROFILE_CONTENT_SCHEMA_VERSION,

    targeting = {},

    content = {},

    createdAt,

    updatedAt,
  } = {}
) {
  const timestamp =
    cleanString(
      createdAt
    ) ||
    new Date()
      .toISOString();


  const document = {
    schema:
      PROFILE_DRAFT_DOCUMENT_SCHEMA,

    draftSchemaVersion:
      CURRENT_PROFILE_DRAFT_SCHEMA_VERSION,

    draftId:
      cleanString(
        draftId
      ),

    baseProfileVariantId:
      nullableId(
        baseProfileVariantId
      ),

    revision,

    contentSchemaVersion,

    targeting:
      normalizeTargeting(
        targeting
      ),

    content:
      createProfileContent(
        content
      ),

    createdAt:
      timestamp,

    updatedAt:
      cleanString(
        updatedAt
      ) ||
      timestamp,
  };


  const validation =
    validateProfileDraft(
      document
    );


  if (
    !validation.valid
  ) {
    throw new Error(
      [
        "Cannot create invalid Profile Draft.",
        ...validation.errors,
      ].join(" ")
    );
  }


  return document;
}


/**
 * Applies an owner-editable Draft patch with optimistic
 * concurrency control.
 *
 * Only targeting + content are editable.
 *
 * System-managed fields such as draftId, revision,
 * contentSchemaVersion and timestamps cannot be modified
 * through this function.
 */
export function updateProfileDraft(
  draft,
  patch,
  {
    expectedRevision,
    updatedAt,
  } = {}
) {
  const currentValidation =
    validateProfileDraft(
      draft
    );


  if (
    !currentValidation.valid
  ) {
    throw new Error(
      [
        "Cannot update invalid Profile Draft.",
        ...currentValidation.errors,
      ].join(" ")
    );
  }


  if (
    !Number.isInteger(
      expectedRevision
    ) ||
    expectedRevision < 1
  ) {
    throw new Error(
      "expectedRevision must be a positive integer."
    );
  }


  if (
    expectedRevision !==
      draft.revision
  ) {
    throw new Error(
      `Profile Draft revision conflict: expected ${expectedRevision}, current ${draft.revision}.`
    );
  }


  if (
    !isPlainObject(
      patch
    )
  ) {
    throw new Error(
      "Profile Draft patch must be an object."
    );
  }


  for (
    const key of
      Object.keys(
        patch
      )
  ) {
    if (
      !PROFILE_DRAFT_EDITABLE_FIELDS.includes(
        key
      )
    ) {
      throw new Error(
        `Profile Draft field "${key}" is system-managed and cannot be edited.`
      );
    }
  }


  let nextTargeting =
    cloneJson(
      draft.targeting
    );


  if (
    Object.prototype
      .hasOwnProperty
      .call(
        patch,
        "targeting"
      )
  ) {
    if (
      !isPlainObject(
        patch.targeting
      )
    ) {
      throw new Error(
        "Profile Draft targeting patch must be an object."
      );
    }


    nextTargeting =
      normalizeTargeting({
        ...draft.targeting,
        ...patch.targeting,
      });
  }


  let nextContent =
    cloneJson(
      draft.content
    );


  if (
    Object.prototype
      .hasOwnProperty
      .call(
        patch,
        "content"
      )
  ) {
    if (
      !isPlainObject(
        patch.content
      )
    ) {
      throw new Error(
        "Profile Draft content patch must be an object."
      );
    }


    nextContent =
      createProfileContent({
        ...draft.content,
        ...patch.content,
      });
  }


  const timestamp =
    cleanString(
      updatedAt
    ) ||
    new Date()
      .toISOString();


  const next = {
    ...cloneJson(
      draft
    ),

    targeting:
      nextTargeting,

    content:
      nextContent,

    revision:
      draft.revision +
      1,

    updatedAt:
      timestamp,
  };


  const nextValidation =
    validateProfileDraft(
      next
    );


  if (
    !nextValidation.valid
  ) {
    throw new Error(
      [
        "Profile Draft update produced an invalid Draft.",
        ...nextValidation.errors,
      ].join(" ")
    );
  }


  return next;
}