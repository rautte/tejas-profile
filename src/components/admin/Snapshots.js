// src/components/admin/Snapshots.js


import { useEffect, useMemo, useState, useCallback } from "react";
import { HiOutlineEye, HiOutlineClipboardCopy } from "react-icons/hi";
import { FaRegSave } from "react-icons/fa";

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
} from "../../utils/snapshots/snapshotsApi";

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

  const createdAt =
    createdAtIso && !Number.isNaN(Date.parse(createdAtIso))
      ? new Date(createdAtIso).toLocaleString()
      : "—";

  return { filename, from, to, createdAt };
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

function shortSha(sha) {
  return sha ? String(sha).slice(0, 12) : "";
}

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
            "p-1 rounded-md border border-gray-200/70 dark:border-white/10",
            "bg-white/80 dark:bg-[#0b0b12]/70",
            "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
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

  const [showTrash, setShowTrash] = useState(false);

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

  const refresh = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const res = await listSnapshots();
      setItems(Array.isArray(res) ? res : []);
      setSelectedKeys([]);
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setSelectedKeys([]);
  }, [showTrash]);

  const refreshTrash = useCallback(async () => {
    setTrashLoading(true);
    setErr("");
    try {
      const res = await listTrashSnapshots();
      setTrashItems(Array.isArray(res) ? res : []);
      setSelectedKeys([]);
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setTrashLoading(false);
    }
  }, []);

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
    await Promise.all([refresh(), refreshTrash(), refreshHistory()]);
  }, [refresh, refreshTrash, refreshHistory]);

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

  useEffect(() => {
    refresh();
    refreshHistory();
  }, [refresh, refreshHistory]);

  useEffect(() => {
    if (showTrash) refreshTrash();
  }, [showTrash, refreshTrash]);

  const rows = useMemo(() => {
    const source = showTrash ? trashItems : items;
    return (source || []).map((it) => {
        const meta = parseMetaFromKey(it.key || "");
        return {
        ...it,
        // ✅ only fill if missing
        filename: it.filename || meta.filename,
        from: it.from || meta.from,
        to: it.to || meta.to,
        createdAt: it.createdAt || meta.createdAt,
        };
    });
  }, [items, trashItems, showTrash]);

  const activeGitSha = deployHistory?.active?.gitSha || "";
  const prevGitSha = deployHistory?.previous?.gitSha || "";

  const allKeysOnScreen = useMemo(() => rows.map((r) => r.key).filter(Boolean), [rows]);

//   useEffect(() => {
//     let cancelled = false;

//     async function fillMissingShas() {
//         const keys = rows.map((r) => r.key).filter(Boolean);
//         const MAX = 40;
//         const missing = keys.filter((k) => !snapShaByKey[k]).slice(0, MAX);
//         if (!missing.length) return;

//         try {
//         const results = await Promise.all(
//             missing.map(async (k) => {
//             try {
//                 const snap = await fetchSnapshotJson(k);
//                 const meta = extractDeployMetaFromSnapshotJson(snap);
//                 return [k, meta?.gitSha || ""];
//             } catch {
//                 return [k, ""];
//             }
//             })
//         );

//         if (cancelled) return;

//         setSnapShaByKey((prev) => {
//             const next = { ...prev };
//             for (const [k, sha] of results) next[k] = sha;
//             return next;
//         });
//         } catch {
//         // ignore
//         }
//     }

//     fillMissingShas();
//     return () => {
//         cancelled = true;
//     };
//   // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [rows]); // intentionally only rows

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
        </div>
    </div>
  );

  return (
    <section className="py-0 px-4 transition-colors">
      <SectionHeader icon={FaRegSave} title="Snapshots" />

      <div className="px-6 space-y-6">
        <p className="mt-10 text-gray-600 dark:text-gray-400 max-w-3xl">
          Owner-only snapshot archive stored privately in S3. Preview, download, and soft-delete
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
          {loading && !showTrash ? (
            <div className="text-sm text-gray-600 dark:text-gray-400">Loading…</div>
          ) : trashLoading && showTrash ? (
            <div className="text-sm text-gray-600 dark:text-gray-400">Loading trash…</div>
          ) : rows.length ? (
            <div className="rounded-2xl border border-gray-200/70 dark:border-white/10 bg-white/40 dark:bg-white/5 overflow-hidden">
              <div className="max-h-[520px] overflow-auto">
                <table className="min-w-[1480px] w-full text-sm">
                  <thead className="sticky top-0 z-10 bg-gray-100/90 dark:bg-[#121224]/90 backdrop-blur border-b border-gray-200/70 dark:border-white/10">
                    <tr className="text-left text-xs text-gray-600 dark:text-gray-300">
                        <th className="py-3 px-4 font-semibold whitespace-nowrap">
                            <input
                            type="checkbox"
                            className="h-4 w-4 accent-purple-600"
                            checked={allSelectedOnScreen}
                            onChange={toggleSelectAll}
                            title="Select all"
                            />
                        </th>
                        <th className="py-3 px-4 font-semibold whitespace-nowrap">Preview</th>
                        <th className="py-3 px-4 font-semibold whitespace-nowrap">Profile_Version_ID</th>
                        {/* <th className="py-3 px-4 font-semibold whitespace-nowrap">Dummy</th> */}
                        <th className="py-3 px-4 font-semibold">Filename</th>
                        <th className="py-3 px-4 font-semibold whitespace-nowrap">Git_SHA</th>
                        <th className="py-3 px-4 font-semibold whitespace-nowrap">Category</th>
                        <th className="py-3 px-4 font-semibold whitespace-nowrap">Tag_Key</th>
                        <th className="py-3 px-4 font-semibold whitespace-nowrap">Tag_Value</th>
                        <th className="py-3 px-4 font-semibold whitespace-nowrap">Checkpoint</th>
                        <th className="py-3 px-4 font-semibold whitespace-nowrap">From_Date</th>
                        <th className="py-3 px-4 font-semibold whitespace-nowrap">To_Date</th>
                        <th className="py-3 px-4 font-semibold whitespace-nowrap">Created_At</th>
                        <th className="py-3 px-4 font-semibold whitespace-nowrap">Size</th>
                        <th className="py-3 px-4 font-semibold whitespace-nowrap">Analytics_Key</th>
                        <th className="py-3 px-4 font-semibold whitespace-nowrap">Deploy</th>
                    </tr>
                  </thead>

                  <tbody>
                    {rows.map((it) => (
                      <tr key={it.key} className="border-t border-gray-200/60 dark:border-white/10">

                        <td className="text-xs py-3 px-4 whitespace-nowrap">
                            <input
                                type="checkbox"
                                className="h-4 w-4 accent-purple-600"
                                checked={selectedKeys.includes(it.key)}
                                onChange={() => toggleRow(it.key)}
                                title="Select"
                            />
                        </td>

                        <td className="text-xs py-3 px-4 whitespace-nowrap">
                          <ActionButton
                            variant="green"
                            onClick={() => openPreview(it.key)}
                            title="Open preview"
                          >
                            <HiOutlineEye className="text-base" />
                          </ActionButton>
                        </td>

                        <td className="text-xs py-3 px-4 whitespace-nowrap">
                            <CopyHoverCell
                                value={it.meta?.profileVersionId || ""}
                                title={it.meta?.profileVersionId || ""}
                                textClassName="text-[12px] text-gray-700 dark:text-gray-300 font-mono"
                                showCopy={Boolean(it.meta?.profileVersionId)}
                            />
                        </td>
{/* 
                        <td className="text-xs py-3 px-4 whitespace-nowrap text-gray-700 dark:text-gray-300">
                            {"—"}
                        </td> */}

                        <td className="text-xs py-3 px-4">
                          <div className="flex items-center gap-2 min-w-0">
                            <CopyHoverCell
                                value={it.filename}
                                title={it.filename}
                                textClassName="font-semibold text-gray-900 dark:text-gray-100 truncate"
                                // maxWidthClass="max-w-[360px]"
                            />

                            {/* badges */}
                            {(() => {
                              const sha = it.meta?.gitSha || "";
                              const isActive = sha && activeGitSha && sha === activeGitSha;
                              const isPrev = sha && prevGitSha && sha === prevGitSha;

                              if (!isActive && !isPrev) return null;

                              return (
                                <div className="flex items-center gap-1 shrink-0">
                                  {isActive ? (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide border border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                                      ACTIVE
                                    </span>
                                  ) : null}
                                  {isPrev ? (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide border border-amber-500/30 bg-amber-500/15 text-amber-800 dark:text-amber-300">
                                      LAST USED
                                    </span>
                                  ) : null}
                                </div>
                              );
                            })()}
                          </div>

                          {/* optional: show sha under filename (tiny) */}
                          {/* {snapShaByKey[it.key] ? (
                            <div className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                              {shortSha(snapShaByKey[it.key])}
                            </div>
                          ) : null} */}
                        </td>

                        <td className="text-xs py-3 px-4 whitespace-nowrap">
                            <CopyHoverCell
                                value={shortSha(it.meta?.gitSha || "")}
                                title={it.meta?.gitSha || ""}
                                textClassName="text-[12px] text-gray-700 dark:text-gray-300 font-mono"
                            />
                        </td>

                        <td className="text-xs py-3 px-4 whitespace-nowrap text-gray-700 dark:text-gray-300">
                            {it.meta?.category || "—"}
                        </td>

                        <td className="text-xs py-3 px-4 whitespace-nowrap text-gray-700 dark:text-gray-300">
                            {it.meta?.tagKey || "—"}
                        </td>

                        <td className="text-xs py-3 px-4 whitespace-nowrap text-gray-700 dark:text-gray-300">
                            {it.meta?.tagValue || "—"}
                        </td>

                        <td className="text-xs py-3 px-4 whitespace-nowrap text-gray-700 dark:text-gray-300">
                            {it.meta?.checkpointTag || "unknown"}
                        </td>

                        <td className="text-xs py-3 px-4 whitespace-nowrap text-gray-700 dark:text-gray-300">
                          {it.from}
                        </td>

                        <td className="text-xs py-3 px-4 whitespace-nowrap text-gray-700 dark:text-gray-300">
                          {it.to}
                        </td>

                        <td className="text-xs py-3 px-4 whitespace-nowrap text-gray-700 dark:text-gray-300">
                          {it.createdAt}
                        </td>

                        <td className="text-xs py-3 px-4 whitespace-nowrap text-gray-700 dark:text-gray-300">
                          {prettyKB(it.size)}
                        </td>

                        <td className="py-3 px-4">
                          {/* <div className="text-[12px] text-gray-600 dark:text-gray-400 truncate max-w-[320px]"> */}
                          <CopyHoverCell
                            value={it.key}
                            title={it.key}
                            textClassName="text-[12px] text-gray-600 dark:text-gray-400 font-mono"
                            maxWidthClass="max-w-[420px]"
                          />
                        </td>

                        <td className="text-xs py-3 px-4 whitespace-nowrap">
                            <ActionButton
                                variant="green"
                                disabled={showTrash}
                                onClick={() => askDeploy(it.key)}
                                title={showTrash ? "Restore first, then deploy" : "Deploy this snapshot's version"}
                            >
                                Deploy
                            </ActionButton>
                        </td>

                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {showTrash ? "Trash is empty." : "No snapshots yet. Publish one from Analytics."}
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
