// src/utils/snapshots/snapshotsApi.js

const API = process.env.REACT_APP_SNAPSHOTS_API;

function mustHaveApi() {
  if (!API) {
    throw new Error("Missing REACT_APP_SNAPSHOTS_API");
  }
}

function ownerToken() {
  // reuse the same “owner mode” secret already in your config
  // (still not real security; matches your current owner UX)
  return process.env.REACT_APP_OWNER_SECRET || "";
}

function headers() {
  return {
    "content-type": "application/json",
    "x-owner-token": ownerToken(),
  };
}

export async function presignPutSnapshot({ from, to, name = "analytics", createdAt }) {
  mustHaveApi();

  const res = await fetch(`${API}/snapshots/presign-put`, {
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
  mustHaveApi();
  const res = await fetch(`${API}/snapshots/list`, { headers: headers() });
  const json = await res.json();
  if (!res.ok || !json.ok) throw new Error(json.error || "list failed");
  return json.items; // [{key,size,lastModified}]
}

export async function presignGetSnapshot(key) {
  mustHaveApi();
  const qs = new URLSearchParams({ key });
  const res = await fetch(`${API}/snapshots/presign-get?${qs.toString()}`, { headers: headers() });
  const json = await res.json();
  if (!res.ok || !json.ok) throw new Error(json.error || "presign-get failed");
  return json.url;
}

export async function fetchSnapshotJson(key) {
  const url = await presignGetSnapshot(key);
  const res = await fetch(url);
  return res.json();
}
