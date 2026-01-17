// src/utils/snapshots/snapshotsClient.js

const API_BASE = process.env.REACT_APP_SNAPSHOTS_API_BASE;

function mustApi() {
  if (!API_BASE) throw new Error("Missing REACT_APP_SNAPSHOTS_API_BASE");
  return API_BASE.replace(/\/$/, "");
}

export async function presignPut({ key, ownerToken }) {
  const res = await fetch(`${mustApi()}/snapshots/presign-put`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-owner-token": ownerToken,
    },
    body: JSON.stringify({ key, contentType: "application/json" }),
  });

  if (!res.ok) throw new Error(`presign-put failed: ${res.status}`);
  return res.json(); // { url }
}

export async function uploadToPresignedUrl({ url, json }) {
  const body = JSON.stringify(json, null, 2);
  const res = await fetch(url, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body,
  });
  if (!res.ok) throw new Error(`upload failed: ${res.status}`);
}

export async function listSnapshots({ ownerToken }) {
  const res = await fetch(`${mustApi()}/snapshots/list`, {
    headers: { "x-owner-token": ownerToken },
  });
  if (!res.ok) throw new Error(`list failed: ${res.status}`);
  return res.json(); // { items: [{ key, lastModified, size }] }
}

export async function presignGet({ key, ownerToken }) {
  const res = await fetch(`${mustApi()}/snapshots/presign-get?key=${encodeURIComponent(key)}`, {
    headers: { "x-owner-token": ownerToken },
  });
  if (!res.ok) throw new Error(`presign-get failed: ${res.status}`);
  return res.json(); // { url }
}
