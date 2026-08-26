import * as cdk from "aws-cdk-lib";

import {
  Match,
  Template,
} from "aws-cdk-lib/assertions";

import {
  SnapshotsStack,
} from "../lib/snapshots-stack";


let cachedTemplate:
  Template |
  null =
    null;


function createTemplate() {
  if (
    cachedTemplate
  ) {
    return cachedTemplate;
  }


  const app =
    new cdk.App();


  const stack =
    new SnapshotsStack(
      app,
      "TestActiveProfileRuntimeIdentity",
      {
        stage:
          "dev",

        allowedOrigins: [
          "http://localhost:3000",
        ],
      }
    );


  cachedTemplate =
    Template.fromStack(
      stack
    );


  return cachedTemplate;
}


describe(
  "public active Profile runtime identity infrastructure",
  () => {
    test(
      "public runtime Lambda receives Platform deployment/configuration read sources",
      () => {
        createTemplate()
          .hasResourceProperties(
            "AWS::Lambda::Function",
            Match.objectLike({
              Environment: {
                Variables:
                  Match.objectLike({
                    PROFILE_ACTIVATION_TABLE:
                      Match.anyValue(),

                    PROFILE_VARIANTS_BUCKET:
                      Match.anyValue(),

                    PLATFORM_DEPLOYMENT_TABLE:
                      Match.anyValue(),

                    PLATFORM_RELEASES_BUCKET:
                      Match.anyValue(),

                    DEPLOYMENT_CONFIGURATIONS_BUCKET:
                      Match.anyValue(),

                    STAGE:
                      "dev",
                  }),
              },
            })
          );
      }
    );


    test(
      "public runtime has GetItem access to Platform deployment state only",
      () => {
        const policies =
          createTemplate()
            .findResources(
              "AWS::IAM::Policy"
            );


        const statements =
          Object.values(
            policies
          ).flatMap(
            (
              policy:
                any
            ) =>
              policy
                ?.Properties
                ?.PolicyDocument
                ?.Statement ||
              []
          );


        const platformPointerRead =
          statements.find(
            (
              statement:
                any
            ) => {
              const actions =
                Array.isArray(
                  statement.Action
                )
                  ? statement.Action
                  : [
                      statement.Action,
                    ];

              const resource =
                JSON.stringify(
                  statement.Resource
                );


              return (
                actions.length ===
                  1 &&
                actions[0] ===
                  "dynamodb:GetItem" &&
                resource.includes(
                  "PlatformDeploymentTable"
                )
              );
            }
          );


        expect(
          platformPointerRead
        ).toBeDefined();
      }
    );


    test(
      "public runtime reads immutable Platform Release and Deployment Configuration objects without write/list permissions",
      () => {
        const policies =
          createTemplate()
            .findResources(
              "AWS::IAM::Policy"
            );


        const statements =
          Object.values(
            policies
          ).flatMap(
            (
              policy:
                any
            ) =>
              policy
                ?.Properties
                ?.PolicyDocument
                ?.Statement ||
              []
          );


        const immutableRuntimeRead =
          statements.find(
            (
              statement:
                any
            ) => {
              const actions =
                Array.isArray(
                  statement.Action
                )
                  ? statement.Action
                  : [
                      statement.Action,
                    ];

              const resource =
                JSON.stringify(
                  statement.Resource
                );


              return (
                actions.length ===
                  1 &&
                actions[0] ===
                  "s3:GetObject" &&
                resource.includes(
                  "PlatformReleasesBucket"
                ) &&
                resource.includes(
                  "DeploymentConfigurationsBucket"
                )
              );
            }
          );


        expect(
          immutableRuntimeRead
        ).toBeDefined();


        const actions =
          Array.isArray(
            immutableRuntimeRead
              ?.Action
          )
            ? immutableRuntimeRead
                ?.Action
            : [
                immutableRuntimeRead
                  ?.Action,
              ];


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
          "s3:ListBucket"
        );
      }
    );
  }
);