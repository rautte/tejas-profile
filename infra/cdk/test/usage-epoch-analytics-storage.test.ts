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
      `TestUsageEpochAnalytics-${stage}`,
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


function findTableByName(
  template:
    Template,

  tableName:
    string
) {
  const tables =
    template.findResources(
      "AWS::DynamoDB::Table"
    );

  const entry =
    Object.entries(
      tables
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


  return {
    logicalId:
      entry[0],

    resource:
      entry[1] as any,
  };
}


function findAnalyticsLambda(
  template:
    Template
) {
  const lambdas =
    template.findResources(
      "AWS::Lambda::Function"
    );

  const entry =
    Object.entries(
      lambdas
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
        Boolean(
          resource
            ?.Properties
            ?.Environment
            ?.Variables
            ?.ANALYTICS_TABLE
        )
    );


  if (!entry) {
    throw new Error(
      "Analytics Lambda was not found."
    );
  }


  return {
    logicalId:
      entry[0],

    resource:
      entry[1] as any,
  };
}


function lambdaRolePolicies(
  template:
    Template,

  lambdaResource:
    any
) {
  const roleGetAtt =
    lambdaResource
      ?.Properties
      ?.Role
      ?.[
        "Fn::GetAtt"
      ];

  if (
    !Array.isArray(
      roleGetAtt
    )
  ) {
    throw new Error(
      "Lambda role reference was not found."
    );
  }


  const roleLogicalId =
    roleGetAtt[0];

  const policies =
    template.findResources(
      "AWS::IAM::Policy"
    );


  return Object.values(
    policies
  ).filter(
    (
      policy:
        any
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
}


function statementsForResource(
  policies:
    any[],

  logicalId:
    string
) {
  return policies
    .flatMap(
      (
        policy:
          any
      ) =>
        policy
          ?.Properties
          ?.PolicyDocument
          ?.Statement ||
        []
    )
    .filter(
      (
        statement:
          any
      ) =>
        JSON.stringify(
          statement.Resource
        ).includes(
          logicalId
        )
    );
}


function actionsFromStatements(
  statements:
    any[]
) {
  return statements
    .flatMap(
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
    )
    .filter(
      Boolean
    );
}


describe(
  "Usage Epoch Analytics projection storage",
  () => {
    test(
      "DEV and PROD use isolated named projection tables",
      () => {
        const dev =
          findTableByName(
            createTemplate(
              "dev"
            ),

            "tejas-profile-dev-usage-epoch-analytics-978416150779"
          );

        const prod =
          findTableByName(
            createTemplate(
              "prod"
            ),

            "tejas-profile-prod-usage-epoch-analytics-978416150779"
          );


        for (
          const table of [
            dev,
            prod,
          ]
        ) {
          expect(
            table.resource
              .Properties
              .BillingMode
          ).toBe(
            "PAY_PER_REQUEST"
          );

          expect(
            table.resource
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

          expect(
            table.resource
              .Properties
              .GlobalSecondaryIndexes
          ).toBeUndefined();
        }


        expect(
          dev.resource
            .DeletionPolicy
        ).toBe(
          "Delete"
        );

        expect(
          prod.resource
            .DeletionPolicy
        ).toBe(
          "Retain"
        );
      }
    );


    test(
      "Analytics receives Usage Epoch attribution references but public Profile runtime does not",
      () => {
        const template =
          createTemplate(
            "dev"
          );

        const {
          resource:
            analyticsLambda,
        } =
          findAnalyticsLambda(
            template
          );


        const variables =
          analyticsLambda
            .Properties
            .Environment
            .Variables;


        expect(
          variables
            .USAGE_EPOCHS_TABLE
        ).toBeDefined();

        expect(
          variables
            .USAGE_EPOCH_ANALYTICS_TABLE
        ).toBeDefined();


        const lambdas =
          template.findResources(
            "AWS::Lambda::Function"
          );

        const activeProfile =
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
          activeProfile
            ?.Properties
            ?.Environment
            ?.Variables
            ?.USAGE_EPOCHS_TABLE
        ).toBeUndefined();

        expect(
          activeProfile
            ?.Properties
            ?.Environment
            ?.Variables
            ?.USAGE_EPOCH_ANALYTICS_TABLE
        ).toBeUndefined();
      }
    );


    test(
      "Analytics has read-only Usage Epoch resolution and append-only projection authority",
      () => {
        const template =
          createTemplate(
            "dev"
          );


        const {
          logicalId:
            usageEpochLogicalId,
        } =
          findTableByName(
            template,

            "tejas-profile-dev-usage-epochs-978416150779"
          );


        const {
          logicalId:
            projectionLogicalId,
        } =
          findTableByName(
            template,

            "tejas-profile-dev-usage-epoch-analytics-978416150779"
          );


        const {
          resource:
            analyticsLambda,
        } =
          findAnalyticsLambda(
            template
          );


        const policies =
          lambdaRolePolicies(
            template,

            analyticsLambda
          );


        const usageStatements =
          statementsForResource(
            policies,

            usageEpochLogicalId
          );

        const usageActions =
          actionsFromStatements(
            usageStatements
          );


        expect(
          usageActions
        ).toEqual(
          expect.arrayContaining([
            "dynamodb:GetItem",
            "dynamodb:Query",
          ])
        );


        for (
          const forbidden of [
            "dynamodb:PutItem",
            "dynamodb:UpdateItem",
            "dynamodb:DeleteItem",
            "dynamodb:TransactWriteItems",
            "dynamodb:BatchWriteItem",
            "dynamodb:Scan",
          ]
        ) {
          expect(
            usageActions
          ).not.toContain(
            forbidden
          );
        }


        const usageResources =
          JSON.stringify(
            usageStatements.map(
              (
                statement:
                  any
              ) =>
                statement.Resource
            )
          );


        expect(
          usageResources
        ).toContain(
          "ByDeploymentConfiguration"
        );


        const projectionStatements =
          statementsForResource(
            policies,

            projectionLogicalId
          );

        const projectionActions =
          actionsFromStatements(
            projectionStatements
          );


        expect(
          projectionActions
        ).toEqual([
          "dynamodb:PutItem",
        ]);
      }
    );


    test(
      "SnapshotsStack exposes the stage-specific projection table",
      () => {
        const template =
          createTemplate(
            "dev"
          );

        const {
          logicalId,
        } =
          findTableByName(
            template,

            "tejas-profile-dev-usage-epoch-analytics-978416150779"
          );


        const outputs =
          template.findOutputs(
            "UsageEpochAnalyticsTableName"
          );


        expect(
          outputs
            .UsageEpochAnalyticsTableName
            .Value
        ).toEqual({
          Ref:
            logicalId,
        });
      }
    );
  }
);