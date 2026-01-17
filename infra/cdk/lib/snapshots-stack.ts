// infra/cdk/lib/snapshots-stack.ts

import * as path from "path";
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as nodeLambda from "aws-cdk-lib/aws-lambda-nodejs";
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import * as apigwv2Integrations from "aws-cdk-lib/aws-apigatewayv2-integrations";

type SnapshotsStackProps = cdk.StackProps & {
  githubPagesOrigin: string; // e.g. https://rautte.github.io OR http://localhost:3000
  ownerToken: string; // deterrent token (owner mode)
};

export class SnapshotsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: SnapshotsStackProps) {
    super(scope, id, props);

    const bucket = new s3.Bucket(this, "TejasProfileSnapshotsBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: true,
      // removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // ✅ IMPORTANT:
    // Use an absolute path so bundling can't accidentally produce an empty index.js
    const handlerEntry = path.join(__dirname, "..", "lambda", "snapshots-handler.ts");

    const fn = new nodeLambda.NodejsFunction(this, "SnapshotsApiHandler", {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: handlerEntry,
      handler: "handler",
      memorySize: 256,
      timeout: cdk.Duration.seconds(12),
      bundling: {
        minify: true,
        target: "node18",
        // ✅ force CommonJS so Lambda can always find exports.handler
        format: nodeLambda.OutputFormat.CJS,
      },
      environment: {
        SNAPSHOTS_BUCKET: bucket.bucketName,
        ALLOWED_ORIGIN: "*",
        OWNER_TOKEN: props.ownerToken,
        SNAPSHOTS_PREFIX: "snapshots/",
      },
    });

    // ✅ Least privilege:
    // - List requires bucket-level permission
    // - Read/Write objects only under snapshots/*
    bucket.grantRead(fn); // includes ListBucket + GetObject
    bucket.grantReadWrite(fn, "snapshots/*"); // put/get/delete only under snapshots/*

    const allowedOrigins = [
        "http://localhost:3000",
        "https://rautte.github.io",
    ];

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

    new cdk.CfnOutput(this, "SnapshotsApiUrl", {
      value: httpApi.apiEndpoint,
    });

    new cdk.CfnOutput(this, "SnapshotsBucketName", {
      value: bucket.bucketName,
    });
  }
}
