// src/utils/profileVariant/canonicalJson.js

import {
  assertJsonCompatible,
} from "./json";


function canonicalizeValue(
  value
) {
  if (
    value === null ||
    typeof value !== "object"
  ) {
    return value;
  }


  if (
    Array.isArray(
      value
    )
  ) {
    return value.map(
      canonicalizeValue
    );
  }


  const normalized =
    {};

  for (
    const key of
      Object.keys(value)
        .sort()
  ) {
    normalized[key] =
      canonicalizeValue(
        value[key]
      );
  }


  return normalized;
}


/**
 * Deterministic JSON serialization.
 *
 * Object keys are sorted recursively.
 * Array order is intentionally preserved because ordering can
 * be recruiter-visible and therefore semantically meaningful.
 */
export function canonicalJsonStringify(
  value
) {
  assertJsonCompatible(
    value
  );

  return JSON.stringify(
    canonicalizeValue(
      value
    )
  );
}