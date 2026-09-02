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
  "defaults to ACTIVE Profile metadata, orders immutable variants chronologically, and keeps targeting combinations valid",
  async () => {
    const loadProfileVariants =
      jest
        .fn()
        .mockResolvedValueOnce({
          ok:
            true,

          variants: [
            {
              profileVariantId:
                "prv_B",

              createdAt:
                "2026-08-01T10:00:00.000Z",

              targeting: {
                location:
                  "Pune, India",

                jobRole:
                  "AI Engineer",
              },
            },
          ],

          nextToken:
            "page-2",
        })
        .mockResolvedValueOnce({
          ok:
            true,

          variants: [
            {
              profileVariantId:
                "prv_C",

              createdAt:
                "2026-09-01T09:00:00.000Z",

              targeting: {
                location:
                  "Austin, TX",

                jobRole:
                  "Platform Engineer",
              },
            },
          ],

          nextToken:
            null,
        });


    render(
      <AdminAnalytics
        activeProfileVariantId="prv_A"
        activeProfileTargeting={{
          location:
            "Bangalore, India",

          jobRole:
            "Backend / Infrastructure Engineer",
        }}
        loadProfileVariants={
          loadProfileVariants
        }
      />
    );


    const variantSelect =
      screen.getByRole(
        "combobox",
        {
          name:
            "Profile Variant",
        }
      );

    const locationSelect =
      screen.getByRole(
        "combobox",
        {
          name:
            "Target location",
        }
      );

    const jobRoleSelect =
      screen.getByRole(
        "combobox",
        {
          name:
            "Target job role",
        }
      );


    await waitFor(
      () => {
        expect(
          variantSelect.value
        ).toBe(
          "prv_A"
        );

        expect(
          locationSelect.value
        ).toBe(
          "Bangalore, India"
        );

        expect(
          jobRoleSelect.value
        ).toBe(
          "Backend / Infrastructure Engineer"
        );
      }
    );


    expect(
      locationSelect
    ).toBeDisabled();

    expect(
      jobRoleSelect
    ).toBeDisabled();


    await waitFor(
      () => {
        expect(
          loadProfileVariants
        ).toHaveBeenCalledTimes(
          2
        );
      }
    );


    expect(
      loadProfileVariants
    ).toHaveBeenNthCalledWith(
      1,
      {
        limit:
          50,
      }
    );

    expect(
      loadProfileVariants
    ).toHaveBeenNthCalledWith(
      2,
      {
        limit:
          50,

        nextToken:
          "page-2",
      }
    );


    await waitFor(
      () => {
        expect(
          Array.from(
            variantSelect.options
          ).map(
            (
              option
            ) =>
              option.value
          )
        ).toEqual([
          "all",
          "prv_A",
          "prv_C",
          "prv_B",
        ]);
      }
    );


    await waitFor(
      () => {
        expect(
          hasAggregateCall({
            profileVariantId:
              "prv_A",

            profileTargetingLocation:
              "Bangalore, India",

            profileTargetingJobRole:
              "Backend / Infrastructure Engineer",
          })
        ).toBe(
          true
        );
      }
    );


    fireEvent.change(
      variantSelect,
      {
        target: {
          value:
            "prv_C",
        },
      }
    );


    await waitFor(
      () => {
        expect(
          variantSelect.value
        ).toBe(
          "prv_C"
        );

        expect(
          locationSelect.value
        ).toBe(
          "Austin, TX"
        );

        expect(
          jobRoleSelect.value
        ).toBe(
          "Platform Engineer"
        );
      }
    );


    await waitFor(
      () => {
        expect(
          hasAggregateCall({
            profileVariantId:
              "prv_C",

            profileTargetingLocation:
              "Austin, TX",

            profileTargetingJobRole:
              "Platform Engineer",
          })
        ).toBe(
          true
        );
      }
    );


    fireEvent.change(
      variantSelect,
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
          variantSelect.value
        ).toBe(
          "all"
        );

        expect(
          locationSelect.value
        ).toBe(
          "all"
        );

        expect(
          jobRoleSelect.value
        ).toBe(
          "all"
        );

        expect(
          locationSelect
        ).not.toBeDisabled();

        expect(
          jobRoleSelect
        ).not.toBeDisabled();
      }
    );


    fireEvent.change(
      locationSelect,
      {
        target: {
          value:
            "Pune, India",
        },
      }
    );


    await waitFor(
      () => {
        expect(
          locationSelect.value
        ).toBe(
          "Pune, India"
        );

        expect(
          Array.from(
            jobRoleSelect.options
          ).map(
            (
              option
            ) =>
              option.value
          )
        ).toEqual([
          "all",
          "AI Engineer",
        ]);
      }
    );


    fireEvent.change(
      jobRoleSelect,
      {
        target: {
          value:
            "AI Engineer",
        },
      }
    );


    await waitFor(
      () => {
        expect(
          locationSelect.value
        ).toBe(
          "Pune, India"
        );

        expect(
          jobRoleSelect.value
        ).toBe(
          "AI Engineer"
        );
      }
    );


    await waitFor(
      () => {
        expect(
          hasAggregateCall({
            profileVariantId:
              "all",

            profileTargetingLocation:
              "Pune, India",

            profileTargetingJobRole:
              "AI Engineer",
          })
        ).toBe(
          true
        );
      }
    );
  }
);
