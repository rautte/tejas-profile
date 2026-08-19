// src/utils/analytics/tracker.js

import { clearEvents } from "./store";
import { ingestAnalyticsBatch } from "./analyticsApi";

import {
  getVisitorId,
  getOrCreateSharedSessionId,
  claimSessionStart,
  startSharedSessionHeartbeat,
} from "./session";

import { readBuildProfileVersion } from "../profileVersion";
import { PUBLIC_SECTION_ORDER } from "../../data/App";

import {
  ANALYTICS_EXCLUSION_CHANGED_EVENT,
  shouldCollectAnalytics,
} from "./exclusion";

const MAX_BATCH = 25;
const MAX_QUEUE = 250;
const FLUSH_INTERVAL_MS = 10 * 1000;

const MIN_SECTION_TIME_MS = 500;
const MAX_EVENT_MS = 2 * 60 * 60 * 1000;

const DEPTH_MILESTONES = [25, 50, 75, 100];

const ALLOWED_EVENT_TYPES = new Set([
  "session_start",
  "section_view",
  "section_time",
  "scroll_depth",
  "cta_click",
  "deep_link",
  "project_open",
  "code_snippet_view",
]);

let initialized = false;
let runtimeStarted = false;

let queue = [];
let flushTimer = null;
let flushingPromise = null;

let runtimeCleanup = null;
let stopHeartbeat = null;

let currentSessionId = "";

let activeSection = null;
let activeSectionStartedAt = null;
let pendingSectionMs = 0;

const depthMilestonesSent = new Map();

let tabId = "";
let eventSequence = 0;

function getTabId() {
  if (tabId) return tabId;

  tabId =
    `t_${Math.random().toString(16).slice(2)}_` +
    Date.now().toString(16);

  return tabId;
}

function createEventId() {
  try {
    if (
      typeof crypto !== "undefined" &&
      typeof crypto.randomUUID === "function"
    ) {
      return `ev_${crypto.randomUUID()}`;
    }
  } catch {}

  eventSequence += 1;

  return [
    "ev",
    getTabId(),
    Date.now().toString(16),
    eventSequence.toString(16),
    Math.random().toString(16).slice(2),
  ].join("_");
}

function documentIsActive() {
  if (typeof document === "undefined") return false;

  if (document.visibilityState !== "visible") {
    return false;
  }

  if (
    typeof document.hasFocus === "function" &&
    !document.hasFocus()
  ) {
    return false;
  }

  return true;
}

function canonicalSection(section) {
  const value = String(section || "").trim();

  if (!value) return "";

  const allowed = Array.isArray(PUBLIC_SECTION_ORDER)
    ? PUBLIC_SECTION_ORDER
    : [];

  return allowed.includes(value) ? value : "";
}

function safeString(value, max) {
  return String(value || "").trim().slice(0, max);
}

function baseContext(sessionId) {
  const pv = readBuildProfileVersion();

  return {
    visitorId: getVisitorId(),
    sessionId,
    tabId: getTabId(),

    profileVersionId: String(pv?.id || "unknown"),
    gitSha: pv?.gitSha
      ? String(pv.gitSha)
      : null,
  };
}

function normalizeEvent(evt, sessionId) {
  const type = String(evt?.type || "").trim();

  if (!ALLOWED_EVENT_TYPES.has(type)) {
    return null;
  }

  const ctx = baseContext(sessionId);

  const section = evt?.section
    ? canonicalSection(evt.section)
    : null;

  if (
    ["section_view", "section_time", "scroll_depth"].includes(
      type
    ) &&
    !section
  ) {
    return null;
  }

  const ms =
    typeof evt?.ms === "number"
      ? Math.max(
          0,
          Math.min(MAX_EVENT_MS, Math.round(evt.ms))
        )
      : null;

  const depthPct =
    typeof evt?.depthPct === "number"
      ? Math.max(
          0,
          Math.min(100, Math.round(evt.depthPct))
        )
      : null;

  return {
    eventId: evt?.eventId
      ? safeString(evt.eventId, 160)
      : createEventId(),

    type,
    ts: Date.now(),

    ...ctx,

    section,

    ctaId: evt?.ctaId
      ? safeString(evt.ctaId, 80)
      : null,

    projectId: evt?.projectId
      ? safeString(evt.projectId, 120)
      : null,

    snippetId: evt?.snippetId
      ? safeString(evt.snippetId, 160)
      : null,

    depthPct,
    ms,

    path: evt?.path
      ? safeString(evt.path, 240)
      : null,

    hash: evt?.hash
      ? safeString(evt.hash, 240)
      : null,
  };
}

function enqueue(event) {
  if (queue.length >= MAX_QUEUE) {
    queue = queue.slice(
      Math.floor(MAX_QUEUE / 2)
    );
  }

  queue.push(event);
}

function recordNormalized(event) {
  if (!event) return;

  // Production analytics is backend-owned.
  // Do not persist analytics histories into visitors' localStorage.
  enqueue(event);
}

function emitSessionStartIfNeeded(sessionId) {
  if (!sessionId) return;

  if (!claimSessionStart(sessionId)) {
    return;
  }

  const event = normalizeEvent(
    {
      type: "session_start",
    },
    sessionId
  );

  recordNormalized(event);
}

function handleLogicalSessionChange(sessionId) {
  if (!sessionId) return;
  if (sessionId === currentSessionId) return;

  currentSessionId = sessionId;

  depthMilestonesSent.clear();

  // Any previous timing belongs to the old logical session.
  pendingSectionMs = 0;
  activeSectionStartedAt = null;

  emitSessionStartIfNeeded(sessionId);

  // If the visitor resumes while already sitting on a section,
  // this new logical session has genuinely reached that section.
  if (activeSection) {
    const event = normalizeEvent(
      {
        type: "section_view",
        section: activeSection,
      },
      sessionId
    );

    recordNormalized(event);

    if (documentIsActive()) {
      activeSectionStartedAt = Date.now();
    }
  }
}

function ensureCurrentSession() {
  const sessionId =
    getOrCreateSharedSessionId();

  if (!currentSessionId) {
    currentSessionId = sessionId;
  } else if (sessionId !== currentSessionId) {
    handleLogicalSessionChange(sessionId);
  }

  emitSessionStartIfNeeded(sessionId);

  return sessionId;
}

async function flush(reason = "timer") {
  if (!shouldCollectAnalytics()) {
    queue = [];
    return;
  }

  if (!queue.length) return;

  if (flushingPromise) {
    return flushingPromise;
  }

  flushingPromise = (async () => {
    while (queue.length) {
      const batch = queue.slice(0, MAX_BATCH);

      try {
        await ingestAnalyticsBatch({
          events: batch,
        });

        queue.splice(0, batch.length);
      } catch {
        // Preserve unsent events for the next attempt.
        break;
      }

      // For ordinary timer flushes, one full batch is enough.
      // Explicit lifecycle flushes drain everything available.
      if (
        reason === "timer" &&
        batch.length >= MAX_BATCH
      ) {
        break;
      }
    }
  })();

  try {
    await flushingPromise;
  } finally {
    flushingPromise = null;
  }
}

function scheduleFlush() {
  if (flushTimer) return;

  flushTimer = window.setInterval(
    () => flush("timer"),
    FLUSH_INTERVAL_MS
  );
}

function stopFlushTimer() {
  if (!flushTimer) return;

  window.clearInterval(flushTimer);
  flushTimer = null;
}

function accumulateActiveSectionTime() {
  if (
    !activeSection ||
    activeSectionStartedAt == null
  ) {
    return;
  }

  const elapsed =
    Date.now() - activeSectionStartedAt;

  activeSectionStartedAt = null;

  if (elapsed > 0) {
    pendingSectionMs += elapsed;
  }
}

function emitPendingSectionTime({
  force = false,
} = {}) {
  if (!activeSection) {
    pendingSectionMs = 0;
    return;
  }

  const ms = Math.round(pendingSectionMs);

  if (ms <= 0) {
    return;
  }

  if (!force && ms < MIN_SECTION_TIME_MS) {
    return;
  }

  pendingSectionMs = 0;

  trackEvent({
    type: "section_time",
    section: activeSection,
    ms,
  });
}

function pauseActiveSection({
  forceFlush = false,
} = {}) {
  accumulateActiveSectionTime();

  emitPendingSectionTime({
    force: forceFlush,
  });
}

function resumeActiveSection() {
  if (!activeSection) return;
  if (!documentIsActive()) return;

  if (activeSectionStartedAt == null) {
    activeSectionStartedAt = Date.now();
  }
}

function discardPendingAnalytics() {
  queue = [];

  stopFlushTimer();

  if (typeof stopHeartbeat === "function") {
    stopHeartbeat();
    stopHeartbeat = null;
  }

  if (typeof runtimeCleanup === "function") {
    runtimeCleanup();
    runtimeCleanup = null;
  }

  runtimeStarted = false;

  activeSectionStartedAt = null;
  pendingSectionMs = 0;

  // Legacy/debug local data must also stop containing
  // this owner's traffic.
  clearEvents();
}

function startRuntime() {
  if (runtimeStarted) return;
  if (!shouldCollectAnalytics()) return;

  runtimeStarted = true;

  currentSessionId =
    getOrCreateSharedSessionId();

  emitSessionStartIfNeeded(
    currentSessionId
  );

  stopHeartbeat =
    startSharedSessionHeartbeat({
      onSessionChanged: (sessionId) => {
        handleLogicalSessionChange(
          sessionId
        );
      },
    });

  scheduleFlush();

  const onVisibilityChange = () => {
    if (
      document.visibilityState === "hidden"
    ) {
      pauseActiveSection({
        forceFlush: true,
      });

      flush("hidden");
      return;
    }

    const sessionId =
      getOrCreateSharedSessionId();

    if (
      sessionId !== currentSessionId
    ) {
      handleLogicalSessionChange(
        sessionId
      );
    }

    resumeActiveSection();
  };

  const onBlur = () => {
    pauseActiveSection();
  };

  const onFocus = () => {
    const sessionId =
      getOrCreateSharedSessionId();

    if (
      sessionId !== currentSessionId
    ) {
      handleLogicalSessionChange(
        sessionId
      );
    }

    resumeActiveSection();
  };

  const onPageHide = () => {
    pauseActiveSection({
      forceFlush: true,
    });

    flush("pagehide");
  };

  document.addEventListener(
    "visibilitychange",
    onVisibilityChange
  );

  window.addEventListener(
    "blur",
    onBlur
  );

  window.addEventListener(
    "focus",
    onFocus
  );

  window.addEventListener(
    "pagehide",
    onPageHide
  );

  window.addEventListener(
    "beforeunload",
    onPageHide
  );

  runtimeCleanup = () => {
    document.removeEventListener(
      "visibilitychange",
      onVisibilityChange
    );

    window.removeEventListener(
      "blur",
      onBlur
    );

    window.removeEventListener(
      "focus",
      onFocus
    );

    window.removeEventListener(
      "pagehide",
      onPageHide
    );

    window.removeEventListener(
      "beforeunload",
      onPageHide
    );
  };

  if (activeSection) {
    const event = normalizeEvent(
      {
        type: "section_view",
        section: activeSection,
      },
      currentSessionId
    );

    recordNormalized(event);
    resumeActiveSection();
  }
}

export function analyticsStart() {
  if (initialized) return;

  initialized = true;

  const onExclusionChanged = () => {
    if (!shouldCollectAnalytics()) {
      discardPendingAnalytics();
      return;
    }

    startRuntime();
  };

  window.addEventListener(
    ANALYTICS_EXCLUSION_CHANGED_EVENT,
    onExclusionChanged
  );

  if (!shouldCollectAnalytics()) {
    // Remove stale data produced by the previous local-analytics implementation.
    clearEvents();
    return;
  }

  startRuntime();
}

export async function flushAndClose() {
  if (!shouldCollectAnalytics()) {
    queue = [];
    return;
  }

  pauseActiveSection({
    forceFlush: true,
  });

  try {
    await flush("close");
  } catch {}
}

export function trackEvent(evt) {
  if (!shouldCollectAnalytics()) {
    return;
  }

  const type =
    String(evt?.type || "").trim();

  if (!ALLOWED_EVENT_TYPES.has(type)) {
    return;
  }

  const sessionId =
    ensureCurrentSession();

  // session_start is emitted only through the claim mechanism.
  if (type === "session_start") {
    return;
  }

  const normalized =
    normalizeEvent(evt, sessionId);

  if (!normalized) return;

  recordNormalized(normalized);

  if (
    [
      "cta_click",
      "project_open",
      "code_snippet_view",
      "deep_link",
    ].includes(normalized.type)
  ) {
    flush("important");
  }
}

/**
 * Public section lifecycle.
 *
 * Passing an Admin section deliberately resolves to "".
 * That flushes the previous public section timer and starts nothing new.
 */
export function trackSectionEnter(sectionLabel) {
  const nextSection =
    canonicalSection(sectionLabel);

  if (!shouldCollectAnalytics()) {
    activeSection =
      nextSection || null;

    activeSectionStartedAt = null;
    pendingSectionMs = 0;

    return;
  }

  if (nextSection === activeSection) {
    resumeActiveSection();
    return;
  }

  // Finish timing the previous public section first.
  pauseActiveSection({
    forceFlush: true,
  });

  activeSection =
    nextSection || null;

  activeSectionStartedAt = null;
  pendingSectionMs = 0;

  if (!activeSection) {
    return;
  }

  trackEvent({
    type: "section_view",
    section: activeSection,
  });

  resumeActiveSection();
}

/**
 * Emits only meaningful depth milestones.
 *
 * A jump directly to 100% may emit 25,50,75,100 together.
 * Phase 3 will make backend milestone aggregation idempotent per session.
 */
export function trackScrollDepth(
  sectionLabel,
  el
) {
  if (!shouldCollectAnalytics()) {
    return;
  }

  if (!el) return;

  const section =
    canonicalSection(sectionLabel);

  if (!section) return;

  const maxScroll =
    el.scrollHeight - el.clientHeight;

  if (maxScroll <= 0) {
    return;
  }

  const pct = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        (el.scrollTop / maxScroll) * 100
      )
    )
  );

  const sessionId =
    ensureCurrentSession();

  const key =
    `${sessionId}:${section}`;

  let sent =
    depthMilestonesSent.get(key);

  if (!sent) {
    sent = new Set();
    depthMilestonesSent.set(
      key,
      sent
    );
  }

  for (const milestone of DEPTH_MILESTONES) {
    if (
      pct >= milestone &&
      !sent.has(milestone)
    ) {
      sent.add(milestone);

      trackEvent({
        type: "scroll_depth",
        section,
        depthPct: milestone,
      });
    }
  }
}