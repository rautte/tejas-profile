// scripts/publish-ci-snapshot.mjs
// Publishes a snapshot after successful Pages deploy (server-to-server)

function reqEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function shortSha(sha) {
  return String(sha || "").slice(0, 7) || "unknown";
}

function utcDateString(d = new Date()) {
  // YYYY-MM-DD in UTC
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

async function main() {
  const SNAPSHOTS_API = reqEnv("SNAPSHOTS_API").replace(/\/$/, "");
  const OWNER_TOKEN = reqEnv("OWNER_TOKEN");
  const STAGE = process.env.STAGE || "prod"; // dev|prod (for metadata only)

  const sha = process.env.GITHUB_SHA || "unknown";
  const runId = process.env.GITHUB_RUN_ID || "unknown";
  const runAttempt = process.env.GITHUB_RUN_ATTEMPT || "1";

  const from = utcDateString();
  const to = utcDateString();
  const createdAt = new Date().toISOString();

  const checkpointTag = `gha_${runId}_a${runAttempt}`;
  const profileVersionId = `pv_${shortSha(sha)}`;

  // ✅ This is the JSON we store as the snapshot payload.
  // Keep it lightweight + stable. You can extend later.
  const snapshotPayload = {
    kind: "ci_deploy_snapshot",
    stage: STAGE,
    createdAt,
    notes: "Auto-published after successful GitHub Pages deploy",
    github: {
      repo: process.env.GITHUB_REPOSITORY || null,
      runId,
      runAttempt,
      workflow: process.env.GITHUB_WORKFLOW || null,
      actor: process.env.GITHUB_ACTOR || null,
      ref: process.env.GITHUB_REF || null,
      sha,
    },
    profileVersion: {
      id: profileVersionId,
      gitSha: sha,
      buildTime: createdAt,
      repo: {
        provider: "github",
        repo: process.env.GITHUB_REPOSITORY || null,
        commit: sha,
        ref: process.env.GITHUB_REF_NAME || null,
        buildRunId: runId,
        checkpointTag,
      },
    },
  };

  // 1) presign PUT
  const presignRes = await fetch(`${SNAPSHOTS_API}/snapshots/presign-put`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-owner-token": OWNER_TOKEN,
    },
    body: JSON.stringify({
      from,
      to,
      name: "analytics",              // keep same table bucket/path shape
      createdAt,
      category: "ci",
      tagKey: "stage",
      tagValue: STAGE,

      // ✅ these map to your S3 object metadata columns
      profileVersionId,
      gitSha: sha,
      checkpointTag,
    }),
  });

  const presignJson = await presignRes.json().catch(() => ({}));
  if (!presignRes.ok || !presignJson.ok) {
    throw new Error(`presign-put failed: ${presignJson.error || presignRes.status}`);
  }

  // 2) upload snapshot JSON to S3 presigned URL
  const putRes = await fetch(presignJson.url, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(snapshotPayload, null, 2),
  });

  if (!putRes.ok) {
    throw new Error(`S3 PUT failed: ${putRes.status}`);
  }

  console.log("✅ Published CI snapshot:", presignJson.key);
}

main().catch((e) => {
  console.error("❌ publish-ci-snapshot failed:", e?.message || e);
  process.exit(1);
});
