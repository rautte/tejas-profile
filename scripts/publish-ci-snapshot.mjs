// scripts/publish-ci-snapshot.mjs
// Publishes a minimal "CI deploy snapshot" so it appears in Admin → Snapshots UI

// ✅ Node ESM does NOT support directory imports.
// Must import the concrete file (index.js) explicitly.
import { SECTION_ORDER } from "../src/data/App/index.js";

const SNAPSHOTS_API = (process.env.SNAPSHOTS_API || "").replace(/\/$/, "");
const OWNER_TOKEN = process.env.OWNER_TOKEN || "";
const STAGE = process.env.STAGE || "prod";

const GIT_SHA = process.env.GIT_SHA || "";
const PROFILE_VERSION = process.env.PROFILE_VERSION || "unknown";
const CHECKPOINT_TAG = process.env.CHECKPOINT_TAG || "unknown";

const REPO_ARTIFACT_KEY = process.env.REPO_ARTIFACT_KEY || "";
const REPO_ARTIFACT_SHA256 = process.env.REPO_ARTIFACT_SHA256 || "";

const TIMEZONE = process.env.TIMEZONE || "America/Los_Angeles";
const CATEGORY = "Profile";

const BUILD_TIME = process.env.BUILD_TIME || ""; // optional
const MANIFEST_KEY = process.env.PROFILE_MANIFEST_KEY || ""; // optional
const GIT_REF = process.env.GIT_REF || process.env.GITHUB_REF || ""; // optional
const GH_RUN_ID = process.env.GH_RUN_ID || process.env.GITHUB_RUN_ID || ""; // optional
const REPO_URL = process.env.REPO_URL || "https://github.com/rautte/tejas-profile";

function must(v, name) {
  if (!v) throw new Error(`${name} is required`);
  return v;
}

function nullIfEmptyOrUnknown(v) {
  const s = String(v || "").trim();
  if (!s || s.toLowerCase() === "unknown") return null;
  return s;
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
  // ✅ Updated to match your desired Profile snapshot preview shape
  const snapshotBody = {
    kind: "ci_deploy_snapshot",
    stage: STAGE,
    category: CATEGORY,
    timezone: TIMEZONE,
    createdAt,
    note: "Auto-created after successful Build & Deploy (Pages).",
    profileVersion: {
      id: PROFILE_VERSION,
      sections: SECTION_ORDER, // ✅ single source of truth from src/data/App/index.js
      manifestKey: nullIfEmptyOrUnknown(MANIFEST_KEY),
      gitSha: nullIfEmptyOrUnknown(GIT_SHA),
      buildTime: nullIfEmptyOrUnknown(BUILD_TIME),
      repo: {
        provider: "github",
        repo: REPO_URL, // ✅ matches desired shape
        commit: nullIfEmptyOrUnknown(GIT_SHA),
        ref: nullIfEmptyOrUnknown(GIT_REF),
        buildRunId: nullIfEmptyOrUnknown(GH_RUN_ID),
        checkpointTag: nullIfEmptyOrUnknown(CHECKPOINT_TAG),
        artifactUrl: null,
        artifactKey: nullIfEmptyOrUnknown(REPO_ARTIFACT_KEY),
        artifactSha256: nullIfEmptyOrUnknown(REPO_ARTIFACT_SHA256),
      },
    },
  };

  const { url, key } = presignJson;
  if (!url || !key) throw new Error("presign-put did not return url/key");

  // ✅ 1) Upload JSON WITHOUT x-amz-meta headers (avoid “HeadersNotSigned”)
  const putRes = await fetch(url, {
    method: "PUT",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(snapshotBody, null, 2),
  });

  if (!putRes.ok) {
    const t = await putRes.text().catch(() => "");
    throw new Error(`S3 upload failed (${putRes.status}): ${t}`);
  }

  // ✅ 2) Stamp metadata server-side (this populates table columns)
  const commitRes = await fetch(`${SNAPSHOTS_API}/snapshots/commit-meta`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-owner-token": OWNER_TOKEN,
    },
    body: JSON.stringify({
      key,
      meta: {
        category: "Profile",
        tagkey: "stage",
        tagvalue: STAGE,

        profileversionid: PROFILE_VERSION,
        gitsha: GIT_SHA,
        checkpointtag: CHECKPOINT_TAG,

        repoartifactkey: REPO_ARTIFACT_KEY,
        repoartifactsha256: REPO_ARTIFACT_SHA256,
      },
    }),
  });

  const commitJson = await commitRes.json().catch(() => ({}));
  if (!commitRes.ok || !commitJson.ok) {
    throw new Error(
      `commit-meta failed (${commitRes.status}): ${commitJson.error || JSON.stringify(commitJson)}`
    );
  }

  console.log(`[ci-snapshot] ✅ uploaded snapshot: ${key}`);
  console.log(`[ci-snapshot] ✅ committed metadata`);
}

main().catch((e) => {
  console.error("[ci-snapshot] ❌ failed:", e?.message || e);
  process.exit(1);
});
