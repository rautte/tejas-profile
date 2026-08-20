// src/utils/analytics/analyticsApi.js

import {
  OWNER_SESSION_KEY,
  OWNER_TOKEN_KEY,
} from "../../config/owner";

const SNAPSHOTS_API =
  process.env.REACT_APP_SNAPSHOTS_API || "";

const ANALYTICS_INGEST_API =
  process.env.REACT_APP_ANALYTICS_INGEST_API || "";

function mustHaveSnapshotsApi() {
  if (!SNAPSHOTS_API) {
    throw new Error(
      "Missing REACT_APP_SNAPSHOTS_API"
    );
  }

  return SNAPSHOTS_API.replace(/\/+$/, "");
}

function mustHaveAnalyticsIngestApi() {
  if (!ANALYTICS_INGEST_API) {
    throw new Error(
      "Missing REACT_APP_ANALYTICS_INGEST_API"
    );
  }

  return ANALYTICS_INGEST_API.replace(
    /\/+$/,
    ""
  );
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
    `${mustHaveAnalyticsIngestApi()}/analytics/ingest`;

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

  boundaryId = "all",

  from,

  to,

  signal,

} = {}) {
  const base =
    mustHaveSnapshotsApi();

  const qs =
    new URLSearchParams();

  qs.set(
    "profileVersionId",
    String(
      profileVersionId ||
        "all"
    )
  );

  if (
    boundaryId &&
    boundaryId !== "all"
  ) {
    qs.set(
      "boundaryId",
      String(
        boundaryId
      )
    );
  }

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

export async function queryAnalyticsMeta({
  signal,
} = {}) {
  const base =
    mustHaveSnapshotsApi();

  const url =
    `${base}/analytics/meta`;

  const res =
    await fetch(
      url,
      {
        method: "GET",

        headers:
          analyticsHeaders({
            requireOwner: true,
          }),

        signal,

        cache:
          "no-store",
      }
    );

  const data =
    await readJsonResponse(
      res,
      "analytics metadata query"
    );

  if (
    !data ||
    data.ok !== true
  ) {
    throw new Error(
      data?.error ||
        "Analytics metadata returned an invalid response."
    );
  }

  return data;
}

export async function createAnalyticsBoundary({
  boundaryId,
  type,
  effectiveAt,
  profileVersionId,
  note,
  gitSha,
  buildTime,
} = {}) {
  const base =
    mustHaveSnapshotsApi();

  const url =
    `${base}/analytics/boundaries`;

  const payload = {
    boundaryId,
    type,
    effectiveAt,
  };

  if (profileVersionId) {
    payload.profileVersionId =
      profileVersionId;
  }

  if (note) {
    payload.note =
      note;
  }

  if (gitSha) {
    payload.gitSha =
      gitSha;
  }

  if (buildTime) {
    payload.buildTime =
      buildTime;
  }

  const res =
    await fetch(
      url,
      {
        method: "POST",

        headers:
          analyticsHeaders({
            requireOwner: true,
          }),

        body:
          JSON.stringify(
            payload
          ),

        cache:
          "no-store",
      }
    );

  const data =
    await readJsonResponse(
      res,
      "analytics boundary creation"
    );

  if (
    !data ||
    data.ok !== true ||
    !data.boundary
  ) {
    throw new Error(
      data?.error ||
        "Analytics boundary creation returned an invalid response."
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

    boundaryId = "all",

    from,

    to,

    signal,

  } = {}
) {
  const data =
    await queryAnalyticsAgg({
      profileVersionId,
      boundaryId,
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