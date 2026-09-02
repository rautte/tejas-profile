// src/utils/snapshots/profileVariantId.js
//
// Profile Variant ID generation, shared between Snapshots'
// "publish under new targeting" flow and Admin -> Data's
// "publish this draft" flow, so both mint IDs in the exact
// same prv_<location>_<jobRole>_<timestamp> convention.

export function generateProfileVariantId() {
  const random =
    typeof crypto !==
      "undefined" &&
    typeof crypto
      .randomUUID ===
      "function"
      ? crypto
          .randomUUID()
          .replace(
            /-/g,
            ""
          )
          .slice(
            0,
            10
          )
      : Math.random()
          .toString(16)
          .slice(2, 12);

  return `prv_${Date.now().toString(36)}_${random}`;
}


export function slugify(
  value
) {
  return String(
    value || ""
  )
    .trim()
    .toLowerCase()
    .replace(
      /[^a-z0-9]+/g,
      "_"
    )
    .replace(
      /^_+|_+$/g,
      ""
    );
}


export function compactUtcTimestamp() {
  return new Date()
    .toISOString()
    .replace(
      /[-:]/g,
      ""
    )
    .replace(
      /\.\d{3}Z$/,
      "Z"
    );
}


/**
 * Suggests prv_<location>_<jobRole>_<timestamp>, matching the
 * existing hand-authored Profile Variant ID convention (e.g.
 * prv_bangalore_backend_infra_20260830T141157Z). Only a suggestion:
 * the owner can freely overwrite it, and once they do this stops
 * being recomputed for them.
 */
export function suggestProfileVariantId({
  location,
  jobRole,
}) {
  const parts =
    [
      slugify(
        location
      ),

      slugify(
        jobRole
      ),
    ].filter(
      Boolean
    );

  if (
    parts.length ===
    0
  ) {
    return null;
  }

  return `prv_${parts.join(
    "_"
  )}_${compactUtcTimestamp()}`;
}
