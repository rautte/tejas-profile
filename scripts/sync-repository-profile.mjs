// scripts/sync-repository-profile.mjs
//
// Keeps src/profile/content/activeSnapshot.json in sync with
// whatever Profile Variant is currently ACTIVE in the target stage
// (PROD by default; pass --stage=dev to sync against DEV instead).
//
// Why this exists:
//
// The app always renders the repository's built-in fallback
// content on first paint (so the site is never blank while the
// Active Profile API resolves), then swaps in the real active
// content once that fetch completes. If the repository fallback
// and the active content differ, that swap is visibly a content
// "flash" -- most noticeable right after activating a new Profile
// Variant with different data/section order.
//
// Running this script (and committing the resulting snapshot)
// makes the fallback identical to what's actually live, so the
// swap becomes invisible even though it still technically happens.
//
// This does NOT change authoring behavior: src/data/* remain the
// last-resort fallback if this snapshot is ever missing or fails
// validation (see buildProfileContent.js).
//
// Usage:
//   node scripts/sync-repository-profile.mjs             # PROD (default)
//   node scripts/sync-repository-profile.mjs --stage=dev  # DEV
//   STAGE=dev node scripts/sync-repository-profile.mjs    # DEV (env var form)
//
// Note: this writes ONE shared snapshot file used by every build
// (npm start, DEV deploy, PROD deploy) -- whichever stage you last
// synced from is what every environment's fallback will show until
// you sync again. Sync against whichever stage you're actively
// testing against.

import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const AWS_REGION =
  process.env.AWS_REGION ||
  process.env.AWS_DEFAULT_REGION ||
  "us-east-1";

const STAGE = (() => {
  const flag = process.argv.find((arg) => arg.startsWith("--stage="));
  const fromFlag = flag ? flag.slice("--stage=".length).trim() : "";
  const value = (fromFlag || process.env.STAGE || "prod").toLowerCase();

  if (value !== "prod" && value !== "dev") {
    throw new Error(`Invalid --stage "${value}" -- must be "prod" or "dev".`);
  }

  return value;
})();

const STACK_NAME =
  process.env.STACK_NAME ||
  (STAGE === "dev"
    ? "TejasProfileSnapshotsStackDev"
    : "TejasProfileSnapshotsStackProd");

const AWS_PROFILE =
  process.env.AWS_PROFILE ||
  "";

const OUTPUT_PATH = path.join(
  __dirname,
  "..",
  "src",
  "profile",
  "content",
  "activeSnapshot.json"
);

function resolveActiveProfileApiUrl() {
  const explicit = (process.env.ACTIVE_PROFILE_API || "").trim();
  if (explicit) {
    return explicit;
  }

  const args = [
    "cloudformation",
    "describe-stacks",
    "--stack-name",
    STACK_NAME,
    "--region",
    AWS_REGION,
    "--query",
    "Stacks[0].Outputs[?OutputKey=='ActiveProfileApiUrl'].OutputValue | [0]",
    "--output",
    "text",
  ];

  if (AWS_PROFILE) {
    args.push("--profile", AWS_PROFILE);
  }

  const url = execFileSync("aws", args, { encoding: "utf8" }).trim();

  if (!url || url === "None") {
    throw new Error(
      `Unable to resolve ActiveProfileApiUrl from stack "${STACK_NAME}". ` +
        "Is your AWS SSO session active?"
    );
  }

  return url;
}

async function main() {
  console.log(`Syncing repository fallback from ${STAGE.toUpperCase()} (${STACK_NAME}) ...`);

  const apiUrl = resolveActiveProfileApiUrl();

  console.log(`Fetching active profile from ${apiUrl} ...`);

  const response = await fetch(apiUrl, {
    method: "GET",
    headers: { accept: "application/json" },
  });

  const body = await response.json().catch(() => null);

  if (!response.ok || body?.ok !== true) {
    throw new Error(
      `Active Profile API request failed (${response.status}): ${
        body?.error || "unknown error"
      }`
    );
  }

  const variant = body?.variant;
  const content = variant?.content;

  if (!variant || !content || typeof content !== "object") {
    console.log(
      `No active Profile Variant in ${STAGE.toUpperCase()} right now -- nothing to sync. ` +
        "The repository will keep using its hand-authored fallback content."
    );
    return;
  }

  const snapshot = {
    syncedAt: new Date().toISOString(),
    profileVariantId: variant.profileVariantId,
    contentSchemaVersion: variant.contentSchemaVersion,
    content,
  };

  writeFileSync(
    OUTPUT_PATH,
    `${JSON.stringify(snapshot, null, 2)}\n`,
    "utf8"
  );

  console.log(
    `Synced repository fallback to Profile Variant "${variant.profileVariantId}".`
  );
  console.log(`Wrote ${path.relative(process.cwd(), OUTPUT_PATH)}`);
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exitCode = 1;
});
