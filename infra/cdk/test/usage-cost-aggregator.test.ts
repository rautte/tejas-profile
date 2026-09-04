import {
  GetCostAndUsageCommand,
} from "@aws-sdk/client-cost-explorer";

import {
  GetMetricDataCommand,
} from "@aws-sdk/client-cloudwatch";

import {
  GetItemCommand,
  PutItemCommand,
  QueryCommand,
} from "@aws-sdk/client-dynamodb";

import {
  marshall,
  unmarshall,
} from "@aws-sdk/util-dynamodb";

import {
  collectDailyCostBuckets,
  collectResourceUsage,
  collectUsageCostSnapshots,
  runUsageCostAggregation,
} from "../lambda/usage-cost-aggregator";


const TABLE =
  "usage-cost-aggregator-test-table";


function fakeCostExplorerClient(
  resultsByTime: any[]
) {
  return {
    send:
      jest.fn(
        async (
          command: any
        ) => {
          if (
            command instanceof
            GetCostAndUsageCommand
          ) {
            return {
              ResultsByTime:
                resultsByTime,
            };
          }

          throw new Error(
            "Unexpected Cost Explorer command."
          );
        }
      ),
  };
}


function fakeCloudWatchClient(
  valuesById: Record<
    string,
    number[]
  >
) {
  return {
    send:
      jest.fn(
        async (
          command: any
        ) => {
          if (
            command instanceof
            GetMetricDataCommand
          ) {
            return {
              MetricDataResults:
                command.input.MetricDataQueries!.map(
                  (
                    query: any
                  ) => (
                    {
                      Id:
                        query.Id,

                      Values:
                        valuesById[
                          query.Id!
                        ] ||
                        [],
                    }
                  )
                ),
            };
          }

          throw new Error(
            "Unexpected CloudWatch command."
          );
        }
      ),
  };
}


function fakeDynamoTable() {
  const rows =
    new Map<
      string,
      Record<string, any>
    >();


  function key(
    pk: string,
    sk: string
  ) {
    return `${pk}#${sk}`;
  }


  const send =
    jest.fn(
      async (
        command: any
      ) => {
        if (
          command instanceof
          PutItemCommand
        ) {
          const item =
            unmarshall(
              command.input.Item!
            );

          rows.set(
            key(
              item.pk,
              item.sk
            ),
            item
          );

          return {};
        }


        if (
          command instanceof
          GetItemCommand
        ) {
          const wanted =
            unmarshall(
              command.input.Key!
            );

          const item =
            rows.get(
              key(
                wanted.pk,
                wanted.sk
              )
            );

          return {
            Item:
              item
                ? marshall(
                    item
                  )
                : undefined,
          };
        }


        if (
          command instanceof
          QueryCommand
        ) {
          const values =
            unmarshall(
              command.input
                .ExpressionAttributeValues!
            );

          const pkWanted =
            values[":pk"];

          const matches =
            Array.from(
              rows.values()
            )
              .filter(
                (
                  item
                ) =>
                  item.pk ===
                  pkWanted
              )
              .sort(
                (
                  a,
                  b
                ) =>
                  a.sk <
                  b.sk
                    ? -1
                    : 1
              )
              .reverse();

          return {
            Items:
              matches.map(
                (
                  item
                ) =>
                  marshall(
                    item
                  )
              ),
          };
        }


        throw new Error(
          "Unexpected DynamoDB command."
        );
      }
    );


  return {
    send,
    rows,
  };
}


describe(
  "collectDailyCostBuckets",
  () => {
    test(
      "sums per-service cost into one bucket per day",
      async () => {
        const ceClient =
          fakeCostExplorerClient(
            [
              {
                TimePeriod: {
                  Start:
                    "2026-09-01",
                },

                Groups: [
                  {
                    Keys: [
                      "Amazon S3",
                    ],

                    Metrics: {
                      UnblendedCost: {
                        Amount:
                          "0.10",
                      },
                    },
                  },

                  {
                    Keys: [
                      "AWS Lambda",
                    ],

                    Metrics: {
                      UnblendedCost: {
                        Amount:
                          "0.05",
                      },
                    },
                  },
                ],
              },

              {
                TimePeriod: {
                  Start:
                    "2026-09-02",
                },

                Groups: [
                  {
                    Keys: [
                      "Amazon S3",
                    ],

                    Metrics: {
                      UnblendedCost: {
                        Amount:
                          "0.20",
                      },
                    },
                  },
                ],
              },
            ]
          );

        const buckets =
          await collectDailyCostBuckets(
            {
              ceClient,

              now:
                new Date(
                  "2026-09-02T12:00:00.000Z"
                ),
            }
          );

        expect(
          buckets
        ).toHaveLength(
          2
        );

        expect(
          buckets[0]
            .dateKey
        ).toBe(
          "2026-09-01"
        );

        expect(
          buckets[0]
            .totalCostUsd
        ).toBeCloseTo(
          0.15
        );

        expect(
          buckets[0]
            .costByService
        ).toEqual(
          {
            "Amazon S3":
              0.1,

            "AWS Lambda":
              0.05,
          }
        );

        expect(
          buckets[1]
        ).toEqual(
          {
            dateKey:
              "2026-09-02",

            totalCostUsd:
              0.2,

            costByService: {
              "Amazon S3":
                0.2,
            },
          }
        );
      }
    );
  }
);


describe(
  "collectResourceUsage",
  () => {
    test(
      "sums Sum-stat metrics and takes the latest Average-stat datapoint",
      async () => {
        const cwClient =
          fakeCloudWatchClient(
            {
              // s3 bucket-one: sizeBytes (Average), objectCount (Average)
              m0: [
                100,
                200,
              ],

              m1: [
                5,
                9,
              ],

              // dynamodb table-one: consumed RCU/WCU (Sum)
              m2: [
                1,
                2,
                3,
              ],

              m3: [
                4,
              ],

              // lambda fn-one: invocations/errors (Sum)
              m4: [
                10,
                20,
              ],

              m5: [],
            }
          );

        const usage =
          await collectResourceUsage(
            {
              cwClient,

              now:
                new Date(
                  "2026-09-04T06:00:00.000Z"
                ),

              s3Buckets: [
                "bucket-one",
              ],

              dynamoTables: [
                "table-one",
              ],

              lambdaFunctions: [
                "fn-one",
              ],
            }
          );

        expect(
          usage.s3
        ).toEqual(
          [
            {
              name:
                "bucket-one",

              metrics: {
                sizeBytes:
                  100,

                objectCount:
                  5,
              },
            },
          ]
        );

        expect(
          usage.dynamodb
        ).toEqual(
          [
            {
              name:
                "table-one",

              metrics: {
                consumedReadCapacityUnits:
                  6,

                consumedWriteCapacityUnits:
                  4,
              },
            },
          ]
        );

        expect(
          usage.lambda
        ).toEqual(
          [
            {
              name:
                "fn-one",

              metrics: {
                invocations:
                  30,

                errors:
                  0,
              },
            },
          ]
        );
      }
    );


    test(
      "returns empty categories and skips the CloudWatch call when nothing is configured",
      async () => {
        const cwClient =
          fakeCloudWatchClient(
            {}
          );

        const usage =
          await collectResourceUsage(
            {
              cwClient,

              now:
                new Date(),

              s3Buckets:
                [],

              dynamoTables:
                [],

              lambdaFunctions:
                [],
            }
          );

        expect(
          usage
        ).toEqual(
          {
            s3:
              [],

            dynamodb:
              [],

            lambda:
              [],
          }
        );

        expect(
          cwClient.send
        ).not.toHaveBeenCalled();
      }
    );
  }
);


describe(
  "collectUsageCostSnapshots",
  () => {
    test(
      "splits one month of daily buckets into day / current-week / month-to-date totals",
      async () => {
        // 2026-09-04 is a Friday; the ISO week starts Monday 2026-08-31.
        const now =
          new Date(
            "2026-09-04T06:00:00.000Z"
          );

        const dailyBuckets = [
          {
            TimePeriod: {
              Start:
                "2026-08-28",
            },

            Groups: [
              {
                Keys: [
                  "Amazon S3",
                ],

                Metrics: {
                  UnblendedCost: {
                    Amount:
                      "1.00",
                  },
                },
              },
            ],
          },

          {
            TimePeriod: {
              Start:
                "2026-09-01",
            },

            Groups: [
              {
                Keys: [
                  "Amazon S3",
                ],

                Metrics: {
                  UnblendedCost: {
                    Amount:
                      "2.00",
                  },
                },
              },
            ],
          },

          {
            TimePeriod: {
              Start:
                "2026-09-03",
            },

            Groups: [
              {
                Keys: [
                  "Amazon S3",
                ],

                Metrics: {
                  UnblendedCost: {
                    Amount:
                      "3.00",
                  },
                },
              },
            ],
          },

          {
            TimePeriod: {
              Start:
                "2026-09-04",
            },

            Groups: [
              {
                Keys: [
                  "Amazon S3",
                ],

                Metrics: {
                  UnblendedCost: {
                    Amount:
                      "4.00",
                  },
                },
              },
            ],
          },
        ];

        const ceClient =
          fakeCostExplorerClient(
            dailyBuckets
          );

        const cwClient =
          fakeCloudWatchClient(
            {}
          );

        const snapshots =
          await collectUsageCostSnapshots(
            {
              ceClient,

              cwClient,

              now,

              s3Buckets:
                [],

              dynamoTables:
                [],

              lambdaFunctions:
                [],
            }
          );

        // day: only the 2026-09-04 bucket
        expect(
          snapshots.day
            .periodKey
        ).toBe(
          "2026-09-04"
        );

        expect(
          snapshots.day
            .totalCostUsd
        ).toBe(
          4
        );

        // week: 2026-09-01 + 2026-09-03 + 2026-09-04 (Mon..Fri so far),
        // excluding the 2026-08-28 bucket from the prior week.
        expect(
          snapshots.week
            .totalCostUsd
        ).toBe(
          9
        );

        // month: all four buckets fall within TimePeriod (Aug 28 bucket
        // is only included because the fixture put it in the response --
        // the real CE call's TimePeriod.Start excludes it, this fixture
        // exists purely to prove week-filtering excludes prior-week data).
        expect(
          snapshots.month
            .totalCostUsd
        ).toBe(
          10
        );

        expect(
          snapshots.month
            .periodKey
        ).toBe(
          "2026-09"
        );
      }
    );
  }
);


describe(
  "runUsageCostAggregation",
  () => {
    const dailyBuckets = [
      {
        TimePeriod: {
          Start:
            "2026-09-04",
        },

        Groups: [
          {
            Keys: [
              "Amazon S3",
            ],

            Metrics: {
              UnblendedCost: {
                Amount:
                  "1.00",
              },
            },
          },
        ],
      },
    ];


    test(
      "is a no-op when the configured interval has not elapsed yet",
      async () => {
        const ddb =
          fakeDynamoTable();

        const ceClient =
          fakeCostExplorerClient(
            dailyBuckets
          );

        const cwClient =
          fakeCloudWatchClient(
            {}
          );

        await ddb.send(
          new PutItemCommand(
            {
              TableName:
                TABLE,

              Item:
                marshall(
                  {
                    pk:
                      "CONFIG",

                    sk:
                      "CONFIG",

                    intervalDays:
                      7,

                    lastRunAt:
                      "2026-09-04T00:00:00.000Z",

                    updatedAt:
                      "2026-09-04T00:00:00.000Z",

                    updatedBy:
                      "owner",
                  }
                ),
            }
          )
        );

        const summary =
          await runUsageCostAggregation(
            {
              ddbClient:
                ddb,

              ceClient,

              cwClient,

              tableName:
                TABLE,

              s3Buckets:
                [],

              dynamoTables:
                [],

              lambdaFunctions:
                [],

              now:
                new Date(
                  "2026-09-04T06:00:00.000Z"
                ),
            }
          );

        expect(
          summary.ran
        ).toBe(
          false
        );

        expect(
          ceClient.send
        ).not.toHaveBeenCalled();
      }
    );


    test(
      "runs and writes snapshots + advances lastRunAt once the interval has elapsed",
      async () => {
        const ddb =
          fakeDynamoTable();

        const ceClient =
          fakeCostExplorerClient(
            dailyBuckets
          );

        const cwClient =
          fakeCloudWatchClient(
            {}
          );

        await ddb.send(
          new PutItemCommand(
            {
              TableName:
                TABLE,

              Item:
                marshall(
                  {
                    pk:
                      "CONFIG",

                    sk:
                      "CONFIG",

                    intervalDays:
                      1,

                    lastRunAt:
                      "2026-09-01T00:00:00.000Z",

                    updatedAt:
                      "2026-09-01T00:00:00.000Z",

                    updatedBy:
                      "owner",
                  }
                ),
            }
          )
        );

        const summary =
          await runUsageCostAggregation(
            {
              ddbClient:
                ddb,

              ceClient,

              cwClient,

              tableName:
                TABLE,

              s3Buckets:
                [],

              dynamoTables:
                [],

              lambdaFunctions:
                [],

              now:
                new Date(
                  "2026-09-04T06:00:00.000Z"
                ),
            }
          );

        expect(
          summary.ran
        ).toBe(
          true
        );

        expect(
          summary.lastRunAt
        ).toBe(
          "2026-09-04T06:00:00.000Z"
        );

        expect(
          ddb.rows.get(
            "PERIOD#day#2026-09-04"
          )
            ?.totalCostUsd
        ).toBe(
          1
        );

        expect(
          ddb.rows.get(
            "CONFIG#CONFIG"
          )
            ?.lastRunAt
        ).toBe(
          "2026-09-04T06:00:00.000Z"
        );
      }
    );


    test(
      "force bypasses the interval check even when not due",
      async () => {
        const ddb =
          fakeDynamoTable();

        const ceClient =
          fakeCostExplorerClient(
            dailyBuckets
          );

        const cwClient =
          fakeCloudWatchClient(
            {}
          );

        await ddb.send(
          new PutItemCommand(
            {
              TableName:
                TABLE,

              Item:
                marshall(
                  {
                    pk:
                      "CONFIG",

                    sk:
                      "CONFIG",

                    intervalDays:
                      7,

                    lastRunAt:
                      "2026-09-04T00:00:00.000Z",

                    updatedAt:
                      "2026-09-04T00:00:00.000Z",

                    updatedBy:
                      "owner",
                  }
                ),
            }
          )
        );

        const summary =
          await runUsageCostAggregation(
            {
              ddbClient:
                ddb,

              ceClient,

              cwClient,

              tableName:
                TABLE,

              s3Buckets:
                [],

              dynamoTables:
                [],

              lambdaFunctions:
                [],

              now:
                new Date(
                  "2026-09-04T06:00:00.000Z"
                ),

              force:
                true,
            }
          );

        expect(
          summary.ran
        ).toBe(
          true
        );

        expect(
          summary.reason
        ).toBe(
          "forced"
        );

        expect(
          ceClient.send
        ).toHaveBeenCalledTimes(
          1
        );
      }
    );


    test(
      "runs on the very first invocation, with no prior config row",
      async () => {
        const ddb =
          fakeDynamoTable();

        const ceClient =
          fakeCostExplorerClient(
            dailyBuckets
          );

        const cwClient =
          fakeCloudWatchClient(
            {}
          );

        const summary =
          await runUsageCostAggregation(
            {
              ddbClient:
                ddb,

              ceClient,

              cwClient,

              tableName:
                TABLE,

              s3Buckets:
                [],

              dynamoTables:
                [],

              lambdaFunctions:
                [],

              now:
                new Date(
                  "2026-09-04T06:00:00.000Z"
                ),
            }
          );

        expect(
          summary.ran
        ).toBe(
          true
        );
      }
    );
  }
);
