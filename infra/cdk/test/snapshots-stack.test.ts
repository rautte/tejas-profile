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


function findBucketByName(
  template: Template,
  bucketName: string
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
      ]) =>
        resource
          ?.Properties
          ?.BucketName ===
        bucketName
    );


  if (!entry) {
    throw new Error(
      `Bucket "${bucketName}" was not found.`
    );
  }


  return {
    logicalId:
      entry[0],

    resource:
      entry[1] as any,
  };
}


function findTableByName(
  template: Template,
  tableName: string
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
      ]) =>
        resource
          ?.Properties
          ?.TableName ===
        tableName
    );


  if (!entry) {
    throw new Error(
      `DynamoDB table "${tableName}" was not found.`
    );
  }


  return {
    logicalId:
      entry[0],

    resource:
      entry[1] as any,
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
          !resource
            ?.Properties
            ?.TableName &&
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
  "SnapshotsStack infrastructure",
  () => {
    test(
      "DEV and PROD use isolated named snapshot, repo and Profile Variant buckets",
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

        dev.hasResourceProperties(
          "AWS::S3::Bucket",
          {
            BucketName:
              "tejas-profile-dev-profile-variants-978416150779",
          }
        );


        prod.hasResourceProperties(
          "AWS::S3::Bucket",
          {
            BucketName:
              "tejas-profile-prod-profile-variants-978416150779",
          }
        );

      }
    );


    test(
      "Profile Variant buckets are private, encrypted, versioned and retained in both stages",
      () => {
        for (
          const stage of [
            "dev",
            "prod",
          ] as const
        ) {
          const {
            template,
          } =
            createStack(
              stage
            );


          const bucketName =
            `tejas-profile-${stage}-profile-variants-978416150779`;


          const {
            resource,
          } =
            findBucketByName(
              template,
              bucketName
            );


          expect(
            resource
              .Properties
              .VersioningConfiguration
          ).toEqual({
            Status:
              "Enabled",
          });


          expect(
            resource
              .Properties
              .BucketEncryption
          ).toEqual(
            expect.objectContaining({
              ServerSideEncryptionConfiguration:
                expect.any(
                  Array
                ),
            })
          );


          expect(
            resource
              .Properties
              .PublicAccessBlockConfiguration
          ).toEqual({
            BlockPublicAcls:
              true,

            BlockPublicPolicy:
              true,

            IgnorePublicAcls:
              true,

            RestrictPublicBuckets:
              true,
          });


          expect(
            resource
              .DeletionPolicy
          ).toBe(
            "Retain"
          );


          expect(
            resource
              .UpdateReplacePolicy
          ).toBe(
            "Retain"
          );
        }
      }
    );


    test(
      "Profile Variant buckets enforce HTTPS",
      () => {
        for (
          const stage of [
            "dev",
            "prod",
          ] as const
        ) {
          const {
            template,
          } =
            createStack(
              stage
            );


          const bucketName =
            `tejas-profile-${stage}-profile-variants-978416150779`;


          const {
            logicalId,
          } =
            findBucketByName(
              template,
              bucketName
            );


          template
            .hasResourceProperties(
              "AWS::S3::BucketPolicy",
              Match.objectLike({
                Bucket: {
                  Ref:
                    logicalId,
                },

                PolicyDocument:
                  Match.objectLike({
                    Statement:
                      Match.arrayWith([
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
                      ]),
                  }),
              })
            );
        }
      }
    );


    test(
      "Profile Variant buckets expose only owner-workflow browser methods through stage-scoped CORS",
      () => {
        const dev =
          createStack("dev")
            .template;

        const prod =
          createStack("prod")
            .template;


        const devBucket =
          findBucketByName(
            dev,
            "tejas-profile-dev-profile-variants-978416150779"
          )
            .resource;


        const prodBucket =
          findBucketByName(
            prod,
            "tejas-profile-prod-profile-variants-978416150779"
          )
            .resource;


        const devRule =
          devBucket
            .Properties
            .CorsConfiguration
            .CorsRules[0];


        const prodRule =
          prodBucket
            .Properties
            .CorsConfiguration
            .CorsRules[0];


        expect(
          devRule
            .AllowedMethods
        ).toEqual(
          expect.arrayContaining([
            "GET",
            "HEAD",
            "PUT",
          ])
        );


        expect(
          devRule
            .AllowedOrigins
        ).toEqual([
          "http://localhost:3000",
        ]);


        expect(
          prodRule
            .AllowedOrigins
        ).toEqual([
          "https://rautte.github.io",
        ]);


        expect(
          devRule
            .AllowedMethods
        ).not.toContain(
          "DELETE"
        );


        expect(
          prodRule
            .AllowedMethods
        ).not.toContain(
          "DELETE"
        );
      }
    );


    test(
      "SnapshotsStack exposes the stage-specific Profile Variant bucket for later publisher discovery",
      () => {
        for (
          const stage of [
            "dev",
            "prod",
          ] as const
        ) {
          const {
            template,
          } =
            createStack(
              stage
            );


          template.hasOutput(
            "ProfileVariantsBucketName",
            {}
          );
        }
      }
    );


    test(
      "DEV and PROD use isolated named Profile Activation tables",
      () => {
        const dev =
          createStack(
            "dev"
          ).template;

        const prod =
          createStack(
            "prod"
          ).template;


        dev.hasResourceProperties(
          "AWS::DynamoDB::Table",
          {
            TableName:
              "tejas-profile-dev-profile-activations-978416150779",

            BillingMode:
              "PAY_PER_REQUEST",

            KeySchema: [
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
            ],
          }
        );


        prod.hasResourceProperties(
          "AWS::DynamoDB::Table",
          {
            TableName:
              "tejas-profile-prod-profile-activations-978416150779",

            BillingMode:
              "PAY_PER_REQUEST",
          }
        );
      }
    );


    test(
      "Profile Activation table indexes activation history by Profile Variant",
      () => {
        const {
          template,
        } =
          createStack(
            "dev"
          );


        template
          .hasResourceProperties(
            "AWS::DynamoDB::Table",
            Match.objectLike({
              TableName:
                "tejas-profile-dev-profile-activations-978416150779",

              GlobalSecondaryIndexes:
                Match.arrayWith([
                  Match.objectLike({
                    IndexName:
                      "ByProfileVariant",

                    KeySchema: [
                      {
                        AttributeName:
                          "gsi1pk",

                        KeyType:
                          "HASH",
                      },

                      {
                        AttributeName:
                          "gsi1sk",

                        KeyType:
                          "RANGE",
                      },
                    ],

                    Projection:
                      Match.objectLike({
                        ProjectionType:
                          "ALL",
                      }),
                  }),
                ]),
            })
          );
      }
    );


    test(
      "Profile Activation history is retained in PROD and disposable in DEV",
      () => {
        for (
          const {
            stage,
            expectedDeletionPolicy,
          } of [
            {
              stage:
                "dev" as const,

              expectedDeletionPolicy:
                "Delete",
            },

            {
              stage:
                "prod" as const,

              expectedDeletionPolicy:
                "Retain",
            },
          ]
        ) {
          const {
            template,
          } =
            createStack(
              stage
            );


          const resources =
            template
              .findResources(
                "AWS::DynamoDB::Table"
              );


          const table =
            Object
              .values(
                resources
              )
              .find(
                (
                  resource: any
                ) =>
                  resource
                    ?.Properties
                    ?.TableName ===
                  `tejas-profile-${stage}-profile-activations-978416150779`
              ) as any;


          expect(
            table
          ).toBeDefined();


          expect(
            table
              .DeletionPolicy
          ).toBe(
            expectedDeletionPolicy
          );
        }
      }
    );


    test(
      "SnapshotsStack exposes the Profile Activation table name",
      () => {
        for (
          const stage of [
            "dev",
            "prod",
          ] as const
        ) {
          const {
            template,
          } =
            createStack(
              stage
            );


          template.hasOutput(
            "ProfileActivationTableName",
            {}
          );
        }
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

                      USAGE_EPOCHS_TABLE:
                        Match.anyValue(),

                      USAGE_EPOCH_ANALYTICS_TABLE:
                        Match.anyValue(),

                      OWNER_TOKEN_SECRET_ID:
                        Match.anyValue(),

                      OWNER_SESSION_SIGNING_KEY_SECRET_ID:
                        Match.anyValue(),

                      ANALYTICS_EDGE_TOKEN_SECRET_ID:
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
      "HTTP API exposes the expected analytics and Profile Variant routes",
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
            "POST /owner/session",
            "POST /owner/passcode/request-change",
            "POST /owner/passcode/confirm-change",
            "POST /analytics/ingest",
            "GET /analytics/query",
            "GET /analytics/meta",
            "POST /analytics/releases",
            "POST /analytics/boundaries",

            "POST /profile-variants/assets/presign-put",
            "POST /profile-variants/publish",
            "GET /profile-variants/get",
            "GET /profile-variants/list",
            "GET /platform-releases/list",
            "GET /profile-activations/list",
            "GET /platform-deployments/list",
            "POST /platform-deployments/commit",
            "POST /profile-variants/activate",

            "GET /profile/active",
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

    test(
      "Snapshots Lambda receives the stage-specific Profile Variant bucket reference",
      () => {
        const {
          template,
        } =
          createStack(
            "dev"
          );


        template
          .hasResourceProperties(
            "AWS::Lambda::Function",
            Match.objectLike({
              Environment:
                Match.objectLike({
                  Variables:
                    Match.objectLike({
                      PROFILE_VARIANTS_BUCKET:
                        Match.anyValue(),

                      STAGE:
                        "dev",
                    }),
                }),
            })
          );
      }
    );

    test(
      "Snapshots Lambda receives the stage-specific Profile Activation table reference",
      () => {
        const {
          template,
        } =
          createStack(
            "dev"
          );


        template.hasResourceProperties(
          "AWS::Lambda::Function",
          Match.objectLike({
            Environment:
              Match.objectLike({
                Variables:
                  Match.objectLike({
                    PROFILE_ACTIVATION_TABLE:
                      Match.anyValue(),

                    STAGE:
                      "dev",
                  }),
              }),
          })
        );
      }
    );

    test(
      "Snapshots Lambda receives the stage-specific Platform Deployment table reference",
      () => {
        const {
          template,
        } =
          createStack(
            "dev"
          );


        template.hasResourceProperties(
          "AWS::Lambda::Function",
          Match.objectLike({
            Environment:
              Match.objectLike({
                Variables:
                  Match.objectLike({
                    PLATFORM_DEPLOYMENT_TABLE:
                      Match.anyValue(),

                    OWNER_TOKEN_SECRET_ID:
                      Match.anyValue(),

                    OWNER_SESSION_SIGNING_KEY_SECRET_ID:
                      Match.anyValue(),

                    STAGE:
                      "dev",
                  }),
              }),
          })
        );
      }
    );

    test(
      "Public Active Profile Lambda receives only runtime Profile resource references and no owner secret",
      () => {
        const {
          template,
        } =
          createStack(
            "dev"
          );


        const lambdas =
          template.findResources(
            "AWS::Lambda::Function"
          );


        const entry =
          Object.entries(
            lambdas
          ).find(
            ([, resource]: [
              string,
              any
            ]) =>
              resource
                ?.Properties
                ?.Environment
                ?.Variables
                ?.ACTIVE_PROFILE_ASSET_URL_TTL_SECONDS ===
              "3600"
          );


        expect(
          entry
        ).toBeDefined();


        const resource =
          entry?.[1] as any;


        const variables =
          resource
            .Properties
            .Environment
            .Variables;


        expect(
          variables
            .PROFILE_ACTIVATION_TABLE
        ).toBeDefined();


        expect(
          variables
            .PROFILE_VARIANTS_BUCKET
        ).toBeDefined();


        expect(
          variables
            .STAGE
        ).toBe(
          "dev"
        );


        expect(
          variables
            .OWNER_TOKEN
        ).toBeUndefined();


        expect(
          variables
            .OWNER_TOKEN_SECRET_ID
        ).toBeUndefined();


        expect(
          variables
            .OWNER_SESSION_SIGNING_KEY_SECRET_ID
        ).toBeUndefined();


        expect(
          variables
            .GITHUB_TOKEN_SECRET_ID
        ).toBeUndefined();


        expect(
          variables
            .ANALYTICS_EDGE_TOKEN
        ).toBeUndefined();


        expect(
          variables
            .ANALYTICS_EDGE_TOKEN_SECRET_ID
        ).toBeUndefined();
      }
    );

    test(
      "Snapshots runtime has no GitHub credential dependency",
      () => {
        for (
          const stage of [
            "dev",
            "prod",
          ] as const
        ) {
          const {
            template,
          } =
            createStack(stage);


          const serialized =
            JSON.stringify(
              template.toJSON()
            );


          expect(
            serialized
          ).not.toContain(
            "GITHUB_TOKEN_SECRET_ID"
          );


          expect(
            serialized
          ).not.toContain(
            "/deploy/trigger"
          );


          expect(
            serialized
          ).not.toContain(
            `tejas-profile/${stage}/github-token`
          );


          expect(
            serialized
          ).not.toContain(
            "GITHUB_WORKFLOW_FILE"
          );


          expect(
            serialized
          ).not.toContain(
            "GITHUB_REPO"
          );
        }
      }
    );

    test(
      "Public Active Profile Lambda has read-only activation and Profile Variant authority",
      () => {
        const {
          template,
        } =
          createStack(
            "dev"
          );


        const lambdas =
          template.findResources(
            "AWS::Lambda::Function"
          );


        const lambdaEntry =
          Object.entries(
            lambdas
          ).find(
            ([, resource]: [
              string,
              any
            ]) =>
              resource
                ?.Properties
                ?.Environment
                ?.Variables
                ?.ACTIVE_PROFILE_ASSET_URL_TTL_SECONDS ===
              "3600"
          );


        expect(
          lambdaEntry
        ).toBeDefined();


        const lambdaResource =
          lambdaEntry?.[1] as any;


        const roleGetAtt =
          lambdaResource
            ?.Properties
            ?.Role
            ?.[
              "Fn::GetAtt"
            ];


        expect(
          Array.isArray(
            roleGetAtt
          )
        ).toBe(true);


        const roleLogicalId =
          roleGetAtt[0];


        expect(
          roleLogicalId
        ).toBeTruthy();


        const policies =
          template.findResources(
            "AWS::IAM::Policy"
          );


        const rolePolicies =
          Object.values(
            policies
          )
            .filter(
              (
                policy: any
              ) =>
                JSON.stringify(
                  policy
                    ?.Properties
                    ?.Roles ||
                  []
                ).includes(
                  roleLogicalId
                )
            ) as any[];


        expect(
          rolePolicies.length
        ).toBeGreaterThan(0);


        const statements =
          rolePolicies
            .flatMap(
              (
                policy: any
              ) =>
                policy
                  ?.Properties
                  ?.PolicyDocument
                  ?.Statement ||
                []
            );


        const actions =
          statements
            .flatMap(
              (
                statement: any
              ) =>
                Array.isArray(
                  statement.Action
                )
                  ? statement.Action
                  : [
                      statement.Action,
                    ]
            )
            .filter(Boolean);


        expect(
          actions
        ).toEqual(
          expect.arrayContaining([
            "dynamodb:GetItem",
            "s3:GetObject",
          ])
        );


        expect(
          actions
        ).not.toContain(
          "dynamodb:TransactWriteItems"
        );


        expect(
          actions
        ).not.toContain(
          "dynamodb:PutItem"
        );


        expect(
          actions
        ).not.toContain(
          "dynamodb:UpdateItem"
        );


        expect(
          actions
        ).not.toContain(
          "dynamodb:DeleteItem"
        );


        expect(
          actions
        ).not.toContain(
          "dynamodb:Scan"
        );


        expect(
          actions
        ).not.toContain(
          "s3:PutObject"
        );


        expect(
          actions
        ).not.toContain(
          "s3:DeleteObject"
        );


        expect(
          actions
        ).not.toContain(
          "s3:DeleteObjectVersion"
        );
      }
    );

    test(
      "SnapshotsStack exposes the public Active Profile API URL",
      () => {
        for (
          const stage of [
            "dev",
            "prod",
          ] as const
        ) {
          const {
            template,
          } =
            createStack(
              stage
            );


          template.hasOutput(
            "ActiveProfileApiUrl",
            {}
          );
        }
      }
    );

    test(
      "Snapshots Lambda can query Profile/Platform history without gaining unconditional mutation or scan authority",
      () => {
        const {
          template,
        } =
          createStack(
            "dev"
          );


        const {
          logicalId:
            profileTableLogicalId,
        } =
          findTableByName(
            template,
            "tejas-profile-dev-profile-activations-978416150779"
          );


        const {
          logicalId:
            platformTableLogicalId,
        } =
          findTableByName(
            template,
            "tejas-profile-dev-platform-deployments-978416150779"
          );


        const policies =
          template.findResources(
            "AWS::IAM::Policy"
          );


        const relevantStatements:
          any[] = [];


        for (
          const policy of
            Object.values(
              policies
            ) as any[]
        ) {
          const statements =
            policy
              ?.Properties
              ?.PolicyDocument
              ?.Statement ||
            [];


          for (
            const statement of
              statements
          ) {
            const resources =
              JSON.stringify(
                statement.Resource
              );


            if (
              resources.includes(
                profileTableLogicalId
              ) ||
              resources.includes(
                platformTableLogicalId
              )
            ) {
              relevantStatements.push(
                statement
              );
            }
          }
        }


        expect(
          relevantStatements.length
        ).toBeGreaterThan(
          0
        );


        const actionsFor =
          (
            statement:
              any
          ) =>
            (
              Array.isArray(
                statement.Action
              )
                ? statement.Action
                : [
                    statement.Action,
                  ]
            ).filter(
              Boolean
            );


        /**
         * Historical read APIs must retain GetItem + Query authority.
         */
        const readActions =
          relevantStatements
            .filter(
              (
                statement:
                  any
              ) =>
                !statement.Condition
            )
            .flatMap(
              actionsFor
            );


        expect(
          readActions
        ).toEqual(
          expect.arrayContaining([
            "dynamodb:GetItem",
            "dynamodb:Query",
          ])
        );


        /**
         * Transaction-only ConditionCheckItem / PutItem authority is
         * valid, but it must never appear as unconditional direct
         * mutation authority.
         */
        const transactionStatement =
          relevantStatements.find(
            (
              statement:
                any
            ) => {
              const actions =
                actionsFor(
                  statement
                );


              return (
                actions.includes(
                  "dynamodb:ConditionCheckItem"
                ) &&
                actions.includes(
                  "dynamodb:PutItem"
                )
              );
            }
          );


        expect(
          transactionStatement
        ).toBeDefined();


        expect(
          transactionStatement
            .Condition
        ).toEqual({
          "ForAnyValue:StringEquals": {
            "dynamodb:EnclosingOperation": [
              "TransactWriteItems",
            ],
          },
        });


        /**
         * Inspect only UNCONDITIONAL statements when enforcing the
         * "no direct mutation" boundary.
         */
        expect(
          readActions
        ).not.toContain(
          "dynamodb:ConditionCheckItem"
        );

        expect(
          readActions
        ).not.toContain(
          "dynamodb:PutItem"
        );

        expect(
          readActions
        ).not.toContain(
          "dynamodb:TransactWriteItems"
        );

        expect(
          readActions
        ).not.toContain(
          "dynamodb:UpdateItem"
        );

        expect(
          readActions
        ).not.toContain(
          "dynamodb:DeleteItem"
        );

        expect(
          readActions
        ).not.toContain(
          "dynamodb:BatchWriteItem"
        );

        expect(
          readActions
        ).not.toContain(
          "dynamodb:Scan"
        );
      }
    );

    test(
      "Usage Epoch lifecycle remains owner-controlled while Analytics receives attribution-only storage references",
      () => {
        const {
          template,
        } =
          createStack(
            "dev"
          );


        const lambdas =
          template.findResources(
            "AWS::Lambda::Function"
          );


        const snapshotsLambda =
          Object.values(
            lambdas
          ).find(
            (
              resource:
                any
            ) =>
              resource
                ?.Properties
                ?.Environment
                ?.Variables
                ?.OWNER_TOKEN_SECRET_ID
          ) as any;


        const analyticsLambda =
          Object.values(
            lambdas
          ).find(
            (
              resource:
                any
            ) =>
              resource
                ?.Properties
                ?.Environment
                ?.Variables
                ?.ANALYTICS_TABLE
          ) as any;


        const activeProfileLambda =
          Object.values(
            lambdas
          ).find(
            (
              resource:
                any
            ) =>
              resource
                ?.Properties
                ?.Environment
                ?.Variables
                ?.ACTIVE_PROFILE_ASSET_URL_TTL_SECONDS
          ) as any;


        expect(
          snapshotsLambda
            ?.Properties
            ?.Environment
            ?.Variables
            ?.USAGE_EPOCHS_TABLE
        ).toBeDefined();


        expect(
          snapshotsLambda
            ?.Properties
            ?.Environment
            ?.Variables
            ?.USAGE_EPOCH_ANALYTICS_TABLE
        ).toBeUndefined();


        expect(
          analyticsLambda
            ?.Properties
            ?.Environment
            ?.Variables
            ?.USAGE_EPOCHS_TABLE
        ).toBeDefined();


        expect(
          analyticsLambda
            ?.Properties
            ?.Environment
            ?.Variables
            ?.USAGE_EPOCH_ANALYTICS_TABLE
        ).toBeDefined();


        expect(
          activeProfileLambda
            ?.Properties
            ?.Environment
            ?.Variables
            ?.USAGE_EPOCHS_TABLE
        ).toBeUndefined();


        expect(
          activeProfileLambda
            ?.Properties
            ?.Environment
            ?.Variables
            ?.USAGE_EPOCH_ANALYTICS_TABLE
        ).toBeUndefined();
      }
    );

    test(
      "owner control-plane Lambda has transaction-only Profile, Platform, and Usage Epoch mutation authority",
      () => {
        const {
          template,
        } =
          createStack(
            "dev"
          );


        const {
          logicalId:
            profileTableLogicalId,
        } =
          findTableByName(
            template,
            "tejas-profile-dev-profile-activations-978416150779"
          );


        const {
          logicalId:
            platformTableLogicalId,
        } =
          findTableByName(
            template,
            "tejas-profile-dev-platform-deployments-978416150779"
          );


        const {
          logicalId:
            usageEpochTableLogicalId,
        } =
          findTableByName(
            template,
            "tejas-profile-dev-usage-epochs-978416150779"
          );


        const policies =
          template.findResources(
            "AWS::IAM::Policy"
          );


        const relevantStatements:
          any[] = [];


        for (
          const policy of
            Object.values(
              policies
            ) as any[]
        ) {
          const statements =
            policy
              ?.Properties
              ?.PolicyDocument
              ?.Statement ||
            [];


          for (
            const statement of
              statements
          ) {
            const resources =
              JSON.stringify(
                statement.Resource
              );


            if (
              resources.includes(
                profileTableLogicalId
              ) &&
              resources.includes(
                platformTableLogicalId
              ) &&
              resources.includes(
                usageEpochTableLogicalId
              )
            ) {
              relevantStatements.push(
                statement
              );
            }
          }
        }


        expect(
          relevantStatements.length
        ).toBeGreaterThan(
          0
        );


        const actionsFor =
          (
            statement:
              any
          ) =>
            (
              Array.isArray(
                statement.Action
              )
                ? statement.Action
                : [
                    statement.Action,
                  ]
            ).filter(
              Boolean
            );


        /**
         * Authoritative reads must remain available outside a
         * transaction because pointer/lifecycle state is read before
         * transaction construction.
         */
        const readStatement =
          relevantStatements.find(
            (
              statement:
                any
            ) =>
              actionsFor(
                statement
              ).includes(
                "dynamodb:GetItem"
              )
          );


        expect(
          readStatement
        ).toBeDefined();


        expect(
          actionsFor(
            readStatement
          )
        ).toContain(
          "dynamodb:GetItem"
        );


        /**
         * DynamoDB authorizes TransactWriteItems through its
         * underlying item operations.
         *
         * Mutation/check authority must therefore exist only when the
         * operation is enclosed by TransactWriteItems.
         */
        const transactionStatement =
          relevantStatements.find(
            (
              statement:
                any
            ) => {
              const actions =
                actionsFor(
                  statement
                );


              return (
                actions.includes(
                  "dynamodb:ConditionCheckItem"
                ) &&
                actions.includes(
                  "dynamodb:PutItem"
                )
              );
            }
          );


        expect(
          transactionStatement
        ).toBeDefined();


        expect(
          actionsFor(
            transactionStatement
          )
        ).toEqual(
          expect.arrayContaining([
            "dynamodb:ConditionCheckItem",
            "dynamodb:PutItem",
          ])
        );


        expect(
          transactionStatement
            .Condition
        ).toEqual({
          "ForAnyValue:StringEquals": {
            "dynamodb:EnclosingOperation": [
              "TransactWriteItems",
            ],
          },
        });


        /**
         * There must be no unconditional control-plane PutItem or
         * ConditionCheckItem permission.
         */
        const unconditionalMutationStatements =
          relevantStatements.filter(
            (
              statement:
                any
            ) => {
              const actions =
                actionsFor(
                  statement
                );

              const hasMutation =
                actions.includes(
                  "dynamodb:ConditionCheckItem"
                ) ||
                actions.includes(
                  "dynamodb:PutItem"
                );


              return (
                hasMutation &&
                !statement.Condition
              );
            }
          );


        expect(
          unconditionalMutationStatements
        ).toHaveLength(
          0
        );


        const actions =
          relevantStatements
            .flatMap(
              actionsFor
            );


        /**
         * TransactWriteItems itself is not the item-level IAM action
         * used to authorize the transaction.
         */
        expect(
          actions
        ).not.toContain(
          "dynamodb:TransactWriteItems"
        );


        /**
         * Transition authority remains deliberately narrower than
         * general DynamoDB mutation authority.
         */
        expect(
          actions
        ).not.toContain(
          "dynamodb:UpdateItem"
        );

        expect(
          actions
        ).not.toContain(
          "dynamodb:DeleteItem"
        );

        expect(
          actions
        ).not.toContain(
          "dynamodb:BatchWriteItem"
        );

        expect(
          actions
        ).not.toContain(
          "dynamodb:Scan"
        );
      }
    );

    test(
      "Snapshots Lambda can inspect/publish Profile Variant objects with prefix-scoped ListBucket and no delete authority",
      () => {
        const {
          template,
        } =
          createStack(
            "dev"
          );


        const {
          logicalId:
            bucketLogicalId,
        } =
          findBucketByName(
            template,
            "tejas-profile-dev-profile-variants-978416150779"
          );


        const policies =
          template.findResources(
            "AWS::IAM::Policy"
          );


        const relevantStatements:
          any[] = [];


        for (
          const policy of
            Object.values(
              policies
            ) as any[]
        ) {
          const statements =
            policy
              ?.Properties
              ?.PolicyDocument
              ?.Statement ||
            [];


          for (
            const statement of
              statements
          ) {
            if (
              JSON.stringify(
                statement.Resource
              ).includes(
                bucketLogicalId
              )
            ) {
              relevantStatements.push(
                statement
              );
            }
          }
        }


        expect(
          relevantStatements.length
        ).toBeGreaterThan(0);


        const actions =
          relevantStatements
            .flatMap(
              (
                statement: any
              ) =>
                Array.isArray(
                  statement.Action
                )
                  ? statement.Action
                  : [
                      statement.Action,
                    ]
            )
            .filter(Boolean);


        expect(
          actions
        ).toEqual(
          expect.arrayContaining([
            "s3:GetObject",
            "s3:PutObject",
          ])
        );


        expect(
          actions
        ).not.toContain(
          "s3:DeleteObject"
        );


        expect(
          actions
        ).not.toContain(
          "s3:DeleteObjectVersion"
        );

        const listStatements =
          relevantStatements
            .filter(
              (
                statement:
                  any
              ) => {
                const statementActions =
                  Array.isArray(
                    statement.Action
                  )
                    ? statement.Action
                    : [
                        statement.Action,
                      ];


                return statementActions
                  .includes(
                    "s3:ListBucket"
                  );
              }
            );


        expect(
          listStatements
        ).toHaveLength(
          2
        );


        const listPrefixes =
          listStatements
            .flatMap(
              (
                statement:
                  any
              ) => {
                const condition =
                  statement
                    ?.Condition ||
                  {};


                const prefix =
                  condition
                    ?.StringEquals
                    ?.["s3:prefix"] ??
                  condition
                    ?.StringLike
                    ?.["s3:prefix"];


                if (
                  Array.isArray(
                    prefix
                  )
                ) {
                  return prefix;
                }


                return prefix
                  ? [
                      prefix,
                    ]
                  : [];
              }
            );


        expect(
          listPrefixes
        ).toHaveLength(
          3
        );


        expect(
          listPrefixes
        ).toEqual(
          expect.arrayContaining([
            "variants/",
            "assets/sha256/",
            "assets/sha256/*",
          ])
        );


        expect(
          listPrefixes
        ).not.toContain(
          "*"
        );

      }
    );

  }
);