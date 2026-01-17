// src/utils/analytics/store.js

const STORAGE_KEY = "tejas_profile_analytics_v1";
const DEVICE_KEY = "tejas_profile_device_id_v1";
const SESSION_KEY = "tejas_profile_session_id_v1";

// Keep it bounded so localStorage doesn’t grow forever.
const MAX_EVENTS = 8000;

function safeParse(json, fallback) {
  try {
    const v = JSON.parse(json);
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

function safeStringify(obj) {
  try {
    return JSON.stringify(obj);
  } catch {
    return "[]";
  }
}

function genId(prefix = "") {
  // good enough for local analytics
  return `${prefix}${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`;
}

export function getOrCreateDeviceId() {
  try {
    const existing = localStorage.getItem(DEVICE_KEY);
    if (existing) return existing;
    const id = genId("dev_");
    localStorage.setItem(DEVICE_KEY, id);
    return id;
  } catch {
    // fail closed: no device tracking
    return null;
  }
}

export function getOrCreateSessionId() {
  try {
    const existing = sessionStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const id = genId("ses_");
    sessionStorage.setItem(SESSION_KEY, id);
    return id;
  } catch {
    return null;
  }
}

export function readEvents() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return safeParse(raw, []);
  } catch {
    return [];
  }
}

export function writeEvents(events) {
  try {
    localStorage.setItem(STORAGE_KEY, safeStringify(events));
  } catch {
    // ignore: storage full / blocked
  }
}

export function appendEvent(evt) {
  const events = readEvents();
  events.push(evt);

  // trim oldest
  if (events.length > MAX_EVENTS) {
    events.splice(0, events.length - MAX_EVENTS);
  }

  writeEvents(events);
}

export function clearEvents() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}
