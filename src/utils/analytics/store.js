// src/utils/analytics/store.js

/**
 * Temporary local event cache.
 *
 * This is NOT the source of truth for production analytics.
 * Production analytics lives in the backend.
 *
 * Kept temporarily for:
 * - debugging
 * - compatibility with the existing Admin Analytics screen
 *
 * Visitor/session identity is owned exclusively by session.js.
 */

const STORAGE_KEY = "tejas_profile_analytics_v1";

// Keep local debug storage bounded.
const MAX_EVENTS = 8000;

function safeParse(json, fallback) {
  try {
    const value = JSON.parse(json);
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function safeStringify(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return "[]";
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
    localStorage.setItem(
      STORAGE_KEY,
      safeStringify(Array.isArray(events) ? events : [])
    );
  } catch {
    // Local analytics cache is best-effort only.
  }
}

export function appendEvent(event) {
  if (!event) return;

  const events = readEvents();

  events.push(event);

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