// src/utils/analytics/index.js

import {
  trackEvent,
  trackEvents,
} from "./tracker";

import {
  canonicalizeAnalyticsHash,
} from "../hashRouting";


// -----------------------------
// Local/debug compatibility
// -----------------------------

export * from "./store";
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
  trackEvents,
  trackSectionEnter,
  trackScrollDepth,
  flushAndClose,
  flushForNavigation,
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


/**
 * One project action represents two independent Analytics dimensions:
 *
 * 1. which action class was used?
 *    project_live_demo / project_readme / project_github
 *
 * 2. which project was interacted with?
 *    battleship-web-game / portfolio-website / ...
 *
 * Queue both before starting the important-event flush.
 */
export function trackProjectAction({
  ctaId,
  projectId,
  href,
} = {}) {
  const normalizedCtaId =
    String(ctaId || "").trim();

  const normalizedProjectId =
    String(projectId || "").trim();

  if (
    !normalizedCtaId ||
    !normalizedProjectId
  ) {
    return;
  }

  trackEvents([
    {
      type: "cta_click",
      ctaId: normalizedCtaId,
      path: href || null,
    },
    {
      type: "project_open",
      projectId: normalizedProjectId,
    },
  ]);
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
    canonicalizeAnalyticsHash(
      hash
    );

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