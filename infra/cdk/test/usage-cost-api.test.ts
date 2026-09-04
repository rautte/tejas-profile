// infra/cdk/test/usage-cost-api.test.ts
//
// Route-level tests for the admin "Usage" page's API surface added
// to snapshots-handler.ts: GET /usage/summary, GET /usage/history,
// POST /usage/config, POST /usage/refresh-now.

import {
  marshall,
} from "@aws-sdk/util-dynamodb";


const mockDynamoSend =
  jest.fn();

const mockLambdaSend =
  jest.fn();


jest.mock(
  "@aws-sdk/client-dynamodb",
  () => {
    const actual: any =
      jest.requireActual(
        "@aws-sdk/client-dynamodb"
      );

    return {
      ...actual,

      DynamoDBClient:
        jest.fn(
          () => ({
            send:
              mockDynamoSend,
          })
        ),
    };
  }
);


jest.mock(
  "@aws-sdk/client-lambda",
  () => {
    const actual: any =
      jest.requireActual(
        "@aws-sdk/client-lambda"
      );

    return {
      ...actual,

      LambdaClient:
        jest.fn(
          () => ({
            send:
              mockLambdaSend,
          })
        ),
    };
  }
);


const OWNER_TOKEN =
  "usage-cost-api-test-master-token";

const USAGE_COST_METRICS_TABLE =
  "usage-cost-metrics-test-table";

const USAGE_COST_AGGREGATOR_FUNCTION_NAME =
  "usage-cost-aggregator-test-function";


let handler: any;


function parsedBody(
  response: any
) {
  return JSON.parse(
    response.body
  );
}


function ownerEvent({
  method,
  path,
  body,
  query,
}: {
  method:
    string;

  path:
    string;

  body?:
    unknown;

  query?:
    Record<string, string>;
}) {
  return {
    requestContext: {
      http: {
        method,
        path,
      },
    },

    rawPath:
      path,

    headers: {
      "x-owner-token":
        OWNER_TOKEN,
    },

    queryStringParameters:
      query,

    body:
      body !==
      undefined
        ? JSON.stringify(
            body
          )
        : undefined,
  };
}


function configItem(
  overrides:
    Record<string, any> =
    {}
) {
  return marshall(
    {
      pk:
        "CONFIG",

      sk:
        "CONFIG",

      intervalDays:
        1,

      lastRunAt:
        "2026-09-04T00:00:00.000Z",

      updatedAt:
        "2026-09-04T00:00:00.000Z",

      updatedBy:
        "owner",

      alertThresholdsUsd: {
        day:
          null,

        week:
          null,

        month:
          null,
      },

      lastAlertedPeriodKeys: {
        day:
          null,

        week:
          null,

        month:
          null,
      },

      ...overrides,
    }
  );
}


function snapshotItem({
  periodType,
  periodKey,
  totalCostUsd,
}: {
  periodType:
    string;

  periodKey:
    string;

  totalCostUsd:
    number;
}) {
  return marshall(
    {
      pk:
        `PERIOD#${periodType}`,

      sk:
        periodKey,

      periodType,

      periodKey,

      periodStart:
        "2026-09-04T00:00:00.000Z",

      periodEnd:
        "2026-09-04T06:00:00.000Z",

      collectedAt:
        "2026-09-04T06:00:00.000Z",

      totalCostUsd,

      costByService: {
        "Amazon S3":
          totalCostUsd,
      },

      resourceUsage: {
        s3:
          [],

        dynamodb:
          [],

        lambda:
          [],
      },
    }
  );
}


describe(
  "Usage cost API",
  () => {
    beforeAll(
      async () => {
        process.env.OWNER_TOKEN =
          OWNER_TOKEN;

        process.env.SNAPSHOTS_BUCKET =
          "unused-bucket";

        process.env.USAGE_COST_METRICS_TABLE =
          USAGE_COST_METRICS_TABLE;

        process.env.USAGE_COST_AGGREGATOR_FUNCTION_NAME =
          USAGE_COST_AGGREGATOR_FUNCTION_NAME;

        process.env.STAGE =
          "dev";

        process.env.ALLOWED_ORIGINS =
          "";

        jest.resetModules();

        (
          {
            handler,
          } = await import(
            "../lambda/snapshots-handler"
          )
        );
      }
    );


    beforeEach(
      () => {
        mockDynamoSend.mockReset();
        mockLambdaSend.mockReset();

        mockLambdaSend.mockResolvedValue(
          {}
        );
      }
    );


    afterAll(
      () => {
        delete process.env.OWNER_TOKEN;
        delete process.env.SNAPSHOTS_BUCKET;
        delete process.env.USAGE_COST_METRICS_TABLE;
        delete process.env.USAGE_COST_AGGREGATOR_FUNCTION_NAME;
        delete process.env.STAGE;
        delete process.env.ALLOWED_ORIGINS;
      }
    );


    test(
      "GET /usage/summary returns the config and the latest snapshot per period type",
      async () => {
        mockDynamoSend.mockImplementation(
          (
            command:
              any
          ) => {
            if (
              command.constructor
                .name ===
              "GetItemCommand"
            ) {
              return Promise.resolve(
                {
                  Item:
                    configItem(),
                }
              );
            }

            if (
              command.constructor
                .name ===
              "QueryCommand"
            ) {
              const pk =
                command.input
                  .ExpressionAttributeValues[
                  ":pk"
                ]
                  .S;

              const periodType =
                pk.replace(
                  "PERIOD#",
                  ""
                );

              return Promise.resolve(
                {
                  Items: [
                    snapshotItem(
                      {
                        periodType,

                        periodKey:
                          "2026-09-04",

                        totalCostUsd:
                          1.5,
                      }
                    ),
                  ],
                }
              );
            }

            throw new Error(
              "Unexpected DynamoDB command in test."
            );
          }
        );

        const response =
          await handler(
            ownerEvent(
              {
                method:
                  "GET",

                path:
                  "/usage/summary",
              }
            )
          );

        expect(
          response.statusCode
        ).toBe(
          200
        );

        const body =
          parsedBody(
            response
          );

        expect(
          body.ok
        ).toBe(
          true
        );

        expect(
          body.config
            .intervalDays
        ).toBe(
          1
        );

        expect(
          body.snapshots
            .day
            .totalCostUsd
        ).toBe(
          1.5
        );

        expect(
          body.snapshots
            .week
            .periodType
        ).toBe(
          "week"
        );

        expect(
          body.snapshots
            .month
            .periodType
        ).toBe(
          "month"
        );
      }
    );


    test(
      "GET /usage/history rejects an unknown periodType",
      async () => {
        const response =
          await handler(
            ownerEvent(
              {
                method:
                  "GET",

                path:
                  "/usage/history",

                query: {
                  periodType:
                    "year",
                },
              }
            )
          );

        expect(
          response.statusCode
        ).toBe(
          400
        );

        expect(
          mockDynamoSend
        ).not.toHaveBeenCalled();
      }
    );


    test(
      "GET /usage/history returns a bounded, newest-first list for the requested period type",
      async () => {
        mockDynamoSend.mockImplementation(
          (
            command:
              any
          ) => {
            if (
              command.constructor
                .name ===
              "QueryCommand"
            ) {
              return Promise.resolve(
                {
                  Items: [
                    snapshotItem(
                      {
                        periodType:
                          "week",

                        periodKey:
                          "2026-W36",

                        totalCostUsd:
                          9,
                      }
                    ),

                    snapshotItem(
                      {
                        periodType:
                          "week",

                        periodKey:
                          "2026-W35",

                        totalCostUsd:
                          7,
                      }
                    ),
                  ],
                }
              );
            }

            throw new Error(
              "Unexpected DynamoDB command in test."
            );
          }
        );

        const response =
          await handler(
            ownerEvent(
              {
                method:
                  "GET",

                path:
                  "/usage/history",

                query: {
                  periodType:
                    "week",

                  limit:
                    "5",
                },
              }
            )
          );

        expect(
          response.statusCode
        ).toBe(
          200
        );

        const body =
          parsedBody(
            response
          );

        expect(
          body.periodType
        ).toBe(
          "week"
        );

        expect(
          body.snapshots.map(
            (
              row:
                any
            ) =>
              row.periodKey
          )
        ).toEqual(
          [
            "2026-W36",
            "2026-W35",
          ]
        );

        const queryCall =
          mockDynamoSend.mock
            .calls.find(
              (
                call:
                  any
              ) =>
                call[0]
                  .constructor
                  .name ===
                "QueryCommand"
            )?.[0];

        expect(
          queryCall
            .input
            .Limit
        ).toBe(
          5
        );
      }
    );


    test(
      "POST /usage/config rejects an interval outside the allowed set",
      async () => {
        const response =
          await handler(
            ownerEvent(
              {
                method:
                  "POST",

                path:
                  "/usage/config",

                body: {
                  intervalDays:
                    4,
                },
              }
            )
          );

        expect(
          response.statusCode
        ).toBe(
          400
        );

        expect(
          mockDynamoSend
        ).not.toHaveBeenCalled();
      }
    );


    test(
      "POST /usage/config accepts a valid interval, preserving the existing lastRunAt",
      async () => {
        mockDynamoSend.mockImplementation(
          (
            command:
              any
          ) => {
            if (
              command.constructor
                .name ===
              "GetItemCommand"
            ) {
              return Promise.resolve(
                {
                  Item:
                    configItem(
                      {
                        intervalDays:
                          1,

                        lastRunAt:
                          "2026-09-03T00:00:00.000Z",
                      }
                    ),
                }
              );
            }

            if (
              command.constructor
                .name ===
              "PutItemCommand"
            ) {
              return Promise.resolve(
                {}
              );
            }

            throw new Error(
              "Unexpected DynamoDB command in test."
            );
          }
        );

        const response =
          await handler(
            ownerEvent(
              {
                method:
                  "POST",

                path:
                  "/usage/config",

                body: {
                  intervalDays:
                    7,
                },
              }
            )
          );

        expect(
          response.statusCode
        ).toBe(
          200
        );

        const body =
          parsedBody(
            response
          );

        expect(
          body.config
            .intervalDays
        ).toBe(
          7
        );

        expect(
          body.config
            .lastRunAt
        ).toBe(
          "2026-09-03T00:00:00.000Z"
        );

        const putCall =
          mockDynamoSend.mock
            .calls.find(
              (
                call:
                  any
              ) =>
                call[0]
                  .constructor
                  .name ===
                "PutItemCommand"
            )?.[0];

        expect(
          putCall
            .input
            .Item
            .intervalDays
            .N
        ).toBe(
          "7"
        );
      }
    );


    test(
      "POST /usage/config sets alert thresholds while leaving unspecified periods untouched",
      async () => {
        mockDynamoSend.mockImplementation(
          (
            command:
              any
          ) => {
            if (
              command.constructor
                .name ===
              "GetItemCommand"
            ) {
              return Promise.resolve(
                {
                  Item:
                    configItem(
                      {
                        alertThresholdsUsd: {
                          day:
                            null,

                          week:
                            25,

                          month:
                            null,
                        },
                      }
                    ),
                }
              );
            }

            if (
              command.constructor
                .name ===
              "PutItemCommand"
            ) {
              return Promise.resolve(
                {}
              );
            }

            throw new Error(
              "Unexpected DynamoDB command in test."
            );
          }
        );

        const response =
          await handler(
            ownerEvent(
              {
                method:
                  "POST",

                path:
                  "/usage/config",

                body: {
                  intervalDays:
                    1,

                  alertThresholds: {
                    day:
                      10,
                  },
                },
              }
            )
          );

        expect(
          response.statusCode
        ).toBe(
          200
        );

        const body =
          parsedBody(
            response
          );

        expect(
          body.config
            .alertThresholdsUsd
        ).toEqual(
          {
            day:
              10,

            week:
              25,

            month:
              null,
          }
        );
      }
    );


    test(
      "POST /usage/config rejects a negative alert threshold",
      async () => {
        mockDynamoSend.mockImplementation(
          (
            command:
              any
          ) => {
            if (
              command.constructor
                .name ===
              "GetItemCommand"
            ) {
              return Promise.resolve(
                {
                  Item:
                    configItem(),
                }
              );
            }

            throw new Error(
              "Unexpected DynamoDB command in test."
            );
          }
        );

        const response =
          await handler(
            ownerEvent(
              {
                method:
                  "POST",

                path:
                  "/usage/config",

                body: {
                  intervalDays:
                    1,

                  alertThresholds: {
                    day:
                      -1,
                  },
                },
              }
            )
          );

        expect(
          response.statusCode
        ).toBe(
          400
        );

        const putCalls =
          mockDynamoSend.mock
            .calls.filter(
              (
                call:
                  any
              ) =>
                call[0]
                  .constructor
                  .name ===
                "PutItemCommand"
            );

        expect(
          putCalls
        ).toHaveLength(
          0
        );
      }
    );


    test(
      "POST /usage/refresh-now asynchronously invokes the aggregator with force:true",
      async () => {
        const response =
          await handler(
            ownerEvent(
              {
                method:
                  "POST",

                path:
                  "/usage/refresh-now",

                body:
                  {},
              }
            )
          );

        expect(
          response.statusCode
        ).toBe(
          202
        );

        expect(
          parsedBody(
            response
          )
            .triggered
        ).toBe(
          true
        );

        expect(
          mockLambdaSend
        ).toHaveBeenCalledTimes(
          1
        );

        const invokeCommand =
          mockLambdaSend.mock
            .calls[0][0];

        expect(
          invokeCommand
            .input
            .FunctionName
        ).toBe(
          USAGE_COST_AGGREGATOR_FUNCTION_NAME
        );

        expect(
          invokeCommand
            .input
            .InvocationType
        ).toBe(
          "Event"
        );

        const payload =
          JSON.parse(
            Buffer.from(
              invokeCommand
                .input
                .Payload
            ).toString(
              "utf8"
            )
          );

        expect(
          payload.force
        ).toBe(
          true
        );
      }
    );


    test(
      "usage routes reject requests without a valid owner token",
      async () => {
        const response =
          await handler(
            {
              requestContext: {
                http: {
                  method:
                    "GET",

                  path:
                    "/usage/summary",
                },
              },

              rawPath:
                "/usage/summary",

              headers:
                {},
            }
          );

        expect(
          response.statusCode
        ).toBe(
          401
        );

        expect(
          mockDynamoSend
        ).not.toHaveBeenCalled();
      }
    );
  }
);
