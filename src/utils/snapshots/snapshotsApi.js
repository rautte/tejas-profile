// src/utils/snapshots/snapshotsApi.js

import {
  readOwnerSessionToken,
} from "../owner/ownerSession";

const API = process.env.REACT_APP_SNAPSHOTS_API || "";

function mustHaveApi() {
  if (!API) throw new Error("Missing REACT_APP_SNAPSHOTS_API");
  return API.replace(/\/$/, "");
}

function headers() {
  const h = {
    "content-type":
      "application/json",
  };


  const token =
    readOwnerSessionToken();


  if (token) {
    h["x-owner-token"] =
      token;
  }


  return h;
}

// -----------------------------
// Snapshots (JSON)
// -----------------------------
export async function presignPutSnapshot({
  from,
  to,
  name = "analytics",
  createdAt,
  category,
  tagKey,
  tagValue,
  profileVersionId,
  gitSha,
  checkpointTag,
  repoArtifactKey,
  repoArtifactSha256,
  remark,
  geoHint,
  geoJson, // ✅ Phase-3: structured geo JSON (string or object)
}) {
  const base = mustHaveApi();

  const res = await fetch(`${base}/snapshots/presign-put`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      from,
      to,
      name,
      createdAt,
      category,
      tagKey,
      tagValue,
      profileVersionId,
      gitSha,
      checkpointTag,
      repoArtifactKey,
      repoArtifactSha256,
      remark,
      geoHint,

      // ✅ Phase-3: send geoJson too (backend can persist this as metadata)
      // allow either object or string
      geoJson:
        geoJson && typeof geoJson === "object"
          ? JSON.stringify(geoJson)
          : geoJson || "",
    }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.ok) throw new Error(json.error || "presign-put failed");
  return json;
}

/**
 * NOTE:
 * This assumes you have a backend route:
 *   POST {API}/snapshots/commit-meta
 * If you don't yet, this will 404 until you add it in snapshots-handler.ts + stack routes.
 */
export async function commitSnapshotMeta({ key, meta }) {
  if (!key) throw new Error("commitSnapshotMeta: key is required");
  if (!meta || typeof meta !== "object")
    throw new Error("commitSnapshotMeta: meta is required");

  const base = mustHaveApi();

  const res = await fetch(`${base}/snapshots/commit-meta`, {
    method: "POST",
    headers: headers(), // ✅ keep owner auth consistent
    body: JSON.stringify({ key, meta }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.ok) {
    throw new Error(json.error || `commitSnapshotMeta failed (${res.status})`);
  }

  return json;
}

export async function updateSnapshotRemark({ key, remark }) {
  const base = mustHaveApi();

  const res = await fetch(`${base}/snapshots/remark`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ key, remark }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.ok) throw new Error(json.error || "update remark failed");
  return json;
}

export async function uploadSnapshotToS3(url, snapshotObject) {
  const body = JSON.stringify(snapshotObject, null, 2);

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      "content-type": "application/json",
    },
    body,
  });

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Upload failed (${res.status}) ${t || ""}`.trim());
  }
}

export async function listSnapshots({ name } = {}) {
  const base = mustHaveApi();

  const qs = new URLSearchParams();
  if (name) qs.set("name", name);

  const url = qs.toString()
    ? `${base}/snapshots/list?${qs.toString()}`
    : `${base}/snapshots/list`;

  const res = await fetch(url, { headers: headers() });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.ok) throw new Error(json.error || "list failed");
  return json.items;
}

export async function listTrashSnapshots({ name } = {}) {
  const base = mustHaveApi();

  const qs = new URLSearchParams({ scope: "trash" });
  if (name) qs.set("name", name);

  const res = await fetch(`${base}/snapshots/list?${qs.toString()}`, {
    headers: headers(),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.ok) throw new Error(json.error || "list trash failed");
  return json.items;
}

export async function presignGetSnapshot(key) {
  const base = mustHaveApi();

  const qs = new URLSearchParams({ key });
  const res = await fetch(`${base}/snapshots/presign-get?${qs.toString()}`, {
    headers: headers(),
  });

  const json = await res.json().catch(() => ({}));
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

  const json = await res.json().catch(() => ({}));
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

  const json = await res.json().catch(() => ({}));
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
  // contentType removed on purpose (backend enforces zip)
}) {
  const base = mustHaveApi();

  const res = await fetch(`${base}/repo/presign-put`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ profileVersion, checkpointTag, gitSha }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.ok)
    throw new Error(json.error || "repo presign-put failed");
  return json; // { key, url, contentType }
}

export async function presignRepoGet(repoKey) {
  const base = mustHaveApi();

  const key = String(repoKey || "").trim();
  if (!key) throw new Error("repoKey required");

  const qs = new URLSearchParams({ key });

  const res = await fetch(`${base}/repo/presign-get?${qs.toString()}`, {
    method: "GET",
    headers: headers(), // ✅ uses your owner session/token logic
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.ok) {
    throw new Error(json.error || "repo presign-get failed");
  }

  return json; // { ok, bucket, key, url }
}



// Upload file/blob to presigned S3 url
export async function uploadRepoZipToS3(
  url,
  fileOrBlob,
  contentType = "application/zip"
) {
  const res = await fetch(url, {
    method: "PUT",
    headers: { "content-type": contentType },
    body: fileOrBlob,
  });
  if (!res.ok) throw new Error(`Repo zip upload failed: ${res.status}`);
}

// -----------------------------
// Profile Variants
// -----------------------------

/**
 * Requests an immutable, content-addressed S3 upload target.
 *
 * The backend computes the actual S3 key from sha256 + contentType.
 * The browser never chooses an arbitrary object key.
 */
export async function presignProfileVariantAssetPut({
  sha256,
  contentType,
}) {
  const base =
    mustHaveApi();

  const res =
    await fetch(
      `${base}/profile-variants/assets/presign-put`,
      {
        method:
          "POST",

        headers:
          headers(),

        body:
          JSON.stringify({
            sha256,
            contentType,
          }),

        cache:
          "no-store",
      }
    );

  const json =
    await res
      .json()
      .catch(
        () => ({})
      );

  if (
    !res.ok ||
    !json.ok
  ) {
    throw new Error(
      json.error ||
        `Profile Variant asset presign failed (${res.status})`
    );
  }

  return json;
}


/**
 * Uploads exact immutable asset bytes to the presigned S3 URL.
 *
 * IMPORTANT:
 * - Do not attach x-owner-token here.
 * - requiredHeaders came from the backend and are part of the
 *   presigned S3 request contract.
 */
export async function uploadProfileVariantAssetToS3({
  url,
  body,
  requiredHeaders,
}) {
  if (!url) {
    throw new Error(
      "Profile Variant asset upload URL is required."
    );
  }

  if (
    body === null ||
    body === undefined
  ) {
    throw new Error(
      "Profile Variant asset upload body is required."
    );
  }

  const uploadHeaders = {
    ...(
      requiredHeaders &&
      typeof requiredHeaders ===
        "object"
        ? requiredHeaders
        : {}
    ),
  };

  const res =
    await fetch(
      url,
      {
        method:
          "PUT",

        headers:
          uploadHeaders,

        body,
      }
    );

  if (!res.ok) {
    const detail =
      await res
        .text()
        .catch(
          () => ""
        );

    throw new Error(
      (
        `Profile Variant asset upload failed (${res.status}) ` +
        detail
      ).trim()
    );
  }

  return true;
}


/**
 * Commits a fully validated immutable Profile Variant.
 *
 * The backend verifies every referenced asset first and writes
 * manifest.json last.
 */
export async function publishProfileVariant(
  variant
) {
  const base =
    mustHaveApi();

  const res =
    await fetch(
      `${base}/profile-variants/publish`,
      {
        method:
          "POST",

        headers:
          headers(),

        body:
          JSON.stringify({
            variant,
          }),

        cache:
          "no-store",
      }
    );

  const json =
    await res
      .json()
      .catch(
        () => ({})
      );

  if (
    !res.ok ||
    !json.ok
  ) {
    throw new Error(
      json.error ||
        `Profile Variant publication failed (${res.status})`
    );
  }

  return json;
}


/**
 * Reads an immutable Profile Variant back through the owner API.
 */
export async function getProfileVariant(
  profileVariantId
) {
  const id =
    String(
      profileVariantId ||
        ""
    ).trim();

  if (!id) {
    throw new Error(
      "profileVariantId is required."
    );
  }

  const base =
    mustHaveApi();

  const qs =
    new URLSearchParams({
      profileVariantId:
        id,
    });

  const res =
    await fetch(
      `${base}/profile-variants/get?${qs.toString()}`,
      {
        method:
          "GET",

        headers:
          headers(),

        cache:
          "no-store",
      }
    );

  const json =
    await res
      .json()
      .catch(
        () => ({})
      );

  if (
    !res.ok ||
    !json.ok
  ) {
    throw new Error(
      json.error ||
        `Profile Variant read failed (${res.status})`
    );
  }

  return json;
}

/**
 * Atomically activates an already-published immutable Profile Variant.
 *
 * expectedRevision provides optimistic concurrency protection:
 *
 * - use 0 when the caller observed no active Profile pointer
 * - provide the current active-pointer revision otherwise
 *
 * Omitting expectedRevision is allowed for callers that intentionally
 * do not want optimistic concurrency protection.
 *
 * A 409 means another owner/device changed the active pointer first.
 */
export async function activateProfileVariant({
  profileVariantId,
  expectedRevision,
}) {
  const id =
    String(
      profileVariantId ||
        ""
    ).trim();


  if (!id) {
    throw new Error(
      "profileVariantId is required."
    );
  }


  let normalizedExpectedRevision =
    null;


  if (
    expectedRevision !==
      undefined &&
    expectedRevision !==
      null
  ) {
    const parsed =
      Number(
        expectedRevision
      );


    if (
      !Number.isInteger(
        parsed
      ) ||
      parsed < 0
    ) {
      throw new Error(
        "expectedRevision must be a non-negative integer when provided."
      );
    }


    normalizedExpectedRevision =
      parsed;
  }


  const base =
    mustHaveApi();


  const body = {
    profileVariantId:
      id,
  };


  if (
    normalizedExpectedRevision !==
      null
  ) {
    body.expectedRevision =
      normalizedExpectedRevision;
  }


  const res =
    await fetch(
      `${base}/profile-variants/activate`,
      {
        method:
          "POST",

        headers:
          headers(),

        body:
          JSON.stringify(
            body
          ),

        cache:
          "no-store",
      }
    );


  const json =
    await res
      .json()
      .catch(
        () => ({})
      );


  if (
    res.status ===
      409
  ) {
    const error =
      new Error(
        json.error ||
          "Profile activation conflict. Refresh the active profile and try again."
      );


    error.code =
      "PROFILE_ACTIVATION_CONFLICT";

    error.status =
      409;


    throw error;
  }


  if (
    !res.ok ||
    !json.ok
  ) {
    throw new Error(
      json.error ||
        `Profile activation failed (${res.status}).`
    );
  }


  return json;
}


export async function getDeployHistory() {
  const base = mustHaveApi();
  const res = await fetch(`${base}/deploy/history`, { headers: headers() });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.ok) throw new Error(json.error || "deploy history failed");
  return json.history; // may be null
}

export async function purgeSnapshot(key) {
  const base = mustHaveApi();

  const res = await fetch(`${base}/snapshots/purge`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ key }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.ok) throw new Error(json.error || "purge failed");
  return json; // { ok:true, key, deleted }
}


/**
 * Sends a one-time code to the pre-verified owner notification
 * email, starting an owner passcode change. Requires an already
 * -authenticated owner session (or the master credential).
 */
export async function requestOwnerPasscodeChange() {
  const base =
    mustHaveApi();

  const res =
    await fetch(
      `${base}/owner/passcode/request-change`,
      {
        method:
          "POST",

        headers:
          headers(),

        body:
          "{}",

        cache:
          "no-store",
      }
    );

  const json =
    await res
      .json()
      .catch(
        () => ({})
      );

  if (
    !res.ok ||
    !json.ok
  ) {
    throw new Error(
      json.error ||
        `Requesting a passcode change code failed (${res.status})`
    );
  }

  return json;
}


/**
 * Confirms an owner passcode change with the emailed code and the
 * new passcode. The new passcode is sent once, over HTTPS, and is
 * never persisted server-side except as the rotated secret itself.
 */
export async function confirmOwnerPasscodeChange({
  code,
  newPasscode,
}) {
  const base =
    mustHaveApi();

  const res =
    await fetch(
      `${base}/owner/passcode/confirm-change`,
      {
        method:
          "POST",

        headers:
          headers(),

        body:
          JSON.stringify(
            {
              code,
              newPasscode,
            }
          ),

        cache:
          "no-store",
      }
    );

  const json =
    await res
      .json()
      .catch(
        () => ({})
      );

  if (
    !res.ok ||
    !json.ok
  ) {
    throw new Error(
      json.error ||
        `Confirming the passcode change failed (${res.status})`
    );
  }

  return json;
}