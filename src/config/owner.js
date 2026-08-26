// src/config/owner.js

export const OWNER_SESSION_KEY =
  "tp_owner_mode";

export const OWNER_SESSION_TOKEN_KEY =
  "tp_owner_session_token_v1";

export const OWNER_SESSION_EXPIRES_AT_KEY =
  "tp_owner_session_expires_at_v1";

/**
 * Persistent browser-level analytics exclusion.
 *
 * Unlike owner mode itself, this intentionally survives browser sessions.
 * Once this browser has successfully authenticated as owner, normal browsing
 * from this browser must not contaminate visitor analytics.
 */
export const ANALYTICS_EXCLUDED_KEY =
  "tp_analytics_excluded_browser_v1";