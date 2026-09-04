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
  USAGE_COST_DEFAULT_INTERVAL_DAYS,
  getLatestUsageCostSnapshot,
  isValidUsageCostIntervalDays,
  listUsageCostSnapshots,
  markUsageCostConfigRun,
  readUsageCostConfig,
  writeUsageCostConfig,
  writeUsageCostSnapshot,
  type UsageCostSnapshot,
} from "../lambda/usage-cost-store";


const TABLE =
  "usage-cost-test-table";


function fakeTable() {
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
              );

          const ordered =
            command.input
              .ScanIndexForward ===
            false
              ? matches.reverse()
              : matches;

          const limited =
            typeof command.input
              .Limit ===
            "number"
              ? ordered.slice(
                  0,
                  command.input
                    .Limit
                )
              : ordered;

          return {
            Items:
              limited.map(
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
  };
}


function snapshotFixture(
  overrides: Partial<UsageCostSnapshot> =
    {}
): UsageCostSnapshot {
  return {
    periodType:
      "day",

    periodKey:
      "2026-09-04",

    periodStart:
      "2026-09-04T00:00:00.000Z",

    periodEnd:
      "2026-09-04T06:00:00.000Z",

    collectedAt:
      "2026-09-04T06:00:00.000Z",

    totalCostUsd:
      1.23,

    costByService: {
      "Amazon S3":
        0.5,

      "AWS Lambda":
        0.73,
    },

    resourceUsage: {
      s3:
        [],

      dynamodb:
        [],

      lambda:
        [],
    },

    ...overrides,
  };
}


describe(
  "usage-cost-store",
  () => {
    test(
      "isValidUsageCostIntervalDays only accepts the allowed set",
      () => {
        expect(
          isValidUsageCostIntervalDays(
            1
          )
        ).toBe(
          true
        );

        expect(
          isValidUsageCostIntervalDays(
            7
          )
        ).toBe(
          true
        );

        expect(
          isValidUsageCostIntervalDays(
            4
          )
        ).toBe(
          false
        );

        expect(
          isValidUsageCostIntervalDays(
            "1"
          )
        ).toBe(
          false
        );
      }
    );


    test(
      "readUsageCostConfig returns a safe default when no config row exists",
      async () => {
        const client =
          fakeTable();

        const config =
          await readUsageCostConfig(
            {
              client,

              tableName:
                TABLE,
            }
          );

        expect(
          config
        ).toEqual(
          {
            intervalDays:
              USAGE_COST_DEFAULT_INTERVAL_DAYS,

            lastRunAt:
              null,

            updatedAt:
              null,

            updatedBy:
              null,

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
          }
        );
      }
    );


    test(
      "writeUsageCostConfig persists and readUsageCostConfig reads it back",
      async () => {
        const client =
          fakeTable();

        await writeUsageCostConfig(
          {
            client,

            tableName:
              TABLE,

            intervalDays:
              3,

            updatedBy:
              "owner",
          }
        );

        const config =
          await readUsageCostConfig(
            {
              client,

              tableName:
                TABLE,
            }
          );

        expect(
          config.intervalDays
        ).toBe(
          3
        );

        expect(
          config.updatedBy
        ).toBe(
          "owner"
        );
      }
    );


    test(
      "writeUsageCostConfig rejects an interval outside the allowed set",
      async () => {
        const client =
          fakeTable();

        await expect(
          writeUsageCostConfig(
            {
              client,

              tableName:
                TABLE,

              intervalDays:
                5,
            }
          )
        ).rejects.toThrow(
          /intervalDays/
        );
      }
    );


    test(
      "markUsageCostConfigRun preserves intervalDays and updates lastRunAt",
      async () => {
        const client =
          fakeTable();

        const config =
          await writeUsageCostConfig(
            {
              client,

              tableName:
                TABLE,

              intervalDays:
                2,
            }
          );

        const next =
          await markUsageCostConfigRun(
            {
              client,

              tableName:
                TABLE,

              config,

              ranAt:
                "2026-09-04T12:00:00.000Z",
            }
          );

        expect(
          next.intervalDays
        ).toBe(
          2
        );

        expect(
          next.lastRunAt
        ).toBe(
          "2026-09-04T12:00:00.000Z"
        );
      }
    );


    test(
      "writeUsageCostSnapshot + listUsageCostSnapshots returns newest-first history",
      async () => {
        const client =
          fakeTable();

        await writeUsageCostSnapshot(
          {
            client,

            tableName:
              TABLE,

            snapshot:
              snapshotFixture(
                {
                  periodKey:
                    "2026-09-02",
                }
              ),
          }
        );

        await writeUsageCostSnapshot(
          {
            client,

            tableName:
              TABLE,

            snapshot:
              snapshotFixture(
                {
                  periodKey:
                    "2026-09-04",
                }
              ),
          }
        );

        await writeUsageCostSnapshot(
          {
            client,

            tableName:
              TABLE,

            snapshot:
              snapshotFixture(
                {
                  periodKey:
                    "2026-09-03",
                }
              ),
          }
        );

        const rows =
          await listUsageCostSnapshots(
            {
              client,

              tableName:
                TABLE,

              periodType:
                "day",
            }
          );

        expect(
          rows.map(
            (
              row
            ) =>
              row.periodKey
          )
        ).toEqual(
          [
            "2026-09-04",
            "2026-09-03",
            "2026-09-02",
          ]
        );
      }
    );


    test(
      "getLatestUsageCostSnapshot returns null when nothing was ever collected",
      async () => {
        const client =
          fakeTable();

        const latest =
          await getLatestUsageCostSnapshot(
            {
              client,

              tableName:
                TABLE,

              periodType:
                "month",
            }
          );

        expect(
          latest
        ).toBeNull();
      }
    );


    test(
      "writeUsageCostSnapshot upserts in place for the same period key",
      async () => {
        const client =
          fakeTable();

        await writeUsageCostSnapshot(
          {
            client,

            tableName:
              TABLE,

            snapshot:
              snapshotFixture(
                {
                  totalCostUsd:
                    1,
                }
              ),
          }
        );

        await writeUsageCostSnapshot(
          {
            client,

            tableName:
              TABLE,

            snapshot:
              snapshotFixture(
                {
                  totalCostUsd:
                    9,
                }
              ),
          }
        );

        const latest =
          await getLatestUsageCostSnapshot(
            {
              client,

              tableName:
                TABLE,

              periodType:
                "day",
            }
          );

        expect(
          latest
            ?.totalCostUsd
        ).toBe(
          9
        );
      }
    );


    test(
      "writeUsageCostConfig persists alert thresholds and lastAlertedPeriodKeys",
      async () => {
        const client =
          fakeTable();

        await writeUsageCostConfig(
          {
            client,

            tableName:
              TABLE,

            intervalDays:
              1,

            alertThresholdsUsd: {
              day:
                5,

              week:
                null,

              month:
                50,
            },

            lastAlertedPeriodKeys: {
              day:
                "2026-09-04",

              week:
                null,

              month:
                null,
            },
          }
        );

        const config =
          await readUsageCostConfig(
            {
              client,

              tableName:
                TABLE,
            }
          );

        expect(
          config.alertThresholdsUsd
        ).toEqual(
          {
            day:
              5,

            week:
              null,

            month:
              50,
          }
        );

        expect(
          config.lastAlertedPeriodKeys
        ).toEqual(
          {
            day:
              "2026-09-04",

            week:
              null,

            month:
              null,
          }
        );
      }
    );


    test(
      "writeUsageCostConfig rejects a negative alert threshold",
      async () => {
        const client =
          fakeTable();

        await expect(
          writeUsageCostConfig(
            {
              client,

              tableName:
                TABLE,

              intervalDays:
                1,

              alertThresholdsUsd: {
                day:
                  -5,

                week:
                  null,

                month:
                  null,
              },
            }
          )
        ).rejects.toThrow(
          /alert threshold/
        );
      }
    );


    test(
      "markUsageCostConfigRun updates lastAlertedPeriodKeys while preserving alertThresholdsUsd",
      async () => {
        const client =
          fakeTable();

        const config =
          await writeUsageCostConfig(
            {
              client,

              tableName:
                TABLE,

              intervalDays:
                1,

              alertThresholdsUsd: {
                day:
                  5,

                week:
                  null,

                month:
                  null,
              },
            }
          );

        const next =
          await markUsageCostConfigRun(
            {
              client,

              tableName:
                TABLE,

              config,

              ranAt:
                "2026-09-04T12:00:00.000Z",

              lastAlertedPeriodKeys: {
                day:
                  "2026-09-04",

                week:
                  null,

                month:
                  null,
              },
            }
          );

        expect(
          next.alertThresholdsUsd
        ).toEqual(
          {
            day:
              5,

            week:
              null,

            month:
              null,
          }
        );

        expect(
          next.lastAlertedPeriodKeys
            .day
        ).toBe(
          "2026-09-04"
        );
      }
    );
  }
);
