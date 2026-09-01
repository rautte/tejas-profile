// infra/cdk/lambda/configuration-analytics-report-finalizer.ts

import {
  DynamoDBClient,
} from "@aws-sdk/client-dynamodb";

import {
  S3Client,
} from "@aws-sdk/client-s3";

import {
  MAX_EVENT_AGE_MS,
} from "./analytics-domain";

import {
  createConfigurationAnalyticsReportV2Document,
} from "./configuration-analytics-report-contract";

import {
  writeImmutableConfigurationAnalyticsReport,
} from "./configuration-analytics-report-store";

import {
  buildUsageEpochAnalyticsReportV2Data,
} from "./usage-epoch-analytics-aggregator";

import {
  USAGE_EPOCH_STATE,
} from "./usage-epoch-contract";

import {
  readUsageEpochRecord,
} from "./usage-epoch-store";

import {
  finalizeUsageEpochRecord,
  listSettledClosingUsageEpochIds,
} from "./usage-epoch-finalization-store";


const ddb =
  new DynamoDBClient(
    {}
  );

const s3 =
  new S3Client(
    {}
  );


const {
  USAGE_EPOCHS_TABLE =
    "",

  USAGE_EPOCH_ANALYTICS_TABLE =
    "",

  ANALYTICS_TABLE =
    "",

  CONFIGURATION_ANALYTICS_REPORTS_BUCKET =
    "",

  STAGE =
    "dev",
} =
  process.env;


/**
 * Ingest may accept an event until 24 hours after event.ts.
 *
 * Add five minutes beyond that contract so an ingest invocation that
 * begins immediately before the age boundary has ample time to finish
 * its Usage Epoch projection before immutable report generation begins.
 *
 * Current Analytics Lambda timeout is only 12 seconds, so five minutes
 * is intentionally conservative.
 */
export const USAGE_EPOCH_FINALIZATION_SAFETY_MS =
  5 * 60 * 1000;

export const USAGE_EPOCH_FINALIZATION_SETTLEMENT_MS =
  MAX_EVENT_AGE_MS +
  USAGE_EPOCH_FINALIZATION_SAFETY_MS;

export const MAX_USAGE_EPOCHS_PER_FINALIZER_RUN =
  10;


type DynamoDbSender = {
  send:
    (
      command:
        any
    ) => Promise<any>;
};


type S3Sender = {
  send:
    (
      command:
        any
    ) => Promise<any>;
};


function cleanString(
  value:
    unknown
) {
  return String(
    value ?? ""
  ).trim();
}


function requireResourceName(
  value:
    unknown,

  field:
    string
) {
  const normalized =
    cleanString(
      value
    );


  if (!normalized) {
    throw new Error(
      `${field} is required.`
    );
  }


  return normalized;
}


function requireStage(
  value:
    unknown
) {
  const normalized =
    cleanString(
      value
    );


  if (
    normalized !==
      "dev" &&
    normalized !==
      "prod"
  ) {
    throw new Error(
      'Finalizer stage must be "dev" or "prod".'
    );
  }


  return normalized as
    | "dev"
    | "prod";
}


function requireNowMs(
  value:
    unknown
) {
  const normalized =
    Number(
      value
    );


  if (
    !Number.isFinite(
      normalized
    ) ||
    normalized <=
      0
  ) {
    throw new Error(
      "Finalizer time is invalid."
    );
  }


  return Math.round(
    normalized
  );
}


export function configurationAnalyticsReportSettlementCutoffIso(
  nowMs =
    Date.now()
) {
  const now =
    requireNowMs(
      nowMs
    );


  return new Date(
    now -
    USAGE_EPOCH_FINALIZATION_SETTLEMENT_MS
  ).toISOString();
}


function epochIsSettled({
  endedAt,

  nowMs,
}: {
  endedAt:
    string;

  nowMs:
    number;
}) {
  const ended =
    Date.parse(
      endedAt
    );


  if (
    !Number.isFinite(
      ended
    )
  ) {
    throw new Error(
      "Usage Epoch endedAt is invalid."
    );
  }


  return (
    ended +
      USAGE_EPOCH_FINALIZATION_SETTLEMENT_MS <=
    nowMs
  );
}


export async function finalizeConfigurationAnalyticsReportForEpoch({
  ddbClient,

  s3Client,

  usageEpochsTableName,

  usageEpochAnalyticsTableName,

  analyticsTableName,

  reportsBucketName,

  stage,

  usageEpochId,

  nowMs =
    Date.now(),
}: {
  ddbClient:
    DynamoDbSender;

  s3Client:
    S3Sender;

  usageEpochsTableName:
    string;

  usageEpochAnalyticsTableName:
    string;

  analyticsTableName:
    string;

  reportsBucketName:
    string;

  stage:
    string;

  usageEpochId:
    string;

  nowMs?:
    number;
}) {
  const usageEpochsTable =
    requireResourceName(
      usageEpochsTableName,
      "Usage Epoch table name"
    );

  const projectionTable =
    requireResourceName(
      usageEpochAnalyticsTableName,
      "Usage Epoch Analytics table name"
    );

  const analyticsTable =
    requireResourceName(
      analyticsTableName,
      "Analytics table name"
    );

  const reportsBucket =
    requireResourceName(
      reportsBucketName,
      "Configuration Analytics Reports bucket name"
    );

  const normalizedStage =
    requireStage(
      stage
    );

  const now =
    requireNowMs(
      nowMs
    );


  const epoch =
    await readUsageEpochRecord({
      client:
        ddbClient,

      tableName:
        usageEpochsTable,

      usageEpochId,
    });


  if (
    epoch.stage !==
      normalizedStage
  ) {
    throw new Error(
      "Usage Epoch belongs to a different stage."
    );
  }


  /**
   * The ByState GSI is eventually consistent.
   *
   * A just-finalized CLOSED epoch may temporarily reappear as a CLOSING
   * candidate. Strong base-table state always wins.
   */
  if (
    epoch.state ===
      USAGE_EPOCH_STATE
        .CLOSED
  ) {
    return {
      usageEpochId:
        epoch.usageEpochId,

      status:
        "already_closed" as const,

      reportId:
        epoch.report
          ?.reportId ||
        null,

      reportSha256:
        epoch.report
          ?.reportSha256 ||
        null,

      reportAlreadyExists:
        true,
    };
  }


  if (
    epoch.state !==
      USAGE_EPOCH_STATE
        .CLOSING
  ) {
    return {
      usageEpochId:
        epoch.usageEpochId,

      status:
        "not_closing" as const,

      reportId:
        null,

      reportSha256:
        null,

      reportAlreadyExists:
        false,
    };
  }


  if (
    !epoch.endedAt ||
    !epochIsSettled({
      endedAt:
        epoch.endedAt,

      nowMs:
        now,
    })
  ) {
    return {
      usageEpochId:
        epoch.usageEpochId,

      status:
        "unsettled" as const,

      reportId:
        null,

      reportSha256:
        null,

      reportAlreadyExists:
        false,
    };
  }


  const reportData =
    await buildUsageEpochAnalyticsReportV2Data({
      client:
        ddbClient,

      projectionTableName:
        projectionTable,

      analyticsTableName:
        analyticsTable,

      epoch,
    });


  const report =
    createConfigurationAnalyticsReportV2Document({
      epoch,

      traffic:
        reportData
          .traffic,

      analyticsByTraffic:
        reportData
          .analyticsByTraffic,
    });


  /**
   * S3 commit intentionally happens before DynamoDB lifecycle commit.
   *
   * If the process crashes after this write, retry reconstructs the same
   * deterministic report. P8D's immutable store accepts byte-identical
   * existing content and refuses conflicting content.
   */
  const reportWrite =
    await writeImmutableConfigurationAnalyticsReport({
      client:
        s3Client,

      bucketName:
        reportsBucket,

      report,
    });


  const lifecycleCommit =
    await finalizeUsageEpochRecord({
      client:
        ddbClient,

      tableName:
        usageEpochsTable,

      epoch,

      reportId:
        report.reportId,

      reportSha256:
        reportWrite
          .reportSha256,

      finalizedAt:
        new Date(
          now
        ).toISOString(),
    });


  return {
    usageEpochId:
      epoch.usageEpochId,

    status:
      lifecycleCommit
        .alreadyFinalized
        ? "already_finalized" as const
        : "finalized" as const,

    reportId:
      report.reportId,

    reportSha256:
      reportWrite
        .reportSha256,

    reportAlreadyExists:
      reportWrite
        .alreadyExists,
  };
}


export async function runConfigurationAnalyticsReportFinalizer({
  ddbClient,

  s3Client,

  usageEpochsTableName,

  usageEpochAnalyticsTableName,

  analyticsTableName,

  reportsBucketName,

  stage,

  nowMs =
    Date.now(),

  limit =
    MAX_USAGE_EPOCHS_PER_FINALIZER_RUN,
}: {
  ddbClient:
    DynamoDbSender;

  s3Client:
    S3Sender;

  usageEpochsTableName:
    string;

  usageEpochAnalyticsTableName:
    string;

  analyticsTableName:
    string;

  reportsBucketName:
    string;

  stage:
    string;

  nowMs?:
    number;

  limit?:
    number;
}) {
  const now =
    requireNowMs(
      nowMs
    );

  const normalizedStage =
    requireStage(
      stage
    );

  const usageEpochsTable =
    requireResourceName(
      usageEpochsTableName,
      "Usage Epoch table name"
    );


  const cutoffIso =
    configurationAnalyticsReportSettlementCutoffIso(
      now
    );


  const candidateIds =
    await listSettledClosingUsageEpochIds({
      client:
        ddbClient,

      tableName:
        usageEpochsTable,

      cutoffIso,

      limit,
    });


  const results:
    any[] =
      [];

  const failures:
    {
      usageEpochId:
        string;

      message:
        string;
    }[] =
      [];


  /**
   * Sequential processing is intentional.
   *
   * One report may query a substantial epoch partition. Bounding both the
   * candidate count and concurrency avoids turning the scheduled worker
   * into an uncontrolled DynamoDB burst.
   */
  for (
    const usageEpochId of
      candidateIds
  ) {
    try {
      results.push(
        await finalizeConfigurationAnalyticsReportForEpoch({
          ddbClient,

          s3Client,

          usageEpochsTableName:
            usageEpochsTable,

          usageEpochAnalyticsTableName,

          analyticsTableName,

          reportsBucketName,

          stage:
            normalizedStage,

          usageEpochId,

          nowMs:
            now,
        })
      );
    } catch (
      error:
        any
    ) {
      failures.push({
        usageEpochId,

        message:
          String(
            error?.message ||
            error
          ),
      });

      console.error(
        "Configuration Analytics Report finalization failed.",
        {
          usageEpochId,

          error,
        }
      );
    }
  }


  const summary = {
    cutoffIso,

    candidates:
      candidateIds.length,

    finalized:
      results.filter(
        (
          result
        ) =>
          result.status ===
            "finalized"
      ).length,

    alreadyFinalized:
      results.filter(
        (
          result
        ) =>
          result.status ===
            "already_finalized" ||
          result.status ===
            "already_closed"
      ).length,

    skipped:
      results.filter(
        (
          result
        ) =>
          result.status ===
            "unsettled" ||
          result.status ===
            "not_closing"
      ).length,

    failures,
  };


  /**
   * Process healthy candidates even when another candidate is corrupt,
   * then fail the invocation so the problem remains visible/retryable.
   */
  if (
    failures.length >
    0
  ) {
    const error:
      any =
        new Error(
          `Configuration Analytics Report finalizer failed for ${failures.length} Usage Epoch(s).`
        );

    error.summary =
      summary;

    throw error;
  }


  return summary;
}


export async function handler() {
  const summary =
    await runConfigurationAnalyticsReportFinalizer({
      ddbClient:
        ddb,

      s3Client:
        s3,

      usageEpochsTableName:
        USAGE_EPOCHS_TABLE,

      usageEpochAnalyticsTableName:
        USAGE_EPOCH_ANALYTICS_TABLE,

      analyticsTableName:
        ANALYTICS_TABLE,

      reportsBucketName:
        CONFIGURATION_ANALYTICS_REPORTS_BUCKET,

      stage:
        STAGE,
    });


  console.log(
    "Configuration Analytics Report finalizer completed.",
    summary
  );


  return summary;
}