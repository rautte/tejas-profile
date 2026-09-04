import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";

import AdminUsage from "./Usage";

import {
  getUsageHistory,
  getUsageSummary,
  refreshUsageNow,
  setUsageRefreshConfig,
} from "../../utils/usage/usageApi";


jest.mock(
  "../../utils/usage/usageApi",
  () => ({
    getUsageHistory:
      jest.fn(),

    getUsageSummary:
      jest.fn(),

    refreshUsageNow:
      jest.fn(),

    setUsageRefreshConfig:
      jest.fn(),
  })
);


const SUMMARY = {
  config: {
    intervalDays:
      1,

    lastRunAt:
      "2026-09-04T06:00:00.000Z",
  },

  snapshots: {
    day: {
      periodKey:
        "2026-09-04",

      collectedAt:
        "2026-09-04T06:00:00.000Z",

      totalCostUsd:
        1.5,

      costByService: {
        "Amazon S3":
          1.5,
      },

      resourceUsage: {
        s3: [
          {
            name:
              "tejas-profile-dev-snapshots-978416150779",

            metrics: {
              sizeBytes:
                1048576,

              objectCount:
                42,
            },
          },
        ],

        dynamodb: [
          {
            name:
              "tejas-profile-dev-usage-epochs-978416150779",

            metrics: {
              consumedReadCapacityUnits:
                12,

              consumedWriteCapacityUnits:
                3,
            },
          },
        ],

        lambda: [
          {
            name:
              "SnapshotsApiHandler",

            metrics: {
              invocations:
                500,

              errors:
                2,
            },
          },
        ],
      },
    },

    week: {
      periodKey:
        "2026-W36",

      collectedAt:
        "2026-09-04T06:00:00.000Z",

      totalCostUsd:
        9,

      costByService: {
        "Amazon S3":
          9,
      },

      resourceUsage:
        null,
    },

    month: {
      periodKey:
        "2026-09",

      collectedAt:
        "2026-09-04T06:00:00.000Z",

      totalCostUsd:
        30,

      costByService: {
        "Amazon S3":
          20,

        "AWS Lambda":
          10,
      },

      resourceUsage:
        null,
    },
  },
};


beforeEach(
  () => {
    jest.clearAllMocks();

    getUsageSummary.mockResolvedValue(
      SUMMARY
    );

    getUsageHistory.mockResolvedValue(
      [
        {
          periodKey:
            "2026-09-04",

          totalCostUsd:
            2.25,

          collectedAt:
            "2026-09-04T06:00:00.000Z",
        },
      ]
    );

    setUsageRefreshConfig.mockResolvedValue(
      {
        intervalDays:
          3,
      }
    );

    refreshUsageNow.mockResolvedValue(
      true
    );
  }
);


describe(
  "AdminUsage",
  () => {
    test(
      "loads the summary and renders today/week/month cost KPIs",
      async () => {
        render(
          <AdminUsage />
        );

        expect(
          await screen.findByText(
            "$1.50"
          )
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "$9.00"
          )
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "$30.00"
          )
        ).toBeInTheDocument();
      }
    );


    test(
      "renders the cost-by-service breakdown for the month",
      async () => {
        render(
          <AdminUsage />
        );

        await screen.findByText(
          "$30.00"
        );

        expect(
          screen.getByText(
            "Amazon S3"
          )
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "AWS Lambda"
          )
        ).toBeInTheDocument();
      }
    );


    test(
      "renders resource usage tables from the day snapshot",
      async () => {
        render(
          <AdminUsage />
        );

        expect(
          await screen.findByText(
            /tejas-profile-dev-snapshots-978416150779/
          )
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            /tejas-profile-dev-usage-epochs-978416150779/
          )
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "SnapshotsApiHandler"
          )
        ).toBeInTheDocument();
      }
    );


    test(
      "saving a new refresh schedule calls setUsageRefreshConfig with the selected interval",
      async () => {
        render(
          <AdminUsage />
        );

        await screen.findByText(
          "$1.50"
        );

        fireEvent.change(
          screen.getByLabelText(
            "Usage refresh schedule"
          ),
          {
            target: {
              value:
                "3",
            },
          }
        );

        fireEvent.click(
          screen.getByText(
            "Save schedule"
          )
        );

        await waitFor(
          () => {
            expect(
              setUsageRefreshConfig
            ).toHaveBeenCalledWith(
              {
                intervalDays:
                  3,
              }
            );
          }
        );
      }
    );


    test(
      "Refresh now triggers the aggregator and shows a confirmation message",
      async () => {
        render(
          <AdminUsage />
        );

        await screen.findByText(
          "$1.50"
        );

        fireEvent.click(
          screen.getByText(
            "Refresh now"
          )
        );

        await waitFor(
          () => {
            expect(
              refreshUsageNow
            ).toHaveBeenCalledTimes(
              1
            );
          }
        );

        expect(
          await screen.findByText(
            /Refresh triggered/
          )
        ).toBeInTheDocument();
      }
    );


    test(
      "switching the history tab re-fetches history for the new period type",
      async () => {
        render(
          <AdminUsage />
        );

        await waitFor(
          () => {
            expect(
              getUsageHistory
            ).toHaveBeenCalledWith(
              {
                periodType:
                  "day",

                limit:
                  30,
              }
            );
          }
        );

        fireEvent.click(
          screen.getByText(
            "Week"
          )
        );

        await waitFor(
          () => {
            expect(
              getUsageHistory
            ).toHaveBeenCalledWith(
              {
                periodType:
                  "week",

                limit:
                  30,
              }
            );
          }
        );
      }
    );
  }
);
