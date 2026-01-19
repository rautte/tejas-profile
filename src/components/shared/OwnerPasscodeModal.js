import { useEffect, useRef, useState } from "react";
import { cx } from "../../utils/cx";

export default function OwnerPasscodeModal({ open, onClose, onSubmit, error }) {
  const [value, setValue] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setValue("");
    // focus after mount
    setTimeout(() => inputRef.current?.focus?.(), 0);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onKey = (e) => {
        if (e.key === "Escape") onClose?.();
        if (e.key === "Enter") onSubmit?.(value.trim());
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, value, onClose, onSubmit]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center px-4">
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-md"
      />

      <div
        className={cx(
          "relative w-full max-w-md rounded-2xl border",
          "border-gray-200/70 dark:border-white/10",
          "bg-white/90 dark:bg-[#0b0b12]/90 backdrop-blur-xl shadow-2xl overflow-hidden"
        )}
      >
        <div className="px-5 py-4 border-b border-gray-200/70 dark:border-white/10">
          <div className="text-base font-semibold text-gray-900 dark:text-gray-100">
            Enter owner passcode
          </div>
          <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            This enables admin sections for this session only.
          </div>
        </div>

        <div className="px-5 py-4">
          <input
            ref={inputRef}
            type="password"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
                if (e.key === "Escape") onClose?.();
                if (e.key === "Enter") onSubmit?.(value.trim());
            }}
            placeholder="Passcode"
            className="
              w-full rounded-xl px-4 py-3
              bg-white/70 dark:bg-white/5
              border border-gray-200/70 dark:border-white/10
              text-gray-900 dark:text-gray-100
              outline-none focus:ring-2 focus:ring-purple-500/50
            "
            autoComplete="current-password"
          />
          {error && (
            <div className="mt-2 text-sm text-red-500">
                {error}
            </div>
            )}
        </div>

        <div className="px-5 py-4 border-t border-gray-200/70 dark:border-white/10 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="
              px-4 py-2 rounded-lg text-sm font-semibold
              border border-gray-300/70 dark:border-white/10
              bg-gray-50/80 dark:bg-white/10
              text-gray-800 dark:text-gray-100
              hover:bg-gray-100/80 dark:hover:bg-white/15
            "
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={() => onSubmit?.(value.trim())}
            disabled={!value.trim()}
            className="
              px-4 py-2 rounded-lg text-sm font-semibold
              border border-purple-500/40
              bg-purple-600 text-white hover:bg-purple-700
              disabled:opacity-60 disabled:cursor-not-allowed
            "
          >
            Unlock
          </button>
        </div>
      </div>
    </div>
  );
}
