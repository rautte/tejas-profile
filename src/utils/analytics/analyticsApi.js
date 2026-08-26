// src/utils/analytics/analyticsApi.js

import {
  readOwnerSessionToken,
} from "../owner/ownerSession";

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

function analyticsHeaders({
  requireOwner = false,
} = {}) {
  const headers = {
    "content-type":
      "application/json",
  };


  const token =
    readOwnerSessionToken();


  if (token) {
    headers[
      "x-owner-token"
    ] =
      token;
  }


  if (
    requireOwner &&
    !token
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

function cleanString(
  value
) {
  return String(
    value ??
      ""
  ).trim();
}


function requireControlPlaneId(
  value,
  field
) {
  const id =
    cleanString(
      value
    );


  if (
    !id ||
    id.length > 160 ||
    !/^[A-Za-z0-9._:-]+$/.test(
      id
    )
  ) {
    throw new Error(
      `${field} is invalid.`
    );
  }


  return id;
}


function archiveLimit(
  value
) {
  const parsed =
    Number(
      value
    );


  if (
    !Number.isInteger(
      parsed
    ) ||
    parsed < 1 ||
    parsed > 100
  ) {
    throw new Error(
      "limit must be an integer between 1 and 100."
    );
  }


  return parsed;
}


const USAGE_EPOCH_STATES =
  new Set([
    "OPEN",
    "CLOSING",
    "CLOSED",
  ]);


/**
 * Owner-only immutable Usage Epoch history.
 *
 * Backend permits one efficient selector:
 *
 * - lifecycle state
 * OR
 * - deploymentConfigurationId
 *
 * Never emulate an "all epochs" catalog client-side.
 */
export async function listUsageEpochs({
  state =
    "CLOSED",

  deploymentConfigurationId,

  limit =
    25,

  nextToken,

  signal,
} = {}) {
  const base =
    mustHaveSnapshotsApi();

  const configurationId =
    cleanString(
      deploymentConfigurationId
    );

  const normalizedState =
    cleanString(
      state ||
        "CLOSED"
    ).toUpperCase();


  if (
    configurationId
  ) {
    requireControlPlaneId(
      configurationId,
      "deploymentConfigurationId"
    );
  } else if (
    !USAGE_EPOCH_STATES.has(
      normalizedState
    )
  ) {
    throw new Error(
      "state must be OPEN, CLOSING, or CLOSED."
    );
  }


  const qs =
    new URLSearchParams();


  if (
    configurationId
  ) {
    qs.set(
      "deploymentConfigurationId",
      configurationId
    );
  } else {
    qs.set(
      "state",
      normalizedState
    );
  }


  qs.set(
    "limit",
    String(
      archiveLimit(
        limit
      )
    )
  );


  const token =
    cleanString(
      nextToken
    );


  if (token) {
    qs.set(
      "nextToken",
      token
    );
  }


  const response =
    await fetch(
      `${base}/usage-epochs/list?${qs.toString()}`,
      {
        method:
          "GET",

        headers:
          analyticsHeaders({
            requireOwner:
              true,
          }),

        cache:
          "no-store",

        signal,
      }
    );


  const data =
    await readJsonResponse(
      response,
      "Usage Epoch history query"
    );


  if (
    !data ||
    data.ok !== true ||
    !Array.isArray(
      data.epochs
    )
  ) {
    throw new Error(
      data?.error ||
        "Usage Epoch history returned an invalid response."
    );
  }


  return data;
}


/**
 * Read one immutable Configuration Analytics Report by its
 * authoritative Usage Epoch identity.
 */
export async function getConfigurationAnalyticsReport({
  usageEpochId,
  signal,
} = {}) {
  const id =
    requireControlPlaneId(
      usageEpochId,
      "usageEpochId"
    );

  const base =
    mustHaveSnapshotsApi();

  const qs =
    new URLSearchParams({
      usageEpochId:
        id,
    });


  const response =
    await fetch(
      `${base}/configuration-analytics-reports/get?${qs.toString()}`,
      {
        method:
          "GET",

        headers:
          analyticsHeaders({
            requireOwner:
              true,
          }),

        cache:
          "no-store",

        signal,
      }
    );


  const data =
    await readJsonResponse(
      response,
      "Configuration Analytics Report read"
    );


  const responseEpochId =
    cleanString(
      data
        ?.usageEpoch
        ?.usageEpochId
    );

  const reportEpochId =
    cleanString(
      data
        ?.report
        ?.usageEpochId
    );

  const epochReportId =
    cleanString(
      data
        ?.usageEpoch
        ?.report
        ?.reportId
    );

  const reportId =
    cleanString(
      data
        ?.report
        ?.reportId
    );

  const epochSha =
    cleanString(
      data
        ?.usageEpoch
        ?.report
        ?.reportSha256
    );

  const responseSha =
    cleanString(
      data
        ?.reportSha256
    );


  if (
    !data ||
    data.ok !== true ||
    responseEpochId !== id ||
    reportEpochId !== id ||
    !reportId ||
    reportId !==
      epochReportId ||
    !responseSha ||
    responseSha !==
      epochSha
  ) {
    throw new Error(
      "Configuration Analytics Report response identity does not match the requested Usage Epoch."
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
 * Lifecycle/navigation-safe best-effort Analytics delivery.
 *
 * sendBeacon() is deliberately supplemental to the normal fetch transport.
 * Event IDs make duplicate delivery safe at the aggregate layer.
 *
 * text/plain is intentional:
 * it keeps the cross-origin beacon request CORS-simple while the backend
 * still parses the body as JSON.
 */
export function sendAnalyticsBatchBeacon(
  payload
) {
  if (
    typeof navigator === "undefined" ||
    typeof navigator.sendBeacon !== "function"
  ) {
    return false;
  }

  let url;

  try {
    url =
      `${mustHaveAnalyticsIngestApi()}/analytics/ingest`;
  } catch {
    return false;
  }

  try {
    const serialized =
      JSON.stringify(payload);

    const body =
      typeof Blob !== "undefined"
        ? new Blob(
            [serialized],
            {
              type:
                "text/plain;charset=UTF-8",
            }
          )
        : serialized;

    return Boolean(
      navigator.sendBeacon(
        url,
        body
      )
    );
  } catch {
    return false;
  }
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

  profileVariantId = "all",

  profileTargetingLocation =
    "all",

  profileTargetingJobRole =
    "all",

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
    profileVariantId &&
    profileVariantId !==
      "all"
  ) {
    qs.set(
      "profileVariantId",
      String(
        profileVariantId
      )
    );
  }


  if (
    profileTargetingLocation &&
    profileTargetingLocation !==
      "all"
  ) {
    qs.set(
      "profileTargetingLocation",
      String(
        profileTargetingLocation
      )
    );
  }


  if (
    profileTargetingJobRole &&
    profileTargetingJobRole !==
      "all"
  ) {
    qs.set(
      "profileTargetingJobRole",
      String(
        profileTargetingJobRole
      )
    );
  }

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

    profileVariantId = "all",

    profileTargetingLocation =
      "all",

    profileTargetingJobRole =
      "all",

    boundaryId = "all",

    from,

    to,

    signal,

  } = {}
) {
  const data =
    await queryAnalyticsAgg({
      profileVersionId,

      profileVariantId,

      profileTargetingLocation,

      profileTargetingJobRole,

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