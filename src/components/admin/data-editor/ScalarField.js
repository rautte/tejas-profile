// src/components/admin/data-editor/ScalarField.js

import {
  cx,
} from "../../../utils/cx";


export const EDITABLE_SCALAR_KINDS =
  new Set([
    "text",
    "textarea",
    "number",
    "boolean",
    "url",
    "email",
    "phone",
  ]);


export const EDITABLE_INPUT_CLASS =
  "w-full h-9 rounded-lg border border-gray-200/70 dark:border-white/10 bg-white/80 dark:bg-white/10 px-3 text-xs text-gray-900 dark:text-gray-100 outline-none focus:ring-2 focus:ring-purple-500/30";


/**
 * Reusable editable control for a single PROFILE_EDITOR_METADATA
 * scalar field. Every section editor (Data.js today, future
 * section-specific editors) shares this so validation/error/hint
 * conventions and dirty tracking only live in one place.
 */
export function ScalarField({
  field,
  value,
  onChange,
}) {
  if (
    field.kind ===
    "textarea"
  ) {
    return (
      <textarea
        rows={
          3
        }
        value={
          value ??
          ""
        }
        onChange={(
          e
        ) =>
          onChange(
            e
              .target
              .value
          )
        }
        className={cx(
          EDITABLE_INPUT_CLASS,
          "h-auto py-2"
        )}
      />
    );
  }

  if (
    field.kind ===
    "boolean"
  ) {
    return (
      <label className="inline-flex items-center gap-2 text-xs text-gray-800 dark:text-gray-200">
        <input
          type="checkbox"
          checked={Boolean(
            value
          )}
          onChange={(
            e
          ) =>
            onChange(
              e
                .target
                .checked
            )
          }
        />

        {value
          ? "Yes"
          : "No"}
      </label>
    );
  }

  if (
    field.kind ===
    "number"
  ) {
    return (
      <input
        type="number"
        value={
          value ??
          ""
        }
        onChange={(
          e
        ) =>
          onChange(
            e
              .target
              .value ===
            ""
              ? ""
              : Number(
                  e
                    .target
                    .value
                )
          )
        }
        className={
          EDITABLE_INPUT_CLASS
        }
      />
    );
  }

  const inputType =
    field.kind ===
    "url"
      ? "url"
      : field.kind ===
        "email"
        ? "email"
        : field.kind ===
          "phone"
          ? "tel"
          : "text";

  return (
    <input
      type={
        inputType
      }
      value={
        value ??
        ""
      }
      onChange={(
        e
      ) =>
        onChange(
          e
            .target
            .value
        )
      }
      className={
        EDITABLE_INPUT_CLASS
      }
    />
  );
}
