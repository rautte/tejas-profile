// src/components/admin/Snapshots.js

import { useEffect, useMemo, useState, useCallback } from "react";
import { FaRegSave } from "react-icons/fa";

import SectionHeader from "../shared/SectionHeader";
import { cx } from "../../utils/cx";
import { CARD_SURFACE, CARD_ROUNDED_2XL } from "../../utils/ui";
import { listSnapshots, fetchSnapshotJson } from "../../utils/snapshots/snapshotsApi";

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

function prettyBytes(n) {
  if (!n) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function downloadJson(filename, json) {
  const blob = new Blob([JSON.stringify(json, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function AdminSnapshots() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [selectedKey, setSelectedKey] = useState("");
  const [selectedJson, setSelectedJson] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const res = await listSnapshots();
      // snapshotsApi.listSnapshots() returns json.items (array)
      setItems(Array.isArray(res) ? res : []);
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const onOpen = useCallback(async (key) => {
    setSelectedKey(key);
    setSelectedJson(null);
    setErr("");
    setPreviewLoading(true);

    try {
      const json = await fetchSnapshotJson(key);
      setSelectedJson(json);
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setPreviewLoading(false);
    }
  }, []);

  const titleRight = useMemo(() => {
    return (
      <button
        type="button"
        onClick={refresh}
        className="px-3 py-2 rounded-lg text-xs font-medium border border-gray-200/70 dark:border-white/10 bg-white/60 dark:bg-white/10 text-gray-800 dark:text-gray-100 hover:bg-white/80 dark:hover:bg-white/15 transition shadow-sm"
      >
        Refresh
      </button>
    );
  }, [refresh]);

  return (
    <section className="py-0 px-4 transition-colors">
      <SectionHeader icon={FaRegSave} title="Snapshots" />

      <div className="px-6 space-y-6">
        <p className="mt-10 text-gray-600 dark:text-gray-400 max-w-3xl">
          Owner-only snapshot archive stored privately in S3. Click any snapshot to preview.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SectionCard title="Saved snapshots" subtitle="Newest first" action={titleRight}>
            {loading ? (
              <div className="text-sm text-gray-600 dark:text-gray-400">Loading…</div>
            ) : err ? (
              <div className="text-sm text-red-600 dark:text-red-400 whitespace-pre-wrap break-words">
                {err}
              </div>
            ) : items.length ? (
              <div className="space-y-2">
                {items.map((it) => {
                  const filename = it.key?.split("/").slice(-1)[0] || it.key;
                  const isActive = selectedKey === it.key;

                  return (
                    <button
                      key={it.key}
                      type="button"
                      onClick={() => onOpen(it.key)}
                      className={cx(
                        "w-full text-left rounded-xl border px-4 py-3 transition",
                        isActive
                          ? "border-purple-500/60 dark:border-purple-400/50 bg-purple-50/50 dark:bg-white/10"
                          : "border-gray-200/70 dark:border-white/10 bg-white/50 dark:bg-white/5 hover:bg-white/70 dark:hover:bg-white/10"
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                            {filename}
                          </div>
                          <div className="mt-0.5 text-[12px] text-gray-600 dark:text-gray-400 truncate">
                            {it.key}
                          </div>
                        </div>
                        <div className="shrink-0 text-[12px] text-gray-600 dark:text-gray-400 text-right">
                          <div>{prettyBytes(it.size)}</div>
                          <div>
                            {it.lastModified ? new Date(it.lastModified).toLocaleString() : ""}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="text-sm text-gray-600 dark:text-gray-400">
                No snapshots yet. Publish one from Analytics.
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Preview"
            subtitle={selectedKey ? selectedKey : "Select a snapshot to preview"}
            action={
              selectedJson ? (
                <button
                  type="button"
                  onClick={() => downloadJson(selectedKey.split("/").slice(-1)[0], selectedJson)}
                  className="px-3 py-2 rounded-lg text-xs font-medium border border-gray-200/70 dark:border-white/10 bg-white/60 dark:bg-white/10 text-gray-800 dark:text-gray-100 hover:bg-white/80 dark:hover:bg-white/15 transition shadow-sm"
                >
                  Download JSON
                </button>
              ) : null
            }
          >
            {!selectedKey ? (
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Pick a snapshot from the left.
              </div>
            ) : previewLoading ? (
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Loading snapshot…
              </div>
            ) : err ? (
              <div className="text-sm text-red-600 dark:text-red-400 whitespace-pre-wrap break-words">
                {err}
              </div>
            ) : selectedJson ? (
              <pre className="text-[12px] leading-relaxed whitespace-pre-wrap break-words text-gray-800 dark:text-gray-100">
                {JSON.stringify(selectedJson, null, 2)}
              </pre>
            ) : (
              <div className="text-sm text-gray-600 dark:text-gray-400">
                No data to preview.
              </div>
            )}
          </SectionCard>
        </div>
      </div>
    </section>
  );
}
