// infra/cdk/test/snapshots-stack.test.ts
import * as cdk from "aws-cdk-lib";
import {
  Match,
  Template,
} from "aws-cdk-lib/assertions";

import * as cloudfront from "aws-cdk-lib/aws-cloudfront";

import {
  SnapshotsStack,
} from "../lib/snapshots-stack";


function createStack(
  stage: "dev" | "prod"
) {
  const app =
    new cdk.App();

  const stack =
    new SnapshotsStack(
      app,
      `TestSnapshotsStack-${stage}`,
      {
        stage,

        allowedOrigins:
            stage === "dev"
                ? [
                    "http://localhost:3000",
                ]
                : [
                    "https://rautte.github.io",
                ],

        ownerToken:
          "unit-test-owner-token",
      }
    );

  return {
    stack,
    template:
      Template.fromStack(
        stack
      ),
  };
}


function findAnalyticsBucket(
  template: Template
) {
  const buckets =
    template.findResources(
      "AWS::S3::Bucket"
    );

  const entry =
    Object.entries(
      buckets
    ).find(
      ([, resource]: [
        string,
        any
      ]) => {
        const rules =
          resource
            ?.Properties
            ?.LifecycleConfiguration
            ?.Rules;

        return (
          Array.isArray(rules) &&
          rules.some(
            (rule: any) =>
              rule?.Prefix ===
                "analytics-events/" &&
              rule
                ?.ExpirationInDays ===
                30
          )
        );
      }
    );

  if (!entry) {
    throw new Error(
      "Analytics events bucket was not found."
    );
  }

  return {
    logicalId:
      entry[0],

    resource:
      entry[1] as any,
  };
}


function findAnalyticsTable(
  template: Template
) {
  const tables =
    template.findResources(
      "AWS::DynamoDB::Table"
    );

  const entry =
    Object.entries(
      tables
    ).find(
      ([, resource]: [
        string,
        any
      ]) => {
        const keySchema =
          resource
            ?.Properties
            ?.KeySchema;

        return (
          Array.isArray(
            keySchema
          ) &&
          keySchema.some(
            (key: any) =>
              key
                ?.AttributeName ===
                "pk" &&
              key?.KeyType ===
                "HASH"
          ) &&
          keySchema.some(
            (key: any) =>
              key
                ?.AttributeName ===
                "sk" &&
              key?.KeyType ===
                "RANGE"
          )
        );
      }
    );

  if (!entry) {
    throw new Error(
      "Analytics table was not found."
    );
  }

  return {
    logicalId:
      entry[0],

    resource:
      entry[1] as any,
  };
}


describe(
  "SnapshotsStack analytics infrastructure",
  () => {
    test(
      "DEV and PROD use isolated named snapshot/repo buckets",
      () => {
        const dev =
          createStack("dev")
            .template;

        const prod =
          createStack("prod")
            .template;

        dev.hasResourceProperties(
          "AWS::S3::Bucket",
          {
            BucketName:
              "tejas-profile-dev-snapshots-978416150779",
          }
        );

        dev.hasResourceProperties(
          "AWS::S3::Bucket",
          {
            BucketName:
              "tejas-profile-dev-repo-zips-978416150779",
          }
        );

        prod.hasResourceProperties(
          "AWS::S3::Bucket",
          {
            BucketName:
              "tejas-profile-prod-snapshots-978416150779",
          }
        );

        prod.hasResourceProperties(
          "AWS::S3::Bucket",
          {
            BucketName:
              "tejas-profile-prod-repo-zips-978416150779",
          }
        );
      }
    );


    test(
      "analytics DynamoDB table uses PAY_PER_REQUEST with pk/sk",
      () => {
        const {
          template,
        } =
          createStack("dev");

        template
          .hasResourceProperties(
            "AWS::DynamoDB::Table",
            {
              BillingMode:
                "PAY_PER_REQUEST",

              KeySchema:
                Match.arrayWith(
                  [
                    {
                      AttributeName:
                        "pk",

                      KeyType:
                        "HASH",
                    },

                    {
                      AttributeName:
                        "sk",

                      KeyType:
                        "RANGE",
                    },
                  ]
                ),

              AttributeDefinitions:
                Match.arrayWith(
                  [
                    {
                      AttributeName:
                        "pk",

                      AttributeType:
                        "S",
                    },

                    {
                      AttributeName:
                        "sk",

                      AttributeType:
                        "S",
                    },
                  ]
                ),
            }
          );
      }
    );


    test(
      "raw analytics bucket is private, encrypted and expires objects after 30 days",
      () => {
        const {
          template,
        } =
          createStack("dev");

        template
          .hasResourceProperties(
            "AWS::S3::Bucket",
            Match.objectLike({
              BucketEncryption:
                Match.objectLike({
                  ServerSideEncryptionConfiguration:
                    Match.anyValue(),
                }),

              PublicAccessBlockConfiguration:
                {
                  BlockPublicAcls:
                    true,

                  BlockPublicPolicy:
                    true,

                  IgnorePublicAcls:
                    true,

                  RestrictPublicBuckets:
                    true,
                },

              LifecycleConfiguration:
                Match.objectLike({
                  Rules:
                    Match.arrayWith(
                      [
                        Match.objectLike({
                          Prefix:
                            "analytics-events/",

                          ExpirationInDays:
                            30,

                          Status:
                            "Enabled",
                        }),
                      ]
                    ),
                }),
            })
          );
      }
    );


    test(
      "raw analytics bucket enforces HTTPS",
      () => {
        const {
          template,
        } =
          createStack("dev");

        const {
          logicalId,
        } =
          findAnalyticsBucket(
            template
          );

        template.hasResourceProperties(
          "AWS::S3::BucketPolicy",
          Match.objectLike({
            Bucket: {
              Ref:
                logicalId,
            },

            PolicyDocument:
              Match.objectLike({
                Statement:
                  Match.arrayWith(
                    [
                      Match.objectLike({
                        Effect:
                          "Deny",

                        Condition:
                          Match.objectLike({
                            Bool:
                              Match.objectLike({
                                "aws:SecureTransport":
                                  "false",
                              }),
                          }),
                      }),
                    ]
                  ),
              }),
          })
        );
      }
    );


    test(
      "DEV analytics data is disposable",
      () => {
        const {
          template,
        } =
          createStack("dev");

        const analyticsBucket =
          findAnalyticsBucket(
            template
          );

        const analyticsTable =
          findAnalyticsTable(
            template
          );

        expect(
          analyticsBucket
            .resource
            .DeletionPolicy
        ).toBe(
          "Delete"
        );

        expect(
          analyticsTable
            .resource
            .DeletionPolicy
        ).toBe(
          "Delete"
        );
      }
    );


    test(
      "PROD analytics data is retained",
      () => {
        const {
          template,
        } =
          createStack("prod");

        const analyticsBucket =
          findAnalyticsBucket(
            template
          );

        const analyticsTable =
          findAnalyticsTable(
            template
          );

        expect(
          analyticsBucket
            .resource
            .DeletionPolicy
        ).toBe(
          "Retain"
        );

        expect(
          analyticsTable
            .resource
            .DeletionPolicy
        ).toBe(
          "Retain"
        );
      }
    );


    test(
      "Analytics Lambda receives only stage-specific analytics resource references",
      () => {
        const {
          template,
        } =
          createStack("dev");

        template
          .hasResourceProperties(
            "AWS::Lambda::Function",
            Match.objectLike({
              Environment:
                Match.objectLike({
                  Variables:
                    Match.objectLike({
                      ANALYTICS_EVENTS_BUCKET:
                        Match.anyValue(),

                      ANALYTICS_TABLE:
                        Match.anyValue(),

                      ANALYTICS_EDGE_TOKEN:
                        Match.anyValue(),

                      STAGE:
                        "dev",
                    }),
                }),

              Timeout:
                12,
            })
          );
      }
    );


    test(
      "Analytics HTTP API exposes the expected control and query routes",
      () => {
        const {
          template,
        } =
          createStack("dev");

        const routes =
          template.findResources(
            "AWS::ApiGatewayV2::Route"
          );

        const routeKeys =
          Object.values(
            routes
          )
            .map(
              (resource: any) =>
                resource
                  ?.Properties
                  ?.RouteKey
            )
            .filter(Boolean);

        expect(
          routeKeys
        ).toEqual(
          expect.arrayContaining([
            "POST /analytics/ingest",
            "GET /analytics/query",
            "GET /analytics/meta",
            "POST /analytics/releases",
            "POST /analytics/boundaries",
          ])
        );
      }
    );


    test(
      "Analytics edge disables caching",
      () => {
        const {
          template,
        } =
          createStack("dev");

        const distributions =
          template.findResources(
            "AWS::CloudFront::Distribution"
          );

        const analyticsDistribution =
          Object.values(
            distributions
          ).find(
            (resource: any) =>
              resource
                ?.Properties
                ?.DistributionConfig
                ?.Comment ===
              "tejas-profile-dev-analytics-edge"
          ) as any;

        expect(
          analyticsDistribution
        ).toBeDefined();

        expect(
          analyticsDistribution
            .Properties
            .DistributionConfig
            .DefaultCacheBehavior
            .CachePolicyId
        ).toBe(
          cloudfront
            .CachePolicy
            .CACHING_DISABLED
            .cachePolicyId
        );
      }
    );


    test(
      "Analytics edge injects the private edge-origin header",
      () => {
        const {
          template,
        } =
          createStack("dev");

        const distributions =
          template.findResources(
            "AWS::CloudFront::Distribution"
          );

        const analyticsDistribution =
          Object.values(
            distributions
          ).find(
            (resource: any) =>
              resource
                ?.Properties
                ?.DistributionConfig
                ?.Comment ===
              "tejas-profile-dev-analytics-edge"
          ) as any;

        const origins =
          analyticsDistribution
            ?.Properties
            ?.DistributionConfig
            ?.Origins ||
          [];

        const hasEdgeToken =
          origins.some(
            (origin: any) =>
              Array.isArray(
                origin
                  ?.OriginCustomHeaders
              ) &&
              origin
                .OriginCustomHeaders
                .some(
                  (
                    header: any
                  ) =>
                    header
                      ?.HeaderName ===
                    "x-analytics-edge-token" &&
                    Boolean(
                      header
                        ?.HeaderValue
                    )
                )
          );

        expect(
          hasEdgeToken
        ).toBe(true);
      }
    );
  }
);