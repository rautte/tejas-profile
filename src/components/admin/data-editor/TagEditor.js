// src/components/admin/data-editor/TagEditor.js

import {
  useState,
} from "react";


function moveItem(
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


/**
 * Reusable editor for a "string-list" field: an ordered list of
 * plain strings (highlights, tags, coursework, activities, ...).
 * Reordering is up/down buttons, not pointer drag-and-drop — a
 * real drag interaction plus its keyboard-accessible fallback is
 * explicitly a production-hardening concern (P14P), not this one.
 */
export function TagEditor({
  items,
  onChange,
}) {
  const [
    draft,
    setDraft,
  ] =
    useState("");

  const values =
    Array.isArray(
      items
    )
      ? items
      : [];

  function addTag() {
    const clean =
      draft.trim();

    if (!clean) {
      return;
    }

    onChange(
      [
        ...values,
        clean,
      ]
    );

    setDraft(
      ""
    );
  }

  function removeAt(
    index
  ) {
    onChange(
      values.filter(
        (
          _,
          i
        ) =>
          i !==
          index
      )
    );
  }

  function moveAt(
    index,
    direction
  ) {
    onChange(
      moveItem(
        values,
        index,
        direction
      )
    );
  }

  function editAt(
    index,
    nextValue
  ) {
    onChange(
      values.map(
        (
          existing,
          i
        ) =>
          i ===
          index
            ? nextValue
            : existing
      )
    );
  }

  return (
    <div className="space-y-2">
      {values.length ===
      0 ? (
        <div className="text-[11px] text-gray-400 dark:text-gray-500">
          No entries yet.
        </div>
      ) : (
        <ul className="space-y-1">
          {values.map(
            (
              value,
              index
            ) => (
              <li
                key={
                  index
                }
                className="flex items-center gap-2 rounded-lg border border-gray-200/70 dark:border-white/10 bg-white/60 dark:bg-white/5 px-2 py-1"
              >
                <input
                  type="text"
                  value={
                    value
                  }
                  onChange={(
                    e
                  ) =>
                    editAt(
                      index,
                      e
                        .target
                        .value
                    )
                  }
                  className="flex-1 h-7 rounded-md border border-transparent bg-transparent px-1 text-xs text-gray-800 dark:text-gray-200 outline-none focus:border-purple-500/40 focus:bg-white/80 dark:focus:bg-white/10"
                />

                <button
                  type="button"
                  disabled={
                    index ===
                    0
                  }
                  onClick={() =>
                    moveAt(
                      index,
                      -1
                    )
                  }
                  className="text-xs text-gray-500 dark:text-gray-400 disabled:opacity-30 hover:text-purple-600 dark:hover:text-purple-300"
                  title="Move up"
                  aria-label={`Move "${value}" up`}
                >
                  ↑
                </button>

                <button
                  type="button"
                  disabled={
                    index ===
                    values.length -
                      1
                  }
                  onClick={() =>
                    moveAt(
                      index,
                      1
                    )
                  }
                  className="text-xs text-gray-500 dark:text-gray-400 disabled:opacity-30 hover:text-purple-600 dark:hover:text-purple-300"
                  title="Move down"
                  aria-label={`Move "${value}" down`}
                >
                  ↓
                </button>

                <button
                  type="button"
                  onClick={() =>
                    removeAt(
                      index
                    )
                  }
                  className="text-xs text-red-600 dark:text-red-400 hover:underline"
                  aria-label={`Remove "${value}"`}
                >
                  Remove
                </button>
              </li>
            )
          )}
        </ul>
      )}

      <div className="flex gap-2">
        <input
          type="text"
          value={
            draft
          }
          onChange={(
            e
          ) =>
            setDraft(
              e
                .target
                .value
            )
          }
          onKeyDown={(
            e
          ) => {
            if (
              e.key ===
              "Enter"
            ) {
              e.preventDefault();

              addTag();
            }
          }}
          placeholder="Add an entry…"
          className="flex-1 h-8 rounded-lg border border-gray-200/70 dark:border-white/10 bg-white/80 dark:bg-white/10 px-2 text-xs text-gray-900 dark:text-gray-100 outline-none focus:ring-2 focus:ring-purple-500/30"
        />

        <button
          type="button"
          onClick={
            addTag
          }
          disabled={
            !draft.trim()
          }
          className="h-8 px-3 rounded-lg border border-purple-500/40 bg-purple-600 text-white text-xs font-semibold hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Add
        </button>
      </div>
    </div>
  );
}
