import {
  buildConfigurationAnalyticsArchiveDetail,
  selectConfigurationAnalyticsArchiveTraffic,
} from "./configurationAnalyticsArchiveViewModel";


const EPOCH = {
  usageEpochId:
    "uep_archive_traffic",

  stage:
    "prod",

  deploymentConfigurationId:
    "cfg_archive_traffic",

  platformReleaseId:
    "plr_archive_traffic",

  profileVariantId:
    "prv_archive_traffic",

  state:
    "CLOSED",

  startedAt:
    "2026-08-31T00:00:00.000Z",

  endedAt:
    "2026-09-01T00:00:00.000Z",

  report: {
    reportId:
      "car_archive_traffic",

    reportSha256:
      "sha_archive_traffic",

    finalizedAt:
      "2026-09-01T00:10:00.000Z",
  },
};


function analytics({
  visitors,
  sessions,
  events,
  activeMs =
    0,
}) {
  return {
    overview: {
      uniqueVisitors:
        visitors,

      newVisitors:
        0,

      returningVisitors:
        0,

      classifiedVisitors:
        0,

      unclassifiedVisitors:
        visitors,

      returningVisitorPct:
        0,

      sessions,

      activeMs,

      avgActiveMsPerSession:
        sessions
          ? Math.round(
              activeMs /
              sessions
            )
          : 0,

      avgSectionsPerSession:
        0,

      eventCount:
        events,

      topSection:
        null,
    },

    sections:
      [],

    ctas:
      [],

    projects:
      [],

    snippets:
      [],

    deepLinks:
      [],

    depthMilestones:
      [],

    countries:
      [],

    cities:
      [],

    daily:
      [],
  };
}


function responseV2() {
  const all =
    analytics({
      visitors:
        2,

      sessions:
        3,

      events:
        9,

      activeMs:
        30000,
    });

  const likelyHuman =
    analytics({
      visitors:
        1,

      sessions:
        1,

      events:
        4,

      activeMs:
        20000,
    });

  const likelyAutomated =
    analytics({
      visitors:
        1,

      sessions:
        1,

      events:
        2,

      activeMs:
        1000,
    });

  const uncertain =
    analytics({
      visitors:
        1,

      sessions:
        1,

      events:
        3,

      activeMs:
        9000,
    });


  return {
    ok:
      true,

    usageEpoch:
      EPOCH,

    reportSha256:
      "sha_archive_traffic",

    report: {
      schemaId:
        "tejas-profile.configuration-analytics-report.v2",

      reportId:
        "car_archive_traffic",

      usageEpochId:
        "uep_archive_traffic",

      stage:
        "prod",

      deploymentConfigurationId:
        "cfg_archive_traffic",

      platformReleaseId:
        "plr_archive_traffic",

      profileVariantId:
        "prv_archive_traffic",

      interval: {
        startedAt:
          EPOCH.startedAt,

        endedAt:
          EPOCH.endedAt,
      },

      traffic: {
        classifierVersion:
          "traffic-classifier.v1",

        summary: {
          all: {
            uniqueVisitors:
              2,

            sessions:
              3,

            eventCount:
              9,

            activeMs:
              30000,
          },

          likely_human: {
            uniqueVisitors:
              1,

            sessions:
              1,

            eventCount:
              4,

            activeMs:
              20000,
          },

          likely_automated: {
            uniqueVisitors:
              1,

            sessions:
              1,

            eventCount:
              2,

            activeMs:
              1000,
          },

          uncertain: {
            uniqueVisitors:
              1,

            sessions:
              1,

            eventCount:
              3,

            activeMs:
              9000,
          },
        },
      },

      analyticsByTraffic: {
        all,

        likely_human:
          likelyHuman,

        likely_automated:
          likelyAutomated,

        uncertain,
      },
    },
  };
}


describe(
  "configurationAnalyticsArchive traffic reports",
  () => {
    test(
      "V2 defaults to Likely human and switches immutable slices",
      () => {
        const detail =
          buildConfigurationAnalyticsArchiveDetail(
            responseV2()
          );


        expect(
          detail.reportVersion
        ).toBe(
          "v2"
        );

        expect(
          detail
            .traffic
            .supported
        ).toBe(true);

        expect(
          detail
            .traffic
            .selectedClassification
        ).toBe(
          "likely_human"
        );

        expect(
          detail
            .overview
            .eventCount
        ).toBe(
          4
        );


        const automated =
          selectConfigurationAnalyticsArchiveTraffic(
            detail,
            "likely_automated"
          );


        expect(
          automated
            .traffic
            .selectedClassification
        ).toBe(
          "likely_automated"
        );

        expect(
          automated
            .overview
            .eventCount
        ).toBe(
          2
        );

        expect(
          automated
            .analyticsByTraffic
            .all
            .overview
            .eventCount
        ).toBe(
          9
        );
      }
    );


    test(
      "legacy V1 stays All-traffic-only without fabricated classifications",
      () => {
        const response =
          responseV2();


        response.report = {
          reportId:
            "car_archive_traffic",

          usageEpochId:
            "uep_archive_traffic",

          stage:
            "prod",

          deploymentConfigurationId:
            "cfg_archive_traffic",

          platformReleaseId:
            "plr_archive_traffic",

          profileVariantId:
            "prv_archive_traffic",

          interval: {
            startedAt:
              EPOCH.startedAt,

            endedAt:
              EPOCH.endedAt,
          },

          analytics:
            analytics({
              visitors:
                2,

              sessions:
                3,

              events:
                9,
            }),
        };


        const detail =
          buildConfigurationAnalyticsArchiveDetail(
            response
          );


        expect(
          detail.reportVersion
        ).toBe(
          "v1"
        );

        expect(
          detail
            .traffic
            .supported
        ).toBe(false);

        expect(
          detail
            .traffic
            .selectedClassification
        ).toBe(
          "all"
        );

        expect(
          detail
            .overview
            .eventCount
        ).toBe(
          9
        );


        expect(
          () =>
            selectConfigurationAnalyticsArchiveTraffic(
              detail,
              "likely_human"
            )
        ).toThrow(
          /supports All traffic only/
        );
      }
    );


    test(
      "explicit unknown report schema fails closed",
      () => {
        const response =
          responseV2();


        response
          .report
          .schemaId =
          "tejas-profile.configuration-analytics-report.v999";


        expect(
          () =>
            buildConfigurationAnalyticsArchiveDetail(
              response
            )
        ).toThrow(
          /schema/
        );
      }
    );
  }
);
