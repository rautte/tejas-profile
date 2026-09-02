// src/profile/draft/diffProfileContent.js

import {
  canonicalJsonStringify,
} from "../../utils/profileVariant";


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


/**
 * Recursively diffs two JSON-compatible values, returning a flat
 * list of leaf-level changes for a publish review UI.
 *
 * Objects and same-shaped arrays are walked key/index by key/index;
 * anything else (including a type change, e.g. an array replaced by
 * a differently-shaped array) is reported as one change at that
 * path rather than recursed into, since there is no meaningful
 * finer-grained alignment to walk.
 */
export function diffProfileContentValues(
  before,
  after,
  path = []
) {
  if (
    isPlainObject(
      before
    ) &&
    isPlainObject(
      after
    )
  ) {
    const keys =
      new Set(
        [
          ...Object.keys(
            before
          ),
          ...Object.keys(
            after
          ),
        ]
      );

    return Array.from(
      keys
    ).flatMap(
      (
        key
      ) =>
        diffProfileContentValues(
          before[
            key
          ],
          after[
            key
          ],
          [
            ...path,
            key,
          ]
        )
    );
  }

  if (
    Array.isArray(
      before
    ) &&
    Array.isArray(
      after
    )
  ) {
    const maxLength =
      Math.max(
        before.length,
        after.length
      );

    const changes = [];

    for (
      let index = 0;
      index <
      maxLength;
      index++
    ) {
      changes.push(
        ...diffProfileContentValues(
          before[
            index
          ],
          after[
            index
          ],
          [
            ...path,
            index,
          ]
        )
      );
    }

    return changes;
  }

  if (
    canonicalJsonStringify(
      before ??
        null
    ) ===
    canonicalJsonStringify(
      after ??
        null
    )
  ) {
    return [];
  }

  return [
    {
      path,

      before,

      after,
    },
  ];
}


/**
 * Renders a diff path like ["experience", 0, "highlights", 1] as
 * "experience[0].highlights[1]" for a human-readable review UI.
 */
export function formatDiffPath(
  path
) {
  return path.reduce(
    (
      label,
      segment,
      index
    ) => {
      if (
        typeof segment ===
        "number"
      ) {
        return `${label}[${segment}]`;
      }

      return index === 0
        ? String(
            segment
          )
        : `${label}.${segment}`;
    },
    ""
  );
}
