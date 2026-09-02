// src/utils/snapshots/profileVariantCatalog.js

function cleanString(
  value
) {
  return String(
    value ?? ""
  ).trim();
}


/**
 * Fetches every published Profile Variant by walking loadPage's
 * pagination to completion. Shared between Analytics (filter
 * catalog) and the Profile Variant publication panel (ID/targeting
 * autocomplete) so both see the exact same variants.
 */
export async function loadCompleteProfileVariantCatalog(
  loadPage
) {
  if (
    typeof loadPage !==
    "function"
  ) {
    throw new Error(
      "Profile Variant catalog loader is unavailable."
    );
  }


  const variants =
    [];

  const seenTokens =
    new Set();

  let nextToken =
    undefined;


  for (
    let page = 0;
    page < 100;
    page += 1
  ) {
    const result =
      await loadPage({
        limit:
          50,

        ...(nextToken
          ? {
              nextToken,
            }
          : {}),
      });


    if (
      Array.isArray(
        result
          ?.variants
      )
    ) {
      variants.push(
        ...result
          .variants
      );
    }


    const next =
      cleanString(
        result
          ?.nextToken
      );


    if (!next) {
      return variants;
    }


    if (
      seenTokens.has(
        next
      )
    ) {
      throw new Error(
        "Profile Variant catalog pagination repeated a nextToken."
      );
    }


    seenTokens.add(
      next
    );

    nextToken =
      next;
  }


  throw new Error(
    "Profile Variant catalog exceeded the pagination safety limit."
  );
}


/**
 * Unique, sorted values for a given targeting field (location or
 * jobRole) across a Profile Variant catalog — used to power
 * autocomplete so re-targeting reuses exact prior wording instead
 * of drifting ("Backend Infra" vs "Backend Infrastructure").
 */
export function uniqueProfileTargetingValuesFromCatalog(
  variants,
  key
) {
  const seen =
    new Set();

  for (
    const variant of
      Array.isArray(
        variants
      )
        ? variants
        : []
  ) {
    const value =
      cleanString(
        variant
          ?.targeting
          ?.[key]
      );

    if (value) {
      seen.add(
        value
      );
    }
  }

  return Array.from(
    seen
  ).sort(
    (
      a,
      b
    ) =>
      a.localeCompare(
        b
      )
  );
}
