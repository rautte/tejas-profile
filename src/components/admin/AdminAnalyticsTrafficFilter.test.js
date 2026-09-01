import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";

import AdminAnalytics from "./Analytics";

import {
  queryAnalyticsAgg,
  queryAnalyticsMeta,
} from "../../utils/analytics/analyticsApi";


jest.mock(
  "../../utils/analytics/analyticsApi",
  () => ({
    createAnalyticsBoundary:
      jest.fn(),

    queryAnalyticsAgg:
      jest.fn(),

    queryAnalyticsMeta:
      jest.fn(),
  })
);


jest.mock(
  "../../utils/profileVersion",
  () => ({
    readBuildProfileVersion:
      jest.fn(
        () => ({
          id:
            "pv_build",
        })
      ),
  })
);


function trafficSummary() {
  return {
    classifierVersion:
      "traffic-classifier.v1",

    byClassification: {
      all: {
        uniqueVisitors:
          4,

        sessions:
          4,

        eventCount:
          16,

        activeMs:
          42_000,
      },

      likely_human: {
        uniqueVisitors:
          2,

        sessions:
          2,

        eventCount:
          9,

        activeMs:
          30_000,
      },

      likely_automated: {
        uniqueVisitors:
          1,

        sessions:
          1,

        eventCount:
          3,

        activeMs:
          2_000,
      },

      uncertain: {
        uniqueVisitors:
          1,

        sessions:
          1,

        eventCount:
          4,

        activeMs:
          10_000,
      },
    },
  };
}


function responseFor(
  trafficClassification
) {
  const automated =
    trafficClassification ===
      "likely_automated";


  return {
    ok:
      true,

    stage:
      "DEV",

    overview: {
      uniqueVisitors:
        automated
          ? 1
          : 2,

      newVisitors:
        0,

      returningVisitors:
        0,

      classifiedVisitors:
        0,

      unclassifiedVisitors:
        0,

      returningVisitorPct:
        0,

      sessions:
        automated
          ? 1
          : 2,

      activeMs:
        automated
          ? 2_000
          : 30_000,

      avgActiveMsPerSession:
        automated
          ? 2_000
          : 15_000,

      avgSectionsPerSession:
        1,

      eventCount:
        automated
          ? 3
          : 9,

      topSection:
        "About Me",

      fragments:
        automated
          ? 1
          : 2,
    },

    sections:
      [],

    daily:
      [],

    depthMilestones:
      [],

    ctas:
      [],

    projects:
      [],

    snippets:
      [],

    deepLinks:
      [],

    countries:
      [],

    cities:
      [],

    profileVersions:
      [],

    profileVariants:
      [],

    profileTargetingLocations:
      [],

    profileTargetingJobRoles:
      [],

    trafficClassification:
      trafficSummary(),

    sessionIntelligence: {
      coverage: {
        logicalSessions:
          automated
            ? 1
            : 2,
      },

      recentSessions:
        automated
          ? [
              {
                sessionId:
                  "s_automated",

                trafficClassifierVersion:
                  "traffic-classifier.v1",

                trafficClassification:
                  "likely_automated",

                trafficConfidence:
                  "high",

                trafficReasonCodes: [
                  "known_automation_user_agent",
                ],

                startedAt:
                  Date.now(),

                durationMs:
                  2_000,

                activeMs:
                  2_000,

                eventCount:
                  3,

                journeyEventCount:
                  0,

                fragmentCount:
                  1,

                sections: [
                  "About Me",
                ],

                profileVersionIds:
                  [],

                profileVariantIds:
                  [],

                profileTargetingLocations:
                  [],

                profileTargetingJobRoles:
                  [],

                journey:
                  [],
              },
            ]
          : [],

      topTransitions:
        [],

      topSectionPaths:
        [],
    },
  };
}


beforeEach(
  () => {
    jest.clearAllMocks();


    queryAnalyticsMeta
      .mockResolvedValue({
        ok:
          true,

        releases:
          [],

        boundaries:
          [],
      });


    queryAnalyticsAgg
      .mockImplementation(
        async (
          args = {}
        ) =>
          responseFor(
            args
              .trafficClassification ||
              "all"
          )
      );
  }
);


describe(
  "AdminAnalytics Traffic filter",
  () => {
    test(
      "defaults to Likely human while keeping an all-traffic catalogue query",
      async () => {
        render(
          <AdminAnalytics />
        );


        const trafficSelect =
          await screen.findByRole(
            "combobox",
            {
              name:
                "Traffic",
            }
          );


        expect(
          trafficSelect.value
        ).toBe(
          "likely_human"
        );


        await waitFor(
          () => {
            expect(
              queryAnalyticsAgg
                .mock
                .calls
                .some(
                  ([args]) =>
                    args
                      ?.trafficClassification ===
                    "likely_human"
                )
            ).toBe(true);


            expect(
              queryAnalyticsAgg
                .mock
                .calls
                .some(
                  ([args]) =>
                    args
                      ?.trafficClassification ===
                    "all"
                )
            ).toBe(true);
          }
        );


        expect(
          screen.getByTestId(
            "traffic-composition"
          )
        ).toBeInTheDocument();


        expect(
          screen.getByText(
            "traffic-classifier.v1"
          )
        ).toBeInTheDocument();
      }
    );


    test(
      "switching Traffic requests the selected class and exposes session classification",
      async () => {
        render(
          <AdminAnalytics />
        );


        const trafficSelect =
          await screen.findByRole(
            "combobox",
            {
              name:
                "Traffic",
            }
          );


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
              queryAnalyticsAgg
                .mock
                .calls
                .some(
                  ([args]) =>
                    args
                      ?.trafficClassification ===
                    "likely_automated"
                )
            ).toBe(true);
          }
        );


        expect(
          await screen.findByText(
            "Likely automated · High"
          )
        ).toBeInTheDocument();


        expect(
          screen.getByText(
            "s_automated"
          )
        ).toBeInTheDocument();
      }
    );
  }
);
