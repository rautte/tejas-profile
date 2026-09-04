// infra/cdk/lambda/usage-cost-store.ts
//
// Storage for the admin "Usage" page (P13 point 4): AWS resource
// usage/cost snapshots aggregated day/week/month, plus the
// owner-configurable refresh-schedule config.
//
// Single table, two item shapes:
//
//   pk = "CONFIG",            sk = "CONFIG"           -- refresh config (one row)
//   pk = "PERIOD#<day|week|month>", sk = "<periodKey>" -- one row per period
//
// This is admin-only, mutable, best-effort operational data (not a
// public-facing immutable audit record like Usage Epochs or
// Configuration Analytics reports), so unlike those stores this one
// intentionally has no checksum/immutability machinery -- a plain
// upsert per collection run is correct and sufficient.

import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  QueryCommand,
} from "@aws-sdk/client-dynamodb";

import {
  marshall,
  unmarshall,
} from "@aws-sdk/util-dynamodb";


export const USAGE_COST_PERIOD_TYPES = [
  "day",
  "week",
  "month",
] as const;

export type UsageCostPeriodType =
  typeof USAGE_COST_PERIOD_TYPES[number];


export const USAGE_COST_ALLOWED_INTERVAL_DAYS = [
  1,
  2,
  3,
  7,
] as const;

export const USAGE_COST_DEFAULT_INTERVAL_DAYS =
  1;


export type UsageCostAlertThresholds = {
  day:
    number |
    null;

  week:
    number |
    null;

  month:
    number |
    null;
};


export type UsageCostAlertedPeriodKeys = {
  day:
    string |
    null;

  week:
    string |
    null;

  month:
    string |
    null;
};


export type UsageCostConfig = {
  intervalDays:
    number;

  lastRunAt:
    string |
    null;

  updatedAt:
    string |
    null;

  updatedBy:
    string |
    null;

  // Owner-set $ thresholds (USD) per period type. null/absent means
  // "no alert configured" for that period. Checked once per real
  // aggregation run (see runUsageCostAggregation) -- never on the
  // cheap not-due no-op ticks.
  alertThresholdsUsd:
    UsageCostAlertThresholds;

  // The periodKey already alerted on, per period type -- prevents
  // re-sending the same email on every subsequent run while a
  // period stays over threshold. Reset naturally once the period
  // rolls over to a new periodKey.
  lastAlertedPeriodKeys:
    UsageCostAlertedPeriodKeys;
};


const EMPTY_ALERT_THRESHOLDS: UsageCostAlertThresholds =
  {
    day:
      null,

    week:
      null,

    month:
      null,
  };


const EMPTY_ALERTED_PERIOD_KEYS: UsageCostAlertedPeriodKeys =
  {
    day:
      null,

    week:
      null,

    month:
      null,
  };


export function isValidUsageCostAlertThreshold(
  value:
    unknown
): value is number | null {
  if (
    value ===
      null ||
    value ===
      undefined
  ) {
    return true;
  }

  return (
    typeof value ===
      "number" &&
    Number.isFinite(
      value
    ) &&
    value >=
      0
  );
}


export type UsageCostResourceUsageEntry = {
  name:
    string;

  metrics:
    Record<
      string,
      number
    >;
};


export type UsageCostSnapshot = {
  periodType:
    UsageCostPeriodType;

  periodKey:
    string;

  periodStart:
    string;

  periodEnd:
    string;

  collectedAt:
    string;

  totalCostUsd:
    number;

  costByService:
    Record<
      string,
      number
    >;

  resourceUsage: {
    s3:
      UsageCostResourceUsageEntry[];

    dynamodb:
      UsageCostResourceUsageEntry[];

    lambda:
      UsageCostResourceUsageEntry[];
  };
};


type DynamoDbSender = {
  send:
    (
      command:
        any
    ) => Promise<any>;
};


const CONFIG_PK =
  "CONFIG";

const CONFIG_SK =
  "CONFIG";


function periodPk(
  periodType:
    UsageCostPeriodType
) {
  return `PERIOD#${periodType}`;
}


export function isValidUsageCostIntervalDays(
  value:
    unknown
): value is number {
  return (
    typeof value ===
      "number" &&
    Number.isInteger(
      value
    ) &&
    (
      USAGE_COST_ALLOWED_INTERVAL_DAYS as
        readonly number[]
    ).includes(
      value
    )
  );
}


export async function readUsageCostConfig(
  {
    client,
    tableName,
  }: {
    client:
      DynamoDBClient |
      DynamoDbSender;

    tableName:
      string;
  }
): Promise<UsageCostConfig> {
  const result =
    await client.send(
      new GetItemCommand(
        {
          TableName:
            tableName,

          Key:
            marshall(
              {
                pk:
                  CONFIG_PK,

                sk:
                  CONFIG_SK,
              }
            ),
        }
      )
    );


  if (
    !result.Item
  ) {
    return {
      intervalDays:
        USAGE_COST_DEFAULT_INTERVAL_DAYS,

      lastRunAt:
        null,

      updatedAt:
        null,

      updatedBy:
        null,

      alertThresholdsUsd:
        EMPTY_ALERT_THRESHOLDS,

      lastAlertedPeriodKeys:
        EMPTY_ALERTED_PERIOD_KEYS,
    };
  }


  const item =
    unmarshall(
      result.Item
    ) as any;


  function threshold(
    value:
      unknown
  ) {
    return isValidUsageCostAlertThreshold(
      value
    )
      ? (
          value as
            number |
            null
        )
      : null;
  }


  function alertedKey(
    value:
      unknown
  ) {
    return typeof value ===
      "string"
      ? value
      : null;
  }


  return {
    intervalDays:
      isValidUsageCostIntervalDays(
        item.intervalDays
      )
        ? item.intervalDays
        : USAGE_COST_DEFAULT_INTERVAL_DAYS,

    lastRunAt:
      typeof item.lastRunAt ===
        "string"
        ? item.lastRunAt
        : null,

    updatedAt:
      typeof item.updatedAt ===
        "string"
        ? item.updatedAt
        : null,

    updatedBy:
      typeof item.updatedBy ===
        "string"
        ? item.updatedBy
        : null,

    alertThresholdsUsd: {
      day:
        threshold(
          item
            ?.alertThresholdsUsd
            ?.day
        ),

      week:
        threshold(
          item
            ?.alertThresholdsUsd
            ?.week
        ),

      month:
        threshold(
          item
            ?.alertThresholdsUsd
            ?.month
        ),
    },

    lastAlertedPeriodKeys: {
      day:
        alertedKey(
          item
            ?.lastAlertedPeriodKeys
            ?.day
        ),

      week:
        alertedKey(
          item
            ?.lastAlertedPeriodKeys
            ?.week
        ),

      month:
        alertedKey(
          item
            ?.lastAlertedPeriodKeys
            ?.month
        ),
    },
  };
}


export async function writeUsageCostConfig(
  {
    client,
    tableName,
    intervalDays,
    updatedBy,
    lastRunAt,
    alertThresholdsUsd,
    lastAlertedPeriodKeys,
  }: {
    client:
      DynamoDBClient |
      DynamoDbSender;

    tableName:
      string;

    intervalDays:
      number;

    updatedBy?:
      string |
      null;

    lastRunAt?:
      string |
      null;

    alertThresholdsUsd?:
      UsageCostAlertThresholds;

    lastAlertedPeriodKeys?:
      UsageCostAlertedPeriodKeys;
  }
): Promise<UsageCostConfig> {
  if (
    !isValidUsageCostIntervalDays(
      intervalDays
    )
  ) {
    throw new Error(
      `intervalDays must be one of ${USAGE_COST_ALLOWED_INTERVAL_DAYS.join(
        ", "
      )}.`
    );
  }


  for (
    const value of [
      alertThresholdsUsd
        ?.day,

      alertThresholdsUsd
        ?.week,

      alertThresholdsUsd
        ?.month,
    ]
  ) {
    if (
      !isValidUsageCostAlertThreshold(
        value
      )
    ) {
      throw new Error(
        "Each alert threshold must be a non-negative number, or null to disable it."
      );
    }
  }


  const next: UsageCostConfig =
    {
      intervalDays,

      lastRunAt:
        lastRunAt ??
        null,

      updatedAt:
        new Date().toISOString(),

      updatedBy:
        updatedBy ||
        null,

      alertThresholdsUsd:
        alertThresholdsUsd ||
        EMPTY_ALERT_THRESHOLDS,

      lastAlertedPeriodKeys:
        lastAlertedPeriodKeys ||
        EMPTY_ALERTED_PERIOD_KEYS,
    };


  await client.send(
    new PutItemCommand(
      {
        TableName:
          tableName,

        Item:
          marshall(
            {
              pk:
                CONFIG_PK,

              sk:
                CONFIG_SK,

              ...next,
            },
            {
              removeUndefinedValues:
                true,
            }
          ),
      }
    )
  );


  return next;
}


export async function markUsageCostConfigRun(
  {
    client,
    tableName,
    config,
    ranAt,
    lastAlertedPeriodKeys,
  }: {
    client:
      DynamoDBClient |
      DynamoDbSender;

    tableName:
      string;

    config:
      UsageCostConfig;

    ranAt:
      string;

    lastAlertedPeriodKeys?:
      UsageCostAlertedPeriodKeys;
  }
): Promise<UsageCostConfig> {
  return writeUsageCostConfig(
    {
      client,

      tableName,

      intervalDays:
        config.intervalDays,

      updatedBy:
        config.updatedBy,

      lastRunAt:
        ranAt,

      alertThresholdsUsd:
        config.alertThresholdsUsd,

      lastAlertedPeriodKeys:
        lastAlertedPeriodKeys ||
        config.lastAlertedPeriodKeys,
    }
  );
}


export async function writeUsageCostSnapshot(
  {
    client,
    tableName,
    snapshot,
  }: {
    client:
      DynamoDBClient |
      DynamoDbSender;

    tableName:
      string;

    snapshot:
      UsageCostSnapshot;
  }
): Promise<void> {
  await client.send(
    new PutItemCommand(
      {
        TableName:
          tableName,

        Item:
          marshall(
            {
              pk:
                periodPk(
                  snapshot.periodType
                ),

              sk:
                snapshot.periodKey,

              ...snapshot,
            },
            {
              removeUndefinedValues:
                true,
            }
          ),
      }
    )
  );
}


export async function listUsageCostSnapshots(
  {
    client,
    tableName,
    periodType,
    limit,
  }: {
    client:
      DynamoDBClient |
      DynamoDbSender;

    tableName:
      string;

    periodType:
      UsageCostPeriodType;

    limit?:
      number;
  }
): Promise<UsageCostSnapshot[]> {
  const result =
    await client.send(
      new QueryCommand(
        {
          TableName:
            tableName,

          KeyConditionExpression:
            "pk = :pk",

          ExpressionAttributeValues:
            marshall(
              {
                ":pk":
                  periodPk(
                    periodType
                  ),
              }
            ),

          ScanIndexForward:
            false,

          Limit:
            typeof limit ===
              "number" &&
            limit >
              0
              ? limit
              : 30,
        }
      )
    );


  return (
    result.Items ||
    []
  ).map(
    (
      item:
        any
    ) =>
      unmarshall(
        item
      ) as UsageCostSnapshot
  );
}


export async function getLatestUsageCostSnapshot(
  {
    client,
    tableName,
    periodType,
  }: {
    client:
      DynamoDBClient |
      DynamoDbSender;

    tableName:
      string;

    periodType:
      UsageCostPeriodType;
  }
): Promise<UsageCostSnapshot | null> {
  const rows =
    await listUsageCostSnapshots(
      {
        client,

        tableName,

        periodType,

        limit:
          1,
      }
    );


  return (
    rows[0] ||
    null
  );
}
