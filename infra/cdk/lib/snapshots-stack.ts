// infra/cdk/lib/snapshots-stack.ts

import "dotenv/config";

import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as nodeLambda from "aws-cdk-lib/aws-lambda-nodejs";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import * as apigwv2Integrations from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as cloudfrontOrigins from "aws-cdk-lib/aws-cloudfront-origins";
import * as crypto from "node:crypto";
import * as iam from "aws-cdk-lib/aws-iam";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";

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

    const analyticsEdgeToken =
      crypto
        .createHash("sha256")
        .update(
          `analytics-edge:${props.stage}:${props.ownerToken}`
        )
        .digest("hex");

    const githubTokenSecretName =
      `tejas-profile/${props.stage}/github-token`;

    const githubTokenSecret =
      secretsmanager.Secret.fromSecretNameV2(
        this,
        "GithubTokenSecret",
        githubTokenSecretName
      );

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

    const analyticsEventsBucket = new s3.Bucket(this, "AnalyticsEventsBucket", {
        blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
        encryption: s3.BucketEncryption.S3_MANAGED,
        enforceSSL: true,
        removalPolicy: props.stage === "prod" ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
        autoDeleteObjects: props.stage === "prod" ? false : true,

        lifecycleRules: [
            {
            enabled: true,
            expiration: cdk.Duration.days(30), // ✅ raw retention 30 days
            prefix: "analytics-events/",
            },
        ],
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

        // Secret value is NOT stored in Lambda env / CloudFormation.
        GITHUB_TOKEN_SECRET_ID:
          githubTokenSecret.secretName,

      },
    });

    const analyticsTable = new dynamodb.Table(this, "AnalyticsDailyAggTable", {
        partitionKey: { name: "pk", type: dynamodb.AttributeType.STRING }, // DAY#YYYY-MM-DD
        sortKey: { name: "sk", type: dynamodb.AttributeType.STRING },      // PV#<profileVersionId>
        billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
        removalPolicy: props.stage === "prod" ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    const analyticsFn = new nodeLambda.NodejsFunction(this, "AnalyticsApiHandler", {
        runtime: lambda.Runtime.NODEJS_18_X,
        entry: "lambda/analytics-handler.ts",
        handler: "handler",
        memorySize: 256,
        timeout: cdk.Duration.seconds(12),
        bundling: { minify: true, target: "node18" },
        environment: {
            ANALYTICS_EVENTS_BUCKET: analyticsEventsBucket.bucketName,
            ANALYTICS_TABLE: analyticsTable.tableName,

            OWNER_TOKEN: props.ownerToken,
            ANALYTICS_EDGE_TOKEN: analyticsEdgeToken,
            ALLOWED_ORIGINS: allowedOrigins.join(","),
            STAGE: props.stage,
        },
    });

    githubTokenSecret.grantRead(fn);

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

    // ✅ Repo bucket permissions for Lambda
    // - presign PUT needs PutObject on profiles/*
    // - trash/restore/purge needs Get/Put/Delete + ListBucket + ListBucketVersions on repo bucket
    repoBucket.grantPut(fn, "profiles/*");

    // Allow Lambda to manage repo artifacts lifecycle too (profiles/* <-> trash/*)
    repoBucket.grantReadWrite(fn, "profiles/*");
    repoBucket.grantReadWrite(fn, "trash/*");

    // Allow listing ONLY under profiles/* and trash/*
    fn.addToRolePolicy(
    new iam.PolicyStatement({
        actions: ["s3:ListBucket"],
        resources: [repoBucket.bucketArn],
        conditions: {
        StringLike: {
            "s3:prefix": ["profiles/", "profiles/*", "trash/", "trash/*"],
        },
        },
    })
    );

    // Needed to delete all versions + delete markers in the versioned repo bucket during purge
    fn.addToRolePolicy(
    new iam.PolicyStatement({
        actions: ["s3:ListBucketVersions"],
        resources: [repoBucket.bucketArn],
    })
    );

    // Needed to purge versions
    fn.addToRolePolicy(
    new iam.PolicyStatement({
        actions: ["s3:DeleteObject", "s3:DeleteObjectVersion"],
        resources: [
        repoBucket.arnForObjects("profiles/*"),
        repoBucket.arnForObjects("trash/*"),
        ],
    })
    );

    analyticsEventsBucket.grantPut(analyticsFn, "analytics-events/*");
    analyticsTable.grantReadWriteData(analyticsFn);


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

      // Allow the canonical PROD release workflow to resolve this
      // stack's public runtime outputs (SnapshotsApiUrl,
      // AnalyticsEdgeUrl, etc.) without hardcoded URLs/secrets.
      githubRole.addToPrincipalPolicy(
        new iam.PolicyStatement({
          actions: [
            "cloudformation:DescribeStacks",
          ],

          resources: [
            this.formatArn({
              service:
                "cloudformation",

              resource:
                "stack",

              resourceName:
                `${this.stackName}/*`,

              arnFormat:
                cdk.ArnFormat
                  .SLASH_RESOURCE_NAME,
            }),
          ],
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

    const analyticsIntegration = new apigwv2Integrations.HttpLambdaIntegration(
        "AnalyticsLambdaIntegration",
        analyticsFn
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
        path: "/repo/presign-get",
        methods: [apigwv2.HttpMethod.GET],
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

    httpApi.addRoutes({
        path: "/analytics/ingest",
        methods: [apigwv2.HttpMethod.POST],
        integration: analyticsIntegration,
    });

    httpApi.addRoutes({
        path: "/analytics/query",
        methods: [apigwv2.HttpMethod.GET],
        integration: analyticsIntegration,
    });

    httpApi.addRoutes({
      path: "/analytics/meta",
      methods: [
        apigwv2.HttpMethod.GET,
      ],
      integration:
        analyticsIntegration,
    });

    httpApi.addRoutes({
      path: "/analytics/releases",
      methods: [
        apigwv2.HttpMethod.POST,
      ],
      integration:
        analyticsIntegration,
    });

    httpApi.addRoutes({
      path: "/analytics/boundaries",
      methods: [
        apigwv2.HttpMethod.POST,
      ],
      integration:
        analyticsIntegration,
    });

    const httpApiDomain =
      cdk.Fn.select(
        2,
        cdk.Fn.split(
          "/",
          httpApi.apiEndpoint
        )
      );

    const analyticsEdgeOrigin =
      new cloudfrontOrigins.HttpOrigin(
        httpApiDomain,
        {
          protocolPolicy:
            cloudfront.OriginProtocolPolicy.HTTPS_ONLY,

          customHeaders: {
            "x-analytics-edge-token":
              analyticsEdgeToken,
          },
        }
      );

    const analyticsEdge =
      new cloudfront.Distribution(
        this,
        "AnalyticsEdgeDistribution",
        {
          comment:
            `tejas-profile-${props.stage}-analytics-edge`,

          defaultBehavior: {
            origin:
              analyticsEdgeOrigin,

            viewerProtocolPolicy:
              cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,

            allowedMethods:
              cloudfront.AllowedMethods.ALLOW_ALL,

            cachePolicy:
              cloudfront.CachePolicy.CACHING_DISABLED,

            originRequestPolicy:
              cloudfront.OriginRequestPolicy
                .ALL_VIEWER_EXCEPT_HOST_HEADER,

            compress: false,
          },
        }
      );

    new cdk.CfnOutput(this, "SnapshotsApiUrl", { value: httpApi.apiEndpoint });
    new cdk.CfnOutput(this, "SnapshotsBucketName", { value: snapshotsBucket.bucketName });
    new cdk.CfnOutput(this, "RepoBucketName", { value: repoBucket.bucketName });

    new cdk.CfnOutput(
      this,
      "AnalyticsEdgeUrl",
      {
        value:
          `https://${analyticsEdge.distributionDomainName}`,
      }
    );

    new cdk.CfnOutput(
      this,
      "AnalyticsEventsBucketName",
      {
        value:
          analyticsEventsBucket.bucketName,
      }
    );
  }
}
