// src/utils/analytics/aggregations.js

function isBackendDays(input) {
  // backend query returns: [{ day: "YYYY-MM-DD", sessionCount: number, metrics: object }]
  return (
    Array.isArray(input) &&
    (input.length === 0 ||
      (input[0] &&
        typeof input[0] === "object" &&
        typeof input[0].day === "string" &&
        "metrics" in input[0]))
  );
}

function backendComputeOverview(days) {
  // We return the SAME SHAPE your UI already expects.
  const sectionViews = new Map();
  const sectionTimeMs = new Map();
  const sectionMaxScroll = new Map(); // not available from backend; keep empty
  let sessionCount = 0;

  // backend stores: metrics.sectionViews, metrics.sectionTimeMs, etc.
  for (const d of days || []) {
    sessionCount += Number(d?.sessionCount || 0) || 0;

    const m = d?.metrics || {};
    const sv = m.sectionViews || {};
    const stm = m.sectionTimeMs || {};

    for (const [section, count] of Object.entries(sv)) {
      const n = Number(count || 0) || 0;
      sectionViews.set(section, (sectionViews.get(section) ?? 0) + n);
    }

    for (const [section, ms] of Object.entries(stm)) {
      const n = Number(ms || 0) || 0;
      sectionTimeMs.set(section, (sectionTimeMs.get(section) ?? 0) + n);
    }
  }

  const totalSectionViews = [...sectionViews.values()].reduce((a, b) => a + b, 0);
  const avgSectionsPerSession = sessionCount ? totalSectionViews / sessionCount : 0;

  const topSection =
    [...sectionViews.entries()].sort((a, b) => (b[1] || 0) - (a[1] || 0))[0]?.[0] ?? null;

  return {
    sessionCount,
    avgSessionMs: 0, // backend does not track session durations in aggregates
    avgSectionsPerSession,
    sectionViews: [...sectionViews.entries()].map(([section, value]) => ({ section, value })),
    sectionTimeMs: [...sectionTimeMs.entries()].map(([section, value]) => ({ section, value })),
    sectionMaxScroll: [...sectionMaxScroll.entries()].map(([section, value]) => ({ section, value })),
    topSection,
  };
}

function backendComputeTimeSeries(days, granularity = "day") {
  // Your backend already aggregates by DAY.
  // For month/year UI, we roll up here safely.
  const bucket = new Map(); // key -> sum sessionCount

  function bucketKey(dayStr) {
    // dayStr "YYYY-MM-DD"
    if (granularity === "year") return dayStr.slice(0, 4);
    if (granularity === "month") return dayStr.slice(0, 7);
    return dayStr;
  }

  for (const d of days || []) {
    const day = String(d?.day || "").trim();
    if (!day) continue;
    const k = bucketKey(day);
    const sc = Number(d?.sessionCount || 0) || 0;
    bucket.set(k, (bucket.get(k) ?? 0) + sc);
  }

  return [...bucket.entries()]
    .map(([k, v]) => ({ key: k, value: v }))
    .sort((a, b) => (a.key < b.key ? -1 : 1));
}

function dayKey(ts) {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}

function monthKey(ts) {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function yearKey(ts) {
  return String(new Date(ts).getFullYear());
}

export function computeOverview(eventsOrDays) {
  if (isBackendDays(eventsOrDays)) {
    return backendComputeOverview(eventsOrDays);
  }

  const events = Array.isArray(eventsOrDays)
    ? eventsOrDays
    : [];

  const sessions = new Set();

  const sessionSections = new Map();
  const sessionActiveMs = new Map();

  const sectionViews = new Map();
  const sectionTimeMs = new Map();
  const sectionMaxScroll = new Map();

  for (const e of events) {
    const sessionId = String(e?.sessionId || "").trim();

    if (sessionId) {
      sessions.add(sessionId);
    }

    // -----------------------------
    // Section visits
    // -----------------------------
    if (
      e?.type === "section_view" &&
      e?.section
    ) {
      const section = String(e.section);

      sectionViews.set(
        section,
        (sectionViews.get(section) ?? 0) + 1
      );

      if (sessionId) {
        if (!sessionSections.has(sessionId)) {
          sessionSections.set(
            sessionId,
            new Set()
          );
        }

        sessionSections
          .get(sessionId)
          .add(section);
      }
    }

    // -----------------------------
    // Active section time
    // -----------------------------
    if (
      e?.type === "section_time" &&
      e?.section
    ) {
      const section = String(e.section);

      // Canonical Phase-2 schema is top-level `ms`.
      // meta.durMs remains only as temporary backward compatibility
      // for old local events.
      const durationMs = Math.max(
        0,
        Number(
          e?.ms ??
          e?.meta?.durMs ??
          0
        ) || 0
      );

      sectionTimeMs.set(
        section,
        (sectionTimeMs.get(section) ?? 0) +
          durationMs
      );

      if (sessionId) {
        sessionActiveMs.set(
          sessionId,
          (sessionActiveMs.get(sessionId) ?? 0) +
            durationMs
        );
      }
    }

    // -----------------------------
    // Maximum observed scroll depth
    // -----------------------------
    if (
      e?.type === "scroll_depth" &&
      e?.section
    ) {
      const section = String(e.section);

      const depth = Math.max(
        0,
        Math.min(
          100,
          Number(e?.depthPct ?? 0) || 0
        )
      );

      const previous =
        sectionMaxScroll.get(section) ?? 0;

      if (depth > previous) {
        sectionMaxScroll.set(
          section,
          depth
        );
      }
    }
  }

  const sessionCount = sessions.size;

  // Average ACTIVE engagement time per session.
  //
  // Do not use wall-clock session_start/session_end duration.
  // Background/hidden time must not count.
  const totalActiveMs =
    [...sessionActiveMs.values()].reduce(
      (sum, value) => sum + value,
      0
    );

  const avgSessionMs = sessionCount
    ? Math.round(totalActiveMs / sessionCount)
    : 0;

  // Breadth of exploration.
  //
  // Count each section at most once per session rather than
  // counting repeated section_view events.
  const uniqueSectionSessionPairs =
    [...sessionSections.values()].reduce(
      (sum, sections) =>
        sum + sections.size,
      0
    );

  const avgSectionsPerSession =
    sessionCount
      ? uniqueSectionSessionPairs / sessionCount
      : 0;

  const topSection =
    [...sectionViews.entries()]
      .sort(
        (a, b) =>
          (b[1] || 0) - (a[1] || 0)
      )[0]?.[0] ?? null;

  return {
    sessionCount,
    avgSessionMs,
    avgSectionsPerSession,

    sectionViews:
      [...sectionViews.entries()].map(
        ([section, value]) => ({
          section,
          value,
        })
      ),

    sectionTimeMs:
      [...sectionTimeMs.entries()].map(
        ([section, value]) => ({
          section,
          value,
        })
      ),

    sectionMaxScroll:
      [...sectionMaxScroll.entries()].map(
        ([section, value]) => ({
          section,
          value,
        })
      ),

    topSection,
  };
}

export function computeTimeSeries(eventsOrDays, granularity = "day") {
  if (isBackendDays(eventsOrDays)) {
    return backendComputeTimeSeries(eventsOrDays, granularity);
  }

  const events = Array.isArray(eventsOrDays)
    ? eventsOrDays
    : [];
  const keyFn = granularity === "year" ? yearKey : granularity === "month" ? monthKey : dayKey;

  // count unique sessions by bucket (session_start is best anchor)
  const bucketSessions = new Map(); // bucket -> Set(sessionId)

  for (const e of events) {
    if (e.type !== "session_start") continue;
    if (!e.sessionId) continue;

    const k = keyFn(e.ts);
    if (!bucketSessions.has(k)) bucketSessions.set(k, new Set());
    bucketSessions.get(k).add(e.sessionId);
  }

  const points = [...bucketSessions.entries()]
    .map(([k, set]) => ({ key: k, value: set.size }))
    .sort((a, b) => (a.key < b.key ? -1 : 1));

  return points;
}

export function computeRecentSessions(eventsOrDays, limit = 20) {
  if (isBackendDays(eventsOrDays)) {
    // backend aggregates don’t include per-session timelines
    return [];
  }

  const events = Array.isArray(eventsOrDays)
    ? eventsOrDays
    : [];
  // Build per-session stats from section_time + section_view
  const bySession = new Map();

  for (const e of events) {
    if (!e.sessionId) continue;
    if (!bySession.has(e.sessionId)) {
      bySession.set(e.sessionId, {
        sessionId: e.sessionId,
        startTs: e.ts,
        endTs: e.ts,
        sectionsViewed: new Set(),
        totalMs: 0,
      });
    }
    const s = bySession.get(e.sessionId);
    s.startTs = Math.min(s.startTs, e.ts);
    s.endTs = Math.max(s.endTs, e.ts);

    if (e.type === "section_view" && e.section) {
      s.sectionsViewed.add(e.section);
    }

    if (e.type === "section_time") {
      s.totalMs += Math.max(
        0,
        Number(
          e?.ms ??
          e?.meta?.durMs ??
          0
        ) || 0
      );
    }
  }

  return [...bySession.values()]
    .map((s) => ({
      sessionId: s.sessionId,
      startTs: s.startTs,
      endTs: s.endTs,
      sections: s.sectionsViewed.size,
      totalMs: s.totalMs,
    }))
    .sort((a, b) => b.startTs - a.startTs)
    .slice(0, limit);
}
