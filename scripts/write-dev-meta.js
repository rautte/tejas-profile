const { execSync } = require("child_process");
const fs = require("fs");

function sh(cmd) {
  return execSync(cmd, { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
}

let shaShort = "unknown";
let shaFull = "";
try {
  shaFull = sh("git rev-parse HEAD");
  shaShort = sh("git rev-parse --short HEAD");
} catch {}

const out =
`# auto-generated (do not edit)
REACT_APP_PROFILE_VERSION=dev_${shaShort}
REACT_APP_GIT_SHA=${shaFull}
REACT_APP_BUILD_TIME=${new Date().toISOString()}
REACT_APP_CHECKPOINT_TAG=local_${Date.now()}
`;

fs.writeFileSync(".env.development.local", out);
console.log("✅ wrote .env.development.local:\n" + out);
