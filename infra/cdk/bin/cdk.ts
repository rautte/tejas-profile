#!/usr/bin/env node
// infra/cdk/bin/cdk.ts

import "dotenv/config";
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { AssetsCdnStack } from "../lib/assets-cdn-stack";
import { SnapshotsStack } from "../lib/snapshots-stack";

const app = new cdk.App();

new AssetsCdnStack(app, "AssetsCdnStack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});

const isDev = process.env.NODE_ENV !== "production";

const githubDeployerRoleArn = process.env.GITHUB_DEPLOYER_ROLE_ARN || "";

// ✅ Only synth/deploy SnapshotsStack when OWNER_TOKEN exists.
// This prevents `cdk bootstrap` from failing in CI when secrets are missing/misnamed.
const ownerToken = process.env.OWNER_TOKEN;

if (!ownerToken) {
  // eslint-disable-next-line no-console
  console.warn("⚠️ OWNER_TOKEN missing -> skipping TejasProfileSnapshotsStack");
} else {
  new SnapshotsStack(app, "TejasProfileSnapshotsStack", {
    env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: "us-east-1" },
    githubPagesOrigin: isDev ? "http://localhost:3000" : "https://rautte.github.io",
    ownerToken,
    githubDeployerRoleArn: githubDeployerRoleArn || undefined,
  });
}
