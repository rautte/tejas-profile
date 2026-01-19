// infra/cdk/bin/cdk.ts
import "dotenv/config";
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { AssetsCdnStack } from "../lib/assets-cdn-stack";
import { SnapshotsStack } from "../lib/snapshots-stack";

const app = new cdk.App();

new AssetsCdnStack(app, "AssetsCdnStack", {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
});

const ownerToken = process.env.OWNER_TOKEN;
const githubDeployerRoleArn = process.env.GITHUB_DEPLOYER_ROLE_ARN || "";

if (!ownerToken) {
  // Don't crash synth/bootstrap. Just skip Snapshots stack.
  console.warn("OWNER_TOKEN missing -> skipping TejasProfileSnapshotsStack");
} else {
  new SnapshotsStack(app, "TejasProfileSnapshotsStack", {
    env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: "us-east-1" },
    githubPagesOrigin: "https://rautte.github.io",
    ownerToken,
    githubDeployerRoleArn: githubDeployerRoleArn || undefined,
  });
}
