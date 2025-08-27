#!/usr/bin/env node
// infra/cdk/bin/cdk.ts
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { AssetsCdnStack } from '../lib/assets-cdn-stack';

const app = new cdk.App();

new AssetsCdnStack(app, 'AssetsCdnStack', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: 'us-east-1' },
});
