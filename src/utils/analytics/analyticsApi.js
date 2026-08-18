// src/utils/analytics/analyticsApi.js
import { OWNER_SESSION_KEY, OWNER_TOKEN_KEY } from "../../config/owner";

const API = process.env.REACT_APP_SNAPSHOTS_API || ""; // same base API you already use

function mustHaveApi() {
  if (!API) throw new Error("Missing REACT_APP_SNAPSHOTS_API");
  return API.replace(/\/$/, "");
}

function isOwnerEnabled() {
  try {
    return sessionStorage.getItem(OWNER_SESSION_KEY) === "1";
  } catch {}
  return false;
}

function ownerToken() {
  try {
    return sessionStorage.getItem(OWNER_TOKEN_KEY) || "";
  } catch {}
  return "";
}

function headers() {
  const h = { "content-type": "application/json" };
  if (isOwnerEnabled()) {
    const t = ownerToken();
    if (t) h["x-owner-token"] = t;
  }
  return h;
}

export async function ingestAnalyticsBatch(payload) {
  const url = `${mustHaveApi()}/analytics/ingest`;
  const res = await fetch(url, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(payload),
    keepalive: true, // important for unload flush
  });
  // ingest returns 200 or 204 (bot ignored)
  if (!res.ok && res.status !== 204) {
    const txt = await res.text().catch(() => "");
    throw new Error(`ingest failed: ${res.status} ${txt}`);
  }
  return true;
}

export async function queryAnalyticsAgg({ profileVersionId, from, to }) {
  const base = mustHaveApi();
  const qs = new URLSearchParams();
  qs.set("profileVersionId", String(profileVersionId || "unknown"));
  if (from) qs.set("from", from);
  if (to) qs.set("to", to);

  const url = `${base}/analytics/query?${qs.toString()}`;
  const res = await fetch(url, { method: "GET", headers: headers() });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`query failed: ${res.status} ${txt}`);
  }
  return res.json();
}

export async function queryAnalyticsDays({ profileVersionId, from, to } = {}) {
  const data = await queryAnalyticsAgg({ profileVersionId, from, to });

  // backend returns: { ok:true, days:[...] }
  if (Array.isArray(data)) return data; // safety if you ever change backend shape
  return Array.isArray(data?.days) ? data.days : [];
}
