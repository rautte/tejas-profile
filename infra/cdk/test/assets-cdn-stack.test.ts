/// <reference types="jest" />

import * as cdk from "aws-cdk-lib";

import {
  Match,
  Template,
} from "aws-cdk-lib/assertions";

import {
  AssetsCdnStack,
  AssetsStage,
} from "../lib/assets-cdn-stack";


const ENV = {
  account:
    "123456789012",

  region:
    "us-east-1",
};


function templateFor(
  stage: AssetsStage
) {
  const app =
    new cdk.App();


  const stack =
    new AssetsCdnStack(
      app,
      `TestAssetsStack-${stage}`,
      {
        env:
          ENV,

        stage,
      }
    );


  return Template.fromStack(
    stack
  );
}


describe(
  "AssetsCdnStack",
  () => {

    test(
      "DEV and PROD each receive two private asset buckets and one CloudFront distribution",
      () => {
        const prod =
          templateFor(
            "prod"
          );

        const dev =
          templateFor(
            "dev"
          );


        prod.resourceCountIs(
          "AWS::S3::Bucket",
          2
        );

        dev.resourceCountIs(
          "AWS::S3::Bucket",
          2
        );


        prod.resourceCountIs(
          "AWS::CloudFront::Distribution",
          1
        );

        dev.resourceCountIs(
          "AWS::CloudFront::Distribution",
          1
        );
      }
    );


    test(
      "PROD owns the existing GitHub OIDC provider while DEV does not duplicate it",
      () => {
        const prod =
          templateFor(
            "prod"
          );

        const dev =
          templateFor(
            "dev"
          );


        prod.resourceCountIs(
          "Custom::AWSCDKOpenIdConnectProvider",
          1
        );

        dev.resourceCountIs(
          "Custom::AWSCDKOpenIdConnectProvider",
          0
        );
      }
    );


    test(
      "PROD and DEV use different GitHub deployer roles",
      () => {
        const prod =
          templateFor(
            "prod"
          );

        const dev =
          templateFor(
            "dev"
          );


        prod.hasResourceProperties(
          "AWS::IAM::Role",
          {
            RoleName:
              "tejas-profile-github-deployer",
          }
        );


        dev.hasResourceProperties(
          "AWS::IAM::Role",
          {
            RoleName:
              "tejas-profile-github-assets-dev",
          }
        );
      }
    );


    test(
      "PROD buckets are retained while DEV buckets are disposable",
      () => {
        const prodTemplate =
          templateFor(
            "prod"
          ).toJSON();

        const devTemplate =
          templateFor(
            "dev"
          ).toJSON();


        const prodBuckets =
          Object.values(
            prodTemplate.Resources
          ).filter(
            (resource: any) =>
              resource.Type ===
              "AWS::S3::Bucket"
          );


        const devBuckets =
          Object.values(
            devTemplate.Resources
          ).filter(
            (resource: any) =>
              resource.Type ===
              "AWS::S3::Bucket"
          );


        expect(
          prodBuckets
        ).toHaveLength(
          2
        );


        expect(
          devBuckets
        ).toHaveLength(
          2
        );


        for (
          const resource
          of prodBuckets as any[]
        ) {
          expect(
            resource.DeletionPolicy
          ).toBe(
            "Retain"
          );
        }


        for (
          const resource
          of devBuckets as any[]
        ) {
          expect(
            resource.DeletionPolicy
          ).toBe(
            "Delete"
          );
        }
      }
    );


    test(
      "CloudFront keeps the geo dataset on a dedicated geo behavior",
      () => {
        for (
          const stage
          of [
            "dev",
            "prod",
          ] as AssetsStage[]
        ) {
          const template =
            templateFor(
              stage
            );


          template.hasResourceProperties(
            "AWS::CloudFront::Distribution",
            {
              DistributionConfig: {
                CacheBehaviors:
                  Match.arrayWith([
                    Match.objectLike({
                      PathPattern:
                        "geo/*",
                    }),
                  ]),
              },
            }
          );
        }
      }
    );


    test(
      "both environments expose stage-scoped asset discovery outputs",
      () => {
        for (
          const stage
          of [
            "dev",
            "prod",
          ] as AssetsStage[]
        ) {
          const template =
            templateFor(
              stage
            );


          template.hasOutput(
            "Stage",
            {
              Value:
                stage,
            }
          );


          template.hasOutput(
            "BucketName",
            {}
          );


          template.hasOutput(
            "GeoBucketName",
            {}
          );


          template.hasOutput(
            "DistributionId",
            {}
          );


          template.hasOutput(
            "CdnUrl",
            {}
          );


          template.hasOutput(
            "GithubRoleArn",
            {}
          );


          template.hasOutput(
            "GeoDatasetUrl",
            {}
          );
        }
      }
    );

  }
);