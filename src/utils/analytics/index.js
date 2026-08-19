// src/utils/analytics/index.js

import { trackEvent } from "./tracker";


// -----------------------------
// Local/debug compatibility
// -----------------------------

export * from "./store";
export * from "./aggregations";
export * from "./ids";

export {
  readEvents as getAllEvents,
  clearEvents as resetAnalytics,
} from "./store";


// -----------------------------
// Production tracker API
// -----------------------------

export {
  analyticsStart,
  analyticsStart as analyticsInit,
  trackEvent,
  trackSectionEnter,
  trackScrollDepth,
  flushAndClose,
} from "./tracker";


// -----------------------------
// Canonical interaction wrappers
// -----------------------------

export function trackClick({
  id,
  href,
} = {}) {
  const ctaId =
    String(id || "").trim();

  if (!ctaId) return;

  trackEvent({
    type: "cta_click",
    ctaId,
    path: href || null,
  });
}

export function trackProjectOpen({
  projectId,
} = {}) {
  const id =
    String(projectId || "").trim();

  if (!id) return;

  trackEvent({
    type: "project_open",
    projectId: id,
  });
}

export function trackCodeSnippetView({
  snippetId,
} = {}) {
  const id =
    String(snippetId || "").trim();

  if (!id) return;

  trackEvent({
    type: "code_snippet_view",
    snippetId: id,
  });
}

export function trackDeepLinkLanding({
  path,
  hash,
} = {}) {
  const normalizedPath =
    String(path || "").trim();

  const normalizedHash =
    String(hash || "").trim();

  if (
    !normalizedPath &&
    !normalizedHash
  ) {
    return;
  }

  trackEvent({
    type: "deep_link",
    path: normalizedPath || null,
    hash: normalizedHash || null,
  });
}