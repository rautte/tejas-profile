import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";

import ConfigurationAnalyticsArchivePanel from "./ConfigurationAnalyticsArchivePanel";

import {
  getConfigurationAnalyticsReport,
  getConfigurationAnalyticsReportsBatch,
  listUsageEpochs,
} from "../../utils/analytics/analyticsApi";

import {
  getProfileVariantsBatch,
} from "../../utils/snapshots/snapshotsApi";


jest.mock(
  "../../utils/analytics/analyticsApi",
  () => ({
    getConfigurationAnalyticsReport:
      jest.fn(),

    getConfigurationAnalyticsReportsBatch:
      jest.fn(),

    listUsageEpochs:
      jest.fn(),
  })
);


jest.mock(
  "../../utils/snapshots/snapshotsApi",
  () => ({
    getProfileVariantsBatch:
      jest.fn(),
  })
);


const CLOSED_EPOCH = {
  usageEpochId:
    "uep_archive",

  stage:
    "prod",

  deploymentConfigurationId:
    "cfg_archive",

  platformReleaseId:
    "plr_archive",

  profileVariantId:
    "prv_archive",

  state:
    "CLOSED",

  startedAt:
    "2026-08-20T00:00:00.000Z",

  endedAt:
    "2026-08-21T00:00:00.000Z",

  openedBy: {
    kind:
      "platform_deployment",

    occurrenceId:
      "pdep_archive",
  },

  closedBy: {
    kind:
      "profile_activation",

    occurrenceId:
      "act_archive",
  },

  report: {
    reportId:
      "car_archive",

    reportSha256:
      "sha_archive",

    finalizedAt:
      "2026-08-22T00:00:00.000Z",
  },
};


const REPORT_RESPONSE = {
  ok:
    true,

  usageEpoch:
    CLOSED_EPOCH,

  reportSha256:
    "sha_archive",

  report: {
    reportId:
      "car_archive",

    usageEpochId:
      "uep_archive",

    stage:
      "prod",

    deploymentConfigurationId:
      "cfg_archive",

    platformReleaseId:
      "plr_archive",

    profileVariantId:
      "prv_archive",

    interval: {
      startedAt:
        CLOSED_EPOCH
          .startedAt,

      endedAt:
        CLOSED_EPOCH
          .endedAt,
    },

    analytics: {
      overview: {
        uniqueVisitors:
          7,

        newVisitors:
          5,

        returningVisitors:
          2,

        unclassifiedVisitors:
          0,

        sessions:
          8,

        activeMs:
          12000,

        avgActiveMsPerSession:
          1500,

        eventCount:
          42,

        topSection:
          "Projects",
      },

      sections: [
        {
          section:
            "Projects",

          visitors:
            6,

          sessions:
            7,

          visits:
            8,

          activeMs:
            9000,

          visitorReachPct:
            85.7,
        },
      ],

      ctas:
        [],

      projects:
        [],

      snippets:
        [],

      deepLinks:
        [],

      depthMilestones: [
        {
          section:
            "Projects",

          depthPct:
            75,

          visitors:
            5,

          sessions:
            6,
        },
      ],

      countries:
        [],

      cities:
        [],

      daily: [
        {
          day:
            "2026-08-20",

          uniqueVisitors:
            7,

          sessions:
            8,

          eventCount:
            42,

          activeMs:
            12000,
        },
      ],
    },
  },
};


beforeEach(
  () => {
    jest.clearAllMocks();


    listUsageEpochs
      .mockResolvedValue({
        ok:
          true,

        epochs: [
          CLOSED_EPOCH,
        ],

        nextToken:
          "next-page",
      });


    getConfigurationAnalyticsReport
      .mockResolvedValue(
        REPORT_RESPONSE
      );


    getConfigurationAnalyticsReportsBatch
      .mockResolvedValue(
        []
      );


    getProfileVariantsBatch
      .mockResolvedValue(
        []
      );
  }
);


describe(
  "ConfigurationAnalyticsArchivePanel",
  () => {
    test(
      "loads CLOSED archive history and opens one immutable report",
      async () => {
        render(
          <ConfigurationAnalyticsArchivePanel />
        );


        await waitFor(
          () => {
            expect(
              listUsageEpochs
            ).toHaveBeenCalledWith(
              expect.objectContaining({
                state:
                  "CLOSED",

                limit:
                  25,
              })
            );
          }
        );


        fireEvent.click(
          await screen.findByText(
            "uep_archive"
          )
        );


        await waitFor(
          () => {
            expect(
              getConfigurationAnalyticsReport
            ).toHaveBeenCalledWith({
              usageEpochId:
                "uep_archive",
            });
          }
        );


        const eventFactsNote =
          await screen.findByText(
            "exact projected event facts"
          );


        expect(
          eventFactsNote
        ).toBeInTheDocument();


        /**
         * "42" appears truthfully in both:
         *
         * - the report-level Events KPI
         * - the daily event-count row
         *
         * Anchor this assertion to the immutable Events KPI rather
         * than relying on globally unique numeric text.
         */
        expect(
          eventFactsNote
            .parentElement
        ).toHaveTextContent(
          "42"
        );

        expect(
          screen.getByText(
            /Session-fragment counters/
          )
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Scroll depth"
          )
        ).toBeInTheDocument();


        expect(
          screen.getByText(
            "75%"
          )
        ).toBeInTheDocument();


        expect(
          screen.getByText(
            "5 visitors"
          )
        ).toBeInTheDocument();


        expect(
          screen.getByText(
            "6 sessions"
          )
        ).toBeInTheDocument();

      }
    );


    test(
      "paginates within the current archive scope",
      async () => {

        listUsageEpochs
            .mockReset()
            .mockResolvedValueOnce({
            ok:
                true,

            epochs: [
                CLOSED_EPOCH,
            ],

            nextToken:
                "next-page",
            })
            .mockResolvedValueOnce({
            ok:
                true,

            epochs: [
                {
                ...CLOSED_EPOCH,

                usageEpochId:
                    "uep_second",

                report: {
                    ...CLOSED_EPOCH
                    .report,

                    reportId:
                    "car_second",
                },
                },
            ],

            nextToken:
                null,
            });

        render(
          <ConfigurationAnalyticsArchivePanel />
        );


        const button =
          await screen.findByRole(
            "button",
            {
              name:
                "Load more Usage Epochs",
            }
          );


        listUsageEpochs
          .mockResolvedValueOnce({
            ok:
              true,

            epochs: [
              CLOSED_EPOCH,
            ],

            nextToken:
              "next-page",
          })
          .mockResolvedValueOnce({
            ok:
              true,

            epochs: [
              {
                ...CLOSED_EPOCH,

                usageEpochId:
                  "uep_second",

                report: {
                  ...CLOSED_EPOCH
                    .report,

                  reportId:
                    "car_second",
                },
              },
            ],

            nextToken:
              null,
          });


        fireEvent.click(
          button
        );


        await waitFor(
          () => {
            expect(
              listUsageEpochs
            ).toHaveBeenLastCalledWith(
              expect.objectContaining({
                state:
                  "CLOSED",

                nextToken:
                  "next-page",
              })
            );
          }
        );
      }
    );


    test(
      "switches to Deployment Configuration recurrence history without combining state",
      async () => {
        render(
          <ConfigurationAnalyticsArchivePanel />
        );


        await screen.findByText(
          "uep_archive"
        );


        fireEvent.change(
          screen.getByRole(
            "textbox",
            {
              name:
                "Deployment Configuration filter",
            }
          ),
          {
            target: {
              value:
                "cfg_specific",
            },
          }
        );


        fireEvent.click(
          screen.getByRole(
            "button",
            {
              name:
                "Apply configuration",
            }
          )
        );


        await waitFor(
          () => {
            expect(
              listUsageEpochs
            ).toHaveBeenLastCalledWith(
              expect.objectContaining({
                deploymentConfigurationId:
                  "cfg_specific",

                state:
                  undefined,

                limit:
                  25,
              })
            );
          }
        );


        expect(
          screen.getByRole(
            "combobox",
            {
              name:
                "Usage Epoch lifecycle state",
            }
          )
        ).toBeDisabled();
      }
    );
  }
);