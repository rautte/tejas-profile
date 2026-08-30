/// <reference types="jest" />

import * as cdk from "aws-cdk-lib";

import {
  Match,
  Template,
} from "aws-cdk-lib/assertions";

import {
  FrontendCdnStack,
} from "../lib/frontend-cdn-stack";


const ENV = {
  account:
    "123456789012",

  region:
    "us-east-1",
};


function templateForDev() {
  const app =
    new cdk.App();


  const stack =
    new FrontendCdnStack(
      app,
      "TestFrontendCdnStackDev",
      {
        env:
          ENV,

        stage:
          "dev",
      }
    );


  return Template.fromStack(
    stack
  );
}


describe(
  "FrontendCdnStack",
  () => {

    test(
      "DEV receives one private frontend bucket and one CloudFront distribution",
      () => {
        const template =
          templateForDev();


        template.resourceCountIs(
          "AWS::S3::Bucket",
          1
        );


        template.resourceCountIs(
          "AWS::CloudFront::Distribution",
          1
        );
      }
    );


    test(
      "DEV frontend bucket is disposable and private",
      () => {
        const template =
          templateForDev();


        template.hasResourceProperties(
          "AWS::S3::Bucket",
          {
            PublicAccessBlockConfiguration: {
              BlockPublicAcls:
                true,

              BlockPublicPolicy:
                true,

              IgnorePublicAcls:
                true,

              RestrictPublicBuckets:
                true,
            },

            VersioningConfiguration: {
              Status:
                "Enabled",
            },
          }
        );


        const json =
          template.toJSON();


        const buckets =
          Object.values(
            json.Resources
          ).filter(
            (resource: any) =>
              resource.Type ===
              "AWS::S3::Bucket"
          ) as any[];


        expect(
          buckets
        ).toHaveLength(
          1
        );


        expect(
          buckets[0]
            .DeletionPolicy
        ).toBe(
          "Delete"
        );
      }
    );


    test(
      "CloudFront serves index.html and supports SPA deep links",
      () => {
        const template =
          templateForDev();


        template.hasResourceProperties(
          "AWS::CloudFront::Distribution",
          {
            DistributionConfig: {
              DefaultRootObject:
                "index.html",

              CustomErrorResponses:
                Match.arrayWith([
                  Match.objectLike({
                    ErrorCode:
                      403,

                    ResponseCode:
                      200,

                    ResponsePagePath:
                      "/index.html",
                  }),

                  Match.objectLike({
                    ErrorCode:
                      404,

                    ResponseCode:
                      200,

                    ResponsePagePath:
                      "/index.html",
                  }),
                ]),
            },
          }
        );
      }
    );


    test(
      "DEV uses a dedicated GitHub frontend publisher role",
      () => {
        const template =
          templateForDev();


        template.hasResourceProperties(
          "AWS::IAM::Role",
          {
            RoleName:
              "tejas-profile-github-frontend-dev",
          }
        );
      }
    );


    test(
      "publisher permissions are scoped to frontend publication operations",
      () => {
        const template =
          templateForDev();


        template.hasResourceProperties(
          "AWS::IAM::Policy",
          {
            PolicyDocument: {
              Statement:
                Match.arrayWith([
                  Match.objectLike({
                    Action:
                      "s3:ListBucket",
                  }),

                  Match.objectLike({
                    Action:
                      Match.arrayWith([
                        "s3:GetObject",
                        "s3:PutObject",
                        "s3:DeleteObject",
                      ]),
                  }),

                  Match.objectLike({
                    Action:
                      "cloudfront:CreateInvalidation",
                  }),

                  Match.objectLike({
                    Action:
                      "cloudformation:DescribeStacks",
                  }),
                ]),
            },
          }
        );
      }
    );


    test(
      "DEV exposes stage-scoped frontend discovery outputs",
      () => {
        const template =
          templateForDev();


        template.hasOutput(
          "Stage",
          {
            Value:
              "dev",
          }
        );


        template.hasOutput(
          "BucketName",
          {}
        );


        template.hasOutput(
          "DistributionId",
          {}
        );


        template.hasOutput(
          "FrontendUrl",
          {}
        );


        template.hasOutput(
          "GithubRoleArn",
          {}
        );
      }
    );

  }
);