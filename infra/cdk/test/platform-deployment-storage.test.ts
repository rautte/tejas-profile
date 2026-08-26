import * as cdk from "aws-cdk-lib";

import {
  Template,
} from "aws-cdk-lib/assertions";

import {
  SnapshotsStack,
} from "../lib/snapshots-stack";


const templates =
  new Map<
    "dev" |
    "prod",
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


  if (
    existing
  ) {
    return existing;
  }


  const app =
    new cdk.App();


  const stack =
    new SnapshotsStack(
      app,
      `TestPlatformDeploymentStorage-${stage}`,
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


  if (
    !entry
  ) {
    throw new Error(
      `Table "${tableName}" was not found.`
    );
  }


  return entry[1] as any;
}


describe(
  "Platform Deployment persistence",
  () => {
    test(
      "DEV and PROD use isolated Platform Deployment tables",
      () => {
        createTemplate(
          "dev"
        ).hasResourceProperties(
          "AWS::DynamoDB::Table",
          {
            TableName:
              "tejas-profile-dev-platform-deployments-978416150779",
          }
        );


        createTemplate(
          "prod"
        ).hasResourceProperties(
          "AWS::DynamoDB::Table",
          {
            TableName:
              "tejas-profile-prod-platform-deployments-978416150779",
          }
        );
      }
    );


    test(
      "Platform Deployment table uses exact control-plane primary keys and PAY_PER_REQUEST",
      () => {
        const table =
          findTable(
            createTemplate(
              "dev"
            ),

            "tejas-profile-dev-platform-deployments-978416150779"
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
      }
    );


    test(
      "Platform Deployment history is queryable by immutable Platform Release",
      () => {
        const table =
          findTable(
            createTemplate(
              "dev"
            ),

            "tejas-profile-dev-platform-deployments-978416150779"
          );


        expect(
          table
            ?.Properties
            ?.GlobalSecondaryIndexes
        ).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              IndexName:
                "ByPlatformRelease",

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
          ])
        );
      }
    );


    test(
      "Platform Deployment history is retained in PROD and disposable in DEV",
      () => {
        const devTable =
          findTable(
            createTemplate(
              "dev"
            ),

            "tejas-profile-dev-platform-deployments-978416150779"
          );

        const prodTable =
          findTable(
            createTemplate(
              "prod"
            ),

            "tejas-profile-prod-platform-deployments-978416150779"
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


        expect(
          prodTable
            .UpdateReplacePolicy
        ).toBe(
          "Retain"
        );
      }
    );


    test(
      "Platform Deployment table is discoverable through stack output",
      () => {
        createTemplate(
          "dev"
        ).hasOutput(
          "PlatformDeploymentTableName",
          {}
        );


        createTemplate(
          "prod"
        ).hasOutput(
          "PlatformDeploymentTableName",
          {}
        );
      }
    );
  }
);