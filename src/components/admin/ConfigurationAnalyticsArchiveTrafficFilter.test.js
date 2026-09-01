import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";

import ConfigurationAnalyticsArchivePanel from "./ConfigurationAnalyticsArchivePanel";

import {
  getConfigurationAnalyticsReport,
  listUsageEpochs,
} from "../../utils/analytics/analyticsApi";


jest.mock(
  "../../utils/analytics/analyticsApi",
  () => ({
    getConfigurationAnalyticsReport:
      jest.fn(),

    listUsageEpochs:
      jest.fn(),
  })
);


const CLOSED_EPOCH = {
  usageEpochId:
    "uep_archive_v2",

  stage:
    "prod",

  deploymentConfigurationId:
    "cfg_archive_v2",

  platformReleaseId:
    "plr_archive_v2",

  profileVariantId:
    "prv_archive_v2",

  state:
    "CLOSED",

  startedAt:
    "2026-08-31T00:00:00.000Z",

  endedAt:
    "2026-09-01T00:00:00.000Z",

  openedBy: {
    kind:
      "platform_deployment",

    occurrenceId:
      "pdep_archive_v2",
  },

  closedBy: {
    kind:
      "profile_activation",

    occurrenceId:
      "act_archive_v2",
  },

  report: {
    reportId:
      "car_archive_v2",

    reportSha256:
      "sha_archive_v2",

    finalizedAt:
      "2026-09-01T00:10:00.000Z",
  },
};


function analytics({
  visitors,
  sessions,
  events,
  activeMs,
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


const REPORT_RESPONSE = {
  ok:
    true,

  usageEpoch:
    CLOSED_EPOCH,

  reportSha256:
    "sha_archive_v2",

  report: {
    schemaId:
      "tejas-profile.configuration-analytics-report.v2",

    reportId:
      "car_archive_v2",

    usageEpochId:
      "uep_archive_v2",

    stage:
      "prod",

    deploymentConfigurationId:
      "cfg_archive_v2",

    platformReleaseId:
      "plr_archive_v2",

    profileVariantId:
      "prv_archive_v2",

    interval: {
      startedAt:
        CLOSED_EPOCH
          .startedAt,

      endedAt:
        CLOSED_EPOCH
          .endedAt,
    },

    traffic: {
      classifierVersion:
        "traffic-classifier.v1",

      summary: {
        all: {
          uniqueVisitors:
            4,

          sessions:
            5,

          eventCount:
            20,

          activeMs:
            40000,
        },

        likely_human: {
          uniqueVisitors:
            2,

          sessions:
            2,

          eventCount:
            10,

          activeMs:
            30000,
        },

        likely_automated: {
          uniqueVisitors:
            1,

          sessions:
            1,

          eventCount:
            4,

          activeMs:
            1000,
        },

        uncertain: {
          uniqueVisitors:
            2,

          sessions:
            2,

          eventCount:
            6,

          activeMs:
            9000,
        },
      },
    },

    analyticsByTraffic: {
      all:
        analytics({
          visitors:
            4,

          sessions:
            5,

          events:
            20,

          activeMs:
            40000,
        }),

      likely_human:
        analytics({
          visitors:
            2,

          sessions:
            2,

          events:
            10,

          activeMs:
            30000,
        }),

      likely_automated:
        analytics({
          visitors:
            1,

          sessions:
            1,

          events:
            4,

          activeMs:
            1000,
        }),

      uncertain:
        analytics({
          visitors:
            2,

          sessions:
            2,

          events:
            6,

          activeMs:
            9000,
        }),
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
          null,
      });


    getConfigurationAnalyticsReport
      .mockResolvedValue(
        REPORT_RESPONSE
      );
  }
);


test(
  "V2 archive defaults to Likely human and switches the complete immutable slice locally",
  async () => {
    render(
      <ConfigurationAnalyticsArchivePanel />
    );


    fireEvent.click(
      await screen.findByText(
        "uep_archive_v2"
      )
    );


    const trafficSelect =
      await screen.findByRole(
        "combobox",
        {
          name:
            "Archived traffic classification",
        }
      );


    expect(
      trafficSelect.value
    ).toBe(
      "likely_human"
    );


    const eventFacts =
      await screen.findByText(
        "exact projected event facts"
      );


    expect(
      eventFacts
        .parentElement
    ).toHaveTextContent(
      "10"
    );


    expect(
      screen.getByTestId(
        "archive-traffic-composition"
      )
    ).toBeInTheDocument();


    expect(
      screen.getByText(
        "traffic-classifier.v1"
      )
    ).toBeInTheDocument();


    fireEvent.change(
      trafficSelect,
      {
        target: {
          value:
            "likely_automated",
        },
      }
    );


    await waitFor(
      () => {
        expect(
          trafficSelect.value
        ).toBe(
          "likely_automated"
        );


        expect(
          eventFacts
            .parentElement
        ).toHaveTextContent(
          "4"
        );
      }
    );


    expect(
      getConfigurationAnalyticsReport
    ).toHaveBeenCalledTimes(
      1
    );
  }
);
