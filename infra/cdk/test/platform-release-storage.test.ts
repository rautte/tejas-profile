// infra/cdk/test/platform-release-storage.test.ts

import * as cdk from "aws-cdk-lib";

import {
  Template,
} from "aws-cdk-lib/assertions";

import {
  SnapshotsStack,
} from "../lib/snapshots-stack";


function createStack(
  stage:
    | "dev"
    | "prod"
) {
  const app =
    new cdk.App();


  const stack =
    new SnapshotsStack(
      app,
      `TestPlatformReleaseStorage-${stage}`,
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


  return Template.fromStack(
    stack
  );
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


function findBucketPolicy(
  template: Template,
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
      "Platform Release bucket policy was not found."
    );
  }


  return entry[1] as any;
}


describe(
  "Platform Release storage",
  () => {
    test(
      "DEV and PROD use isolated named Platform Release buckets",
      () => {
        const dev =
          createStack(
            "dev"
          );

        const prod =
          createStack(
            "prod"
          );


        dev.hasResourceProperties(
          "AWS::S3::Bucket",
          {
            BucketName:
              "tejas-profile-dev-platform-releases-978416150779",
          }
        );


        prod.hasResourceProperties(
          "AWS::S3::Bucket",
          {
            BucketName:
              "tejas-profile-prod-platform-releases-978416150779",
          }
        );
      }
    );


    test(
      "Platform Release buckets are private encrypted versioned retained artifacts",
      () => {
        for (
          const [
            stage,
            name,
          ] of [
            [
              "dev",
              "tejas-profile-dev-platform-releases-978416150779",
            ],

            [
              "prod",
              "tejas-profile-prod-platform-releases-978416150779",
            ],
          ] as const
        ) {
          const template =
            createStack(
              stage
            );


          const {
            resource,
          } =
            findBucketByName(
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
      "Platform Release storage is backend-only and exposes no browser CORS",
      () => {
        const template =
          createStack(
            "dev"
          );


        const {
          resource,
        } =
          findBucketByName(
            template,
            "tejas-profile-dev-platform-releases-978416150779"
          );


        expect(
          resource
            ?.Properties
            ?.CorsConfiguration
        ).toBeUndefined();
      }
    );


    test(
      "Platform Release buckets enforce HTTPS",
      () => {
        for (
          const [
            stage,
            name,
          ] of [
            [
              "dev",
              "tejas-profile-dev-platform-releases-978416150779",
            ],

            [
              "prod",
              "tejas-profile-prod-platform-releases-978416150779",
            ],
          ] as const
        ) {
          const template =
            createStack(
              stage
            );


          const {
            logicalId,
          } =
            findBucketByName(
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


          const sslDeny =
            statements.find(
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
            );


          expect(
            sslDeny
          ).toBeDefined();
        }
      }
    );


    test(
      "SnapshotsStack exposes the stage-specific Platform Release bucket",
      () => {
        const dev =
          createStack(
            "dev"
          );

        const prod =
          createStack(
            "prod"
          );


        dev.hasOutput(
          "PlatformReleasesBucketName",
          {}
        );


        prod.hasOutput(
          "PlatformReleasesBucketName",
          {}
        );
      }
    );
  }
);