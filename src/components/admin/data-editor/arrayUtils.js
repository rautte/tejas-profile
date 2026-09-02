// src/components/admin/data-editor/arrayUtils.js

export function moveArrayIndex(
  items,
  index,
  direction
) {
  const target =
    index +
    direction;

  if (
    target < 0 ||
    target >=
      items.length
  ) {
    return items;
  }

  const next =
    items.slice();

  const [
    moved,
  ] =
    next.splice(
      index,
      1
    );

  next.splice(
    target,
    0,
    moved
  );

  return next;
}


export function removeArrayIndex(
  items,
  index
) {
  return items.filter(
    (
      _,
      i
    ) =>
      i !==
      index
  );
}


function defaultValueForKind(
  kind
) {
  switch (
    kind
  ) {
    case "boolean":
      return false;

    case "number":
      return null;

    case "collection":
    case "string-list":
    case "record-string-list":
      return [];

    default:
      return "";
  }
}


/**
 * Builds a blank record matching a collection's itemFields, so
 * "Add" produces a structurally valid item rather than an empty
 * object the schema-aware renderer can't display fields for.
 */
export function createEmptyCollectionItem(
  itemFields,
  itemKey
) {
  const item =
    {};

  for (
    const field of
      itemFields ||
      []
  ) {
    if (
      field.kind ===
        "object" &&
      Array.isArray(
        field.fields
      )
    ) {
      item[
        field.path
      ] =
        createEmptyCollectionItem(
          field.fields
        );

      continue;
    }

    item[
      field.path
    ] =
      defaultValueForKind(
        field.kind
      );
  }

  if (
    itemKey
  ) {
    item[
      itemKey
    ] = `${itemKey}_${Date.now().toString(
      36
    )}_${Math.random()
      .toString(16)
      .slice(2, 8)}`;
  }

  return item;
}
