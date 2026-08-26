// src/utils/profileVariant/json.js

function pathFor(
  parent,
  child
) {
  if (
    typeof child === "number"
  ) {
    return `${parent}[${child}]`;
  }

  return (
    parent === "$"
      ? `$.${child}`
      : `${parent}.${child}`
  );
}


function isPlainObject(
  value
) {
  if (
    !value ||
    typeof value !== "object"
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
 * Ensures a value can be safely represented as deterministic
 * JSON-like profile content.
 *
 * Intentionally rejects:
 * - undefined
 * - functions
 * - symbols
 * - bigint
 * - NaN / Infinity
 * - Date / Map / Set / class instances
 * - circular references
 *
 * React elements are also rejected because they contain
 * non-JSON Symbol metadata.
 */
export function assertJsonCompatible(
  value,
  {
    path = "$",
  } = {}
) {
  const active =
    new WeakSet();

  function walk(
    current,
    currentPath
  ) {
    if (current === null) {
      return;
    }

    const type =
      typeof current;

    if (
      type === "string" ||
      type === "boolean"
    ) {
      return;
    }

    if (type === "number") {
      if (
        !Number.isFinite(
          current
        )
      ) {
        throw new Error(
          `${currentPath} contains a non-finite number.`
        );
      }

      return;
    }

    if (
      type === "undefined" ||
      type === "function" ||
      type === "symbol" ||
      type === "bigint"
    ) {
      throw new Error(
        `${currentPath} contains unsupported JSON value type "${type}".`
      );
    }

    if (type !== "object") {
      throw new Error(
        `${currentPath} contains unsupported value type "${type}".`
      );
    }

    if (
      active.has(
        current
      )
    ) {
      throw new Error(
        `${currentPath} contains a circular reference.`
      );
    }

    active.add(
      current
    );

    try {
      if (
        Array.isArray(
          current
        )
      ) {
        current.forEach(
          (
            item,
            index
          ) => {
            walk(
              item,
              pathFor(
                currentPath,
                index
              )
            );
          }
        );

        return;
      }

      if (
        !isPlainObject(
          current
        )
      ) {
        throw new Error(
          `${currentPath} must contain only plain objects and arrays.`
        );
      }

      for (
        const [
          key,
          child,
        ] of Object.entries(
          current
        )
      ) {
        walk(
          child,
          pathFor(
            currentPath,
            key
          )
        );
      }
    } finally {
      active.delete(
        current
      );
    }
  }

  walk(
    value,
    path
  );

  return true;
}


/**
 * Deep clone for Profile Variant documents.
 *
 * Validation occurs first so JSON.stringify cannot silently
 * discard unsupported values.
 */
export function cloneJson(
  value
) {
  assertJsonCompatible(
    value
  );

  return JSON.parse(
    JSON.stringify(
      value
    )
  );
}