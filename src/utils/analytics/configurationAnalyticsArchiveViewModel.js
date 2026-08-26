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


  const analytics =
    report
      ?.analytics;


  if (
    !analytics ||
    typeof analytics !==
      "object" ||
    Array.isArray(
      analytics
    ) ||
    !analytics.overview ||
    typeof analytics.overview !==
      "object" ||
    Array.isArray(
      analytics.overview
    )
  ) {
    throw new Error(
      "Archived Analytics report is missing its overview."
    );
  }


  for (
    const field of
      ANALYTICS_ARRAY_FIELDS
  ) {
    if (
      !Array.isArray(
        analytics[
          field
        ]
      )
    ) {
      throw new Error(
        `Archived Analytics report is missing ${field}.`
      );
    }
  }


  return {
    epoch,

    report,

    reportSha256:
      responseSha,

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