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
  }
);