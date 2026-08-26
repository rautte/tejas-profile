// infra/cdk/test/analytics-handler.test.ts
import {
  marshall,
  unmarshall,
} from "@aws-sdk/util-dynamodb";

import {
  computeDeploymentConfigurationId,
  normalizeAndValidateDeploymentConfigurationDocument,
} from "../lambda/deployment-configuration-contract";

import {
  USAGE_EPOCH_TRANSITION_KIND,
  buildActiveUsageEpochPointer,
  createOpenUsageEpochDocument,
} from "../lambda/usage-epoch-contract";


const TABLE =
  "analytics-table-test";

const BUCKET =
  "analytics-events-test";

const OWNER_TOKEN =
  "unit-test-owner-token";

const EDGE_TOKEN =
  "unit-test-edge-token";

const USAGE_EPOCH_TABLE =
  "usage-epoch-table-test";

const USAGE_EPOCH_ANALYTICS_TABLE =
  "usage-epoch-analytics-table-test";


function responseBody(
  response: any
) {
  return response?.body
    ? JSON.parse(
        response.body
      )
    : null;
}


function event(
  {
    path =
      "/analytics/ingest",

    method =
      "POST",

    headers = {},

    body,

    queryStringParameters,
  }: {
    path?: string;

    method?: string;

    headers?:
      Record<string, string>;

    body?: any;

    queryStringParameters?:
      Record<string, string>;
  } = {}
) {
  return {
    rawPath:
      path,

    headers:
      path ===
        "/analytics/ingest"
        ? {
            "x-analytics-edge-token":
              EDGE_TOKEN,

            ...headers,
          }
        : headers,

    body:
      body === undefined
        ? undefined
        : JSON.stringify(
            body
          ),

    queryStringParameters,

    requestContext: {
      http: {
        method,
      },
    },
  };
}

function formalRuntimeConfiguration() {
  const stage =
    "dev" as const;

  const platformReleaseId =
    "plr_analytics_projection";

  const profileVariantId =
    "prv_analytics_projection";

  const deploymentConfigurationId =
    computeDeploymentConfigurationId({
      stage,

      platformReleaseId,

      profileVariantId,
    });


  return normalizeAndValidateDeploymentConfigurationDocument({
    schema:
      "tejas-profile.deployment-configuration",

    schemaId:
      "tejas-profile.deployment-configuration.v1",

    deploymentConfigurationId,

    stage,

    createdAt:
      "2026-08-24T00:00:00.000Z",

    platformReleaseId,

    profileVariantId,

    profile: {
      contentSchemaVersion:
        1,

      contentHash:
        "a".repeat(
          64
        ),

      targeting: {
        location:
          "Austin",

        jobRole:
          "Backend Engineer",
      },
    },
  });
}


function analyticsEvent(
  overrides:
    Record<string, any> = {}
) {
  return {
    eventId:
      "event-1",

    type:
      "section_view",

    ts:
      Date.now() -
      10_000,

    visitorId:
      "visitor-1",

    sessionId:
      "session-1",

    tabId:
      "tab-1",

    profileVersionId:
      "pv_test",

    section:
      "About Me",

    ...overrides,
  };
}


function loadHandler() {
  const dynamo =
    require(
      "@aws-sdk/client-dynamodb"
    );

  const s3 =
    require(
      "@aws-sdk/client-s3"
    );

  const ddbSend =
    jest.spyOn(
      dynamo
        .DynamoDBClient
        .prototype as any,
      "send"
    ) as unknown as jest.Mock;

  const s3Send =
    jest.spyOn(
      s3
        .S3Client
        .prototype as any,
      "send"
    ) as unknown as jest.Mock;

  const {
    handler,
  } =
    require(
      "../lambda/analytics-handler"
    );

  return {
    handler,
    ddbSend,
    s3Send,
  };
}


function commandName(
  command: any
) {
  return (
    command
      ?.constructor
      ?.name ||
    ""
  );
}


function commandValues(
  command: any
) {
  const values =
    command
      ?.input
      ?.ExpressionAttributeValues;

  return values
    ? unmarshall(values)
    : {};
}


function commandKey(
  command: any
) {
  const key =
    command
      ?.input
      ?.Key;

  return key
    ? unmarshall(key)
    : {};
}


function conditionalFailure() {
  const error:
    any =
      new Error(
        "Conditional check failed"
      );

  error.name =
    "ConditionalCheckFailedException";

  return error;
}


function installBasicIngestMocks(
  ddbSend: jest.Mock,
  s3Send: jest.Mock,
  boundaries: any[] = []
) {
  ddbSend
    .mockImplementation(
      async (
        command: any
      ) => {
        if (
          commandName(
            command
          ) ===
          "QueryCommand"
        ) {
          return {
            Items:
              boundaries.map(
                (item) =>
                  marshall(
                    item
                  )
              ),
          };
        }

        return {};
      }
    );

  s3Send
    .mockResolvedValue(
      {}
    );
}


describe(
  "analytics-handler",
  () => {
    beforeEach(
      () => {
        jest
          .restoreAllMocks();

        jest
          .resetModules();

        process.env
          .ANALYTICS_EVENTS_BUCKET =
          BUCKET;

        process.env
          .ANALYTICS_TABLE =
          TABLE;

        process.env
          .OWNER_TOKEN =
          OWNER_TOKEN;

        process.env
          .ANALYTICS_EDGE_TOKEN =
          EDGE_TOKEN;

        process.env
          .ALLOWED_ORIGINS =
          "http://localhost:3000";

        process.env
          .STAGE =
          "dev";

        delete process.env
          .USAGE_EPOCHS_TABLE;

        delete process.env
          .USAGE_EPOCH_ANALYTICS_TABLE;
      }
    );


    test(
      "owner ingest returns 204 and performs zero analytics writes",
      async () => {
        const {
          handler,
          ddbSend,
          s3Send,
        } =
          loadHandler();

        const response =
          await handler(
            event({
              headers: {
                "user-agent":
                  "Mozilla/5.0 UnitTest",

                "x-owner-token":
                  OWNER_TOKEN,
              },

              body: {
                events: [
                  analyticsEvent(),
                ],
              },
            })
          );

        expect(
          response.statusCode
        ).toBe(204);

        expect(
          response.body
        ).toBe("");

        expect(
          ddbSend
        ).not
          .toHaveBeenCalled();

        expect(
          s3Send
        ).not
          .toHaveBeenCalled();
      }
    );


    test(
      "ingest rejects a missing Analytics edge credential and performs zero writes",
      async () => {
        const {
          handler,
          ddbSend,
          s3Send,
        } =
          loadHandler();


        const response =
          await handler(
            event({
              headers: {
                "user-agent":
                  "Mozilla/5.0 UnitTest",

                // Explicitly override the test helper's
                // trusted-edge default.
                "x-analytics-edge-token":
                  "",
              },

              body: {
                events: [
                  analyticsEvent(),
                ],
              },
            })
          );


        expect(
          response.statusCode
        ).toBe(401);


        expect(
          responseBody(
            response
          )
        ).toEqual({
          error:
            "Unauthorized",
        });


        expect(
          ddbSend
        ).not
          .toHaveBeenCalled();


        expect(
          s3Send
        ).not
          .toHaveBeenCalled();
      }
    );


    test(
      "ingest rejects an invalid Analytics edge credential and performs zero writes",
      async () => {
        const {
          handler,
          ddbSend,
          s3Send,
        } =
          loadHandler();


        const response =
          await handler(
            event({
              headers: {
                "user-agent":
                  "Mozilla/5.0 UnitTest",

                "x-analytics-edge-token":
                  "invalid-edge-token",
              },

              body: {
                events: [
                  analyticsEvent(),
                ],
              },
            })
          );


        expect(
          response.statusCode
        ).toBe(401);


        expect(
          responseBody(
            response
          )
        ).toEqual({
          error:
            "Unauthorized",
        });


        expect(
          ddbSend
        ).not
          .toHaveBeenCalled();


        expect(
          s3Send
        ).not
          .toHaveBeenCalled();
      }
    );


    test(
      "trusted edge ingest raw storage excludes browser identifiers",
      async () => {
        const {
          handler,
          ddbSend,
          s3Send,
        } =
          loadHandler();

        installBasicIngestMocks(
          ddbSend as any,
          s3Send as any
        );

        const visitorId =
          "raw-private-visitor";

        const sessionId =
          "raw-private-session";

        const tabId =
          "raw-private-tab";

        const response =
          await handler(
            event({
              headers: {
                "user-agent":
                  "Mozilla/5.0 UnitTest",
              },

              body: {
                events: [
                  analyticsEvent({
                    visitorId,
                    sessionId,
                    tabId,

                    profileVariantId:
                      "prv_raw_test",

                    contentSchemaVersion:
                      3,

                    profileTargetingLocation:
                      "Austin, TX",

                    profileTargetingJobRole:
                      "Backend Software Engineer",

                    platformReleaseId:
                      "platform_raw_test",

                    deploymentConfigurationId:
                      "cfg_raw_test",
                  }),
                ],
              },
            })
          );

        expect(
          response.statusCode
        ).toBe(200);

        expect(
          responseBody(
            response
          ).accepted
        ).toBe(1);

        expect(
          s3Send
        ).toHaveBeenCalledTimes(
          1
        );

        const putCommand =
          s3Send
            .mock
            .calls[0][0];

        expect(
          commandName(
            putCommand
          )
        ).toBe(
          "PutObjectCommand"
        );

        const raw =
          JSON.parse(
            String(
              putCommand
                .input
                .Body
            )
          );

        expect(
          raw.schema
        ).toBe(
          "tejas-profile.analytics.batch.v2"
        );

        expect(
          raw.geo
        ).toEqual({
          countryCode:
            null,

          regionCode:
            null,

          city:
            null,
        });

        expect(
          raw.events
        ).toHaveLength(
          1
        );

        const stored =
          raw.events[0];

        expect(
          stored
        ).toHaveProperty(
          "visitorHash"
        );

        expect(
          stored
        ).toHaveProperty(
          "sessionHash"
        );

        expect(
          stored
        ).toMatchObject({
          profileVersionId:
            "pv_test",

          profileVariantId:
            "prv_raw_test",

          contentSchemaVersion:
            3,

          profileTargetingLocation:
            "Austin, TX",

          profileTargetingJobRole:
            "Backend Software Engineer",

          platformReleaseId:
            "platform_raw_test",

          deploymentConfigurationId:
            "cfg_raw_test",
        });

        expect(
          stored
        ).not
          .toHaveProperty(
            "visitorId"
          );

        expect(
          stored
        ).not
          .toHaveProperty(
            "sessionId"
          );

        expect(
          stored
        ).not
          .toHaveProperty(
            "tabId"
          );

        expect(
          stored
        ).not
          .toHaveProperty(
            "userAgent"
          );

        expect(
          stored
        ).not
          .toHaveProperty(
            "ip"
          );

        const serialized =
          JSON.stringify(
            raw
          );

        expect(
          serialized
        ).not
          .toContain(
            visitorId
          );

        expect(
          serialized
        ).not
          .toContain(
            sessionId
          );

        expect(
          serialized
        ).not
          .toContain(
            tabId
          );

        expect(
          serialized
        ).not
          .toContain(
            "Mozilla/5.0 UnitTest"
          );
      }
    );


    test(
      "formal runtime ingest projects one exact event into the active Usage Epoch",
      async () => {
        const configuration =
          formalRuntimeConfiguration();

        const eventTs =
          Date.now() -
          10_000;

        const epoch =
          createOpenUsageEpochDocument({
            startedAt:
              new Date(
                eventTs -
                60_000
              ).toISOString(),

            deploymentConfiguration:
              configuration,

            openedBy: {
              kind:
                USAGE_EPOCH_TRANSITION_KIND
                  .PLATFORM_DEPLOYMENT,

              occurrenceId:
                "pdep_analytics_projection",
            },
          });

        const pointer =
          buildActiveUsageEpochPointer({
            epoch,
          });


        process.env
          .USAGE_EPOCHS_TABLE =
          USAGE_EPOCH_TABLE;

        process.env
          .USAGE_EPOCH_ANALYTICS_TABLE =
          USAGE_EPOCH_ANALYTICS_TABLE;


        const {
          handler,
          ddbSend,
          s3Send,
        } =
          loadHandler();


        ddbSend.mockImplementation(
          async (
            command:
              any
          ) => {
            const name =
              commandName(
                command
              );


            if (
              name ===
                "QueryCommand" &&
              command.input
                .TableName ===
                TABLE
            ) {
              return {
                Items:
                  [],
              };
            }


            if (
              name ===
                "GetItemCommand" &&
              command.input
                .TableName ===
                USAGE_EPOCH_TABLE
            ) {
              return {
                Item:
                  marshall(
                    pointer
                  ),
              };
            }


            return {};
          }
        );


        s3Send.mockResolvedValue(
          {}
        );


        const response =
          await handler(
            event({
              headers: {
                "user-agent":
                  "Mozilla/5.0 UnitTest",
              },

              body: {
                events: [
                  analyticsEvent({
                    eventId:
                      "epoch-projection-event",

                    ts:
                      eventTs,

                    profileVariantId:
                      configuration
                        .profileVariantId,

                    platformReleaseId:
                      configuration
                        .platformReleaseId,

                    deploymentConfigurationId:
                      configuration
                        .deploymentConfigurationId,
                  }),
                ],
              },
            })
          );


        expect(
          response.statusCode
        ).toBe(
          200
        );


        const projectionWrite =
          ddbSend.mock.calls
            .map(
              (
                call
              ) =>
                call[0]
            )
            .find(
              (
                command:
                  any
              ) =>
                commandName(
                  command
                ) ===
                  "PutItemCommand" &&
                command.input
                  .TableName ===
                  USAGE_EPOCH_ANALYTICS_TABLE
            );


        expect(
          projectionWrite
        ).toBeDefined();


        const stored =
          unmarshall(
            projectionWrite
              .input
              .Item
          );


        expect(
          stored
        ).toMatchObject({
          usageEpochId:
            epoch.usageEpochId,

          deploymentConfigurationId:
            configuration
              .deploymentConfigurationId,

          platformReleaseId:
            configuration
              .platformReleaseId,

          profileVariantId:
            configuration
              .profileVariantId,

          ts:
            eventTs,

          section:
            "About Me",
        });


        expect(
          stored
        ).not.toHaveProperty(
          "visitorId"
        );

        expect(
          stored
        ).not.toHaveProperty(
          "sessionId"
        );

        expect(
          stored
        ).not.toHaveProperty(
          "eventId"
        );
      }
    );


    test(
      "trusted analytics edge accepts derived viewer geo",
      async () => {
        const {
          handler,
          ddbSend,
          s3Send,
        } =
          loadHandler();

        installBasicIngestMocks(
          ddbSend as any,
          s3Send as any
        );

        const response =
          await handler(
            event({
              headers: {
                "user-agent":
                  "Mozilla/5.0 UnitTest",

                "x-analytics-edge-token":
                  EDGE_TOKEN,

                "cloudfront-viewer-country":
                  "in",

                "cloudfront-viewer-country-region":
                  "mh",

                "cloudfront-viewer-city":
                  "Pune%20City",
              },

              body: {
                events: [
                  analyticsEvent(),
                ],
              },
            })
          );

        expect(
          response.statusCode
        ).toBe(200);

        const raw =
          JSON.parse(
            String(
              s3Send
                .mock
                .calls[0][0]
                .input
                .Body
            )
          );

        expect(
          raw.geo
        ).toEqual({
          countryCode:
            "IN",

          regionCode:
            "MH",

          city:
            "Pune City",
        });
      }
    );


    test(
      "accumulates runtime Profile identity as additive session-fragment dimensions",
      async () => {
        const {
          handler,
          ddbSend,
          s3Send,
        } =
          loadHandler();


        installBasicIngestMocks(
          ddbSend as any,
          s3Send as any
        );


        const base =
          Date.now() -
          20_000;


        const response =
          await handler(
            event({
              headers: {
                "user-agent":
                  "Mozilla/5.0 UnitTest",
              },

              body: {
                events: [
                  analyticsEvent({
                    eventId:
                      "profile-event-a",

                    ts:
                      base,

                    visitorId:
                      "visitor-profile",

                    sessionId:
                      "session-profile",

                    profileVariantId:
                      "prv_A",

                    contentSchemaVersion:
                      3,

                    profileTargetingLocation:
                      "Austin, TX",

                    profileTargetingJobRole:
                      "Backend Software Engineer",

                    platformReleaseId:
                      "platform_R42",

                    deploymentConfigurationId:
                      "cfg_A",
                  }),

                  analyticsEvent({
                    eventId:
                      "profile-event-b",

                    ts:
                      base +
                      1_000,

                    visitorId:
                      "visitor-profile",

                    sessionId:
                      "session-profile",

                    section:
                      "Experience",

                    profileVariantId:
                      "prv_B",

                    contentSchemaVersion:
                      4,

                    profileTargetingLocation:
                      "Pune, India",

                    profileTargetingJobRole:
                      "AI Software Engineer",

                    platformReleaseId:
                      "platform_R42",

                    deploymentConfigurationId:
                      "cfg_B",
                  }),
                ],
              },
            })
          );


        expect(
          response.statusCode
        ).toBe(
          200
        );


        expect(
          responseBody(
            response
          ).accepted
        ).toBe(
          2
        );


        const eventWrites =
          ddbSend
            .mock
            .calls
            .map(
              (call) =>
                call[0]
            )
            .filter(
              (
                command: any
              ) =>
                commandName(
                  command
                ) ===
                  "UpdateItemCommand" &&
                String(
                  command
                    .input
                    .ConditionExpression ||
                    ""
                ).includes(
                  "processedEventIds"
                )
            );


        expect(
          eventWrites
        ).toHaveLength(
          2
        );


        /**
         * Both events belong to the same legacy
         * profileVersion/session fragment.
         *
         * Runtime Profile identity is additive metadata,
         * not part of the existing storage key.
         */
        const sortKeys =
          eventWrites.map(
            (
              command:
                any
            ) =>
              commandKey(
                command
              ).sk
          );


        expect(
          new Set(
            sortKeys
          ).size
        ).toBe(
          1
        );


        const valuesByEventId =
          new Map<
            string,
            Record<string, any>
          >(
            eventWrites.map(
              (
                command:
                  any
              ): [
                string,
                Record<string, any>
              ] => {
                const values =
                  unmarshall(
                    command
                      .input
                      .ExpressionAttributeValues
                  ) as Record<
                    string,
                    any
                  >;


                return [
                  String(
                    values[
                      ":eventId"
                    ] ||
                    ""
                  ),

                  values,
                ];
              }
            )
          );


        const first =
          valuesByEventId.get(
            "profile-event-a"
          );


        const second =
          valuesByEventId.get(
            "profile-event-b"
          );


        expect(
          first
        ).toBeDefined();

        expect(
          second
        ).toBeDefined();


        if (
          !first ||
          !second
        ) {
          throw new Error(
            "Expected Profile identity event writes were not found."
          );
        }


        expect(
          first[
            ":profileVariantIds"
          ]
        ).toEqual(
          new Set([
            "prv_A",
          ])
        );


        expect(
          second[
            ":profileVariantIds"
          ]
        ).toEqual(
          new Set([
            "prv_B",
          ])
        );


        expect(
          first[
            ":contentSchemaVersions"
          ]
        ).toEqual(
          new Set([
            3,
          ])
        );


        expect(
          second[
            ":contentSchemaVersions"
          ]
        ).toEqual(
          new Set([
            4,
          ])
        );


        expect(
          first[
            ":profileTargetingLocations"
          ]
        ).toEqual(
          new Set([
            "Austin, TX",
          ])
        );


        expect(
          second[
            ":profileTargetingLocations"
          ]
        ).toEqual(
          new Set([
            "Pune, India",
          ])
        );


        expect(
          first[
            ":profileTargetingJobRoles"
          ]
        ).toEqual(
          new Set([
            "Backend Software Engineer",
          ])
        );


        expect(
          second[
            ":profileTargetingJobRoles"
          ]
        ).toEqual(
          new Set([
            "AI Software Engineer",
          ])
        );


        expect(
          first[
            ":platformReleaseIds"
          ]
        ).toEqual(
          new Set([
            "platform_R42",
          ])
        );


        expect(
          second[
            ":platformReleaseIds"
          ]
        ).toEqual(
          new Set([
            "platform_R42",
          ])
        );


        expect(
          first[
            ":deploymentConfigurationIds"
          ]
        ).toEqual(
          new Set([
            "cfg_A",
          ])
        );


        expect(
          second[
            ":deploymentConfigurationIds"
          ]
        ).toEqual(
          new Set([
            "cfg_B",
          ])
        );

        expect(
          first[
            ":profileVariantContexts"
          ]
        ).toEqual(
          new Set([
            JSON.stringify([
              "prv_A",
              3,
              "Austin, TX",
              "Backend Software Engineer",
              "platform_R42",
              "cfg_A",
            ]),
          ])
        );


        expect(
          second[
            ":profileVariantContexts"
          ]
        ).toEqual(
          new Set([
            JSON.stringify([
              "prv_B",
              4,
              "Pune, India",
              "AI Software Engineer",
              "platform_R42",
              "cfg_B",
            ]),
          ])
        );

      }
    );


    test(
      "attributes exact metrics to Profile Variants in the atomic event update",
      async () => {
        const {
          handler,
          ddbSend,
          s3Send,
        } =
          loadHandler();

        installBasicIngestMocks(
          ddbSend as any,
          s3Send as any
        );

        const base =
          Date.now() -
          20_000;

        const response =
          await handler(
            event({
              headers: {
                "user-agent":
                  "Mozilla/5.0 UnitTest",
              },

              body: {
                events: [
                  analyticsEvent({
                    eventId:
                      "variant-metric-view",

                    ts:
                      base,

                    visitorId:
                      "variant-metric-visitor",

                    sessionId:
                      "variant-metric-session",

                    profileVariantId:
                      "prv_A",

                    section:
                      "About Me",

                    type:
                      "section_view",
                  }),

                  analyticsEvent({
                    eventId:
                      "variant-metric-time",

                    ts:
                      base + 1_000,

                    visitorId:
                      "variant-metric-visitor",

                    sessionId:
                      "variant-metric-session",

                    profileVariantId:
                      "prv_B",

                    section:
                      "Experience",

                    type:
                      "section_time",

                    ms:
                      2_500,
                  }),

                  analyticsEvent({
                    eventId:
                      "variant-metric-cta",

                    ts:
                      base + 2_000,

                    visitorId:
                      "variant-metric-visitor",

                    sessionId:
                      "variant-metric-session",

                    profileVariantId:
                      "prv_A",

                    type:
                      "cta_click",

                    ctaId:
                      "resume-download",
                  }),
                ],
              },
            })
          );

        expect(
          response.statusCode
        ).toBe(200);

        expect(
          responseBody(
            response
          ).accepted
        ).toBe(3);

        const eventWrites =
          ddbSend
            .mock
            .calls
            .map(
              (call) =>
                call[0]
            )
            .filter(
              (
                command:
                  any
              ) =>
                commandName(
                  command
                ) ===
                  "UpdateItemCommand" &&
                String(
                  command
                    .input
                    .ConditionExpression ||
                    ""
                ).includes(
                  "processedEventIds"
                )
            );

        expect(
          eventWrites
        ).toHaveLength(3);

        expect(
          new Set(
            eventWrites.map(
              (
                command:
                  any
              ) =>
                commandKey(
                  command
                ).sk
            )
          ).size
        ).toBe(1);

        const byEventId =
          new Map<
            string,
            any
          >(
            eventWrites.map(
              (
                command:
                  any
              ) => {
                const values =
                  commandValues(
                    command
                  );

                return [
                  String(
                    values[
                      ":eventId"
                    ]
                  ),
                  command,
                ];
              }
            )
          );

        const view =
          byEventId.get(
            "variant-metric-view"
          );

        const time =
          byEventId.get(
            "variant-metric-time"
          );

        const cta =
          byEventId.get(
            "variant-metric-cta"
          );

        expect(view).toBeDefined();
        expect(time).toBeDefined();
        expect(cta).toBeDefined();

        if (
          !view ||
          !time ||
          !cta
        ) {
          throw new Error(
            "Expected Profile Variant metric event writes were not found."
          );
        }

        const viewNames =
          Object.values(
            view.input
              .ExpressionAttributeNames ||
              {}
          );

        expect(
          viewNames
        ).toEqual(
          expect.arrayContaining([
            "profileVariantMetrics",
            "eventCounts",
            "sectionVisits",
            "prv_A",

            JSON.stringify([
              "prv_A",
              "About Me",
            ]),
          ])
        );

        const timeNames =
          Object.values(
            time.input
              .ExpressionAttributeNames ||
              {}
          );

        expect(
          timeNames
        ).toEqual(
          expect.arrayContaining([
            "profileVariantMetrics",
            "eventCounts",
            "activeMs",
            "sectionTimeMs",
            "prv_B",

            JSON.stringify([
              "prv_B",
              "Experience",
            ]),
          ])
        );

        const timeValues =
          commandValues(
            time
          );

        expect(
          Object.values(
            timeValues
          )
        ).toContain(
          2_500
        );

        const ctaNames =
          Object.values(
            cta.input
              .ExpressionAttributeNames ||
              {}
          );

        expect(
          ctaNames
        ).toEqual(
          expect.arrayContaining([
            "profileVariantMetrics",
            "eventCounts",
            "ctaCounts",
            "prv_A",

            JSON.stringify([
              "prv_A",
              "resume-download",
            ]),
          ])
        );

        for (
          const command of
            eventWrites
        ) {
          expect(
            String(
              command
                .input
                .ConditionExpression ||
                ""
            )
          ).toContain(
            "processedEventIds"
          );
        }
      }
    );


    test(
      "attributes Profile Variant section reach and depth in the atomic event update",
      async () => {
        const {
          handler,
          ddbSend,
          s3Send,
        } =
          loadHandler();

        installBasicIngestMocks(
          ddbSend as any,
          s3Send as any
        );

        const base =
          Date.now() -
          20_000;

        const response =
          await handler(
            event({
              headers: {
                "user-agent":
                  "Mozilla/5.0 UnitTest",
              },

              body: {
                events: [
                  analyticsEvent({
                    eventId:
                      "variant-section-reach",

                    ts:
                      base,

                    visitorId:
                      "variant-reach-visitor",

                    sessionId:
                      "variant-reach-session",

                    profileVariantId:
                      "prv_A",

                    type:
                      "section_view",

                    section:
                      "Projects",
                  }),

                  analyticsEvent({
                    eventId:
                      "variant-depth",

                    ts:
                      base +
                      1_000,

                    visitorId:
                      "variant-reach-visitor",

                    sessionId:
                      "variant-reach-session",

                    profileVariantId:
                      "prv_A",

                    type:
                      "scroll_depth",

                    section:
                      "Projects",

                    depthPct:
                      75,
                  }),
                ],
              },
            })
          );

        expect(
          response.statusCode
        ).toBe(200);

        expect(
          responseBody(
            response
          ).accepted
        ).toBe(2);

        const eventWrites =
          ddbSend
            .mock
            .calls
            .map(
              (call) =>
                call[0]
            )
            .filter(
              (
                command:
                  any
              ) =>
                commandName(
                  command
                ) ===
                  "UpdateItemCommand" &&
                String(
                  command
                    .input
                    .ConditionExpression ||
                    ""
                ).includes(
                  "processedEventIds"
                )
            );

        expect(
          eventWrites
        ).toHaveLength(2);

        const byEventId =
          new Map<
            string,
            Record<string, any>
          >(
            eventWrites.map(
              (
                command:
                  any
              ): [
                string,
                Record<string, any>
              ] => {
                const values =
                  commandValues(
                    command
                  );

                return [
                  String(
                    values[
                      ":eventId"
                    ]
                  ),

                  values,
                ];
              }
            )
          );

        const section =
          byEventId.get(
            "variant-section-reach"
          );

        const depth =
          byEventId.get(
            "variant-depth"
          );

        expect(
          section
        ).toBeDefined();

        expect(
          depth
        ).toBeDefined();

        if (
          !section ||
          !depth
        ) {
          throw new Error(
            "Expected Profile Variant reach/depth writes were not found."
          );
        }

        /**
         * Legacy attribution remains intact.
         */
        expect(
          section[
            ":sectionsSeen"
          ]
        ).toEqual(
          new Set([
            "Projects",
          ])
        );

        expect(
          depth[
            ":depthMilestones"
          ]
        ).toEqual(
          new Set([
            "Projects|75",
          ])
        );


        /**
         * Exact Profile Variant attribution.
         */
        expect(
          section[
            ":profileVariantSectionsSeen"
          ]
        ).toEqual(
          new Set([
            JSON.stringify([
              "prv_A",
              "Projects",
            ]),
          ])
        );

        expect(
          depth[
            ":profileVariantDepthMilestones"
          ]
        ).toEqual(
          new Set([
            JSON.stringify([
              "prv_A",
              "Projects",
              75,
            ]),
          ])
        );
      }
    );


    test(
      "preserves optional Profile Variant identity in journey query output",
      async () => {
        const {
          handler,
          ddbSend,
        } =
          loadHandler();

        const ts =
          Date.now() -
          10_000;

        const day =
          new Date(
            ts
          )
            .toISOString()
            .slice(
              0,
              10
            );

        const fragment = {
          pk:
            `DAY#${day}`,

          sk:
            "PV#pv_test#SESSION#journey-profile-session",

          visitorHash:
            "journey-profile-visitor",

          sessionHash:
            "journey-profile-session",

          profileVersionId:
            "pv_test",

          firstEventAt:
            ts,

          lastEventAt:
            ts +
            1_000,

          eventCount:
            2,

          activeMs:
            0,

          metrics: {
            sectionVisits: {},
            sectionTimeMs: {},
            ctaCounts: {},
            projectOpens: {},
            snippetViews: {},
            deepLinks: {},
          },

          journeyEvents:
            new Set([
              JSON.stringify({
                t:
                  ts,

                i:
                  "journey-profile-a",

                k:
                  "section",

                v:
                  "Projects",

                p:
                  "prv_A",
              }),

              /**
               * Historical journey token with no Profile
               * Variant identity must remain readable.
               */
              JSON.stringify({
                t:
                  ts +
                  1_000,

                i:
                  "journey-historical",

                k:
                  "section",

                v:
                  "Experience",
              }),
            ]),
        };

        ddbSend
          .mockImplementation(
            async (
              command:
                any
            ) => {
              const name =
                commandName(
                  command
                );

              if (
                name ===
                  "QueryCommand"
              ) {
                return {
                  Items: [
                    marshall(
                      fragment
                    ),
                  ],
                };
              }

              if (
                name ===
                  "BatchGetItemCommand"
              ) {
                return {
                  Responses: {
                    [TABLE]: [
                      marshall({
                        visitorHash:
                          "journey-profile-visitor",

                        firstSeenAt:
                          ts -
                          5_000,
                      }),
                    ],
                  },

                  UnprocessedKeys:
                    {},
                };
              }

              return {};
            }
          );

        const response =
          await handler(
            event({
              path:
                "/analytics/query",

              method:
                "GET",

              headers: {
                "x-owner-token":
                  OWNER_TOKEN,
              },

              queryStringParameters: {
                from:
                  day,

                to:
                  day,

                profileVersionId:
                  "pv_test",
              },
            })
          );

        expect(
          response.statusCode
        ).toBe(200);

        const body =
          responseBody(
            response
          );

        expect(
          body
            .sessionIntelligence
            .recentSessions[0]
            .journey
        ).toEqual([
          {
            ts,

            type:
              "section",

            value:
              "Projects",

            profileVariantId:
              "prv_A",
          },

          {
            ts:
              ts +
              1_000,

            type:
              "section",

            value:
              "Experience",

            profileVariantId:
              null,
          },
        ]);
      }
    );


    test(
      "event timestamp assigns the same logical session to different boundary fragments",
      async () => {
        const {
          handler,
          ddbSend,
          s3Send,
        } =
          loadHandler();

        const base =
          Date.now() -
          20_000;

        const deployBoundary = {
          kind:
            "boundary",

          boundaryId:
            "deploy-test",

          boundaryType:
            "deploy",

          effectiveAt:
            base -
            5_000,

          createdAt:
            new Date(
              base -
              5_000
            )
              .toISOString(),

          profileVersionId:
            "pv_test",

          note:
            "deploy",
        };

        const resetBoundary = {
          kind:
            "boundary",

          boundaryId:
            "reset-test",

          boundaryType:
            "reset",

          effectiveAt:
            base +
            1_000,

          createdAt:
            new Date(
              base +
              1_000
            )
              .toISOString(),

          profileVersionId:
            null,

          note:
            "reset",
        };

        installBasicIngestMocks(
          ddbSend as any,
          s3Send as any,
          [
            deployBoundary,
            resetBoundary,
          ]
        );

        const response =
          await handler(
            event({
              headers: {
                "user-agent":
                  "Mozilla/5.0 UnitTest",
              },

              body: {
                events: [
                  analyticsEvent({
                    eventId:
                      "before-reset",

                    ts:
                      base,

                    visitorId:
                      "visitor-boundary",

                    sessionId:
                      "session-boundary",
                  }),

                  analyticsEvent({
                    eventId:
                      "after-reset",

                    ts:
                      base +
                      2_000,

                    visitorId:
                      "visitor-boundary",

                    sessionId:
                      "session-boundary",

                    section:
                      "Projects",
                  }),
                ],
              },
            })
          );

        const body =
          responseBody(
            response
          );

        expect(
          body.accepted
        ).toBe(2);

        const eventWrites =
          ddbSend
            .mock
            .calls
            .map(
              (call) =>
                call[0]
            )
            .filter(
              (
                command: any
              ) =>
                commandName(
                  command
                ) ===
                  "UpdateItemCommand" &&
                String(
                  command
                    .input
                    .ConditionExpression ||
                    ""
                ).includes(
                  "processedEventIds"
                )
            );

        expect(
          eventWrites
        ).toHaveLength(
          2
        );

        const sortKeys =
          eventWrites.map(
            (
              command:
                any
            ) =>
              commandKey(
                command
              ).sk
          );

        expect(
          sortKeys.some(
            (
              sk:
                string
            ) =>
              sk.includes(
                "#BOUNDARY#deploy-test"
              )
          )
        ).toBe(true);

        expect(
          sortKeys.some(
            (
              sk:
                string
            ) =>
              sk.includes(
                "#BOUNDARY#reset-test"
              )
          )
        ).toBe(true);

        const sessions =
          sortKeys.map(
            (
              sk:
                string
            ) =>
              sk
                .split(
                  "#BOUNDARY#"
                )[0]
          );

        expect(
          new Set(
            sessions
          ).size
        ).toBe(1);
      }
    );


    test(
      "retrying the same event is idempotent",
      async () => {
        const {
          handler,
          ddbSend,
          s3Send,
        } =
          loadHandler();

        const processed =
          new Set<string>();

        ddbSend
          .mockImplementation(
            async (
              command:
                any
            ) => {
              if (
                commandName(
                  command
                ) ===
                "QueryCommand"
              ) {
                return {
                  Items: [],
                };
              }

              if (
                commandName(
                  command
                ) ===
                "UpdateItemCommand" &&
                String(
                  command
                    .input
                    .ConditionExpression ||
                    ""
                ).includes(
                  "processedEventIds"
                )
              ) {
                const values =
                  commandValues(
                    command
                  );

                const eventId =
                  String(
                    values[
                      ":eventId"
                    ] ||
                    ""
                  );

                if (
                  processed.has(
                    eventId
                  )
                ) {
                  throw conditionalFailure();
                }

                processed.add(
                  eventId
                );
              }

              return {};
            }
          );

        s3Send
          .mockResolvedValue(
            {}
          );

        const payload = {
          events: [
            analyticsEvent({
              eventId:
                "stable-event-id",
            }),
          ],
        };

        const first =
          await handler(
            event({
              headers: {
                "user-agent":
                  "Mozilla/5.0 UnitTest",
              },

              body:
                payload,
            })
          );

        const second =
          await handler(
            event({
              headers: {
                "user-agent":
                  "Mozilla/5.0 UnitTest",
              },

              body:
                payload,
            })
          );

        expect(
          responseBody(
            first
          )
        ).toMatchObject({
          accepted:
            1,

          duplicates:
            0,
        });

        expect(
          responseBody(
            second
          )
        ).toMatchObject({
          accepted:
            0,

          duplicates:
            1,
        });
      }
    );


    test(
      "query merges boundary fragments into one logical session and reset filtering preserves returning visitor semantics",
      async () => {
        const {
          handler,
          ddbSend,
        } =
          loadHandler();

        const resetTs =
          Date.now() -
          30_000;

        const day =
          new Date(
            resetTs
          )
            .toISOString()
            .slice(
              0,
              10
            );

        const boundary = {
          pk:
            "CONTROL#ANALYTICS",

          sk:
            "BOUNDARY#test",

          kind:
            "boundary",

          boundaryId:
            "reset-query",

          boundaryType:
            "reset",

          effectiveAt:
            resetTs,

          createdAt:
            new Date(
              resetTs
            )
              .toISOString(),

          profileVersionId:
            null,

          note:
            "query reset",
        };

        const preFragment = {
          pk:
            `DAY#${day}`,

          sk:
            "PV#pv_test#SESSION#session-hash#BOUNDARY#deploy-query",

          visitorHash:
            "visitor-hash",

          sessionHash:
            "session-hash",

          profileVersionId:
            "pv_test",

          profileVariantIds:
            new Set([
              "prv_A",
            ]),

          contentSchemaVersions:
            new Set([
              3,
            ]),

          profileTargetingLocations:
            new Set([
              "Austin, TX",
            ]),

          profileTargetingJobRoles:
            new Set([
              "Backend Software Engineer",
            ]),

          platformReleaseIds:
            new Set([
              "platform_R42",
            ]),

          deploymentConfigurationIds:
            new Set([
              "cfg_A",
            ]),

          boundaryId:
            "deploy-query",

          boundaryType:
            "deploy",

          boundaryEffectiveAt:
            resetTs -
            10_000,

          firstEventAt:
            resetTs -
            8_000,

          lastEventAt:
            resetTs -
            2_000,

          eventCount:
            9,

          activeMs:
            12_000,

          sectionsSeen:
            new Set([
              "About Me",
              "Projects",
            ]),

          metrics: {
            sectionVisits: {
              "About Me":
                1,

              Projects:
                1,
            },

            sectionTimeMs: {
              "About Me":
                12_000,
            },

            ctaCounts: {},
            projectOpens: {},
            snippetViews: {},
            deepLinks: {},
          },
        };

        const postFragment = {
          pk:
            `DAY#${day}`,

          sk:
            "PV#pv_test#SESSION#session-hash#BOUNDARY#reset-query",

          visitorHash:
            "visitor-hash",

          sessionHash:
            "session-hash",

          profileVersionId:
            "pv_test",

          profileVariantIds:
            new Set([
              "prv_B",
            ]),

          contentSchemaVersions:
            new Set([
              4,
            ]),

          profileTargetingLocations:
            new Set([
              "Pune, India",
            ]),

          profileTargetingJobRoles:
            new Set([
              "AI Software Engineer",
            ]),

          platformReleaseIds:
            new Set([
              "platform_R42",
            ]),

          deploymentConfigurationIds:
            new Set([
              "cfg_B",
            ]),

          boundaryId:
            "reset-query",

          boundaryType:
            "reset",

          boundaryEffectiveAt:
            resetTs,

          firstEventAt:
            resetTs +
            1_000,

          lastEventAt:
            resetTs +
            4_000,

          eventCount:
            4,

          activeMs:
            5_000,

          sectionsSeen:
            new Set([
              "Projects",
            ]),

          metrics: {
            sectionVisits: {
              Projects:
                1,
            },

            sectionTimeMs: {
              Projects:
                5_000,
            },

            ctaCounts: {},
            projectOpens: {},
            snippetViews: {},
            deepLinks: {},
          },
        };

        ddbSend
          .mockImplementation(
            async (
              command:
                any
            ) => {
              const name =
                commandName(
                  command
                );

              if (
                name ===
                "GetItemCommand"
              ) {
                return {
                  Item:
                    marshall(
                      boundary
                    ),
                };
              }

              if (
                name ===
                "QueryCommand"
              ) {
                return {
                  Items: [
                    marshall(
                      preFragment
                    ),

                    marshall(
                      postFragment
                    ),
                  ],
                };
              }

              if (
                name ===
                "BatchGetItemCommand"
              ) {
                return {
                  Responses: {
                    [TABLE]: [
                      marshall({
                        visitorHash:
                          "visitor-hash",

                        firstSeenAt:
                          resetTs -
                          20_000,
                      }),
                    ],
                  },

                  UnprocessedKeys:
                    {},
                };
              }

              return {};
            }
          );

        const allHistory =
          await handler(
            event({
              path:
                "/analytics/query",

              method:
                "GET",

              headers: {
                "x-owner-token":
                  OWNER_TOKEN,
              },

              queryStringParameters: {
                from:
                  day,

                to:
                  day,

                profileVersionId:
                  "pv_test",
              },
            })
          );

        const allBody =
          responseBody(
            allHistory
          );

        expect(
          allHistory
            .statusCode
        ).toBe(200);

        expect(
          allBody
            .overview
        ).toMatchObject({
          uniqueVisitors:
            1,

          sessions:
            1,

          eventCount:
            13,

          activeMs:
            17_000,

          fragments:
            2,
        });

        expect(
          allBody
            .sessionIntelligence
            .coverage
            .logicalSessions
        ).toBe(1);

        expect(
          allBody
            .sessionIntelligence
            .recentSessions[0]
            .fragmentCount
        ).toBe(2);

        expect(
          allBody
            .sessionIntelligence
            .recentSessions[0]
        ).toMatchObject({
          profileVersionIds: [
            "pv_test",
          ],

          profileVariantIds: [
            "prv_A",
            "prv_B",
          ],

          contentSchemaVersions: [
            3,
            4,
          ],

          profileTargetingLocations: [
            "Austin, TX",
            "Pune, India",
          ],

          profileTargetingJobRoles: [
            "AI Software Engineer",
            "Backend Software Engineer",
          ],

          platformReleaseIds: [
            "platform_R42",
          ],

          deploymentConfigurationIds: [
            "cfg_A",
            "cfg_B",
          ],
        });

        expect(
          allBody
            .profileVariants
        ).toEqual([
          {
            profileVariantId:
              "prv_A",

            visitors:
              1,

            sessions:
              1,

            fragments:
              1,
          },

          {
            profileVariantId:
              "prv_B",

            visitors:
              1,

            sessions:
              1,

            fragments:
              1,
          },
        ]);


        expect(
          allBody
            .contentSchemaVersions
        ).toEqual([
          {
            contentSchemaVersion:
              3,

            visitors:
              1,

            sessions:
              1,

            fragments:
              1,
          },

          {
            contentSchemaVersion:
              4,

            visitors:
              1,

            sessions:
              1,

            fragments:
              1,
          },
        ]);


        expect(
          allBody
            .profileTargetingLocations
        ).toEqual([
          {
            profileTargetingLocation:
              "Austin, TX",

            visitors:
              1,

            sessions:
              1,

            fragments:
              1,
          },

          {
            profileTargetingLocation:
              "Pune, India",

            visitors:
              1,

            sessions:
              1,

            fragments:
              1,
          },
        ]);


        expect(
          allBody
            .profileTargetingJobRoles
        ).toEqual([
          {
            profileTargetingJobRole:
              "AI Software Engineer",

            visitors:
              1,

            sessions:
              1,

            fragments:
              1,
          },

          {
            profileTargetingJobRole:
              "Backend Software Engineer",

            visitors:
              1,

            sessions:
              1,

            fragments:
              1,
          },
        ]);


        expect(
          allBody
            .platformReleases
        ).toEqual([
          {
            platformReleaseId:
              "platform_R42",

            visitors:
              1,

            sessions:
              1,

            fragments:
              2,
          },
        ]);


        expect(
          allBody
            .deploymentConfigurations
        ).toEqual([
          {
            deploymentConfigurationId:
              "cfg_A",

            visitors:
              1,

            sessions:
              1,

            fragments:
              1,
          },

          {
            deploymentConfigurationId:
              "cfg_B",

            visitors:
              1,

            sessions:
              1,

            fragments:
              1,
          },
        ]);

        const fromReset =
          await handler(
            event({
              path:
                "/analytics/query",

              method:
                "GET",

              headers: {
                "x-owner-token":
                  OWNER_TOKEN,
              },

              queryStringParameters: {
                from:
                  day,

                to:
                  day,

                profileVersionId:
                  "pv_test",

                boundaryId:
                  "reset-query",
              },
            })
          );

        const resetBody =
          responseBody(
            fromReset
          );

        expect(
          fromReset
            .statusCode
        ).toBe(200);

        expect(
          resetBody
            .range
            .effectiveFromTs
        ).toBe(
          resetTs
        );

        expect(
          resetBody
            .overview
        ).toMatchObject({
          uniqueVisitors:
            1,

          newVisitors:
            0,

          returningVisitors:
            1,

          sessions:
            1,

          eventCount:
            4,

          activeMs:
            5_000,

          fragments:
            1,
        });

        const projects =
          resetBody
            .sections
            .find(
              (
                row:
                  any
              ) =>
                row
                  .section ===
                "Projects"
            );

        expect(
          projects
        ).toMatchObject({
          visits:
            1,

          activeMs:
            5_000,
        });

        const about =
          resetBody
            .sections
            .find(
              (
                row:
                  any
              ) =>
                row
                  .section ===
                "About Me"
            );

        expect(
          about
        ).toMatchObject({
          visits:
            0,

          activeMs:
            0,
        });
      }
    );


    test(
      "query applies exact Profile Variant and targeting filters without cross-attributing mixed-fragment metrics",
      async () => {
        const {
          handler,
          ddbSend,
        } =
          loadHandler();

        const ts =
          Date.now() -
          20_000;

        const day =
          new Date(
            ts
          )
            .toISOString()
            .slice(
              0,
              10
            );

        const fragment = {
          pk:
            `DAY#${day}`,

          sk:
            "PV#pv_test#SESSION#mixed-profile-session",

          visitorHash:
            "mixed-profile-visitor",

          sessionHash:
            "mixed-profile-session",

          profileVersionId:
            "pv_test",

          firstEventAt:
            ts,

          lastEventAt:
            ts +
            5_000,

          eventCount:
            6,

          activeMs:
            9_000,


          profileVariantIds:
            new Set([
              "prv_A",
              "prv_B",
            ]),

          contentSchemaVersions:
            new Set([
              3,
              4,
            ]),

          profileTargetingLocations:
            new Set([
              "Austin, TX",
              "Pune, India",
            ]),

          profileTargetingJobRoles:
            new Set([
              "Backend Software Engineer",
              "AI Software Engineer",
            ]),

          platformReleaseIds:
            new Set([
              "platform_R42",
            ]),

          deploymentConfigurationIds:
            new Set([
              "cfg_A",
              "cfg_B",
            ]),


          profileVariantContexts:
            new Set([
              JSON.stringify([
                "prv_A",
                3,
                "Austin, TX",
                "Backend Software Engineer",
                "platform_R42",
                "cfg_A",
              ]),

              JSON.stringify([
                "prv_B",
                4,
                "Pune, India",
                "AI Software Engineer",
                "platform_R42",
                "cfg_B",
              ]),
            ]),


          sectionsSeen:
            new Set([
              "About Me",
              "Projects",
              "Experience",
            ]),

          profileVariantSectionsSeen:
            new Set([
              JSON.stringify([
                "prv_A",
                "About Me",
              ]),

              JSON.stringify([
                "prv_A",
                "Projects",
              ]),

              JSON.stringify([
                "prv_B",
                "Experience",
              ]),
            ]),


          depthMilestones:
            new Set([
              "Projects|75",
              "Experience|50",
            ]),

          profileVariantDepthMilestones:
            new Set([
              JSON.stringify([
                "prv_A",
                "Projects",
                75,
              ]),

              JSON.stringify([
                "prv_B",
                "Experience",
                50,
              ]),
            ]),


          metrics: {
            sectionVisits: {
              "About Me":
                1,

              Projects:
                1,

              Experience:
                1,
            },

            sectionTimeMs: {
              "About Me":
                5_000,

              Projects:
                2_000,

              Experience:
                2_000,
            },

            ctaCounts: {
              "resume-download":
                1,

              "contact-me":
                1,
            },

            projectOpens: {
              "project-a":
                1,

              "project-b":
                1,
            },

            snippetViews: {
              "snippet-a":
                1,

              "snippet-b":
                1,
            },

            deepLinks: {
              "#/projects":
                1,

              "#/experience":
                1,
            },
          },


          profileVariantMetrics: {
            eventCounts: {
              prv_A:
                4,

              prv_B:
                2,
            },

            activeMs: {
              prv_A:
                7_000,

              prv_B:
                2_000,
            },

            sectionVisits: {
              [JSON.stringify([
                "prv_A",
                "About Me",
              ])]:
                1,

              [JSON.stringify([
                "prv_A",
                "Projects",
              ])]:
                1,

              [JSON.stringify([
                "prv_B",
                "Experience",
              ])]:
                1,
            },

            sectionTimeMs: {
              [JSON.stringify([
                "prv_A",
                "About Me",
              ])]:
                5_000,

              [JSON.stringify([
                "prv_A",
                "Projects",
              ])]:
                2_000,

              [JSON.stringify([
                "prv_B",
                "Experience",
              ])]:
                2_000,
            },

            ctaCounts: {
              [JSON.stringify([
                "prv_A",
                "resume-download",
              ])]:
                1,

              [JSON.stringify([
                "prv_B",
                "contact-me",
              ])]:
                1,
            },

            projectOpens: {
              [JSON.stringify([
                "prv_A",
                "project-a",
              ])]:
                1,

              [JSON.stringify([
                "prv_B",
                "project-b",
              ])]:
                1,
            },

            snippetViews: {
              [JSON.stringify([
                "prv_A",
                "snippet-a",
              ])]:
                1,

              [JSON.stringify([
                "prv_B",
                "snippet-b",
              ])]:
                1,
            },

            deepLinks: {
              [JSON.stringify([
                "prv_A",
                "#/projects",
              ])]:
                1,

              [JSON.stringify([
                "prv_B",
                "#/experience",
              ])]:
                1,
            },
          },


          journeyEvents:
            new Set([
              JSON.stringify({
                t:
                  ts,

                i:
                  "mixed-a-about",

                k:
                  "section",

                v:
                  "About Me",

                p:
                  "prv_A",
              }),

              JSON.stringify({
                t:
                  ts +
                  1_000,

                i:
                  "mixed-a-projects",

                k:
                  "section",

                v:
                  "Projects",

                p:
                  "prv_A",
              }),

              JSON.stringify({
                t:
                  ts +
                  2_000,

                i:
                  "mixed-b-experience",

                k:
                  "section",

                v:
                  "Experience",

                p:
                  "prv_B",
              }),

              JSON.stringify({
                t:
                  ts +
                  3_000,

                i:
                  "mixed-b-contact",

                k:
                  "cta",

                v:
                  "contact-me",

                p:
                  "prv_B",
              }),
            ]),


          countryCode:
            "US",

          regionCode:
            "TX",

          city:
            "Austin",
        };


        ddbSend
          .mockImplementation(
            async (
              command:
                any
            ) => {
              const name =
                commandName(
                  command
                );

              if (
                name ===
                "QueryCommand"
              ) {
                return {
                  Items: [
                    marshall(
                      fragment
                    ),
                  ],
                };
              }

              if (
                name ===
                "BatchGetItemCommand"
              ) {
                return {
                  Responses: {
                    [TABLE]: [
                      marshall({
                        visitorHash:
                          "mixed-profile-visitor",

                        firstSeenAt:
                          ts -
                          5_000,
                      }),
                    ],
                  },

                  UnprocessedKeys:
                    {},
                };
              }

              return {};
            }
          );


        const profileAResponse =
          await handler(
            event({
              path:
                "/analytics/query",

              method:
                "GET",

              headers: {
                "x-owner-token":
                  OWNER_TOKEN,
              },

              queryStringParameters: {
                from:
                  day,

                to:
                  day,

                profileVersionId:
                  "pv_test",

                profileVariantId:
                  "prv_A",
              },
            })
          );


        expect(
          profileAResponse
            .statusCode
        ).toBe(200);

        const profileABody =
          responseBody(
            profileAResponse
          );


        expect(
          profileABody.filter
        ).toMatchObject({
          profileVersionId:
            "pv_test",

          profileVariantId:
            "prv_A",

          profileTargetingLocation:
            "all",

          profileTargetingJobRole:
            "all",
        });


        expect(
          profileABody.overview
        ).toMatchObject({
          uniqueVisitors:
            1,

          sessions:
            1,

          eventCount:
            4,

          activeMs:
            7_000,

          fragments:
            1,
        });


        const about =
          profileABody
            .sections
            .find(
              (
                row:
                  any
              ) =>
                row.section ===
                  "About Me"
            );

        const projects =
          profileABody
            .sections
            .find(
              (
                row:
                  any
              ) =>
                row.section ===
                  "Projects"
            );

        const experience =
          profileABody
            .sections
            .find(
              (
                row:
                  any
              ) =>
                row.section ===
                  "Experience"
            );


        expect(
          about
        ).toMatchObject({
          visits:
            1,

          activeMs:
            5_000,

          visitors:
            1,

          sessions:
            1,
        });


        expect(
          projects
        ).toMatchObject({
          visits:
            1,

          activeMs:
            2_000,

          visitors:
            1,

          sessions:
            1,
        });


        expect(
          experience
        ).toMatchObject({
          visits:
            0,

          activeMs:
            0,

          visitors:
            0,

          sessions:
            0,
        });


        expect(
          profileABody.ctas
        ).toEqual([
          {
            ctaId:
              "resume-download",

            count:
              1,

            visitors:
              1,

            sessions:
              1,
          },
        ]);


        expect(
          profileABody.projects
        ).toEqual([
          {
            projectId:
              "project-a",

            count:
              1,

            visitors:
              1,

            sessions:
              1,
          },
        ]);


        expect(
          profileABody.snippets
        ).toEqual([
          {
            snippetId:
              "snippet-a",

            count:
              1,

            visitors:
              1,

            sessions:
              1,
          },
        ]);


        expect(
          profileABody.deepLinks
        ).toEqual([
          {
            path:
              "#/projects",

            count:
              1,

            visitors:
              1,

            sessions:
              1,
          },
        ]);


        expect(
          profileABody
            .depthMilestones
        ).toEqual([
          {
            section:
              "Projects",

            depthPct:
              75,

            visitors:
              1,

            sessions:
              1,
          },
        ]);


        expect(
          profileABody
            .profileVariants
        ).toEqual([
          {
            profileVariantId:
              "prv_A",

            visitors:
              1,

            sessions:
              1,

            fragments:
              1,
          },
        ]);


        expect(
          profileABody
            .sessionIntelligence
            .recentSessions[0]
        ).toMatchObject({
          activeMs:
            7_000,

          eventCount:
            4,

          fragmentCount:
            1,

          sections: [
            "About Me",
            "Projects",
          ],

          profileVariantIds: [
            "prv_A",
          ],

          contentSchemaVersions: [
            3,
          ],

          profileTargetingLocations: [
            "Austin, TX",
          ],

          profileTargetingJobRoles: [
            "Backend Software Engineer",
          ],

          platformReleaseIds: [
            "platform_R42",
          ],

          deploymentConfigurationIds: [
            "cfg_A",
          ],
        });


        expect(
          profileABody
            .sessionIntelligence
            .recentSessions[0]
            .journey
            .map(
              (
                row:
                  any
              ) =>
                row
                  .profileVariantId
            )
        ).toEqual([
          "prv_A",
          "prv_A",
        ]);


        const targetingResponse =
          await handler(
            event({
              path:
                "/analytics/query",

              method:
                "GET",

              headers: {
                "x-owner-token":
                  OWNER_TOKEN,
              },

              queryStringParameters: {
                from:
                  day,

                to:
                  day,

                profileVersionId:
                  "pv_test",

                profileTargetingJobRole:
                  "AI Software Engineer",
              },
            })
          );


        expect(
          targetingResponse
            .statusCode
        ).toBe(200);

        const targetingBody =
          responseBody(
            targetingResponse
          );


        expect(
          targetingBody.filter
        ).toMatchObject({
          profileVariantId:
            "all",

          profileTargetingLocation:
            "all",

          profileTargetingJobRole:
            "AI Software Engineer",
        });


        expect(
          targetingBody.overview
        ).toMatchObject({
          uniqueVisitors:
            1,

          sessions:
            1,

          eventCount:
            2,

          activeMs:
            2_000,

          fragments:
            1,
        });


        expect(
          targetingBody
            .profileVariants
        ).toEqual([
          {
            profileVariantId:
              "prv_B",

            visitors:
              1,

            sessions:
              1,

            fragments:
              1,
          },
        ]);


        const targetingExperience =
          targetingBody
            .sections
            .find(
              (
                row:
                  any
              ) =>
                row.section ===
                  "Experience"
            );

        expect(
          targetingExperience
        ).toMatchObject({
          visits:
            1,

          activeMs:
            2_000,

          visitors:
            1,

          sessions:
            1,
        });


        const invalidResponse =
          await handler(
            event({
              path:
                "/analytics/query",

              method:
                "GET",

              headers: {
                "x-owner-token":
                  OWNER_TOKEN,
              },

              queryStringParameters: {
                from:
                  day,

                to:
                  day,

                profileVariantId:
                  "invalid variant id",
              },
            })
          );

        expect(
          invalidResponse
            .statusCode
        ).toBe(400);
      }
    );


    test(
      "query returns 404 for an unknown boundary",
      async () => {
        const {
          handler,
          ddbSend,
        } =
          loadHandler();

        ddbSend
          .mockImplementation(
            async (
              command:
                any
            ) => {
              if (
                commandName(
                  command
                ) ===
                "GetItemCommand"
              ) {
                return {};
              }

              return {};
            }
          );

        const day =
          new Date()
            .toISOString()
            .slice(
              0,
              10
            );

        const response =
          await handler(
            event({
              path:
                "/analytics/query",

              method:
                "GET",

              headers: {
                "x-owner-token":
                  OWNER_TOKEN,
              },

              queryStringParameters: {
                from:
                  day,

                to:
                  day,

                boundaryId:
                  "does-not-exist",
              },
            })
          );

        expect(
          response.statusCode
        ).toBe(404);

        expect(
          responseBody(
            response
          ).error
        ).toBe(
          "Analytics boundary not found."
        );
      }
    );


    test(
      "deploy boundary registration also registers the release",
      async () => {
        const {
          handler,
          ddbSend,
        } =
          loadHandler();

        const effectiveAt =
          Date.now() -
          5_000;

        ddbSend
          .mockImplementation(
            async (
              command:
                any
            ) => {
              const name =
                commandName(
                  command
                );

              if (
                name ===
                "PutItemCommand"
              ) {
                return {};
              }

              if (
                name ===
                "UpdateItemCommand" &&
                command
                  .input
                  .ReturnValues ===
                  "ALL_NEW"
              ) {
                return {
                  Attributes:
                    marshall({
                      kind:
                        "release",

                      profileVersionId:
                        "pv_deploy",

                      releasedAt:
                        effectiveAt,

                      registeredAt:
                        new Date()
                          .toISOString(),

                      updatedAt:
                        new Date()
                          .toISOString(),

                      stage:
                        "dev",

                      source:
                        "deploy",

                      note:
                        "deploy test",
                    }),
                };
              }

              return {};
            }
          );

        const response =
          await handler(
            event({
              path:
                "/analytics/boundaries",

              method:
                "POST",

              headers: {
                "x-owner-token":
                  OWNER_TOKEN,

                "content-type":
                  "application/json",
              },

              body: {
                boundaryId:
                  "deploy-boundary-test",

                type:
                  "deploy",

                effectiveAt,

                profileVersionId:
                  "pv_deploy",

                note:
                  "deploy test",
              },
            })
          );

        expect(
          response.statusCode
        ).toBe(201);

        expect(
          responseBody(
            response
          )
        ).toMatchObject({
          ok:
            true,

          created:
            true,

          boundary: {
            boundaryId:
              "deploy-boundary-test",

            type:
              "deploy",

            effectiveAt,

            profileVersionId:
              "pv_deploy",
          },
        });

        const putCommands =
          ddbSend
            .mock
            .calls
            .map(
              (call) =>
                call[0]
            )
            .filter(
              (
                command:
                  any
              ) =>
                commandName(
                  command
                ) ===
                "PutItemCommand"
            );

        const releaseWrites =
          ddbSend
            .mock
            .calls
            .map(
              (call) =>
                call[0]
            )
            .filter(
              (
                command:
                  any
              ) =>
                commandName(
                  command
                ) ===
                  "UpdateItemCommand" &&
                command
                  .input
                  .ReturnValues ===
                  "ALL_NEW"
            );

        expect(
          putCommands
        ).toHaveLength(
          1
        );

        expect(
          releaseWrites
        ).toHaveLength(
          1
        );
      }
    );


    test(
      "boundary key conflict returns 409 when metadata differs",
      async () => {
        const {
          handler,
          ddbSend,
        } =
          loadHandler();

        const effectiveAt =
          Date.now() -
          5_000;

        ddbSend
          .mockImplementation(
            async (
              command:
                any
            ) => {
              const name =
                commandName(
                  command
                );

              if (
                name ===
                "PutItemCommand"
              ) {
                throw conditionalFailure();
              }

              if (
                name ===
                "GetItemCommand"
              ) {
                return {
                  Item:
                    marshall({
                      kind:
                        "boundary",

                      boundaryId:
                        "same-id",

                      boundaryType:
                        "reset",

                      effectiveAt,

                      createdAt:
                        new Date()
                          .toISOString(),

                      stage:
                        "dev",

                      profileVersionId:
                        null,

                      note:
                        "old metadata",
                    }),
                };
              }

              return {};
            }
          );

        const response =
          await handler(
            event({
              path:
                "/analytics/boundaries",

              method:
                "POST",

              headers: {
                "x-owner-token":
                  OWNER_TOKEN,

                "content-type":
                  "application/json",
              },

              body: {
                boundaryId:
                  "same-id",

                type:
                  "reset",

                effectiveAt,

                note:
                  "different metadata",
              },
            })
          );

        expect(
          response.statusCode
        ).toBe(409);

        expect(
          responseBody(
            response
          ).error
        ).toBe(
          "Boundary key already exists with different metadata."
        );
      }
    );

    test(
    "Battleship room deep links are canonicalized before aggregation and raw storage",
    async () => {
      const {
        handler,
        ddbSend,
        s3Send,
      } =
        loadHandler();

      installBasicIngestMocks(
        ddbSend as any,
        s3Send as any
      );

      const response =
        await handler(
          event({
            headers: {
              "user-agent":
                "Mozilla/5.0 UnitTest",
            },

            body: {
              events: [
                analyticsEvent({
                  eventId:
                    "battleship-room-link",

                  type:
                    "deep_link",

                  section:
                    undefined,

                  path:
                    "/tejas-profile/",

                  hash:
                    "#/fun-zone/battleship-AX9G",
                }),
              ],
            },
          })
        );

      expect(
        response.statusCode
      ).toBe(200);

      expect(
        responseBody(
          response
        ).accepted
      ).toBe(1);

      const eventWrite =
        ddbSend
          .mock
          .calls
          .map(
            (call) =>
              call[0]
          )
          .find(
            (
              command:
                any
            ) =>
              commandName(
                command
              ) ===
                "UpdateItemCommand" &&
              String(
                command
                  .input
                  .ConditionExpression ||
                  ""
              ).includes(
                "processedEventIds"
              )
          );

      const metricNames =
        Object.values(
          eventWrite
            .input
            .ExpressionAttributeNames ||
            {}
        );

      expect(
        metricNames
      ).toContain(
        "#/fun-zone/battleship"
      );

      expect(
        metricNames
      ).not.toContain(
        "#/fun-zone/battleship-AX9G"
      );

      const raw =
        JSON.parse(
          String(
            s3Send
              .mock
              .calls[0][0]
              .input
              .Body
          )
        );

      expect(
        raw.events[0].hash
      ).toBe(
        "#/fun-zone/battleship"
      );
    }
  );

  test(
    "query merges historical Battleship room deep links into the canonical route",
    async () => {
      const {
        handler,
        ddbSend,
      } =
        loadHandler();

      const ts =
        Date.now() -
        10_000;

      const day =
        new Date(ts)
          .toISOString()
          .slice(
            0,
            10
          );

      const fragment = {
        pk:
          `DAY#${day}`,

        sk:
          "PV#pv_test#SESSION#session-hash",

        visitorHash:
          "visitor-hash",

        sessionHash:
          "session-hash",

        profileVersionId:
          "pv_test",

        firstEventAt:
          ts,

        lastEventAt:
          ts + 1_000,

        eventCount:
          3,

        activeMs:
          0,

        metrics: {
          sectionVisits: {},
          sectionTimeMs: {},
          ctaCounts: {},
          projectOpens: {},
          snippetViews: {},

          deepLinks: {
            "#/fun-zone/battleship-AX9G":
              1,

            "#/fun-zone/battleship-Q71B":
              2,
          },
        },

        journeyEvents:
          new Set([
            JSON.stringify({
              t: ts,
              i: "journey-one",
              k: "deep_link",
              v:
                "#/fun-zone/battleship-AX9G",
            }),

            JSON.stringify({
              t:
                ts + 1_000,

              i:
                "journey-two",

              k:
                "deep_link",

              v:
                "#/fun-zone/battleship-Q71B",
            }),
          ]),
      };

      ddbSend
        .mockImplementation(
          async (
            command:
              any
          ) => {
            const name =
              commandName(
                command
              );

            if (
              name ===
                "QueryCommand"
            ) {
              return {
                Items: [
                  marshall(
                    fragment
                  ),
                ],
              };
            }

            if (
              name ===
                "BatchGetItemCommand"
            ) {
              return {
                Responses: {
                  [TABLE]: [
                    marshall({
                      visitorHash:
                        "visitor-hash",

                      firstSeenAt:
                        ts -
                        5_000,
                    }),
                  ],
                },

                UnprocessedKeys:
                  {},
              };
            }

            return {};
          }
        );

      const response =
        await handler(
          event({
            path:
              "/analytics/query",

            method:
              "GET",

            headers: {
              "x-owner-token":
                OWNER_TOKEN,
            },

            queryStringParameters: {
              from: day,
              to: day,

              profileVersionId:
                "pv_test",
            },
          })
        );

      expect(
        response.statusCode
      ).toBe(200);

      const body =
        responseBody(
          response
        );

      expect(
        body.deepLinks
      ).toEqual([
        {
          path:
            "#/fun-zone/battleship",

          count: 3,
          visitors: 1,
          sessions: 1,
        },
      ]);

      const deepLinkJourney =
        body
          .sessionIntelligence
          .recentSessions[0]
          .journey
          .filter(
            (
              row:
                any
            ) =>
              row.type ===
              "deep_link"
          );

      expect(
        deepLinkJourney
      ).toHaveLength(2);

      expect(
        deepLinkJourney.every(
          (
            row:
              any
          ) =>
            row.value ===
            "#/fun-zone/battleship"
        )
      ).toBe(true);
    }
  );

  }
);