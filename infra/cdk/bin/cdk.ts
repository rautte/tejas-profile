// infra/cdk/bin/cdk.ts

import "dotenv/config";
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { AssetsCdnStack } from "../lib/assets-cdn-stack";
import { FrontendCdnStack } from "../lib/frontend-cdn-stack";
import { SnapshotsStack } from "../lib/snapshots-stack";

const app = new cdk.App();

// Tags every resource in every stack. This is a prerequisite for
// AWS Cost Allocation Tags (Billing console) to be able to break
// project cost down by stage (dev vs prod) -- see the admin Usage
// page's console-setup instructions.
cdk.Tags.of(app).add("project", "tejas-profile");

const assetEnv = {
  account:
    process.env.CDK_DEFAULT_ACCOUNT,

  region:
    process.env.CDK_DEFAULT_REGION,
};


// Existing stack identity is preserved and explicitly becomes PROD.
const assetsCdnStackProd =
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

cdk.Tags.of(assetsCdnStackProd).add("stage", "prod");


// New, isolated DEV asset environment.
const assetsCdnStackDev =
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

cdk.Tags.of(assetsCdnStackDev).add("stage", "dev");


// Dedicated DEV application hosting.
//
// This is intentionally separate from AssetsCdnStackDev.
// Heavy/media assets and the built React application have
// different publication and lifecycle boundaries.
const devFrontendStack =
  new FrontendCdnStack(
    app,
    "FrontendCdnStackDev",
    {
      env:
        assetEnv,

      stage:
        "dev",
    }
  );

cdk.Tags.of(devFrontendStack).add("stage", "dev");


const githubDeployerRoleArn =
  process.env.GITHUB_DEPLOYER_ROLE_ARN || "";

// Runtime credentials are resolved from stage-specific
// Secrets Manager identities by SnapshotsStack.
//
// Infrastructure synthesis must never require or load
// the owner credential itself.
const snapshotsStackProd =
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

cdk.Tags.of(snapshotsStackProd).add("stage", "prod");


// DEV remains physically and origin-isolated from PROD.
const snapshotsStackDev =
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
        devFrontendStack.frontendOrigin,
      ],
    }
  );

cdk.Tags.of(snapshotsStackDev).add("stage", "dev");
