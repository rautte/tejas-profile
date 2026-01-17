// src/utils/analytics/aggregations.js

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

export function computeOverview(events) {
  const sessions = new Set();
  const sessionsStart = new Map(); // sessionId -> ts
  const sessionsEnd = new Map();   // sessionId -> ts

  const sectionViews = new Map();
  const sectionTimeMs = new Map();
  const sectionMaxScroll = new Map(); // section -> max depth observed via section_time snapshots

  let totalSectionViews = 0;

  for (const e of events) {
    if (e.sessionId) sessions.add(e.sessionId);

    if (e.type === "session_start" && e.sessionId) {
      const prev = sessionsStart.get(e.sessionId);
      if (!prev || e.ts < prev) sessionsStart.set(e.sessionId, e.ts);
    }
    if (e.type === "session_end" && e.sessionId) {
      const prev = sessionsEnd.get(e.sessionId);
      if (!prev || e.ts > prev) sessionsEnd.set(e.sessionId, e.ts);
    }

    if (e.type === "section_view" && e.section) {
      totalSectionViews++;
      sectionViews.set(e.section, (sectionViews.get(e.section) ?? 0) + 1);
    }

    if (e.type === "section_time" && e.section) {
      const dur = Number(e.meta?.durMs ?? 0);
      sectionTimeMs.set(e.section, (sectionTimeMs.get(e.section) ?? 0) + dur);

      const ms = Number(e.meta?.maxScroll ?? 0);
      const prev = sectionMaxScroll.get(e.section) ?? 0;
      if (ms > prev) sectionMaxScroll.set(e.section, ms);
    }
  }

  const sessionCount = sessions.size;

  // avg time per session (based on start/end when available)
  let totalSessionMs = 0;
  let sessionDurCount = 0;
  for (const sid of sessions) {
    const s = sessionsStart.get(sid);
    const en = sessionsEnd.get(sid);
    if (s && en && en >= s) {
      totalSessionMs += (en - s);
      sessionDurCount++;
    }
  }
  const avgSessionMs = sessionDurCount ? Math.round(totalSessionMs / sessionDurCount) : 0;

  const avgSectionsPerSession = sessionCount ? (totalSectionViews / sessionCount) : 0;

  const topSection =
    [...sectionViews.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  return {
    sessionCount,
    avgSessionMs,
    avgSectionsPerSession,
    sectionViews: [...sectionViews.entries()].map(([section, value]) => ({ section, value })),
    sectionTimeMs: [...sectionTimeMs.entries()].map(([section, value]) => ({ section, value })),
    sectionMaxScroll: [...sectionMaxScroll.entries()].map(([section, value]) => ({ section, value })),
    topSection,
  };
}

export function computeTimeSeries(events, granularity = "day") {
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

export function computeRecentSessions(events, limit = 20) {
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

    if (e.type === "section_view" && e.section) s.sectionsViewed.add(e.section);
    if (e.type === "section_time") s.totalMs += Number(e.meta?.durMs ?? 0);
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
