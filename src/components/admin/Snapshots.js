// src/components/admin/Snapshots.js


import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { HiOutlineEye, HiPencilAlt, HiOutlineClipboardCopy, HiOutlineDownload, HiOutlineArrowsExpand } from "react-icons/hi";
import { FaRegSave } from "react-icons/fa";
import { HiStar } from "react-icons/hi2";

import SectionHeader from "../shared/SectionHeader";
import { cx } from "../../utils/cx";
import { CARD_SURFACE, CARD_ROUNDED_2XL } from "../../utils/ui";

import {
  listSnapshots,
  fetchSnapshotJson,
  deleteSnapshot,
  restoreSnapshot,
  listTrashSnapshots,
  triggerDeploy,
  getDeployHistory,
  purgeSnapshot,
  updateSnapshotRemark,
  presignRepoGet,
} from "../../utils/snapshots/snapshotsApi";

const SNAPSHOTS_UI_STATE_KEY = "admin_snapshots_ui_state_v1";

function SectionCard({ title, subtitle, action, children }) {
  return (
    <div className={cx(CARD_SURFACE, CARD_ROUNDED_2XL)}>
      <div className="px-6 py-3 border-b rounded-t-2xl bg-gray-200/70 dark:bg-gray-700/70 border-gray-200/70 dark:border-white/10 flex items-start sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-left font-epilogue text-lg font-semibold text-gray-900 dark:text-gray-100">
            {title}
          </h3>
          {subtitle ? (
            <div className="mt-0.5 text-xs text-gray-600 dark:text-gray-300">
              {subtitle}
            </div>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}

function prettyKB(n) {
  const kb = (n || 0) / 1024;
  if (kb < 1) return `${Math.max(0, Math.round(kb * 10) / 10)} KB`;
  if (kb < 100) return `${Math.round(kb * 10) / 10} KB`;
  return `${Math.round(kb)} KB`;
}

function downloadJson(filename, json) {
  if (!json) return;
  const blob = new Blob([JSON.stringify(json, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || "snapshot.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Extract metadata from key produced by your lambda format:
// snapshots/<name>/from_<from>_to_<to>/<name>__<from>__<to>__<createdAt>.json
function parseMetaFromKey(key) {
  const filename = (key || "").split("/").slice(-1)[0] || "";
  const m = filename.match(/__(\d{4}-\d{2}-\d{2})__(\d{4}-\d{2}-\d{2})__(.+)\.json$/);
  const from = m?.[1] || "—";
  const to = m?.[2] || "—";
  const createdAtRaw = m?.[3] || "";

  // try to convert 2026-01-17T12_38_44.812Z -> 2026-01-17T12:38:44.812Z
  const createdAtIso = createdAtRaw
    ? createdAtRaw.replace(/_/g, ":").replace(/:Z$/, "Z")
    : "";

  const createdAtLabel =
    createdAtIso && !Number.isNaN(Date.parse(createdAtIso))
      ? new Date(createdAtIso).toLocaleString()
      : "—";

  return { filename, from, to, createdAt: createdAtLabel, createdAtIso };
}


function extractDeployMetaFromSnapshotJson(snapJson) {
  if (!snapJson || typeof snapJson !== "object") return null;

  // Your profileVersion util returns: { id, gitSha, buildTime, repo: {...} }
  // Some snapshots might store it under different names; we try multiple.
  const pv =
    snapJson.profileVersion ||
    snapJson.profile_version ||
    snapJson.buildMeta ||
    snapJson.build_meta ||
    null;

  const gitSha =
    pv?.gitSha ||
    pv?.git_sha ||
    pv?.repo?.commit ||
    snapJson.gitSha ||
    snapJson.git_sha ||
    null;

  const checkpointTag =
    pv?.repo?.checkpointTag ||
    pv?.checkpointTag ||
    snapJson.checkpointTag ||
    null;

  const profileVersion =
    pv?.id || pv?.profileVersion || snapJson.profileVersionId || null;

  return {
    gitSha,
    checkpointTag,
    profileVersion,
  };
}

// function shortSha(sha) {
//   return sha ? String(sha).slice(0, 12) : "";
// }

function ActionButton({ variant = "neutral", children, onClick, disabled, title }) {
  const base =
    "inline-flex items-center justify-center px-3 py-2 rounded-lg text-xs font-semibold border transition shadow-sm disabled:opacity-60 disabled:cursor-not-allowed";

  const styles =
    variant === "green"
      ? "border-emerald-500/40 bg-emerald-600 text-white hover:bg-emerald-700"
      : variant === "danger"
      ? "border-red-500/50 bg-red-600 text-white hover:bg-red-700"
      : variant === "purple"
      ? "border-purple-500/40 bg-purple-600 text-white hover:bg-purple-700"
      : variant === "soft-danger"
      ? "border-red-300/50 bg-red-500/10 text-red-700 dark:text-red-400 hover:bg-red-500/20"
      : // ✅ neutral gray vibe (light/dark)
        "border-gray-300/70 dark:border-white/10 bg-gray-50/80 dark:bg-white/10 text-gray-800 dark:text-gray-100 hover:bg-gray-100/80 dark:hover:bg-white/15";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cx(base, styles)}
    >
      {children}
    </button>
  );
}

function IconButton({ onClick, title, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cx(
        "inline-flex items-center justify-center",
        "h-9 w-9 rounded-lg border shadow-sm transition",
        "border-gray-300/70 dark:border-white/10",
        "bg-gray-50/80 dark:bg-white/10",
        "text-gray-700 dark:text-gray-200",
        "hover:bg-gray-100/80 dark:hover:bg-white/15",
        "hover:text-purple-700 dark:hover:text-purple-300",
        "focus:outline-none"
      )}
    >
      {children}
    </button>
  );
}

async function copyToClipboard(text) {
  const value = String(text || "");
  if (!value) return false;

  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    // fallback
  }

  try {
    const ta = document.createElement("textarea");
    ta.value = value;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
    return true;
  } catch {
    return false;
  }
}

function CopyHoverCell({
  value,
  title,
  className = "",
  textClassName = "",
  maxWidthClass = "",
  showCopy = true,
}) {
  const [copied, setCopied] = useState(false);

  const onCopy = useCallback(async (e) => {
    e?.stopPropagation?.();
    const ok = await copyToClipboard(value);
    if (!ok) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 900);
  }, [value]);

  return (
    <div className={cx("relative group", className)}>
      <div className={cx("pr-6", maxWidthClass)}>
        <div className={cx("break-words", textClassName)} title={title || String(value || "")}>
          {value || "—"}
        </div>
      </div>

      {showCopy && value ? (
        <button
          type="button"
          onClick={onCopy}
          title={copied ? "Copied" : "Copy"}
          className={cx(
            "absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition",
            "p-1 rounded-md border dark:border-gray-200/70 border-white/10",
            "dark:bg-white/80 bg-[#0b0b12]/70",
            "dark:text-gray-600 text-gray-300 dark:hover:text-gray-900 hover:text-white"
          )}
        >
          <HiOutlineClipboardCopy className="h-4 w-4" />
        </button>
      ) : null}

      {copied ? (
        <div className="absolute -top-5 right-1 text-[10px] px-2 py-0.5 rounded-full border border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
          Copied ✅
        </div>
      ) : null}
    </div>
  );
}

function PreviewModal({ open, title, json, loading, error, onClose, onDownload }) {
  const [copied, setCopied] = useState(false);

  // ✅ hard-lock page scroll while modal is open (prevents section switching)
  useEffect(() => {
    if (!open) return;

    const scrollY = window.scrollY;

    const prev = {
      position: document.body.style.position,
      top: document.body.style.top,
      left: document.body.style.left,
      right: document.body.style.right,
      width: document.body.style.width,
      overflow: document.body.style.overflow,
    };

    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.width = "100%";
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.position = prev.position;
      document.body.style.top = prev.top;
      document.body.style.left = prev.left;
      document.body.style.right = prev.right;
      document.body.style.width = prev.width;
      document.body.style.overflow = prev.overflow;

      window.scrollTo(0, scrollY);
    };
  }, [open]);

  const onCopy = useCallback(async () => {
    if (!json) return;

    const text = JSON.stringify(json, null, 2);

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
      return;
    } catch {
      // fallback (older browsers / permissions)
    }

    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      // ignore
    }
  }, [json]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center px-4"
      // ✅ single place to stop wheel/touch bubbling (no redundancy)
      onWheelCapture={(e) => e.stopPropagation()}
      onTouchMoveCapture={(e) => e.stopPropagation()}
    >
      {/* ✅ blurred backdrop + dim */}
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-md backdrop-saturate-150"
      />

      <div className="relative w-full max-w-4xl rounded-2xl border border-gray-200/70 dark:border-white/10 bg-white/90 dark:bg-[#0b0b12]/90 backdrop-blur-xl shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200/70 dark:border-white/10 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-base font-semibold text-gray-900 dark:text-gray-100 truncate">
              {title || "Snapshot preview"}
            </div>
            <div className="mt-0.5 text-xs text-gray-600 dark:text-gray-400">
              JSON preview (read-only)
            </div>
          </div>

          <div className="flex items-center gap-2">
            {json ? (
              <ActionButton variant="purple" onClick={onDownload} title="Download JSON">
                Download
              </ActionButton>
            ) : null}

            {/* ✅ close is red variant (as requested) */}
            <ActionButton variant="soft-danger" onClick={onClose} title="Close preview">
              Close
            </ActionButton>
          </div>
        </div>

        <div className="p-5">
          {loading ? (
            <div className="text-sm text-gray-600 dark:text-gray-400">Loading…</div>
          ) : error ? (
            <div className="text-sm text-red-600 dark:text-red-400 whitespace-pre-wrap break-words">
              {error}
            </div>
          ) : json ? (
            <div className="relative max-h-[70vh] overflow-auto overscroll-contain rounded-xl border border-gray-200/70 dark:border-white/10 bg-white/50 dark:bg-white/5 p-4">
              {/* ✅ sticky copy button (fixed within scroll container) */}
              <div className="sticky top-0 z-10 flex justify-end pb-3">
                <ActionButton onClick={onCopy} title="Copy JSON to clipboard">
                  {copied ? "Copied ✅" : "Copy"}
                </ActionButton>
              </div>

              <pre className="text-[12px] leading-relaxed whitespace-pre-wrap break-words text-gray-800 dark:text-gray-100">
                {JSON.stringify(json, null, 2)}
              </pre>
            </div>
          ) : (
            <div className="text-sm text-gray-600 dark:text-gray-400">No data.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function ExpandedTableModal({ open, title, onClose, children }) {
  // ✅ hard-lock page scroll while modal is open (prevents section switching + scroll bleed)
  useEffect(() => {
    if (!open) return;

    const scrollY = window.scrollY;

    const prev = {
      position: document.body.style.position,
      top: document.body.style.top,
      left: document.body.style.left,
      right: document.body.style.right,
      width: document.body.style.width,
      overflow: document.body.style.overflow,
    };

    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.width = "100%";
    document.body.style.overflow = "hidden";

    // ✅ block key-driven section navigation (arrow keys / page keys) while modal open
    const onKeyDownCapture = (e) => {
      const k = e.key;
      const block =
        k === "ArrowUp" ||
        k === "ArrowDown" ||
        k === "ArrowLeft" ||
        k === "ArrowRight" ||
        k === "PageUp" ||
        k === "PageDown" ||
        k === "Home" ||
        k === "End" ||
        k === " " ||
        k === "Spacebar";

      if (!block) return;

      e.preventDefault();
      e.stopPropagation();
    };

    window.addEventListener("keydown", onKeyDownCapture, true);

    return () => {
      window.removeEventListener("keydown", onKeyDownCapture, true);

      document.body.style.position = prev.position;
      document.body.style.top = prev.top;
      document.body.style.left = prev.left;
      document.body.style.right = prev.right;
      document.body.style.width = prev.width;
      document.body.style.overflow = prev.overflow;

      window.scrollTo(0, scrollY);
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[320] flex items-center justify-center px-4"
      onWheelCapture={(e) => e.stopPropagation()}
      onTouchMoveCapture={(e) => e.stopPropagation()}
    >
      {/* ✅ blurred backdrop */}
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-lg backdrop-saturate-150"
      />

      <div className="relative w-full max-w-[95vw] rounded-2xl border border-gray-200/70 dark:border-white/10 bg-white/90 dark:bg-[#0b0b12]/90 backdrop-blur-xl shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200/70 dark:border-white/10 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-base font-semibold text-gray-900 dark:text-gray-100 truncate">
              {title || "Expanded table"}
            </div>
            <div className="mt-0.5 text-xs text-gray-600 dark:text-gray-400">
              Full table view
            </div>
          </div>

          <ActionButton variant="soft-danger" onClick={onClose} title="Close">
            Close
          </ActionButton>
        </div>

        {/* ✅ modal body scrolls, not the page */}
        <div className="p-4">
          <div className="max-h-[78vh] overflow-auto overscroll-contain"> {/* can do max-h-[88vh] for more vertical height */}
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}


function ConfirmModal({
  open,
  title,
  body,
  confirmText = "Confirm",
  confirmVariant = "danger",
  onConfirm,
  onClose,
  busy,
  extra,
}) {

  // ✅ hard-lock page scroll while modal is open
  useEffect(() => {
    if (!open) return;

    const scrollY = window.scrollY;

    const prev = {
      position: document.body.style.position,
      top: document.body.style.top,
      left: document.body.style.left,
      right: document.body.style.right,
      width: document.body.style.width,
      overflow: document.body.style.overflow,
    };

    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.width = "100%";
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.position = prev.position;
      document.body.style.top = prev.top;
      document.body.style.left = prev.left;
      document.body.style.right = prev.right;
      document.body.style.width = prev.width;
      document.body.style.overflow = prev.overflow;

      window.scrollTo(0, scrollY);
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
        className="fixed inset-0 z-[310] flex items-center justify-center px-4"
        onWheelCapture={(e) => e.stopPropagation()}
        onTouchMoveCapture={(e) => e.stopPropagation()}
    >
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-md backdrop-saturate-150"
      />

      <div className="relative w-full max-w-md rounded-2xl border border-gray-200/70 dark:border-white/10 bg-white/90 dark:bg-[#0b0b12]/90 backdrop-blur-xl shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200/70 dark:border-white/10">
          <div className="text-base font-semibold text-gray-900 dark:text-gray-100">
            {title}
          </div>
          {body ? (
            <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">{body}</div>
          ) : null}
        </div>

        <div className="px-5 py-4 space-y-3">{extra}</div>

        <div className="px-5 py-4 border-t border-gray-200/70 dark:border-white/10 flex items-center justify-end gap-2">
          <ActionButton onClick={onClose} disabled={busy}>
            Cancel
          </ActionButton>
          <ActionButton variant={confirmVariant} onClick={onConfirm} disabled={busy}>
            {busy ? "Working…" : confirmText}
          </ActionButton>
        </div>
      </div>
    </div>
  );
}

function QuerySearchModal({
  open,
  onClose,
  activeTab,
  tabs, // {profile:{label}, analytics:{label}, ...}
  getColsForTab,
  getSortableColsForTab,
  initial,
  onApply,
  onClear,
}) {
  const [fromTab, setFromTab] = useState(initial?.fromTab || activeTab);
  const [selectCols, setSelectCols] = useState(initial?.selectCols || []);
  const [orderBy, setOrderBy] = useState(initial?.orderBy || "");
  const [orderDir, setOrderDir] = useState(initial?.orderDir || "desc");
  const [limit, setLimit] = useState(
    typeof initial?.limit === "number" ? String(initial.limit) : ""
  );

  // key:value filters (simple)
  const [filters, setFilters] = useState(Array.isArray(initial?.filters) ? initial.filters : []);

  useEffect(() => {
    if (!open) return;

    setFromTab(initial?.fromTab || activeTab);
    setSelectCols(Array.isArray(initial?.selectCols) ? initial.selectCols : []); // ✅ none
    setOrderBy(initial?.orderBy || "");                                          // ✅ none
    setOrderDir(initial?.orderDir || "desc");                                    // ✅ desc
    setLimit(typeof initial?.limit === "number" ? String(initial.limit) : "");   // ✅ empty
    setFilters(Array.isArray(initial?.filters) ? initial.filters : []);
  }, [open, initial, activeTab]);

  // modal scroll lock (same pattern you used)
  useEffect(() => {
    if (!open) return;
    const scrollY = window.scrollY;
    const prev = {
      position: document.body.style.position,
      top: document.body.style.top,
      left: document.body.style.left,
      right: document.body.style.right,
      width: document.body.style.width,
      overflow: document.body.style.overflow,
    };
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.width = "100%";
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.position = prev.position;
      document.body.style.top = prev.top;
      document.body.style.left = prev.left;
      document.body.style.right = prev.right;
      document.body.style.width = prev.width;
      document.body.style.overflow = prev.overflow;
      window.scrollTo(0, scrollY);
    };
  }, [open]);

  if (!open) return null;

  const cols = getColsForTab(fromTab);
  const sortable = getSortableColsForTab(fromTab);

  const hasFrom = Boolean(fromTab);                 // usually true
  const hasSelect = (selectCols || []).length > 0;  // optional
  const hasOrderBy = Boolean(orderBy);              // optional
  const hasLimit = String(limit || "").trim().length > 0; // optional (only if user typed)

  // ✅ UI enable/disable gates
  const canSelect = hasFrom;               // Select enabled after From
  const canOrderBy = hasFrom && hasSelect; // OrderBy enabled after Select
  const canLimit = hasFrom;                // Limit enabled after From (NOT after OrderBy)
  const canFilters = hasFrom;              // Filters enabled after From

  const parsedLimit = Number(String(limit || "").trim());
  const limitOk = !hasLimit || (Number.isFinite(parsedLimit) && parsedLimit > 0); // ✅ only validate if provided

  // ✅ “at least 2 of 4”
  const stepsChosenCount =
    (hasFrom ? 1 : 0) +
    (hasSelect ? 1 : 0) +
    (hasOrderBy ? 1 : 0) +
    (hasLimit ? 1 : 0);

  const applyDisabled = !limitOk || stepsChosenCount < 2;

  const addFilterRow = () => {
    const firstCol = cols[0]?.id || "";
    setFilters((prev) => [
      ...(prev || []),
      { col: firstCol, op: "contains", value: "" },
    ]);
  };

  const updateFilter = (idx, patch) => {
    setFilters((prev) => {
      const next = [...(prev || [])];
      next[idx] = { ...(next[idx] || {}), ...(patch || {}) };
      return next;
    });
  };

  const removeFilter = (idx) => {
    setFilters((prev) => (prev || []).filter((_, i) => i !== idx));
  };

  return (
    <div
      className="fixed inset-0 z-[330] flex items-center justify-center px-4"
      onWheelCapture={(e) => e.stopPropagation()}
      onTouchMoveCapture={(e) => e.stopPropagation()}
    >
      {/* blurred backdrop */}
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-md backdrop-saturate-150"
      />

      <div className="relative w-full max-w-2xl rounded-2xl border border-gray-200/70 dark:border-white/10 bg-white/90 dark:bg-[#0b0b12]/90 backdrop-blur-xl shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200/70 dark:border-white/10 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-base font-semibold text-gray-900 dark:text-gray-100 truncate">
              Query search
            </div>
            <div className="mt-0.5 text-xs text-gray-600 dark:text-gray-400">
              Build a simple SQL-like query (From → Select → Order By → Limit)
            </div>
          </div>

          <div className="flex items-center gap-2">
            <ActionButton
              onClick={() => {
                onClear?.();
                onClose?.();
              }}
              title="Clear query"
            >
              Clear
            </ActionButton>
            <ActionButton variant="soft-danger" onClick={onClose} title="Close">
              Close
            </ActionButton>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* From */}
          <div className="space-y-1.5">
            <div className="text-xs font-semibold text-gray-700 dark:text-gray-300">
              From
            </div>
            <select
              value={fromTab}
              onChange={(e) => {
                const nextTab = e.target.value;
                setFromTab(nextTab);
                // reset downstream (enforced ordering)
                setSelectCols([]);
                setOrderBy("");
                setLimit("");
                setFilters([]);
              }}
              className={cx(
                "w-full h-10 rounded-xl border px-3 text-sm outline-none",
                "border-gray-200/70 dark:border-white/10",
                "bg-white/80 dark:bg-white/10",
                "text-gray-900 dark:text-gray-100"
              )}
            >
              {TAB_IDS.map((t) => (
                <option key={t} value={t}>
                  {tabs?.[t]?.label || t}
                </option>
              ))}
            </select>
          </div>

          {/* Select */}
          <div className={cx("space-y-1.5", !canSelect ? "opacity-50 pointer-events-none" : "")}>
            <div className="text-xs font-semibold text-gray-700 dark:text-gray-300">
              Select
            </div>

            <div className="rounded-xl border border-gray-200/70 dark:border-white/10 bg-white/60 dark:bg-white/5 p-3">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="text-xs text-gray-600 dark:text-gray-400">
                  Choose columns to show in the table
                </div>
                <div className="flex items-center gap-2">
                  <ActionButton
                    onClick={() => setSelectCols(cols.map((c) => c.id))}
                    title="Select all columns"
                  >
                    All
                  </ActionButton>
                  <ActionButton
                    onClick={() => setSelectCols([])}
                    title="Clear selected columns"
                  >
                    None
                  </ActionButton>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {cols.map((c) => {
                  const checked = selectCols.includes(c.id);
                  return (
                    <label
                      key={c.id}
                      className="inline-flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300 select-none"
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-purple-600"
                        checked={checked}
                        onChange={(e) => {
                          const on = e.target.checked;
                          setSelectCols((prev) => {
                            const p = prev || [];
                            if (on) return [...new Set([...p, c.id])];
                            return p.filter((x) => x !== c.id);
                          });
                          // reset downstream (enforced ordering)
                          setOrderBy("");
                        //   setLimit("");
                        }}
                      />
                      {c.label}
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Order By */}
          <div className={cx("space-y-1.5", !canOrderBy ? "opacity-50 pointer-events-none" : "")}>
            <div className="text-xs font-semibold text-gray-700 dark:text-gray-300">
              Order By
            </div>

            <div className="flex items-center gap-2">
              <select
                value={orderBy}
                onChange={(e) => {
                  setOrderBy(e.target.value);
                //   setLimit("");
                }}
                className={cx(
                  "flex-1 h-10 rounded-xl border px-3 text-sm outline-none",
                  "border-gray-200/70 dark:border-white/10",
                  "bg-white/80 dark:bg-white/10",
                  "text-gray-900 dark:text-gray-100"
                )}
              >
                <option value="">Select a sortable column…</option>
                {sortable.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>

              <select
                value={orderDir}
                onChange={(e) => setOrderDir(e.target.value)}
                className={cx(
                  "w-[140px] h-10 rounded-xl border px-3 text-sm outline-none",
                  "border-gray-200/70 dark:border-white/10",
                  "bg-white/80 dark:bg-white/10",
                  "text-gray-900 dark:text-gray-100"
                )}
                title="Sort direction"
              >
                <option value="desc">DESC</option>
                <option value="asc">ASC</option>
              </select>
            </div>
          </div>

          {/* Limit */}
          <div className={cx("space-y-1.5", !canLimit ? "opacity-50 pointer-events-none" : "")}>
            <div className="text-xs font-semibold text-gray-700 dark:text-gray-300">
              Limit
            </div>
            <input
              value={limit}
              onChange={(e) => setLimit(e.target.value.replace(/[^\d]/g, ""))}
              placeholder="e.g. 50"
              className={cx(
                "w-full h-10 rounded-xl border px-3 text-sm outline-none",
                "border-gray-200/70 dark:border-white/10",
                "bg-white/80 dark:bg-white/10",
                "text-gray-900 dark:text-gray-100",
                "placeholder:text-gray-400 dark:placeholder:text-gray-500"
              )}
            />
            {!limitOk && hasLimit ? (
              <div className="text-[11px] text-amber-700 dark:text-amber-300">
                Limit must be a positive number.
              </div>
            ) : null}
          </div>

          {/* Filters (key:value lookup) */}
          <div className={cx("space-y-2", !canFilters ? "opacity-50 pointer-events-none" : "")}>
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                Filters (key:value)
              </div>
              <ActionButton onClick={addFilterRow} title="Add filter">
                + Add
              </ActionButton>
            </div>

            {filters?.length ? (
              <div className="space-y-2">
                {filters.map((f, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl border border-gray-200/70 dark:border-white/10 bg-white/60 dark:bg-white/5 p-3 flex flex-col sm:flex-row gap-2"
                  >
                    <select
                      value={f.col || ""}
                      onChange={(e) => updateFilter(idx, { col: e.target.value })}
                      className={cx(
                        "flex-1 h-10 rounded-xl border px-3 text-sm outline-none",
                        "border-gray-200/70 dark:border-white/10",
                        "bg-white/80 dark:bg-white/10",
                        "text-gray-900 dark:text-gray-100"
                      )}
                    >
                      {cols.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label}
                        </option>
                      ))}
                    </select>

                    <select
                      value={f.op || "contains"}
                      onChange={(e) => updateFilter(idx, { op: e.target.value })}
                      className={cx(
                        "w-full sm:w-[140px] h-10 rounded-xl border px-3 text-sm outline-none",
                        "border-gray-200/70 dark:border-white/10",
                        "bg-white/80 dark:bg-white/10",
                        "text-gray-900 dark:text-gray-100"
                      )}
                      title="Operator"
                    >
                      <option value="contains">contains</option>
                      <option value="eq">=</option>
                      <option value="startsWith">startsWith</option>
                      <option value="endsWith">endsWith</option>
                    </select>

                    <input
                      value={f.value || ""}
                      onChange={(e) => updateFilter(idx, { value: e.target.value })}
                      placeholder="value…"
                      className={cx(
                        "flex-1 h-10 rounded-xl border px-3 text-sm outline-none",
                        "border-gray-200/70 dark:border-white/10",
                        "bg-white/80 dark:bg-white/10",
                        "text-gray-900 dark:text-gray-100",
                        "placeholder:text-gray-400 dark:placeholder:text-gray-500"
                      )}
                    />

                    <ActionButton
                      variant="soft-danger"
                      onClick={() => removeFilter(idx)}
                      title="Remove filter"
                    >
                      Remove
                    </ActionButton>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-[11px] text-gray-500 dark:text-gray-400">
                Optional. Leave empty to query only by From/Select/Order/Limit.
              </div>
            )}
          </div>
        </div>

        <div className="px-5 py-4 border-t border-gray-200/70 dark:border-white/10 flex items-center justify-end gap-2">
          <ActionButton onClick={onClose}>Cancel</ActionButton>
          <ActionButton
            variant="purple"
            disabled={applyDisabled}
            onClick={() => {
              const payload = {
                fromTab,
                selectCols, // can be []
                orderBy: hasOrderBy ? orderBy : "",
                orderDir: orderDir || "desc",
                limit: hasLimit ? parsedLimit : undefined, // ✅ only if user typed it
                filters: (filters || []).filter((f) => String(f?.value || "").trim().length > 0),
              };
              onApply?.(payload);
              onClose?.();
            }}
            title={applyDisabled ? "Complete From → Select → Order By → Limit" : "Apply query"}
          >
            Apply query
          </ActionButton>
        </div>
      </div>
    </div>
  );
}


function SortableTh({ label, sortKey, sort, setSort, className = "" }) {
  const active = sort.key === sortKey;
  const arrow = active ? (sort.dir === "asc" ? "↑" : "↓") : "↕";

  return (
    <th
      className={cx("py-3 px-4 font-semibold whitespace-nowrap cursor-pointer select-none", className)}
      title="Click to sort"
      onClick={() =>
        setSort((prev) => ({
          key: sortKey,
          dir: prev.key === sortKey && prev.dir === "desc" ? "asc" : "desc",
        }))
      }
    >
      <div className="flex items-center gap-1">
        {label} <span className="opacity-70">{arrow}</span>
      </div>
    </th>
  );
}

// -----------------------------
// Query Search: Tab + Column schema (SCALABLE)
// -----------------------------

const TAB_IDS = ["profile", "analytics"];

const COL = {
  // "data" columns (selectable)
  PROFILE_VERSION_ID: "profileVersionId",
  FILENAME: "filename",
  GIT_SHA: "gitSha",
  CATEGORY: "category",
  TAG_KEY: "tagKey",
  TAG_VALUE: "tagValue",
  GEO_HINT: "geoHint",
  CHECKPOINT: "checkpointTag",
  FROM_DATE: "from",
  TO_DATE: "to",
  CREATED_AT: "createdAt",
  SIZE: "size",
  KEY: "key", // analytics key or repo key
};

const COLUMN_DEFS = [
  // inside your column definitions (the ones used to build selectedCols)
  {
    id: COL.PROFILE_VERSION_ID,
    label: "Profile_Version_ID",
    sortable: false,
    tabs: ["profile", "analytics"],
    getValue: (it) => it.meta?.profileVersionId || "",
    renderCell: (it) => (
      <CopyHoverCell
        value={it.meta?.profileVersionId || ""}
        textClassName="text-[12px] text-gray-700 dark:text-gray-300 font-mono"
        showCopy={Boolean(it.meta?.profileVersionId)}
      />
    ),
  },
  {
    id: COL.FILENAME,
    label: "Filename",
    sortable: false,
    tabs: ["profile", "analytics"],
    getValue: (it) => it.filename || "",
    renderCell: (it) => (
      <CopyHoverCell
        value={it.filename}
        textClassName="font-semibold text-gray-900 dark:text-gray-100 truncate"
      />
    ),
  },
  {
    id: COL.GIT_SHA,
    label: "Git_SHA",
    sortable: false,
    tabs: ["profile"],
    getValue: (it) => it.meta?.gitSha || "",
    renderCell: (it, ctx) => {
        const sha = it.meta?.gitSha || "";
        const isActive = Boolean(sha && ctx?.activeGitSha && sha === ctx.activeGitSha);
        const isLastUsed = Boolean(sha && ctx?.prevGitSha && sha === ctx.prevGitSha);

        return (
        <div className="inline-flex items-center gap-2">
            <CopyHoverCell
            value={sha}
            textClassName="text-[12px] text-gray-700 dark:text-gray-300 font-mono"
            showCopy={Boolean(sha)}
            />

            {isActive ? (
            <span className="text-[10px] px-2 py-0.5 rounded-full border border-emerald-500/30 bg-emerald-500/15 text-emerald-800 dark:text-emerald-300">
                Active
            </span>
            ) : null}

            {!isActive && isLastUsed ? (
            <span className="text-[10px] px-2 py-0.5 rounded-full border border-amber-500/30 bg-amber-500/15 text-amber-800 dark:text-amber-300">
                Last used
            </span>
            ) : null}
        </div>
        );
    },
  },
  {
    id: COL.CATEGORY,
    label: "Category",
    sortable: false,
    tabs: ["profile", "analytics"],
    getValue: (it) => it.meta?.category || "",
    renderCell: (it) => it.meta?.category || "—",
  },
  {
    id: COL.TAG_KEY,
    label: "Tag_Key",
    sortable: false,
    tabs: ["profile", "analytics"],
    getValue: (it) => it.meta?.tagKey || "",
    renderCell: (it) => it.meta?.tagKey || "—",
  },
  {
    id: COL.TAG_VALUE,
    label: "Tag_Value",
    sortable: false,
    tabs: ["profile", "analytics"],
    getValue: (it) => it.meta?.tagValue || "",
    renderCell: (it) => it.meta?.tagValue || "—",
  },
  {
    id: COL.GEO_HINT,
    label: "Geo_Hint",
    sortable: false,
    tabs: ["analytics"],
    getValue: (it) => it.meta?.geoHint || "",
    renderCell: (it) => it.meta?.geoHint || "—",
  },
  {
    id: COL.CHECKPOINT,
    label: "Checkpoint",
    sortable: false,
    tabs: ["profile"],
    getValue: (it) => it.meta?.checkpointTag || "",
    renderCell: (it) => it.meta?.checkpointTag || "—",
  },

  // Sortable ones (used in Order By)
  {
    id: COL.FROM_DATE,
    label: "From_Date",
    sortable: true,
    sortKey: "from",
    tabs: ["profile", "analytics"],
    getValue: (it) => it.from === "—" ? "" : it.from,
    renderCell: (it) => it.from,
  },
  {
    id: COL.TO_DATE,
    label: "To_Date",
    sortable: true,
    sortKey: "to",
    tabs: ["profile", "analytics"],
    getValue: (it) => it.to === "—" ? "" : it.to,
    renderCell: (it) => it.to,
  },
  {
    id: COL.CREATED_AT,
    label: "Created_At",
    sortable: true,
    sortKey: "createdAt",
    tabs: ["profile", "analytics"],
    getValue: (it) => it.createdAtIso || it.createdAt || "",
    renderCell: (it) => it.createdAt,
  },
  {
    id: COL.SIZE,
    label: "Size",
    sortable: true,
    sortKey: "size",
    tabs: ["profile", "analytics"],
    getValue: (it) => Number(it.size || 0),
    renderCell: (it) => prettyKB(it.size),
  },

  {
    id: COL.KEY,
    label: "Repo_Key / Analytics_Key",
    sortable: false,
    tabs: ["profile", "analytics"],
    getValue: (it) => (it.meta?.repoArtifactKey || it.key || ""),
    renderCell: (it) => {
      // we’ll render the existing per-tab key UI in the table (below)
      return null;
    },
  },
];

const TAB_CONFIG = {
  profile: {
    label: "Profile",
    // default “select” (data columns shown when no query applied)
    defaultSelect: [
      COL.PROFILE_VERSION_ID,
      COL.FILENAME,
      COL.GIT_SHA,
      COL.CATEGORY,
      COL.TAG_KEY,
      COL.TAG_VALUE,
      COL.CHECKPOINT,
      COL.FROM_DATE,
      COL.TO_DATE,
      COL.CREATED_AT,
      COL.SIZE,
      COL.KEY,
    ],
  },
  analytics: {
    label: "Analytics",
    defaultSelect: [
      COL.PROFILE_VERSION_ID,
      COL.FILENAME,
      COL.CATEGORY,
      COL.TAG_KEY,
      COL.TAG_VALUE,
      COL.GEO_HINT,
      COL.FROM_DATE,
      COL.TO_DATE,
      COL.CREATED_AT,
      COL.SIZE,
      COL.KEY,
    ],
  },
};

function colsForTab(tabId) {
  return COLUMN_DEFS.filter((c) => c.tabs.includes(tabId));
}
function selectableColsForTab(tabId) {
  // we keep "KEY" selectable too, but you can exclude if you want
  return colsForTab(tabId);
}
function sortableColsForTab(tabId) {
  return colsForTab(tabId).filter((c) => c.sortable);
}


function SnapshotsTable({
  visibleRows,
  isProfileTab,
  activeTab,
  selectedColumnIds, 
  focusedKey,
  focusRow,
  selectedKeys,
  toggleRow,
  allSelectedOnScreen,
  toggleSelectAll,
  sort,
  setSort,
  openPreview,
  favorites,
  activeGitSha,
  prevGitSha,
  showTrash,
  askDeploy,
  downloadRepoZip,
  remarkEditKey,
  remarkDraft,
  setRemarkDraft,
  remarkBusy,
  saveEditRemark,
  cancelEditRemark,
  startEditRemark,
  remarkInputRef,
  editingRowRef,
  containerClassName = "max-h-[520px] overflow-auto",
}) {
  const allCols = colsForTab(activeTab);
  const byId = Object.fromEntries(allCols.map((c) => [c.id, c]));
  const selectedCols = (selectedColumnIds || [])
    .map((id) => byId[id])
    .filter(Boolean);
  return (
    <div className={containerClassName}>
        <table className={cx("w-full text-sm", isProfileTab ? "min-w-[1640px]" : "min-w-[1480px]")}>
        <thead className="sticky top-0 z-10 bg-gray-100/90 dark:bg-[#121224]/90 backdrop-blur border-b border-gray-200/70 dark:border-white/10">
            <tr className="text-left text-xs text-gray-600 dark:text-gray-300">
            {/* selection */}
            <th className="py-3 px-4 font-semibold whitespace-nowrap">
                <input
                type="checkbox"
                className="h-4 w-4 accent-purple-600"
                checked={allSelectedOnScreen}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => {
                    e.stopPropagation();
                    toggleSelectAll();
                }}
                title="Select all"
                />
            </th>

            {/* preview */}
            <th className="py-3 px-4 font-semibold whitespace-nowrap">Preview</th>

            {/* ✅ dynamic data headers */}
            {selectedCols.map((c) => {
                // KEY column label differs by tab
                if (c.id === COL.KEY) {
                return (
                    <th key={c.id} className="py-3 px-4 font-semibold whitespace-nowrap">
                    {isProfileTab ? "Repo_Key" : "Analytics_Key"}
                    </th>
                );
                }

                // sortable columns keep your SortableTh
                if (c.sortable && c.sortKey) {
                return (
                    <SortableTh
                    key={c.id}
                    label={c.label}
                    sortKey={c.sortKey}
                    sort={sort}
                    setSort={setSort}
                    />
                );
                }

                return (
                <th key={c.id} className="py-3 px-4 font-semibold whitespace-nowrap">
                    {c.label}
                </th>
                );
            })}

            {/* remark (always) */}
            <th className="py-3 px-4 font-semibold whitespace-nowrap w-[520px]">Remark</th>

            {/* deploy (profile only) */}
            {isProfileTab ? (
                <th className="py-3 px-4 font-semibold whitespace-nowrap">Deploy</th>
            ) : null}
            </tr>
        </thead>

        <tbody>
            {visibleRows.map((it) => {
            const sha = it.meta?.gitSha || "";
            const isActiveRow = Boolean(sha && activeGitSha && sha === activeGitSha);
            const isFocused = it.key === focusedKey;

            return (
                <tr
                ref={remarkEditKey === it.key ? editingRowRef : null} // ✅ only edited row
                key={it.key}
                onClick={() => focusRow(it.key)}
                className={cx(
                    "border-t border-gray-200/60 dark:border-white/10 cursor-pointer transition-colors",
                    "hover:bg-gray-100/40 dark:hover:bg-white/5",
                    isFocused
                    ? "bg-purple-50/60 dark:bg-purple-500/10 shadow-[inset_0_0_0_1px_rgba(147,51,234,0.25)] dark:shadow-[inset_0_0_0_1px_rgba(167,139,250,0.18)]"
                    : ""
                )}
                >
                {/* selection */}
                <td className="text-xs py-3 px-4 whitespace-nowrap w-[360px]">
                    <input
                    type="checkbox"
                    className="h-4 w-4 accent-purple-600"
                    checked={selectedKeys.includes(it.key)}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => {
                        e.stopPropagation();
                        toggleRow(it.key);
                    }}
                    title="Select"
                    />
                </td>

                {/* preview */}
                <td className="text-xs py-3 px-4 whitespace-nowrap w-[360px]">
                    <ActionButton
                    variant="green"
                    onClick={(e) => {
                        e.stopPropagation();
                        openPreview(it.key);
                    }}
                    title="Open preview"
                    >
                    <HiOutlineEye className="text-base" />
                    </ActionButton>
                </td>

                {/* ✅ dynamic data cells */}
                {selectedCols.map((c) => {

                    // ✅ special: profile version id + favorite star
                    if (c.id === COL.PROFILE_VERSION_ID) {
                    return (
                        <td key={c.id} className="text-xs py-3 px-4 whitespace-nowrap w-[360px]">
                        <div className="inline-flex items-center gap-2">
                            <CopyHoverCell
                            value={it.meta?.profileVersionId || ""}
                            textClassName="text-[12px] text-gray-700 dark:text-gray-300 font-mono"
                            showCopy={Boolean(it.meta?.profileVersionId)}
                            />

                            {favorites?.[it.key] ? (
                            <HiStar
                                className="h-4 w-4 text-amber-400 drop-shadow-[0_1px_1px_rgba(0,0,0,0.25)]"
                                title="Favorite"
                            />
                            ) : null}
                        </div>
                        </td>
                    );
                    }

                    // special: key cell (repo zip / analytics key)
                    if (c.id === COL.KEY) {
                    return (
                        <td key={c.id} className="py-3 px-4">
                        {isProfileTab ? (
                            <div className="flex items-start gap-2">
                            <button
                                type="button"
                                title={it.meta?.repoArtifactKey ? "Download repo zip" : "No repo zip"}
                                disabled={!it.meta?.repoArtifactKey}
                                onClick={(e) => {
                                e.stopPropagation();
                                downloadRepoZip(it.meta?.repoArtifactKey);
                                }}
                                className={cx(
                                "mt-[2px] p-0 bg-transparent border-0 shadow-none",
                                "text-gray-500 dark:text-gray-400",
                                "hover:text-purple-700 dark:hover:text-purple-300",
                                "disabled:opacity-40 disabled:cursor-not-allowed"
                                )}
                            >
                                <HiOutlineDownload className="h-4 w-4" />
                            </button>

                            <CopyHoverCell
                                value={it.meta?.repoArtifactKey || ""}
                                textClassName="text-[12px] text-gray-600 dark:text-gray-400 font-mono"
                                maxWidthClass="max-w-[420px]"
                                showCopy={Boolean(it.meta?.repoArtifactKey)}
                            />
                            </div>
                        ) : (
                            <CopyHoverCell
                            value={it.key}
                            textClassName="text-[12px] text-gray-600 dark:text-gray-400 font-mono"
                            maxWidthClass="max-w-[420px]"
                            showCopy={Boolean(it.key)}
                            />
                        )}
                        </td>
                    );
                    }

                    // default: render from schema (cell renderer if present)
                    return (
                    <td
                        key={c.id}
                        className={cx(
                        "text-xs py-3 px-4 whitespace-nowrap text-gray-700 dark:text-gray-300",
                        c.id === COL.FILENAME ? "" : ""
                        )}
                    >
                        {c.renderCell
                            ? c.renderCell(it, { activeGitSha, prevGitSha, isProfileTab, favorites })
                            : (c.getValue?.(it) || "—")}
                    </td>
                    );
                })}

                {/* remark */}
                <td className="text-xs py-3 px-4 w-[520px] align-top">
                    {remarkEditKey === it.key ? (
                    <div
                        className="flex items-start justify-between gap-3"
                        onClick={(e) => e.stopPropagation()} // ✅ blanket stop for edit UI clicks
                    >
                        <input
                        ref={remarkInputRef}
                        autoFocus
                        value={remarkDraft}
                        onChange={(e) => setRemarkDraft(e.target.value)}
                        disabled={remarkBusy}
                        placeholder="Add remark…"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => {
                            e.stopPropagation();
                            if (e.key === "Enter") {
                            e.preventDefault();
                            if (!remarkBusy) saveEditRemark();
                            }
                            if (e.key === "Escape") {
                            e.preventDefault();
                            if (!remarkBusy) cancelEditRemark();
                            }
                        }}
                        className={cx(
                            "h-9 w-[260px] rounded-lg border px-3 text-xs outline-none",
                            "border-gray-200/70 dark:border-white/10",
                            "bg-white/80 dark:bg-white/10",
                            "text-gray-900 dark:text-gray-100",
                            "placeholder:text-gray-400 dark:placeholder:text-gray-500"
                        )}
                        />

                        <ActionButton
                        variant="green"
                        onClick={(e) => {
                            e.stopPropagation();
                            saveEditRemark();
                        }}
                        disabled={remarkBusy}
                        >
                        Save
                        </ActionButton>
                        <ActionButton
                        onClick={(e) => {
                            e.stopPropagation();
                            cancelEditRemark();
                        }}
                        disabled={remarkBusy}
                        >
                        Cancel
                        </ActionButton>
                    </div>
                    ) : (
                    <div className="relative group">
                        <div
                        className={cx(
                            "break-words whitespace-normal text-gray-700 dark:text-gray-300",
                            !showTrash ? "pr-10" : ""
                        )}
                        >
                        {it.meta?.remark ? it.meta.remark : "—"}
                        </div>

                        {!showTrash ? (
                        <button
                            type="button"
                            onClick={(e) => {
                            e.stopPropagation();
                            startEditRemark(it.key, it.meta?.remark || "");
                            }}
                            className={cx(
                            "absolute top-1 right-1",
                            "opacity-0 group-hover:opacity-100 transition",
                            "inline-flex items-center gap-1.5",
                            "px-2 py-1 rounded-md border shadow-sm",
                            "dark:border-gray-200/70 border-white/10",
                            "dark:bg-white/85 bg-[#0b0b12]/80 backdrop-blur",
                            "dark:text-gray-700 text-gray-200 dark:hover:text-gray-900 hover:text-white"
                            )}
                        >
                            <HiPencilAlt className="h-3.5 w-3.5" />
                            <span className="text-[11px] font-semibold leading-none">Edit</span>
                        </button>
                        ) : (
                        <span className="absolute top-1 right-1 text-[11px] text-gray-400">
                            Locked
                        </span>
                        )}
                    </div>
                    )}
                </td>

                {/* deploy */}
                {isProfileTab ? (
                    <td className="text-xs py-3 px-4 whitespace-nowrap w-[360px]">
                    <ActionButton
                        variant="green"
                        disabled={showTrash || isActiveRow}
                        onClick={(e) => {
                        e.stopPropagation();
                        askDeploy(it.key);
                        }}
                        title={
                        showTrash
                            ? "Restore first, then deploy"
                            : isActiveRow
                            ? "Already active — deploy disabled"
                            : "Deploy this snapshot's version"
                        }
                    >
                        {isActiveRow ? "Active" : "Deploy"}
                    </ActionButton>
                    </td>
                ) : null}
                </tr>
            );
            })}
        </tbody>
        </table>
    </div>
  );
}

function normalizeText(v) {
  return String(v ?? "").toLowerCase().trim();
}

function matchesFilter(value, op, needle) {
  const V = normalizeText(value);
  const N = normalizeText(needle);
  if (!N) return true;

  if (op === "eq") return V === N;
  if (op === "startsWith") return V.startsWith(N);
  if (op === "endsWith") return V.endsWith(N);
  return V.includes(N);
}

function applyKeyValueFilters(rowsIn, tabId, filters) {
  if (!filters?.length) return rowsIn;

  const cols = colsForTab(tabId);
  const byId = Object.fromEntries(cols.map((c) => [c.id, c]));

  return (rowsIn || []).filter((row) =>
    filters.every((f) => {
      const colDef = byId[f.col];
      const raw = colDef?.getValue ? colDef.getValue(row) : "";
      return matchesFilter(raw, f.op, f.value);
    })
  );
}

function toTime(v) {
  if (!v) return 0;
  const t = Date.parse(String(v));
  return Number.isNaN(t) ? 0 : t;
}

function comparePrimitive(a, b, dir) {
  const A = a ?? "";
  const B = b ?? "";
  if (A === B) return 0;

  if (typeof A === "number" && typeof B === "number") {
    return dir === "asc" ? A - B : B - A;
  }
  return dir === "asc"
    ? String(A).localeCompare(String(B))
    : String(B).localeCompare(String(A));
}

export default function AdminSnapshots() {
    const [items, setItems] = useState([]);
    const [trashItems, setTrashItems] = useState([]);

    const [loading, setLoading] = useState(true);
    const [trashLoading, setTrashLoading] = useState(false);

    const [err, setErr] = useState("");

    const [previewOpen, setPreviewOpen] = useState(false);
    const [previewKey, setPreviewKey] = useState("");
    const [previewJson, setPreviewJson] = useState(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [previewErr, setPreviewErr] = useState("");

    // expanded table modal state
    const [tableExpandOpen, setTableExpandOpen] = useState(false);

    const [showTrash, setShowTrash] = useState(() => {
        try {
            const raw = localStorage.getItem(SNAPSHOTS_UI_STATE_KEY);
            const parsed = raw ? JSON.parse(raw) : null;
            return Boolean(parsed?.showTrash);
        } catch {
            return false;
        }
    });

    const [deleteOpen, setDeleteOpen] = useState(false);
    const [deleteKey, setDeleteKey] = useState("");
    const [deleteBusy, setDeleteBusy] = useState(false);

    const [restoreOpen, setRestoreOpen] = useState(false);
    const [restoreKey, setRestoreKey] = useState("");
    const [restoreBusy, setRestoreBusy] = useState(false);

    const [deployOpen, setDeployOpen] = useState(false);
    const [deployBusy, setDeployBusy] = useState(false);
    const [deployErr, setDeployErr] = useState("");
    const [deployKey, setDeployKey] = useState("");
    const [deployMeta, setDeployMeta] = useState(null);

    const [remarkEditKey, setRemarkEditKey] = useState("");
    const [remarkDraft, setRemarkDraft] = useState("");
    const [remarkBusy, setRemarkBusy] = useState(false);

    const remarkInputRef = useRef(null);
    const editingRowRef = useRef(null);

    const [sort, setSort] = useState({
        key: "createdAt",
        dir: "desc",
    });

    // favorites (key -> true)
    const [favorites, setFavorites] = useState(() => {
        try {
            const raw = localStorage.getItem("admin_snapshots_favorites_v1");
            const parsed = raw ? JSON.parse(raw) : {};
            return parsed && typeof parsed === "object" ? parsed : {};
        } catch {
            return {};
        }
        });

        useEffect(() => {
        try {
            localStorage.setItem("admin_snapshots_favorites_v1", JSON.stringify(favorites));
        } catch {
            // ignore
        }
    }, [favorites]);

    // deploy history (truth source)
    const [deployHistory, setDeployHistory] = useState(null);
    const [historyErr, setHistoryErr] = useState("");

    // selection
    const [selectedKeys, setSelectedKeys] = useState([]);

    // bulk modals
    const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);   // soft-delete bulk
    const [bulkRestoreOpen, setBulkRestoreOpen] = useState(false); // restore bulk
    const [bulkPurgeOpen, setBulkPurgeOpen] = useState(false);     // permanent delete bulk

    const [bulkBusy, setBulkBusy] = useState(false);
    const selectedCount = selectedKeys.length;

    // tabs
    const [activeTab, setActiveTab] = useState(() => {
        try {
            const raw = localStorage.getItem(SNAPSHOTS_UI_STATE_KEY);
            const parsed = raw ? JSON.parse(raw) : null;
            const t = parsed?.activeTab;
            return t === "analytics" || t === "profile" ? t : "profile";
        } catch {
            return "profile";
        }
    }); // "profile" | "analytics"

    const activeName = activeTab === "profile" ? "ci_deploy" : "analytics";
    const isProfileTab = activeTab === "profile";

    // focused row (per-tab)
    const [focusedRowByTab, setFocusedRowByTab] = useState(() => ({
    profile: "",
    analytics: "",
    }));

    const focusedKey = focusedRowByTab?.[activeTab] || "";

    const clearFocus = useCallback(() => {
        setFocusedRowByTab((prev) => ({ ...(prev || {}), [activeTab]: "" }));
    }, [activeTab]);

    useEffect(() => {
        try {
            const raw = localStorage.getItem(SNAPSHOTS_UI_STATE_KEY);
            const prev = raw ? JSON.parse(raw) : {};
            const next = {
            ...(prev && typeof prev === "object" ? prev : {}),
            activeTab,
            showTrash,
            };
            localStorage.setItem(SNAPSHOTS_UI_STATE_KEY, JSON.stringify(next));
        } catch {
            // ignore
        }
    }, [activeTab, showTrash]);

    const focusRow = useCallback(
    (key) => {
        setFocusedRowByTab((prev) => ({ ...(prev || {}), [activeTab]: key }));
    },
    [activeTab]
    );

    // Query Search state (per tab)
    const [queryOpen, setQueryOpen] = useState(false);

    // per-tab query config (scalable if more tabs added later)
    const [queryByTab, setQueryByTab] = useState(() => {
    try {
        const raw = localStorage.getItem("admin_snapshots_query_v1");
        const parsed = raw ? JSON.parse(raw) : null;
        const base = {};
        TAB_IDS.forEach((t) => (base[t] = null));
        return parsed && typeof parsed === "object" ? { ...base, ...parsed } : base;
    } catch {
        const base = {};
        TAB_IDS.forEach((t) => (base[t] = null));
        return base;
    }
    });

    useEffect(() => {
    try {
        localStorage.setItem("admin_snapshots_query_v1", JSON.stringify(queryByTab));
    } catch {
        // ignore
    }
    }, [queryByTab]);

    const activeQuery = queryByTab?.[activeTab] || null;
    const selectedColumnIds =
    activeQuery?.selectCols?.length
        ? activeQuery.selectCols
        : TAB_CONFIG?.[activeTab]?.defaultSelect || [];

    const startEditRemark = useCallback((key, current) => {
        setRemarkEditKey(key);
        setRemarkDraft(String(current || ""));

        requestAnimationFrame(() => {
            // ✅ scroll row into view first
            editingRowRef.current?.scrollIntoView({
            block: "center",
            inline: "nearest",
            behavior: "smooth",
            });

            // ✅ then focus input
            requestAnimationFrame(() => {
            remarkInputRef.current?.focus();
            remarkInputRef.current?.select();
            });
        });
    }, []);

    const cancelEditRemark = useCallback(() => {
        setRemarkEditKey("");
        setRemarkDraft("");
    }, []);

    const addFavoritesForSelected = useCallback(() => {
        if (!selectedKeys.length) return;

        setFavorites((prev) => {
            const next = { ...(prev || {}) };
            selectedKeys.forEach((k) => {
            if (k) next[k] = true;
            });
            return next;
        });
    }, [selectedKeys]);

    const removeFavoritesForSelected = useCallback(() => {
        if (!selectedKeys.length) return;

        setFavorites((prev) => {
            const next = { ...(prev || {}) };
            selectedKeys.forEach((k) => {
            if (k) delete next[k];
            });
            return next;
        });
    }, [selectedKeys]);

    const refresh = useCallback(async () => {
        setLoading(true);
        setErr("");
        try {
        const res = await listSnapshots({ name: activeName });
        setItems(Array.isArray(res) ? res : []);
        setSelectedKeys([]);
        } catch (e) {
        setErr(String(e?.message || e));
        } finally {
        setLoading(false);
        }
    }, [activeName]);

    useEffect(() => {
        setSelectedKeys([]);
    }, [showTrash, activeTab]);

    const refreshTrash = useCallback(async () => {
        setTrashLoading(true);
        setErr("");
        try {
        const res = await listTrashSnapshots({ name: activeName });
        setTrashItems(Array.isArray(res) ? res : []);
        setSelectedKeys([]);
        } catch (e) {
        setErr(String(e?.message || e));
        } finally {
        setTrashLoading(false);
        }
    }, [activeName]);

    const refreshHistory = useCallback(async () => {
        setHistoryErr("");
        try {
        const h = await getDeployHistory();
        setDeployHistory(h || null);
        } catch (e) {
        setDeployHistory(null);
        setHistoryErr(String(e?.message || e));
        }
    }, []);

    const refreshAll = useCallback(async () => {
        clearFocus(); // immediate defocus
        await Promise.all([refresh(), refreshTrash(), refreshHistory()]);
    }, [clearFocus, refresh, refreshTrash, refreshHistory]);

    const doBulkDelete = useCallback(async () => {
        if (!selectedKeys.length) return;

        setBulkBusy(true);
        setErr("");

        try {
            await Promise.all(selectedKeys.map((k) => deleteSnapshot(k)));
            setBulkDeleteOpen(false);
            setSelectedKeys([]);
            await refresh();
        } catch (e) {
            setErr(String(e?.message || e));
        } finally {
            setBulkBusy(false);
        }
    }, [selectedKeys, refresh]);

    const saveEditRemark = useCallback(async () => {
        if (!remarkEditKey) return;

        setRemarkBusy(true);
        setErr("");

        try {
            await updateSnapshotRemark({
            key: remarkEditKey,
            remark: String(remarkDraft || "").trim(),
            });

            if (showTrash) {
            await refreshTrash();
            } else {
            await refresh();
            }

            setRemarkEditKey("");
            setRemarkDraft("");
        } catch (e) {
            setErr(String(e?.message || e));
        } finally {
            setRemarkBusy(false);
        }
    }, [remarkEditKey, remarkDraft, showTrash, refresh, refreshTrash]);

    const doBulkRestore = useCallback(async () => {
        if (!selectedKeys.length) return;

        setBulkBusy(true);
        setErr("");

        try {
            await Promise.all(selectedKeys.map((k) => restoreSnapshot(k)));
            setBulkRestoreOpen(false);
            setSelectedKeys([]);
            await refresh();
            await refreshTrash();
            setShowTrash(false);
        } catch (e) {
            setErr(String(e?.message || e));
        } finally {
            setBulkBusy(false);
        }
    }, [selectedKeys, refresh, refreshTrash]);

    const doBulkPurge = useCallback(async () => {
        if (!selectedKeys.length) return;

        setBulkBusy(true);
        setErr("");

        try {
        await Promise.all(selectedKeys.map((k) => purgeSnapshot(k)));
        setBulkPurgeOpen(false);
        setSelectedKeys([]);
        await refreshTrash();
        } catch (e) {
        setErr(String(e?.message || e));
        } finally {
        setBulkBusy(false);
        }
    }, [selectedKeys, refreshTrash]);

    const downloadRepoZip = useCallback(async (repoKey) => {
        const key = String(repoKey || "").trim();
        if (!key) return;

        try {
            const out = await presignRepoGet(key);
            const url = out?.url;
            if (!url) throw new Error("Missing presigned URL");

            const a = document.createElement("a");
            a.href = url;
            a.download = key.split("/").pop() || "repo.zip";
            document.body.appendChild(a);
            a.click();
            a.remove();
        } catch (e) {
            setErr(String(e?.message || e));
        }
    }, []);

    useEffect(() => {
        refresh();
        if (showTrash) {
            refreshTrash();
        } else {
            setTrashItems([]); // optional: keeps UI consistent
        }
    }, [refresh, refreshTrash, showTrash]);

    useEffect(() => {
        refreshHistory();
    }, [refreshHistory]);

    const anySelectedFavorited = useMemo(() => {
        if (!selectedKeys.length) return false;
        return selectedKeys.some((k) => Boolean(favorites?.[k]));
    }, [selectedKeys, favorites]);

    const anySelectedNotFavorited = useMemo(() => {
        if (!selectedKeys.length) return false;
        return selectedKeys.some((k) => !favorites?.[k]);
    }, [selectedKeys, favorites]);

    const rows = useMemo(() => {
        const source = showTrash ? trashItems : items;
        return (source || []).map((it) => {
            const meta = parseMetaFromKey(it.key || "");
            return {
            ...it,
            filename: it.filename || meta.filename,
            from: it.from || meta.from,
            to: it.to || meta.to,
            createdAt: it.createdAt || meta.createdAt,          // label (display)
            createdAtIso: it.createdAtIso || meta.createdAtIso, // ✅ sortable
            };
        });
    }, [items, trashItems, showTrash]);

    const visibleRows = useMemo(() => {
    const base = [...(rows || [])];

    // base sort = your current UI sort (headers)
    base.sort((a, b) => {
        let av;
        let bv;

        switch (sort.key) {
        case "from":
            av = a.from === "—" ? "" : a.from;
            bv = b.from === "—" ? "" : b.from;
            return comparePrimitive(av, bv, sort.dir);

        case "to":
            av = a.to === "—" ? "" : a.to;
            bv = b.to === "—" ? "" : b.to;
            return comparePrimitive(av, bv, sort.dir);

        case "createdAt":
            av = toTime(a.createdAtIso);
            bv = toTime(b.createdAtIso);
            return comparePrimitive(av, bv, sort.dir);

        case "size":
            av = Number(a.size || 0);
            bv = Number(b.size || 0);
            return comparePrimitive(av, bv, sort.dir);

        default:
            return 0;
        }
    });

    // If a query exists for this tab, override:
    const q = queryByTab?.[activeTab];
    if (!q) return base;

    // 1) filters (key:value)
    let out = applyKeyValueFilters(base, activeTab, q.filters);

    // 2) order by (override)
    if (q.orderBy) {
        const sortable = sortableColsForTab(activeTab);
        const byId = Object.fromEntries(sortable.map((c) => [c.id, c]));
        const col = byId[q.orderBy];

        if (col?.sortKey) {
        const sortKey = col.sortKey;

        out = [...out].sort((a, b) => {
            let av;
            let bv;

            if (sortKey === "from") {
            av = a.from === "—" ? "" : a.from;
            bv = b.from === "—" ? "" : b.from;
            return comparePrimitive(av, bv, q.orderDir);
            }
            if (sortKey === "to") {
            av = a.to === "—" ? "" : a.to;
            bv = b.to === "—" ? "" : b.to;
            return comparePrimitive(av, bv, q.orderDir);
            }
            if (sortKey === "createdAt") {
            av = toTime(a.createdAtIso);
            bv = toTime(b.createdAtIso);
            return comparePrimitive(av, bv, q.orderDir);
            }
            if (sortKey === "size") {
            av = Number(a.size || 0);
            bv = Number(b.size || 0);
            return comparePrimitive(av, bv, q.orderDir);
            }
            return 0;
        });
        }
    }

    // 3) limit
    if (typeof q.limit === "number" && q.limit > 0) {
        out = out.slice(0, q.limit);
    }

    return out;
    }, [rows, sort, activeTab, queryByTab]);


  const activeGitSha = deployHistory?.active?.gitSha || "";
  const prevGitSha = deployHistory?.previous?.gitSha || "";

  const allKeysOnScreen = useMemo(
    () => visibleRows.map((r) => r.key).filter(Boolean),
    [visibleRows]
  );

  const allSelectedOnScreen =
    allKeysOnScreen.length > 0 &&
    allKeysOnScreen.every((k) => selectedKeys.includes(k));

  const toggleSelectAll = useCallback(() => {
    setSelectedKeys((prev) => {
      if (allSelectedOnScreen) return [];
      return allKeysOnScreen.slice(); // select all visible
    });
  }, [allKeysOnScreen, allSelectedOnScreen]);

  const toggleRow = useCallback((key) => {
    setSelectedKeys((prev) => {
      if (prev.includes(key)) return prev.filter((k) => k !== key);
      return [...prev, key];
    });
  }, []);

  const openPreview = useCallback(async (key) => {
    setPreviewKey(key);
    setPreviewJson(null);
    setPreviewErr("");
    setPreviewOpen(true);
    setPreviewLoading(true);

    try {
      const json = await fetchSnapshotJson(key);
      setPreviewJson(json);
    } catch (e) {
      setPreviewErr(String(e?.message || e));
    } finally {
      setPreviewLoading(false);
    }
  }, []);

//   const askDelete = useCallback((key) => {
//     setDeleteKey(key);
//     setDeleteOpen(true);
//     setErr("");
//   }, []);

  const doDelete = useCallback(async () => {
    if (!deleteKey) return;
    setDeleteBusy(true);
    setErr("");

    try {
      await deleteSnapshot(deleteKey);

      setDeleteOpen(false);
      setDeleteKey("");

      if (showTrash) {
        await refreshTrash();
      } else {
        await refresh();
      }
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setDeleteBusy(false);
    }
  }, [deleteKey, refresh, refreshTrash, showTrash]);

  const askDeploy = useCallback(async (key) => {
    setDeployErr("");
    setDeployKey(key);
    setDeployMeta(null);
    setDeployOpen(true);

    try {
        const row = rows.find((r) => r.key === key);
        const shaFromList = row?.meta?.gitSha || "";
        const checkpointFromList = row?.meta?.checkpointTag || "";
        const pvFromList = row?.meta?.profileVersionId || "";

        // ✅ Prefer list meta (fast path)
        if (shaFromList) {
        setDeployMeta({
            gitSha: shaFromList,
            checkpointTag: checkpointFromList || null,
            profileVersion: pvFromList || null,
        });
        return;
        }

        // fallback: fetch snapshot JSON (older snapshots)
        const snap = await fetchSnapshotJson(key);
        const meta = extractDeployMetaFromSnapshotJson(snap);

        if (!meta?.gitSha) {
        setDeployErr(
            "This snapshot has no git SHA (metadata or JSON). Re-publish snapshot with build meta."
        );
        return;
        }

        setDeployMeta(meta);
    } catch (e) {
        setDeployErr(String(e?.message || e));
    }
  }, [rows]);

  const doDeploy = useCallback(async () => {
    if (!deployMeta?.gitSha) return;

    setDeployBusy(true);
    setDeployErr("");

    try {
      const res = await triggerDeploy({
        gitSha: deployMeta.gitSha,
        checkpointTag: deployMeta.checkpointTag,
        profileVersion: deployMeta.profileVersion,
        reason: "owner redeploy from snapshots UI",
        sourceSnapshotKey: deployKey,
      });

      // close modal
      setDeployOpen(false);
      setDeployKey("");
      setDeployMeta(null);

      // optionally show run URL in the main error line area (as success)
      if (res?.runUrl) {
        setErr(`✅ Deploy triggered. Run: ${res.runUrl}`);
      } else {
        setErr(`✅ Deploy triggered.`);
      }
    } catch (e) {
      setDeployErr(String(e?.message || e));
    } finally {
      setDeployBusy(false);
    }
  }, [deployMeta, deployKey]);

//   const askRestore = useCallback((key) => {
//     setRestoreKey(key);
//     setRestoreOpen(true);
//     setErr("");
//   }, []);

  const doRestore = useCallback(async () => {
    if (!restoreKey) return;
    setRestoreBusy(true);
    setErr("");

    try {
      await restoreSnapshot(restoreKey);

      setRestoreOpen(false);
      setRestoreKey("");

      await refresh();
      await refreshTrash();
      setShowTrash(false);
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setRestoreBusy(false);
    }
  }, [restoreKey, refresh, refreshTrash]);

  const tabsRow = (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="inline-flex rounded-full border border-gray-200/70 dark:border-white/10 bg-white/60 dark:bg-white/10 p-1">
        <button
          type="button"
          onClick={() => setActiveTab("profile")}
          className={cx(
            "px-3 py-1.5 rounded-full text-xs font-semibold transition",
            activeTab === "profile"
              ? "bg-purple-600 text-white shadow-sm"
              : "text-gray-700 dark:text-gray-200 hover:bg-white/80 dark:hover:bg-white/15"
          )}
          title="Show Profile snapshots"
        >
          Profile
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("analytics")}
          className={cx(
            "px-3 py-1.5 rounded-full text-xs font-semibold transition",
            activeTab === "analytics"
              ? "bg-purple-600 text-white shadow-sm"
              : "text-gray-700 dark:text-gray-200 hover:bg-white/80 dark:hover:bg-white/15"
          )}
          title="Show Analytics snapshots"
        >
          Analytics
        </button>
      </div>
    </div>
  );

  const headerRight = (
    <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">

            <label className="inline-flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300 select-none">
                <input
                type="checkbox"
                className="h-4 w-4 accent-purple-600"
                checked={showTrash}
                onChange={(e) => setShowTrash(e.target.checked)}
                />
                Show archived (trash)
            </label>

            <ActionButton
                onClick={refreshAll}
                title="Refresh snapshots + trash"
            >
                Refresh
            </ActionButton>

            {selectedCount > 0 ? (
                <div className="flex items-center gap-2">
                <div className="text-xs text-gray-600 dark:text-gray-400">
                    Selected: <span className="font-semibold">{selectedCount}</span>
                </div>

                {/* Add Favorite — only if at least one selected row is NOT a favorite */}
                {anySelectedNotFavorited ? (
                    <ActionButton
                        variant="neutral"
                        onClick={addFavoritesForSelected}
                        disabled={showTrash}
                        title={showTrash ? "Favorites disabled in Trash" : "Mark selected rows as favorite"}
                    >
                        Add Favorite
                    </ActionButton>
                    ) : null}

                    {/* Remove Favorite — only if at least one selected row IS a favorite */}
                    {anySelectedFavorited ? (
                    <ActionButton
                        variant="neutral"
                        onClick={removeFavoritesForSelected}
                        disabled={showTrash}
                        title={showTrash ? "Favorites disabled in Trash" : "Unmark selected rows as favorite"}
                    >
                        Remove Favorite
                    </ActionButton>
                ) : null}

                {!showTrash ? (
                    <ActionButton
                    variant="danger"
                    onClick={() => setBulkDeleteOpen(true)}
                    title="Move selected snapshots to trash"
                    >
                    Move to trash
                    </ActionButton>
                ) : (
                    <>
                    <ActionButton
                        variant="purple"
                        onClick={() => setBulkRestoreOpen(true)}
                        title="Restore selected snapshots"
                    >
                        Restore
                    </ActionButton>

                    <ActionButton
                        variant="danger"
                        onClick={() => setBulkPurgeOpen(true)}
                        title="Permanently delete selected snapshots"
                    >
                        Delete forever
                    </ActionButton>
                    </>
                )}

                <ActionButton
                    onClick={() => setSelectedKeys([])}
                    title="Clear selection"
                >
                    Clear
                </ActionButton>
                </div>
            ) : null}

            <ActionButton
                variant="purple"
                onClick={() => setQueryOpen(true)}
                title="Build a SQL-like query for this table"
            >
                Query search
            </ActionButton>

            <IconButton
                onClick={() => setTableExpandOpen(true)}
                title="Expand table"
            >
                <HiOutlineArrowsExpand className="h-5 w-5" />
            </IconButton>

        </div>
    </div>
  );


  return (
    <section className="py-0 px-4 transition-colors">
      <SectionHeader icon={FaRegSave} title="Snapshots" />

      <div className="px-6 space-y-6">
        <p className="mt-10 text-gray-600 dark:text-gray-400 max-w-3xl">
          Owner-only snapshot archive stored privately in S3. Preview, download, and delete
          (recoverable via Trash).
        </p>

        {err ? (
          <div className="text-sm text-red-600 dark:text-red-400 whitespace-pre-wrap break-words">
            {err}
          </div>
        ) : null}

        {historyErr ? (
          <div className="text-xs text-amber-700 dark:text-amber-300 whitespace-pre-wrap break-words">
            ⚠️ Deploy history unavailable: {historyErr}
          </div>
        ) : null}

        <SectionCard
          title={showTrash ? "Archived snapshots" : "Saved snapshots"}
          subtitle={showTrash ? "Trash (recoverable)" : "Newest first"}
          action={headerRight}
        >
          <div className="mb-4">
            {tabsRow}
          </div>

          {loading && !showTrash ? (
            <div className="text-sm text-gray-600 dark:text-gray-400">Loading…</div>
          ) : trashLoading && showTrash ? (
            <div className="text-sm text-gray-600 dark:text-gray-400">Loading trash…</div>
          ) : visibleRows.length ? (
            <div className="relative rounded-2xl border border-gray-200/70 dark:border-white/10 bg-white/40 dark:bg-white/5 overflow-hidden">
              {/* <button
                type="button"
                onClick={() => setTableExpandOpen(true)}
                title="Expand table"
                className={cx(
                    "absolute top-3 right-3 z-20",
                    "text-gray-600 dark:text-gray-300",
                    "hover:text-purple-700 dark:hover:text-purple-300",
                    "transition",
                    "focus:outline-none"
                )}
                >
                <HiOutlineArrowsExpand className="h-5 w-5" />
              </button> */}

              <SnapshotsTable
                containerClassName="max-h-[520px] overflow-auto"
                selectedColumnIds={selectedColumnIds}
                visibleRows={visibleRows}
                isProfileTab={isProfileTab}
                activeTab={activeTab}
                focusedKey={focusedKey}
                focusRow={focusRow}
                selectedKeys={selectedKeys}
                toggleRow={toggleRow}
                allSelectedOnScreen={allSelectedOnScreen}
                toggleSelectAll={toggleSelectAll}
                sort={sort}
                setSort={setSort}
                openPreview={openPreview}
                favorites={favorites}
                activeGitSha={activeGitSha}
                prevGitSha={prevGitSha}
                showTrash={showTrash}
                askDeploy={askDeploy}
                downloadRepoZip={downloadRepoZip}
                remarkEditKey={remarkEditKey}
                remarkDraft={remarkDraft}
                setRemarkDraft={setRemarkDraft}
                remarkBusy={remarkBusy}
                saveEditRemark={saveEditRemark}
                cancelEditRemark={cancelEditRemark}
                startEditRemark={startEditRemark}
                remarkInputRef={remarkInputRef} 
                editingRowRef={editingRowRef}
              />
            </div>
          ) : (
            <div className="text-sm text-gray-600 dark:text-gray-400">
                {showTrash
                    ? "Trash is empty."
                    : isProfileTab
                    ? "No Profile snapshots yet. CI will create these after deploy."
                    : "No Analytics snapshots yet. Publish one from Analytics."}
            </div>
          )}
        </SectionCard>
      </div>

      <PreviewModal
        open={previewOpen}
        title={previewKey ? previewKey.split("/").slice(-1)[0] : "Snapshot preview"}
        json={previewJson}
        loading={previewLoading}
        error={previewErr}
        onClose={() => setPreviewOpen(false)}
        onDownload={() => {
          const name = previewKey ? previewKey.split("/").slice(-1)[0] : "snapshot.json";
          downloadJson(name, previewJson);
        }}
      />

      <ExpandedTableModal
        open={tableExpandOpen}
        onClose={() => setTableExpandOpen(false)}
        title={activeTab === "profile" ? "Profile snapshots (expanded)" : "Analytics snapshots (expanded)"}
      >
        <div className="rounded-2xl border border-gray-200/70 dark:border-white/10 bg-white/40 dark:bg-white/5 overflow-hidden">
          <SnapshotsTable
            containerClassName="overflow-auto"   // ✅ no 520px cap
            selectedColumnIds={selectedColumnIds}
            visibleRows={visibleRows}
            isProfileTab={isProfileTab}
            activeTab={activeTab}
            focusedKey={focusedKey}
            focusRow={focusRow}
            selectedKeys={selectedKeys}
            toggleRow={toggleRow}
            allSelectedOnScreen={allSelectedOnScreen}
            toggleSelectAll={toggleSelectAll}
            sort={sort}
            setSort={setSort}
            openPreview={openPreview}
            favorites={favorites}
            activeGitSha={activeGitSha}
            prevGitSha={prevGitSha}
            showTrash={showTrash}
            askDeploy={askDeploy}
            downloadRepoZip={downloadRepoZip}
            remarkEditKey={remarkEditKey}
            remarkDraft={remarkDraft}
            setRemarkDraft={setRemarkDraft}
            remarkBusy={remarkBusy}
            saveEditRemark={saveEditRemark}
            cancelEditRemark={cancelEditRemark}
            startEditRemark={startEditRemark}
            remarkInputRef={remarkInputRef}
            editingRowRef={editingRowRef}
          />
        </div>
      </ExpandedTableModal>

      <QuerySearchModal
        open={queryOpen}
        onClose={() => setQueryOpen(false)}
        activeTab={activeTab}
        tabs={TAB_CONFIG}
        getColsForTab={(t) => selectableColsForTab(t)}
        getSortableColsForTab={(t) => sortableColsForTab(t)}
        initial={queryByTab?.[activeTab] || {
            fromTab: activeTab,
            selectCols: [],      // ✅ none by default
            orderBy: "",         // ✅ none
            orderDir: "desc",    // ✅ desc default
            limit: undefined,    // ✅ placeholder "e.g. 50"
            filters: [],
        }}
        onApply={(q) => {
            // Switch to the chosen From tab (as requested)
            if (q?.fromTab && q.fromTab !== activeTab) {
            setActiveTab(q.fromTab);
            }

            // store query under that tab
            setQueryByTab((prev) => ({
            ...(prev || {}),
            [q.fromTab || activeTab]: q,
            }));

            // also sync your table sort headers to match order-by (optional, but nice)
            const sortable = sortableColsForTab(q.fromTab || activeTab);
            const byId = Object.fromEntries(sortable.map((c) => [c.id, c]));
            const col = byId[q.orderBy];
            if (col?.sortKey) {
            setSort({ key: col.sortKey, dir: q.orderDir || "desc" });
            }
        }}
        onClear={() => {
            setQueryByTab((prev) => ({
            ...(prev || {}),
            [activeTab]: null,
            }));
        }}
      />

      <ConfirmModal
        open={deleteOpen}
        title="Delete snapshot?"
        body="This is a soft-delete: we move it to S3 trash so it disappears from the main list but can be restored."
        confirmText="Delete"
        confirmVariant="danger"
        busy={deleteBusy}
        onClose={() => setDeleteOpen(false)}
        onConfirm={doDelete}
        extra={
          <div className="text-xs text-gray-600 dark:text-gray-400 break-words">
            <span className="font-semibold text-gray-800 dark:text-gray-200">Key:</span>{" "}
            {deleteKey}
          </div>
        }
      />

      <ConfirmModal
        open={bulkDeleteOpen}
        title="Move selected snapshots to trash?"
        body={`This will move ${selectedCount} snapshot(s) to Trash (recoverable).`}
        confirmText="Move to trash"
        confirmVariant="danger"
        busy={bulkBusy}
        onClose={() => setBulkDeleteOpen(false)}
        onConfirm={doBulkDelete}
        extra={
            <div className="max-h-[260px] overflow-auto pr-1">
                <div className="text-xs text-gray-600 dark:text-gray-400 break-words space-y-2">
                {selectedKeys.map((k) => (
                    <div
                    key={k}
                    className="rounded-md bg-gray-50/70 dark:bg-white/5 border border-gray-200/60 dark:border-white/10 px-3 py-2"
                    >
                    {k}
                    </div>
                ))}
                </div>
            </div>
        }
      />

      <ConfirmModal
        open={bulkRestoreOpen}
        title="Restore selected snapshots?"
        body={`This will restore ${selectedCount} snapshot(s) from Trash.`}
        confirmText="Restore"
        confirmVariant="purple"
        busy={bulkBusy}
        onClose={() => setBulkRestoreOpen(false)}
        onConfirm={doBulkRestore}
      />

      <ConfirmModal
        open={bulkPurgeOpen}
        title="Delete selected snapshots forever?"
        body={`This will permanently delete ${selectedCount} snapshot(s). This cannot be undone.`}
        confirmText="Delete forever"
        confirmVariant="danger"
        busy={bulkBusy}
        onClose={() => setBulkPurgeOpen(false)}
        onConfirm={doBulkPurge}
      />

      <ConfirmModal
        open={deployOpen}
        title="Deploy this version to production?"
        body={
          deployErr
            ? "Fix the issue below and try again."
            : "This will trigger a GitHub Actions workflow to redeploy GitHub Pages at the selected commit."
        }
        confirmText="Deploy"
        confirmVariant="green"
        busy={deployBusy}
        onClose={() => {
          setDeployOpen(false);
          setDeployErr("");
        }}
        onConfirm={doDeploy}
        extra={
          <div className="space-y-2 text-xs text-gray-700 dark:text-gray-300">
            <div className="break-words">
              <span className="font-semibold text-gray-800 dark:text-gray-200">
                Snapshot key:
              </span>{" "}
              {deployKey || "—"}
            </div>

            <div className="break-words">
              <span className="font-semibold text-gray-800 dark:text-gray-200">
                Git SHA:
              </span>{" "}
              {deployMeta?.gitSha ? deployMeta.gitSha.slice(0, 12) : "—"}
            </div>

            <div className="break-words">
              <span className="font-semibold text-gray-800 dark:text-gray-200">
                Checkpoint:
              </span>{" "}
              {deployMeta?.checkpointTag || "—"}
            </div>

            <div className="break-words">
              <span className="font-semibold text-gray-800 dark:text-gray-200">
                Profile version:
              </span>{" "}
              {deployMeta?.profileVersion || "—"}
            </div>

            {deployErr ? (
              <div className="mt-2 text-red-600 dark:text-red-400 whitespace-pre-wrap break-words">
                {deployErr}
              </div>
            ) : null}
          </div>
        }
      />

      <ConfirmModal
        open={restoreOpen}
        title="Restore snapshot?"
        body="This will move the snapshot back from trash into the active snapshots list."
        confirmText="Restore"
        confirmVariant="purple"
        busy={restoreBusy}
        onClose={() => setRestoreOpen(false)}
        onConfirm={doRestore}
        extra={
          <div className="text-xs text-gray-600 dark:text-gray-400 break-words">
            <span className="font-semibold text-gray-800 dark:text-gray-200">Key:</span>{" "}
            {restoreKey}
          </div>
        }
      />
    </section>
  );
}
