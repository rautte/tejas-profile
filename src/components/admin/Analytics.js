// src/components/admin/Analytics.js

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  FaChartLine,
} from "react-icons/fa";

import SectionHeader from "../shared/SectionHeader";
import ConfigurationAnalyticsArchivePanel from "./ConfigurationAnalyticsArchivePanel";

import {
  CARD_ROUNDED_2XL,
  CARD_SURFACE,
} from "../../utils/ui";

import { cx } from "../../utils/cx";

import {
  readBuildProfileVersion,
} from "../../utils/profileVersion";

import {
  createAnalyticsBoundary,
  queryAnalyticsAgg,
  queryAnalyticsMeta,
} from "../../utils/analytics/analyticsApi";

import {
  listProfileVariants,
} from "../../utils/snapshots/controlPlaneCatalogApi";


const DAY_MS =
  24 * 60 * 60 * 1000;

const MAX_EXACT_RANGE_DAYS =
  366;

const DEFAULT_TRAFFIC_CLASSIFICATION =
  "likely_human";


const TRAFFIC_FILTERS = [
  {
    id:
      "likely_human",

    label:
      "Likely human",
  },

  {
    id:
      "likely_automated",

    label:
      "Likely automated",
  },

  {
    id:
      "uncertain",

    label:
      "Uncertain",
  },

  {
    id:
      "all",

    label:
      "All traffic",
  },
];


const PERIODS = [
  {
    id: "today",
    label: "Today",
    days: 1,
  },
  {
    id: "7d",
    label: "7D",
    days: 7,
  },
  {
    id: "30d",
    label: "30D",
    days: 30,
  },
  {
    id: "90d",
    label: "90D",
    days: 90,
  },
  {
    id: "1y",
    label: "1Y",
    days: 366,
  },
  {
    id: "custom",
    label: "Custom",
    days: null,
  },
];


// -----------------------------
// Date helpers
// -----------------------------

function todayUtcYmd() {
  return new Date()
    .toISOString()
    .slice(0, 10);
}

function parseUtcDay(day) {
  return Date.parse(
    `${day}T00:00:00Z`
  );
}

function addUtcDays(
  day,
  amount
) {
  return new Date(
    parseUtcDay(day) +
      amount * DAY_MS
  )
    .toISOString()
    .slice(0, 10);
}

function dayCount(
  from,
  to
) {
  const start =
    parseUtcDay(from);

  const end =
    parseUtcDay(to);

  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end)
  ) {
    return 0;
  }

  return (
    Math.floor(
      (end - start) /
        DAY_MS
    ) + 1
  );
}

function rangeForPreset(
  preset
) {
  const to =
    todayUtcYmd();

  const config =
    PERIODS.find(
      (p) =>
        p.id === preset
    );

  const days =
    config?.days || 7;

  return {
    from:
      addUtcDays(
        to,
        -(days - 1)
      ),

    to,
  };
}

function previousRange(
  range
) {
  const count =
    dayCount(
      range.from,
      range.to
    );

  const to =
    addUtcDays(
      range.from,
      -1
    );

  return {
    from:
      addUtcDays(
        to,
        -(count - 1)
      ),

    to,
  };
}

function formatDateLabel(day) {
  if (!day) return "—";

  try {
    return new Date(
      `${day}T00:00:00Z`
    ).toLocaleDateString(
      undefined,
      {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      }
    );
  } catch {
    return day;
  }
}

function formatRangeLabel(
  range
) {
  if (!range) return "—";

  if (
    range.from === range.to
  ) {
    return formatDateLabel(
      range.from
    );
  }

  return (
    `${formatDateLabel(
      range.from
    )} – ` +
    `${formatDateLabel(
      range.to
    )}`
  );
}


function formatTimestampUtc(
  value
) {
  const ts =
    Number(value);

  if (
    !Number.isFinite(ts)
  ) {
    return "—";
  }

  try {
    return new Date(
      ts
    ).toLocaleString(
      undefined,
      {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        timeZone: "UTC",
        timeZoneName: "short",
      }
    );
  } catch {
    return "—";
  }
}

function resolveBoundaryProfileVersion(
  boundary,
  releaseCatalog
) {
  const storedProfileVersionId =
    String(
      boundary
        ?.profileVersionId ||
        ""
    ).trim();

  // New boundaries should have the exact
  // profile version stored directly.
  if (storedProfileVersionId) {
    return storedProfileVersionId;
  }

  // Backward compatibility:
  // older Reset boundaries were created before
  // profileVersionId was stored on resets.
  //
  // Infer the release that was active when
  // the boundary became effective.
  const effectiveAt =
    Number(
      boundary?.effectiveAt
    );

  if (
    !Number.isFinite(
      effectiveAt
    )
  ) {
    return "";
  }

  const releases =
    Array.isArray(
      releaseCatalog
    )
      ? releaseCatalog
      : [];

  let bestMatch =
    null;

  for (const release of releases) {
    const releasedAt =
      Number(
        release?.releasedAt
      );

    const profileVersionId =
      String(
        release
          ?.profileVersionId ||
          ""
      ).trim();

    if (
      !profileVersionId ||
      !Number.isFinite(
        releasedAt
      ) ||
      releasedAt >
        effectiveAt
    ) {
      continue;
    }

    if (
      !bestMatch ||
      releasedAt >
        bestMatch.releasedAt
    ) {
      bestMatch = {
        releasedAt,
        profileVersionId,
      };
    }
  }

  return (
    bestMatch
      ?.profileVersionId ||
    ""
  );
}


function boundaryOptionLabel(
  boundary,
  releaseCatalog
) {
  if (!boundary) {
    return "Unknown boundary";
  }

  const type =
    boundary.type === "reset"
      ? "Reset"
      : "Deploy";

  const profileVersionId =
    resolveBoundaryProfileVersion(
      boundary,
      releaseCatalog
    );

  const release =
    profileVersionId
      ? ` · ${profileVersionId}`
      : "";

  return (
    `${type}${release} · ` +
    formatTimestampUtc(
      boundary.effectiveAt
    )
  );
}

function createResetBoundaryRequest() {
  const effectiveAt =
    Date.now();

  const profileVersion =
    readBuildProfileVersion();

  const profileVersionId =
    String(
      profileVersion?.id ||
      ""
    ).trim();

  const stamp =
    new Date(
      effectiveAt
    )
      .toISOString()
      .replace(
        /\D/g,
        ""
      )
      .slice(
        0,
        14
      );

  let suffix = "";

  try {
    suffix =
      window.crypto
        ?.randomUUID?.()
        ?.replace(
          /-/g,
          ""
        )
        ?.slice(
          0,
          12
        ) || "";
  } catch {
    suffix = "";
  }

  if (!suffix) {
    suffix =
      Math.random()
        .toString(36)
        .slice(
          2,
          14
        );
  }

  return {
    boundaryId:
      `reset-${stamp}-${suffix}`,

    type:
      "reset",

    effectiveAt,

    profileVersionId:
      profileVersionId ||
      null,

    note:
      "Owner analytics baseline reset",
  };
}

function trafficClassificationLabel(
  value
) {
  const match =
    TRAFFIC_FILTERS.find(
      (item) =>
        item.id ===
        value
    );


  return (
    match?.label ||
    "Uncertain"
  );
}


function trafficConfidenceLabel(
  value
) {
  const normalized =
    String(
      value || ""
    )
      .trim()
      .toLowerCase();


  if (
    normalized ===
      "high"
  ) {
    return "High";
  }


  if (
    normalized ===
      "medium"
  ) {
    return "Medium";
  }


  if (
    normalized ===
      "low"
  ) {
    return "Low";
  }


  return "";
}


function trafficReasonLabel(
  value
) {
  switch (value) {
    case "known_automation_user_agent":
      return "Known automation user agent";

    case "headless_user_agent":
      return "Headless browser signature";

    case "webdriver_detected":
      return "WebDriver detected";

    case "missing_user_agent":
      return "Missing browser user agent";

    case "trusted_pointer_input":
      return "Trusted pointer interaction";

    case "trusted_keyboard_input":
      return "Trusted keyboard interaction";

    case "trusted_touch_input":
      return "Trusted touch interaction";

    case "trusted_wheel_input":
      return "Trusted wheel interaction";

    case "meaningful_engagement":
      return "Meaningful engagement";

    case "passive_short_session":
      return "Short passive session";

    default:
      return String(
        value || ""
      )
        .replace(
          /_/g,
          " "
        )
        .trim();
  }
}


function trafficBadgeClassName(
  classification
) {
  switch (
    classification
  ) {
    case "likely_human":
      return "border-emerald-200/80 dark:border-emerald-400/20 bg-emerald-50/80 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";

    case "likely_automated":
      return "border-rose-200/80 dark:border-rose-400/20 bg-rose-50/80 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300";

    default:
      return "border-amber-200/80 dark:border-amber-400/20 bg-amber-50/80 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300";
  }
}


function journeyTypeLabel(
  type
) {
  switch (type) {
    case "section":
      return "Section";

    case "cta":
      return "CTA";

    case "project":
      return "Project";

    case "snippet":
      return "Snippet";

    case "deep_link":
      return "Deep link";

    default:
      return (
        type ||
        "Event"
      );
  }
}


// -----------------------------
// Formatting helpers
// -----------------------------

function formatNumber(value) {
  return new Intl.NumberFormat()
    .format(
      Number(value || 0)
    );
}

function formatDuration(ms) {
  const value =
    Math.max(
      0,
      Number(ms || 0)
    );

  if (value < 1000) {
    return `${Math.round(
      value
    )}ms`;
  }

  const seconds =
    value / 1000;

  if (seconds < 60) {
    return `${seconds.toFixed(
      seconds < 10 ? 1 : 0
    )}s`;
  }

  const minutes =
    seconds / 60;

  if (minutes < 60) {
    return `${minutes.toFixed(
      minutes < 10 ? 1 : 0
    )}m`;
  }

  const hours =
    minutes / 60;

  return `${hours.toFixed(
    hours < 10 ? 1 : 0
  )}h`;
}

function formatPercent(value) {
  return `${Number(
    value || 0
  ).toFixed(1)}%`;
}

function comparisonDelta(
  current,
  previous
) {
  if (
    previous == null
  ) {
    return null;
  }

  const now =
    Number(current || 0);

  const before =
    Number(previous || 0);

  if (
    before === 0 &&
    now === 0
  ) {
    return "0% vs previous";
  }

  if (
    before === 0
  ) {
    return "New vs previous";
  }

  const pct =
    ((now - before) /
      before) *
    100;

  const sign =
    pct > 0 ? "+" : "";

  return (
    `${sign}${pct.toFixed(
      1
    )}% vs previous`
  );
}

function membershipFilterOptions(
  rows,
  field,
  selected
) {
  const options = [];
  const seen =
    new Set();

  function add(value) {
    const clean =
      String(
        value || ""
      ).trim();

    if (
      !clean ||
      seen.has(clean)
    ) {
      return;
    }

    seen.add(clean);

    options.push(
      clean
    );
  }

  for (
    const row of
      Array.isArray(rows)
        ? rows
        : []
  ) {
    add(
      row?.[field]
    );
  }

  // Never make a currently selected value
  // disappear while a filtered response is
  // loading or the selected scope is empty.
  if (
    selected &&
    selected !== "all"
  ) {
    add(selected);
  }

  return options;
}

function downloadJsonFile(
  filename,
  data
) {
  const blob =
    new Blob(
      [
        JSON.stringify(
          data,
          null,
          2
        ),
      ],
      {
        type:
          "application/json",
      }
    );

  const url =
    URL.createObjectURL(
      blob
    );

  const anchor =
    document.createElement(
      "a"
    );

  anchor.href =
    url;

  anchor.download =
    filename;

  document.body.appendChild(
    anchor
  );

  anchor.click();
  anchor.remove();

  URL.revokeObjectURL(
    url
  );
}


// -----------------------------
// Reusable UI
// -----------------------------

function SectionCard({
  title,
  subtitle,
  action,
  children,
}) {
  return (
    <div
      className={cx(
        CARD_SURFACE,
        CARD_ROUNDED_2XL
      )}
    >
      <div className="px-5 sm:px-6 py-3 border-b rounded-t-2xl bg-gray-200/70 dark:bg-gray-700/70 border-gray-200/70 dark:border-white/10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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

          {action ? (
            <div className="shrink-0">
              {action}
            </div>
          ) : null}
        </div>
      </div>

      <div className="px-5 sm:px-6 py-5">
        {children}
      </div>
    </div>
  );
}

function SegButton({
  active,
  children,
  onClick,
  title,
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cx(
        "px-3 py-1.5 rounded-full text-xs border transition font-medium whitespace-nowrap",
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
  children,
  onClick,
  disabled,
  title,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="inline-flex items-center justify-center text-xs px-3 py-2 rounded-lg border border-gray-200/70 dark:border-white/10 bg-white/60 dark:bg-white/10 text-gray-800 dark:text-gray-100 hover:bg-white/80 dark:hover:bg-white/15 transition font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {children}
    </button>
  );
}

function KpiCard({
  title,
  value,
  sub,
  delta,
  valueClassName = "",
}) {
  return (
    <div className="rounded-2xl bg-white/60 dark:bg-white/5 border border-gray-200/70 dark:border-white/10 backdrop-blur-xl p-4 shadow-sm min-w-0">
      <div className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {title}
      </div>

      <div
        className={cx(
          "mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100 min-w-0",
          valueClassName
        )}
      >
        {value}
      </div>

      {delta ? (
        <div className="mt-1 inline-flex rounded-full border border-purple-200/80 dark:border-purple-400/20 bg-purple-50/80 dark:bg-purple-500/10 px-2 py-0.5 text-[11px] font-medium text-purple-700 dark:text-purple-300">
          {delta}
        </div>
      ) : null}

      {sub ? (
        <div className="mt-1 text-[12px] text-gray-600 dark:text-gray-400">
          {sub}
        </div>
      ) : null}
    </div>
  );
}

function TrafficBadge({
  classification,
  confidence,
}) {
  const label =
    trafficClassificationLabel(
      classification
    );

  const confidenceLabel =
    trafficConfidenceLabel(
      confidence
    );


  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold",
        trafficBadgeClassName(
          classification
        )
      )}
    >
      {label}

      {confidenceLabel
        ? ` · ${confidenceLabel}`
        : ""}
    </span>
  );
}


function TrafficCompositionSummary({
  traffic,
}) {
  const classifierVersion =
    String(
      traffic
        ?.classifierVersion ||
        ""
    ).trim();

  const buckets =
    traffic
      ?.byClassification ||
    null;


  if (!buckets) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300/80 dark:border-white/15 px-4 py-5 text-center text-sm text-gray-500 dark:text-gray-400">
        Traffic composition is not available for this response yet.
      </div>
    );
  }


  const rows = [
    {
      id:
        "likely_human",

      label:
        "Likely human",

      value:
        buckets
          ?.likely_human ||
        {},
    },

    {
      id:
        "likely_automated",

      label:
        "Likely automated",

      value:
        buckets
          ?.likely_automated ||
        {},
    },

    {
      id:
        "uncertain",

      label:
        "Uncertain",

      value:
        buckets
          ?.uncertain ||
        {},
    },

    {
      id:
        "all",

      label:
        "All traffic",

      value:
        buckets
          ?.all ||
        {},
    },
  ];


  return (
    <div
      data-testid="traffic-composition"
      className="space-y-3"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {rows.map(
          (row) => (
            <div
              key={
                row.id
              }
              className="rounded-xl border border-gray-200/70 dark:border-white/10 bg-white/60 dark:bg-white/5 px-3 py-3"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="text-[11px] font-semibold text-gray-800 dark:text-gray-200">
                  {row.label}
                </div>

                {row.id !==
                "all" ? (
                  <TrafficBadge
                    classification={
                      row.id
                    }
                  />
                ) : null}
              </div>

              <div className="mt-2 text-xl font-bold text-gray-900 dark:text-gray-100">
                {formatNumber(
                  row.value
                    ?.sessions
                )}
              </div>

              <div className="text-[10px] text-gray-500 dark:text-gray-400">
                sessions ·{" "}
                {formatNumber(
                  row.value
                    ?.uniqueVisitors
                )}{" "}
                visitors
              </div>

              <div className="mt-1 text-[10px] text-gray-500 dark:text-gray-400">
                {formatNumber(
                  row.value
                    ?.eventCount
                )}{" "}
                events ·{" "}
                {formatDuration(
                  row.value
                    ?.activeMs
                )}{" "}
                active
              </div>
            </div>
          )
        )}
      </div>

      {classifierVersion ? (
        <div className="text-[10px] text-gray-500 dark:text-gray-400">
          Classifier:{" "}
          <span className="font-mono">
            {classifierVersion}
          </span>
        </div>
      ) : null}
    </div>
  );
}


function EmptyState({
  children,
}) {
  return (
    <div className="rounded-xl border border-dashed border-gray-300/80 dark:border-white/15 px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
      {children}
    </div>
  );
}

function JourneyNode({
  type,
  value,
}) {
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-purple-200/70 dark:border-purple-400/20 bg-purple-50/70 dark:bg-purple-500/10 px-2 py-1">
      <span className="shrink-0 text-[9px] font-bold uppercase tracking-wide text-purple-600 dark:text-purple-300">
        {journeyTypeLabel(
          type
        )}
      </span>

      <span className="min-w-0 truncate text-xs font-medium text-gray-800 dark:text-gray-200">
        {value || "—"}
      </span>
    </span>
  );
}


// -----------------------------
// Trend chart
// -----------------------------

function TrendChart({
  points,
}) {
  const width = 100;
  const height = 54;
  const padX = 5;
  const padY = 6;

  if (
    !Array.isArray(points) ||
    !points.length
  ) {
    return (
      <EmptyState>
        No trend data for this period.
      </EmptyState>
    );
  }

  const max =
    Math.max(
      1,
      ...points.flatMap(
        (p) => [
          Number(
            p?.uniqueVisitors ||
              0
          ),
          Number(
            p?.sessions || 0
          ),
        ]
      )
    );

  function xFor(index) {
    if (
      points.length <= 1
    ) {
      return width / 2;
    }

    return (
      padX +
      (index *
        (width -
          padX * 2)) /
        (points.length - 1)
    );
  }

  function yFor(value) {
    return (
      height -
      padY -
      (Number(value || 0) /
        max) *
        (height -
          padY * 2)
    );
  }

  function pathFor(key) {
    return points
      .map(
        (point, index) => {
          const x =
            xFor(index);

          const y =
            yFor(
              point?.[key]
            );

          return `${
            index === 0
              ? "M"
              : "L"
          } ${x} ${y}`;
        }
      )
      .join(" ");
  }

  return (
    <div className="rounded-xl border border-gray-200/70 dark:border-white/10 bg-white/40 dark:bg-white/5 px-3 py-3">
      <div className="flex items-center gap-4 mb-2 text-[11px] text-gray-600 dark:text-gray-400">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-purple-500" />
          Unique visitors
        </span>

        <span className="inline-flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-sky-500" />
          Sessions · dashed
        </span>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-[180px]"
        role="img"
        aria-label="Visitor and session trend"
      >
        {[0.25, 0.5, 0.75].map(
          (fraction) => (
            <line
              key={fraction}
              x1={padX}
              x2={
                width -
                padX
              }
              y1={
                height *
                fraction
              }
              y2={
                height *
                fraction
              }
              className="stroke-gray-300/50 dark:stroke-white/10"
              strokeWidth="0.4"
            />
          )
        )}

        <path
          d={pathFor(
            "uniqueVisitors"
          )}
          className="fill-none stroke-purple-500"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        <path
          d={pathFor("sessions")}
          className="fill-none stroke-sky-500"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="3 2"
        />

        {points.length === 1 ? (
          <>
            <circle
              cx={width / 2}
              cy={yFor(
                points[0]
                  ?.uniqueVisitors
              )}
              r="1.8"
              className="fill-purple-500"
            />

            <circle
              cx={width / 2}
              cy={yFor(
                points[0]
                  ?.sessions
              )}
              r="1.8"
              className="fill-sky-500"
            />
          </>
        ) : null}
      </svg>

      <div className="mt-1 flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400">
        <span>
          {points[0]?.day ||
            ""}
        </span>

        <span>
          {points[
            points.length - 1
          ]?.day || ""}
        </span>
      </div>
    </div>
  );
}


// -----------------------------
// Section reach
// -----------------------------

function SectionReach({
  sections,
}) {
  if (
    !Array.isArray(sections) ||
    !sections.length
  ) {
    return (
      <EmptyState>
        No section data yet.
      </EmptyState>
    );
  }

  return (
    <div className="space-y-3">
      {sections.map(
        (section) => {
          const pct =
            Math.max(
              0,
              Math.min(
                100,
                Number(
                  section
                    ?.visitorReachPct ||
                    0
                )
              )
            );

          return (
            <div
              key={
                section.section
              }
            >
              <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                <span className="truncate text-gray-700 dark:text-gray-300">
                  {section.section}
                </span>

                <span className="shrink-0 text-xs font-semibold text-gray-900 dark:text-gray-100">
                  {formatPercent(
                    pct
                  )}
                  <span className="ml-2 font-normal text-gray-500 dark:text-gray-400">
                    {formatNumber(
                      section.visitors
                    )}{" "}
                    visitors
                  </span>
                </span>
              </div>

              <div className="h-2.5 rounded-full bg-gray-200/80 dark:bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-purple-500 via-violet-500 to-indigo-500 transition-all"
                  style={{
                    width:
                      `${pct}%`,
                  }}
                />
              </div>
            </div>
          );
        }
      )}
    </div>
  );
}


// -----------------------------
// Engagement table
// -----------------------------

function SectionEngagementTable({
  sections,
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500 dark:text-gray-400">
            <th className="py-2 pr-4">
              Section
            </th>

            <th className="py-2 pr-4 text-right">
              Visitors
            </th>

            <th className="py-2 pr-4 text-right">
              Sessions
            </th>

            <th className="py-2 pr-4 text-right">
              Visits
            </th>

            <th className="py-2 pr-4 text-right">
              Active time
            </th>

            <th className="py-2 text-right">
              Avg / session
            </th>
          </tr>
        </thead>

        <tbody>
          {(sections || []).map(
            (section) => (
              <tr
                key={
                  section.section
                }
                className="border-t border-gray-200/70 dark:border-white/10"
              >
                <td className="py-3 pr-4 font-medium text-gray-800 dark:text-gray-200">
                  {section.section}
                </td>

                <td className="py-3 pr-4 text-right text-gray-700 dark:text-gray-300">
                  {formatNumber(
                    section.visitors
                  )}
                </td>

                <td className="py-3 pr-4 text-right text-gray-700 dark:text-gray-300">
                  {formatNumber(
                    section.sessions
                  )}
                </td>

                <td className="py-3 pr-4 text-right text-gray-700 dark:text-gray-300">
                  {formatNumber(
                    section.visits
                  )}
                </td>

                <td className="py-3 pr-4 text-right font-medium text-gray-900 dark:text-gray-100">
                  {formatDuration(
                    section.activeMs
                  )}
                </td>

                <td className="py-3 text-right text-gray-700 dark:text-gray-300">
                  {formatDuration(
                    section.sessions
                      ? section.activeMs /
                          section.sessions
                      : 0
                  )}
                </td>
              </tr>
            )
          )}
        </tbody>
      </table>
    </div>
  );
}


// -----------------------------
// Generic interaction table
// -----------------------------

function InteractionTable({
  rows,
  idKey,
  emptyText,
}) {
  if (
    !Array.isArray(rows) ||
    !rows.length
  ) {
    return (
      <EmptyState>
        {emptyText}
      </EmptyState>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500 dark:text-gray-400">
            <th className="py-2 pr-3">
              Item
            </th>

            <th className="py-2 pr-3 text-right">
              Actions
            </th>

            <th className="py-2 pr-3 text-right">
              Visitors
            </th>

            <th className="py-2 text-right">
              Sessions
            </th>
          </tr>
        </thead>

        <tbody>
          {rows
            .slice(0, 12)
            .map((row) => (
              <tr
                key={
                  row[idKey]
                }
                className="border-t border-gray-200/70 dark:border-white/10"
              >
                <td className="py-2.5 pr-3 font-medium text-gray-800 dark:text-gray-200 break-all">
                  {row[idKey]}
                </td>

                <td className="py-2.5 pr-3 text-right text-gray-700 dark:text-gray-300">
                  {formatNumber(
                    row.count
                  )}
                </td>

                <td className="py-2.5 pr-3 text-right text-gray-700 dark:text-gray-300">
                  {formatNumber(
                    row.visitors
                  )}
                </td>

                <td className="py-2.5 text-right text-gray-700 dark:text-gray-300">
                  {formatNumber(
                    row.sessions
                  )}
                </td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}


// -----------------------------
// Scroll depth
// -----------------------------

function DepthMilestoneTable({
  sections,
  milestones,
}) {
  const bySection =
    useMemo(() => {
      const map =
        new Map();

      for (
        const item of
          milestones || []
      ) {
        if (
          !map.has(
            item.section
          )
        ) {
          map.set(
            item.section,
            {}
          );
        }

        map.get(
          item.section
        )[
          item.depthPct
        ] = item;
      }

      return map;
    }, [milestones]);

  const hasAny =
    Array.isArray(
      milestones
    ) &&
    milestones.length > 0;

  if (!hasAny) {
    return (
      <EmptyState>
        No scroll-depth milestones yet.
      </EmptyState>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[620px] text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500 dark:text-gray-400">
            <th className="py-2 pr-4">
              Section
            </th>

            {[25, 50, 75, 100].map(
              (pct) => (
                <th
                  key={pct}
                  className="py-2 px-3 text-center"
                >
                  {pct}%
                </th>
              )
            )}
          </tr>
        </thead>

        <tbody>
          {(sections || []).map(
            (section) => {
              const row =
                bySection.get(
                  section.section
                ) || {};

              return (
                <tr
                  key={
                    section.section
                  }
                  className="border-t border-gray-200/70 dark:border-white/10"
                >
                  <td className="py-3 pr-4 font-medium text-gray-800 dark:text-gray-200">
                    {section.section}
                  </td>

                  {[25, 50, 75, 100].map(
                    (pct) => {
                      const item =
                        row[pct];

                      return (
                        <td
                          key={pct}
                          className="py-3 px-3 text-center"
                        >
                          <span className="inline-flex min-w-[42px] justify-center rounded-full border border-gray-200/70 dark:border-white/10 bg-white/60 dark:bg-white/5 px-2 py-1 text-xs font-semibold text-gray-700 dark:text-gray-300">
                            {formatNumber(
                              item
                                ?.visitors ||
                                0
                            )}
                          </span>
                        </td>
                      );
                    }
                  )}
                </tr>
              );
            }
          )}
        </tbody>
      </table>
    </div>
  );
}


// -----------------------------
// Countries
// -----------------------------

function CountriesTable({
  countries,
}) {
  if (
    !Array.isArray(countries) ||
    !countries.length
  ) {
    return (
      <EmptyState>
        Country data is not available yet.
      </EmptyState>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
      {countries
        .slice(0, 10)
        .map(
          (country) => (
            <div
              key={
                country.countryCode
              }
              className="flex items-center justify-between gap-4 rounded-xl border border-gray-200/60 dark:border-white/10 bg-white/40 dark:bg-white/5 px-3 py-2"
            >
              <div>
                <div className="font-semibold text-sm text-gray-800 dark:text-gray-200">
                  {country.countryCode}
                </div>

                <div className="text-[11px] text-gray-500 dark:text-gray-400">
                  {formatNumber(
                    country.sessions
                  )}{" "}
                  sessions
                </div>
              </div>

              <div className="text-right">
                <div className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                  {formatNumber(
                    country.visitors
                  )}
                </div>

                <div className="text-[11px] text-gray-500 dark:text-gray-400">
                  visitors
                </div>
              </div>
            </div>
          )
        )}
    </div>
  );
}


function CitiesTable({
  cities,
}) {
  if (
    !Array.isArray(cities) ||
    !cities.length
  ) {
    return (
      <EmptyState>
        City data is not available yet.
      </EmptyState>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500 dark:text-gray-400">
            <th className="py-2 pr-4">
              Location
            </th>

            <th className="py-2 pr-4 text-right">
              Visitors
            </th>

            <th className="py-2 pr-4 text-right">
              Sessions
            </th>

            <th className="py-2 text-right">
              Active
            </th>
          </tr>
        </thead>

        <tbody>
          {cities
            .slice(0, 12)
            .map(
              (city) => {
                const region = [
                  city.regionCode,
                  city.countryCode,
                ]
                  .filter(Boolean)
                  .join(", ");

                return (
                  <tr
                    key={[
                      city.countryCode ||
                        "unknown-country",
                      city.regionCode ||
                        "unknown-region",
                      city.city ||
                        "unknown-city",
                    ].join(":")}
                    className="border-t border-gray-200/70 dark:border-white/10"
                  >
                    <td className="py-3 pr-4">
                      <div className="font-medium text-gray-800 dark:text-gray-200">
                        {city.city ||
                          "Unknown"}
                      </div>

                      {region ? (
                        <div className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
                          {region}
                        </div>
                      ) : null}
                    </td>

                    <td className="py-3 pr-4 text-right text-gray-700 dark:text-gray-300">
                      {formatNumber(
                        city.visitors
                      )}
                    </td>

                    <td className="py-3 pr-4 text-right text-gray-700 dark:text-gray-300">
                      {formatNumber(
                        city.sessions
                      )}
                    </td>

                    <td className="py-3 text-right font-medium text-gray-900 dark:text-gray-100">
                      {formatDuration(
                        city.activeMs
                      )}
                    </td>
                  </tr>
                );
              }
            )}
        </tbody>
      </table>
    </div>
  );
}


function SessionCoverageSummary({
  coverage,
}) {
  const stats = [
    {
      label:
        "Logical sessions",

      value:
        coverage
          ?.logicalSessions ||
        0,

      sub:
        "merged across fragments",
    },
    {
      label:
        "With journey",

      value:
        coverage
          ?.sessionsWithJourney ||
        0,

      sub:
        "chronology available",
    },
    {
      label:
        "Without journey",

      value:
        coverage
          ?.sessionsWithoutJourney ||
        0,

      sub:
        "legacy / non-journey data",
    },
    {
      label:
        "Partial journeys",

      value:
        coverage
          ?.journeyTruncatedSessions ||
        0,

      sub:
        "bounded journey storage",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {stats.map(
        (item) => (
          <div
            key={
              item.label
            }
            className="rounded-xl border border-gray-200/70 dark:border-white/10 bg-white/50 dark:bg-white/5 px-4 py-3"
          >
            <div className="text-[10px] uppercase tracking-wide font-semibold text-gray-500 dark:text-gray-400">
              {item.label}
            </div>

            <div className="mt-1 text-xl font-bold text-gray-900 dark:text-gray-100">
              {formatNumber(
                item.value
              )}
            </div>

            <div className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
              {item.sub}
            </div>
          </div>
        )
      )}
    </div>
  );
}


function TopSectionPaths({
  paths,
}) {
  if (
    !Array.isArray(paths) ||
    !paths.length
  ) {
    return (
      <EmptyState>
        No multi-section journey paths recorded yet.
      </EmptyState>
    );
  }

  return (
    <div className="space-y-3">
      {paths
        .slice(0, 10)
        .map(
          (
            item,
            index
          ) => (
            <div
              key={
                JSON.stringify(
                  item.path
                )
              }
              className="rounded-xl border border-gray-200/70 dark:border-white/10 bg-white/40 dark:bg-white/5 p-3"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="mb-2 text-[10px] uppercase tracking-wide font-semibold text-gray-500 dark:text-gray-400">
                    Path #
                    {index + 1}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {(
                      item.path ||
                      []
                    ).map(
                      (
                        section,
                        pathIndex
                      ) => (
                        <div
                          key={`${section}-${pathIndex}`}
                          className="inline-flex items-center gap-1.5"
                        >
                          {pathIndex >
                          0 ? (
                            <span className="text-gray-400 dark:text-gray-500">
                              →
                            </span>
                          ) : null}

                          <JourneyNode
                            type="section"
                            value={
                              section
                            }
                          />
                        </div>
                      )
                    )}
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <div className="text-sm font-bold text-gray-900 dark:text-gray-100">
                    {formatNumber(
                      item.sessions
                    )}
                  </div>

                  <div className="text-[10px] text-gray-500 dark:text-gray-400">
                    sessions
                  </div>

                  <div className="mt-1 text-[10px] text-gray-500 dark:text-gray-400">
                    {formatNumber(
                      item.visitors
                    )}{" "}
                    visitors
                  </div>
                </div>
              </div>
            </div>
          )
        )}
    </div>
  );
}


function TopTransitionsTable({
  transitions,
}) {
  if (
    !Array.isArray(
      transitions
    ) ||
    !transitions.length
  ) {
    return (
      <EmptyState>
        No journey transitions recorded yet.
      </EmptyState>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500 dark:text-gray-400">
            <th className="py-2 pr-3">
              From
            </th>

            <th className="py-2 px-3">
              To
            </th>

            <th className="py-2 px-3 text-right">
              Transitions
            </th>

            <th className="py-2 px-3 text-right">
              Sessions
            </th>

            <th className="py-2 text-right">
              Visitors
            </th>
          </tr>
        </thead>

        <tbody>
          {transitions
            .slice(0, 12)
            .map(
              (
                item,
                index
              ) => (
                <tr
                  key={[
                    item.from
                      ?.type,
                    item.from
                      ?.value,
                    item.to?.type,
                    item.to
                      ?.value,
                    index,
                  ].join(
                    ":"
                  )}
                  className="border-t border-gray-200/70 dark:border-white/10"
                >
                  <td className="py-3 pr-3">
                    <JourneyNode
                      type={
                        item.from
                          ?.type
                      }
                      value={
                        item.from
                          ?.value
                      }
                    />
                  </td>

                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400 dark:text-gray-500">
                        →
                      </span>

                      <JourneyNode
                        type={
                          item.to
                            ?.type
                        }
                        value={
                          item.to
                            ?.value
                        }
                      />
                    </div>
                  </td>

                  <td className="py-3 px-3 text-right font-semibold text-gray-900 dark:text-gray-100">
                    {formatNumber(
                      item.count
                    )}
                  </td>

                  <td className="py-3 px-3 text-right text-gray-700 dark:text-gray-300">
                    {formatNumber(
                      item.sessions
                    )}
                  </td>

                  <td className="py-3 text-right text-gray-700 dark:text-gray-300">
                    {formatNumber(
                      item.visitors
                    )}
                  </td>
                </tr>
              )
            )}
        </tbody>
      </table>
    </div>
  );
}


function RecentSessions({
  sessions,
}) {
  const [
    expanded,
    setExpanded,
  ] =
    useState(
      () =>
        new Set()
    );

  const [
    visibleCount,
    setVisibleCount,
  ] =
    useState(10);

  useEffect(() => {
    setExpanded(
      new Set()
    );

    setVisibleCount(
      10
    );
  }, [sessions]);

  if (
    !Array.isArray(sessions) ||
    !sessions.length
  ) {
    return (
      <EmptyState>
        No session journeys are available for this period.
      </EmptyState>
    );
  }

  function toggle(
    sessionId
  ) {
    setExpanded(
      (previous) => {
        const next =
          new Set(
            previous
          );

        if (
          next.has(
            sessionId
          )
        ) {
          next.delete(
            sessionId
          );
        } else {
          next.add(
            sessionId
          );
        }

        return next;
      }
    );
  }

  return (
    <div className="space-y-3">
      {sessions
        .slice(
          0,
          visibleCount
        )
        .map(
          (session) => {
            const isExpanded =
              expanded.has(
                session.sessionId
              );

            const profileVersions =
              Array.isArray(
                session
                  .profileVersionIds
              )
                ? session.profileVersionIds
                : [];

            const profileVariants =
              Array.isArray(
                session
                  .profileVariantIds
              )
                ? session
                    .profileVariantIds
                : [];

            const targetingLocations =
              Array.isArray(
                session
                  .profileTargetingLocations
              )
                ? session
                    .profileTargetingLocations
                : [];

            const targetingJobRoles =
              Array.isArray(
                session
                  .profileTargetingJobRoles
              )
                ? session
                    .profileTargetingJobRoles
                : [];

            const journey =
              Array.isArray(
                session.journey
              )
                ? session.journey
                : [];

            const location = [
              session.city,
              session.regionCode,
              session.countryCode,
            ]
              .filter(Boolean)
              .join(", ");


            const trafficReasons =
              Array.isArray(
                session
                  .trafficReasonCodes
              )
                ? session
                    .trafficReasonCodes
                : [];


            return (
              <div
                key={
                  session.sessionId
                }
                className="rounded-xl border border-gray-200/70 dark:border-white/10 bg-white/40 dark:bg-white/5 overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => {
                    if (
                      journey.length
                    ) {
                      toggle(
                        session.sessionId
                      );
                    }
                  }}
                  aria-expanded={
                    journey.length
                      ? isExpanded
                      : undefined
                  }
                  className="w-full text-left px-4 py-3 hover:bg-white/50 dark:hover:bg-white/5 transition"
                >
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-gray-900 dark:text-gray-100">
                          {
                            session.sessionId
                          }
                        </span>

                        {session
                          .trafficClassification ? (
                          <TrafficBadge
                            classification={
                              session
                                .trafficClassification
                            }
                            confidence={
                              session
                                .trafficConfidence
                            }
                          />
                        ) : null}

                        {session
                          .journeyTruncated ? (
                          <span className="rounded-full border border-amber-300/70 dark:border-amber-400/25 bg-amber-50 dark:bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                            partial journey
                          </span>
                        ) : null}

                        {profileVersions.length >
                        1 ? (
                          <span className="rounded-full border border-purple-200/70 dark:border-purple-400/20 bg-purple-50 dark:bg-purple-500/10 px-2 py-0.5 text-[10px] font-semibold text-purple-700 dark:text-purple-300">
                            {
                              profileVersions.length
                            }{" "}
                            releases
                          </span>
                        ) : null}

                         {profileVariants.length ? (
                          <span className="rounded-full border border-indigo-200/70 dark:border-indigo-400/20 bg-indigo-50 dark:bg-indigo-500/10 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 dark:text-indigo-300">
                            {profileVariants.length ===
                            1
                              ? profileVariants[0]
                              : `${profileVariants.length} variants`}
                          </span>
                        ) : null}

                      </div>

                      <div className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                        {formatTimestampUtc(
                          session.startedAt
                        )}

                        {location
                          ? ` · ${location}`
                          : ""}
                      </div>

                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {(
                          session.sections ||
                          []
                        )
                          .slice(
                            0,
                            9
                          )
                          .map(
                            (
                              section
                            ) => (
                              <span
                                key={
                                  section
                                }
                                className="rounded-full border border-gray-200/70 dark:border-white/10 bg-white/60 dark:bg-white/5 px-2 py-0.5 text-[10px] text-gray-600 dark:text-gray-300"
                              >
                                {
                                  section
                                }
                              </span>
                            )
                          )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4 gap-x-5 gap-y-2 shrink-0">
                      <div>
                        <div className="text-[9px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                          Span
                        </div>

                        <div className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                          {formatDuration(
                            session.durationMs
                          )}
                        </div>
                      </div>

                      <div>
                        <div className="text-[9px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                          Active
                        </div>

                        <div className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                          {formatDuration(
                            session.activeMs
                          )}
                        </div>
                      </div>

                      <div>
                        <div className="text-[9px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                          Events
                        </div>

                        <div className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                          {formatNumber(
                            session.eventCount
                          )}
                        </div>
                      </div>

                      <div>
                        <div className="text-[9px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                          Journey
                        </div>

                        <div className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                          {formatNumber(
                            session.journeyEventCount
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div
                    className={cx(
                      "mt-2 text-[10px] font-semibold",
                      journey.length
                        ? "text-purple-600 dark:text-purple-300"
                        : "text-gray-500 dark:text-gray-400"
                    )}
                  >
                    {journey.length
                      ? (
                          isExpanded
                            ? "Hide journey ↑"
                            : "View journey ↓"
                        )
                      : "No journey recorded"}
                  </div>
                </button>

                {isExpanded ? (
                  <div className="border-t border-gray-200/70 dark:border-white/10 px-4 py-4">
                    {session
                      .trafficClassification ? (
                      <div className="mb-4 rounded-xl border border-gray-200/70 dark:border-white/10 bg-white/50 dark:bg-white/5 px-3 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-[10px] uppercase tracking-wide font-semibold text-gray-500 dark:text-gray-400">
                            Traffic classification
                          </div>

                          <TrafficBadge
                            classification={
                              session
                                .trafficClassification
                            }
                            confidence={
                              session
                                .trafficConfidence
                            }
                          />
                        </div>

                        <div className="mt-2 text-[11px] text-gray-600 dark:text-gray-400">
                          {trafficReasons.length
                            ? trafficReasons
                                .map(
                                  trafficReasonLabel
                                )
                                .filter(
                                  Boolean
                                )
                                .join(
                                  " · "
                                )
                            : "No strong classification evidence was retained for this session."}
                        </div>

                        {session
                          .trafficClassifierVersion ? (
                          <div className="mt-1 font-mono text-[9px] text-gray-500 dark:text-gray-500">
                            {
                              session
                                .trafficClassifierVersion
                            }
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-4 text-xs">
                      <div>
                        <div className="text-[10px] uppercase tracking-wide font-semibold text-gray-500 dark:text-gray-400">
                          Releases
                        </div>

                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {profileVersions.length ? (
                            profileVersions.map(
                              (
                                id
                              ) => (
                                <span
                                  key={
                                    id
                                  }
                                  className="max-w-full break-all rounded-lg border border-gray-200/70 dark:border-white/10 bg-white/60 dark:bg-white/5 px-2 py-1 font-mono text-[10px] text-gray-700 dark:text-gray-300"
                                >
                                  {id}
                                </span>
                              )
                            )
                          ) : (
                            <span className="text-gray-500 dark:text-gray-400">
                              Unknown
                            </span>
                          )}
                        </div>
                      </div>


                      <div>
                        <div className="text-[10px] uppercase tracking-wide font-semibold text-gray-500 dark:text-gray-400">
                          Profile Variants
                        </div>

                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {profileVariants.length ? (
                            profileVariants.map(
                              (
                                id
                              ) => (
                                <span
                                  key={
                                    id
                                  }
                                  className="max-w-full break-all rounded-lg border border-indigo-200/70 dark:border-indigo-400/20 bg-indigo-50/70 dark:bg-indigo-500/10 px-2 py-1 font-mono text-[10px] text-indigo-700 dark:text-indigo-300"
                                >
                                  {id}
                                </span>
                              )
                            )
                          ) : (
                            <span className="text-gray-500 dark:text-gray-400">
                              Historical / unavailable
                            </span>
                          )}
                        </div>
                      </div>


                      <div>
                        <div className="text-[10px] uppercase tracking-wide font-semibold text-gray-500 dark:text-gray-400">
                          Profile targeting
                        </div>

                        <div className="mt-1 space-y-1 text-gray-700 dark:text-gray-300">
                          <div>
                            Location:{" "}
                            {targetingLocations.length
                              ? targetingLocations.join(
                                  ", "
                                )
                              : "—"}
                          </div>

                          <div>
                            Role:{" "}
                            {targetingJobRoles.length
                              ? targetingJobRoles.join(
                                  ", "
                                )
                              : "—"}
                          </div>
                        </div>
                      </div>


                      <div>
                        <div className="text-[10px] uppercase tracking-wide font-semibold text-gray-500 dark:text-gray-400">
                          Fragment coverage
                        </div>

                        <div className="mt-1 text-gray-700 dark:text-gray-300">
                          {formatNumber(
                            session.fragmentCount
                          )}{" "}
                          session-day fragment
                          {Number(
                            session.fragmentCount ||
                              0
                          ) === 1
                            ? ""
                            : "s"}
                        </div>
                      </div>
                    </div>

                    {session
                      .journeyTruncated ? (
                      <div className="mb-3 rounded-lg border border-amber-300/60 dark:border-amber-400/20 bg-amber-50/70 dark:bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
                        This journey is partial because bounded analytics storage reached its journey limit.
                      </div>
                    ) : null}

                    {journey.length ? (
                      <div className="max-h-[440px] overflow-y-auto pr-1">
                        <div className="relative ml-2 border-l border-gray-200 dark:border-white/10">
                          {journey.map(
                            (
                              event,
                              index
                            ) => (
                              <div
                                key={[
                                  event.ts,
                                  event.type,
                                  event.value,
                                  index,
                                ].join(
                                  ":"
                                )}
                                className="relative pl-5 pb-4 last:pb-0"
                              >
                                <span className="absolute -left-[4.5px] top-2 w-2 h-2 rounded-full bg-purple-500 ring-4 ring-white dark:ring-[#151521]" />

                                <div className="text-[10px] text-gray-500 dark:text-gray-400">
                                  {formatTimestampUtc(
                                    event.ts
                                  )}
                                </div>

                                <div className="mt-1">
                                  <JourneyNode
                                    type={
                                      event.type
                                    }
                                    value={
                                      event.value
                                    }
                                  />

                                  {event
                                    .profileVariantId ? (
                                    <div className="mt-1 font-mono text-[9px] text-indigo-600 dark:text-indigo-300 break-all">
                                      {
                                        event
                                          .profileVariantId
                                      }
                                    </div>
                                  ) : null}

                                </div>
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    ) : (
                      <EmptyState>
                        No ordered journey events are available for this session.
                      </EmptyState>
                    )}
                  </div>
                ) : null}
              </div>
            );
          }
        )}

      {visibleCount <
      sessions.length ? (
        <div className="pt-1 text-center">
          <SmallActionButton
            onClick={() =>
              setVisibleCount(
                (value) =>
                  Math.min(
                    sessions.length,
                    value + 10
                  )
              )
            }
          >
            Show more sessions
          </SmallActionButton>
        </div>
      ) : null}
    </div>
  );
}

// -----------------------------
// Release table
// -----------------------------

function ReleaseTable({
  releases,
  currentProfileVersionId,
}) {
  if (
    !Array.isArray(releases) ||
    !releases.length
  ) {
    return (
      <EmptyState>
        No release data for this period.
      </EmptyState>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[620px] text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500 dark:text-gray-400">
            <th className="py-2 pr-4">
              Release
            </th>

            <th className="py-2 pr-4 text-right">
              Visitors
            </th>

            <th className="py-2 pr-4 text-right">
              Sessions
            </th>

            <th className="py-2 pr-4 text-right">
              Events
            </th>

            <th className="py-2 text-right">
              Active
            </th>
          </tr>
        </thead>

        <tbody>
          {releases.map(
            (release) => {
              const current =
                release
                  .profileVersionId ===
                currentProfileVersionId;

              return (
                <tr
                  key={
                    release
                      .profileVersionId
                  }
                  className="border-t border-gray-200/70 dark:border-white/10"
                >
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-800 dark:text-gray-200 break-all">
                        {
                          release
                            .profileVersionId
                        }
                      </span>

                      {current ? (
                        <span className="rounded-full bg-purple-100 dark:bg-purple-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-purple-700 dark:text-purple-300">
                          current
                        </span>
                      ) : null}
                    </div>
                  </td>

                  <td className="py-3 pr-4 text-right text-gray-700 dark:text-gray-300">
                    {formatNumber(
                      release.visitors
                    )}
                  </td>

                  <td className="py-3 pr-4 text-right text-gray-700 dark:text-gray-300">
                    {formatNumber(
                      release.sessions
                    )}
                  </td>

                  <td className="py-3 pr-4 text-right text-gray-700 dark:text-gray-300">
                    {formatNumber(
                      release.eventCount
                    )}
                  </td>

                  <td className="py-3 text-right font-medium text-gray-900 dark:text-gray-100">
                    {formatDuration(
                      release.activeMs
                    )}
                  </td>
                </tr>
              );
            }
          )}
        </tbody>
      </table>
    </div>
  );
}



function cleanAnalyticsFilterValue(
  value
) {
  return String(
    value ?? ""
  ).trim();
}


function normalizeProfileVariantCatalog({
  variants = [],
  activeProfileVariantId = "",
  activeTargetingLocation = "",
  activeTargetingJobRole = "",
} = {}) {
  const activeId =
    cleanAnalyticsFilterValue(
      activeProfileVariantId
    );

  const activeLocation =
    cleanAnalyticsFilterValue(
      activeTargetingLocation
    );

  const activeJobRole =
    cleanAnalyticsFilterValue(
      activeTargetingJobRole
    );

  const byId =
    new Map();


  for (
    const variant of
      Array.isArray(
        variants
      )
        ? variants
        : []
  ) {
    const profileVariantId =
      cleanAnalyticsFilterValue(
        variant
          ?.profileVariantId
      );

    const location =
      cleanAnalyticsFilterValue(
        variant
          ?.targeting
          ?.location
      );

    const jobRole =
      cleanAnalyticsFilterValue(
        variant
          ?.targeting
          ?.jobRole
      );


    /**
     * The filter domain only admits complete, real authored
     * targeting tuples.
     *
     * Do not invent targeting for malformed historical records.
     */
    if (
      !profileVariantId ||
      !location ||
      !jobRole
    ) {
      continue;
    }


    byId.set(
      profileVariantId,
      {
        ...variant,

        profileVariantId,

        targeting: {
          ...variant
            ?.targeting,

          location:
            profileVariantId ===
              activeId &&
            activeLocation
              ? activeLocation
              : location,

          jobRole:
            profileVariantId ===
              activeId &&
            activeJobRole
              ? activeJobRole
              : jobRole,
        },
      }
    );
  }


  /**
   * Runtime ACTIVE state is authoritative and must remain
   * representable even when:
   *
   * - the current analytics window contains zero events;
   * - the catalog is temporarily stale;
   * - pagination has not returned the ACTIVE row yet.
   */
  if (
    activeId &&
    activeLocation &&
    activeJobRole &&
    !byId.has(
      activeId
    )
  ) {
    byId.set(
      activeId,
      {
        profileVariantId:
          activeId,

        createdAt:
          null,

        targeting: {
          location:
            activeLocation,

          jobRole:
            activeJobRole,
        },

        runtimeOnly:
          true,
      }
    );
  }


  return Array.from(
    byId.values()
  ).sort(
    (
      left,
      right
    ) => {
      const leftId =
        cleanAnalyticsFilterValue(
          left
            ?.profileVariantId
        );

      const rightId =
        cleanAnalyticsFilterValue(
          right
            ?.profileVariantId
        );


      // Current ACTIVE Profile always leads the meaningful list.
      if (
        leftId ===
          activeId &&
        rightId !==
          activeId
      ) {
        return -1;
      }

      if (
        rightId ===
          activeId &&
        leftId !==
          activeId
      ) {
        return 1;
      }


      const leftCreatedAt =
        Date.parse(
          left
            ?.createdAt ||
          ""
        );

      const rightCreatedAt =
        Date.parse(
          right
            ?.createdAt ||
          ""
        );

      const leftTime =
        Number.isFinite(
          leftCreatedAt
        )
          ? leftCreatedAt
          : Number.NEGATIVE_INFINITY;

      const rightTime =
        Number.isFinite(
          rightCreatedAt
        )
          ? rightCreatedAt
          : Number.NEGATIVE_INFINITY;


      if (
        leftTime !==
        rightTime
      ) {
        return (
          rightTime -
          leftTime
        );
      }


      return leftId
        .localeCompare(
          rightId
        );
    }
  );
}


function uniqueProfileTargetingValues(
  variants,
  key
) {
  const seen =
    new Set();

  const values =
    [];


  for (
    const variant of
      variants || []
  ) {
    const value =
      cleanAnalyticsFilterValue(
        variant
          ?.targeting
          ?.[key]
      );

    if (
      !value ||
      seen.has(
        value
      )
    ) {
      continue;
    }


    seen.add(
      value
    );

    values.push(
      value
    );
  }


  return values;
}


function hasProfileTargetingPair(
  variants,
  location,
  jobRole
) {
  const cleanLocation =
    cleanAnalyticsFilterValue(
      location
    );

  const cleanJobRole =
    cleanAnalyticsFilterValue(
      jobRole
    );


  return (
    variants || []
  ).some(
    (
      variant
    ) =>
      cleanAnalyticsFilterValue(
        variant
          ?.targeting
          ?.location
      ) ===
        cleanLocation &&
      cleanAnalyticsFilterValue(
        variant
          ?.targeting
          ?.jobRole
      ) ===
        cleanJobRole
  );
}


async function loadCompleteProfileVariantCatalog(
  loadPage
) {
  if (
    typeof loadPage !==
    "function"
  ) {
    throw new Error(
      "Profile Variant catalog loader is unavailable."
    );
  }


  const variants =
    [];

  const seenTokens =
    new Set();

  let nextToken =
    undefined;


  for (
    let page = 0;
    page < 100;
    page += 1
  ) {
    const result =
      await loadPage({
        limit:
          50,

        ...(nextToken
          ? {
              nextToken,
            }
          : {}),
      });


    if (
      Array.isArray(
        result
          ?.variants
      )
    ) {
      variants.push(
        ...result
          .variants
      );
    }


    const next =
      cleanAnalyticsFilterValue(
        result
          ?.nextToken
      );


    if (!next) {
      return variants;
    }


    if (
      seenTokens.has(
        next
      )
    ) {
      throw new Error(
        "Profile Variant catalog pagination repeated a nextToken."
      );
    }


    seenTokens.add(
      next
    );

    nextToken =
      next;
  }


  throw new Error(
    "Profile Variant catalog exceeded the pagination safety limit."
  );
}


// -----------------------------
// Main dashboard
// -----------------------------

export default function AdminAnalytics({
  activeProfileVariantId =
    "",

  activeProfileTargeting =
    null,

  loadProfileVariants =
    listProfileVariants,
} = {}) {
  const [
    analyticsMode,
    setAnalyticsMode,
  ] =
    useState(
      "live"
    );

  const profileVersion =
    useMemo(
      () =>
        readBuildProfileVersion(),
      []
    );

  const activeProfileVariantIdValue =
    cleanAnalyticsFilterValue(
      activeProfileVariantId
    );

  const activeProfileTargetingLocation =
    cleanAnalyticsFilterValue(
      activeProfileTargeting
        ?.location
    );

  const activeProfileTargetingJobRole =
    cleanAnalyticsFilterValue(
      activeProfileTargeting
        ?.jobRole
    );

  const authoritativeProfileFilterMode =
    Boolean(
      activeProfileVariantIdValue &&
      activeProfileTargetingLocation &&
      activeProfileTargetingJobRole
    );

  const initialRange =
    useMemo(
      () =>
        rangeForPreset(
          "7d"
        ),
      []
    );

  const [period, setPeriod] =
    useState("7d");

  const [
    customFrom,
    setCustomFrom,
  ] =
    useState(
      initialRange.from
    );

  const [
    customTo,
    setCustomTo,
  ] =
    useState(
      initialRange.to
    );

  const [
    appliedCustomRange,
    setAppliedCustomRange,
  ] =
    useState(
      initialRange
    );

  const [
    customError,
    setCustomError,
  ] =
    useState("");

  const [
    profileVersionFilter,
    setProfileVersionFilter,
  ] =
    useState("all");

  const [
    profileVariantFilter,
    setProfileVariantFilter,
  ] =
    useState("all");

  const [
    profileTargetingLocationFilter,
    setProfileTargetingLocationFilter,
  ] =
    useState("all");

  const [
    profileTargetingJobRoleFilter,
    setProfileTargetingJobRoleFilter,
  ] =
    useState("all");

  const [
    trafficClassificationFilter,
    setTrafficClassificationFilter,
  ] =
    useState(
      DEFAULT_TRAFFIC_CLASSIFICATION
    );

  const [
    boundaryFilter,
    setBoundaryFilter,
  ] =
    useState("all");

  const [
    boundaryCatalog,
    setBoundaryCatalog,
  ] =
    useState([]);

  const [
    metadataReady,
    setMetadataReady,
  ] =
    useState(false);

  const [
    metaLoading,
    setMetaLoading,
  ] =
    useState(false);

  const [
    metaError,
    setMetaError,
  ] =
    useState("");

  const [
    resetArmed,
    setResetArmed,
  ] =
    useState(false);

  const [
    resetting,
    setResetting,
  ] =
    useState(false);

  const [
    resetError,
    setResetError,
  ] =
    useState("");

  const [
    pendingResetRequest,
    setPendingResetRequest,
  ] =
    useState(null);

  const defaultBaselineInitialized =
    useRef(false);

  const profileDefaultVariantSignature =
    useRef("");

  const [
    comparePrevious,
    setComparePrevious,
  ] =
    useState(false);

  const [
    data,
    setData,
  ] =
    useState(null);

  const [
    previousData,
    setPreviousData,
  ] =
    useState(null);

  const [
    releaseCatalog,
    setReleaseCatalog,
  ] =
    useState([]);

  const [
    runtimeFilterCatalog,
    setRuntimeFilterCatalog,
  ] =
    useState(null);

  const [
    profileVariantCatalog,
    setProfileVariantCatalog,
  ] =
    useState([]);

  const [
    profileFiltersReady,
    setProfileFiltersReady,
  ] =
    useState(false);

  const [
    loading,
    setLoading,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState("");

  const [
    lastUpdated,
    setLastUpdated,
  ] =
    useState(null);

  const [
    refreshVersion,
    setRefreshVersion,
  ] =
    useState(0);

  const range =
    useMemo(() => {
      if (
        period === "custom"
      ) {
        return (
          appliedCustomRange
        );
      }

      return rangeForPreset(
        period
      );
    }, [
      period,
      appliedCustomRange,
    ]);

  const comparisonRange =
    useMemo(
      () =>
        comparePrevious
          ? previousRange(
              range
            )
          : null,
      [
        comparePrevious,
        range,
      ]
    );

  const releaseOptions =
    useMemo(() => {
      const ids = [];
      const seen =
        new Set();

      function add(id) {
        const clean =
          String(
            id || ""
          ).trim();

        if (
          !clean ||
          seen.has(clean)
        ) {
          return;
        }

        seen.add(clean);
        ids.push(clean);
      }

      // /analytics/meta already returns
      // releases newest-first.
      for (
        const release of
          releaseCatalog || []
      ) {
        add(
          release
            ?.profileVersionId
        );
      }

      // Current build may not yet have
      // been registered by deployment CI.
      add(
        profileVersion?.id
      );

      // Never make a previously selected
      // value disappear from the control.
      if (
        profileVersionFilter !==
        "all"
      ) {
        add(
          profileVersionFilter
        );
      }

      return ids;
    }, [
      releaseCatalog,
      profileVersion,
      profileVersionFilter,
    ]);

  const runtimeFiltersActive =
    profileVariantFilter !==
      "all" ||
    profileTargetingLocationFilter !==
      "all" ||
    profileTargetingJobRoleFilter !==
      "all";


  const catalogQueryNeeded =
    runtimeFiltersActive ||
    trafficClassificationFilter !==
      "all";


  const filterCatalog =
    runtimeFilterCatalog ||
    data;


  const normalizedProfileVariantCatalog =
    useMemo(
      () =>
        normalizeProfileVariantCatalog({
          variants:
            profileVariantCatalog,

          activeProfileVariantId:
            activeProfileVariantIdValue,

          activeTargetingLocation:
            activeProfileTargetingLocation,

          activeTargetingJobRole:
            activeProfileTargetingJobRole,
        }),
      [
        profileVariantCatalog,
        activeProfileVariantIdValue,
        activeProfileTargetingLocation,
        activeProfileTargetingJobRole,
      ]
    );


  const selectedAuthoritativeProfileVariant =
    useMemo(
      () =>
        profileVariantFilter ===
          "all"
          ? null
          : normalizedProfileVariantCatalog
              .find(
                (
                  variant
                ) =>
                  variant
                    ?.profileVariantId ===
                  profileVariantFilter
              ) ||
            null,
      [
        normalizedProfileVariantCatalog,
        profileVariantFilter,
      ]
    );


  const profileVariantOptions =
    useMemo(
      () => {
        if (
          authoritativeProfileFilterMode
        ) {
          return normalizedProfileVariantCatalog
            .map(
              (
                variant
              ) =>
                variant
                  .profileVariantId
            );
        }


        return membershipFilterOptions(
          filterCatalog
            ?.profileVariants,
          "profileVariantId",
          profileVariantFilter
        );
      },
      [
        authoritativeProfileFilterMode,
        normalizedProfileVariantCatalog,
        filterCatalog,
        profileVariantFilter,
      ]
    );


  const profileTargetingLocationOptions =
    useMemo(
      () => {
        if (
          !authoritativeProfileFilterMode
        ) {
          return membershipFilterOptions(
            filterCatalog
              ?.profileTargetingLocations,
            "profileTargetingLocation",
            profileTargetingLocationFilter
          );
        }


        if (
          selectedAuthoritativeProfileVariant
        ) {
          return [
            selectedAuthoritativeProfileVariant
              .targeting
              .location,
          ];
        }


        const eligible =
          profileTargetingJobRoleFilter ===
            "all"
            ? normalizedProfileVariantCatalog
            : normalizedProfileVariantCatalog
                .filter(
                  (
                    variant
                  ) =>
                    variant
                      ?.targeting
                      ?.jobRole ===
                    profileTargetingJobRoleFilter
                );


        return uniqueProfileTargetingValues(
          eligible,
          "location"
        );
      },
      [
        authoritativeProfileFilterMode,
        selectedAuthoritativeProfileVariant,
        normalizedProfileVariantCatalog,
        filterCatalog,
        profileTargetingLocationFilter,
        profileTargetingJobRoleFilter,
      ]
    );


  const profileTargetingJobRoleOptions =
    useMemo(
      () => {
        if (
          !authoritativeProfileFilterMode
        ) {
          return membershipFilterOptions(
            filterCatalog
              ?.profileTargetingJobRoles,
            "profileTargetingJobRole",
            profileTargetingJobRoleFilter
          );
        }


        if (
          selectedAuthoritativeProfileVariant
        ) {
          return [
            selectedAuthoritativeProfileVariant
              .targeting
              .jobRole,
          ];
        }


        const eligible =
          profileTargetingLocationFilter ===
            "all"
            ? normalizedProfileVariantCatalog
            : normalizedProfileVariantCatalog
                .filter(
                  (
                    variant
                  ) =>
                    variant
                      ?.targeting
                      ?.location ===
                    profileTargetingLocationFilter
                );


        return uniqueProfileTargetingValues(
          eligible,
          "jobRole"
        );
      },
      [
        authoritativeProfileFilterMode,
        selectedAuthoritativeProfileVariant,
        normalizedProfileVariantCatalog,
        filterCatalog,
        profileTargetingLocationFilter,
        profileTargetingJobRoleFilter,
      ]
    );


  const boundaryOptions =
    useMemo(
      () =>
        Array.isArray(
          boundaryCatalog
        )
          ? boundaryCatalog
          : [],
      [
        boundaryCatalog,
      ]
    );

  const selectedBoundary =
    useMemo(
      () => {
        if (
          boundaryFilter ===
          "all"
        ) {
          return null;
        }

        return (
          boundaryOptions.find(
            (boundary) =>
              boundary
                ?.boundaryId ===
              boundaryFilter
          ) ||
          null
        );
      },
      [
        boundaryFilter,
        boundaryOptions,
      ]
    );

  const selectedFromLabel =
    boundaryFilter === "all"
      ? "All history"
      : selectedBoundary
        ? boundaryOptionLabel(
            selectedBoundary,
            releaseCatalog
          )
        : boundaryFilter;

  const loadAnalyticsMetadata =
    useCallback(
      async (
        signal
      ) => {
        setMetaLoading(
          true
        );

        setMetaError(
          ""
        );

        try {
          const meta =
            await queryAnalyticsMeta({
              signal,
            });

          const releases =
            Array.isArray(
              meta?.releases
            )
              ? meta.releases
              : [];

          const boundaries =
            Array.isArray(
              meta?.boundaries
            )
              ? meta.boundaries
              : [];

          setReleaseCatalog(
            releases
          );

          setBoundaryCatalog(
            boundaries
          );

          // A reset changes the dashboard's
          // default baseline.
          //
          // Deploy boundaries remain selectable
          // but do NOT silently reset analytics.
          if (
            !defaultBaselineInitialized
              .current
          ) {
            const now =
              Date.now();

            const latestReset =
              boundaries.find(
                (boundary) =>
                  boundary?.type ===
                    "reset" &&
                  Number(
                    boundary
                      ?.effectiveAt
                  ) <= now
              );

            setBoundaryFilter(
              latestReset
                ?.boundaryId ||
                "all"
            );

            defaultBaselineInitialized
              .current = true;
          }
        } catch (e) {
          if (
            e?.name ===
            "AbortError"
          ) {
            return;
          }

          setMetaError(
            String(
              e?.message || e
            )
          );
        } finally {
          if (
            !signal?.aborted
          ) {
            setMetaLoading(
              false
            );

            setMetadataReady(
              true
            );
          }
        }
      },
      []
    );

  const loadAnalytics =
    useCallback(
      async (
        signal
      ) => {
        setLoading(true);
        setError("");

        try {
          const currentPromise =
            queryAnalyticsAgg({
              profileVersionId:
                profileVersionFilter,

              profileVariantId:
                profileVariantFilter,

              profileTargetingLocation:
                profileTargetingLocationFilter,

              profileTargetingJobRole:
                profileTargetingJobRoleFilter,

              trafficClassification:
                trafficClassificationFilter,

              boundaryId:
                boundaryFilter,

              from:
                range.from,

              to:
                range.to,

              signal,
            });


          /**
           * Filter controls need an unfiltered identity
           * catalogue for the same date/release/baseline
           * scope.
           *
           * Otherwise selecting prv_A would cause the
           * filtered response to hide prv_B from the
           * dropdown, forcing the user through "All"
           * just to change variants.
           *
           * Avoid the extra request when no runtime
           * Profile filter is active: currentData itself
           * is already the correct catalogue.
           */
          const catalogPromise =
            catalogQueryNeeded
              ? queryAnalyticsAgg(
                  {
                    profileVersionId:
                      profileVersionFilter,

                    trafficClassification:
                      "all",

                    boundaryId:
                      boundaryFilter,

                    from:
                      range.from,

                    to:
                      range.to,

                    signal,
                  }
                )
              : Promise.resolve(
                  null
                );

          const previousPromise =
            comparePrevious &&
            comparisonRange
              ? queryAnalyticsAgg(
                  {
                    profileVersionId:
                      profileVersionFilter,

                    profileVariantId:
                      profileVariantFilter,

                    profileTargetingLocation:
                      profileTargetingLocationFilter,

                    profileTargetingJobRole:
                      profileTargetingJobRoleFilter,

                    trafficClassification:
                      trafficClassificationFilter,

                    boundaryId:
                      boundaryFilter,

                    from:
                      comparisonRange.from,

                    to:
                      comparisonRange.to,

                    signal,
                  }
                )
              : Promise.resolve(
                  null
                );

          const [
            currentData,
            previousResult,
            catalogResult,
          ] =
            await Promise.all([
              currentPromise,
              previousPromise,
              catalogPromise,
            ]);

          setData(
            currentData
          );

          setRuntimeFilterCatalog(
            catalogResult ||
            currentData
          );

          setPreviousData(
            previousResult
          );

          setLastUpdated(
            Date.now()
          );
        } catch (e) {
          if (
            e?.name ===
            "AbortError"
          ) {
            return;
          }

          setData(null);
          setPreviousData(null);

          setError(
            String(
              e?.message || e
            )
          );
        } finally {
          if (
            !signal?.aborted
          ) {
            setLoading(
              false
            );
          }
        }
      },
      [
        range.from,
        range.to,
        profileVersionFilter,
        profileVariantFilter,
        profileTargetingLocationFilter,
        profileTargetingJobRoleFilter,
        trafficClassificationFilter,
        boundaryFilter,
        comparePrevious,
        catalogQueryNeeded,
        comparisonRange,
      ]
    );

  useEffect(
    () => {
      if (
        !authoritativeProfileFilterMode
      ) {
        setProfileFiltersReady(
          true
        );

        return;
      }


      const signature =
        [
          activeProfileVariantIdValue,
          activeProfileTargetingLocation,
          activeProfileTargetingJobRole,
        ].join(
          "\u0000"
        );


      if (
        profileDefaultVariantSignature
          .current !==
        signature
      ) {
        /**
         * One React effect transition updates the complete Profile
         * filter tuple.
         *
         * The aggregate query therefore never observes:
         *
         *   new Profile Variant
         *   + stale old location
         *   + stale old job role
         */
        setProfileVariantFilter(
          activeProfileVariantIdValue
        );

        setProfileTargetingLocationFilter(
          activeProfileTargetingLocation
        );

        setProfileTargetingJobRoleFilter(
          activeProfileTargetingJobRole
        );

        profileDefaultVariantSignature
          .current =
          signature;
      }


      setProfileFiltersReady(
        true
      );
    },
    [
      authoritativeProfileFilterMode,
      activeProfileVariantIdValue,
      activeProfileTargetingLocation,
      activeProfileTargetingJobRole,
    ]
  );


  useEffect(
    () => {
      if (
        analyticsMode !==
          "live" ||
        !authoritativeProfileFilterMode
      ) {
        setProfileVariantCatalog(
          []
        );

        return undefined;
      }


      let cancelled =
        false;


      (async () => {
        try {
          const variants =
            await loadCompleteProfileVariantCatalog(
              loadProfileVariants
            );


          if (
            !cancelled
          ) {
            setProfileVariantCatalog(
              variants
            );
          }
        } catch {
          /**
           * Fail closed to the ACTIVE runtime tuple.
           *
           * normalizeProfileVariantCatalog() injects the exact
           * ACTIVE runtime identity, so a catalog read failure can
           * never make the live Profile disappear or fabricate
           * historical targeting.
           */
          if (
            !cancelled
          ) {
            setProfileVariantCatalog(
              []
            );
          }
        }
      })();


      return () => {
        cancelled =
          true;
      };
    },
    [
      analyticsMode,
      authoritativeProfileFilterMode,
      activeProfileVariantIdValue,
      activeProfileTargetingLocation,
      activeProfileTargetingJobRole,
      loadProfileVariants,
      refreshVersion,
    ]
  );


  useEffect(() => {
    if (
      analyticsMode !==
        "live"
    ) {
      return undefined;
    }

    const controller =
      new AbortController();

    loadAnalyticsMetadata(
      controller.signal
    );

    return () => {
      controller.abort();
    };
  }, [
    analyticsMode,
    loadAnalyticsMetadata,
    refreshVersion,
  ]);

  useEffect(() => {
    if (
      analyticsMode !==
        "live" ||
      !metadataReady ||
      !profileFiltersReady
    ) {
      return undefined;
    }

    const controller =
      new AbortController();

    loadAnalytics(
      controller.signal
    );

    return () => {
      controller.abort();
    };
  }, [
    analyticsMode,
    loadAnalytics,
    refreshVersion,
    metadataReady,
    profileFiltersReady,
  ]);

  const overview =
    data?.overview || {};

  const previousOverview =
    previousData?.overview ||
    null;

  const sections =
    Array.isArray(
      data?.sections
    )
      ? data.sections
      : [];

  const daily =
    Array.isArray(
      data?.daily
    )
      ? data.daily
      : [];

  const trafficClassification =
    data?.trafficClassification ||
    null;


  const sessionIntelligence =
    data?.sessionIntelligence ||
    {};

  const sessionCoverage =
    sessionIntelligence
      ?.coverage ||
    {};

  const recentSessions =
    Array.isArray(
      sessionIntelligence
        ?.recentSessions
    )
      ? sessionIntelligence
          .recentSessions
      : [];

  const topTransitions =
    Array.isArray(
      sessionIntelligence
        ?.topTransitions
    )
      ? sessionIntelligence
          .topTransitions
      : [];

  const topSectionPaths =
    Array.isArray(
      sessionIntelligence
        ?.topSectionPaths
    )
      ? sessionIntelligence
          .topSectionPaths
      : [];

  const applyProfileVariantFilter =
    useCallback(
      (
        nextValue
      ) => {
        const next =
          cleanAnalyticsFilterValue(
            nextValue
          );


        if (
          next ===
          "all"
        ) {
          setProfileVariantFilter(
            "all"
          );

          setProfileTargetingLocationFilter(
            "all"
          );

          setProfileTargetingJobRoleFilter(
            "all"
          );

          return;
        }


        if (
          authoritativeProfileFilterMode
        ) {
          const variant =
            normalizedProfileVariantCatalog
              .find(
                (
                  item
                ) =>
                  item
                    ?.profileVariantId ===
                  next
              );


          if (!variant) {
            return;
          }


          setProfileVariantFilter(
            next
          );

          setProfileTargetingLocationFilter(
            variant
              .targeting
              .location
          );

          setProfileTargetingJobRoleFilter(
            variant
              .targeting
              .jobRole
          );

          return;
        }


        // Backward-compatible fallback for contexts that do not
        // provide formal runtime Profile identity.
        setProfileVariantFilter(
          next
        );
      },
      [
        authoritativeProfileFilterMode,
        normalizedProfileVariantCatalog,
      ]
    );


  const applyProfileTargetingLocationFilter =
    useCallback(
      (
        nextValue
      ) => {
        const next =
          cleanAnalyticsFilterValue(
            nextValue
          ) ||
          "all";


        if (
          !authoritativeProfileFilterMode ||
          profileVariantFilter !==
            "all"
        ) {
          setProfileTargetingLocationFilter(
            next
          );

          return;
        }


        if (
          next ===
          "all"
        ) {
          setProfileTargetingLocationFilter(
            "all"
          );

          return;
        }


        const currentRole =
          profileTargetingJobRoleFilter;


        setProfileTargetingLocationFilter(
          next
        );


        if (
          currentRole !==
            "all" &&
          !hasProfileTargetingPair(
            normalizedProfileVariantCatalog,
            next,
            currentRole
          )
        ) {
          setProfileTargetingJobRoleFilter(
            "all"
          );
        }
      },
      [
        authoritativeProfileFilterMode,
        profileVariantFilter,
        profileTargetingJobRoleFilter,
        normalizedProfileVariantCatalog,
      ]
    );


  const applyProfileTargetingJobRoleFilter =
    useCallback(
      (
        nextValue
      ) => {
        const next =
          cleanAnalyticsFilterValue(
            nextValue
          ) ||
          "all";


        if (
          !authoritativeProfileFilterMode ||
          profileVariantFilter !==
            "all"
        ) {
          setProfileTargetingJobRoleFilter(
            next
          );

          return;
        }


        if (
          next ===
          "all"
        ) {
          setProfileTargetingJobRoleFilter(
            "all"
          );

          return;
        }


        const currentLocation =
          profileTargetingLocationFilter;


        setProfileTargetingJobRoleFilter(
          next
        );


        if (
          currentLocation !==
            "all" &&
          !hasProfileTargetingPair(
            normalizedProfileVariantCatalog,
            currentLocation,
            next
          )
        ) {
          setProfileTargetingLocationFilter(
            "all"
          );
        }
      },
      [
        authoritativeProfileFilterMode,
        profileVariantFilter,
        profileTargetingLocationFilter,
        normalizedProfileVariantCatalog,
      ]
    );


  const clearRuntimeFilters =
    useCallback(() => {
      setProfileVariantFilter(
        "all"
      );

      setProfileTargetingLocationFilter(
        "all"
      );

      setProfileTargetingJobRoleFilter(
        "all"
      );
    }, []);

  const applyCustomRange =
    useCallback(() => {
      setCustomError("");

      if (
        !customFrom ||
        !customTo
      ) {
        setCustomError(
          "Choose both a start and end date."
        );
        return;
      }

      const count =
        dayCount(
          customFrom,
          customTo
        );

      if (
        count <= 0
      ) {
        setCustomError(
          "Start date must be on or before end date."
        );
        return;
      }

      if (
        count >
        MAX_EXACT_RANGE_DAYS
      ) {
        setCustomError(
          `Exact analytics currently supports up to ${MAX_EXACT_RANGE_DAYS} days per query.`
        );
        return;
      }

      setAppliedCustomRange(
        {
          from:
            customFrom,
          to:
            customTo,
        }
      );

      setPeriod(
        "custom"
      );
    }, [
      customFrom,
      customTo,
    ]);

  const armBaselineReset =
    useCallback(() => {
      setResetError(
        ""
      );

      setPendingResetRequest(
        (existing) =>
          existing ||
          createResetBoundaryRequest()
      );

      setResetArmed(
        true
      );
    }, []);

  const cancelBaselineReset =
    useCallback(() => {
      if (resetting) {
        return;
      }

      setResetArmed(
        false
      );

      setResetError(
        ""
      );

      setPendingResetRequest(
        null
      );
    }, [
      resetting,
    ]);

  const confirmBaselineReset =
    useCallback(
      async () => {
        const request =
          pendingResetRequest ||
          createResetBoundaryRequest();

        setPendingResetRequest(
          request
        );

        setResetting(
          true
        );

        setResetError(
          ""
        );

        try {
          const result =
            await createAnalyticsBoundary(
              request
            );

          const boundary =
            result?.boundary;

          if (
            !boundary
              ?.boundaryId
          ) {
            throw new Error(
              "Reset boundary was created but the response did not include a boundary ID."
            );
          }

          // The POST response is authoritative,
          // so make the new boundary immediately
          // available to the selector.
          setBoundaryCatalog(
            (current) => {
              const remaining =
                (
                  current ||
                  []
                ).filter(
                  (item) =>
                    item
                      ?.boundaryId !==
                    boundary
                      .boundaryId
                );

              return [
                boundary,
                ...remaining,
              ].sort(
                (a, b) =>
                  Number(
                    b?.effectiveAt ||
                      0
                  ) -
                  Number(
                    a?.effectiveAt ||
                      0
                  )
              );
            }
          );

          // A manual reset becomes the active
          // dashboard baseline immediately.
          setBoundaryFilter(
            boundary.boundaryId
          );

          setResetArmed(
            false
          );

          setPendingResetRequest(
            null
          );
        } catch (e) {
          // Keep pendingResetRequest intact.
          // A retry therefore uses the SAME
          // boundary ID and effective timestamp.
          setResetError(
            String(
              e?.message || e
            )
          );
        } finally {
          setResetting(
            false
          );
        }
      },
      [
        pendingResetRequest,
      ]
    );

  const downloadCurrentJson =
    useCallback(() => {
      if (!data) return;

      const releaseLabel =
        profileVersionFilter ===
        "all"
          ? "all-releases"
          : profileVersionFilter;

      const safeRelease =
        releaseLabel.replace(
          /[^a-zA-Z0-9._-]+/g,
          "_"
        );

      const baselineLabel =
        boundaryFilter === "all"
          ? "all-history"
          : boundaryFilter;

      const safeBaseline =
        baselineLabel.replace(
          /[^a-zA-Z0-9._-]+/g,
          "_"
        );


      const safeTraffic =
        trafficClassificationFilter.replace(
          /[^a-zA-Z0-9._-]+/g,
          "_"
        );


      downloadJsonFile(
        `tejas-profile-analytics_${range.from}_to_${range.to}_${safeRelease}_${safeTraffic}_${safeBaseline}.json`,
        {
          exportedAt:
            new Date()
              .toISOString(),

          filters: {
            period,

            range,

            profileVersionId:
              profileVersionFilter,

            profileVariantId:
              profileVariantFilter,

            profileTargetingLocation:
              profileTargetingLocationFilter,

            profileTargetingJobRole:
              profileTargetingJobRoleFilter,

            trafficClassification:
              trafficClassificationFilter,

            boundaryId:
              boundaryFilter,
          },

          analytics:
            data,

          comparison:
            previousData,
        }
      );
    }, [
      data,
      previousData,
      period,
      profileVersionFilter,
      profileVariantFilter,
      profileTargetingLocationFilter,
      profileTargetingJobRoleFilter,
      trafficClassificationFilter,
      boundaryFilter,
      range,
    ]);

  return (
    <section className="py-0 px-4 transition-colors">
      <SectionHeader
        icon={FaChartLine}
        title="Analytics"
      />

      <div className="px-2 sm:px-6 space-y-6">
        <div className="mt-10">
          <div className="inline-flex flex-wrap items-center gap-2 rounded-2xl border border-gray-200/70 dark:border-white/10 bg-white/50 dark:bg-white/5 p-1.5">
            <SegButton
              active={
                analyticsMode ===
                "live"
              }
              onClick={() =>
                setAnalyticsMode(
                  "live"
                )
              }
            >
              Live analytics
            </SegButton>

            <SegButton
              active={
                analyticsMode ===
                "archive"
              }
              onClick={() =>
                setAnalyticsMode(
                  "archive"
                )
              }
            >
              Historical archive
            </SegButton>
          </div>

          <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 max-w-3xl">
            {analyticsMode ===
            "live"
              ? "Queryable live Analytics with date, baseline, Profile and comparison filters."
              : "Immutable Configuration Analytics Reports finalized automatically for completed Usage Epochs."}
          </div>
        </div>


        {analyticsMode ===
        "archive" ? (
          <ConfigurationAnalyticsArchivePanel />
        ) : (
          <>
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
              <div className="max-w-3xl">
                <p className="text-gray-600 dark:text-gray-400">
                  Owner-only analytics backed by exact session-fragment data.
                  Visitor and session counts are deduplicated across the selected UTC date range.
                </p>

                <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                  <span className="rounded-full border border-gray-200/70 dark:border-white/10 bg-white/60 dark:bg-white/5 px-2.5 py-1 text-gray-600 dark:text-gray-300">
                    Range:{" "}
                    <span className="font-semibold text-gray-800 dark:text-gray-100">
                      {formatRangeLabel(
                        range
                      )}
                    </span>
                  </span>

                  <span className="rounded-full border border-gray-200/70 dark:border-white/10 bg-white/60 dark:bg-white/5 px-2.5 py-1 text-gray-600 dark:text-gray-300 max-w-full">
                    From:{" "}
                    <span className="font-semibold text-gray-800 dark:text-gray-100 break-all">
                      {selectedFromLabel}
                    </span>
                  </span>

                  <span className="rounded-full border border-gray-200/70 dark:border-white/10 bg-white/60 dark:bg-white/5 px-2.5 py-1 text-gray-600 dark:text-gray-300">
                    UTC
                  </span>

                  {data?.stage ? (
                    <span className="rounded-full border border-purple-200 dark:border-purple-400/20 bg-purple-50 dark:bg-purple-500/10 px-2.5 py-1 font-semibold uppercase tracking-wide text-purple-700 dark:text-purple-300">
                      {data.stage}
                    </span>
                  ) : null}

                  <span className="rounded-full border border-gray-200/70 dark:border-white/10 bg-white/60 dark:bg-white/5 px-2.5 py-1 text-gray-600 dark:text-gray-300 max-w-full">
                    Current build release:{" "}
                    <span className="font-semibold text-gray-800 dark:text-gray-100 break-all">
                      {profileVersion?.id ||
                        "unknown"}
                    </span>
                  </span>

                  <span className={cx(
                    "rounded-full border px-2.5 py-1 font-semibold",
                    trafficClassificationFilter ===
                      "all"
                      ? "border-gray-200/70 dark:border-white/10 bg-white/60 dark:bg-white/5 text-gray-700 dark:text-gray-300"
                      : trafficBadgeClassName(
                          trafficClassificationFilter
                        )
                  )}>
                    Traffic:{" "}
                    {trafficClassificationLabel(
                      trafficClassificationFilter
                    )}
                  </span>

                  {profileVariantFilter !==
                  "all" ? (
                    <span className="rounded-full border border-purple-200/70 dark:border-purple-400/20 bg-purple-50/70 dark:bg-purple-500/10 px-2.5 py-1 text-purple-700 dark:text-purple-300 max-w-full">
                      Variant:{" "}
                      <span className="font-mono font-semibold break-all">
                        {
                          profileVariantFilter
                        }
                      </span>
                    </span>
                  ) : null}

                  {profileTargetingLocationFilter !==
                  "all" ? (
                    <span className="rounded-full border border-gray-200/70 dark:border-white/10 bg-white/60 dark:bg-white/5 px-2.5 py-1 text-gray-600 dark:text-gray-300 max-w-full">
                      Target:{" "}
                      <span className="font-semibold break-all">
                        {
                          profileTargetingLocationFilter
                        }
                      </span>
                    </span>
                  ) : null}

                  {profileTargetingJobRoleFilter !==
                  "all" ? (
                    <span className="rounded-full border border-gray-200/70 dark:border-white/10 bg-white/60 dark:bg-white/5 px-2.5 py-1 text-gray-600 dark:text-gray-300 max-w-full">
                      Role:{" "}
                      <span className="font-semibold break-all">
                        {
                          profileTargetingJobRoleFilter
                        }
                      </span>
                    </span>
                  ) : null}

                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <SmallActionButton
                  onClick={() =>
                    setRefreshVersion(
                      (v) =>
                        v + 1
                    )
                  }
                  disabled={
                    loading ||
                    metaLoading ||
                    resetting
                  }
                  title="Reload exact analytics from the backend"
                >
                  {loading ||
                  metaLoading
                    ? "Refreshing…"
                    : "Refresh"}
                </SmallActionButton>

                <SmallActionButton
                  onClick={
                    downloadCurrentJson
                  }
                  disabled={
                    loading ||
                    !data
                  }
                  title="Download the current backend analytics response"
                >
                  Download JSON
                </SmallActionButton>
              </div>
            </div>

            <SectionCard
              title="Analytics window"
              subtitle="Time, baseline, Profile content, Traffic classification and legacy release are independent filters. Comparison applies the same filters to the immediately preceding period."
            >
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  {PERIODS.map(
                    (item) => (
                      <SegButton
                        key={
                          item.id
                        }
                        active={
                          period ===
                          item.id
                        }
                        onClick={() => {
                          setCustomError(
                            ""
                          );

                          setPeriod(
                            item.id
                          );
                        }}
                        title={
                          item.id ===
                          "1y"
                            ? "Maximum exact backend range: 366 days"
                            : undefined
                        }
                      >
                        {
                          item.label
                        }
                      </SegButton>
                    )
                  )}

                  <div className="mx-1 hidden sm:block h-6 w-px bg-gray-200 dark:bg-white/10" />

                  <SegButton
                    active={
                      comparePrevious
                    }
                    onClick={() =>
                      setComparePrevious(
                        (value) =>
                          !value
                      )
                    }
                  >
                    Compare previous
                  </SegButton>
                </div>

                {period ===
                "custom" ? (
                  <div className="rounded-xl border border-gray-200/70 dark:border-white/10 bg-white/40 dark:bg-white/5 p-3">
                    <div className="flex flex-col sm:flex-row sm:items-end gap-3">
                      <label className="flex-1">
                        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                          Start date
                        </div>

                        <input
                          type="date"
                          value={
                            customFrom
                          }
                          onChange={(
                            e
                          ) =>
                            setCustomFrom(
                              e.target
                                .value
                            )
                          }
                          className="w-full rounded-lg border border-gray-200/70 dark:border-white/10 bg-white/70 dark:bg-white/10 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 outline-none"
                        />
                      </label>

                      <label className="flex-1">
                        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                          End date
                        </div>

                        <input
                          type="date"
                          value={
                            customTo
                          }
                          onChange={(
                            e
                          ) =>
                            setCustomTo(
                              e.target
                                .value
                            )
                          }
                          className="w-full rounded-lg border border-gray-200/70 dark:border-white/10 bg-white/70 dark:bg-white/10 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 outline-none"
                        />
                      </label>

                      <SmallActionButton
                        onClick={
                          applyCustomRange
                        }
                      >
                        Apply
                      </SmallActionButton>
                    </div>

                    {customError ? (
                      <div className="mt-2 text-xs text-red-600 dark:text-red-400">
                        {
                          customError
                        }
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <div className="rounded-xl border border-gray-200/70 dark:border-white/10 bg-white/40 dark:bg-white/5 p-3">
                    <div className="text-[11px] uppercase tracking-wide font-semibold text-gray-500 dark:text-gray-400">
                      Selected range
                    </div>

                    <div className="mt-1 text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {formatRangeLabel(
                        range
                      )}
                    </div>

                    <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {dayCount(
                        range.from,
                        range.to
                      )}{" "}
                      UTC day
                      {dayCount(
                        range.from,
                        range.to
                      ) === 1
                        ? ""
                        : "s"}

                      {comparePrevious &&
                      comparisonRange
                        ? ` · Previous: ${formatRangeLabel(
                            comparisonRange
                          )}`
                        : ""}
                    </div>
                  </div>

                  <label className="rounded-xl border border-gray-200/70 dark:border-white/10 bg-white/40 dark:bg-white/5 p-3">
                    <div className="text-[11px] uppercase tracking-wide font-semibold text-gray-500 dark:text-gray-400">
                      From
                    </div>

                    <select
                      value={
                        boundaryFilter
                      }
                      disabled={
                        metaLoading ||
                        resetting
                      }
                      onChange={(
                        e
                      ) => {
                        setBoundaryFilter(
                          e.target.value
                        );

                        setResetArmed(
                          false
                        );

                        setPendingResetRequest(
                          null
                        );

                        setResetError(
                          ""
                        );
                      }}
                      className="mt-1 w-full rounded-lg border border-gray-200/70 dark:border-white/10 bg-white/80 dark:bg-[#151521] px-3 py-2 text-sm text-gray-900 dark:text-gray-100 outline-none disabled:opacity-50"
                    >
                      <option value="all">
                        All history
                      </option>

                      {boundaryOptions.map(
                        (boundary) => (
                          <option
                            key={
                              boundary
                                .boundaryId
                            }
                            value={
                              boundary
                                .boundaryId
                            }
                          >
                            {boundaryOptionLabel(
                              boundary,
                              releaseCatalog
                            )}
                          </option>
                        )
                      )}
                    </select>

                    <div className="mt-1.5 text-[11px] text-gray-500 dark:text-gray-400">
                      Baseline lower bound. The selected period still applies.
                    </div>
                  </label>

                  <label className="rounded-xl border border-gray-200/70 dark:border-white/10 bg-white/40 dark:bg-white/5 p-3">
                    <div className="text-[11px] uppercase tracking-wide font-semibold text-gray-500 dark:text-gray-400">
                      Legacy release
                    </div>

                    <select
                      aria-label="Legacy release"
                      value={
                        profileVersionFilter
                      }
                      disabled={
                        metaLoading
                      }
                      onChange={(
                        e
                      ) =>
                        setProfileVersionFilter(
                          e.target.value
                        )
                      }
                      className="mt-1 w-full rounded-lg border border-gray-200/70 dark:border-white/10 bg-white/80 dark:bg-[#151521] px-3 py-2 text-sm text-gray-900 dark:text-gray-100 outline-none disabled:opacity-50"
                    >
                      <option value="all">
                        All legacy releases
                      </option>

                      {releaseOptions.map(
                        (id) => (
                          <option
                            key={id}
                            value={id}
                          >
                            {id ===
                            profileVersion
                              ?.id
                              ? `${id} (current)`
                              : id}
                          </option>
                        )
                      )}
                    </select>

                    <div className="mt-1.5 text-[11px] text-gray-500 dark:text-gray-400">
                      Existing profileVersionId dimension. Independent of Profile Variant activation.
                    </div>
                  </label>
                </div>

                <div className="rounded-xl border border-gray-200/70 dark:border-white/10 bg-white/40 dark:bg-white/5 p-4">
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                    <div className="max-w-2xl">
                      <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        Traffic classification
                      </div>

                      <div className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                        Privacy-safe heuristic classification for Analytics quality.
                        It is not an authentication or security decision.
                        Likely human is the default dashboard view.
                      </div>
                    </div>

                    <label className="w-full lg:w-[280px]">
                      <div className="text-[11px] uppercase tracking-wide font-semibold text-gray-500 dark:text-gray-400">
                        Traffic
                      </div>

                      <select
                        aria-label="Traffic"
                        value={
                          trafficClassificationFilter
                        }
                        disabled={
                          loading
                        }
                        onChange={(
                          e
                        ) =>
                          setTrafficClassificationFilter(
                            e.target.value
                          )
                        }
                        className="mt-1 w-full rounded-lg border border-gray-200/70 dark:border-white/10 bg-white/80 dark:bg-[#151521] px-3 py-2 text-sm text-gray-900 dark:text-gray-100 outline-none disabled:opacity-50"
                      >
                        {TRAFFIC_FILTERS.map(
                          (
                            item
                          ) => (
                            <option
                              key={
                                item.id
                              }
                              value={
                                item.id
                              }
                            >
                              {
                                item.label
                              }
                            </option>
                          )
                        )}
                      </select>

                      <div className="mt-1.5 text-[11px] text-gray-500 dark:text-gray-400">
                        Recalculates all KPIs, journeys, geography and engagement for the selected session class.
                      </div>
                    </label>
                  </div>

                  <div className="mt-4">
                    <TrafficCompositionSummary
                      traffic={
                        trafficClassification
                      }
                    />
                  </div>
                </div>


                <div className="rounded-xl border border-purple-200/70 dark:border-purple-400/20 bg-purple-50/40 dark:bg-purple-500/5 p-4">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        Profile content
                      </div>

                      <div className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                        Filter exact Analytics attribution by immutable Profile Variant
                        and authored targeting. Target location is Profile targeting,
                        not visitor geography.
                      </div>
                    </div>

                    {runtimeFiltersActive ? (
                      <SmallActionButton
                        onClick={
                          clearRuntimeFilters
                        }
                        disabled={
                          loading
                        }
                        title="Clear Profile Variant and targeting filters"
                      >
                        Clear profile filters
                      </SmallActionButton>
                    ) : null}
                  </div>

                  <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <label>
                      <div className="text-[11px] uppercase tracking-wide font-semibold text-gray-500 dark:text-gray-400">
                        Profile Variant
                      </div>

                      <select
                        aria-label="Profile Variant"
                        value={
                          profileVariantFilter
                        }
                        disabled={
                          loading
                        }
                        onChange={(
                          e
                        ) =>
                          applyProfileVariantFilter(
                            e.target.value
                          )
                        }
                        className="mt-1 w-full rounded-lg border border-gray-200/70 dark:border-white/10 bg-white/80 dark:bg-[#151521] px-3 py-2 text-sm text-gray-900 dark:text-gray-100 outline-none disabled:opacity-50"
                      >
                        <option value="all">
                          All Profile Variants
                        </option>

                        {profileVariantOptions.map(
                          (id) => (
                            <option
                              key={id}
                              value={id}
                            >
                              {id ===
                              activeProfileVariantIdValue
                                ? `${id} (active)`
                                : id}
                            </option>
                          )
                        )}
                      </select>

                      <div className="mt-1.5 text-[11px] text-gray-500 dark:text-gray-400">
                        Immutable content identity active when the event occurred.
                      </div>
                    </label>


                    <label>
                      <div className="text-[11px] uppercase tracking-wide font-semibold text-gray-500 dark:text-gray-400">
                        Target location
                      </div>

                      <select
                        aria-label="Target location"
                        value={
                          profileTargetingLocationFilter
                        }
                        disabled={
                          loading ||
                          (
                            authoritativeProfileFilterMode &&
                            profileVariantFilter !==
                              "all"
                          )
                        }
                        onChange={(
                          e
                        ) =>
                          applyProfileTargetingLocationFilter(
                            e.target.value
                          )
                        }
                        className="mt-1 w-full rounded-lg border border-gray-200/70 dark:border-white/10 bg-white/80 dark:bg-[#151521] px-3 py-2 text-sm text-gray-900 dark:text-gray-100 outline-none disabled:opacity-50"
                      >
                        <option value="all">
                          All target locations
                        </option>

                        {profileTargetingLocationOptions.map(
                          (value) => (
                            <option
                              key={
                                value
                              }
                              value={
                                value
                              }
                            >
                              {value}
                            </option>
                          )
                        )}
                      </select>

                      <div className="mt-1.5 text-[11px] text-gray-500 dark:text-gray-400">
                        Authored Profile targeting, not visitor geo.
                      </div>
                    </label>


                    <label>
                      <div className="text-[11px] uppercase tracking-wide font-semibold text-gray-500 dark:text-gray-400">
                        Target job role
                      </div>

                      <select
                        aria-label="Target job role"
                        value={
                          profileTargetingJobRoleFilter
                        }
                        disabled={
                          loading ||
                          (
                            authoritativeProfileFilterMode &&
                            profileVariantFilter !==
                              "all"
                          )
                        }
                        onChange={(
                          e
                        ) =>
                          applyProfileTargetingJobRoleFilter(
                            e.target.value
                          )
                        }
                        className="mt-1 w-full rounded-lg border border-gray-200/70 dark:border-white/10 bg-white/80 dark:bg-[#151521] px-3 py-2 text-sm text-gray-900 dark:text-gray-100 outline-none disabled:opacity-50"
                      >
                        <option value="all">
                          All target job roles
                        </option>

                        {profileTargetingJobRoleOptions.map(
                          (value) => (
                            <option
                              key={
                                value
                              }
                              value={
                                value
                              }
                            >
                              {value}
                            </option>
                          )
                        )}
                      </select>

                      <div className="mt-1.5 text-[11px] text-gray-500 dark:text-gray-400">
                        Authored audience/job-role targeting for the Profile Variant.
                      </div>
                    </label>
                  </div>
                </div>

                <div className="rounded-xl border border-amber-200/80 dark:border-amber-400/20 bg-amber-50/60 dark:bg-amber-500/5 p-4">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        Analytics baseline
                      </div>

                      <div className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                        Resetting creates a new baseline boundary only.
                        Historical aggregates and raw analytics are not deleted.
                      </div>
                    </div>

                    {!resetArmed ? (
                      <SmallActionButton
                        onClick={
                          armBaselineReset
                        }
                        disabled={
                          resetting
                        }
                        title="Create a new analytics baseline without deleting history"
                      >
                        Reset baseline
                      </SmallActionButton>
                    ) : null}
                  </div>

                  {resetArmed ? (
                    <div className="mt-4 rounded-lg border border-amber-300/70 dark:border-amber-400/25 bg-white/60 dark:bg-white/5 p-3">
                      <div className="text-xs font-semibold text-amber-800 dark:text-amber-200">
                        Confirm baseline reset
                      </div>

                      <div className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                        New analytics will use this boundary as the default
                        "From" point. You can still select "All history"
                        afterward to view older data.
                      </div>

                      {pendingResetRequest
                        ?.effectiveAt ? (
                        <div className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">
                          Effective:{" "}
                          <span className="font-semibold text-gray-700 dark:text-gray-300">
                            {formatTimestampUtc(
                              pendingResetRequest
                                .effectiveAt
                            )}
                          </span>
                        </div>
                      ) : null}

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={
                            confirmBaselineReset
                          }
                          disabled={
                            resetting
                          }
                          className="inline-flex items-center justify-center rounded-lg border border-amber-500/40 bg-amber-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {resetting
                            ? "Resetting…"
                            : "Confirm reset"}
                        </button>

                        <SmallActionButton
                          onClick={
                            cancelBaselineReset
                          }
                          disabled={
                            resetting
                          }
                        >
                          Cancel
                        </SmallActionButton>
                      </div>

                      {resetError ? (
                        <div className="mt-2 text-xs text-red-600 dark:text-red-400 break-words">
                          {resetError}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            </SectionCard>

            {metaError ? (
              <div className="rounded-xl border border-amber-300/60 dark:border-amber-500/30 bg-amber-50/60 dark:bg-amber-950/20 px-4 py-3 text-sm text-amber-800 dark:text-amber-200 whitespace-pre-wrap break-words">
                Analytics metadata failed:{" "}
                {metaError}
              </div>
            ) : null}

            {error ? (
              <div className="rounded-xl border border-red-300/60 dark:border-red-500/40 bg-red-50/60 dark:bg-red-950/30 px-4 py-3 text-sm text-red-800 dark:text-red-200 whitespace-pre-wrap break-words">
                Analytics failed:{" "}
                {error}
              </div>
            ) : null}

            {loading &&
            data ? (
              <div className="rounded-xl border border-purple-200/70 dark:border-purple-400/20 bg-purple-50/60 dark:bg-purple-950/20 px-4 py-2 text-xs text-purple-800 dark:text-purple-200">
                Refreshing backend analytics…
              </div>
            ) : null}

            {!data &&
            loading ? (
              <SectionCard
                title="Loading analytics"
                subtitle="Reading exact visitor and session fragments from the backend"
              >
                <div className="py-8 text-center text-sm text-gray-600 dark:text-gray-400">
                  Loading…
                </div>
              </SectionCard>
            ) : null}

            {data ? (
              <>
                <SectionCard
                  title="Overview"
                  subtitle={
                    comparePrevious &&
                    comparisonRange
                      ? `Current period compared with ${formatRangeLabel(
                          comparisonRange
                        )}`
                      : "Exact KPIs for the selected period"
                  }
                  action={
                    lastUpdated ? (
                      <div className="text-[11px] text-gray-500 dark:text-gray-400">
                        Updated{" "}
                        {new Date(
                          lastUpdated
                        ).toLocaleTimeString()}
                      </div>
                    ) : null
                  }
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <KpiCard
                      title="Unique visitors"
                      value={formatNumber(
                        overview.uniqueVisitors
                      )}
                      delta={
                        comparePrevious
                          ? comparisonDelta(
                              overview.uniqueVisitors,
                              previousOverview
                                ?.uniqueVisitors
                            )
                          : null
                      }
                      sub="exact distinct visitor hashes"
                    />

                    <KpiCard
                      title="New visitors"
                      value={formatNumber(
                        overview.newVisitors
                      )}
                      delta={
                        comparePrevious
                          ? comparisonDelta(
                              overview.newVisitors,
                              previousOverview
                                ?.newVisitors
                            )
                          : null
                      }
                      sub="first seen during this period"
                    />

                    <KpiCard
                      title="Returning visitors"
                      value={formatNumber(
                        overview.returningVisitors
                      )}
                      delta={
                        comparePrevious
                          ? comparisonDelta(
                              overview.returningVisitors,
                              previousOverview
                                ?.returningVisitors
                            )
                          : null
                      }
                      sub={
                        `${formatPercent(
                          overview.returningVisitorPct
                        )} of classified visitors${
                          Number(
                            overview.unclassifiedVisitors ||
                              0
                          ) > 0
                            ? ` · ${formatNumber(
                                overview.unclassifiedVisitors
                              )} unclassified`
                            : ""
                        }`
                      }
                    />

                    <KpiCard
                      title="Sessions"
                      value={formatNumber(
                        overview.sessions
                      )}
                      delta={
                        comparePrevious
                          ? comparisonDelta(
                              overview.sessions,
                              previousOverview
                                ?.sessions
                            )
                          : null
                      }
                      sub="exact logical sessions"
                    />

                    <KpiCard
                      title="Avg active time"
                      value={formatDuration(
                        overview.avgActiveMsPerSession
                      )}
                      delta={
                        comparePrevious
                          ? comparisonDelta(
                              overview.avgActiveMsPerSession,
                              previousOverview
                                ?.avgActiveMsPerSession
                            )
                          : null
                      }
                      sub="foreground engagement / session"
                    />

                    <KpiCard
                      title="Avg sections"
                      value={Number(
                        overview.avgSectionsPerSession ||
                          0
                      ).toFixed(2)}
                      delta={
                        comparePrevious
                          ? comparisonDelta(
                              overview.avgSectionsPerSession,
                              previousOverview
                                ?.avgSectionsPerSession
                            )
                          : null
                      }
                      sub="unique sections / session"
                    />

                    <KpiCard
                      title="Top section"
                      value={overview.topSection || "—"}
                      valueClassName="text-xl leading-tight break-words"
                      sub={
                        comparePrevious
                          ? `Previous: ${previousOverview?.topSection || "—"}`
                          : "ranked by section visits"
                      }
                    />

                    <KpiCard
                      title="Events"
                      value={formatNumber(
                        overview.eventCount
                      )}
                      delta={
                        comparePrevious
                          ? comparisonDelta(
                              overview.eventCount,
                              previousOverview
                                ?.eventCount
                            )
                          : null
                      }
                      sub={`${formatNumber(
                        overview.fragments
                      )} session-day fragments`}
                    />
                  </div>
                </SectionCard>

                <SectionCard
                  title="Visitor & session trend"
                  subtitle="Daily exact distinct counts — daily values are not summed to calculate the period-level unique visitor KPI"
                >
                  <TrendChart
                    points={daily}
                  />
                </SectionCard>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
                  <SectionCard
                    title="Section reach"
                    subtitle="Distinct visitors who reached each public section"
                  >
                    <SectionReach
                      sections={
                        sections
                      }
                    />
                  </SectionCard>

                  <SectionCard
                    title="Scroll depth"
                    subtitle="Distinct visitors reaching 25 / 50 / 75 / 100% milestones"
                  >
                    <DepthMilestoneTable
                      sections={
                        sections
                      }
                      milestones={
                        data.depthMilestones
                      }
                    />
                  </SectionCard>
                </div>

                <SectionCard
                  title="Section engagement"
                  subtitle="Reach, repeat visits and foreground active time"
                >
                  <SectionEngagementTable
                    sections={
                      sections
                    }
                  />
                </SectionCard>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  <SectionCard
                    title="CTA engagement"
                    subtitle="Canonical CTA interaction counts"
                  >
                    <InteractionTable
                      rows={
                        data.ctas
                      }
                      idKey="ctaId"
                      emptyText="No canonical CTA interactions have been recorded yet."
                    />
                  </SectionCard>

                  <SectionCard
                    title="Deep-link landings"
                    subtitle="Direct entry paths and hashes"
                  >
                    <InteractionTable
                      rows={
                        data.deepLinks
                      }
                      idKey="path"
                      emptyText="No deep-link landing events have been recorded yet."
                    />
                  </SectionCard>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  <SectionCard
                    title="Project popularity"
                    subtitle="Project interactions with exact visitor/session reach"
                  >
                    <InteractionTable
                      rows={
                        data.projects
                      }
                      idKey="projectId"
                      emptyText="No project interactions were recorded for this period."
                    />
                  </SectionCard>

                  <SectionCard
                    title="Code snippet popularity"
                    subtitle="Code Lab snippet interactions"
                  >
                    <InteractionTable
                      rows={
                        data.snippets
                      }
                      idKey="snippetId"
                      emptyText="No code snippet interactions were recorded for this period."
                    />
                  </SectionCard>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
                  <SectionCard
                    title="Top countries"
                    subtitle="Exact visitor and session reach by country"
                  >
                    <CountriesTable
                      countries={
                        data.countries
                      }
                    />
                  </SectionCard>

                  <SectionCard
                    title="Top cities"
                    subtitle="Trusted edge-derived city and region enrichment"
                  >
                    <CitiesTable
                      cities={
                        data.cities
                      }
                    />
                  </SectionCard>
                </div>

                <SectionCard
                  title="Session intelligence"
                  subtitle="Anonymous logical-session coverage reconstructed across day and release fragments"
                >
                  <SessionCoverageSummary
                    coverage={
                      sessionCoverage
                    }
                  />
                </SectionCard>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
                  <SectionCard
                    title="Top journey paths"
                    subtitle="Most common ordered public-section paths for the selected period"
                  >
                    <TopSectionPaths
                      paths={
                        topSectionPaths
                      }
                    />
                  </SectionCard>

                  <SectionCard
                    title="Top transitions"
                    subtitle="Most frequent semantic steps between sections and interactions"
                  >
                    <TopTransitionsTable
                      transitions={
                        topTransitions
                      }
                    />
                  </SectionCard>
                </div>

                <SectionCard
                  title="Recent sessions"
                  subtitle="Privacy-safe anonymous sessions ordered by most recent activity"
                >
                  <RecentSessions
                    sessions={
                      recentSessions
                    }
                  />
                </SectionCard>

                <SectionCard
                  title="Legacy release breakdown"
                  subtitle="Existing profileVersionId deployment/release dimension. Profile Variant is the immutable content identity used by the filters above."
                >
                  <ReleaseTable
                    releases={
                      data.profileVersions
                    }
                    currentProfileVersionId={
                      profileVersion
                        ?.id
                    }
                  />
                </SectionCard>
              </>
            ) : null}

            <div className="pb-4 text-[11px] text-gray-500 dark:text-gray-400">
              Exact analytics queries currently support up to 366 UTC days per request.
            </div>
          </>
        )}
      </div>
    </section>
  );
}