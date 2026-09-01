import {
  computeDeploymentConfigurationId,
  normalizeAndValidateDeploymentConfigurationDocument,
} from "../lambda/deployment-configuration-contract";

import {
  USAGE_EPOCH_TRANSITION_KIND,
  createClosingUsageEpochDocument,
  createOpenUsageEpochDocument,
} from "../lambda/usage-epoch-contract";

import {
  createUsageEpochAnalyticsEventRecord,
} from "../lambda/usage-epoch-analytics-projection";

import {
  aggregateUsageEpochAnalyticsEvents,
  aggregateUsageEpochAnalyticsTrafficReport,
} from "../lambda/usage-epoch-analytics-aggregator";

import {
  CONFIGURATION_ANALYTICS_REPORT_SCHEMA_ID_V1,
  CONFIGURATION_ANALYTICS_REPORT_SCHEMA_ID_V2,
  computeConfigurationAnalyticsReportId,
  createConfigurationAnalyticsReportDocument,
  createConfigurationAnalyticsReportV2Document,
  normalizeAndValidateConfigurationAnalyticsReportDocument,
} from "../lambda/configuration-analytics-report-contract";

import {
  TRAFFIC_CLASSIFIER_VERSION,
  TRAFFIC_EVIDENCE,
} from "../lambda/traffic-classification";


function configuration() {
  const stage =
    "prod" as const;

  const platformReleaseId =
    "plr_report_v2";

  const profileVariantId =
    "prv_report_v2";

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
      "2026-08-31T00:00:00.000Z",

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
          "Bangalore, India",

        jobRole:
          "Backend / Infrastructure Engineer",
      },
    },
  });
}


function closingEpoch() {
  const open =
    createOpenUsageEpochDocument({
      startedAt:
        "2026-08-31T10:00:00.000Z",

      deploymentConfiguration:
        configuration(),

      openedBy: {
        kind:
          USAGE_EPOCH_TRANSITION_KIND
            .PLATFORM_DEPLOYMENT,

        occurrenceId:
          "pdep_report_v2",
      },
    });


  return createClosingUsageEpochDocument({
    epoch:
      open,

    endedAt:
      "2026-08-31T11:00:00.000Z",

    closedBy: {
      kind:
        USAGE_EPOCH_TRANSITION_KIND
          .PROFILE_ACTIVATION,

      occurrenceId:
        "act_report_v2_close",
    },
  });
}


function record({
  eventId,
  visitorHash,
  sessionHash,
  trafficEvidence =
    [],
}: {
  eventId:
    string;

  visitorHash:
    string;

  sessionHash:
    string;

  trafficEvidence?:
    string[];
}) {
  const epoch =
    closingEpoch();


  return createUsageEpochAnalyticsEventRecord({
    attribution: {
      usageEpochId:
        epoch.usageEpochId,

      stage:
        epoch.stage,

      deploymentConfigurationId:
        epoch
          .deploymentConfigurationId,

      platformReleaseId:
        epoch.platformReleaseId,

      profileVariantId:
        epoch.profileVariantId,

      startedAt:
        epoch.startedAt,

      endedAt:
        epoch.endedAt,
    },

    event: {
      eventId,

      ts:
        Date.parse(
          "2026-08-31T10:20:00.000Z"
        ),

      visitorHash,

      sessionHash,

      type:
        "session_start",

      trafficEvidence,
    },

    geo: {
      countryCode:
        "US",

      regionCode:
        "VA",

      city:
        "Dulles",
    },
  });
}


function reportData() {
  const epoch =
    closingEpoch();


  const human =
    record({
      eventId:
        "human-event",

      visitorHash:
        "visitor-shared",

      sessionHash:
        "session-human",

      trafficEvidence: [
        TRAFFIC_EVIDENCE
          .TRUSTED_POINTER_INPUT,
      ],
    });


  const automated =
    record({
      eventId:
        "automated-event",

      visitorHash:
        "visitor-shared",

      sessionHash:
        "session-automated",

      trafficEvidence: [
        TRAFFIC_EVIDENCE
          .KNOWN_AUTOMATION_USER_AGENT,
      ],
    });


  const uncertain =
    record({
      eventId:
        "uncertain-event",

      visitorHash:
        "visitor-uncertain",

      sessionHash:
        "session-uncertain",
    });


  const events = [
    human,
    automated,
    uncertain,
  ];


  const visitorFirstSeenByHash =
    new Map([
      [
        "visitor-shared",

        Date.parse(
          "2026-08-30T00:00:00.000Z"
        ),
      ],

      [
        "visitor-uncertain",

        Date.parse(
          "2026-08-31T10:20:00.000Z"
        ),
      ],
    ]);


  return {
    epoch,

    events,

    visitorFirstSeenByHash,

    result:
      aggregateUsageEpochAnalyticsTrafficReport({
        epoch,

        events,

        visitorFirstSeenByHash,
      }),
  };
}


describe(
  "Configuration Analytics Report V2",
  () => {
    test(
      "materializes four complete traffic slices with overlapping unique-visitor semantics",
      () => {
        const {
          result,
        } =
          reportData();


        expect(
          result
            .traffic
            .classifierVersion
        ).toBe(
          TRAFFIC_CLASSIFIER_VERSION
        );


        expect(
          result
            .traffic
            .summary
        ).toEqual({
          all: {
            uniqueVisitors:
              2,

            sessions:
              3,

            eventCount:
              3,

            activeMs:
              0,
          },

          likely_human: {
            uniqueVisitors:
              1,

            sessions:
              1,

            eventCount:
              1,

            activeMs:
              0,
          },

          likely_automated: {
            uniqueVisitors:
              1,

            sessions:
              1,

            eventCount:
              1,

            activeMs:
              0,
          },

          uncertain: {
            uniqueVisitors:
              1,

            sessions:
              1,

            eventCount:
              1,

            activeMs:
              0,
          },
        });


        expect(
          result
            .analyticsByTraffic
            .likely_human
            .overview
            .sessions
        ).toBe(
          1
        );

        expect(
          result
            .analyticsByTraffic
            .likely_automated
            .overview
            .sessions
        ).toBe(
          1
        );

        expect(
          result
            .analyticsByTraffic
            .uncertain
            .overview
            .sessions
        ).toBe(
          1
        );
      }
    );


    test(
      "creates schema-specific V1 and V2 immutable report identities",
      () => {
        const {
          epoch,
          events,
          visitorFirstSeenByHash,
          result,
        } =
          reportData();


        const v2 =
          createConfigurationAnalyticsReportV2Document({
            epoch,

            traffic:
              result.traffic,

            analyticsByTraffic:
              result
                .analyticsByTraffic,
          });


        expect(
          v2.schemaId
        ).toBe(
          CONFIGURATION_ANALYTICS_REPORT_SCHEMA_ID_V2
        );


        expect(
          v2.reportId
        ).toBe(
          computeConfigurationAnalyticsReportId({
            stage:
              epoch.stage,

            usageEpochId:
              epoch.usageEpochId,

            schemaId:
              CONFIGURATION_ANALYTICS_REPORT_SCHEMA_ID_V2,
          })
        );


        const legacyAnalytics =
          aggregateUsageEpochAnalyticsEvents({
            epoch,

            events,

            visitorFirstSeenByHash,
          });


        const v1 =
          createConfigurationAnalyticsReportDocument({
            epoch,

            analytics:
              legacyAnalytics,
          });


        expect(
          v1.schemaId
        ).toBe(
          CONFIGURATION_ANALYTICS_REPORT_SCHEMA_ID_V1
        );


        expect(
          v1.reportId
        ).not.toBe(
          v2.reportId
        );


        expect(
          normalizeAndValidateConfigurationAnalyticsReportDocument(
            v1
          )
        ).toEqual(
          v1
        );


        expect(
          normalizeAndValidateConfigurationAnalyticsReportDocument(
            v2
          )
        ).toEqual(
          v2
        );
      }
    );


    test(
      "fails closed when traffic summary disagrees with an analytics slice",
      () => {
        const {
          epoch,
          result,
        } =
          reportData();


        expect(
          () =>
            createConfigurationAnalyticsReportV2Document({
              epoch,

              traffic: {
                ...result
                  .traffic,

                summary: {
                  ...result
                    .traffic
                    .summary,

                  likely_human: {
                    ...result
                      .traffic
                      .summary
                      .likely_human,

                    sessions:
                      99,
                  },
                },
              },

              analyticsByTraffic:
                result
                  .analyticsByTraffic,
            })
        ).toThrow(
          /does not match/
        );
      }
    );


    test(
      "rejects V1-only analytics field on a V2 report",
      () => {
        const {
          epoch,
          result,
        } =
          reportData();


        const report =
          createConfigurationAnalyticsReportV2Document({
            epoch,

            traffic:
              result.traffic,

            analyticsByTraffic:
              result
                .analyticsByTraffic,
          });


        expect(
          () =>
            normalizeAndValidateConfigurationAnalyticsReportDocument({
              ...report,

              analytics:
                result
                  .analyticsByTraffic
                  .all,
            })
        ).toThrow(
          "Configuration Analytics Report.analytics is not supported."
        );
      }
    );
  }
);
