// scripts/publish-ci-snapshot.mjs
// Publishes a minimal "CI deploy snapshot" so it appears in Admin → Snapshots UI

const SNAPSHOTS_API = (process.env.SNAPSHOTS_API || "").replace(/\/$/, "");
const OWNER_TOKEN = process.env.OWNER_TOKEN || "";
const STAGE = process.env.STAGE || "prod";

const GIT_SHA = process.env.GIT_SHA || "";
const PROFILE_VERSION = process.env.PROFILE_VERSION || "unknown";
const CHECKPOINT_TAG = process.env.CHECKPOINT_TAG || "unknown";

const REPO_ARTIFACT_KEY = process.env.REPO_ARTIFACT_KEY || "";
const REPO_ARTIFACT_SHA256 = process.env.REPO_ARTIFACT_SHA256 || "";

function must(v, name) {
  if (!v) throw new Error(`${name} is required`);
  return v;
}

async function main() {
  must(SNAPSHOTS_API, "SNAPSHOTS_API");
  must(OWNER_TOKEN, "OWNER_TOKEN");
  must(GIT_SHA, "GIT_SHA");
  must(PROFILE_VERSION, "PROFILE_VERSION");
  must(CHECKPOINT_TAG, "CHECKPOINT_TAG");
  must(REPO_ARTIFACT_KEY, "REPO_ARTIFACT_KEY");
  must(REPO_ARTIFACT_SHA256, "REPO_ARTIFACT_SHA256");

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const createdAt = new Date().toISOString();

  // This is the metadata your list view already expects (shows in columns)
  const presignPayload = {
    name: "ci_deploy",
    from: today,
    to: today,
    createdAt,

    category: "Profile",
    tagKey: "stage",
    tagValue: STAGE,

    profileVersionId: PROFILE_VERSION,
    gitSha: GIT_SHA,
    checkpointTag: CHECKPOINT_TAG,
    repoArtifactKey: REPO_ARTIFACT_KEY,
    repoArtifactSha256: REPO_ARTIFACT_SHA256,
  };

  console.log("[ci-snapshot] presign payload:", presignPayload);

  const presignRes = await fetch(`${SNAPSHOTS_API}/snapshots/presign-put`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-owner-token": OWNER_TOKEN,
    },
    body: JSON.stringify(presignPayload),
  });

  const presignJson = await presignRes.json().catch(() => ({}));
  if (!presignRes.ok || !presignJson.ok) {
    throw new Error(
      `presign-put failed (${presignRes.status}): ${presignJson.error || JSON.stringify(presignJson)}`
    );
  }

  // The JSON content stored in S3 (previewable in UI)
  const snapshotBody = {
    kind: "ci_deploy_snapshot",
    stage: STAGE,
    createdAt,
    note: "Auto-created after successful Build & Deploy (Pages).",
    profileVersion: {
      id: PROFILE_VERSION,
      gitSha: GIT_SHA || null,
      repo: {
        provider: "github",
        repo: "rautte/tejas-profile",
        checkpointTag: CHECKPOINT_TAG,

        // ✅ helpful for preview
        artifactKey: REPO_ARTIFACT_KEY,
        artifactSha256: REPO_ARTIFACT_SHA256,
      },
    },
  };

  const { url, key, requiredHeaders } = presignJson;
  if (!url || !key) throw new Error("presign-put did not return url/key");

  const putHeaders = {
    ...(requiredHeaders || {}),
    "content-type": "application/json",
  };

  const putRes = await fetch(url, {
    method: "PUT",
    headers: {
        ...(requiredHeaders || {}),
        "content-type": "application/json",
    },
    body: JSON.stringify(snapshotBody, null, 2),
  });


  if (!putRes.ok) {
    const t = await putRes.text().catch(() => "");
    throw new Error(`S3 upload failed (${putRes.status}): ${t}`);
  }

  console.log(`[ci-snapshot] ✅ uploaded snapshot: ${key}`);
}

main().catch((e) => {
  console.error("[ci-snapshot] ❌ failed:", e?.message || e);
  process.exit(1);
});
