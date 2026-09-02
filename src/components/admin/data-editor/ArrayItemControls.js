// src/components/admin/data-editor/ArrayItemControls.js

/**
 * Reusable move-up / move-down / remove row for one item inside a
 * collection field (Experience, Education, Projects, ...). Buttons,
 * not pointer drag-and-drop — see TagEditor for why.
 */
export function ArrayItemControls({
  index,
  count,
  onMoveUp,
  onMoveDown,
  onRemove,
  itemLabel =
    "entry",
}) {
  return (
    <div className="flex items-center justify-end gap-3 pt-1 border-t border-gray-200/70 dark:border-white/10 mt-2">
      <button
        type="button"
        disabled={
          index ===
          0
        }
        onClick={
          onMoveUp
        }
        className="text-xs text-gray-500 dark:text-gray-400 disabled:opacity-30 hover:text-purple-600 dark:hover:text-purple-300"
        title="Move up"
        aria-label={`Move ${itemLabel} up`}
      >
        ↑ Move up
      </button>

      <button
        type="button"
        disabled={
          index ===
          count -
            1
        }
        onClick={
          onMoveDown
        }
        className="text-xs text-gray-500 dark:text-gray-400 disabled:opacity-30 hover:text-purple-600 dark:hover:text-purple-300"
        title="Move down"
        aria-label={`Move ${itemLabel} down`}
      >
        ↓ Move down
      </button>

      <button
        type="button"
        onClick={
          onRemove
        }
        className="text-xs text-red-600 dark:text-red-400 hover:underline"
        aria-label={`Remove ${itemLabel}`}
      >
        Remove
      </button>
    </div>
  );
}
