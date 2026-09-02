// src/components/admin/AdminAnalyticsOutreachScore.test.js

import {
  render,
  screen,
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


const AGG_RESPONSE = {
  ok:
    true,

  stage:
    "DEV",

  overview: {
    uniqueVisitors:
      40,

    sessions:
      25,
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
      76,

    confidence:
      "medium",

    components: {
      reach:
        68,

      engagement:
        84,

      depth:
        72,

      intent:
        79,

      consistency:
        75,
    },
  },
};


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
      .mockResolvedValue(
        AGG_RESPONSE
      );
  }
);


test(
  "renders the Outreach Score, confidence, and component breakdown from the aggregate response",
  async () => {
    render(
      <AdminAnalytics />
    );


    expect(
      await screen.findByText(
        "76"
      )
    ).toBeInTheDocument();


    expect(
      screen.getByText(
        "Confidence: Medium"
      )
    ).toBeInTheDocument();


    expect(
      screen.getByText(
        "Reach"
      )
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        "Engagement"
      )
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        "Content Depth"
      )
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        "Intent"
      )
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        "Consistency"
      )
    ).toBeInTheDocument();


    expect(
      screen.getByText(
        "68"
      )
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        "84"
      )
    ).toBeInTheDocument();
  }
);


test(
  "renders a fallback message when the aggregate response has no Outreach Score",
  async () => {
    queryAnalyticsAgg
      .mockResolvedValue({
        ...AGG_RESPONSE,

        outreachScore:
          undefined,
      });


    render(
      <AdminAnalytics />
    );


    expect(
      await screen.findByText(
        "No Outreach Score for this filter combination yet."
      )
    ).toBeInTheDocument();
  }
);
