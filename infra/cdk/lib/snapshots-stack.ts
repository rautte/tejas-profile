import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as nodeLambda from "aws-cdk-lib/aws-lambda-nodejs";
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import * as apigwv2Integrations from "aws-cdk-lib/aws-apigatewayv2-integrations";

type SnapshotsStackProps = cdk.StackProps & {
  githubPagesOrigin: string; // kept for compatibility
  ownerToken: string;
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
            allowedOrigins: [
                "http://localhost:3000",
                "https://rautte.github.io",
            ],
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
        SNAPSHOTS_PREFIX: "snapshots/",
        // comma-separated allowlist
        ALLOWED_ORIGINS: allowedOrigins.join(","),
      },
    });

    // Allow read/write ONLY under snapshots/
    bucket.grantReadWrite(fn, "snapshots/*");

    // Allow listing ONLY objects under snapshots/
    bucket.addToResourcePolicy(
        new cdk.aws_iam.PolicyStatement({
            actions: ["s3:ListBucket"],
            resources: [bucket.bucketArn],
            principals: [fn.grantPrincipal],
            conditions: {
            StringLike: {
                "s3:prefix": ["snapshots/*"],
            },
            },
        })
    );

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
