// infra/cdk/bin/cdk.ts

import "dotenv/config";
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { AssetsCdnStack } from "../lib/assets-cdn-stack";
import { SnapshotsStack } from "../lib/snapshots-stack";

const app = new cdk.App();

const assetEnv = {
  account:
    process.env.CDK_DEFAULT_ACCOUNT,

  region:
    process.env.CDK_DEFAULT_REGION,
};


// Existing stack identity is preserved and explicitly becomes PROD.
new AssetsCdnStack(
  app,
  "AssetsCdnStack",
  {
    env:
      assetEnv,

    stage:
      "prod",
  }
);


// New, isolated DEV asset environment.
new AssetsCdnStack(
  app,
  "AssetsCdnStackDev",
  {
    env:
      assetEnv,

    stage:
      "dev",
  }
);

const githubDeployerRoleArn =
  process.env.GITHUB_DEPLOYER_ROLE_ARN || "";

// Runtime credentials are resolved from stage-specific
// Secrets Manager identities by SnapshotsStack.
//
// Infrastructure synthesis must never require or load
// the owner credential itself.
new SnapshotsStack(
  app,
  "TejasProfileSnapshotsStackProd",
  {
    env: {
      account:
        process.env.CDK_DEFAULT_ACCOUNT,

      region:
        "us-east-1",
    },

    stage:
      "prod",

    allowedOrigins: [
      "https://rautte.github.io",
    ],

    githubDeployerRoleArn:
      githubDeployerRoleArn ||
      undefined,
  }
);


// DEV remains physically and origin-isolated from PROD.
new SnapshotsStack(
  app,
  "TejasProfileSnapshotsStackDev",
  {
    env: {
      account:
        process.env.CDK_DEFAULT_ACCOUNT,

      region:
        "us-east-1",
    },

    stage:
      "dev",

    allowedOrigins: [
      "http://localhost:3000",
    ],
  }
);
