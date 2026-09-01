function cleanString(
  value
) {
  return String(
    value ??
      ""
  ).trim();
}


function asArray(
  value
) {
  return Array.isArray(
    value
  )
    ? value
    : [];
}


const STATES =
  new Set([
    "OPEN",
    "CLOSING",
    "CLOSED",
  ]);


const ANALYTICS_ARRAY_FIELDS = [
  "sections",
  "ctas",
  "projects",
  "snippets",
  "deepLinks",
  "depthMilestones",
  "countries",
  "cities",
  "daily",
];


const REPORT_SCHEMA_ID_V1 =
  "tejas-profile.configuration-analytics-report.v1";

const REPORT_SCHEMA_ID_V2 =
  "tejas-profile.configuration-analytics-report.v2";


export const DEFAULT_CONFIGURATION_ANALYTICS_TRAFFIC =
  "likely_human";


export const CONFIGURATION_ANALYTICS_TRAFFIC_OPTIONS = [
  {
    id:
      "likely_human",

    label:
      "Likely human",
  },

  {
    id:
      "likely_automated",

    label:
      "Likely automated",
  },

  {
    id:
      "uncertain",

    label:
      "Uncertain",
  },

  {
    id:
      "all",

    label:
      "All traffic",
  },
];


const TRAFFIC_IDS =
  new Set(
    CONFIGURATION_ANALYTICS_TRAFFIC_OPTIONS
      .map(
        (
          option
        ) =>
          option.id
      )
  );


function isPlainObject(
  value
) {
  return Boolean(
    value &&
    typeof value ===
      "object" &&
    !Array.isArray(
      value
    )
  );
}


function normalizeArchiveAnalytics(
  analytics,
  field =
    "Archived Analytics report"
) {
  if (
    !isPlainObject(
      analytics
    ) ||
    !isPlainObject(
      analytics.overview
    )
  ) {
    throw new Error(
      `${field} is missing its overview.`
    );
  }


  for (
    const collection of
      ANALYTICS_ARRAY_FIELDS
  ) {
    if (
      !Array.isArray(
        analytics[
          collection
        ]
      )
    ) {
      throw new Error(
        `${field} is missing ${collection}.`
      );
    }
  }


  return {
    overview:
      analytics.overview,

    sections:
      analytics.sections,

    ctas:
      analytics.ctas,

    projects:
      analytics.projects,

    snippets:
      analytics.snippets,

    deepLinks:
      analytics.deepLinks,

    depthMilestones:
      analytics
        .depthMilestones,

    countries:
      analytics.countries,

    cities:
      analytics.cities,

    daily:
      analytics.daily,
  };
}


function normalizeTrafficSummaryMetric(
  value,
  field
) {
  const number =
    Number(
      value
    );


  if (
    !Number.isInteger(
      number
    ) ||
    number <
      0
  ) {
    throw new Error(
      `${field} must be a non-negative integer.`
    );
  }


  return number;
}


function normalizeTrafficSummaryBucket(
  bucket,
  field
) {
  if (
    !isPlainObject(
      bucket
    )
  ) {
    throw new Error(
      `${field} is missing.`
    );
  }


  return {
    uniqueVisitors:
      normalizeTrafficSummaryMetric(
        bucket
          .uniqueVisitors,
        `${field}.uniqueVisitors`
      ),

    sessions:
      normalizeTrafficSummaryMetric(
        bucket
          .sessions,
        `${field}.sessions`
      ),

    eventCount:
      normalizeTrafficSummaryMetric(
        bucket
          .eventCount,
        `${field}.eventCount`
      ),

    activeMs:
      normalizeTrafficSummaryMetric(
        bucket
          .activeMs,
        `${field}.activeMs`
      ),
  };
}


function normalizeArchiveTraffic(
  report
) {
  const traffic =
    report
      ?.traffic;


  if (
    !isPlainObject(
      traffic
    )
  ) {
    throw new Error(
      "Archived Analytics V2 report is missing traffic metadata."
    );
  }


  const classifierVersion =
    cleanString(
      traffic
        .classifierVersion
    );


  if (
    !classifierVersion
  ) {
    throw new Error(
      "Archived Analytics V2 report is missing its classifier version."
    );
  }


  if (
    !isPlainObject(
      traffic.summary
    )
  ) {
    throw new Error(
      "Archived Analytics V2 report is missing its traffic summary."
    );
  }


  const summary =
    {};


  for (
    const option of
      CONFIGURATION_ANALYTICS_TRAFFIC_OPTIONS
  ) {
    summary[
      option.id
    ] =
      normalizeTrafficSummaryBucket(
        traffic
          .summary[
            option.id
          ],

        `Archived Analytics V2 traffic summary ${option.id}`
      );
  }


  return {
    supported:
      true,

    defaultClassification:
      DEFAULT_CONFIGURATION_ANALYTICS_TRAFFIC,

    selectedClassification:
      DEFAULT_CONFIGURATION_ANALYTICS_TRAFFIC,

    classifierVersion,

    summary,
  };
}


export function buildUsageEpochArchiveRows({
  epochs =
    [],
} = {}) {
  return asArray(
    epochs
  ).map(
    (
      epoch
    ) => {
      const usageEpochId =
        cleanString(
          epoch
            ?.usageEpochId
        );

      const state =
        cleanString(
          epoch
            ?.state
        ).toUpperCase();


      if (
        !usageEpochId
      ) {
        throw new Error(
          "Usage Epoch archive row is missing usageEpochId."
        );
      }


      if (
        !STATES.has(
          state
        )
      ) {
        throw new Error(
          `Usage Epoch "${usageEpochId}" has an invalid lifecycle state.`
        );
      }


      const reportId =
        cleanString(
          epoch
            ?.report
            ?.reportId
        );

      const reportSha256 =
        cleanString(
          epoch
            ?.report
            ?.reportSha256
        );


      return {
        ...epoch,

        usageEpochId,

        state,

        reportReady:
          state ===
            "CLOSED" &&
          Boolean(
            reportId &&
            reportSha256
          ),
      };
    }
  );
}


export function buildConfigurationAnalyticsArchiveDetail(
  response
) {
  const epoch =
    response
      ?.usageEpoch;

  const report =
    response
      ?.report;


  const usageEpochId =
    cleanString(
      epoch
        ?.usageEpochId
    );


  if (
    !usageEpochId ||
    cleanString(
      report
        ?.usageEpochId
    ) !== usageEpochId
  ) {
    throw new Error(
      "Archived Analytics report does not match its Usage Epoch."
    );
  }


  if (
    cleanString(
      epoch
        ?.state
    ).toUpperCase() !==
      "CLOSED"
  ) {
    throw new Error(
      "Archived Analytics report requires a CLOSED Usage Epoch."
    );
  }


  const reportId =
    cleanString(
      report
        ?.reportId
    );


  if (
    !reportId ||
    reportId !==
      cleanString(
        epoch
          ?.report
          ?.reportId
      )
  ) {
    throw new Error(
      "Archived Analytics report ID does not match Usage Epoch evidence."
    );
  }


  const responseSha =
    cleanString(
      response
        ?.reportSha256
    );


  if (
    !responseSha ||
    responseSha !==
      cleanString(
        epoch
          ?.report
          ?.reportSha256
      )
  ) {
    throw new Error(
      "Archived Analytics report checksum does not match Usage Epoch evidence."
    );
  }


  const exactBindings = [
    [
      "stage",
      epoch?.stage,
      report?.stage,
    ],

    [
      "deploymentConfigurationId",
      epoch
        ?.deploymentConfigurationId,
      report
        ?.deploymentConfigurationId,
    ],

    [
      "platformReleaseId",
      epoch
        ?.platformReleaseId,
      report
        ?.platformReleaseId,
    ],

    [
      "profileVariantId",
      epoch
        ?.profileVariantId,
      report
        ?.profileVariantId,
    ],

    [
      "startedAt",
      epoch
        ?.startedAt,
      report
        ?.interval
        ?.startedAt,
    ],

    [
      "endedAt",
      epoch
        ?.endedAt,
      report
        ?.interval
        ?.endedAt,
    ],
  ];


  for (
    const [
      field,
      left,
      right,
    ] of
      exactBindings
  ) {
    if (
      cleanString(
        left
      ) !==
      cleanString(
        right
      )
    ) {
      throw new Error(
        `Archived Analytics report ${field} does not match Usage Epoch evidence.`
      );
    }
  }


  /**
   * Historical frontend fixtures pre-date schemaId inspection.
   *
   * Missing schemaId remains compatible with report V1.
   * An explicitly unknown schema still fails closed.
   */
  const rawSchemaId =
    cleanString(
      report
        ?.schemaId
    );

  const reportSchemaId =
    rawSchemaId ||
    REPORT_SCHEMA_ID_V1;


  if (
    reportSchemaId !==
      REPORT_SCHEMA_ID_V1 &&
    reportSchemaId !==
      REPORT_SCHEMA_ID_V2
  ) {
    throw new Error(
      `Archived Analytics report schema "${reportSchemaId}" is not supported.`
    );
  }


  if (
    reportSchemaId ===
      REPORT_SCHEMA_ID_V2
  ) {
    const analyticsByTraffic =
      report
        ?.analyticsByTraffic;


    if (
      !isPlainObject(
        analyticsByTraffic
      )
    ) {
      throw new Error(
        "Archived Analytics V2 report is missing analyticsByTraffic."
      );
    }


    const normalizedByTraffic =
      {};


    for (
      const option of
        CONFIGURATION_ANALYTICS_TRAFFIC_OPTIONS
    ) {
      normalizedByTraffic[
        option.id
      ] =
        normalizeArchiveAnalytics(
          analyticsByTraffic[
            option.id
          ],

          `Archived Analytics V2 ${option.id} slice`
        );
    }


    const baseDetail = {
      epoch,

      report,

      reportSha256:
        responseSha,

      reportSchemaId,

      reportVersion:
        "v2",

      legacyReport:
        false,

      traffic:
        normalizeArchiveTraffic(
          report
        ),

      analyticsByTraffic:
        normalizedByTraffic,
    };


    return selectConfigurationAnalyticsArchiveTraffic(
      baseDetail,
      DEFAULT_CONFIGURATION_ANALYTICS_TRAFFIC
    );
  }


  const analytics =
    normalizeArchiveAnalytics(
      report
        ?.analytics
    );


  const baseDetail = {
    epoch,

    report,

    reportSha256:
      responseSha,

    reportSchemaId,

    reportVersion:
      "v1",

    legacyReport:
      true,

    traffic: {
      supported:
        false,

      defaultClassification:
        "all",

      selectedClassification:
        "all",

      classifierVersion:
        null,

      summary:
        null,
    },

    analyticsByTraffic: {
      all:
        analytics,
    },
  };


  return selectConfigurationAnalyticsArchiveTraffic(
    baseDetail,
    "all"
  );
}


export function selectConfigurationAnalyticsArchiveTraffic(
  detail,
  classification
) {
  if (
    !isPlainObject(
      detail
    ) ||
    !isPlainObject(
      detail
        .analyticsByTraffic
    )
  ) {
    throw new Error(
      "Archived Analytics detail is invalid."
    );
  }


  const supportsTraffic =
    Boolean(
      detail
        ?.traffic
        ?.supported
    );


  const normalized =
    cleanString(
      classification ||
      detail
        ?.traffic
        ?.defaultClassification ||
      (
        supportsTraffic
          ? DEFAULT_CONFIGURATION_ANALYTICS_TRAFFIC
          : "all"
      )
    )
      .toLowerCase();


  if (
    supportsTraffic
  ) {
    if (
      !TRAFFIC_IDS.has(
        normalized
      )
    ) {
      throw new Error(
        "Archived Analytics traffic classification is invalid."
      );
    }
  } else if (
    normalized !==
      "all"
  ) {
    throw new Error(
      "Legacy Configuration Analytics Report V1 supports All traffic only."
    );
  }


  const analytics =
    normalizeArchiveAnalytics(
      detail
        .analyticsByTraffic[
          normalized
        ],

      `Archived Analytics ${normalized} slice`
    );


  return {
    ...detail,

    traffic: {
      ...detail
        .traffic,

      selectedClassification:
        normalized,
    },

    overview:
      analytics.overview,

    sections:
      analytics.sections,

    ctas:
      analytics.ctas,

    projects:
      analytics.projects,

    snippets:
      analytics.snippets,

    deepLinks:
      analytics.deepLinks,

    depthMilestones:
      analytics
        .depthMilestones,

    countries:
      analytics.countries,

    cities:
      analytics.cities,

    daily:
      analytics.daily,
  };
}
