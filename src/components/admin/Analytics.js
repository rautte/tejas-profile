// src/components/admin/Analytics.js

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  FaChartLine,
} from "react-icons/fa";

import SectionHeader from "../shared/SectionHeader";

import {
  CARD_ROUNDED_2XL,
  CARD_SURFACE,
} from "../../utils/ui";

import { cx } from "../../utils/cx";

import {
  readBuildProfileVersion,
} from "../../utils/profileVersion";

import {
  queryAnalyticsAgg,
} from "../../utils/analytics/analyticsApi";


const DAY_MS =
  24 * 60 * 60 * 1000;

const MAX_EXACT_RANGE_DAYS =
  366;

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

function EmptyState({
  children,
}) {
  return (
    <div className="rounded-xl border border-dashed border-gray-300/80 dark:border-white/15 px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
      {children}
    </div>
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


// -----------------------------
// Main dashboard
// -----------------------------

export default function AdminAnalytics() {
  const profileVersion =
    useMemo(
      () =>
        readBuildProfileVersion(),
      []
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
      const ids =
        new Set();

      for (
        const release of
          releaseCatalog || []
      ) {
        const id =
          String(
            release
              ?.profileVersionId ||
              ""
          ).trim();

        if (id) {
          ids.add(id);
        }
      }

      const currentId =
        String(
          profileVersion?.id ||
            ""
        ).trim();

      if (currentId) {
        ids.add(
          currentId
        );
      }

      if (
        profileVersionFilter &&
        profileVersionFilter !==
          "all"
      ) {
        ids.add(
          profileVersionFilter
        );
      }

      return [
        ...ids,
      ].sort();
    }, [
      releaseCatalog,
      profileVersion,
      profileVersionFilter,
    ]);

  const loadAnalytics =
    useCallback(
      async (
        signal
      ) => {
        setLoading(true);
        setError("");

        try {
          // Always query All Releases for the current period.
          // This gives the selector a release catalogue for the
          // selected window without coupling the displayed result
          // to the active release filter.
          const allReleasesPromise =
            queryAnalyticsAgg({
              profileVersionId:
                "all",

              from:
                range.from,

              to:
                range.to,

              signal,
            });

          const currentPromise =
            profileVersionFilter ===
            "all"
              ? allReleasesPromise
              : queryAnalyticsAgg(
                  {
                    profileVersionId:
                      profileVersionFilter,

                    from:
                      range.from,

                    to:
                      range.to,

                    signal,
                  }
                );

          const previousPromise =
            comparePrevious &&
            comparisonRange
              ? queryAnalyticsAgg(
                  {
                    profileVersionId:
                      profileVersionFilter,

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
            allReleasesData,
            currentData,
            previousResult,
          ] =
            await Promise.all([
              allReleasesPromise,
              currentPromise,
              previousPromise,
            ]);

          setReleaseCatalog(
            Array.isArray(
              allReleasesData
                ?.profileVersions
            )
              ? allReleasesData
                  .profileVersions
              : []
          );

          setData(
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
        comparePrevious,
        comparisonRange,
      ]
    );

  useEffect(() => {
    const controller =
      new AbortController();

    loadAnalytics(
      controller.signal
    );

    return () => {
      controller.abort();
    };
  }, [
    loadAnalytics,
    refreshVersion,
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

      downloadJsonFile(
        `tejas-profile-analytics_${range.from}_to_${range.to}_${safeRelease}.json`,
        {
          exportedAt:
            new Date()
              .toISOString(),

          analytics:
            data,

          comparison:
            previousData,
        }
      );
    }, [
      data,
      previousData,
      profileVersionFilter,
      range,
    ]);

  return (
    <section className="py-0 px-4 transition-colors">
      <SectionHeader
        icon={FaChartLine}
        title="Analytics"
      />

      <div className="px-2 sm:px-6 space-y-6">
        <div className="mt-10 flex flex-col lg:flex-row lg:items-end justify-between gap-4">
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

              <span className="rounded-full border border-gray-200/70 dark:border-white/10 bg-white/60 dark:bg-white/5 px-2.5 py-1 text-gray-600 dark:text-gray-300">
                UTC
              </span>

              {data?.stage ? (
                <span className="rounded-full border border-purple-200 dark:border-purple-400/20 bg-purple-50 dark:bg-purple-500/10 px-2.5 py-1 font-semibold uppercase tracking-wide text-purple-700 dark:text-purple-300">
                  {data.stage}
                </span>
              ) : null}

              <span className="rounded-full border border-gray-200/70 dark:border-white/10 bg-white/60 dark:bg-white/5 px-2.5 py-1 text-gray-600 dark:text-gray-300 max-w-full">
                Current build:{" "}
                <span className="font-semibold text-gray-800 dark:text-gray-100 break-all">
                  {profileVersion?.id ||
                    "unknown"}
                </span>
              </span>
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
              disabled={loading}
              title="Reload exact analytics from the backend"
            >
              {loading
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
          subtitle="Period and release filters are independent. Comparison uses the immediately preceding period of equal length."
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
                      From
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
                      To
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

            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(260px,360px)] gap-4">
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
                  Release
                </div>

                <select
                  value={
                    profileVersionFilter
                  }
                  onChange={(
                    e
                  ) =>
                    setProfileVersionFilter(
                      e.target
                        .value
                    )
                  }
                  className="mt-1 w-full rounded-lg border border-gray-200/70 dark:border-white/10 bg-white/80 dark:bg-[#151521] px-3 py-2 text-sm text-gray-900 dark:text-gray-100 outline-none"
                >
                  <option value="all">
                    All releases
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
              </label>
            </div>
          </div>
        </SectionCard>

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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
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

            <SectionCard
              title="Top countries"
              subtitle="Country enrichment available on stored session fragments"
            >
              <CountriesTable
                countries={
                  data.countries
                }
              />
            </SectionCard>

            <SectionCard
              title="Release breakdown"
              subtitle="Exact visitors, sessions and engagement by profile version"
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
      </div>
    </section>
  );
}