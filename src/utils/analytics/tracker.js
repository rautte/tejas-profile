// src/utils/analytics/tracker.js
import { appendEvent } from "./store";
import { ingestAnalyticsBatch } from "./analyticsApi";
import { getVisitorId, getOrCreateSharedSessionId, startSharedSessionHeartbeat } from "./session";
import { readBuildProfileVersion } from "../profileVersion";
import { SECTION_ORDER } from "../../data/App";

const MAX_BATCH = 25;
const FLUSH_INTERVAL_MS = 15000;
const MAX_QUEUE = 400;
const DNT_RESPECT = true;

let started = false;
let queue = [];
let flushTimer = null;

function dntEnabled() {
  if (!DNT_RESPECT) return false;
  try {
    const dnt = navigator.doNotTrack || window.doNotTrack || navigator.msDoNotTrack;
    return dnt === "1" || dnt === "yes";
  } catch {
    return false;
  }
}

function canonicalSection(section) {
  const s = String(section || "").trim();
  if (!s) return "";
  const keys = Array.isArray(SECTION_ORDER) ? SECTION_ORDER : [];
  return keys.includes(s) ? s : "";
}

function safeCtaId(ctaId) {
  return String(ctaId || "").trim().slice(0, 80);
}

let _tabId = "";
function getTabId() {
  if (_tabId) return _tabId;
  _tabId = `t_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
  return _tabId;
}

function baseCtx() {
  const pv = readBuildProfileVersion();
  return {
    visitorId: getVisitorId(),
    sessionId: getOrCreateSharedSessionId(),
    tabId: getTabId(),
    profileVersionId: String(pv?.id || "unknown"),
    gitSha: pv?.gitSha ? String(pv.gitSha) : null,
  };
}

function enqueue(e) {
  if (queue.length >= MAX_QUEUE) {
    queue = queue.slice(Math.floor(MAX_QUEUE / 2));
  }
  queue.push(e);
}

async function flush(reason = "timer") {
  if (!queue.length) return;

  const batch = queue.splice(0, MAX_BATCH);
  const payload = { events: batch };

  try {
    await ingestAnalyticsBatch(payload);
  } catch {
    // re-queue once, cap
    queue = batch.concat(queue).slice(0, MAX_QUEUE);
  }
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = window.setInterval(() => flush("interval"), FLUSH_INTERVAL_MS);
}

export function analyticsStart() {
  if (started) return;
  started = true;

  startSharedSessionHeartbeat();
  scheduleFlush();

  const onVis = () => {
    if (document.visibilityState === "hidden") flush("hidden");
  };
  const onUnload = () => flush("unload");

  document.addEventListener("visibilitychange", onVis);
  window.addEventListener("pagehide", onUnload);
  window.addEventListener("beforeunload", onUnload);

  trackEvent({ type: "session_start" });
}

export async function flushAndClose() {
  try {
    await flush("close");
  } catch {}
}

export function trackEvent(evt) {
  if (dntEnabled()) return;

  const ctx = baseCtx();
  const ts = Date.now();

  const normalized = {
    type: String(evt?.type || "").trim(),
    ts,
    ...ctx,

    section: evt?.section ? canonicalSection(evt.section) : null,
    ctaId: evt?.ctaId ? safeCtaId(evt.ctaId) : null,
    projectId: evt?.projectId ? String(evt.projectId).slice(0, 120) : null,
    snippetId: evt?.snippetId ? String(evt.snippetId).slice(0, 160) : null,
    depthPct: typeof evt?.depthPct === "number" ? Math.max(0, Math.min(100, evt.depthPct)) : null,
    ms: typeof evt?.ms === "number" ? Math.max(0, evt.ms) : null,
    path: evt?.path ? String(evt.path).slice(0, 240) : null,
    hash: evt?.hash ? String(evt.hash).slice(0, 240) : null,
  };

  // local store
  appendEvent(normalized);

  // backend queue
  enqueue(normalized);

  // opportunistic flush
  if (normalized.type === "session_end" || normalized.type === "cta_click") {
    flush("important");
  }
}
