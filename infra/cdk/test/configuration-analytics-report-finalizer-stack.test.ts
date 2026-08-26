import * as cdk from "aws-cdk-lib";

import {
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
      "TestConfigurationAnalyticsReportFinalizer",
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


function findFinalizerLambda(
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
      ) => {
        const variables =
          resource
            ?.Properties
            ?.Environment
            ?.Variables ||
          {};


        return Boolean(
          variables
            .CONFIGURATION_ANALYTICS_REPORTS_BUCKET &&
          variables
            .USAGE_EPOCH_ANALYTICS_TABLE
        );
      }
    );


  if (!entry) {
    throw new Error(
      "Configuration Analytics Report finalizer Lambda was not found."
    );
  }


  return {
    logicalId:
      entry[0],

    resource:
      entry[1] as any,
  };
}


function findFinalizerPolicies(
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
      "Finalizer Lambda role reference was not found."
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
      resource:
        any
    ) =>
      JSON.stringify(
        resource
          ?.Properties
          ?.Roles ||
        []
      ).includes(
        roleLogicalId
      )
  ) as any[];
}


describe(
  "Configuration Analytics Report finalizer stack",
  () => {
    test(
      "creates an internal scheduled finalizer with stage-local resources",
      () => {
        const template =
          createTemplate();

        const {
          logicalId,
          resource,
        } =
          findFinalizerLambda(
            template
          );


        expect(
          resource
            .Properties
            .MemorySize
        ).toBe(
          512
        );

        expect(
          resource
            .Properties
            .Timeout
        ).toBe(
          120
        );


        expect(
          resource
            .Properties
            .Environment
            .Variables
        ).toEqual(
          expect.objectContaining({
            USAGE_EPOCHS_TABLE:
              expect.anything(),

            USAGE_EPOCH_ANALYTICS_TABLE:
              expect.anything(),

            ANALYTICS_TABLE:
              expect.anything(),

            CONFIGURATION_ANALYTICS_REPORTS_BUCKET:
              expect.anything(),

            STAGE:
              "dev",
          })
        );


        const rules =
          template.findResources(
            "AWS::Events::Rule"
          );


        const scheduledRule =
          Object.values(
            rules
          ).find(
            (
              value:
                any
            ) =>
              value
                ?.Properties
                ?.ScheduleExpression ===
              "rate(15 minutes)"
          ) as any;


        expect(
          scheduledRule
        ).toBeDefined();


        expect(
          JSON.stringify(
            scheduledRule
              .Properties
              .Targets
          )
        ).toContain(
          logicalId
        );
      }
    );


    test(
      "finalizer IAM is narrow and contains no destructive/control-plane authority",
      () => {
        const template =
          createTemplate();

        const {
          resource,
        } =
          findFinalizerLambda(
            template
          );

        const policies =
          findFinalizerPolicies(
            template,

            resource
          );


        const policyJson =
          JSON.stringify(
            policies
          );


        for (
          const required of [
            "dynamodb:GetItem",
            "dynamodb:UpdateItem",
            "dynamodb:Query",
            "dynamodb:BatchGetItem",
            "s3:GetObject",
            "s3:PutObject",
            "ByState",
          ]
        ) {
          expect(
            policyJson
          ).toContain(
            required
          );
        }


        for (
          const forbidden of [
            "dynamodb:Scan",
            "dynamodb:DeleteItem",
            "dynamodb:TransactWriteItems",
            "s3:DeleteObject",
            "s3:ListBucket",
          ]
        ) {
          expect(
            policyJson
          ).not.toContain(
            forbidden
          );
        }
      }
    );


    test(
      "public Active Profile runtime receives no report-finalizer resources",
      () => {
        const template =
          createTemplate();

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
              Boolean(
                resource
                  ?.Properties
                  ?.Environment
                  ?.Variables
                  ?.ACTIVE_PROFILE_ASSET_URL_TTL_SECONDS
              )
          ) as any;


        const variables =
          activeProfile
            ?.Properties
            ?.Environment
            ?.Variables ||
          {};


        expect(
          variables
            .CONFIGURATION_ANALYTICS_REPORTS_BUCKET
        ).toBeUndefined();

        expect(
          variables
            .USAGE_EPOCH_ANALYTICS_TABLE
        ).toBeUndefined();
      }
    );
  }
);