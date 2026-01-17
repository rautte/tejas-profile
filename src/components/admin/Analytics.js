// src/components/admin/Analytics.js

import { useMemo, useState } from "react";
import { computeOverview, computeTimeSeries, computeRecentSessions } from "../../utils/analytics";
import { getAllEvents, resetAnalytics } from "../../utils/analytics";

function msToHuman(ms) {
  if (!ms) return "0s";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  return `${h}h`;
}

function Card({ title, value, sub }) {
  return (
    <div className="rounded-2xl bg-white/70 dark:bg-white/5 border border-gray-200/60 dark:border-white/10 backdrop-blur-xl p-4 shadow-sm">
      <div className="text-[12px] uppercase tracking-wide text-gray-500 dark:text-gray-400">{title}</div>
      <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</div>
      {sub ? <div className="mt-1 text-[12px] text-gray-600 dark:text-gray-400">{sub}</div> : null}
    </div>
  );
}

function SimpleBarChart({ data, height = 160 }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="w-full">
      <div className="w-full overflow-hidden rounded-xl border border-gray-200/60 dark:border-white/10 bg-white/40 dark:bg-white/5">
        <svg viewBox={`0 0 100 ${height}`} className="w-full h-[180px]">
          {data.slice(0, 10).map((d, i) => {
            const w = 100 / Math.max(10, data.slice(0, 10).length);
            const x = i * w + 2;
            const barW = w - 4;
            const barH = (d.value / max) * (height - 24);
            const y = height - 12 - barH;
            return (
              <g key={d.section ?? d.key ?? i}>
                <rect x={x} y={y} width={barW} height={barH} rx="2" className="fill-purple-500/70" />
                <text x={x + barW / 2} y={height - 2} textAnchor="middle" fontSize="6" className="fill-gray-500">
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
      const y = (h - pad) - ((p.value - min) * (h - pad * 2)) / (max - min || 1);
      return `${i === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");

  return (
    <div className="w-full overflow-hidden rounded-xl border border-gray-200/60 dark:border-white/10 bg-white/40 dark:bg-white/5 p-3">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-[140px]">
        <path d={path} className="fill-none stroke-purple-500/80" strokeWidth="2" />
      </svg>
      <div className="mt-2 flex items-center justify-between text-[11px] text-gray-600 dark:text-gray-400">
        <span>{points[0]?.key ?? ""}</span>
        <span>{points.at(-1)?.key ?? ""}</span>
      </div>
    </div>
  );
}

export default function AdminAnalytics({ darkMode }) {
  const [granularity, setGranularity] = useState("day");

  const [events, setEvents] = useState(() => getAllEvents());

  const overview = useMemo(() => computeOverview(events), [events]);
  const series = useMemo(() => computeTimeSeries(events, granularity), [events, granularity]);

  const sectionViewsRanked = useMemo(() => {
    return [...overview.sectionViews].sort((a, b) => b.value - a.value);
  }, [overview.sectionViews]);

  const sectionTimeRanked = useMemo(() => {
    return [...overview.sectionTimeMs]
      .map((d) => ({ ...d, valueMin: Math.round(d.value / 60000) }))
      .sort((a, b) => b.value - a.value);
  }, [overview.sectionTimeMs]);

  const recentSessions = useMemo(() => computeRecentSessions(events, 20), [events]);

  return (
    <section className="py-8 px-4 bg-gray-50 dark:bg-[#181826] transition-colors">
      <div className="text-left px-6 mb-10">
        <h2 className="text-3xl font-bold text-purple-700 dark:text-purple-300 font-epilogue drop-shadow-md">
          Analytics
        </h2>
        <div className="w-64 h-0.5 mt-2 rounded-full bg-gradient-to-r from-purple-700 via-purple-900 to-purple-600 dark:from-purple-500 dark:via-purple-600 dark:to-purple-400 backdrop-blur-sm opacity-90 shadow-[0_0_2px_1px_rgba(147,51,234,0.6)]" />
        <p className="mt-3 text-sm text-gray-600 dark:text-gray-400 max-w-3xl">
          Owner-only local analytics (stored in your browser). Use this to validate whether visitors are actually engaging with
          your sections and what they care about.
        </p>
      </div>

      <div className="px-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card title="Sessions" value={overview.sessionCount} sub="per device/tab across time" />
          <Card title="Avg time/session" value={msToHuman(overview.avgSessionMs)} sub="based on start/end events" />
          <Card
            title="Avg sections/session"
            value={overview.avgSectionsPerSession.toFixed(2)}
            sub="section views ÷ sessions"
          />
          <Card title="Top section" value={overview.topSection ?? "—"} sub="by views" />
          <Card title="Events stored" value={events.length} sub="capped to avoid bloat" />
        </div>

        {/* Time Series */}
        <div className="rounded-2xl bg-white/70 dark:bg-white/5 border border-gray-200/60 dark:border-white/10 backdrop-blur-xl p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">Sessions over time</div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Counts unique sessions by start time</div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setGranularity("day")}
                className={`px-3 py-1.5 rounded-full text-xs border ${
                  granularity === "day"
                    ? "bg-purple-600 text-white border-purple-600"
                    : "bg-white/60 dark:bg-white/10 text-gray-700 dark:text-gray-200 border-gray-200/60 dark:border-white/10"
                }`}
              >
                Day
              </button>
              <button
                onClick={() => setGranularity("month")}
                className={`px-3 py-1.5 rounded-full text-xs border ${
                  granularity === "month"
                    ? "bg-purple-600 text-white border-purple-600"
                    : "bg-white/60 dark:bg-white/10 text-gray-700 dark:text-gray-200 border-gray-200/60 dark:border-white/10"
                }`}
              >
                Month
              </button>
              <button
                onClick={() => setGranularity("year")}
                className={`px-3 py-1.5 rounded-full text-xs border ${
                  granularity === "year"
                    ? "bg-purple-600 text-white border-purple-600"
                    : "bg-white/60 dark:bg-white/10 text-gray-700 dark:text-gray-200 border-gray-200/60 dark:border-white/10"
                }`}
              >
                Year
              </button>
            </div>
          </div>

          <div className="mt-4">
            {series.length >= 2 ? (
              <SimpleLineChart points={series} />
            ) : (
              <div className="text-sm text-gray-600 dark:text-gray-400">Not enough data yet. Navigate around a bit.</div>
            )}
          </div>
        </div>

        {/* Rankings */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-2xl bg-white/70 dark:bg-white/5 border border-gray-200/60 dark:border-white/10 backdrop-blur-xl p-5 shadow-sm">
            <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">Most visited sections</div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Ranked by section_view events</div>

            <div className="mt-4">
              {sectionViewsRanked.length ? (
                <>
                  <SimpleBarChart data={sectionViewsRanked.map((d) => ({ section: d.section, value: d.value }))} />
                  <div className="mt-3 space-y-1">
                    {sectionViewsRanked.slice(0, 8).map((d) => (
                      <div key={d.section} className="flex justify-between text-sm text-gray-700 dark:text-gray-300">
                        <span>{d.section}</span>
                        <span className="font-semibold">{d.value}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-sm text-gray-600 dark:text-gray-400">No section views yet.</div>
              )}
            </div>
          </div>

          <div className="rounded-2xl bg-white/70 dark:bg-white/5 border border-gray-200/60 dark:border-white/10 backdrop-blur-xl p-5 shadow-sm">
            <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">Time spent by section</div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Sum of section_time durations</div>

            <div className="mt-4 space-y-2">
              {sectionTimeRanked.length ? (
                sectionTimeRanked.slice(0, 10).map((d) => (
                  <div key={d.section} className="flex items-center justify-between text-sm">
                    <span className="text-gray-700 dark:text-gray-300">{d.section}</span>
                    <span className="font-semibold text-gray-900 dark:text-gray-100">{msToHuman(d.value)}</span>
                  </div>
                ))
              ) : (
                <div className="text-sm text-gray-600 dark:text-gray-400">No durations yet.</div>
              )}
            </div>
          </div>
        </div>

        {/* Recent sessions */}
        <div className="rounded-2xl bg-white/70 dark:bg-white/5 border border-gray-200/60 dark:border-white/10 backdrop-blur-xl p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">Recent sessions</div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Local summary (last 20)</div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setEvents(getAllEvents())}
                className="px-3 py-1.5 rounded-full text-xs border bg-white/60 dark:bg-white/10 text-gray-700 dark:text-gray-200 border-gray-200/60 dark:border-white/10"
              >
                Refresh
              </button>
              <button
                onClick={() => {
                  if (!window.confirm("Clear ALL local analytics on this browser?")) return;
                  resetAnalytics();
                  setEvents(getAllEvents());
                }}
                className="px-3 py-1.5 rounded-full text-xs border bg-red-600 text-white border-red-600"
              >
                Clear data
              </button>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
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
                    <tr key={s.sessionId} className="border-t border-gray-200/60 dark:border-white/10">
                      <td className="py-2 pr-3 text-gray-700 dark:text-gray-300">
                        {new Date(s.startTs).toLocaleString()}
                      </td>
                      <td className="py-2 pr-3 text-gray-700 dark:text-gray-300">{s.sections}</td>
                      <td className="py-2 pr-3 text-gray-700 dark:text-gray-300">{msToHuman(s.totalMs)}</td>
                      <td className="py-2 pr-3 text-gray-500 dark:text-gray-400">{s.sessionId.slice(0, 10)}…</td>
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
        </div>

        {/* Suggestions */}
        <div className="rounded-2xl bg-white/70 dark:bg-white/5 border border-gray-200/60 dark:border-white/10 backdrop-blur-xl p-5 shadow-sm">
          <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">Next metrics to add</div>
          <ul className="mt-2 text-sm text-gray-700 dark:text-gray-300 list-disc pl-5 space-y-1">
            <li>CTA clicks: Resume download, GitHub, LinkedIn, each project demo link.</li>
            <li>Funnel: About → Experience → Resume → Projects (drop-off).</li>
            <li>Timeline interactions: year scrubber moves, card expand, arrows.</li>
            <li>Deep-link landings: who enters via #/code-lab?…</li>
          </ul>
        </div>
      </div>
    </section>
  );
}
