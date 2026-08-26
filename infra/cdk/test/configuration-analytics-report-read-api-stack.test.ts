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
      "TestConfigurationAnalyticsReportReadApi",
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


function findOwnerLambda(
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
            ?.SNAPSHOTS_BUCKET
        )
    );


  if (!entry) {
    throw new Error(
      "Snapshots owner Lambda was not found."
    );
  }


  return {
    logicalId:
      entry[0],

    resource:
      entry[1] as any,
  };
}


function policiesForLambda(
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
      "Owner Lambda role reference was not found."
    );
  }


  const roleLogicalId =
    roleGetAtt[0];


  return Object.values(
    template.findResources(
      "AWS::IAM::Policy"
    )
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
  ) as
    any[];
}


describe(
  "P8F archive read API stack",
  () => {
    test(
      "wires report storage only into the owner API and exposes both owner GET routes",
      () => {
        const template =
          createTemplate();

        const {
          resource,
        } =
          findOwnerLambda(
            template
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

            CONFIGURATION_ANALYTICS_REPORTS_BUCKET:
              expect.anything(),
          })
        );


        template.hasResourceProperties(
          "AWS::ApiGatewayV2::Route",
          {
            RouteKey:
              "GET /usage-epochs/list",
          }
        );


        template.hasResourceProperties(
          "AWS::ApiGatewayV2::Route",
          {
            RouteKey:
              "GET /configuration-analytics-reports/get",
          }
        );


        const lambdas =
          template.findResources(
            "AWS::Lambda::Function"
          );


        const publicRuntime =
          Object.values(
            lambdas
          ).find(
            (
              value:
                any
            ) =>
              Boolean(
                value
                  ?.Properties
                  ?.Environment
                  ?.Variables
                  ?.ACTIVE_PROFILE_ASSET_URL_TTL_SECONDS
              )
          ) as
            any;


        expect(
          publicRuntime
            ?.Properties
            ?.Environment
            ?.Variables
            ?.CONFIGURATION_ANALYTICS_REPORTS_BUCKET
        ).toBeUndefined();
      }
    );


    test(
      "owner archive authority is query/GetObject-only for the new archive resources",
      () => {
        const template =
          createTemplate();

        const {
          resource,
        } =
          findOwnerLambda(
            template
          );

        const policies =
          policiesForLambda(
            template,

            resource
          );


        const statements =
          policies.flatMap(
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


        const usageEpochIndexStatement =
          statements.find(
            (
              statement:
                any
            ) => {
              const resources =
                JSON.stringify(
                  statement
                    ?.Resource
                );


              return (
                resources.includes(
                  "UsageEpochsTable"
                ) &&
                resources.includes(
                  "ByDeploymentConfiguration"
                ) &&
                resources.includes(
                  "ByState"
                )
              );
            }
          );


        expect(
          JSON.stringify(
            usageEpochIndexStatement
              ?.Action
          )
        ).toContain(
          "dynamodb:Query"
        );


        const reportStatement =
          statements.find(
            (
              statement:
                any
            ) =>
              JSON.stringify(
                statement
                  ?.Resource
              ).includes(
                "ConfigurationAnalyticsReportsBucket"
              )
          );


        const reportActions =
          JSON.stringify(
            reportStatement
              ?.Action
          );


        expect(
          reportActions
        ).toContain(
          "s3:GetObject"
        );

        expect(
          reportActions
        ).not.toContain(
          "s3:PutObject"
        );

        expect(
          reportActions
        ).not.toContain(
          "s3:DeleteObject"
        );

        expect(
          reportActions
        ).not.toContain(
          "s3:ListBucket"
        );
      }
    );
  }
);