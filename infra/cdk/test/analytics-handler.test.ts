// infra/cdk/test/analytics-handler.test.ts
import {
  marshall,
  unmarshall,
} from "@aws-sdk/util-dynamodb";


const TABLE =
  "analytics-table-test";

const BUCKET =
  "analytics-events-test";

const OWNER_TOKEN =
  "unit-test-owner-token";

const EDGE_TOKEN =
  "unit-test-edge-token";


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

    headers,

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
      "direct ingest ignores spoofed CloudFront geo and raw storage excludes browser identifiers",
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

                "cloudfront-viewer-country":
                  "US",

                "cloudfront-viewer-country-region":
                  "TX",

                "cloudfront-viewer-city":
                  "Austin",
              },

              body: {
                events: [
                  analyticsEvent({
                    visitorId,
                    sessionId,
                    tabId,
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
  }
);