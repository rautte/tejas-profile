// src/components/admin/AdminAnalyticsCompare.test.js

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

import {
  readBuildProfileVersion,
} from "../../utils/profileVersion";


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
      jest.fn(),
  })
);


function aggResponse(
  overrides = {}
) {
  return {
    ok:
      true,

    stage:
      "DEV",

    overview: {
      uniqueVisitors:
        10,

      sessions:
        8,

      avgActiveMsPerSession:
        20_000,

      avgSectionsPerSession:
        3,

      eventCount:
        40,
    },

    sections: [
      {
        section:
          "Resume",
        visits: 4,
      },
    ],

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

    sessionIntelligence: {
      coverage:
        {},

      recentSessions:
        [],

      topTransitions:
        [],

      topSectionPaths:
        [],
    },

    outreachScore: {
      algorithm:
        "outreach-score.v1",

      score:
        70,

      confidence:
        "medium",

      components: {
        reach:
          60,

        engagement:
          65,

        depth:
          70,

        intent:
          75,

        consistency:
          80,
      },
    },

    ...overrides,
  };
}


beforeEach(
  () => {
    jest.clearAllMocks();


    readBuildProfileVersion
      .mockReturnValue({
        id:
          "pv_build",
      });


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
      .mockResolvedValue(
        aggResponse()
      );
  }
);


async function openCompare() {
  render(
    <AdminAnalytics />
  );


  fireEvent.click(
    screen.getByRole(
      "button",
      {
        name:
          "Compare",
      }
    )
  );


  await screen.findByText(
    "Compare dashboards"
  );
}


test(
  "opening Compare shows Dashboard A's current state and an independent Dashboard B selector",
  async () => {
    await openCompare();


    await waitFor(
      () => {
        expect(
          screen.getByText(
            (
              _,
              node
            ) =>
              node
                ?.textContent ===
              "Profile Version: pv_build"
          )
        ).toBeInTheDocument();
      }
    );


    expect(
      screen.getByRole(
        "combobox",
        {
          name:
            "Compare B Profile Version",
        }
      )
    ).toBeInTheDocument();


    expect(
      screen.getByRole(
        "button",
        {
          name:
            "Run comparison",
        }
      )
    ).not.toBeDisabled();
  }
);


test(
  "running a comparison with a differing Dashboard B renders the A/B/Delta table including the Outreach Score breakdown",
  async () => {
    queryAnalyticsAgg
      .mockImplementation(
        async (
          request = {}
        ) => {
          if (
            request.profileVersionId ===
            "all"
          ) {
            return aggResponse(
              {
                overview: {
                  uniqueVisitors:
                    20,

                  sessions:
                    16,

                  avgActiveMsPerSession:
                    30_000,

                  avgSectionsPerSession:
                    4,

                  eventCount:
                    90,
                },

                outreachScore: {
                  algorithm:
                    "outreach-score.v1",

                  score:
                    84,

                  confidence:
                    "high",

                  components: {
                    reach:
                      80,

                    engagement:
                      85,

                    depth:
                      82,

                    intent:
                      88,

                    consistency:
                      90,
                  },
                },
              }
            );
          }

          return aggResponse();
        }
      );


    await openCompare();


    fireEvent.click(
      screen.getByRole(
        "button",
        {
          name:
            "Run comparison",
        }
      )
    );


    await waitFor(
      () => {
        expect(
          hasAggCall(
            {
              profileVersionId:
                "all",
            }
          )
        ).toBe(
          true
        );
      }
    );


    expect(
      await screen.findAllByText(
        "Outreach Score"
      )
    ).not.toHaveLength(
      0
    );


    expect(
      screen.getAllByText(
        "84"
      ).length
    ).toBeGreaterThan(
      0
    );


    expect(
      screen.getAllByText(
        "70"
      ).length
    ).toBeGreaterThan(
      0
    );


    expect(
      screen.getByText(
        "— Consistency"
      )
    ).toBeInTheDocument();
  }
);


test(
  "exact self-comparison is blocked: matching Dashboard B to Dashboard A disables Run comparison with an explanatory message",
  async () => {
    await openCompare();


    fireEvent.change(
      screen.getByRole(
        "combobox",
        {
          name:
            "Compare B Profile Version",
        }
      ),
      {
        target: {
          value:
            "pv_build",
        },
      }
    );


    await waitFor(
      () => {
        expect(
          screen.getByRole(
            "button",
            {
              name:
                "Run comparison",
            }
          )
        ).toBeDisabled();
      }
    );


    expect(
      screen.getByText(
        "Dashboard B exactly matches Dashboard A. Change at least one field to compare."
      )
    ).toBeInTheDocument();


    // Changing one more field (Traffic) makes it a legitimate,
    // no-longer-identical alternate state again.
    fireEvent.change(
      screen.getByRole(
        "combobox",
        {
          name:
            "Compare B Traffic",
        }
      ),
      {
        target: {
          value:
            "all",
        },
      }
    );


    await waitFor(
      () => {
        expect(
          screen.getByRole(
            "button",
            {
              name:
                "Run comparison",
            }
          )
        ).not.toBeDisabled();
      }
    );
  }
);


function hasAggCall(
  expected
) {
  return queryAnalyticsAgg
    .mock.calls
    .some(
      (
        [
          request,
        ]
      ) =>
        Object.entries(
          expected
        ).every(
          (
            [
              key,
              value,
            ]
          ) =>
            request
              ?.[key] ===
            value
        )
    );
}
