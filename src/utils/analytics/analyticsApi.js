// src/utils/analytics/analyticsApi.js

import {
  OWNER_SESSION_KEY,
  OWNER_TOKEN_KEY,
} from "../../config/owner";

const API =
  process.env.REACT_APP_SNAPSHOTS_API || "";

function mustHaveApi() {
  if (!API) {
    throw new Error(
      "Missing REACT_APP_SNAPSHOTS_API"
    );
  }

  return API.replace(/\/$/, "");
}

function isOwnerEnabled() {
  try {
    return (
      sessionStorage.getItem(
        OWNER_SESSION_KEY
      ) === "1"
    );
  } catch {
    return false;
  }
}

function ownerToken() {
  try {
    return (
      sessionStorage.getItem(
        OWNER_TOKEN_KEY
      ) || ""
    );
  } catch {
    return "";
  }
}

function analyticsHeaders({
  requireOwner = false,
} = {}) {
  const headers = {
    "content-type":
      "application/json",
  };

  const ownerEnabled =
    isOwnerEnabled();

  const token =
    ownerToken();

  if (
    ownerEnabled &&
    token
  ) {
    headers["x-owner-token"] =
      token;
  }

  if (
    requireOwner &&
    (!ownerEnabled || !token)
  ) {
    throw new Error(
      "Owner mode is required to view analytics."
    );
  }

  return headers;
}

async function readJsonResponse(
  res,
  operation
) {
  const text =
    await res.text();

  let data = null;

  if (text) {
    try {
      data =
        JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!res.ok) {
    const detail =
      data?.error ||
      text ||
      "Unknown error";

    throw new Error(
      `${operation} failed: ${res.status} ${detail}`
    );
  }

  return data;
}

export async function ingestAnalyticsBatch(
  payload
) {
  const url =
    `${mustHaveApi()}/analytics/ingest`;

  const res =
    await fetch(url, {
      method: "POST",

      headers:
        analyticsHeaders(),

      body:
        JSON.stringify(payload),

      // Gives the browser a chance to finish
      // lifecycle flushes during page exit.
      keepalive: true,
    });

  // Ingest may intentionally return 204
  // for owner/bot traffic.
  if (
    !res.ok &&
    res.status !== 204
  ) {
    const text =
      await res
        .text()
        .catch(() => "");

    throw new Error(
      `ingest failed: ${res.status} ${text}`
    );
  }

  return true;
}

/**
 * Canonical production analytics query.
 *
 * profileVersionId:
 * - "all" => all releases
 * - specific PV id => one release
 *
 * from/to are UTC day partitions:
 * YYYY-MM-DD
 */
export async function queryAnalyticsAgg({
  profileVersionId = "all",
  from,
  to,
  signal,
} = {}) {
  const base =
    mustHaveApi();

  const qs =
    new URLSearchParams();

  qs.set(
    "profileVersionId",
    String(
      profileVersionId ||
        "all"
    )
  );

  if (from) {
    qs.set(
      "from",
      String(from)
    );
  }

  if (to) {
    qs.set(
      "to",
      String(to)
    );
  }

  const url =
    `${base}/analytics/query?${qs.toString()}`;

  const res =
    await fetch(url, {
      method: "GET",

      headers:
        analyticsHeaders({
          requireOwner: true,
        }),

      signal,

      // Owner dashboard should reflect
      // newly committed analytics immediately.
      cache: "no-store",
    });

  const data =
    await readJsonResponse(
      res,
      "analytics query"
    );

  if (
    !data ||
    data.ok !== true
  ) {
    throw new Error(
      data?.error ||
        "Analytics query returned an invalid response."
    );
  }

  return data;
}

/**
 * Temporary compatibility export.
 *
 * The old dashboard consumed `days`.
 * The Phase-3 backend now returns `daily`.
 *
 * New code should use queryAnalyticsAgg().
 */
export async function queryAnalyticsDays(
  {
    profileVersionId = "all",
    from,
    to,
    signal,
  } = {}
) {
  const data =
    await queryAnalyticsAgg({
      profileVersionId,
      from,
      to,
      signal,
    });

  return Array.isArray(
    data?.daily
  )
    ? data.daily
    : [];
}