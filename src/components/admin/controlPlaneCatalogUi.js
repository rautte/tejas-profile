// src/components/admin/controlPlaneCatalogUi.js

import {
  cx,
} from "../../utils/cx";


export function cleanString(
  value
) {
  return String(
    value ??
      ""
  ).trim();
}


export function displayValue(
  value
) {
  const cleaned =
    cleanString(
      value
    );


  return cleaned ||
    "—";
}


export function formatTimestamp(
  value
) {
  const cleaned =
    cleanString(
      value
    );


  if (!cleaned) {
    return "—";
  }


  const time =
    Date.parse(
      cleaned
    );


  if (
    Number.isNaN(
      time
    )
  ) {
    return cleaned;
  }


  return new Date(
    time
  ).toLocaleString();
}


export function targetingLabel(
  targeting
) {
  const parts =
    [
      cleanString(
        targeting
          ?.location
      ),

      cleanString(
        targeting
          ?.jobRole
      ),
    ].filter(
      Boolean
    );


  return parts.length
    ? parts.join(
        " · "
      )
    : "—";
}


export function ppsLabel(
  ppsVersion
) {
  return Number.isInteger(
    ppsVersion
  )
    ? `PPS ${ppsVersion}`
    : "Unqualified / historical";
}


export function SmallButton({
  children,
  onClick,
  disabled =
    false,
  variant =
    "neutral",
  title,
}) {
  const style =
    variant ===
      "purple"
      ? "border-purple-500/40 bg-purple-600 text-white hover:bg-purple-700"
      : "border-gray-300/70 dark:border-white/10 bg-gray-50/80 dark:bg-white/10 text-gray-800 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-white/15";


  return (
    <button
      type="button"
      onClick={
        onClick
      }
      disabled={
        disabled
      }
      title={
        title
      }
      className={cx(
        "inline-flex items-center justify-center px-3 py-2 rounded-lg",
        "text-xs font-semibold border transition shadow-sm",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        style
      )}
    >
      {children}
    </button>
  );
}


export function Badge({
  children,
  tone =
    "neutral",
}) {
  const style =
    tone ===
      "active"
      ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-800 dark:text-emerald-300"
      : tone ===
        "purple"
      ? "border-purple-500/30 bg-purple-500/10 text-purple-800 dark:text-purple-300"
      : tone ===
        "warning"
      ? "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300"
      : tone ===
        "danger"
      ? "border-red-500/30 bg-red-500/10 text-red-800 dark:text-red-300"
      : "border-gray-300/60 dark:border-white/10 bg-gray-100/80 dark:bg-white/5 text-gray-700 dark:text-gray-300";


  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full border px-2 py-0.5",
        "text-[10px] font-semibold whitespace-nowrap",
        style
      )}
    >
      {children}
    </span>
  );
}


export function HistoryLinkButton({
  children,
  onClick,
  title,
}) {
  return (
    <button
      type="button"
      onClick={
        onClick
      }
      title={
        title
      }
      className={cx(
        "font-mono text-[11px]",
        "text-purple-700 dark:text-purple-300",
        "hover:underline break-all text-left"
      )}
    >
      {children}
    </button>
  );
}


export function MetadataRow({
  label,
  value,
  mono =
    false,
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[180px_minmax(0,1fr)] gap-1 sm:gap-3">
      <div className="text-xs font-semibold text-gray-500 dark:text-gray-400">
        {label}
      </div>

      <div
        className={cx(
          "text-xs text-gray-800 dark:text-gray-200 break-words",
          mono
            ? "font-mono"
            : ""
        )}
      >
        {displayValue(
          value
        )}
      </div>
    </div>
  );
}


export function HistorySection({
  title,
  subtitle,
  children,
  nextToken,
  busy,
  onLoadMore,
}) {
  return (
    <div className="rounded-xl border border-gray-200/70 dark:border-white/10 overflow-hidden">
      <div className="px-4 py-3 bg-gray-100/70 dark:bg-white/5 border-b border-gray-200/70 dark:border-white/10">
        <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {title}
        </div>

        {subtitle ? (
          <div className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
            {subtitle}
          </div>
        ) : null}
      </div>

      <div>
        {children}
      </div>

      {nextToken ? (
        <div className="px-4 py-3 border-t border-gray-200/70 dark:border-white/10">
          <SmallButton
            onClick={
              onLoadMore
            }
            disabled={
              busy
            }
          >
            {busy
              ? "Loading…"
              : "Load more"}
          </SmallButton>
        </div>
      ) : null}
    </div>
  );
}