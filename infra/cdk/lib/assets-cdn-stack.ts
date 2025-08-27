// infra/cdk/lib/assets-cdn-stack.ts
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import { S3Origin } from 'aws-cdk-lib/aws-cloudfront-origins';
import * as iam from 'aws-cdk-lib/aws-iam';

export class AssetsCdnStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // 1) Private S3 bucket for heavy assets (no public access)
    const bucket = new s3.Bucket(this, 'HeavyAssetsBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      versioned: true,
      // Keep CORS so your app can fetch from the CDN across origins
      cors: [
        {
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.HEAD],
          allowedOrigins: ['*'],
          allowedHeaders: ['*'],
          maxAge: 86400,
        },
      ],
      // Keep data by default; do not auto-delete in prod
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      autoDeleteObjects: false,
    });

    // 2) CloudFront OAI (compatible across CDK versions)
    const oai = new cloudfront.OriginAccessIdentity(this, 'OAI', {
      comment: 'OAI for tejas-profile heavy assets',
    });

    // Allow CloudFront (via OAI) to read objects in the bucket
    bucket.addToResourcePolicy(
      new iam.PolicyStatement({
        actions: ['s3:GetObject'],
        resources: [bucket.arnForObjects('*')],
        principals: [
          new iam.CanonicalUserPrincipal(
            oai.cloudFrontOriginAccessIdentityS3CanonicalUserId
          ),
        ],
      })
    );

    // 3) CloudFront distribution (S3Origin + OAI)
    const distribution = new cloudfront.Distribution(this, 'AssetsDist', {
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      defaultBehavior: {
        origin: new S3Origin(bucket, { originAccessIdentity: oai }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        compress: true,
      },
      defaultRootObject: '',
      comment: 'CDN for tejas-profile heavy assets',
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
    });

    // 4) GitHub OIDC provider + role so Actions can upload & invalidate CF
    const ghProvider = new iam.OpenIdConnectProvider(this, 'GitHubProvider', {
      url: 'https://token.actions.githubusercontent.com',
      clientIds: ['sts.amazonaws.com'],
    });

    const ghRole = new iam.Role(this, 'GithubActionsDeployer', {
      roleName: 'tejas-profile-github-deployer',
      description: 'GitHub Actions can sync assets to S3 and invalidate CloudFront',
      assumedBy: new iam.OpenIdConnectPrincipal(ghProvider).withConditions({
        StringEquals: {
          'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
        },
        // Limit to your repo; tighten to main by replacing * with ref:refs/heads/main
        StringLike: {
          'token.actions.githubusercontent.com:sub': 'repo:rautte/tejas-profile:*',
        },
      }),
    });

    ghRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['s3:ListBucket'],
        resources: [bucket.bucketArn],
      })
    );
    ghRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['s3:GetObject', 's3:PutObject', 's3:DeleteObject', 's3:PutObjectAcl'],
        resources: [bucket.arnForObjects('*')],
      })
    );
    ghRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['cloudfront:CreateInvalidation'],
        resources: ['*'], // CloudFront invalidation doesn’t support resource ARNs
      })
    );

    // Outputs
    new cdk.CfnOutput(this, 'BucketName', { value: bucket.bucketName });
    new cdk.CfnOutput(this, 'DistributionId', { value: distribution.distributionId });
    new cdk.CfnOutput(this, 'CdnUrl', { value: `https://${distribution.distributionDomainName}` });
    new cdk.CfnOutput(this, 'GithubRoleArn', { value: ghRole.roleArn });
  }
}
