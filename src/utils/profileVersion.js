// src/utils/profileVersion.js

function nonEmpty(s) {
  const v = String(s || "").trim();
  return v.length ? v : "";
}

function computeCheckpointTag(meta) {
  const explicit = nonEmpty(meta.checkpointTag);
  if (explicit && explicit !== "unknown") return explicit;

  const runId = nonEmpty(meta.ghRunId);
  if (runId && runId !== "unknown") return `run_${runId}`;

  const sha = nonEmpty(meta.gitSha);
  if (sha && sha !== "unknown") return `sha_${sha.slice(0, 7)}`;

  const pv = nonEmpty(meta.id);
  if (pv && pv !== "unknown") return pv;

  return "local";
}

function nullIfEmptyOrUnknown(s) {
  const v = String(s || "").trim();
  if (!v || v.toLowerCase() === "unknown") return null;
  return v;
}

// CRA build-time injection: these get replaced during `npm start` / `npm run build`
// CRA build-time injection: these get replaced during `npm start` / `npm run build`
const BUILD_META = {
  id: nullIfEmptyOrUnknown(process.env.REACT_APP_PROFILE_VERSION) || "unknown",
  gitSha: nullIfEmptyOrUnknown(process.env.REACT_APP_GIT_SHA),
  buildTime: nullIfEmptyOrUnknown(process.env.REACT_APP_BUILD_TIME),
  manifestKey: nullIfEmptyOrUnknown(process.env.REACT_APP_PROFILE_MANIFEST_KEY),

  // repo identity
  repo: nullIfEmptyOrUnknown(process.env.REACT_APP_REPO), // e.g. "rautte/tejas-profile"
  repoUrl: nullIfEmptyOrUnknown(process.env.REACT_APP_REPO_URL), // optional if you add later
  repoRef: nullIfEmptyOrUnknown(process.env.REACT_APP_REPO_REF) || nullIfEmptyOrUnknown(process.env.REACT_APP_GIT_REF),

  // CI/build metadata (optional)
  ghRunId: nullIfEmptyOrUnknown(process.env.REACT_APP_GH_RUN_ID),
  checkpointTag: nullIfEmptyOrUnknown(process.env.REACT_APP_CHECKPOINT_TAG),

  // optional repo zip artifact metadata (future)
  artifactUrl: nullIfEmptyOrUnknown(process.env.REACT_APP_REPO_ARTIFACT_URL),
  artifactKey: nullIfEmptyOrUnknown(process.env.REACT_APP_REPO_ARTIFACT_KEY),
  artifactSha256: nullIfEmptyOrUnknown(process.env.REACT_APP_REPO_ARTIFACT_SHA256),
};

// Optional: expose for debugging
try {
  if (typeof window !== "undefined") {
    window.__PROFILE_BUILD_META__ = window.__PROFILE_BUILD_META__ || BUILD_META;
  }
} catch (_) {}

export function readBuildProfileVersion() {
  const winMeta =
    typeof window !== "undefined" ? window.__PROFILE_BUILD_META__ : null;

  const meta =
    winMeta && typeof winMeta === "object"
      ? { ...BUILD_META, ...winMeta }
      : BUILD_META;

  return {
    id: meta.id || "unknown",
    gitSha: nullIfEmptyOrUnknown(meta.gitSha),
    buildTime: nullIfEmptyOrUnknown(meta.buildTime),
    sections: meta.sections || null,
    manifestKey: nullIfEmptyOrUnknown(meta.manifestKey),

    repo: {
      provider: "github",
      repo: nullIfEmptyOrUnknown(meta.repo) || nullIfEmptyOrUnknown(meta.repoUrl), // ✅ this is the important part
      commit: nullIfEmptyOrUnknown(meta.gitSha),
      ref: nullIfEmptyOrUnknown(meta.repoRef),
      buildRunId: nullIfEmptyOrUnknown(meta.ghRunId),
      checkpointTag: computeCheckpointTag(meta),
    //   artifactUrl: nullIfEmptyOrUnknown(meta.artifactUrl),
      artifactKey: nullIfEmptyOrUnknown(meta.artifactKey),
      artifactSha256: nullIfEmptyOrUnknown(meta.artifactSha256),

    },
  };
}
