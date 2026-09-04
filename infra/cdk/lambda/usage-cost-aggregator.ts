// infra/cdk/lambda/usage-cost-aggregator.ts
//
// Scheduled worker for the admin "Usage" page (P13 point 4).
//
// Collects two kinds of evidence on every real run:
//
//   1. Actual AWS dollar cost, by service, via Cost Explorer
//      (account-wide -- Cost Explorer has no per-Lambda IAM scoping,
//      and this AWS account is dedicated to this project).
//   2. Resource-level usage for the core application backend (the
//      S3 buckets / DynamoDB tables / Lambda functions this stack
//      owns), via CloudWatch metrics.
//
// and upserts three DynamoDB rows (day / week / month, keyed by the
// current period) via usage-cost-store.
//
// EventBridge ticks this Lambda far more often than any owner would
// actually want fresh data (see the stack's schedule) -- each tick
// is a cheap no-op unless the configured refresh interval has
// actually elapsed, or the caller explicitly forces a run (the
// admin page's "Refresh now" button, via a Lambda Invoke payload of
// { force: true }). This keeps Cost Explorer's per-call cost
// negligible while still giving the owner immediate feedback when
// they ask for it.

import {
  CostExplorerClient,
  GetCostAndUsageCommand,
} from "@aws-sdk/client-cost-explorer";

import {
  CloudWatchClient,
  GetMetricDataCommand,
} from "@aws-sdk/client-cloudwatch";

import {
  DynamoDBClient,
} from "@aws-sdk/client-dynamodb";

import {
  SESv2Client,
  SendEmailCommand,
} from "@aws-sdk/client-sesv2";

import {
  USAGE_COST_DEFAULT_INTERVAL_DAYS,
  USAGE_COST_PERIOD_TYPES,
  markUsageCostConfigRun,
  readUsageCostConfig,
  writeUsageCostConfig,
  writeUsageCostSnapshot,
  type UsageCostAlertedPeriodKeys,
  type UsageCostConfig,
  type UsageCostPeriodType,
  type UsageCostResourceUsageEntry,
  type UsageCostSnapshot,
} from "./usage-cost-store";


type Sender = {
  send:
    (
      command:
        any
    ) => Promise<any>;
};


function parseCsvEnv(
  value:
    string |
    undefined
): string[] {
  return String(
    value ||
      ""
  )
    .split(
      ","
    )
    .map(
      (
        entry
      ) =>
        entry.trim()
    )
    .filter(
      Boolean
    );
}


function startOfUtcDay(
  date:
    Date
): Date {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate()
    )
  );
}


function addUtcDays(
  date:
    Date,

  days:
    number
): Date {
  const next =
    new Date(
      date.getTime()
    );

  next.setUTCDate(
    next.getUTCDate() +
    days
  );

  return next;
}


function toDateKey(
  date:
    Date
): string {
  return date
    .toISOString()
    .slice(
      0,
      10
    );
}


function toMonthKey(
  date:
    Date
): string {
  return date
    .toISOString()
    .slice(
      0,
      7
    );
}


function startOfIsoWeek(
  date:
    Date
): Date {
  const day =
    startOfUtcDay(
      date
    );

  const isoDayNum =
    day.getUTCDay() ||
    7;

  return addUtcDays(
    day,
    1 -
    isoDayNum
  );
}


function isoWeekKey(
  date:
    Date
): string {
  const target =
    new Date(
      Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate()
      )
    );

  const dayNum =
    target.getUTCDay() ||
    7;

  target.setUTCDate(
    target.getUTCDate() +
    4 -
    dayNum
  );

  const yearStart =
    new Date(
      Date.UTC(
        target.getUTCFullYear(),
        0,
        1
      )
    );

  const weekNo =
    Math.ceil(
      (
        (
          (
            target.getTime() -
            yearStart.getTime()
          ) /
          86400000
        ) +
        1
      ) /
      7
    );

  return `${target.getUTCFullYear()}-W${String(
    weekNo
  ).padStart(
    2,
    "0"
  )}`;
}


function startOfUtcMonth(
  date:
    Date
): Date {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      1
    )
  );
}


type DailyCostBucket = {
  dateKey:
    string;

  totalCostUsd:
    number;

  costByService:
    Record<
      string,
      number
    >;
};


export async function collectDailyCostBuckets(
  {
    ceClient,
    now,
  }: {
    ceClient:
      CostExplorerClient |
      Sender;

    now:
      Date;
  }
): Promise<DailyCostBucket[]> {
  const start =
    startOfUtcMonth(
      now
    );

  const end =
    addUtcDays(
      startOfUtcDay(
        now
      ),
      1
    );


  const result =
    await ceClient.send(
      new GetCostAndUsageCommand(
        {
          TimePeriod: {
            Start:
              toDateKey(
                start
              ),

            End:
              toDateKey(
                end
              ),
          },

          Granularity:
            "DAILY",

          Metrics: [
            "UnblendedCost",
          ],

          GroupBy: [
            {
              Type:
                "DIMENSION",

              Key:
                "SERVICE",
            },
          ],
        }
      )
    );


  const resultsByTime =
    (
      result as
        any
    )?.ResultsByTime ||
    [];


  return resultsByTime.map(
    (
      entry:
        any
    ) => {
      const dateKey =
        String(
          entry?.TimePeriod
            ?.Start ||
          ""
        );

      const costByService: Record<
        string,
        number
      > =
        {};

      let totalCostUsd =
        0;


      for (
        const group of
          entry?.Groups ||
          []
      ) {
        const service =
          String(
            group?.Keys?.[0] ||
            "Unknown"
          );

        const amount =
          Number.parseFloat(
            group
              ?.Metrics
              ?.UnblendedCost
              ?.Amount ||
            "0"
          ) ||
          0;

        costByService[service] =
          (
            costByService[
              service
            ] ||
            0
          ) +
          amount;

        totalCostUsd +=
          amount;
      }


      return {
        dateKey,
        totalCostUsd,
        costByService,
      };
    }
  );
}


type MetricRequest = {
  category:
    "s3" |
    "dynamodb" |
    "lambda";

  name:
    string;

  metricLabel:
    string;

  namespace:
    string;

  metricName:
    string;

  dimensions:
    Array<{
      Name:
        string;

      Value:
        string;
    }>;

  stat:
    "Sum" |
    "Average";
};


export async function collectResourceUsage(
  {
    cwClient,
    now,
    s3Buckets,
    dynamoTables,
    lambdaFunctions,
  }: {
    cwClient:
      CloudWatchClient |
      Sender;

    now:
      Date;

    s3Buckets:
      string[];

    dynamoTables:
      string[];

    lambdaFunctions:
      string[];
  }
): Promise<{
  s3:
    UsageCostResourceUsageEntry[];

  dynamodb:
    UsageCostResourceUsageEntry[];

  lambda:
    UsageCostResourceUsageEntry[];
}> {
  const requests: MetricRequest[] =
    [];


  s3Buckets.forEach(
    (
      bucket,
      index
    ) => {
      requests.push(
        {
          category:
            "s3",

          name:
            bucket,

          metricLabel:
            "sizeBytes",

          namespace:
            "AWS/S3",

          metricName:
            "BucketSizeBytes",

          dimensions: [
            {
              Name:
                "BucketName",

              Value:
                bucket,
            },

            {
              Name:
                "StorageType",

              Value:
                "StandardStorage",
            },
          ],

          stat:
            "Average",
        }
      );

      requests.push(
        {
          category:
            "s3",

          name:
            bucket,

          metricLabel:
            "objectCount",

          namespace:
            "AWS/S3",

          metricName:
            "NumberOfObjects",

          dimensions: [
            {
              Name:
                "BucketName",

              Value:
                bucket,
            },

            {
              Name:
                "StorageType",

              Value:
                "AllStorageTypes",
            },
          ],

          stat:
            "Average",
        }
      );
    }
  );


  dynamoTables.forEach(
    (
      table
    ) => {
      requests.push(
        {
          category:
            "dynamodb",

          name:
            table,

          metricLabel:
            "consumedReadCapacityUnits",

          namespace:
            "AWS/DynamoDB",

          metricName:
            "ConsumedReadCapacityUnits",

          dimensions: [
            {
              Name:
                "TableName",

              Value:
                table,
            },
          ],

          stat:
            "Sum",
        }
      );

      requests.push(
        {
          category:
            "dynamodb",

          name:
            table,

          metricLabel:
            "consumedWriteCapacityUnits",

          namespace:
            "AWS/DynamoDB",

          metricName:
            "ConsumedWriteCapacityUnits",

          dimensions: [
            {
              Name:
                "TableName",

              Value:
                table,
            },
          ],

          stat:
            "Sum",
        }
      );
    }
  );


  lambdaFunctions.forEach(
    (
      functionName
    ) => {
      requests.push(
        {
          category:
            "lambda",

          name:
            functionName,

          metricLabel:
            "invocations",

          namespace:
            "AWS/Lambda",

          metricName:
            "Invocations",

          dimensions: [
            {
              Name:
                "FunctionName",

              Value:
                functionName,
            },
          ],

          stat:
            "Sum",
        }
      );

      requests.push(
        {
          category:
            "lambda",

          name:
            functionName,

          metricLabel:
            "errors",

          namespace:
            "AWS/Lambda",

          metricName:
            "Errors",

          dimensions: [
            {
              Name:
                "FunctionName",

              Value:
                functionName,
            },
          ],

          stat:
            "Sum",
        }
      );
    }
  );


  const byCategory: {
    s3:
      Map<
        string,
        Record<string, number>
      >;

    dynamodb:
      Map<
        string,
        Record<string, number>
      >;

    lambda:
      Map<
        string,
        Record<string, number>
      >;
  } =
    {
      s3:
        new Map(),

      dynamodb:
        new Map(),

      lambda:
        new Map(),
    };


  if (
    requests.length ===
    0
  ) {
    return {
      s3:
        [],

      dynamodb:
        [],

      lambda:
        [],
    };
  }


  // S3 storage metrics publish once/day and can lag; a 2-day
  // lookback window with the most recent datapoint reliably has
  // fresh-enough evidence without over-fetching history.
  const endTime =
    now;

  const startTime =
    addUtcDays(
      now,
      -2
    );


  const result =
    await cwClient.send(
      new GetMetricDataCommand(
        {
          StartTime:
            startTime,

          EndTime:
            endTime,

          MetricDataQueries:
            requests.map(
              (
                request,
                index
              ) => (
                {
                  Id:
                    `m${index}`,

                  MetricStat: {
                    Metric: {
                      Namespace:
                        request.namespace,

                      MetricName:
                        request.metricName,

                      Dimensions:
                        request.dimensions,
                    },

                    Period:
                      86400,

                    Stat:
                      request.stat,
                  },

                  ReturnData:
                    true,
                }
              )
            ),
        }
      )
    );


  const resultsById =
    new Map<
      string,
      number[]
    >();


  for (
    const entry of
      (
        result as
          any
      )?.MetricDataResults ||
      []
  ) {
    resultsById.set(
      String(
        entry?.Id ||
        ""
      ),
      Array.isArray(
        entry?.Values
      )
        ? entry.Values
        : []
    );
  }


  requests.forEach(
    (
      request,
      index
    ) => {
      const values =
        resultsById.get(
          `m${index}`
        ) ||
        [];

      const value =
        request.stat ===
          "Sum"
          ? values.reduce(
              (
                sum,
                v
              ) =>
                sum +
                (
                  Number(
                    v
                  ) ||
                  0
                ),
              0
            )
          : (
              values[0] ??
              0
            );

      const bucket =
        byCategory[
          request.category
        ];

      const existing =
        bucket.get(
          request.name
        ) ||
        {};

      existing[
        request.metricLabel
      ] =
        value;

      bucket.set(
        request.name,
        existing
      );
    }
  );


  function toEntries(
    map:
      Map<
        string,
        Record<string, number>
      >
  ): UsageCostResourceUsageEntry[] {
    return Array.from(
      map.entries()
    ).map(
      ([
        name,
        metrics,
      ]) => (
        {
          name,
          metrics,
        }
      )
    );
  }


  return {
    s3:
      toEntries(
        byCategory.s3
      ),

    dynamodb:
      toEntries(
        byCategory.dynamodb
      ),

    lambda:
      toEntries(
        byCategory.lambda
      ),
  };
}


export async function collectUsageCostSnapshots(
  {
    ceClient,
    cwClient,
    now,
    s3Buckets,
    dynamoTables,
    lambdaFunctions,
  }: {
    ceClient:
      CostExplorerClient |
      Sender;

    cwClient:
      CloudWatchClient |
      Sender;

    now:
      Date;

    s3Buckets:
      string[];

    dynamoTables:
      string[];

    lambdaFunctions:
      string[];
  }
): Promise<{
  day:
    UsageCostSnapshot;

  week:
    UsageCostSnapshot;

  month:
    UsageCostSnapshot;
}> {
  const [
    dailyBuckets,
    resourceUsage,
  ] =
    await Promise.all(
      [
        collectDailyCostBuckets(
          {
            ceClient,
            now,
          }
        ),

        collectResourceUsage(
          {
            cwClient,
            now,
            s3Buckets,
            dynamoTables,
            lambdaFunctions,
          }
        ),
      ]
    );


  const collectedAt =
    now.toISOString();

  const todayKey =
    toDateKey(
      now
    );

  const weekStart =
    startOfIsoWeek(
      now
    );

  const weekStartKey =
    toDateKey(
      weekStart
    );

  const monthStart =
    startOfUtcMonth(
      now
    );


  function sumBuckets(
    buckets:
      DailyCostBucket[]
  ): {
    totalCostUsd:
      number;

    costByService:
      Record<string, number>;
  } {
    const costByService: Record<
      string,
      number
    > =
      {};

    let totalCostUsd =
      0;


    for (
      const bucket of
        buckets
    ) {
      totalCostUsd +=
        bucket.totalCostUsd;


      for (
        const [
          service,
          amount,
        ] of Object.entries(
          bucket.costByService
        )
      ) {
        costByService[
          service
        ] =
          (
            costByService[
              service
            ] ||
            0
          ) +
          amount;
      }
    }


    return {
      totalCostUsd,
      costByService,
    };
  }


  const dayBucket =
    dailyBuckets.find(
      (
        bucket
      ) =>
        bucket.dateKey ===
        todayKey
    ) ||
    dailyBuckets[
      dailyBuckets.length -
      1
    ] ||
    {
      dateKey:
        todayKey,

      totalCostUsd:
        0,

      costByService:
        {},
    };

  const weekBuckets =
    dailyBuckets.filter(
      (
        bucket
      ) =>
        bucket.dateKey >=
        weekStartKey
    );


  const weekTotals =
    sumBuckets(
      weekBuckets
    );

  const monthTotals =
    sumBuckets(
      dailyBuckets
    );


  const day: UsageCostSnapshot =
    {
      periodType:
        "day",

      periodKey:
        todayKey,

      periodStart:
        startOfUtcDay(
          now
        ).toISOString(),

      periodEnd:
        collectedAt,

      collectedAt,

      totalCostUsd:
        dayBucket.totalCostUsd,

      costByService:
        dayBucket.costByService,

      resourceUsage,
    };

  const week: UsageCostSnapshot =
    {
      periodType:
        "week",

      periodKey:
        isoWeekKey(
          now
        ),

      periodStart:
        weekStart.toISOString(),

      periodEnd:
        collectedAt,

      collectedAt,

      totalCostUsd:
        weekTotals.totalCostUsd,

      costByService:
        weekTotals.costByService,

      resourceUsage,
    };

  const month: UsageCostSnapshot =
    {
      periodType:
        "month",

      periodKey:
        toMonthKey(
          now
        ),

      periodStart:
        monthStart.toISOString(),

      periodEnd:
        collectedAt,

      collectedAt,

      totalCostUsd:
        monthTotals.totalCostUsd,

      costByService:
        monthTotals.costByService,

      resourceUsage,
    };


  return {
    day,
    week,
    month,
  };
}


// Sends at most one email per period per breach: the moment a
// period's totalCostUsd first crosses its owner-set threshold, an
// alert goes out and that period's key is recorded in
// lastAlertedPeriodKeys so subsequent ticks (still over threshold,
// same period) never re-send. The next period naturally gets a
// fresh periodKey, so alerting re-arms on its own -- no manual
// reset needed.
//
// An email failure is logged and swallowed, never thrown: sending
// an alert must never be able to block or roll back the
// aggregation run that produced the data it's alerting about.
export async function checkAndSendUsageCostAlerts(
  {
    sesClient,
    ownerNotificationEmail,
    stage,
    config,
    snapshots,
  }: {
    sesClient?:
      SESv2Client |
      Sender;

    ownerNotificationEmail?:
      string;

    stage:
      string;

    config:
      UsageCostConfig;

    snapshots: {
      day:
        UsageCostSnapshot;

      week:
        UsageCostSnapshot;

      month:
        UsageCostSnapshot;
    };
  }
): Promise<{
  alertsSent:
    UsageCostPeriodType[];

  lastAlertedPeriodKeys:
    UsageCostAlertedPeriodKeys;
}> {
  const lastAlertedPeriodKeys: UsageCostAlertedPeriodKeys =
    {
      ...config.lastAlertedPeriodKeys,
    };

  const alertsSent: UsageCostPeriodType[] =
    [];


  if (
    !sesClient ||
    !ownerNotificationEmail
  ) {
    return {
      alertsSent,
      lastAlertedPeriodKeys,
    };
  }


  for (
    const periodType of
      USAGE_COST_PERIOD_TYPES
  ) {
    const threshold =
      config
        .alertThresholdsUsd[
        periodType
      ];

    const snapshot =
      snapshots[
        periodType
      ];


    if (
      threshold ===
        null ||
      threshold ===
        undefined ||
      !snapshot ||
      snapshot.totalCostUsd <
        threshold ||
      lastAlertedPeriodKeys[
        periodType
      ] ===
        snapshot.periodKey
    ) {
      continue;
    }


    try {
      await sesClient.send(
        new SendEmailCommand(
          {
            FromEmailAddress:
              ownerNotificationEmail,

            Destination: {
              ToAddresses: [
                ownerNotificationEmail,
              ],
            },

            Content: {
              Simple: {
                Subject: {
                  Data:
                    `Usage alert: ${periodType} cost exceeded threshold -- tejas-profile (${stage})`,
                },

                Body: {
                  Text: {
                    Data:
                      `The ${periodType} AWS cost for tejas-profile (${stage}) has reached $${snapshot.totalCostUsd.toFixed(
                        2
                      )}, exceeding your configured alert threshold of $${threshold.toFixed(
                        2
                      )}.\n\nPeriod: ${
                        snapshot.periodKey
                      }\nCollected: ${
                        snapshot.collectedAt
                      }\n\nThis is a best-effort estimate from AWS Cost Explorer and may lag actual billing by up to a day. Adjust or clear this alert threshold from the Usage page in the admin dashboard. You will not be alerted again for this same period.`,
                  },
                },
              },
            },
          }
        )
      );

      lastAlertedPeriodKeys[
        periodType
      ] =
        snapshot.periodKey;

      alertsSent.push(
        periodType
      );
    } catch (
      error: any
    ) {
      console.error(
        "Usage cost alert email failed",
        {
          periodType,

          error:
            String(
              error
                ?.message ||
              error
            ),
        }
      );
    }
  }


  return {
    alertsSent,
    lastAlertedPeriodKeys,
  };
}


export type UsageCostAggregationSummary = {
  ran:
    boolean;

  reason:
    string;

  intervalDays:
    number;

  lastRunAt:
    string |
    null;

  alertsSent:
    UsageCostPeriodType[];
};


export async function runUsageCostAggregation(
  {
    ddbClient,
    ceClient,
    cwClient,
    sesClient,
    tableName,
    s3Buckets,
    dynamoTables,
    lambdaFunctions,
    ownerNotificationEmail,

    stage =
      "dev",

    now =
      new Date(),

    force =
      false,
  }: {
    ddbClient:
      DynamoDBClient |
      Sender;

    ceClient:
      CostExplorerClient |
      Sender;

    cwClient:
      CloudWatchClient |
      Sender;

    sesClient?:
      SESv2Client |
      Sender;

    tableName:
      string;

    s3Buckets:
      string[];

    dynamoTables:
      string[];

    lambdaFunctions:
      string[];

    ownerNotificationEmail?:
      string;

    stage?:
      string;

    now?:
      Date;

    force?:
      boolean;
  }
): Promise<UsageCostAggregationSummary> {
  const config =
    await readUsageCostConfig(
      {
        client:
          ddbClient,

        tableName,
      }
    );


  const intervalDays =
    config.intervalDays ||
    USAGE_COST_DEFAULT_INTERVAL_DAYS;


  const dueAt =
    config.lastRunAt
      ? new Date(
          config.lastRunAt
        ).getTime() +
        intervalDays *
        24 *
        60 *
        60 *
        1000
      : 0;


  if (
    !force &&
    now.getTime() <
    dueAt
  ) {
    return {
      ran:
        false,

      reason:
        "not due yet",

      intervalDays,

      lastRunAt:
        config.lastRunAt,

      alertsSent:
        [],
    };
  }


  const snapshots =
    await collectUsageCostSnapshots(
      {
        ceClient,
        cwClient,
        now,
        s3Buckets,
        dynamoTables,
        lambdaFunctions,
      }
    );


  await Promise.all(
    [
      writeUsageCostSnapshot(
        {
          client:
            ddbClient,

          tableName,

          snapshot:
            snapshots.day,
        }
      ),

      writeUsageCostSnapshot(
        {
          client:
            ddbClient,

          tableName,

          snapshot:
            snapshots.week,
        }
      ),

      writeUsageCostSnapshot(
        {
          client:
            ddbClient,

          tableName,

          snapshot:
            snapshots.month,
        }
      ),
    ]
  );


  const ranAt =
    now.toISOString();


  const {
    alertsSent,
    lastAlertedPeriodKeys,
  } =
    await checkAndSendUsageCostAlerts(
      {
        sesClient,

        ownerNotificationEmail,

        stage,

        config,

        snapshots,
      }
    );


  await markUsageCostConfigRun(
    {
      client:
        ddbClient,

      tableName,

      config,

      ranAt,

      lastAlertedPeriodKeys,
    }
  );


  return {
    ran:
      true,

    reason:
      force
        ? "forced"
        : "due",

    intervalDays,

    lastRunAt:
      ranAt,

    alertsSent,
  };
}


const ceClient =
  new CostExplorerClient(
    {
      // Cost Explorer is a global service reachable only via
      // us-east-1, regardless of the stack's own region.
      region:
        "us-east-1",
    }
  );

const cwClient =
  new CloudWatchClient(
    {}
  );

const ddbClient =
  new DynamoDBClient(
    {}
  );

const sesClient =
  new SESv2Client(
    {}
  );


const {
  USAGE_COST_METRICS_TABLE =
    "",

  USAGE_COST_S3_BUCKETS =
    "",

  USAGE_COST_DYNAMODB_TABLES =
    "",

  USAGE_COST_LAMBDA_FUNCTIONS =
    "",

  OWNER_NOTIFICATION_EMAIL =
    "",

  STAGE =
    "dev",
} =
  process.env;


export async function handler(
  event?: {
    force?:
      boolean;
  }
): Promise<UsageCostAggregationSummary> {
  const summary =
    await runUsageCostAggregation(
      {
        ddbClient,

        ceClient,

        cwClient,

        sesClient,

        tableName:
          USAGE_COST_METRICS_TABLE,

        s3Buckets:
          parseCsvEnv(
            USAGE_COST_S3_BUCKETS
          ),

        dynamoTables:
          parseCsvEnv(
            USAGE_COST_DYNAMODB_TABLES
          ),

        lambdaFunctions:
          parseCsvEnv(
            USAGE_COST_LAMBDA_FUNCTIONS
          ),

        ownerNotificationEmail:
          OWNER_NOTIFICATION_EMAIL ||
          undefined,

        stage:
          STAGE,

        force:
          Boolean(
            event
              ?.force
          ),
      }
    );


  console.log(
    "Usage cost aggregation completed.",
    summary
  );


  return summary;
}
