// infra/cdk/lib/snapshots-stack.ts

import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as nodeLambda from "aws-cdk-lib/aws-lambda-nodejs";
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import * as apigwv2Integrations from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as iam from "aws-cdk-lib/aws-iam";

type SnapshotsStackProps = cdk.StackProps & {
  githubPagesOrigin: string; // kept for compatibility (not used directly now)
  ownerToken: string;

  /**
   * Optional: existing GitHub OIDC role ARN that your Actions uses
   * e.g. arn:aws:iam::978416150779:role/tejas-profile-github-deployer
   */
  githubDeployerRoleArn?: string;
};

export class SnapshotsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: SnapshotsStackProps) {
    super(scope, id, props);

    // Allow both local dev + GitHub Pages
    const allowedOrigins = ["http://localhost:3000", "https://rautte.github.io"];

    const bucket = new s3.Bucket(this, "TejasProfileSnapshotsBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: true,

      // ✅ IMPORTANT: allow browser PUT/GET to presigned URLs
      cors: [
        {
          allowedMethods: [
            s3.HttpMethods.PUT,
            s3.HttpMethods.GET,
            s3.HttpMethods.HEAD,
          ],
          allowedOrigins,
          allowedHeaders: ["*"],
          exposedHeaders: ["ETag"],
          maxAge: 3000,
        },
      ],
    });

    const fn = new nodeLambda.NodejsFunction(this, "SnapshotsApiHandler", {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: "lambda/snapshots-handler.ts",
      handler: "handler",
      memorySize: 256,
      timeout: cdk.Duration.seconds(12),
      bundling: {
        minify: true,
        target: "node18",
      },
      environment: {
        SNAPSHOTS_BUCKET: bucket.bucketName,
        OWNER_TOKEN: props.ownerToken,

        // Active snapshots live here
        SNAPSHOTS_PREFIX: "snapshots/",

        // Soft-deleted snapshots live here (recoverable)
        TRASH_PREFIX: "trash/",

        // comma-separated allowlist
        ALLOWED_ORIGINS: allowedOrigins.join(","),
      },
    });

    // -----------------------------
    // S3 permissions (strict + correct)
    // -----------------------------

    // Read/write ONLY objects under snapshots/ and trash/
    bucket.grantReadWrite(fn, "snapshots/*");
    bucket.grantReadWrite(fn, "trash/*");

    // Allow listing ONLY under snapshots/* and trash/* (ListBucket is bucket-level)
    fn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["s3:ListBucket"],
        resources: [bucket.bucketArn],
        conditions: {
          StringLike: {
            "s3:prefix": ["snapshots/*", "trash/*"],
          },
        },
      })
    );

    // Allow copy + delete (used to move objects snapshots <-> trash)
    fn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["s3:CopyObject", "s3:DeleteObject", "s3:DeleteObjectVersion", "s3:GetObject"],
        resources: [bucket.arnForObjects("*")],
      })
    );

    // -----------------------------
    // ✅ GitHub Actions deployer role access (for repo zip uploads)
    // -----------------------------
    // Your workflow uploads repo snapshots to:
    //   s3://<bucket>/profiles/<profileVersion>/repo/<zip>
    //
    // So the GitHub OIDC role must be able to PutObject under profiles/*
    // (Lambda does NOT need this access.)
    if (props.githubDeployerRoleArn) {
      const githubRole = iam.Role.fromRoleArn(
        this,
        "GitHubDeployerRole",
        props.githubDeployerRoleArn,
        { mutable: false } // don't try to edit the role inline (it's managed elsewhere)
      );

      // Upload permission (minimum)
      bucket.grantPut(githubRole, "profiles/*");

      // Optional but recommended for failed multipart uploads cleanup:
      githubRole.addToPrincipalPolicy(
        new iam.PolicyStatement({
          actions: ["s3:AbortMultipartUpload"],
          resources: [bucket.arnForObjects("profiles/*")],
        })
      );

      // Optional: if later you want the role to verify/download artifacts
      // bucket.grantRead(githubRole, "profiles/*");
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

    new cdk.CfnOutput(this, "SnapshotsApiUrl", { value: httpApi.apiEndpoint });
    new cdk.CfnOutput(this, "SnapshotsBucketName", { value: bucket.bucketName });
  }
}

