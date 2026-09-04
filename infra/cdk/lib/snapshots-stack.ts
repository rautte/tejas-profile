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
import * as iam from "aws-cdk-lib/aws-iam";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import * as events from "aws-cdk-lib/aws-events";
import * as eventTargets from "aws-cdk-lib/aws-events-targets";

type SnapshotsStackProps =
  cdk.StackProps & {
    stage:
      "dev" |
      "prod";

    allowedOrigins:
      string[];

    githubDeployerRoleArn?:
      string;
  };


export class SnapshotsStack extends cdk.Stack {
  constructor(
    scope:
      Construct,

    id:
      string,

    props:
      SnapshotsStackProps
  ) {
    super(
      scope,
      id,
      props
    );


    const allowedOrigins =
      props.allowedOrigins;


    const ownerTokenSecretName =
      `tejas-profile/${props.stage}/owner-token`;


    const ownerTokenSecret =
      secretsmanager.Secret
        .fromSecretNameV2(
          this,
          "OwnerTokenSecret",
          ownerTokenSecretName
        );


    const ownerSessionSigningKeySecretName =
      `tejas-profile/${props.stage}/owner-session-signing-key`;


    const ownerSessionSigningKeySecret =
      secretsmanager.Secret
        .fromSecretNameV2(
          this,
          "OwnerSessionSigningKeySecret",
          ownerSessionSigningKeySecretName
        );


    const analyticsEdgeTokenSecretName =
      `tejas-profile/${props.stage}/analytics-edge-token`;


    const analyticsEdgeTokenSecret =
      secretsmanager.Secret
        .fromSecretNameV2(
          this,
          "AnalyticsEdgeTokenSecret",
          analyticsEdgeTokenSecretName
        );


    // Separate from ownerTokenSecret (the CI/machine master
    // credential, used directly as x-owner-token). This is the
    // human login passcode, rotatable from Settings via an
    // email-verified change flow -- CI/CD never sees or uses it.
    const ownerLoginPasscodeSecretName =
      `tejas-profile/${props.stage}/owner-login-passcode`;


    const ownerLoginPasscodeSecret =
      secretsmanager.Secret
        .fromSecretNameV2(
          this,
          "OwnerLoginPasscodeSecret",
          ownerLoginPasscodeSecretName
        );


    // Same address for DEV and PROD -- one owner, one inbox.
    // Also the verified SES sending identity (sandbox mode requires
    // both sides of a send to be verified; using one address for
    // both sidesteps needing SES production access).
    const ownerNotificationEmail =
      "tejasraut197@outlook.com";


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

    const profileVariantsBucketName =
        props.stage === "prod"
            ? "tejas-profile-prod-profile-variants-978416150779"
            : "tejas-profile-dev-profile-variants-978416150779";

    const platformReleasesBucketName =
      props.stage === "prod"
        ? "tejas-profile-prod-platform-releases-978416150779"
        : "tejas-profile-dev-platform-releases-978416150779";

    const deploymentConfigurationsBucketName =
      props.stage === "prod"
        ? "tejas-profile-prod-deployment-configurations-978416150779"
        : "tejas-profile-dev-deployment-configurations-978416150779";

    const configurationAnalyticsReportsBucketName =
      props.stage === "prod"
        ? "tejas-profile-prod-configuration-analytics-reports-978416150779"
        : "tejas-profile-dev-configuration-analytics-reports-978416150779";

    const deploymentConfigurationsTableName =
      props.stage === "prod"
        ? "tejas-profile-prod-deployment-configurations-978416150779"
        : "tejas-profile-dev-deployment-configurations-978416150779";

    const platformDeploymentTableName =
      props.stage === "prod"
        ? "tejas-profile-prod-platform-deployments-978416150779"
        : "tejas-profile-dev-platform-deployments-978416150779";

    const profileActivationTableName =
      props.stage === "prod"
        ? "tejas-profile-prod-profile-activations-978416150779"
        : "tejas-profile-dev-profile-activations-978416150779";

    const usageEpochsTableName =
      props.stage === "prod"
        ? "tejas-profile-prod-usage-epochs-978416150779"
        : "tejas-profile-dev-usage-epochs-978416150779";

    const usageEpochAnalyticsTableName =
      props.stage === "prod"
        ? "tejas-profile-prod-usage-epoch-analytics-978416150779"
        : "tejas-profile-dev-usage-epoch-analytics-978416150779";

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
    // 3) Profile Variant bucket
    //
    // Immutable recruiter-facing Profile Variant manifests and
    // content-addressed Profile-owned assets.
    //
    // IMPORTANT:
    // - Separate from generic snapshots.
    // - Separate from historical repo ZIPs.
    // - Separate from platform/game assets in AssetsCdnStack.
    // - DEV and PROD are physically isolated.
    // - Both stages are retained because published Profile Variants
    //   are immutable historical artifacts.
    // -----------------------------
    const profileVariantsBucket =
      new s3.Bucket(
        this,
        "ProfileVariantsBucket",
        {
          bucketName:
            profileVariantsBucketName,

          removalPolicy:
            cdk.RemovalPolicy.RETAIN,

          blockPublicAccess:
            s3.BlockPublicAccess.BLOCK_ALL,

          encryption:
            s3.BucketEncryption.S3_MANAGED,

          enforceSSL:
            true,

          versioned:
            true,

          cors: [
            {
              allowedMethods: [
                s3.HttpMethods.PUT,
                s3.HttpMethods.GET,
                s3.HttpMethods.HEAD,
              ],

              allowedOrigins:
                allowedOrigins,

              allowedHeaders: [
                "*",
              ],

              exposedHeaders: [
                "ETag",
              ],

              maxAge:
                3000,
            },
          ],
        }
      );

    // -----------------------------
    // Platform Release bucket
    //
    // Immutable application/software release manifests.
    //
    // IMPORTANT:
    // - Separate from Profile Variants.
    // - Separate from generic snapshots.
    // - Separate from historical repo ZIPs.
    // - A Platform Release identifies software, never Profile content.
    // - DEV and PROD are physically isolated.
    // - Releases are retained historical artifacts.
    // - No browser CORS: access is backend/control-plane only.
    //
    // Object layout introduced by the registration API:
    //
    //   releases/<platformReleaseId>.json
    //
    // P5B2 creates persistence only.
    // No Lambda/API access is granted yet.
    // -----------------------------
    const platformReleasesBucket =
      new s3.Bucket(
        this,
        "PlatformReleasesBucket",
        {
          bucketName:
            platformReleasesBucketName,

          removalPolicy:
            cdk.RemovalPolicy.RETAIN,

          blockPublicAccess:
            s3.BlockPublicAccess.BLOCK_ALL,

          encryption:
            s3.BucketEncryption.S3_MANAGED,

          enforceSSL:
            true,

          versioned:
            true,
        }
      );

    // -----------------------------
    // Deployment Configuration bucket
    //
    // Authoritative immutable JSON documents:
    //
    //   configurations/<deploymentConfigurationId>.json
    //
    // Deployment Configuration identity is:
    //
    //   stage
    //   + platformReleaseId
    //   + profileVariantId
    //
    // Compatibility, activation state and usage epochs are
    // deliberately NOT stored as mutable configuration identity.
    //
    // No browser CORS.
    // No Lambda/API permissions in P5D1.
    // -----------------------------
    const deploymentConfigurationsBucket =
      new s3.Bucket(
        this,
        "DeploymentConfigurationsBucket",
        {
          bucketName:
            deploymentConfigurationsBucketName,

          removalPolicy:
            cdk.RemovalPolicy.RETAIN,

          blockPublicAccess:
            s3.BlockPublicAccess.BLOCK_ALL,

          encryption:
            s3.BucketEncryption.S3_MANAGED,

          enforceSSL:
            true,

          versioned:
            true,
        }
      );

    // -----------------------------
    // Configuration Analytics Report bucket
    //
    // Durable immutable historical analytics reports finalized
    // for individual Usage Epochs:
    //
    //   reports/<reportId>.json
    //
    // IMPORTANT:
    // - Separate from short-lived Analytics Events storage.
    // - Separate from mutable Usage Epoch lifecycle state.
    // - One Usage Epoch has at most one deterministic report ID.
    // - Reports are retained immutable historical artifacts.
    // - DEV and PROD are physically isolated.
    // - No browser CORS.
    // - No Lambda permissions are granted in P8D; the P8E
    //   automatic finalizer receives only the access it requires.
    // -----------------------------
    const configurationAnalyticsReportsBucket =
      new s3.Bucket(
        this,
        "ConfigurationAnalyticsReportsBucket",
        {
          bucketName:
            configurationAnalyticsReportsBucketName,

          removalPolicy:
            cdk.RemovalPolicy.RETAIN,

          blockPublicAccess:
            s3.BlockPublicAccess.BLOCK_ALL,

          encryption:
            s3.BucketEncryption.S3_MANAGED,

          enforceSSL:
            true,

          versioned:
            true,
        }
      );


    // -----------------------------
    // Deployment Configuration catalog
    //
    // S3 above remains the authoritative immutable document.
    //
    // DynamoDB provides efficient reverse lookup by:
    //
    //   configuration ID
    //   Profile Variant
    //   Platform Release
    //
    // Item shape introduced by P5D2:
    //
    //   pk    = CONFIG#<deploymentConfigurationId>
    //   sk    = CONFIG
    //
    //   gsi1pk = PROFILE#<profileVariantId>
    //   gsi1sk = CREATED#<createdAt>#CONFIG#<id>
    //
    //   gsi2pk = PLATFORM#<platformReleaseId>
    //   gsi2sk = CREATED#<createdAt>#CONFIG#<id>
    //
    // P5D1 creates persistence/index infrastructure only.
    // -----------------------------
    const deploymentConfigurationsTable =
      new dynamodb.Table(
        this,
        "DeploymentConfigurationsTable",
        {
          tableName:
            deploymentConfigurationsTableName,

          partitionKey: {
            name:
              "pk",

            type:
              dynamodb.AttributeType.STRING,
          },

          sortKey: {
            name:
              "sk",

            type:
              dynamodb.AttributeType.STRING,
          },

          billingMode:
            dynamodb.BillingMode.PAY_PER_REQUEST,

          removalPolicy:
            props.stage ===
            "prod"
              ? cdk.RemovalPolicy.RETAIN
              : cdk.RemovalPolicy.DESTROY,
        }
      );


    deploymentConfigurationsTable
      .addGlobalSecondaryIndex({
        indexName:
          "ByProfileVariant",

        partitionKey: {
          name:
            "gsi1pk",

          type:
            dynamodb.AttributeType.STRING,
        },

        sortKey: {
          name:
            "gsi1sk",

          type:
            dynamodb.AttributeType.STRING,
        },

        projectionType:
          dynamodb.ProjectionType.ALL,
      });


    deploymentConfigurationsTable
      .addGlobalSecondaryIndex({
        indexName:
          "ByPlatformRelease",

        partitionKey: {
          name:
            "gsi2pk",

          type:
            dynamodb.AttributeType.STRING,
        },

        sortKey: {
          name:
            "gsi2sk",

          type:
            dynamodb.AttributeType.STRING,
        },

        projectionType:
          dynamodb.ProjectionType.ALL,
      });


    // -----------------------------
    // Platform Deployment table
    //
    // Stores the mutable ACTIVE Platform Release pointer plus an
    // append-only deployment ledger.
    //
    //   CONTROL / ACTIVE
    //       which immutable Platform Release is actually live
    //
    //   DEPLOYMENT / <time>#<deploymentId>
    //       one immutable occurrence of a Platform Release becoming live
    //
    // GSI:
    //
    //   ByPlatformRelease
    //       deployment history for one immutable Platform Release
    //
    // Registration != deployment.
    //
    // P5E1 introduced persistence.
    // P5F2 wires owner-only API mutation access.
    // Public runtime access remains strictly read-only.
    // -----------------------------
    const platformDeploymentTable =
      new dynamodb.Table(
        this,
        "PlatformDeploymentTable",
        {
          tableName:
            platformDeploymentTableName,

          partitionKey: {
            name:
              "pk",

            type:
              dynamodb.AttributeType.STRING,
          },

          sortKey: {
            name:
              "sk",

            type:
              dynamodb.AttributeType.STRING,
          },

          billingMode:
            dynamodb.BillingMode.PAY_PER_REQUEST,

          removalPolicy:
            props.stage ===
            "prod"
              ? cdk.RemovalPolicy.RETAIN
              : cdk.RemovalPolicy.DESTROY,
        }
      );


    platformDeploymentTable
      .addGlobalSecondaryIndex({
        indexName:
          "ByPlatformRelease",

        partitionKey: {
          name:
            "gsi1pk",

          type:
            dynamodb.AttributeType.STRING,
        },

        sortKey: {
          name:
            "gsi1sk",

          type:
            dynamodb.AttributeType.STRING,
        },

        projectionType:
          dynamodb.ProjectionType.ALL,
      });


    // -----------------------------
    // Owner Passcode Verification table
    //
    // A single pending record per stage:
    //   OWNER_PASSCODE_CHANGE#<stage> / PENDING
    //
    // Holds only a SHA-256 hash of the one-time email code (never
    // the code itself), an attempt counter, and a TTL so an
    // unconfirmed request expires on its own.
    // -----------------------------
    const ownerPasscodeVerificationTableName =
      `tejas-profile-${props.stage}-owner-passcode-verification`;

    const ownerPasscodeVerificationTable =
      new dynamodb.Table(
        this,
        "OwnerPasscodeVerificationTable",
        {
          tableName:
            ownerPasscodeVerificationTableName,

          partitionKey: {
            name:
              "pk",

            type:
              dynamodb
                .AttributeType
                .STRING,
          },

          sortKey: {
            name:
              "sk",

            type:
              dynamodb
                .AttributeType
                .STRING,
          },

          billingMode:
            dynamodb
              .BillingMode
              .PAY_PER_REQUEST,

          timeToLiveAttribute:
            "ttl",

          removalPolicy:
            props.stage ===
            "prod"
              ? cdk
                  .RemovalPolicy
                  .RETAIN
              : cdk
                  .RemovalPolicy
                  .DESTROY,
        }
      );


    // -----------------------------
    // Profile Activation table
    //
    // Stores:
    //   CONTROL / ACTIVE
    //       mutable active Profile pointer
    //
    //   ACTIVATION / <time>#<activationId>
    //       append-only activation ledger
    //
    // GSI:
    //   ByProfileVariant
    //       all activations of the same immutable Profile Variant
    //
    // Owner activation and public read-only runtime access are wired.
    // P5F2 adds cross-control-plane composition safety.
    // -----------------------------
    const profileActivationTable =
      new dynamodb.Table(
        this,
        "ProfileActivationTable",
        {
          tableName:
            profileActivationTableName,

          partitionKey: {
            name:
              "pk",

            type:
              dynamodb
                .AttributeType
                .STRING,
          },

          sortKey: {
            name:
              "sk",

            type:
              dynamodb
                .AttributeType
                .STRING,
          },

          billingMode:
            dynamodb
              .BillingMode
              .PAY_PER_REQUEST,

          removalPolicy:
            props.stage ===
            "prod"
              ? cdk
                  .RemovalPolicy
                  .RETAIN
              : cdk
                  .RemovalPolicy
                  .DESTROY,
        }
      );


    profileActivationTable
      .addGlobalSecondaryIndex({
        indexName:
          "ByProfileVariant",

        partitionKey: {
          name:
            "gsi1pk",

          type:
            dynamodb
              .AttributeType
              .STRING,
        },

        sortKey: {
          name:
            "gsi1sk",

          type:
            dynamodb
              .AttributeType
              .STRING,
        },

        projectionType:
          dynamodb
            .ProjectionType
            .ALL,
      });

    // -----------------------------
    // Usage Epoch table
    //
    // One Deployment Configuration may become effective multiple
    // independent times:
    //
    //   Configuration A
    //     -> Epoch 1
    //     -> Epoch 2
    //     -> ...
    //
    // Base items:
    //
    //   pk = EPOCH#<usageEpochId>
    //   sk = EPOCH
    //
    // The stage-local CONTROL / ACTIVE pointer identifies the one
    // currently OPEN Usage Epoch. Profile/Platform transitions move
    // this lifecycle state atomically with their own control-plane state.
    //
    // GSI1:
    //
    //   ByDeploymentConfiguration
    //
    //   gsi1pk = CONFIG#<deploymentConfigurationId>
    //   gsi1sk = STARTED#<startedAt>#EPOCH#<usageEpochId>
    //
    // GSI2:
    //
    //   ByState
    //
    //   gsi2pk = STATE#OPEN|CLOSING|CLOSED
    //   gsi2sk = <state timestamp>#EPOCH#<usageEpochId>
    //
    // ByState allows the future automatic report worker to find
    // CLOSING epochs without scanning the table.
    //
    // Usage Epoch records are control-plane lifecycle truth.
    // Analytics event fragments and immutable reports remain
    // separate persistence concerns.
    // -----------------------------
    const usageEpochsTable =
      new dynamodb.Table(
        this,
        "UsageEpochsTable",
        {
          tableName:
            usageEpochsTableName,

          partitionKey: {
            name:
              "pk",

            type:
              dynamodb
                .AttributeType
                .STRING,
          },

          sortKey: {
            name:
              "sk",

            type:
              dynamodb
                .AttributeType
                .STRING,
          },

          billingMode:
            dynamodb
              .BillingMode
              .PAY_PER_REQUEST,

          removalPolicy:
            props.stage ===
            "prod"
              ? cdk
                  .RemovalPolicy
                  .RETAIN
              : cdk
                  .RemovalPolicy
                  .DESTROY,
        }
      );


    usageEpochsTable
      .addGlobalSecondaryIndex({
        indexName:
          "ByDeploymentConfiguration",

        partitionKey: {
          name:
            "gsi1pk",

          type:
            dynamodb
              .AttributeType
              .STRING,
        },

        sortKey: {
          name:
            "gsi1sk",

          type:
            dynamodb
              .AttributeType
              .STRING,
        },

        projectionType:
          dynamodb
            .ProjectionType
            .ALL,
      });


    usageEpochsTable
      .addGlobalSecondaryIndex({
        indexName:
          "ByState",

        partitionKey: {
          name:
            "gsi2pk",

          type:
            dynamodb
              .AttributeType
              .STRING,
        },

        sortKey: {
          name:
            "gsi2sk",

          type:
            dynamodb
              .AttributeType
              .STRING,
        },

        projectionType:
          dynamodb
            .ProjectionType
            .ALL,
      });

    // -----------------------------
    // Usage Epoch Analytics projection
    //
    // Durable exact event facts used only to build one immutable
    // Configuration Analytics Report after an epoch closes.
    //
    //   pk = EPOCH#<usageEpochId>
    //   sk = EVENT#<sha256(eventId)>
    //
    // Properties:
    // - append-only event facts
    // - eventId-idempotent
    // - not affected by Analytics reset boundaries
    // - no browser/public access
    // - no fixed TTL while an epoch is OPEN
    // - DEV disposable, PROD retained
    //
    // P8E2/P8E3 consume this table for exact historical reporting.
    //
    // Projection evidence remains retained after finalization for
    // audit/rebuild safety. Any future cleanup policy must be explicit
    // and must never precede immutable report commitment.
    // -----------------------------
    const usageEpochAnalyticsTable =
      new dynamodb.Table(
        this,
        "UsageEpochAnalyticsTable",
        {
          tableName:
            usageEpochAnalyticsTableName,

          partitionKey: {
            name:
              "pk",

            type:
              dynamodb
                .AttributeType
                .STRING,
          },

          sortKey: {
            name:
              "sk",

            type:
              dynamodb
                .AttributeType
                .STRING,
          },

          billingMode:
            dynamodb
              .BillingMode
              .PAY_PER_REQUEST,

          removalPolicy:
            props.stage ===
            "prod"
              ? cdk
                  .RemovalPolicy
                  .RETAIN
              : cdk
                  .RemovalPolicy
                  .DESTROY,
        }
      );


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
        SNAPSHOTS_BUCKET:
          snapshotsBucket.bucketName,

        REPO_BUCKET:
          repoBucket.bucketName,

        PROFILE_VARIANTS_BUCKET:
          profileVariantsBucket.bucketName,

        PLATFORM_RELEASES_BUCKET:
          platformReleasesBucket
            .bucketName,

        DEPLOYMENT_CONFIGURATIONS_BUCKET:
          deploymentConfigurationsBucket
            .bucketName,

        DEPLOYMENT_CONFIGURATIONS_TABLE:
          deploymentConfigurationsTable
            .tableName,

        PROFILE_ACTIVATION_TABLE:
          profileActivationTable.tableName,

        PLATFORM_DEPLOYMENT_TABLE:
          platformDeploymentTable
            .tableName,

        USAGE_EPOCHS_TABLE:
          usageEpochsTable
            .tableName,

        CONFIGURATION_ANALYTICS_REPORTS_BUCKET:
          configurationAnalyticsReportsBucket
            .bucketName,

        DEPLOY_HISTORY_KEY:
          "deploy/history.json",

        OWNER_TOKEN_SECRET_ID:
          ownerTokenSecret.secretName,

        OWNER_SESSION_SIGNING_KEY_SECRET_ID:
          ownerSessionSigningKeySecret
            .secretName,

        OWNER_LOGIN_PASSCODE_SECRET_ID:
          ownerLoginPasscodeSecret
            .secretName,

        OWNER_PASSCODE_VERIFICATION_TABLE:
          ownerPasscodeVerificationTable
            .tableName,

        OWNER_NOTIFICATION_EMAIL:
          ownerNotificationEmail,

        SNAPSHOTS_PREFIX:
          "snapshots/",

        TRASH_PREFIX: "trash/",
        PROFILES_PREFIX: "profiles/",

        ALLOWED_ORIGINS: allowedOrigins.join(","),
        STAGE: props.stage, // optional, but nice to have

      },
    });

    const activeProfileFn =
      new nodeLambda.NodejsFunction(
        this,
        "ActiveProfileApiHandler",
        {
          runtime:
            lambda.Runtime.NODEJS_18_X,

          entry:
            "lambda/active-profile-handler.ts",

          handler:
            "handler",

          memorySize:
            256,

          timeout:
            cdk.Duration.seconds(
              8
            ),

          bundling: {
            minify:
              true,

            target:
              "node18",
          },

          environment: {
            PROFILE_VARIANTS_BUCKET:
              profileVariantsBucket
                .bucketName,

            PROFILE_ACTIVATION_TABLE:
              profileActivationTable
                .tableName,

            PLATFORM_DEPLOYMENT_TABLE:
              platformDeploymentTable
                .tableName,

            PLATFORM_RELEASES_BUCKET:
              platformReleasesBucket
                .bucketName,

            DEPLOYMENT_CONFIGURATIONS_BUCKET:
              deploymentConfigurationsBucket
                .bucketName,

            ACTIVE_PROFILE_ASSET_URL_TTL_SECONDS:
              "3600",

            ALLOWED_ORIGINS:
              allowedOrigins.join(
                ","
              ),

            STAGE:
              props.stage,
          },
        }
      );

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

            USAGE_EPOCHS_TABLE:
              usageEpochsTable
                .tableName,

            USAGE_EPOCH_ANALYTICS_TABLE:
              usageEpochAnalyticsTable
                .tableName,

            OWNER_TOKEN_SECRET_ID:
              ownerTokenSecret.secretName,

            OWNER_SESSION_SIGNING_KEY_SECRET_ID:
              ownerSessionSigningKeySecret
                .secretName,

            ANALYTICS_EDGE_TOKEN_SECRET_ID:
              analyticsEdgeTokenSecret
                .secretName,

            ALLOWED_ORIGINS:
              allowedOrigins.join(","),

            STAGE:
              props.stage,
        },
    });

    // -----------------------------
    // Configuration Analytics Report finalizer
    //
    // Usage Epoch closure is intentionally asynchronous:
    //
    //   control-plane transition
    //     -> CLOSING
    //     -> delayed-event settlement window
    //     -> exact aggregation
    //     -> immutable S3 report
    //     -> conditional CLOSED commit
    //
    // This worker is NOT part of Profile activation or Platform
    // deployment transactions.
    // -----------------------------
    const configurationAnalyticsReportFinalizerFn =
      new nodeLambda.NodejsFunction(
        this,
        "ConfigurationAnalyticsReportFinalizer",
        {
          runtime:
            lambda.Runtime.NODEJS_18_X,

          entry:
            "lambda/configuration-analytics-report-finalizer.ts",

          handler:
            "handler",

          memorySize:
            512,

          timeout:
            cdk.Duration.seconds(
              120
            ),

          bundling: {
            minify:
              true,

            target:
              "node18",
          },

          environment: {
            USAGE_EPOCHS_TABLE:
              usageEpochsTable
                .tableName,

            USAGE_EPOCH_ANALYTICS_TABLE:
              usageEpochAnalyticsTable
                .tableName,

            ANALYTICS_TABLE:
              analyticsTable
                .tableName,

            CONFIGURATION_ANALYTICS_REPORTS_BUCKET:
              configurationAnalyticsReportsBucket
                .bucketName,

            STAGE:
              props.stage,
          },
        }
      );


    const configurationAnalyticsReportFinalizerRule =
      new events.Rule(
        this,
        "ConfigurationAnalyticsReportFinalizerSchedule",
        {
          schedule:
            events.Schedule.rate(
              cdk.Duration.minutes(
                15
              )
            ),
        }
      );


    configurationAnalyticsReportFinalizerRule
      .addTarget(
        new eventTargets.LambdaFunction(
          configurationAnalyticsReportFinalizerFn
        )
      );

    // Runtime credentials are fetched on demand.
    //
    // The secret values themselves never enter Lambda
    // environment variables or the synthesized template.
    ownerTokenSecret.grantRead(
      fn
    );

    ownerTokenSecret.grantRead(
      analyticsFn
    );

    ownerSessionSigningKeySecret
      .grantRead(
        fn
      );

    ownerSessionSigningKeySecret
      .grantRead(
        analyticsFn
      );

    analyticsEdgeTokenSecret.grantRead(
      analyticsFn
    );

    // Only fn (the human owner-passcode-change endpoints) ever
    // touches this secret -- read to check a login attempt, write
    // to actually rotate it once a code is confirmed.
    ownerLoginPasscodeSecret
      .grantRead(
        fn
      );

    ownerLoginPasscodeSecret
      .grantWrite(
        fn
      );

    // Explicit minimal actions (matching the handler's actual
    // GetItem/PutItem/DeleteItem usage) rather than
    // grantReadWriteData(), which also grants Scan/BatchGetItem/
    // DescribeTable/etc. this endpoint never uses.
    //
    // A dedicated Policy (not fn.addToRolePolicy, which merges into
    // fn's single auto-managed default policy) so it can never be
    // folded into -- or accidentally drop -- an unrelated existing
    // statement there.
    new iam.Policy(
      this,
      "OwnerPasscodeVerificationTablePolicy",
      {
        statements: [
          new iam.PolicyStatement(
            {
              actions: [
                "dynamodb:GetItem",
                "dynamodb:PutItem",
                "dynamodb:DeleteItem",
              ],

              resources: [
                ownerPasscodeVerificationTable
                  .tableArn,
              ],
            }
          ),
        ],
      }
    ).attachToRole(
      fn.role!
    );

    fn.addToRolePolicy(
      new iam.PolicyStatement(
        {
          actions: [
            "ses:SendEmail",
          ],

          resources: [
            `arn:aws:ses:${this.region}:${this.account}:identity/${ownerNotificationEmail}`,
          ],
        }
      )
    );

    // -----------------------------
    // S3 permissions (strict + correct)
    // -----------------------------
    snapshotsBucket.grantReadWrite(fn, "snapshots/*");
    snapshotsBucket.grantReadWrite(fn, "trash/*");

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

    // -----------------------------
    // Owner control-plane transition permissions
    //
    // Profile activation, Platform deployment, and Usage Epoch lifecycle require:
    //
    // - strongly consistent GetItem for authoritative pointer/lifecycle reads
    // - ConditionCheckItem inside TransactWriteItems for atomic cross-pointer
    //   and lifecycle guards
    // - PutItem inside TransactWriteItems for immutable ledger/pointer/lifecycle
    //   writes
    //
    // DynamoDB transaction IAM is authorized through the underlying item
    // operations. Transaction-only mutation authority is therefore restricted
    // with dynamodb:EnclosingOperation = TransactWriteItems.
    //
    // Intentionally NO unconditional/direct:
    // - PutItem
    // - ConditionCheckItem
    // - UpdateItem
    // - DeleteItem
    // - Scan
    // -----------------------------

    /**
     * Authoritative control-plane reads.
     *
     * These reads occur before transaction construction and therefore must
     * remain available outside TransactWriteItems.
     */
    fn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          "dynamodb:GetItem",
        ],

        resources: [
          profileActivationTable
            .tableArn,

          platformDeploymentTable
            .tableArn,

          usageEpochsTable
            .tableArn,
        ],
      })
    );


    /**
     * Transaction-only control-plane mutation/check authority.
     *
     * The underlying DynamoDB actions are intentionally unusable as normal
     * direct APIs because they are allowed only when DynamoDB reports that
     * they are enclosed by TransactWriteItems.
     */
    fn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          "dynamodb:ConditionCheckItem",
          "dynamodb:PutItem",
        ],

        resources: [
          profileActivationTable
            .tableArn,

          platformDeploymentTable
            .tableArn,

          usageEpochsTable
            .tableArn,
        ],

        conditions: {
          "ForAnyValue:StringEquals": {
            "dynamodb:EnclosingOperation": [
              "TransactWriteItems",
            ],
          },
        },
      })
    );

    // -----------------------------
    // Owner control-plane history read permissions
    //
    // Historical control-plane APIs query:
    // - the append-only base ledger partitions
    // - the existing entity-specific GSIs
    //
    // Query is intentionally separated from transition authority.
    //
    // Intentionally NO:
    // - Scan
    // - PutItem
    // - UpdateItem
    // - DeleteItem
    // -----------------------------
    fn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          "dynamodb:Query",
        ],

        resources: [
          profileActivationTable
            .tableArn,

          `${profileActivationTable.tableArn}/index/*`,

          platformDeploymentTable
            .tableArn,

          `${platformDeploymentTable.tableArn}/index/*`,
        ],
      })
    );

    // -----------------------------
    // P8F owner Usage Epoch / immutable Analytics archive reads
    //
    // History enumeration uses only existing GSIs.
    // Immutable reports are addressed through CLOSED Usage Epoch
    // metadata; the report bucket itself is never listed.
    //
    // Intentionally NO:
    // - DynamoDB Scan
    // - Usage Epoch mutation authority beyond the existing P8C path
    // - report Put/Delete
    // - report ListBucket
    // -----------------------------
    fn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          "dynamodb:Query",
        ],

        resources: [
          `${usageEpochsTable.tableArn}/index/ByDeploymentConfiguration`,

          `${usageEpochsTable.tableArn}/index/ByState`,
        ],
      })
    );


    fn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          "s3:GetObject",
        ],

        resources: [
          configurationAnalyticsReportsBucket
            .arnForObjects(
              "reports/*"
            ),
        ],
      })
    );


    // -----------------------------
    // Repo artifact lifecycle permissions
    //
    // grantReadWrite covers:
    // - presigned PUT under profiles/*
    // - artifact read/copy/delete operations
    // -----------------------------
    repoBucket.grantReadWrite(
      fn,
      "profiles/*"
    );

    repoBucket.grantReadWrite(
      fn,
      "trash/*"
    );

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


    // -----------------------------
    // Public active Profile reader
    //
    // Strict read-only runtime authority.
    // -----------------------------
    activeProfileFn
      .addToRolePolicy(
        new iam.PolicyStatement({
          actions: [
            "dynamodb:GetItem",
          ],

          resources: [
            profileActivationTable
              .tableArn,

            platformDeploymentTable
              .tableArn,
          ],
        })
      );


    activeProfileFn
      .addToRolePolicy(
        new iam.PolicyStatement({
          actions: [
            "s3:GetObject",
          ],

          resources: [
            profileVariantsBucket
              .arnForObjects(
                "variants/*"
              ),

            profileVariantsBucket
              .arnForObjects(
                "assets/sha256/*"
              ),

            platformReleasesBucket
              .arnForObjects(
                "releases/*"
              ),

            deploymentConfigurationsBucket
              .arnForObjects(
                "configurations/*"
              ),
          ],
        })
      );


    // -----------------------------
    // Profile Variant bucket permissions
    //
    // Strict immutable publication permissions.
    //
    // HeadObject/GetObject → s3:GetObject
    // PutObject           → s3:PutObject
    //
    // Intentionally NO:
    // - DeleteObject
    // - DeleteObjectVersion
    // - broad/unscoped ListBucket
    // - tagging
    // - retention/legal-hold mutation
    // - wildcard read/write grants
    // -----------------------------
    fn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          "s3:GetObject",
          "s3:PutObject",
        ],

        resources: [
          profileVariantsBucket
            .arnForObjects(
              "assets/sha256/*"
            ),

          profileVariantsBucket
            .arnForObjects(
              "variants/*"
            ),
        ],
      })
    );

    // -----------------------------
    // Profile Variant catalog enumeration
    //
    // Owner-only exact-prefix catalog listing.
    // Public runtime receives no ListBucket authority.
    // -----------------------------
    fn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          "s3:ListBucket",
        ],

        resources: [
          profileVariantsBucket
            .bucketArn,
        ],

        conditions: {
          StringEquals: {
            "s3:prefix":
              "variants/",
          },
        },
      })
    );


    // -----------------------------
    // Profile Variant asset existence probe
    //
    // The owner publisher performs ListObjectsV2 with Prefix
    // equal to the exact immutable content-addressed object key.
    //
    // Restrict ListBucket to assets/sha256/* so the publisher
    // can distinguish an absent immutable asset without gaining
    // broad bucket enumeration authority.
    //
    // Existing assets are subsequently verified with HeadObject.
    // Public runtime receives no ListBucket authority.
    // -----------------------------
    fn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          "s3:ListBucket",
        ],

        resources: [
          profileVariantsBucket
            .bucketArn,
        ],

        conditions: {
          StringLike: {
            "s3:prefix": [
              "assets/sha256/",
              "assets/sha256/*",
            ],
          },
        },
      })
    );

    // -----------------------------
    // Platform Release permissions
    //
    // Registration/read only.
    //
    // Intentionally NO:
    // - DeleteObject
    // - DeleteObjectVersion
    // - ListBucket
    // - wildcard bucket access
    // -----------------------------
    fn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          "s3:GetObject",
          "s3:PutObject",
        ],

        resources: [
          platformReleasesBucket
            .arnForObjects(
              "releases/*"
            ),
        ],
      })
    );

    // -----------------------------
    // Platform Release catalog enumeration
    //
    // Owner-only exact-prefix ListBucket.
    //
    // Public ActiveProfileApiHandler remains GetObject-only.
    // -----------------------------
    fn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          "s3:ListBucket",
        ],

        resources: [
          platformReleasesBucket
            .bucketArn,
        ],

        conditions: {
          StringEquals: {
            "s3:prefix":
              "releases/",
          },
        },
      })
    );

    // -----------------------------
    // Deployment Configuration immutable document permissions
    //
    // S3 is authoritative:
    // - GetObject
    // - PutObject
    //
    // Intentionally NO delete.
    // -----------------------------
    fn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          "s3:GetObject",
          "s3:PutObject",
        ],

        resources: [
          deploymentConfigurationsBucket
            .arnForObjects(
              "configurations/*"
            ),
        ],
      })
    );

    // -----------------------------
    // Deployment Configuration existence disambiguation
    //
    // Without s3:ListBucket, S3 cannot distinguish "object does not
    // exist" from "access denied" for a GetObject on a missing key,
    // and masks a routine NotFound as AccessDenied. A prefix-scoped
    // ListBucket grant does NOT fix this: AWS's internal check for
    // this disambiguation evaluates s3:ListBucket without an
    // s3:prefix context, so even a correctly-scoped grant never
    // satisfies it (confirmed via iam:SimulatePrincipalPolicy) --
    // only an unconditional grant would, which this bucket
    // deliberately withholds.
    //
    // Fixed in the Lambda instead: readStoredDeploymentConfiguration()
    // recognizes this specific masked-403 shape (safe only because
    // s3:GetObject is verifiably granted for this exact key pattern
    // and s3:ListBucket is verifiably absent by design) and re-throws
    // it as a NotFound-shaped error, which isS3NotFound() already
    // handles as a clean 409 "Deployment Configuration does not
    // exist" response.
    // -----------------------------


    // -----------------------------
    // Deployment Configuration catalog permissions
    //
    // DynamoDB is a derived repairable index:
    // - PutItem repairs/creates exact catalog projection
    // - Query powers reverse lookup through GSIs
    //
    // Intentionally NO:
    // - DeleteItem
    // - UpdateItem
    // - Scan
    // -----------------------------
    fn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          "dynamodb:PutItem",
        ],

        resources: [
          deploymentConfigurationsTable
            .tableArn,
        ],
      })
    );


    fn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          "dynamodb:Query",
        ],

        resources: [
          `${deploymentConfigurationsTable.tableArn}/index/*`,
        ],
      })
    );

    analyticsEventsBucket.grantPut(analyticsFn, "analytics-events/*");
    analyticsTable.grantReadWriteData(analyticsFn);

    // -----------------------------
    // P8E Usage Epoch attribution
    //
    // Analytics may:
    // - strongly read the ACTIVE Usage Epoch pointer/base candidate
    // - query ONLY the Deployment Configuration GSI
    // - append exact immutable projection events
    //
    // It may NOT mutate Usage Epoch lifecycle state.
    // -----------------------------
    analyticsFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          "dynamodb:GetItem",
        ],

        resources: [
          usageEpochsTable
            .tableArn,
        ],
      })
    );


    analyticsFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          "dynamodb:Query",
        ],

        resources: [
          `${usageEpochsTable.tableArn}/index/ByDeploymentConfiguration`,
        ],
      })
    );


    analyticsFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          "dynamodb:PutItem",
        ],

        resources: [
          usageEpochAnalyticsTable
            .tableArn,
        ],
      })
    );


    // -----------------------------
    // Configuration Analytics Report finalizer permissions
    //
    // Usage Epoch:
    // - strongly read exact candidate
    // - query CLOSING state index
    // - conditionally commit CLOSING -> CLOSED
    //
    // Projection:
    // - Query exact Usage Epoch event partition only
    //
    // Live Analytics:
    // - BatchGet visitor META evidence only
    //
    // Report bucket:
    // - immutable GetObject / PutObject under reports/*
    //
    // Intentionally NO:
    // - Scan
    // - DeleteItem
    // - TransactWriteItems
    // - S3 List/Delete
    // - Profile/Platform control-plane permissions
    // -----------------------------
    configurationAnalyticsReportFinalizerFn
      .addToRolePolicy(
        new iam.PolicyStatement({
          actions: [
            "dynamodb:GetItem",
            "dynamodb:UpdateItem",
          ],

          resources: [
            usageEpochsTable
              .tableArn,
          ],
        })
      );


    configurationAnalyticsReportFinalizerFn
      .addToRolePolicy(
        new iam.PolicyStatement({
          actions: [
            "dynamodb:Query",
          ],

          resources: [
            `${usageEpochsTable.tableArn}/index/ByState`,
          ],
        })
      );


    configurationAnalyticsReportFinalizerFn
      .addToRolePolicy(
        new iam.PolicyStatement({
          actions: [
            "dynamodb:Query",
          ],

          resources: [
            usageEpochAnalyticsTable
              .tableArn,
          ],
        })
      );


    configurationAnalyticsReportFinalizerFn
      .addToRolePolicy(
        new iam.PolicyStatement({
          actions: [
            "dynamodb:BatchGetItem",
          ],

          resources: [
            analyticsTable
              .tableArn,
          ],
        })
      );


    configurationAnalyticsReportFinalizerFn
      .addToRolePolicy(
        new iam.PolicyStatement({
          actions: [
            "s3:GetObject",
            "s3:PutObject",
          ],

          resources: [
            configurationAnalyticsReportsBucket
              .arnForObjects(
                "reports/*"
              ),
          ],
        })
      );


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

    const ownerSessionIntegration =
      new apigwv2Integrations.HttpLambdaIntegration(
        "OwnerSessionLambdaIntegration",
        fn
      );

    const activeProfileIntegration =
      new apigwv2Integrations.HttpLambdaIntegration(
        "ActiveProfileLambdaIntegration",
        activeProfileFn
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
      path:
        "/owner/session",

      methods: [
        apigwv2.HttpMethod.POST,
      ],

      integration:
        ownerSessionIntegration,
    });

    httpApi.addRoutes({
      path:
        "/owner/passcode/request-change",

      methods: [
        apigwv2.HttpMethod.POST,
      ],

      integration,
    });

    httpApi.addRoutes({
      path:
        "/owner/passcode/confirm-change",

      methods: [
        apigwv2.HttpMethod.POST,
      ],

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
      path:
        "/profile-variants/assets/presign-put",

      methods: [
        apigwv2.HttpMethod.POST,
      ],

      integration,
    });


    httpApi.addRoutes({
      path:
        "/profile-variants/publish",

      methods: [
        apigwv2.HttpMethod.POST,
      ],

      integration,
    });


    httpApi.addRoutes({
      path:
        "/profile-variants/get",

      methods: [
        apigwv2.HttpMethod.GET,
      ],

      integration,
    });


    httpApi.addRoutes({
      path:
        "/profile-variants/list",

      methods: [
        apigwv2.HttpMethod.GET,
      ],

      integration,
    });


    httpApi.addRoutes({
      path:
        "/platform-releases/register",

      methods: [
        apigwv2.HttpMethod.POST,
      ],

      integration,
    });


    httpApi.addRoutes({
      path:
        "/platform-releases/get",

      methods: [
        apigwv2.HttpMethod.GET,
      ],

      integration,
    });


    httpApi.addRoutes({
      path:
        "/platform-releases/list",

      methods: [
        apigwv2.HttpMethod.GET,
      ],

      integration,
    });


    httpApi.addRoutes({
      path:
        "/deployment-configurations/create",

      methods: [
        apigwv2.HttpMethod.POST,
      ],

      integration,
    });


    httpApi.addRoutes({
      path:
        "/deployment-configurations/get",

      methods: [
        apigwv2.HttpMethod.GET,
      ],

      integration,
    });


    httpApi.addRoutes({
      path:
        "/deployment-configurations/list",

      methods: [
        apigwv2.HttpMethod.GET,
      ],

      integration,
    });


    httpApi.addRoutes({
      path:
        "/profile-activations/list",

      methods: [
        apigwv2.HttpMethod.GET,
      ],

      integration,
    });


    httpApi.addRoutes({
      path:
        "/platform-deployments/list",

      methods: [
        apigwv2.HttpMethod.GET,
      ],

      integration,
    });


    httpApi.addRoutes({
      path:
        "/usage-epochs/list",

      methods: [
        apigwv2.HttpMethod.GET,
      ],

      integration,
    });


    httpApi.addRoutes({
      path:
        "/configuration-analytics-reports/get",

      methods: [
        apigwv2.HttpMethod.GET,
      ],

      integration,
    });


    httpApi.addRoutes({
      path:
        "/platform-deployments/commit",

      methods: [
        apigwv2.HttpMethod.POST,
      ],

      integration,
    });


    httpApi.addRoutes({
      path:
        "/profile-variants/activate",

      methods: [
        apigwv2.HttpMethod.POST,
      ],

      integration,
    });

    httpApi.addRoutes({
      path:
        "/profile/active",

      methods: [
        apigwv2.HttpMethod.GET,
      ],

      integration:
        activeProfileIntegration,
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
            // CloudFormation resolves the independent edge
            // credential from Secrets Manager at deployment.
            //
            // The value is not derived from owner auth and
            // never enters the Analytics Lambda environment.
            "x-analytics-edge-token":
              analyticsEdgeTokenSecret
                .secretValue
                .unsafeUnwrap(),
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

    new cdk.CfnOutput(
      this,
      "SnapshotsApiUrl",
      {
        value:
          httpApi.apiEndpoint,
      }
    );

    new cdk.CfnOutput(
      this,
      "SnapshotsBucketName",
      {
        value:
          snapshotsBucket.bucketName,
      }
    );

    new cdk.CfnOutput(
      this,
      "RepoBucketName",
      {
        value:
          repoBucket.bucketName,
      }
    );

    new cdk.CfnOutput(
      this,
      "ProfileVariantsBucketName",
      {
        value:
          profileVariantsBucket.bucketName,
      }
    );

    new cdk.CfnOutput(
      this,
      "PlatformReleasesBucketName",
      {
        value:
          platformReleasesBucket
            .bucketName,
      }
    );

    new cdk.CfnOutput(
      this,
      "DeploymentConfigurationsBucketName",
      {
        value:
          deploymentConfigurationsBucket
            .bucketName,
      }
    );


    new cdk.CfnOutput(
      this,
      "ConfigurationAnalyticsReportsBucketName",
      {
        value:
          configurationAnalyticsReportsBucket
            .bucketName,
      }
    );


    new cdk.CfnOutput(
      this,
      "DeploymentConfigurationsTableName",
      {
        value:
          deploymentConfigurationsTable
            .tableName,
      }
    );

    new cdk.CfnOutput(
      this,
      "PlatformDeploymentTableName",
      {
        value:
          platformDeploymentTable
            .tableName,
      }
    );

    new cdk.CfnOutput(
      this,
      "ProfileActivationTableName",
      {
        value:
          profileActivationTable
            .tableName,
      }
    );

    new cdk.CfnOutput(
      this,
      "UsageEpochsTableName",
      {
        value:
          usageEpochsTable
            .tableName,
      }
    );

    new cdk.CfnOutput(
      this,
      "UsageEpochAnalyticsTableName",
      {
        value:
          usageEpochAnalyticsTable
            .tableName,
      }
    );

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

    new cdk.CfnOutput(
      this,
      "ActiveProfileApiUrl",
      {
        value:
          cdk.Fn.join(
            "",
            [
              httpApi.apiEndpoint,
              "/profile/active",
            ]
          ),
      }
    );

  }
}
