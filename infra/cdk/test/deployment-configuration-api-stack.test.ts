// infra/cdk/test/deployment-configuration-api-stack.test.ts

import * as cdk from "aws-cdk-lib";

import {
  Match,
  Template,
} from "aws-cdk-lib/assertions";

import {
  SnapshotsStack,
} from "../lib/snapshots-stack";


function createTemplate() {
  const app =
    new cdk.App();


  const stack =
    new SnapshotsStack(
      app,
      "TestDeploymentConfigurationApi",
      {
        stage:
          "dev",

        allowedOrigins: [
          "http://localhost:3000",
        ],
      }
    );


  return Template.fromStack(
    stack
  );
}


describe(
  "Deployment Configuration API infrastructure",
  () => {
    test(
      "Snapshots API receives Deployment Configuration bucket and catalog table",
      () => {
        const template =
          createTemplate();


        template
          .hasResourceProperties(
            "AWS::Lambda::Function",
            Match.objectLike({
              Environment: {
                Variables:
                  Match.objectLike({
                    DEPLOYMENT_CONFIGURATIONS_BUCKET:
                      Match.anyValue(),

                    DEPLOYMENT_CONFIGURATIONS_TABLE:
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
      "exposes create get and list Deployment Configuration routes",
      () => {
        const template =
          createTemplate();


        for (
          const routeKey of [
            "POST /deployment-configurations/create",
            "GET /deployment-configurations/get",
            "GET /deployment-configurations/list",
          ]
        ) {
          template
            .hasResourceProperties(
              "AWS::ApiGatewayV2::Route",
              {
                RouteKey:
                  routeKey,
              }
            );
        }
      }
    );


    test(
      "Deployment Configuration S3 access is immutable GetObject PutObject only",
      () => {
        const template =
          createTemplate();

        const policies =
          template.findResources(
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


        const matching =
          statements.filter(
            (
              statement:
                any
            ) =>
              JSON.stringify(
                statement
                  ?.Resource
              ).includes(
                "DeploymentConfigurationsBucket"
              ) &&
              JSON.stringify(
                statement
                  ?.Resource
              ).includes(
                "configurations/*"
              )
          );


        expect(
          matching.length
        ).toBeGreaterThan(
          0
        );


        /**
         * Deployment Configuration storage now has two legitimate
         * consumers:
         *
         * SnapshotsApiHandler
         *   → immutable creation/read: GetObject + PutObject
         *
         * ActiveProfileApiHandler
         *   → runtime verification: GetObject only
         *
         * Do not confuse read-only runtime access with write access.
         */
        const writerStatements =
          matching.filter(
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


              return actions.includes(
                "s3:PutObject"
              );
            }
          );


        expect(
          writerStatements
        ).toHaveLength(
          1
        );


        const writerActions =
          Array.isArray(
            writerStatements[0]
              ?.Action
          )
            ? writerStatements[0]
                .Action
            : [
                writerStatements[0]
                  ?.Action,
              ];


        expect(
          writerActions
        ).toEqual(
          expect.arrayContaining([
            "s3:GetObject",
            "s3:PutObject",
          ])
        );


        /**
         * S3 configuration truth remains immutable for every
         * principal using this prefix.
         */
        for (
          const statement of
            matching
        ) {
          const actions =
            Array.isArray(
              statement.Action
            )
              ? statement.Action
              : [
                  statement.Action,
                ];


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

          expect(
            actions
          ).not.toContain(
            "s3:ListBucket"
          );
        }
      }
    );


    test(
      "catalog permissions allow PutItem and GSI Query without mutation or scans",
      () => {
        const template =
          createTemplate();

        const policies =
          template.findResources(
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


        const relevant =
          statements.filter(
            (
              statement:
                any
            ) =>
              JSON.stringify(
                statement
                  ?.Resource
              ).includes(
                "DeploymentConfigurationsTable"
              )
          );


        const actions =
          relevant.flatMap(
            (
              statement:
                any
            ) =>
              Array.isArray(
                statement.Action
              )
                ? statement.Action
                : [
                    statement.Action,
                  ]
          );


        expect(
          actions
        ).toEqual(
          expect.arrayContaining([
            "dynamodb:PutItem",
            "dynamodb:Query",
          ])
        );


        expect(
          actions
        ).not.toContain(
          "dynamodb:DeleteItem"
        );

        expect(
          actions
        ).not.toContain(
          "dynamodb:UpdateItem"
        );

        expect(
          actions
        ).not.toContain(
          "dynamodb:Scan"
        );
      }
    );
  }
);