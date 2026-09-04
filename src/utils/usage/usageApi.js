// src/utils/usage/usageApi.js
//
// API client for the admin "Usage" page (P13 point 4): AWS resource
// usage/cost snapshots aggregated day/week/month, plus the owner-
// configurable refresh-schedule config.

import {
  readOwnerSessionToken,
} from "../owner/ownerSession";

const SNAPSHOTS_API =
  process.env.REACT_APP_SNAPSHOTS_API || "";


function mustHaveSnapshotsApi() {
  if (!SNAPSHOTS_API) {
    throw new Error(
      "Missing REACT_APP_SNAPSHOTS_API"
    );
  }

  return SNAPSHOTS_API.replace(
    /\/+$/,
    ""
  );
}


function ownerHeaders() {
  const headers = {
    "content-type":
      "application/json",
  };

  const token =
    readOwnerSessionToken();

  if (!token) {
    throw new Error(
      "Owner mode is required to view Usage."
    );
  }

  headers[
    "x-owner-token"
  ] =
    token;

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
        JSON.parse(
          text
        );
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


export async function getUsageSummary(
  {
    signal,
  } = {}
) {
  const base =
    mustHaveSnapshotsApi();

  const response =
    await fetch(
      `${base}/usage/summary`,
      {
        method:
          "GET",

        headers:
          ownerHeaders(),

        cache:
          "no-store",

        signal,
      }
    );

  const data =
    await readJsonResponse(
      response,
      "Usage summary read"
    );

  return {
    config:
      data?.config ||
      null,

    snapshots:
      data?.snapshots || {
        day:
          null,

        week:
          null,

        month:
          null,
      },
  };
}


export async function getUsageHistory(
  {
    periodType =
      "day",

    limit,

    signal,
  } = {}
) {
  const base =
    mustHaveSnapshotsApi();

  const params =
    new URLSearchParams(
      {
        periodType,
      }
    );

  if (
    typeof limit ===
      "number" &&
    limit >
      0
  ) {
    params.set(
      "limit",
      String(
        limit
      )
    );
  }

  const response =
    await fetch(
      `${base}/usage/history?${params.toString()}`,
      {
        method:
          "GET",

        headers:
          ownerHeaders(),

        cache:
          "no-store",

        signal,
      }
    );

  const data =
    await readJsonResponse(
      response,
      "Usage history read"
    );

  return Array.isArray(
    data
      ?.snapshots
  )
    ? data.snapshots
    : [];
}


export async function setUsageRefreshConfig(
  {
    intervalDays,
    alertThresholds,
  }
) {
  const base =
    mustHaveSnapshotsApi();

  const response =
    await fetch(
      `${base}/usage/config`,
      {
        method:
          "POST",

        headers:
          ownerHeaders(),

        body:
          JSON.stringify(
            {
              intervalDays,

              ...(alertThresholds
                ? {
                    alertThresholds,
                  }
                : {}),
            }
          ),

        cache:
          "no-store",
      }
    );

  const data =
    await readJsonResponse(
      response,
      "Usage refresh-schedule update"
    );

  return (
    data
      ?.config ||
    null
  );
}


export async function refreshUsageNow() {
  const base =
    mustHaveSnapshotsApi();

  const response =
    await fetch(
      `${base}/usage/refresh-now`,
      {
        method:
          "POST",

        headers:
          ownerHeaders(),

        body:
          "{}",

        cache:
          "no-store",
      }
    );

  const data =
    await readJsonResponse(
      response,
      "Usage refresh trigger"
    );

  return Boolean(
    data
      ?.triggered
  );
}
