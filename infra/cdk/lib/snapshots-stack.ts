// infra/cdk/lib/snapshots-stack.ts

import "dotenv/config";

import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as nodeLambda from "aws-cdk-lib/aws-lambda-nodejs";
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import * as apigwv2Integrations from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as iam from "aws-cdk-lib/aws-iam";

type SnapshotsStackProps = cdk.StackProps & {
  githubPagesOrigin?: string; // optional (legacy)
  stage: "dev" | "prod";
  allowedOrigins: string[];
  ownerToken: string;
  githubDeployerRoleArn?: string;
};

export class SnapshotsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: SnapshotsStackProps) {
    super(scope, id, props);

    // const allowedOrigins = ["http://localhost:3000", "https://rautte.github.io"];
    const allowedOrigins = props.allowedOrigins;

    const githubToken = process.env.GITHUB_TOKEN;

    // -----------------------------
    // 1) Snapshots bucket (JSON snapshots + trash)
    // -----------------------------
    const snapshotsBucketName =
        props.stage === "prod"
            ? "tejas-profile-prod-snapshots-978416150779"
            : "tejas-profile-dev-snapshots-978416150779";

    const repoBucketName =
        props.stage === "prod"
            ? "tejas-profile-prod-repo-zips-978416150779"
            : "tejas-profile-dev-repo-zips-978416150779";

    const snapshotsBucket = new s3.Bucket(this, "SnapshotsBucket", {
        bucketName: snapshotsBucketName,
        removalPolicy: cdk.RemovalPolicy.RETAIN,
        blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
        encryption: s3.BucketEncryption.S3_MANAGED,
        enforceSSL: true,
        versioned: true,
        cors: [
            {
            allowedMethods: [s3.HttpMethods.PUT, s3.HttpMethods.GET, s3.HttpMethods.HEAD],
            allowedOrigins: allowedOrigins,
            allowedHeaders: ["*"],
            exposedHeaders: ["ETag"],
            maxAge: 3000,
            },
        ],
    });

    // -----------------------------
    // 2) Repo bucket (repo ZIP uploads under profiles/*)  ✅ OPTION 2
    // -----------------------------
    const repoBucket = new s3.Bucket(this, "RepoZipsBucket", {
        bucketName: repoBucketName,
        removalPolicy: cdk.RemovalPolicy.RETAIN,
        blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
        encryption: s3.BucketEncryption.S3_MANAGED,
        enforceSSL: true,
        versioned: true,
        cors: [
            {
            allowedMethods: [s3.HttpMethods.PUT, s3.HttpMethods.GET, s3.HttpMethods.HEAD],
            allowedOrigins: allowedOrigins,
            allowedHeaders: ["*"],
            exposedHeaders: ["ETag"],
            maxAge: 3000,
            },
        ],
        // ✅ optional: enable later to control costs
        // lifecycleRules: [
        //   {
        //     prefix: "profiles/",
        //     expiration: cdk.Duration.days(90),
        //   },
        // ],
    });

    // -----------------------------
    // Lambda (API) - presigns URLs + lists + soft deletes
    // -----------------------------
    const fn = new nodeLambda.NodejsFunction(this, "SnapshotsApiHandler", {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: "lambda/snapshots-handler.ts",
      handler: "handler",
      memorySize: 256,
      timeout: cdk.Duration.seconds(12),
      bundling: { minify: true, target: "node18" },
      environment: {
        SNAPSHOTS_BUCKET: snapshotsBucket.bucketName,
        REPO_BUCKET: repoBucket.bucketName,
        DEPLOY_HISTORY_KEY: "deploy/history.json",

        OWNER_TOKEN: props.ownerToken,

        SNAPSHOTS_PREFIX: "snapshots/",
        TRASH_PREFIX: "trash/",
        PROFILES_PREFIX: "profiles/",

        ALLOWED_ORIGINS: allowedOrigins.join(","),
        STAGE: props.stage, // optional, but nice to have

        // GitHub redeploy trigger (owner-only)
        GITHUB_REPO: "rautte/tejas-profile",
        GITHUB_WORKFLOW_FILE: "redeploy.yml",
        GITHUB_REF: "main",

        // ✅ ONLY set if present (prevents wiping prod)
        ...(githubToken ? { GITHUB_TOKEN: githubToken } : {}),
      },
    });

    // -----------------------------
    // S3 permissions (strict + correct)
    // -----------------------------
    snapshotsBucket.grantReadWrite(fn, "snapshots/*");
    snapshotsBucket.grantReadWrite(fn, "trash/*");
    // snapshotsBucket.grantRead(fn, "deploy/*");

    // Allow listing ONLY under snapshots/* and trash/*
    fn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["s3:ListBucket"],
        resources: [snapshotsBucket.bucketArn],
        conditions: {
          StringLike: {
            "s3:prefix": ["snapshots/", "snapshots/*", "trash/", "trash/*"],
          },
        },
      })
    );

    // ✅ FIXED: Copy requires Get/Put (there is no s3:CopyObject)
    fn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["s3:GetObject", "s3:PutObject", "s3:DeleteObject", "s3:DeleteObjectVersion"],
        resources: [
            snapshotsBucket.arnForObjects("snapshots/*"),
            snapshotsBucket.arnForObjects("trash/*"),
        ],
      })
    );

    fn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["s3:GetObject", "s3:PutObject"],
        resources: [snapshotsBucket.arnForObjects("deploy/history.json")],
      })
    );

    fn.addToRolePolicy(
        new iam.PolicyStatement({
            actions: ["s3:ListBucketVersions"],
            resources: [snapshotsBucket.bucketArn],
        })
    );

    // ✅ Repo bucket permissions for Lambda (ONLY presign PUT under profiles/*)
    repoBucket.grantPut(fn, "profiles/*");

    // -----------------------------
    // GitHub Actions deployer role access (repo zip uploads)
    // -----------------------------
    if (props.githubDeployerRoleArn) {
      const githubRole = iam.Role.fromRoleArn(
        this,
        "GitHubDeployerRole",
        props.githubDeployerRoleArn,
        { mutable: true }
      );

      repoBucket.grantPut(githubRole, "profiles/*");
      // Allow GitHub Actions to write deploy history into snapshots bucket
      snapshotsBucket.grantReadWrite(githubRole, "deploy/history.json");
      // or: snapshotsBucket.grantPut(githubRole, "deploy/history.json");

      githubRole.addToPrincipalPolicy(
        new iam.PolicyStatement({
          actions: ["s3:AbortMultipartUpload"],
          resources: [repoBucket.arnForObjects("profiles/*")],
        })
      );
    }

    // -----------------------------
    // API Gateway HTTP API
    // -----------------------------
    const httpApi = new apigwv2.HttpApi(this, "SnapshotsHttpApi", {
      corsPreflight: {
        allowCredentials: false,
        allowHeaders: ["content-type", "x-owner-token"],
        allowMethods: [
          apigwv2.CorsHttpMethod.GET,
          apigwv2.CorsHttpMethod.POST,
          apigwv2.CorsHttpMethod.OPTIONS,
        ],
        allowOrigins: allowedOrigins,
        maxAge: cdk.Duration.days(10),
      },
    });

    const integration = new apigwv2Integrations.HttpLambdaIntegration(
      "SnapshotsLambdaIntegration",
      fn
    );

    httpApi.addRoutes({
      path: "/snapshots/presign-put",
      methods: [apigwv2.HttpMethod.POST],
      integration,
    });

    httpApi.addRoutes({
      path: "/snapshots/list",
      methods: [apigwv2.HttpMethod.GET],
      integration,
    });

    httpApi.addRoutes({
      path: "/snapshots/presign-get",
      methods: [apigwv2.HttpMethod.GET],
      integration,
    });

    httpApi.addRoutes({
      path: "/snapshots/delete",
      methods: [apigwv2.HttpMethod.POST],
      integration,
    });

    httpApi.addRoutes({
      path: "/snapshots/restore",
      methods: [apigwv2.HttpMethod.POST],
      integration,
    });

    // ✅ NEW: repo route
    httpApi.addRoutes({
      path: "/repo/presign-put",
      methods: [apigwv2.HttpMethod.POST],
      integration,
    });

    httpApi.addRoutes({
      path: "/deploy/trigger",
      methods: [apigwv2.HttpMethod.POST],
      integration,
    });

    httpApi.addRoutes({
      path: "/deploy/history",
      methods: [apigwv2.HttpMethod.GET],
      integration,
    });

    httpApi.addRoutes({
      path: "/snapshots/purge",
      methods: [apigwv2.HttpMethod.POST],
      integration,
    });

    httpApi.addRoutes({
        path: "/snapshots/remark",
        methods: [apigwv2.HttpMethod.POST],
        integration,
    });

    httpApi.addRoutes({
        path: "/snapshots/commit-meta",
        methods: [apigwv2.HttpMethod.POST],
        integration,
    });

    new cdk.CfnOutput(this, "SnapshotsApiUrl", { value: httpApi.apiEndpoint });
    new cdk.CfnOutput(this, "SnapshotsBucketName", { value: snapshotsBucket.bucketName });
    new cdk.CfnOutput(this, "RepoBucketName", { value: repoBucket.bucketName });
  }
}
