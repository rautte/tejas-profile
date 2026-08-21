// infra/cdk/lib/assets-cdn-stack.ts

import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";

import * as s3 from "aws-cdk-lib/aws-s3";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import { S3BucketOrigin } from "aws-cdk-lib/aws-cloudfront-origins";
import * as iam from "aws-cdk-lib/aws-iam";


export type AssetsStage =
  | "dev"
  | "prod";


export interface AssetsCdnStackProps
  extends cdk.StackProps {
  stage: AssetsStage;
}


export class AssetsCdnStack
  extends cdk.Stack {

  constructor(
    scope: Construct,
    id: string,
    props: AssetsCdnStackProps
  ) {
    super(
      scope,
      id,
      props
    );


    const {
      stage,
    } = props;


    const isProd =
      stage === "prod";


    const removalPolicy =
      isProd
        ? cdk.RemovalPolicy.RETAIN
        : cdk.RemovalPolicy.DESTROY;


    const autoDeleteObjects =
      !isProd;


    // ==========================================================
    // HEAVY ASSETS
    // ==========================================================

    const bucket =
      new s3.Bucket(
        this,
        "HeavyAssetsBucket",
        {
          blockPublicAccess:
            s3.BlockPublicAccess.BLOCK_ALL,

          enforceSSL:
            true,

          versioned:
            true,

          cors: [
            {
              allowedMethods: [
                s3.HttpMethods.GET,
                s3.HttpMethods.HEAD,
              ],

              allowedOrigins: [
                "*",
              ],

              allowedHeaders: [
                "*",
              ],

              maxAge:
                86400,
            },
          ],

          removalPolicy,

          autoDeleteObjects,
        }
      );


    // ==========================================================
    // GEO DATASET
    // ==========================================================

    const geoBucket =
      new s3.Bucket(
        this,
        "GeoDatasetBucket",
        {
          blockPublicAccess:
            s3.BlockPublicAccess.BLOCK_ALL,

          enforceSSL:
            true,

          versioned:
            true,

          cors: [
            {
              allowedMethods: [
                s3.HttpMethods.GET,
                s3.HttpMethods.HEAD,
              ],

              allowedOrigins: [
                "*",
              ],

              allowedHeaders: [
                "*",
              ],

              maxAge:
                86400,
            },
          ],

          removalPolicy,

          autoDeleteObjects,
        }
      );


    // ==========================================================
    // CLOUDFRONT
    // ==========================================================

    const distribution =
      new cloudfront.Distribution(
        this,
        "AssetsDist",
        {
          priceClass:
            cloudfront.PriceClass
              .PRICE_CLASS_100,

          defaultBehavior: {
            origin:
              S3BucketOrigin
                .withOriginAccessControl(
                  bucket
                ),

            viewerProtocolPolicy:
              cloudfront
                .ViewerProtocolPolicy
                .REDIRECT_TO_HTTPS,

            allowedMethods:
              cloudfront
                .AllowedMethods
                .ALLOW_GET_HEAD_OPTIONS,

            cachePolicy:
              cloudfront
                .CachePolicy
                .CACHING_OPTIMIZED,

            compress:
              true,
          },


          additionalBehaviors: {
            "geo/*": {
              origin:
                S3BucketOrigin
                  .withOriginAccessControl(
                    geoBucket
                  ),

              viewerProtocolPolicy:
                cloudfront
                  .ViewerProtocolPolicy
                  .REDIRECT_TO_HTTPS,

              allowedMethods:
                cloudfront
                  .AllowedMethods
                  .ALLOW_GET_HEAD_OPTIONS,

              cachePolicy:
                cloudfront
                  .CachePolicy
                  .CACHING_OPTIMIZED,

              compress:
                true,
            },
          },


          defaultRootObject:
            "",


          // Preserve the current PROD comment so the existing
          // distribution receives no unnecessary configuration
          // change solely because of this migration.
          comment:
            isProd
              ? "CDN for tejas-profile heavy assets"
              : "CDN for tejas-profile heavy assets (dev)",


          minimumProtocolVersion:
            cloudfront
              .SecurityPolicyProtocol
              .TLS_V1_2_2021,
        }
      );


    // ==========================================================
    // GITHUB OIDC
    //
    // The existing PROD stack continues to own the account-level
    // GitHub OIDC provider.
    //
    // DEV references that provider by ARN instead of attempting
    // to create a second identical provider.
    // ==========================================================

    const githubConditions = {
      StringEquals: {
        "token.actions.githubusercontent.com:aud":
          "sts.amazonaws.com",
      },

      StringLike: {
        "token.actions.githubusercontent.com:sub":
          "repo:rautte/tejas-profile:*",
      },
    };


    let assumedBy:
      iam.IPrincipal;


    if (isProd) {
      const ghProvider =
        new iam.OpenIdConnectProvider(
          this,
          "GitHubProvider",
          {
            url:
              "https://token.actions.githubusercontent.com",

            clientIds: [
              "sts.amazonaws.com",
            ],
          }
        );


      assumedBy =
        new iam
          .OpenIdConnectPrincipal(
            ghProvider
          )
          .withConditions(
            githubConditions
          );
    } else {
      const githubProviderArn =
        `arn:${cdk.Aws.PARTITION}:iam::${cdk.Aws.ACCOUNT_ID}:oidc-provider/token.actions.githubusercontent.com`;


      assumedBy =
        new iam.FederatedPrincipal(
          githubProviderArn,

          githubConditions,

          "sts:AssumeRoleWithWebIdentity"
        );
    }


    // ==========================================================
    // STAGE-SCOPED GITHUB ROLE
    // ==========================================================

    const ghRole =
      new iam.Role(
        this,
        "GithubActionsDeployer",
        {
          // IMPORTANT:
          //
          // Preserve the existing PROD role name because other
          // PROD infrastructure already references it.
          roleName:
            isProd
              ? "tejas-profile-github-deployer"
              : "tejas-profile-github-assets-dev",


          description:
            isProd
              ? "GitHub Actions can manage PROD tejas-profile assets"
              : "GitHub Actions can manage DEV tejas-profile assets",


          assumedBy,
        }
      );


    // ==========================================================
    // S3 PERMISSIONS — ONLY THIS STAGE'S BUCKETS
    // ==========================================================

    ghRole.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          "s3:ListBucket",
        ],

        resources: [
          bucket.bucketArn,
          geoBucket.bucketArn,
        ],
      })
    );


    ghRole.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
        ],

        resources: [
          bucket.arnForObjects("*"),
          geoBucket.arnForObjects("*"),
        ],
      })
    );


    // ==========================================================
    // CLOUDFRONT PERMISSION — ONLY THIS STAGE'S DISTRIBUTION
    // ==========================================================

    const distributionArn =
      `arn:${cdk.Aws.PARTITION}:cloudfront::${cdk.Aws.ACCOUNT_ID}:distribution/${distribution.distributionId}`;


    ghRole.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          "cloudfront:CreateInvalidation",
        ],

        resources: [
          distributionArn,
        ],
      })
    );


    // ==========================================================
    // CLOUDFORMATION DISCOVERY — ONLY THIS STAGE'S STACK
    //
    // Workflows/scripts resolve bucket/CDN values from stack
    // outputs instead of hardcoding infrastructure identifiers.
    // ==========================================================

    const stackArn =
      `arn:${cdk.Aws.PARTITION}:cloudformation:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:stack/${this.stackName}/*`;


    ghRole.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          "cloudformation:DescribeStacks",
        ],

        resources: [
          stackArn,
        ],
      })
    );


    // ==========================================================
    // OUTPUTS
    // ==========================================================

    new cdk.CfnOutput(
      this,
      "Stage",
      {
        value:
          stage,
      }
    );


    new cdk.CfnOutput(
      this,
      "BucketName",
      {
        value:
          bucket.bucketName,
      }
    );


    new cdk.CfnOutput(
      this,
      "DistributionId",
      {
        value:
          distribution
            .distributionId,
      }
    );


    new cdk.CfnOutput(
      this,
      "CdnUrl",
      {
        value:
          `https://${distribution.distributionDomainName}`,
      }
    );


    new cdk.CfnOutput(
      this,
      "GithubRoleArn",
      {
        value:
          ghRole.roleArn,
      }
    );


    new cdk.CfnOutput(
      this,
      "GeoBucketName",
      {
        value:
          geoBucket.bucketName,
      }
    );


    new cdk.CfnOutput(
      this,
      "GeoDatasetUrl",
      {
        value:
          `https://${distribution.distributionDomainName}/geo/major_cities.v1.json`,
      }
    );
  }
}