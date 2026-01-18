// src/utils/profileVersion.js

// CRA build-time injection: these get replaced during `npm start` / `npm run build`
const BUILD_META = {
  id: process.env.REACT_APP_PROFILE_VERSION || "unknown",
  gitSha: process.env.REACT_APP_GIT_SHA || null,
  buildTime: process.env.REACT_APP_BUILD_TIME || null,
  manifestKey: process.env.REACT_APP_PROFILE_MANIFEST_KEY || null,

  // repo identity
  repo: process.env.REACT_APP_REPO || null, // e.g. "rautte/tejas-profile"
  repoUrl: process.env.REACT_APP_REPO_URL || null, // optional if you add later
  repoRef: process.env.REACT_APP_REPO_REF || process.env.REACT_APP_GIT_REF || null,

  // CI/build metadata (optional)
  ghRunId: process.env.REACT_APP_GH_RUN_ID || null,
  checkpointTag: process.env.REACT_APP_CHECKPOINT_TAG || null,

  // optional repo zip artifact metadata (future)
  artifactUrl: process.env.REACT_APP_REPO_ARTIFACT_URL || null,
  artifactKey: process.env.REACT_APP_REPO_ARTIFACT_KEY || null,
  artifactSha256: process.env.REACT_APP_REPO_ARTIFACT_SHA256 || null,
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
    gitSha: meta.gitSha || null,
    buildTime: meta.buildTime || null,
    sections: meta.sections || null,
    manifestKey: meta.manifestKey || null,

    repo: {
      provider: "github",
      repo: meta.repo || meta.repoUrl || null, // ✅ this is the important part
      commit: meta.gitSha || null,
      ref: meta.repoRef || null,
      buildRunId: meta.ghRunId || null,
      checkpointTag: meta.checkpointTag || null,
      artifactUrl: meta.artifactUrl || null,
      artifactKey: meta.artifactKey || null,
      artifactSha256: meta.artifactSha256 || null,
    },
  };
}
