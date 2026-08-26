import * as cdk from "aws-cdk-lib";

import {
  Template,
} from "aws-cdk-lib/assertions";

import {
  SnapshotsStack,
} from "../lib/snapshots-stack";


function createTemplate(
  stage:
    | "dev"
    | "prod"
) {
  const app =
    new cdk.App();

  const stack =
    new SnapshotsStack(
      app,
      `TestConfigurationAnalyticsReportStorage-${stage}`,
      {
        stage,

        allowedOrigins: [
          "http://localhost:3000",
        ],
      }
    );


  return Template.fromStack(
    stack
  );
}


function findReportBucket(
  template:
    Template
) {
  const buckets =
    template.findResources(
      "AWS::S3::Bucket"
    );


  const match =
    Object.entries(
      buckets
    ).find(
      (
        [
          ,
          resource,
        ]
      ) =>
        String(
          (
            resource as any
          )
            ?.Properties
            ?.BucketName ||
          ""
        ).includes(
          "configuration-analytics-reports"
        )
    );


  if (!match) {
    throw new Error(
      "Configuration Analytics Reports bucket was not found."
    );
  }


  return {
    logicalId:
      match[0],

    resource:
      match[1] as any,
  };
}


describe(
  "Configuration Analytics Report storage",
  () => {
    test(
      "DEV and PROD use isolated named report buckets",
      () => {
        const dev =
          findReportBucket(
            createTemplate(
              "dev"
            )
          );

        const prod =
          findReportBucket(
            createTemplate(
              "prod"
            )
          );


        expect(
          dev.resource
            .Properties
            .BucketName
        ).toBe(
          "tejas-profile-dev-configuration-analytics-reports-978416150779"
        );

        expect(
          prod.resource
            .Properties
            .BucketName
        ).toBe(
          "tejas-profile-prod-configuration-analytics-reports-978416150779"
        );
      }
    );


    test(
      "report buckets are private encrypted versioned retained historical storage",
      () => {
        for (
          const stage of
            [
              "dev",
              "prod",
            ] as const
        ) {
          const {
            resource,
          } =
            findReportBucket(
              createTemplate(
                stage
              )
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
              .ServerSideEncryptionConfiguration[
                0
              ]
              .ServerSideEncryptionByDefault
              .SSEAlgorithm
          ).toBe(
            "AES256"
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
      "report storage has no browser CORS and no expiration lifecycle",
      () => {
        for (
          const stage of
            [
              "dev",
              "prod",
            ] as const
        ) {
          const {
            resource,
          } =
            findReportBucket(
              createTemplate(
                stage
              )
            );


          expect(
            resource
              .Properties
              .CorsConfiguration
          ).toBeUndefined();

          expect(
            resource
              .Properties
              .LifecycleConfiguration
          ).toBeUndefined();
        }
      }
    );


    test(
      "SnapshotsStack exposes the stage-specific report bucket",
      () => {
        const template =
          createTemplate(
            "dev"
          );

        const {
          logicalId,
        } =
          findReportBucket(
            template
          );

        const outputs =
          template.findOutputs(
            "ConfigurationAnalyticsReportsBucketName"
          );


        expect(
          outputs
            .ConfigurationAnalyticsReportsBucketName
            .Value
        ).toEqual({
          Ref:
            logicalId,
        });
      }
    );
  }
);