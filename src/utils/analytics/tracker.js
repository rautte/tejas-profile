// src/utils/analytics/tracker.js

import {
  appendEvent,
  clearEvents,
  readEvents,
  getOrCreateDeviceId,
  getOrCreateSessionId,
} from "./store";

const APP_VERSION = "v1";

// In-memory session state (per tab)
let _deviceId = null;
let _sessionId = null;

let _currentSection = null;
let _enteredAt = 0;

const _maxScrollBySection = new Map(); // section -> maxDepth(0..1)

function now() {
  return Date.now();
}

function baseEvent(type, section, meta) {
  return {
    ts: now(),
    type,
    section: section ?? null,
    meta: meta ?? {},
    sessionId: _sessionId ?? null,
    deviceId: _deviceId ?? null,
    appVersion: APP_VERSION,
  };
}

export function analyticsInit() {
  _deviceId = getOrCreateDeviceId();
  _sessionId = getOrCreateSessionId();

  // Optional: record a session_start once per tab
  appendEvent(
    baseEvent("session_start", null, {
      path: window.location.hash || "",
      ref: document.referrer || "",
      ua: navigator.userAgent || "",
      app: APP_VERSION,
    })
  );
}

export function trackSectionEnter(sectionLabel) {
  if (!_sessionId) return;

  // Close out previous section duration
  if (_currentSection && _enteredAt) {
    const durMs = Math.max(0, now() - _enteredAt);
    appendEvent(
      baseEvent("section_time", _currentSection, {
        durMs,
        maxScroll: _maxScrollBySection.get(_currentSection) ?? 0,
      })
    );
  }

  _currentSection = sectionLabel;
  _enteredAt = now();

  appendEvent(baseEvent("section_view", sectionLabel, {}));
}

export function trackScrollDepth(sectionLabel, scrollerEl) {
  if (!sectionLabel || !scrollerEl) return;
  if (!_sessionId) return;

  const maxTop = Math.max(1, scrollerEl.scrollHeight - scrollerEl.clientHeight);
  const depth = Math.min(1, Math.max(0, scrollerEl.scrollTop / maxTop));

  const prev = _maxScrollBySection.get(sectionLabel) ?? 0;
  if (depth > prev) _maxScrollBySection.set(sectionLabel, depth);
}

let _lastClickTs = 0;
export function trackClick(meta) {
  if (!_sessionId) return;

  const t = now();
  // very small spam guard
  if (t - _lastClickTs < 60) return;
  _lastClickTs = t;

  appendEvent(baseEvent("click", _currentSection, meta));
}

export function flushAndClose() {
  // close out section time on unload (best effort)
  if (_currentSection && _enteredAt) {
    const durMs = Math.max(0, now() - _enteredAt);
    appendEvent(
      baseEvent("section_time", _currentSection, {
        durMs,
        maxScroll: _maxScrollBySection.get(_currentSection) ?? 0,
        final: true,
      })
    );
  }

  appendEvent(baseEvent("session_end", null, {}));
}

export function getAllEvents() {
  return readEvents();
}

export function resetAnalytics() {
  clearEvents();
}
