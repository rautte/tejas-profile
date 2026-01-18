// src/components/admin/Snapshots.js


import { useEffect, useMemo, useState, useCallback } from "react";
import { HiOutlineEye } from "react-icons/hi";
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
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[310] flex items-center justify-center px-4">
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


  const refresh = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const res = await listSnapshots();
      setItems(Array.isArray(res) ? res : []);
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshTrash = useCallback(async () => {
    setTrashLoading(true);
    setErr("");
    try {
      const res = await listTrashSnapshots();
      setTrashItems(Array.isArray(res) ? res : []);
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setTrashLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (showTrash) refreshTrash();
  }, [showTrash, refreshTrash]);

  const rows = useMemo(() => {
    const source = showTrash ? trashItems : items;
    return (source || []).map((it) => {
      const meta = parseMetaFromKey(it.key || "");
      return {
        ...it,
        ...meta,
      };
    });
  }, [items, trashItems, showTrash]);

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

  const askDelete = useCallback((key) => {
    setDeleteKey(key);
    setDeleteOpen(true);
    setErr("");
  }, []);

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
      // fetch the snapshot JSON so we can find gitSha
      const snap = await fetchSnapshotJson(key);
      const meta = extractDeployMetaFromSnapshotJson(snap);

      if (!meta?.gitSha) {
        setDeployErr(
          "This snapshot JSON does not contain a git SHA. Add build meta to snapshots when publishing."
        );
        return;
      }

      setDeployMeta(meta);
    } catch (e) {
      setDeployErr(String(e?.message || e));
    }
  }, []);

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

  const askRestore = useCallback((key) => {
    setRestoreKey(key);
    setRestoreOpen(true);
    setErr("");
  }, []);

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

  const headerRight = useMemo(() => {
    return (
      <div className="flex items-center gap-2">
        <label className="inline-flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300 select-none">
          <input
            type="checkbox"
            className="h-4 w-4 accent-purple-600"
            checked={showTrash}
            onChange={(e) => setShowTrash(e.target.checked)}
          />
          Show archived (trash)
        </label>

        <ActionButton onClick={refresh} title="Refresh list">
          Refresh
        </ActionButton>

        {showTrash ? (
          <ActionButton onClick={refreshTrash} title="Refresh trash">
            Refresh trash
          </ActionButton>
        ) : null}
      </div>
    );
  }, [refresh, refreshTrash, showTrash]);

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
                <table className="min-w-[980px] w-full text-sm">
                  <thead className="sticky top-0 z-10 bg-gray-100/90 dark:bg-[#121224]/90 backdrop-blur border-b border-gray-200/70 dark:border-white/10">
                    <tr className="text-left text-xs text-gray-600 dark:text-gray-300">
                      <th className="py-3 px-4 font-semibold whitespace-nowrap">Preview</th>
                      <th className="py-3 px-4 font-semibold">Filename</th>
                      {/* <th className="py-3 px-4 font-semibold whitespace-nowrap">Category</th> */}
                      <th className="py-3 px-4 font-semibold whitespace-nowrap">From_Date</th>
                      <th className="py-3 px-4 font-semibold whitespace-nowrap">To_Date</th>
                      <th className="py-3 px-4 font-semibold whitespace-nowrap">Created_At</th>
                      <th className="py-3 px-4 font-semibold whitespace-nowrap">Size</th>
                      <th className="py-3 px-4 font-semibold whitespace-nowrap">Analytics_Key</th>
                      <th className="py-3 px-4 font-semibold whitespace-nowrap">Deploy</th>
                      <th className="py-3 px-4 font-semibold whitespace-nowrap">
                        {showTrash ? "Restore" : "Delete"}
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {rows.map((it) => (
                      <tr key={it.key} className="border-t border-gray-200/60 dark:border-white/10">
                        <td className="text-xs py-3 px-4 whitespace-nowrap">
                          <ActionButton
                            variant="green"
                            onClick={() => openPreview(it.key)}
                            title="Open preview"
                          >
                            <HiOutlineEye className="text-base" />
                          </ActionButton>
                        </td>

                        <td className="text-xs py-3 px-4">
                          <div className="font-semibold text-gray-900 dark:text-gray-100">
                            {it.filename}
                          </div>
                        </td>

                        {/* <td className="text-xs py-3 px-4 whitespace-nowrap text-gray-700 dark:text-gray-300">
                          {it.category}
                        </td> */}

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
                          <div className="text-[12px] text-gray-600 dark:text-gray-400">
                            {it.key}
                          </div>
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

                        <td className="text-xs py-3 px-4 whitespace-nowrap">
                          {showTrash ? (
                            <ActionButton
                              variant="purple"
                              onClick={() => askRestore(it.key)}
                              title="Restore snapshot from trash"
                            >
                              Restore
                            </ActionButton>
                          ) : (
                            <ActionButton
                              variant="danger"
                              onClick={() => askDelete(it.key)}
                              title="Soft-delete (move to trash)"
                            >
                              Delete
                            </ActionButton>
                          )}
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
