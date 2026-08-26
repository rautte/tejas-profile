import * as cdk from "aws-cdk-lib";

import {
  Match,
  Template,
} from "aws-cdk-lib/assertions";

import {
  SnapshotsStack,
} from "../lib/snapshots-stack";


function createTemplate(
  stage:
    | "dev"
    | "prod" =
      "dev"
) {
  const app =
    new cdk.App();


  const stack =
    new SnapshotsStack(
      app,
      `TestPlatformReleaseApi-${stage}`,
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


  return Template.fromStack(
    stack
  );
}


function platformReleaseBucketLogicalId(
  template:
    Template
) {
  const buckets =
    template.findResources(
      "AWS::S3::Bucket"
    );


  const entry =
    Object.entries(
      buckets
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
        String(
          resource
            ?.Properties
            ?.BucketName ||
          ""
        ).includes(
          "platform-releases"
        )
    );


  if (!entry) {
    throw new Error(
      "Platform Release bucket was not found."
    );
  }


  return entry[0];
}


describe(
  "Platform Release API infrastructure",
  () => {
    test(
      "Snapshots API receives the stage-specific Platform Release bucket",
      () => {
        const template =
          createTemplate(
            "dev"
          );


        template
          .hasResourceProperties(
            "AWS::Lambda::Function",
            Match.objectLike({
              Environment: {
                Variables:
                  Match.objectLike({
                    PLATFORM_RELEASES_BUCKET:
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
      "exposes owner control-plane register, get and list routes",
      () => {
        const template =
          createTemplate();


        template
          .hasResourceProperties(
            "AWS::ApiGatewayV2::Route",
            {
              RouteKey:
                "POST /platform-releases/register",
            }
          );


        template
          .hasResourceProperties(
            "AWS::ApiGatewayV2::Route",
            {
              RouteKey:
                "GET /platform-releases/get",
            }
          );

        template
          .hasResourceProperties(
            "AWS::ApiGatewayV2::Route",
            {
              RouteKey:
                "GET /platform-releases/list",
            }
          );

      }
    );


    test(
      "Platform Release object IAM remains immutable while catalog listing is exact-prefix scoped",
      () => {
        const template =
          createTemplate();


        const bucketLogicalId =
          platformReleaseBucketLogicalId(
            template
          );


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
            ) => {
              const resource =
                JSON.stringify(
                  statement
                    ?.Resource
                );


              return (
                resource.includes(
                  bucketLogicalId
                ) &&
                resource.includes(
                  "releases/*"
                )
              );
            }
          );


        expect(
          matching.length
        ).toBeGreaterThan(
          0
        );


        /**
         * P5E3 introduced a second legitimate consumer of the same
         * immutable Platform Release objects:
         *
         * SnapshotsApiHandler
         *   → GetObject + PutObject
         *
         * ActiveProfileApiHandler
         *   → GetObject only
         *
         * Therefore resource matching alone can no longer imply that
         * every matching IAM statement is the registration writer.
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
         * Object-level access remains immutable.
         *
         * ListBucket is a separate bucket-level owner catalog
         * permission and is checked independently below.
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

        const listStatements =
          statements.filter(
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
                actions.includes(
                  "s3:ListBucket"
                ) &&
                resource.includes(
                  bucketLogicalId
                )
              );
            }
          );


        expect(
          listStatements
        ).toHaveLength(
          1
        );


        expect(
          listStatements[0]
            ?.Condition
        ).toMatchObject({
          StringEquals: {
            "s3:prefix":
              "releases/",
          },
        });

      }
    );


    test(
      "does not expose a Platform Release delete route",
      () => {
        const template =
          createTemplate();


        const routes =
          Object.values(
            template.findResources(
              "AWS::ApiGatewayV2::Route"
            )
          ).map(
            (
              resource:
                any
            ) =>
              String(
                resource
                  ?.Properties
                  ?.RouteKey ||
                ""
              )
          );


        expect(
          routes.some(
            (
              route
            ) =>
              route.includes(
                "DELETE /platform-releases"
              )
          )
        ).toBe(
          false
        );
      }
    );
  }
);