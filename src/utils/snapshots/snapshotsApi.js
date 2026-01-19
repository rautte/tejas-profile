// src/utils/snapshots/snapshotsApi.js

import { OWNER_SESSION_KEY, OWNER_TOKEN_KEY } from "../../config/owner";

const API = process.env.REACT_APP_SNAPSHOTS_API || "";

function mustHaveApi() {
  if (!API) throw new Error("Missing REACT_APP_SNAPSHOTS_API");
  return API.replace(/\/$/, "");
}

// function ownerToken() {
//   return process.env.REACT_APP_OWNER_SECRET || "";
// }

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

  // only attach token if owner mode enabled
  if (isOwnerEnabled()) {
    const t = ownerToken();
    if (t) h["x-owner-token"] = t;
  }

  return h;
}


// -----------------------------
// Snapshots (JSON)
// -----------------------------
export async function presignPutSnapshot({ from, to, name = "analytics", createdAt }) {
  const base = mustHaveApi();

  const res = await fetch(`${base}/snapshots/presign-put`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ from, to, name, createdAt }),
  });

  const json = await res.json();
  if (!res.ok || !json.ok) throw new Error(json.error || "presign-put failed");
  return json; // { key, url }
}

export async function uploadSnapshotToS3(url, snapshotObject) {
  const body = JSON.stringify(snapshotObject, null, 2);
  const res = await fetch(url, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body,
  });
  if (!res.ok) throw new Error("Upload failed");
}

export async function listSnapshots() {
  const base = mustHaveApi();

  const res = await fetch(`${base}/snapshots/list`, { headers: headers() });
  const json = await res.json();
  if (!res.ok || !json.ok) throw new Error(json.error || "list failed");
  return json.items; // [{ key, filename, createdAt, ... }]
}

export async function listTrashSnapshots() {
  const base = mustHaveApi();

  const res = await fetch(`${base}/snapshots/list?scope=trash`, { headers: headers() });
  const json = await res.json();
  if (!res.ok || !json.ok) throw new Error(json.error || "list trash failed");
  return json.items;
}

export async function presignGetSnapshot(key) {
  const base = mustHaveApi();

  const qs = new URLSearchParams({ key });
  const res = await fetch(`${base}/snapshots/presign-get?${qs.toString()}`, {
    headers: headers(),
  });

  const json = await res.json();
  if (!res.ok || !json.ok) throw new Error(json.error || "presign-get failed");
  return json.url;
}

export async function fetchSnapshotJson(key) {
  const url = await presignGetSnapshot(key);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch snapshot failed: ${res.status}`);
  return res.json();
}

export async function deleteSnapshot(key) {
  const base = mustHaveApi();

  const res = await fetch(`${base}/snapshots/delete`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ key }),
  });

  const json = await res.json();
  if (!res.ok || !json.ok) throw new Error(json.error || "delete failed");
  return json;
}

export async function restoreSnapshot(key) {
  const base = mustHaveApi();

  const res = await fetch(`${base}/snapshots/restore`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ key }),
  });

  const json = await res.json();
  if (!res.ok || !json.ok) throw new Error(json.error || "restore failed");
  return json;
}

// -----------------------------
// Repo ZIP (binary) - Option 2
// -----------------------------
// Lambda route: POST /repo/presign-put
// body: { profileVersion, checkpointTag, gitSha, contentType? }
// returns: { key, url }
export async function presignPutRepoZip({
  profileVersion,
  checkpointTag,
  gitSha,
  contentType = "application/zip",
}) {
  const base = mustHaveApi();

  const res = await fetch(`${base}/repo/presign-put`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ profileVersion, checkpointTag, gitSha, contentType }),
  });

  const json = await res.json();
  if (!res.ok || !json.ok) throw new Error(json.error || "repo presign-put failed");
  return json; // { key, url }
}

// Upload file/blob to presigned S3 url (NO custom headers)
export async function uploadRepoZipToS3(url, fileOrBlob) {
  const res = await fetch(url, {
    method: "PUT",
    headers: { "content-type": "application/zip" },
    body: fileOrBlob,
  });
  if (!res.ok) throw new Error(`Repo zip upload failed: ${res.status}`);
}

// -----------------------------
// Deploy trigger (owner-only)
// -----------------------------
// Lambda route: POST /deploy/trigger
// body: { gitSha, checkpointTag?, profileVersion?, reason?, sourceSnapshotKey? }
// returns: { ok, runUrl?, message? }
export async function triggerDeploy({
  gitSha,
  checkpointTag,
  profileVersion,
  reason,
  sourceSnapshotKey,
}) {
  const base = mustHaveApi();

  const res = await fetch(`${base}/deploy/trigger`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      gitSha,
      checkpointTag,
      profileVersion,
      reason,
      sourceSnapshotKey,
    }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.ok) throw new Error(json.error || "deploy trigger failed");
  return json; // { ok, message, runUrl? }
}

export async function getDeployHistory() {
  const base = mustHaveApi();
  const res = await fetch(`${base}/deploy/history`, { headers: headers() });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.ok) throw new Error(json.error || "deploy history failed");
  return json.history; // may be null
}

