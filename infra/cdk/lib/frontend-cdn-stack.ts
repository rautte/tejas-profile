// infra/cdk/lib/frontend-cdn-stack.ts

import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";

import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import { S3BucketOrigin } from "aws-cdk-lib/aws-cloudfront-origins";
import * as iam from "aws-cdk-lib/aws-iam";
import * as s3 from "aws-cdk-lib/aws-s3";


export type FrontendStage =
  | "dev";


export interface FrontendCdnStackProps
  extends cdk.StackProps {
  stage: FrontendStage;
}


export class FrontendCdnStack
  extends cdk.Stack {

  public readonly frontendOrigin:
    string;

  constructor(
    scope: Construct,
    id: string,
    props: FrontendCdnStackProps
  ) {
    super(
      scope,
      id,
      props
    );


    const {
      stage,
    } = props;


    // ==========================================================
    // DEV FRONTEND ARTIFACT BUCKET
    //
    // This bucket contains only the built React application.
    //
    // It intentionally does NOT contain:
    // - heavy ship assets
    // - geo datasets
    // - snapshots
    // - Profile Variants
    // - Platform Releases
    //
    // Those resources have independent lifecycle boundaries.
    // ==========================================================

    const bucket =
      new s3.Bucket(
        this,
        "FrontendBucket",
        {
          blockPublicAccess:
            s3.BlockPublicAccess
              .BLOCK_ALL,

          enforceSSL:
            true,

          encryption:
            s3.BucketEncryption
              .S3_MANAGED,

          versioned:
            true,

          removalPolicy:
            cdk.RemovalPolicy
              .DESTROY,

          autoDeleteObjects:
            true,
        }
      );


    // ==========================================================
    // CLOUDFRONT
    //
    // CloudFront is the only public reader of the private S3
    // frontend bucket.
    //
    // 403 / 404 are rewritten to index.html so React Router / SPA
    // deep links resolve through the application.
    // ==========================================================

    const distribution =
      new cloudfront.Distribution(
        this,
        "FrontendDistribution",
        {
          priceClass:
            cloudfront.PriceClass
              .PRICE_CLASS_100,

          defaultRootObject:
            "index.html",

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

          errorResponses: [
            {
              httpStatus:
                403,

              responseHttpStatus:
                200,

              responsePagePath:
                "/index.html",

              ttl:
                cdk.Duration
                  .seconds(
                    0
                  ),
            },

            {
              httpStatus:
                404,

              responseHttpStatus:
                200,

              responsePagePath:
                "/index.html",

              ttl:
                cdk.Duration
                  .seconds(
                    0
                  ),
            },
          ],

          comment:
            "DEV frontend for tejas-profile",

          minimumProtocolVersion:
            cloudfront
              .SecurityPolicyProtocol
              .TLS_V1_2_2021,
        }
      );

    this.frontendOrigin =
      `https://${distribution.distributionDomainName}`;


    // ==========================================================
    // EXISTING GITHUB OIDC PROVIDER
    //
    // AssetsCdnStack (PROD) remains the account-level owner of
    // the GitHub OIDC provider.
    //
    // This DEV-only stack references that provider by ARN and
    // therefore never attempts to create a duplicate provider.
    // ==========================================================

    const githubProviderArn =
      `arn:${cdk.Aws.PARTITION}:iam::${cdk.Aws.ACCOUNT_ID}:oidc-provider/token.actions.githubusercontent.com`;


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


    const assumedBy =
      new iam.FederatedPrincipal(
        githubProviderArn,

        githubConditions,

        "sts:AssumeRoleWithWebIdentity"
      );


    // ==========================================================
    // DEV FRONTEND PUBLISHER ROLE
    //
    // Deliberately separate from:
    //
    // tejas-profile-github-assets-dev
    //
    // A frontend deployment therefore cannot mutate heavy/geo
    // asset buckets, and the asset publisher cannot mutate the
    // frontend application bucket.
    // ==========================================================

    const githubRole =
      new iam.Role(
        this,
        "GithubFrontendPublisher",
        {
          roleName:
            "tejas-profile-github-frontend-dev",

          description:
            "GitHub Actions can publish the DEV tejas-profile frontend",

          assumedBy,
        }
      );


    // ==========================================================
    // S3 — ONLY THE DEV FRONTEND BUCKET
    // ==========================================================

    githubRole.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          "s3:ListBucket",
        ],

        resources: [
          bucket.bucketArn,
        ],
      })
    );


    githubRole.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
        ],

        resources: [
          bucket.arnForObjects(
            "*"
          ),
        ],
      })
    );


    // ==========================================================
    // CLOUDFRONT — ONLY THE DEV FRONTEND DISTRIBUTION
    // ==========================================================

    const distributionArn =
      `arn:${cdk.Aws.PARTITION}:cloudfront::${cdk.Aws.ACCOUNT_ID}:distribution/${distribution.distributionId}`;


    githubRole.addToPolicy(
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
    // CLOUDFORMATION DISCOVERY
    //
    // Future deployment scripts resolve physical identifiers from
    // stack outputs instead of hardcoding bucket/distribution IDs.
    // ==========================================================

    const stackArn =
      `arn:${cdk.Aws.PARTITION}:cloudformation:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:stack/${this.stackName}/*`;


    githubRole.addToPolicy(
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
      "FrontendUrl",
      {
        value:
          this.frontendOrigin,
      }
    );


    new cdk.CfnOutput(
      this,
      "GithubRoleArn",
      {
        value:
          githubRole.roleArn,
      }
    );
  }
}