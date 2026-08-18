// src/utils/analytics/index.js

// Public API: local analytics + backend ingestion tracker (compat layer)
import { trackEvent } from "./tracker";

// Re-export your existing local analytics utilities:
export * from "./store";
export * from "./aggregations";

// Export tracker primitives:
export { analyticsStart, analyticsStart as analyticsInit, trackEvent, flushAndClose } from "./tracker";

// ---- Admin compatibility ----
export { readEvents as getAllEvents, clearEvents as resetAnalytics } from "./store";

// ---- App compatibility wrappers ----
export function trackSectionEnter(sectionLabel) {
  trackEvent({ type: "section_view", section: sectionLabel });
}

export function trackClick({ id, text, href } = {}) {
  trackEvent({
    type: "cta_click",
    ctaId: String(id || "").trim(),
    path: href || null,
    metaText: text ? String(text).slice(0, 80) : null,
  });
}

let _lastDepthSent = {};
export function trackScrollDepth(sectionLabel, el) {
  if (!el) return;

  const maxScroll = Math.max(1, el.scrollHeight - el.clientHeight);
  const pct = Math.max(0, Math.min(100, Math.round((el.scrollTop / maxScroll) * 100)));

  const prev = _lastDepthSent[sectionLabel] ?? -1;
  if (pct < prev + 5 && pct !== 100) return;

  _lastDepthSent[sectionLabel] = pct;

  trackEvent({
    type: "scroll_depth",
    section: sectionLabel,
    depthPct: pct,
  });
}
