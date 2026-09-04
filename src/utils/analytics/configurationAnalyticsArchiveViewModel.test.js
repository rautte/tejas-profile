import {
  buildConfigurationAnalyticsArchiveDetail,
  buildUsageEpochArchiveRows,
} from "./configurationAnalyticsArchiveViewModel";


function responseFixture() {
  const epoch = {
    usageEpochId:
      "uep_one",

    stage:
      "prod",

    deploymentConfigurationId:
      "cfg_one",

    platformReleaseId:
      "plr_one",

    profileVariantId:
      "prv_one",

    state:
      "CLOSED",

    startedAt:
      "2026-08-20T00:00:00.000Z",

    endedAt:
      "2026-08-21T00:00:00.000Z",

    report: {
      reportId:
        "car_one",

      reportSha256:
        "sha_one",

      finalizedAt:
        "2026-08-22T00:00:00.000Z",
    },
  };


  return {
    ok:
      true,

    usageEpoch:
      epoch,

    reportSha256:
      "sha_one",

    report: {
      reportId:
        "car_one",

      usageEpochId:
        "uep_one",

      stage:
        "prod",

      deploymentConfigurationId:
        "cfg_one",

      platformReleaseId:
        "plr_one",

      profileVariantId:
        "prv_one",

      interval: {
        startedAt:
          epoch.startedAt,

        endedAt:
          epoch.endedAt,
      },

      analytics: {
        overview: {
          uniqueVisitors:
            3,

          sessions:
            4,

          eventCount:
            10,
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
      },
    },
  };
}


describe(
  "configurationAnalyticsArchiveViewModel",
  () => {
    test(
      "marks only finalized CLOSED epochs as report-ready",
      () => {
        const rows =
          buildUsageEpochArchiveRows({
            epochs: [
              responseFixture()
                .usageEpoch,

              {
                usageEpochId:
                  "uep_closing",

                state:
                  "CLOSING",
              },

              {
                usageEpochId:
                  "uep_open",

                state:
                  "OPEN",
              },
            ],
          });


        expect(
          rows.map(
            (
              row
            ) => [
              row.state,
              row.reportReady,
            ]
          )
        ).toEqual([
          [
            "CLOSED",
            true,
          ],

          [
            "CLOSING",
            false,
          ],

          [
            "OPEN",
            false,
          ],
        ]);
      }
    );


    test(
      "builds one exact immutable report model",
      () => {
        const model =
          buildConfigurationAnalyticsArchiveDetail(
            responseFixture()
          );


        expect(
          model.epoch
            .usageEpochId
        ).toBe(
          "uep_one"
        );

        expect(
          model.overview
            .uniqueVisitors
        ).toBe(
          3
        );
      }
    );


    test(
      "fails closed on runtime-identity drift",
      () => {
        const fixture =
          responseFixture();

        fixture.report
          .profileVariantId =
          "prv_other";


        expect(
          () =>
            buildConfigurationAnalyticsArchiveDetail(
              fixture
            )
        ).toThrow(
          /profileVariantId/
        );
      }
    );


    test(
      "fails closed when a required immutable analytics collection is absent",
      () => {
        const fixture =
          responseFixture();

        delete fixture
          .report
          .analytics
          .daily;


        expect(
          () =>
            buildConfigurationAnalyticsArchiveDetail(
              fixture
            )
        ).toThrow(
          /daily/
        );
      }
    );


    test(
      "surfaces engagement and Outreach Score from a V2 report's default traffic slice",
      () => {
        function emptySlice(
          overrides =
            {}
        ) {
          return {
            overview: {
              uniqueVisitors:
                0,

              sessions:
                0,

              eventCount:
                0,

              activeMs:
                0,
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

            ...overrides,
          };
        }


        const epoch = {
          usageEpochId:
            "uep_v2",

          stage:
            "prod",

          deploymentConfigurationId:
            "cfg_v2",

          platformReleaseId:
            "plr_v2",

          profileVariantId:
            "prv_v2",

          state:
            "CLOSED",

          startedAt:
            "2026-08-20T00:00:00.000Z",

          endedAt:
            "2026-08-21T00:00:00.000Z",

          report: {
            reportId:
              "car_v2",

            reportSha256:
              "sha_v2",

            finalizedAt:
              "2026-08-22T00:00:00.000Z",
          },
        };


        const outreachScore = {
          algorithm:
            "outreach-score.v1",

          score:
            57,

          confidence:
            "medium",

          components: {
            reach:
              50,

            engagement:
              60,

            depth:
              40,

            intent:
              70,

            consistency:
              65,
          },
        };


        const engagement = {
          meaningfulSessionCount:
            2,

          engagedSessionCount:
            1,

          topSessionActiveMsShare:
            0.5,
        };


        const trafficSummaryBucket = {
          uniqueVisitors:
            0,

          sessions:
            0,

          eventCount:
            0,

          activeMs:
            0,
        };


        const fixture = {
          ok:
            true,

          usageEpoch:
            epoch,

          reportSha256:
            "sha_v2",

          report: {
            schemaId:
              "tejas-profile.configuration-analytics-report.v2",

            reportId:
              "car_v2",

            usageEpochId:
              "uep_v2",

            stage:
              "prod",

            deploymentConfigurationId:
              "cfg_v2",

            platformReleaseId:
              "plr_v2",

            profileVariantId:
              "prv_v2",

            interval: {
              startedAt:
                epoch.startedAt,

              endedAt:
                epoch.endedAt,
            },

            traffic: {
              classifierVersion:
                "traffic-classifier.v1",

              summary: {
                all:
                  trafficSummaryBucket,

                likely_human:
                  trafficSummaryBucket,

                likely_automated:
                  trafficSummaryBucket,

                uncertain:
                  trafficSummaryBucket,
              },
            },

            analyticsByTraffic: {
              all:
                emptySlice(),

              likely_human:
                emptySlice(
                  {
                    engagement,
                    outreachScore,
                  }
                ),

              likely_automated:
                emptySlice(),

              uncertain:
                emptySlice(),
            },
          },
        };


        const detail =
          buildConfigurationAnalyticsArchiveDetail(
            fixture
          );


        expect(
          detail.outreachScore
        ).toEqual(
          outreachScore
        );

        expect(
          detail.engagement
        ).toEqual(
          engagement
        );
      }
    );
  }
);