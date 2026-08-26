// infra/cdk/test/deployment-configuration-storage.test.ts

import * as cdk from "aws-cdk-lib";

import {
  Match,
  Template,
} from "aws-cdk-lib/assertions";

import {
  SnapshotsStack,
} from "../lib/snapshots-stack";


const templates =
  new Map<
    "dev" | "prod",
    Template
  >();


function createTemplate(
  stage:
    | "dev"
    | "prod"
) {
  const existing =
    templates.get(
      stage
    );


  if (existing) {
    return existing;
  }


  const app =
    new cdk.App();


  const stack =
    new SnapshotsStack(
      app,
      `TestDeploymentConfigurationStorage-${stage}`,
      {
        stage,

        allowedOrigins:
          stage ===
          "dev"
            ? [
                "http://localhost:3000",
              ]
            : [
                "https://rautte.github.io",
              ],
      }
    );


  const template =
    Template.fromStack(
      stack
    );


  templates.set(
    stage,
    template
  );


  return template;
}


function findBucket(
  template:
    Template,
  bucketName:
    string
) {
  const resources =
    template.findResources(
      "AWS::S3::Bucket"
    );


  const entry =
    Object.entries(
      resources
    ).find(
      (
        [
          ,
          resource,
        ]:
        [
          string,
          any,
        ]
      ) =>
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


function findTable(
  template:
    Template,
  tableName:
    string
) {
  const resources =
    template.findResources(
      "AWS::DynamoDB::Table"
    );


  const entry =
    Object.entries(
      resources
    ).find(
      (
        [
          ,
          resource,
        ]:
        [
          string,
          any,
        ]
      ) =>
        resource
          ?.Properties
          ?.TableName ===
        tableName
    );


  if (!entry) {
    throw new Error(
      `Table "${tableName}" was not found.`
    );
  }


  return entry[1] as any;
}


function findBucketPolicy(
  template:
    Template,
  bucketLogicalId:
    string
) {
  const policies =
    template.findResources(
      "AWS::S3::BucketPolicy"
    );


  const entry =
    Object.entries(
      policies
    ).find(
      (
        [
          ,
          resource,
        ]:
        [
          string,
          any,
        ]
      ) =>
        JSON.stringify(
          resource
            ?.Properties
            ?.Bucket
        ).includes(
          bucketLogicalId
        )
    );


  if (!entry) {
    throw new Error(
      "Deployment Configuration bucket policy was not found."
    );
  }


  return entry[1] as any;
}


describe(
  "Deployment Configuration storage/catalog",
  () => {
    test(
      "DEV and PROD use isolated named Deployment Configuration storage",
      () => {
        const dev =
          createTemplate(
            "dev"
          );

        const prod =
          createTemplate(
            "prod"
          );


        dev.hasResourceProperties(
          "AWS::S3::Bucket",
          {
            BucketName:
              "tejas-profile-dev-deployment-configurations-978416150779",
          }
        );


        prod.hasResourceProperties(
          "AWS::S3::Bucket",
          {
            BucketName:
              "tejas-profile-prod-deployment-configurations-978416150779",
          }
        );


        dev.hasResourceProperties(
          "AWS::DynamoDB::Table",
          {
            TableName:
              "tejas-profile-dev-deployment-configurations-978416150779",
          }
        );


        prod.hasResourceProperties(
          "AWS::DynamoDB::Table",
          {
            TableName:
              "tejas-profile-prod-deployment-configurations-978416150779",
          }
        );
      }
    );


    test(
      "Deployment Configuration documents are private encrypted versioned retained artifacts",
      () => {
        for (
          const [
            stage,
            name,
          ] of [
            [
              "dev",
              "tejas-profile-dev-deployment-configurations-978416150779",
            ],

            [
              "prod",
              "tejas-profile-prod-deployment-configurations-978416150779",
            ],
          ] as const
        ) {
          const template =
            createTemplate(
              stage
            );


          const {
            resource,
          } =
            findBucket(
              template,
              name
            );


          expect(
            resource
              ?.Properties
              ?.PublicAccessBlockConfiguration
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
              ?.Properties
              ?.BucketEncryption
              ?.ServerSideEncryptionConfiguration?.[0]
              ?.ServerSideEncryptionByDefault
              ?.SSEAlgorithm
          ).toBe(
            "AES256"
          );


          expect(
            resource
              ?.Properties
              ?.VersioningConfiguration
              ?.Status
          ).toBe(
            "Enabled"
          );


          expect(
            resource
              ?.Properties
              ?.CorsConfiguration
          ).toBeUndefined();


          expect(
            resource
              ?.DeletionPolicy
          ).toBe(
            "Retain"
          );


          expect(
            resource
              ?.UpdateReplacePolicy
          ).toBe(
            "Retain"
          );
        }
      }
    );


    test(
      "Deployment Configuration document storage enforces HTTPS",
      () => {
        for (
          const [
            stage,
            name,
          ] of [
            [
              "dev",
              "tejas-profile-dev-deployment-configurations-978416150779",
            ],

            [
              "prod",
              "tejas-profile-prod-deployment-configurations-978416150779",
            ],
          ] as const
        ) {
          const template =
            createTemplate(
              stage
            );


          const {
            logicalId,
          } =
            findBucket(
              template,
              name
            );


          const policy =
            findBucketPolicy(
              template,
              logicalId
            );


          const statements =
            policy
              ?.Properties
              ?.PolicyDocument
              ?.Statement ||
            [];


          expect(
            statements.some(
              (
                statement:
                  any
              ) =>
                statement
                  ?.Effect ===
                  "Deny" &&
                JSON.stringify(
                  statement
                    ?.Condition
                ).includes(
                  "aws:SecureTransport"
                ) &&
                JSON.stringify(
                  statement
                    ?.Condition
                ).includes(
                  "false"
                )
            )
          ).toBe(
            true
          );
        }
      }
    );


    test(
      "catalog supports exact configuration lookup and reverse lookup by Profile Variant and Platform Release",
      () => {
        const template =
          createTemplate(
            "dev"
          );


        const table =
          findTable(
            template,
            "tejas-profile-dev-deployment-configurations-978416150779"
          );


        expect(
          table
            ?.Properties
            ?.BillingMode
        ).toBe(
          "PAY_PER_REQUEST"
        );


        expect(
          table
            ?.Properties
            ?.KeySchema
        ).toEqual([
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
        ]);


        expect(
          table
            ?.Properties
            ?.GlobalSecondaryIndexes
        ).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
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
                expect.objectContaining({
                  ProjectionType:
                    "ALL",
                }),
            }),

            expect.objectContaining({
              IndexName:
                "ByPlatformRelease",

              KeySchema: [
                {
                  AttributeName:
                    "gsi2pk",

                  KeyType:
                    "HASH",
                },

                {
                  AttributeName:
                    "gsi2sk",

                  KeyType:
                    "RANGE",
                },
              ],

              Projection:
                expect.objectContaining({
                  ProjectionType:
                    "ALL",
                }),
            }),
          ])
        );
      }
    );


    test(
      "catalog is retained in PROD and disposable in DEV, and both resources are discoverable through outputs",
      () => {
        const dev =
          createTemplate(
            "dev"
          );

        const prod =
          createTemplate(
            "prod"
          );


        const devTable =
          findTable(
            dev,
            "tejas-profile-dev-deployment-configurations-978416150779"
          );

        const prodTable =
          findTable(
            prod,
            "tejas-profile-prod-deployment-configurations-978416150779"
          );


        expect(
          devTable
            .DeletionPolicy
        ).toBe(
          "Delete"
        );


        expect(
          prodTable
            .DeletionPolicy
        ).toBe(
          "Retain"
        );


        dev.hasOutput(
          "DeploymentConfigurationsBucketName",
          {}
        );

        dev.hasOutput(
          "DeploymentConfigurationsTableName",
          {}
        );


        prod.hasOutput(
          "DeploymentConfigurationsBucketName",
          {}
        );

        prod.hasOutput(
          "DeploymentConfigurationsTableName",
          {}
        );
      }
    );
  }
);