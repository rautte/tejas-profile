// src/components/admin/Analytics.js

import { useMemo, useState, useEffect, useCallback } from "react";
import { FaChartLine } from "react-icons/fa";

import { readBuildProfileVersion } from "../../utils/profileVersion";
import { SECTION_ORDER } from "../../data/App";

import SectionHeader from "../shared/SectionHeader";
import { cx } from "../../utils/cx";
import { CARD_SURFACE, CARD_ROUNDED_2XL } from "../../utils/ui";
import { loadGeoDataset, searchGeo } from "../../utils/geo/geoDataset";

import {
  computeOverview,
  computeTimeSeries,
  computeRecentSessions,
  getAllEvents,
  resetAnalytics,
} from "../../utils/analytics";

import {
  presignPutSnapshot,
  uploadSnapshotToS3,
  commitSnapshotMeta,
} from "../../utils/snapshots/snapshotsApi";


// -----------------------------
// Small helpers
// -----------------------------
function msToHuman(ms) {
  if (!ms) return "0s";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  return `${h}h`;
}

function nonEmptyOrUnknown(s) {
  const v = String(s || "").trim();
  return v || "unknown";
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function formatFromDate(ts) {
  if (!ts) return "—";
  try {
    return new Date(ts).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
    });
  } catch {
    return "—";
  }
}

function formatYMD(ts) {
  if (!ts) return "unknown";
  const d = new Date(ts);
  const yyyy = d.getFullYear();
  const mm = pad2(d.getMonth() + 1);
  const dd = pad2(d.getDate());
  return `${yyyy}-${mm}-${dd}`;
}

function downloadJsonFile(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function safeTagKey(s) {
  return String(s || "").trim().replace(/\s+/g, "_").slice(0, 64);
}

function safeTagValue(s) {
  return String(s || "").trim().slice(0, 180);
}


export function buildAnalyticsSnapshot({
  events,
  overview,
  granularity,
  series,
  tags,
  geo,
}) {
  const pv = readBuildProfileVersion();

  return {
    schema: "tejas-profile.analytics.snapshot.v2",
    createdAt: new Date().toISOString(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,

    category: "Analytics",
    profileVersion: {
      id: pv.id,
      sections: pv.sections || SECTION_ORDER,
      manifestKey: pv.manifestKey || null,
      gitSha: pv.gitSha || null,
      buildTime: pv.buildTime || null,
      repo: pv.repo || {
        provider: "github",
        repo: null,
        commit: null,
        ref: null,
        buildRunId: null,
        checkpointTag: null,
        artifactUrl: null,
        artifactKey: null,
        artifactSha256: null,
      },
    },

    tags: tags && Object.keys(tags).length ? tags : undefined,
    geo: geo || undefined,

    granularity,
    counts: {
      events: events.length,
      sessions: overview?.sessionCount ?? 0,
    },
    overview,
    series,
    rawEvents: events,
  };
}

// Resume-style section card wrapper (header + body)
function SectionCard({ title, action, actionBelow, subtitle, children }) {
  return (
    <div className={cx(CARD_SURFACE, CARD_ROUNDED_2XL)}>
      <div className="px-6 py-3 border-b rounded-t-2xl bg-gray-200/70 dark:bg-gray-700/70 border-gray-200/70 dark:border-white/10">
        <div className="flex items-start sm:items-center justify-between gap-3">
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

        {actionBelow ? (
          <div className="mt-2">{actionBelow}</div>
        ) : null}
      </div>

      <div className="px-6 py-5">{children}</div>
    </div>
  );
}


function KpiCard({ title, value, sub }) {
  return (
    <div className="rounded-2xl bg-white/60 dark:bg-white/5 border border-gray-200/70 dark:border-white/10 backdrop-blur-xl p-4 shadow-sm">
      <div className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {title}
      </div>
      <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">
        {value}
      </div>
      {sub ? (
        <div className="mt-1 text-[12px] text-gray-600 dark:text-gray-400">
          {sub}
        </div>
      ) : null}
    </div>
  );
}

function SimpleBarChart({ data, height = 160 }) {
  const shown = data.slice(0, 10);
  const max = Math.max(1, ...shown.map((d) => d.value));

  return (
    <div className="w-full">
      <div className="w-full overflow-hidden rounded-xl border border-gray-200/70 dark:border-white/10 bg-white/40 dark:bg-white/5">
        <svg viewBox={`0 0 100 ${height}`} className="w-full h-[180px]">
          {shown.map((d, i) => {
            const w = 100 / Math.max(10, shown.length);
            const x = i * w + 2;
            const barW = w - 4;
            const barH = (d.value / max) * (height - 24);
            const y = height - 12 - barH;

            return (
              <g key={d.section ?? d.key ?? i}>
                <rect
                  x={x}
                  y={y}
                  width={barW}
                  height={barH}
                  rx="2"
                  className="fill-purple-500/70"
                />
                <text
                  x={x + barW / 2}
                  y={height - 2}
                  textAnchor="middle"
                  fontSize="6"
                  className="fill-gray-500 dark:fill-gray-400"
                >
                  {(d.section ?? d.key ?? "").slice(0, 6)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

function SimpleLineChart({ points }) {
  const w = 100;
  const h = 60;
  const pad = 6;

  const max = Math.max(1, ...points.map((p) => p.value));
  const min = 0;

  const path = points
    .map((p, i) => {
      const x = pad + (i * (w - pad * 2)) / Math.max(1, points.length - 1);
      const y = h - pad - ((p.value - min) * (h - pad * 2)) / (max - min || 1);
      return `${i === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");

  return (
    <div className="w-full overflow-hidden rounded-xl border border-gray-200/70 dark:border-white/10 bg-white/40 dark:bg-white/5 p-3">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-[140px]">
        <path
          d={path}
          className="fill-none stroke-purple-500/80"
          strokeWidth="2"
        />
      </svg>
      <div className="mt-2 flex items-center justify-between text-[11px] text-gray-600 dark:text-gray-400">
        <span>{points[0]?.key ?? ""}</span>
        <span>{points.at(-1)?.key ?? ""}</span>
      </div>
    </div>
  );
}

function SegButton({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "px-3 py-1.5 rounded-full text-xs border transition font-medium",
        active
          ? "bg-purple-600 text-white border-purple-600 shadow-sm"
          : "bg-white/60 dark:bg-white/10 text-gray-700 dark:text-gray-200 border-gray-200/70 dark:border-white/10 hover:bg-white/80 dark:hover:bg-white/15"
      )}
    >
      {children}
    </button>
  );
}

function SmallActionButton({
  variant = "neutral",
  children,
  onClick,
  title,
  disabled,
}) {
  const base =
    "inline-flex items-center gap-2 text-xs px-3 py-2 rounded-lg border transition font-medium shadow-sm disabled:opacity-60 disabled:cursor-not-allowed";
  const styles =
    variant === "danger"
      ? "border-red-500/70 dark:border-red-600/70 text-gray-50 bg-gradient-to-br from-red-800/90 via-red-700/90 to-red-600/90 dark:from-red-600/80 dark:via-red-600/60 dark:to-red-600/50 hover:from-red-900/90 hover:via-red-800/90 hover:to-red-700/90 dark:hover:from-red-500/80 dark:hover:via-red-500/60 dark:hover:to-red-500/50"
      : "border-gray-200/70 dark:border-white/10 bg-white/60 dark:bg-white/10 text-gray-800 dark:text-gray-100 hover:bg-white/80 dark:hover:bg-white/15";

  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={cx(base, styles)}
    >
      {children}
    </button>
  );
}

function GeoTypeahead({
  value,
  onValueChange,
  onSelectGeo,
  disabled,
  placeholder = "e.g. Seattle, US",
}) {
  const [dataset, setDataset] = useState([]);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setLoading(true);
        const data = await loadGeoDataset();
        if (mounted) setDataset(Array.isArray(data) ? data : []);
      } catch (e) {
        if (mounted) setErr(String(e?.message || e));
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const q = String(value || "").trim();

  const results = useMemo(() => {
    if (!q) return [];
    if (!dataset?.length) return [];
    return searchGeo(dataset, q, 8);
  }, [dataset, q]);

  // Show dropdown when user is typing something (even if no matches => we show Other)
  const shouldShowDropdown = open && !!q;

  const showOtherOnly = shouldShowDropdown && !loading && results.length === 0;

  return (
    <div className="relative">
      <input
        value={value}
        onChange={(e) => {
          onValueChange(e.target.value);
          setOpen(true);

          // IMPORTANT: typing invalidates selection; user must re-select from dropdown
          onSelectGeo(null);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          // tiny delay so click works
          window.setTimeout(() => setOpen(false), 120);
        }}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full rounded-lg border border-gray-200/70 dark:border-white/10 bg-white/70 dark:bg-white/10 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 outline-none"
      />

      {err ? (
        <div className="mt-1 text-[12px] text-amber-700 dark:text-amber-300">
          Geo dataset unavailable — you can still choose “Other”. ({err})
        </div>
      ) : null}

      {shouldShowDropdown ? (
        <div className="absolute z-[260] mt-2 w-full overflow-hidden rounded-xl border border-gray-200/70 dark:border-white/10 bg-white/95 dark:bg-[#0b0b12]/95 backdrop-blur-xl shadow-2xl">
          {loading ? (
            <div className="px-3 py-2 text-sm text-gray-600 dark:text-gray-300">
              Loading…
            </div>
          ) : null}

          {!loading && results.length ? (
            results.map((r) => (
              <button
                key={r.id}
                type="button"
                disabled={disabled}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onValueChange(r.display || `${r.city}, ${r.countryCode}`);
                  onSelectGeo({
                    hint: r.display || `${r.city}, ${r.countryCode}`,
                    city: r.city,
                    region: r.region || null,
                    country: r.country || null,
                    countryCode: r.countryCode,
                    lat: typeof r.lat === "number" ? r.lat : null,
                    lng: typeof r.lng === "number" ? r.lng : null,
                    source: "dataset",
                    datasetId: r.id,
                    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                    locale: typeof navigator !== "undefined" ? navigator.language : undefined,
                  });
                  setOpen(false);
                }}
                className="w-full text-left px-3 py-2 text-sm text-gray-900 dark:text-gray-100 hover:bg-gray-100/70 dark:hover:bg-white/10 transition"
              >
                <div className="font-medium">{r.display}</div>
                <div className="text-[12px] text-gray-600 dark:text-gray-400">
                  {r.lat != null && r.lng != null ? `${r.lat.toFixed(4)}, ${r.lng.toFixed(4)}` : "—"}
                  <span className="mx-2">•</span>
                  {r.countryCode}
                </div>
              </button>
            ))
          ) : null}

          {/* ✅ If nothing matches: show only "Other" */}
          {showOtherOnly ? (
            <button
                type="button"
                disabled={disabled}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                const typed = String(value || "").trim();

                // ✅ UI value should become "Other" (not the typed text)
                onValueChange("Other");

                // ✅ Persist strict selection
                onSelectGeo({
                    hint: "Other",              // <-- required behavior
                    city: null,
                    region: null,
                    country: null,
                    countryCode: null,
                    lat: null,
                    lng: null,
                    source: "other",
                    datasetId: null,

                    // Optional: keep what user typed (so you can inspect later)
                    typedHint: typed || null,

                    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                    locale: typeof navigator !== "undefined" ? navigator.language : undefined,
                });

                setOpen(false);
                }}
                className="w-full text-left px-3 py-2 text-sm text-gray-900 dark:text-gray-100 hover:bg-gray-100/70 dark:hover:bg-white/10 transition"
            >
                <div className="font-medium">Other</div>
                <div className="text-[12px] text-gray-600 dark:text-gray-400">
                No such city exists: “{String(value || "").trim()}”
                </div>
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}



// ✅ A small modal for optional tag + optional geo hint (city/country)
// City/country is “hint” for now (real geo should be enriched server-side later).
function PublishOptionsModal({
  open,
  onClose,
  onConfirm,
  busy,
  defaultTagKey = "",
  defaultTagValue = "",
  defaultGeoHint = "",
  profileVersion,
}) {
  const [tagKey, setTagKey] = useState(defaultTagKey);
  const [tagValue, setTagValue] = useState(defaultTagValue);
  const [geoHint, setGeoHint] = useState(defaultGeoHint);
  const [geoSelected, setGeoSelected] = useState(null);

  const geoHintTrimmed = String(geoHint || "").trim();
  const canPublish = Boolean(geoSelected) && Boolean(geoHintTrimmed);

  const [remark, setRemark] = useState("");

  useEffect(() => {
    if (!open) return;
    setTagKey(defaultTagKey);
    setTagValue(defaultTagValue);
    setGeoHint(defaultGeoHint);
    setRemark("");
    setGeoSelected(null);
  }, [open, defaultTagKey, defaultTagValue, defaultGeoHint]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center px-4">
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/45"
      />

      <div className="relative w-full max-w-md rounded-2xl border border-gray-200/70 dark:border-white/10 bg-white/90 dark:bg-[#0b0b12]/90 backdrop-blur-xl shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200/70 dark:border-white/10">
          <div className="text-base font-semibold text-gray-900 dark:text-gray-100">
            Publish options
          </div>
          <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Geo hint is required for Analytics snapshots. Tag is optional.
          </div>
          <div>
            <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Remark (optional)
            </div>
            <input
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                placeholder="e.g. hero copy experiment, Jan 2026"
                className="w-full rounded-lg border border-gray-200/70 dark:border-white/10 bg-white/70 dark:bg-white/10 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 outline-none"
            />
            <div className="mt-1 text-[12px] text-gray-500 dark:text-gray-400">
                This will appear in Admin → Snapshots and can be edited later.
            </div>
          </div>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Tag key
              </div>
              <input
                value={tagKey}
                onChange={(e) => setTagKey(e.target.value)}
                placeholder="e.g. experiment"
                className="w-full rounded-lg border border-gray-200/70 dark:border-white/10 bg-white/70 dark:bg-white/10 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 outline-none"
              />
            </div>
            <div>
              <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Tag value
              </div>
              <input
                value={tagValue}
                onChange={(e) => setTagValue(e.target.value)}
                placeholder="e.g. A/B-hero-A"
                className="w-full rounded-lg border border-gray-200/70 dark:border-white/10 bg-white/70 dark:bg-white/10 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 outline-none"
              />
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Geo hint <span className="text-red-600 dark:text-red-400">*</span>
            </div>
            <GeoTypeahead
                value={geoHint}
                onValueChange={(v) => {
                    setGeoHint(v);
                    // if user edits text after selecting, we keep selection unless they clear it
                    if (!String(v || "").trim()) setGeoSelected(null);
                }}
                onSelectGeo={(g) => setGeoSelected(g)}
                disabled={busy}
                placeholder="e.g. Seattle, US"
            />

            {(!geoHintTrimmed || !geoSelected) ? (
                <div className="mt-1 text-[12px] text-red-600 dark:text-red-400">
                    Choose a value from the dropdown (or select “Other”).
                </div>
            ) : null}

            <div className="mt-1 text-[12px] text-gray-500 dark:text-gray-400">
                Select from suggestions (dataset) for best accuracy, or type manually.
            </div>
          </div>

          <div className="rounded-xl border border-gray-200/70 dark:border-white/10 bg-white/50 dark:bg-white/5 p-3">
            <div className="text-[12px] text-gray-700 dark:text-gray-300">
              Snapshot will store:
            </div>
            <div className="mt-1 text-[12px] text-gray-600 dark:text-gray-400">
              <div>category: Analytics</div>
              <div>profileVersion.id: {profileVersion?.id || "unknown"}</div>
              <div>gitSha: {profileVersion?.gitSha ? String(profileVersion.gitSha).slice(0,10) + "…" : "—"}</div>
              <div>timezone: {Intl.DateTimeFormat().resolvedOptions().timeZone}</div>
              <div>locale: {typeof navigator !== "undefined" ? navigator.language : "—"}</div>
              <div>geo.hint: {geoHintTrimmed || "—"}</div>
            </div>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-gray-200/70 dark:border-white/10 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="px-3 py-2 rounded-lg text-sm font-medium border border-gray-200/70 dark:border-white/10 bg-white/60 dark:bg-white/10 text-gray-800 dark:text-gray-100 hover:bg-white/80 dark:hover:bg-white/15 transition disabled:opacity-60"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={() => {
                const k = safeTagKey(tagKey);
                const v = safeTagValue(tagValue);

                // ✅ define tags properly (optional)
                const tags = k && v ? { [k]: v } : {};

                // const hint = safeTagValue(geoHintTrimmed);

                // If user picked a dataset suggestion, use that structured geo.
                // Otherwise fall back to manual parsing (Phase-3 behavior).
                if (!geoSelected) return;
                // const geo = geoSelected;

                onConfirm({ tags, geo: geoSelected, remark: safeTagValue(remark) || "" });

            }}
            disabled={busy || !canPublish}
            className="px-3 py-2 rounded-lg text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 transition shadow-sm disabled:opacity-60"
          >
            {busy ? "Publishing…" : "Publish"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmResetModal({ open, onClose, onConfirm, defaultChecked = true, busy }) {
  const [saveSnapshot, setSaveSnapshot] = useState(defaultChecked);
  const [tagKey, setTagKey] = useState("");
  const [tagValue, setTagValue] = useState("");
  const [geoHint, setGeoHint] = useState("");
  const [remark, setRemark] = useState("");
  const [geoSelected, setGeoSelected] = useState(null);

  useEffect(() => {
    if (open) {
      setSaveSnapshot(defaultChecked);
      setTagKey("");
      setTagValue("");
      setGeoHint("");
      setRemark("");
      setGeoSelected(null);
    }
  }, [open, defaultChecked]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center px-4">
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
      />
      <div className="relative w-full max-w-md rounded-2xl border border-gray-200/70 dark:border-white/10 bg-white/90 dark:bg-[#0b0b12]/90 backdrop-blur-xl shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200/70 dark:border-white/10">
          <div className="text-base font-semibold text-gray-900 dark:text-gray-100">
            Reset analytics?
          </div>
          <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            This will delete all locally stored analytics on this browser.
          </div>
        </div>

        <div className="px-5 py-4 space-y-3">
          <label className="flex items-start gap-3 text-sm text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 accent-purple-600"
              checked={saveSnapshot}
              onChange={(e) => setSaveSnapshot(e.target.checked)}
              disabled={busy}
            />
            <span>
              Publish a snapshot to S3 before reset
              <span className="block text-[12px] text-gray-500 dark:text-gray-400">
                Recommended (keeps a backup you can view in Admin → Snapshots)
              </span>
            </span>
          </label>

          {saveSnapshot ? (
            <div className="mt-2 space-y-3 rounded-xl border border-gray-200/70 dark:border-white/10 bg-white/50 dark:bg-white/5 p-3">
              <div className="text-[12px] font-semibold text-gray-700 dark:text-gray-300">
                Optional tag + geo hint (saved into the snapshot)
              </div>

              <div className="grid grid-cols-2 gap-3">
                <input
                  value={tagKey}
                  onChange={(e) => setTagKey(e.target.value)}
                  placeholder="tag key"
                  className="w-full rounded-lg border border-gray-200/70 dark:border-white/10 bg-white/70 dark:bg-white/10 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 outline-none"
                  disabled={busy}
                />
                <input
                  value={tagValue}
                  onChange={(e) => setTagValue(e.target.value)}
                  placeholder="tag value"
                  className="w-full rounded-lg border border-gray-200/70 dark:border-white/10 bg-white/70 dark:bg-white/10 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 outline-none"
                  disabled={busy}
                />
              </div>

              <div>
                <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Geo hint <span className="text-red-600 dark:text-red-400">*</span>
                </div>
                <GeoTypeahead
                    value={geoHint}
                    onValueChange={(v) => {
                        setGeoHint(v);
                        if (!String(v || "").trim()) setGeoSelected(null);
                    }}
                    onSelectGeo={(g) => setGeoSelected(g)}
                    disabled={busy}
                    placeholder="e.g. Seattle, US"
                />
                {saveSnapshot && (!String(geoHint || "").trim() || !geoSelected) ? (
                    <div className="mt-1 text-[12px] text-red-600 dark:text-red-400">
                        Choose a value from the dropdown (or select “Other”).
                    </div>
                ) : null}
              </div>

              <input
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                placeholder="remark (optional)"
                className="w-full rounded-lg border border-gray-200/70 dark:border-white/10 bg-white/70 dark:bg-white/10 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 outline-none"
                disabled={busy}
              />

            </div>
          ) : null}
        </div>

        <div className="px-5 py-4 border-t border-gray-200/70 dark:border-white/10 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="px-3 py-2 rounded-lg text-sm font-medium border border-gray-200/70 dark:border-white/10 bg-white/60 dark:bg-white/10 text-gray-800 dark:text-gray-100 hover:bg-white/80 dark:hover:bg-white/15 transition disabled:opacity-60"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={() => {
              const k = safeTagKey(tagKey);
              const v = safeTagValue(tagValue);
              const tags = k && v ? { [k]: v } : {};
              const geoHintTrimmed = String(geoHint || "").trim();

              // ✅ Only require geo hint if we are publishing a snapshot
              if (saveSnapshot && (!geoHintTrimmed || !geoSelected)) {
                return;
              }

              const geo = saveSnapshot ? geoSelected : null;

              onConfirm({ saveSnapshot, tags, geo, remark: safeTagValue(remark) || "" });
            }}
            disabled={busy}
            className="px-3 py-2 rounded-lg text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition shadow-sm disabled:opacity-60"
          >
            {busy ? "Working…" : "Reset"}
          </button>
        </div>
      </div>
    </div>
  );
}


export default function AdminAnalytics() {
  const pv = useMemo(() => readBuildProfileVersion(), []);
  const [granularity, setGranularity] = useState("day");
  const [events, setEvents] = useState(() => getAllEvents());
  const [resetOpen, setResetOpen] = useState(false);

  const [publishing, setPublishing] = useState(false);
  const [publishErr, setPublishErr] = useState("");
  const [publishOk, setPublishOk] = useState("");

  const [publishOptionsOpen, setPublishOptionsOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    return () => setConfirmClear(false);
  }, []);

  const firstTrackedTs = useMemo(() => {
    if (!events?.length) return null;
    let min = Infinity;

    for (const e of events) {
      const t =
        typeof e?.ts === "number"
          ? e.ts
          : typeof e?.timestamp === "number"
          ? e.timestamp
          : e?.createdAt
          ? Date.parse(e.createdAt)
          : e?.time
          ? Date.parse(e.time)
          : null;

      if (typeof t === "number" && Number.isFinite(t)) {
        if (t < min) min = t;
      }
    }

    return min === Infinity ? null : min;
  }, [events]);

  const fromLabel = useMemo(() => formatFromDate(firstTrackedTs), [firstTrackedTs]);

  const overview = useMemo(() => computeOverview(events), [events]);

  const series = useMemo(
    () => computeTimeSeries(events, granularity),
    [events, granularity]
  );

  const sectionViewsRanked = useMemo(() => {
    return [...(overview.sectionViews || [])].sort((a, b) => b.value - a.value);
  }, [overview.sectionViews]);

  const sectionTimeRanked = useMemo(() => {
    return [...(overview.sectionTimeMs || [])].sort((a, b) => b.value - a.value);
  }, [overview.sectionTimeMs]);

  const recentSessions = useMemo(() => computeRecentSessions(events, 20), [events]);

  const publishSnapshotToS3 = useCallback(
    async ({ tags = {}, geo = null, remark = "" } = {}) => {
      setPublishErr("");
      setPublishOk("");
      setPublishing(true);

      try {

        // Build snapshot at publish-time so it captures tags/geo/profileVersion accurately
        const snap = buildAnalyticsSnapshot({
          events,
          overview,
          granularity,
          series,
          tags,
          geo,
        });

        const from = firstTrackedTs ? formatYMD(firstTrackedTs) : null;
        const to = formatYMD(Date.now());
        const createdAt = snap?.createdAt || new Date().toISOString();

        // 1) Ask API for presigned PUT url + key
        const pvNow = readBuildProfileVersion();

        const geoHint = String(geo?.hint || "").trim();
        if (!geoHint) {
          throw new Error("Geo hint is required to publish an Analytics snapshot.");
        }
        const geoJson = geo ? JSON.stringify(geo) : "";

        const { key, url } = await presignPutSnapshot({
            from,
            to,
            createdAt,
            name: "analytics",
            category: "Analytics",
            tagKey: Object.keys(tags || {})[0] || "",
            tagValue: Object.values(tags || {})[0] || "",
            profileVersionId: nonEmptyOrUnknown(pvNow?.id),
            gitSha: nonEmptyOrUnknown(pvNow?.gitSha),
            checkpointTag: nonEmptyOrUnknown(pvNow?.repo?.checkpointTag),
            remark: String(remark || "").trim(),
            geoHint,
            geoJson,
        });

        // 1) Upload JSON first (no meta headers)
        await uploadSnapshotToS3(url, snap);

        // 2) Commit metadata server-side (writes x-amz-meta-geohint etc)
        await commitSnapshotMeta({
            key,
            meta: {
                category: "Analytics",
                tagKey: Object.keys(tags || {})[0] || "",
                tagValue: Object.values(tags || {})[0] || "",
                profileVersionId: nonEmptyOrUnknown(pvNow?.id),
                gitSha: nonEmptyOrUnknown(pvNow?.gitSha),
                checkpointTag: nonEmptyOrUnknown(pvNow?.repo?.checkpointTag),
                remark: String(remark || "").trim(),
                geoHint,
                geoJson,
            },
        });

        setPublishOk(`Published ✅ ${key.split("/").slice(-1)[0]}`);

      } catch (e) {
        setPublishErr(String(e?.message || e));
      } finally {
        setPublishing(false);
      }
    },
    [events, overview, granularity, series, firstTrackedTs]
  );

  const refreshEvents = useCallback(() => {
    // Always read from storage again (authoritative)
    const latest = getAllEvents();

    // Force a new array identity even if underlying array reference is same-ish
    setEvents(Array.isArray(latest) ? [...latest] : []);
  }, []);

  // For local download (no tags prompt needed)
  const snapshotForDownload = useMemo(() => {
    return buildAnalyticsSnapshot({
      events,
      overview,
      granularity,
      series,
      tags: {},
      geo: {
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        locale: typeof navigator !== "undefined" ? navigator.language : undefined,
      },
    });
  }, [events, overview, granularity, series]);

  return (
    <section className="py-0 px-4 transition-colors">
      <SectionHeader icon={FaChartLine} title="Analytics" />

      <div className="px-6 space-y-6">
        <p className="mt-10 text-gray-600 dark:text-gray-400 max-w-3xl">
          A lightweight, owner-only analytics dashboard stored locally in your browser.
          Use this to validate which sections visitors engage with most, and where attention drops off.
        </p>

        {publishErr ? (
          <div className="px-6">
            <div className="rounded-xl border border-red-300/60 dark:border-red-500/40 bg-red-50/60 dark:bg-red-950/30 px-4 py-3 text-sm text-red-800 dark:text-red-200 whitespace-pre-wrap break-words">
              {publishErr}
            </div>
          </div>
        ) : null}

        {publishOk ? (
          <div className="px-6">
            <div className="rounded-xl border border-emerald-300/60 dark:border-emerald-500/40 bg-emerald-50/60 dark:bg-emerald-950/20 px-4 py-3 text-sm text-emerald-900 dark:text-emerald-200">
              {publishOk}
            </div>
          </div>
        ) : null}

        <SectionCard
          title={
            <div className="flex items-center gap-2">
              <span>Overview</span>
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-white/60 dark:bg-white/10 border border-gray-200/70 dark:border-white/10 text-gray-700 dark:text-gray-200"
                title="Earliest event timestamp stored in this browser"
              >
                <span className="text-gray-500 dark:text-gray-400 font-medium">From:</span>
                <span>{fromLabel}</span>
              </span>

              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-white/60 dark:bg-white/10 border border-gray-200/70 dark:border-white/10 text-gray-700 dark:text-gray-200"
                title="Profile version id stored into snapshots"
              >
                <span className="text-gray-500 dark:text-gray-400 font-medium">Profile:</span>
                <span className="truncate max-w-[140px]">{pv?.id || "unknown"}</span>
              </span>
            </div>
          }
          subtitle="Quick health check across sessions and engagement"
          action={
            <div className="flex items-center gap-2">
              <SmallActionButton
                onClick={refreshEvents}
                title="Reload events from local storage"
                disabled={publishing}
              >
                Refresh
              </SmallActionButton>

              <SmallActionButton
                onClick={() => setPublishOptionsOpen(true)}
                title="Optional tag/geo hint → uploads snapshot to S3 via presigned URL"
                disabled={publishing}
              >
                {publishing ? "Publishing…" : "Publish snapshot"}
              </SmallActionButton>

              <SmallActionButton
                variant="neutral"
                title="Downloads the current snapshot JSON locally"
                onClick={() => {
                  const from = firstTrackedTs ? formatYMD(firstTrackedTs) : "unknown";
                  const to = formatYMD(Date.now());
                  const filename = `tejas-profile-analytics_from-${from}_to-${to}.json`;
                  downloadJsonFile(filename, snapshotForDownload);
                }}
                disabled={publishing}
              >
                Download JSON
              </SmallActionButton>

              <SmallActionButton
                variant="danger"
                title="Reset local analytics"
                onClick={() => setResetOpen(true)}
                disabled={publishing}
              >
                Reset
              </SmallActionButton>
            </div>
          }
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <KpiCard title="Sessions" value={overview.sessionCount} sub="per device/tab over time" />
            <KpiCard title="Avg time/session" value={msToHuman(overview.avgSessionMs)} sub="based on start/end events" />
            <KpiCard
              title="Avg sections/session"
              value={Number(overview.avgSectionsPerSession || 0).toFixed(2)}
              sub="section views ÷ sessions"
            />
            <KpiCard title="Top section" value={overview.topSection ?? "—"} sub="by views" />
            <KpiCard title="Events stored" value={events.length} sub="capped to avoid bloat" />
          </div>
        </SectionCard>

        <SectionCard
          title="Sessions over time"
          subtitle="Counts unique sessions by start time"
          action={
            <div className="flex items-center gap-2">
              <SegButton active={granularity === "day"} onClick={() => setGranularity("day")}>
                Day
              </SegButton>
              <SegButton active={granularity === "month"} onClick={() => setGranularity("month")}>
                Month
              </SegButton>
              <SegButton active={granularity === "year"} onClick={() => setGranularity("year")}>
                Year
              </SegButton>
            </div>
          }
        >
          {series.length >= 2 ? (
            <SimpleLineChart points={series} />
          ) : (
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Not enough data yet. Navigate around a bit.
            </div>
          )}
        </SectionCard>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SectionCard title="Most visited sections" subtitle="Ranked by section_view events">
            {sectionViewsRanked.length ? (
              <>
                <SimpleBarChart
                  data={sectionViewsRanked.map((d) => ({ section: d.section, value: d.value }))}
                />
                <div className="mt-4 space-y-1">
                  {sectionViewsRanked.slice(0, 8).map((d) => (
                    <div
                      key={d.section}
                      className="flex justify-between text-sm text-gray-700 dark:text-gray-300"
                    >
                      <span>{d.section}</span>
                      <span className="font-semibold">{d.value}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-sm text-gray-600 dark:text-gray-400">No section views yet.</div>
            )}
          </SectionCard>

          <SectionCard title="Time spent by section" subtitle="Sum of section_time durations">
            {sectionTimeRanked.length ? (
              <div className="space-y-2">
                {sectionTimeRanked.slice(0, 10).map((d) => (
                  <div key={d.section} className="flex items-center justify-between text-sm">
                    <span className="text-gray-700 dark:text-gray-300">{d.section}</span>
                    <span className="font-semibold text-gray-900 dark:text-gray-100">
                      {msToHuman(d.value)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-gray-600 dark:text-gray-400">No durations yet.</div>
            )}
          </SectionCard>
        </div>

        <SectionCard
            title="Recent sessions"
            subtitle="Local summary (last 20)"
            action={
                <div className="flex items-center gap-2">
                {/* <SmallActionButton
                    variant="danger"
                    title={confirmClear ? "Click again to confirm" : "Clear all analytics stored in this browser"}
                    onClick={() => {
                    if (!confirmClear) {
                        setConfirmClear(true);
                        window.setTimeout(() => setConfirmClear(false), 3000);
                        return;
                    }
                    resetAnalytics();
                    setEvents(getAllEvents());
                    setConfirmClear(false);
                    }}
                >
                    {confirmClear ? "Confirm clear" : "Clear data"}
                </SmallActionButton> */}
                </div>
            }
            actionBelow={
                confirmClear ? (
                <div className="text-xs text-red-600 dark:text-red-400">
                    Click <span className="font-semibold">Confirm clear</span> to delete analytics from this browser.
                </div>
                ) : null
            }
        >

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 dark:text-gray-400">
                  <th className="py-2 pr-3">Start</th>
                  <th className="py-2 pr-3">Sections</th>
                  <th className="py-2 pr-3">Time</th>
                  <th className="py-2 pr-3">Session</th>
                </tr>
              </thead>
              <tbody>
                {recentSessions.length ? (
                  recentSessions.map((s) => (
                    <tr
                      key={s.sessionId}
                      className="border-t border-gray-200/70 dark:border-white/10"
                    >
                      <td className="py-2 pr-3 text-gray-700 dark:text-gray-300">
                        {new Date(s.startTs).toLocaleString()}
                      </td>
                      <td className="py-2 pr-3 text-gray-700 dark:text-gray-300">
                        {s.sections}
                      </td>
                      <td className="py-2 pr-3 text-gray-700 dark:text-gray-300">
                        {msToHuman(s.totalMs)}
                      </td>
                      <td className="py-2 pr-3 text-gray-500 dark:text-gray-400">
                        {s.sessionId.slice(0, 10)}…
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="py-3 text-gray-600 dark:text-gray-400" colSpan={4}>
                      No sessions yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard title="Next metrics to add" subtitle="Quick roadmap for better signal">
          <ul className="text-sm text-gray-700 dark:text-gray-300 list-disc pl-5 space-y-1">
            <li>CTA clicks: Resume download, GitHub, LinkedIn, each project demo link.</li>
            <li>Funnel: About → Experience → Resume → Projects (drop-off).</li>
            <li>Timeline interactions: year scrubber moves, card expand, arrows.</li>
            <li>Deep-link landings: who enters via #/code-lab?…</li>
          </ul>
        </SectionCard>
      </div>

      {/* Publish options modal */}
      <PublishOptionsModal
        open={publishOptionsOpen}
        onClose={() => setPublishOptionsOpen(false)}
        busy={publishing}
        profileVersion={pv}
        onConfirm={async ({ tags, geo, remark }) => {
            setPublishOptionsOpen(false);
            await publishSnapshotToS3({ tags, geo, remark });
        }}
      />

      {/* Reset confirm */}
      <ConfirmResetModal
        open={resetOpen}
        busy={publishing}
        onClose={() => setResetOpen(false)}
        onConfirm={async ({ saveSnapshot, tags, geo, remark }) => {
            // ✅ Immediately reflect reset in UI
            setEvents([]);

            try {
                if (saveSnapshot) {
                await publishSnapshotToS3({ tags, geo, remark });
                }
            } finally {
                // ✅ Always clear local analytics even if publish was skipped
                resetAnalytics();

                // ✅ Re-read local storage (should now be empty)
                setEvents(getAllEvents());

                setResetOpen(false);
            }
        }}
      />
    </section>
  );
}
