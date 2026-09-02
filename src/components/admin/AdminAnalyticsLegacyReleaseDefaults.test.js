// src/components/admin/AdminAnalyticsLegacyReleaseDefaults.test.js

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


const AGG_RESPONSE = {
  ok:
    true,

  stage:
    "DEV",

  overview:
    {},

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
};


// Deliberately NOT pre-sorted, and mixing boundaries from a
// different, older Profile Version — matching the roadmap's
// "current/newest, previous, previous, older" ordering example.
const DEPLOY_AUG_20 = {
  boundaryId:
    "b_deploy",

  type:
    "deploy",

  effectiveAt:
    Date.parse(
      "2026-08-20T10:00:00.000Z"
    ),

  profileVersionId:
    "pv_123",
};

const RESET_AUG_28 = {
  boundaryId:
    "b_reset_28",

  type:
    "reset",

  effectiveAt:
    Date.parse(
      "2026-08-28T13:40:00.000Z"
    ),

  profileVersionId:
    "pv_123",
};

const RESET_AUG_31 = {
  boundaryId:
    "b_reset_31",

  type:
    "reset",

  effectiveAt:
    Date.parse(
      "2026-08-31T19:05:00.000Z"
    ),

  profileVersionId:
    "pv_123",
};

const OLD_RELEASE_DEPLOY = {
  boundaryId:
    "b_old_deploy",

  type:
    "deploy",

  effectiveAt:
    Date.parse(
      "2026-06-01T00:00:00.000Z"
    ),

  profileVersionId:
    "pv_old",
};


function hasAggregateCall(
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


beforeEach(
  () => {
    jest.clearAllMocks();


    readBuildProfileVersion
      .mockReturnValue({
        id:
          "pv_123",
      });


    queryAnalyticsMeta
      .mockResolvedValue({
        ok:
          true,

        releases: [
          {
            profileVersionId:
              "pv_123",

            releasedAt:
              Date.parse(
                "2026-08-20T10:00:00.000Z"
              ),
          },

          {
            profileVersionId:
              "pv_old",

            releasedAt:
              Date.parse(
                "2026-06-01T00:00:00.000Z"
              ),
          },
        ],

        // Deliberately out of chronological order.
        boundaries: [
          RESET_AUG_28,
          OLD_RELEASE_DEPLOY,
          RESET_AUG_31,
          DEPLOY_AUG_20,
        ],
      });


    queryAnalyticsAgg
      .mockResolvedValue(
        AGG_RESPONSE
      );
  }
);


test(
  "Legacy Release defaults to the current profileVersion and From defaults to its newest Deploy/Reset boundary by full timestamp, not API order or Reset-only",
  async () => {
    render(
      <AdminAnalytics />
    );


    const releaseSelect =
      screen.getByRole(
        "combobox",
        {
          name:
            "Profile Version",
        }
      );

    const boundarySelect =
      screen.getByRole(
        "combobox",
        {
          name:
            "Boundary / Date-Time",
        }
      );


    await waitFor(
      () => {
        expect(
          releaseSelect.value
        ).toBe(
          "pv_123"
        );

        expect(
          boundarySelect.value
        ).toBe(
          "b_reset_31"
        );
      }
    );


    await waitFor(
      () => {
        expect(
          hasAggregateCall({
            profileVersionId:
              "pv_123",

            boundaryId:
              "b_reset_31",
          })
        ).toBe(
          true
        );
      }
    );


    /**
     * Ordering rule: current/newest first, full timestamp
     * descending — scoped to the selected Profile Version, so
     * the older release's boundary is excluded entirely.
     */
    expect(
      Array.from(
        boundarySelect.options
      ).map(
        (
          option
        ) =>
          option.value
      )
    ).toEqual([
      "all",
      "b_reset_31",
      "b_reset_28",
      "b_deploy",
    ]);


    /**
     * Ordering rule on Profile Version itself: current build
     * leads even though it is not the most recently released by
     * timestamp comparison logic elsewhere.
     */
    expect(
      Array.from(
        releaseSelect.options
      ).map(
        (
          option
        ) =>
          option.value
      )
    ).toEqual([
      "all",
      "pv_123",
      "pv_old",
    ]);
  }
);


test(
  "changing Profile Version atomically recomputes Boundary / Date-Time to that version's own newest boundary",
  async () => {
    render(
      <AdminAnalytics />
    );


    const releaseSelect =
      screen.getByRole(
        "combobox",
        {
          name:
            "Profile Version",
        }
      );

    const boundarySelect =
      screen.getByRole(
        "combobox",
        {
          name:
            "Boundary / Date-Time",
        }
      );


    await waitFor(
      () => {
        expect(
          boundarySelect.value
        ).toBe(
          "b_reset_31"
        );
      }
    );


    fireEvent.change(
      releaseSelect,
      {
        target: {
          value:
            "pv_old",
        },
      }
    );


    await waitFor(
      () => {
        expect(
          releaseSelect.value
        ).toBe(
          "pv_old"
        );

        expect(
          boundarySelect.value
        ).toBe(
          "b_old_deploy"
        );
      }
    );


    expect(
      Array.from(
        boundarySelect.options
      ).map(
        (
          option
        ) =>
          option.value
      )
    ).toEqual([
      "all",
      "b_old_deploy",
    ]);


    await waitFor(
      () => {
        expect(
          hasAggregateCall({
            profileVersionId:
              "pv_old",

            boundaryId:
              "b_old_deploy",
          })
        ).toBe(
          true
        );
      }
    );


    /**
     * The aggregate query must never observe a new Profile
     * Version paired with a Boundary from a different one.
     */
    expect(
      hasAggregateCall({
        profileVersionId:
          "pv_old",

        boundaryId:
          "b_reset_31",
      })
    ).toBe(
      false
    );


    fireEvent.change(
      releaseSelect,
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
          releaseSelect.value
        ).toBe(
          "all"
        );

        expect(
          boundarySelect.value
        ).toBe(
          "all"
        );
      }
    );


    expect(
      Array.from(
        boundarySelect.options
      ).map(
        (
          option
        ) =>
          option.value
      )
    ).toEqual([
      "all",
      "b_reset_31",
      "b_reset_28",
      "b_deploy",
      "b_old_deploy",
    ]);
  }
);
