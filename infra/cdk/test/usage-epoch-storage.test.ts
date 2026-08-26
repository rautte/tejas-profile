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
      `TestUsageEpochStorage-${stage}`,
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


function findUsageEpochTable(
  template:
    Template
) {
  const tables =
    template.findResources(
      "AWS::DynamoDB::Table"
    );


  const match =
    Object.values(
      tables
    ).find(
      (
        resource:
          any
      ) =>
        String(
          resource
            ?.Properties
            ?.TableName ||
            ""
        ).includes(
          "usage-epochs"
        )
    ) as
      | any
      | undefined;


  if (!match) {
    throw new Error(
      "Usage Epoch table was not found."
    );
  }


  return match;
}


describe(
  "Usage Epoch storage",
  () => {
    test(
      "creates stage-isolated Usage Epoch persistence with the expected keys and indexes",
      () => {
        const template =
          createTemplate(
            "dev"
          );

        const table =
          findUsageEpochTable(
            template
          );


        expect(
          table
            .Properties
            .TableName
        ).toBe(
          "tejas-profile-dev-usage-epochs-978416150779"
        );


        expect(
          table
            .Properties
            .KeySchema
        ).toEqual(
          expect.arrayContaining([
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
          ])
        );


        const indexes =
          table
            .Properties
            .GlobalSecondaryIndexes ||
          [];


        expect(
          indexes.map(
            (
              index:
                any
            ) =>
              index.IndexName
          )
        ).toEqual(
          expect.arrayContaining([
            "ByDeploymentConfiguration",
            "ByState",
          ])
        );
      }
    );


    test(
      "retains PROD Usage Epoch history",
      () => {
        const template =
          createTemplate(
            "prod"
          );

        const table =
          findUsageEpochTable(
            template
          );


        expect(
          table
            .Properties
            .TableName
        ).toBe(
          "tejas-profile-prod-usage-epochs-978416150779"
        );


        expect(
          table
            .DeletionPolicy
        ).toBe(
          "Retain"
        );
      }
    );


    test(
      "exports the stage-local Usage Epoch table name",
      () => {
        const template =
          createTemplate(
            "dev"
          );


        template.hasOutput(
          "UsageEpochsTableName",
          {}
        );
      }
    );
  }
);