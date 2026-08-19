// src/utils/analytics/exclusion.js

import { ANALYTICS_EXCLUDED_KEY } from "../../config/owner";

export const ANALYTICS_EXCLUSION_CHANGED_EVENT =
  "tp:analytics-exclusion-changed";

function safeGet(key) {
  try {
    return localStorage.getItem(key) || "";
  } catch {
    return "";
  }
}

function safeSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}

function safeRemove(key) {
  try {
    localStorage.removeItem(key);
  } catch {}
}

export function isLocalOrDevAnalyticsEnvironment() {
  if (typeof window === "undefined") {
    return true;
  }

  const host = String(window.location.hostname || "").toLowerCase();

  if (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host.endsWith(".localhost")
  ) {
    return true;
  }

  // npm start / CRA development build
  if (process.env.NODE_ENV !== "production") {
    return true;
  }

  // Explicit DEV deployment.
  //
  // IMPORTANT:
  // Do NOT treat a missing stage as DEV, otherwise a bad production env
  // could accidentally disable analytics for everybody.
  const stage = String(process.env.REACT_APP_STAGE || "")
    .trim()
    .toLowerCase();

  if (stage === "dev" || stage === "test") {
    return true;
  }

  return false;
}

export function isCurrentBrowserAnalyticsExcluded() {
  return safeGet(ANALYTICS_EXCLUDED_KEY) === "1";
}

export function shouldCollectAnalytics() {
  if (isLocalOrDevAnalyticsEnvironment()) {
    return false;
  }

  if (isCurrentBrowserAnalyticsExcluded()) {
    return false;
  }

  return true;
}

function dispatchExclusionChanged(excluded) {
  try {
    window.dispatchEvent(
      new CustomEvent(ANALYTICS_EXCLUSION_CHANGED_EVENT, {
        detail: { excluded: Boolean(excluded) },
      })
    );
  } catch {}
}

/**
 * Call only after successful server-side owner authentication.
 */
export function excludeCurrentBrowserFromAnalytics() {
  safeSet(ANALYTICS_EXCLUDED_KEY, "1");
  dispatchExclusionChanged(true);
}

/**
 * Used later from Admin → Settings.
 *
 * We are intentionally not exposing this in the UI yet.
 */
export function includeCurrentBrowserInAnalytics() {
  safeRemove(ANALYTICS_EXCLUDED_KEY);
  dispatchExclusionChanged(false);
}