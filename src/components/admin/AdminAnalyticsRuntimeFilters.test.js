import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";

import AdminAnalytics from "./Analytics";

import {
  createAnalyticsBoundary,
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


const PROFILE_VARIANT_A = {
  profileVariantId:
    "prv_A",

  visitors:
    1,

  sessions:
    1,

  fragments:
    1,
};


const PROFILE_VARIANT_B = {
  profileVariantId:
    "prv_B",

  visitors:
    1,

  sessions:
    1,

  fragments:
    1,
};


const CATALOG_DATA = {
  ok:
    true,

  stage:
    "DEV",

  overview: {},

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

  profileVariants: [
    PROFILE_VARIANT_A,
    PROFILE_VARIANT_B,
  ],

  profileTargetingLocations: [
    {
      profileTargetingLocation:
        "Austin, TX",

      visitors:
        1,

      sessions:
        1,

      fragments:
        1,
    },
    {
      profileTargetingLocation:
        "Pune, India",

      visitors:
        1,

      sessions:
        1,

      fragments:
        1,
    },
  ],

  profileTargetingJobRoles: [
    {
      profileTargetingJobRole:
        "Backend Software Engineer",

      visitors:
        1,

      sessions:
        1,

      fragments:
        1,
    },
    {
      profileTargetingJobRole:
        "AI Software Engineer",

      visitors:
        1,

      sessions:
        1,

      fragments:
        1,
    },
  ],

  sessionIntelligence: {
    coverage: {},

    recentSessions:
      [],

    topTransitions:
      [],

    topSectionPaths:
      [],
  },
};


const FILTERED_A_DATA = {
  ...CATALOG_DATA,

  profileVariants: [
    PROFILE_VARIANT_A,
  ],

  profileTargetingLocations: [
    {
      profileTargetingLocation:
        "Austin, TX",

      visitors:
        1,

      sessions:
        1,

      fragments:
        1,
    },
  ],

  profileTargetingJobRoles: [
    {
      profileTargetingJobRole:
        "Backend Software Engineer",

      visitors:
        1,

      sessions:
        1,

      fragments:
        1,
    },
  ],
};


function hasQueryCall(
  expected
) {
  return (
    queryAnalyticsAgg
      .mock
      .calls
      .some(
        ([args]) =>
          Object.entries(
            expected
          ).every(
            ([
              key,
              value,
            ]) =>
              args?.[key] ===
              value
          )
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

        releases: [
          {
            profileVersionId:
              "pv_release",

            releasedAt:
              Date.now() -
              10_000,
          },
        ],

        boundaries:
          [],
      });


    queryAnalyticsAgg
      .mockImplementation(
        async (
          args = {}
        ) => {
          if (
            args
              .profileVariantId ===
            "prv_A"
          ) {
            return (
              FILTERED_A_DATA
            );
          }

          return CATALOG_DATA;
        }
      );


    createAnalyticsBoundary
      .mockResolvedValue({
        ok:
          true,

        boundary: {
          boundaryId:
            "reset-test",

          type:
            "reset",

          effectiveAt:
            Date.now(),
        },
      });
  }
);


describe(
  "AdminAnalytics runtime Profile filters",
  () => {
    test(
      "keeps Profile Variant and targeting independent from the legacy release and applies them to comparison queries",
      async () => {
        render(
          <AdminAnalytics />
        );


        await waitFor(
          () => {
            expect(
              queryAnalyticsAgg
            ).toHaveBeenCalled();
          }
        );


        expect(
          queryAnalyticsAgg
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            profileVersionId:
              "all",

            profileVariantId:
              "all",

            profileTargetingLocation:
              "all",

            profileTargetingJobRole:
              "all",

            trafficClassification:
              "likely_human",

            boundaryId:
              "all",
          })
        );


        await screen.findByRole(
          "option",
          {
            name:
              "prv_A",
          }
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

        const releaseSelect =
          screen.getByRole(
            "combobox",
            {
              name:
                "Legacy release",
            }
          );


        fireEvent.change(
          variantSelect,
          {
            target: {
              value:
                "prv_A",
            },
          }
        );


        await waitFor(
          () => {
            expect(
              hasQueryCall({
                profileVariantId:
                  "prv_A",

                profileTargetingLocation:
                  "all",

                profileTargetingJobRole:
                  "all",
              })
            ).toBe(true);
          }
        );


        /**
         * The filtered response contains only prv_A,
         * but the separately fetched unfiltered
         * catalogue must keep prv_B switchable.
         */
        await waitFor(
          () => {
            expect(
              screen.getByRole(
                "option",
                {
                  name:
                    "prv_B",
                }
              )
            ).toBeInTheDocument();
          }
        );


        expect(
          queryAnalyticsAgg
            .mock
            .calls
            .some(
              ([args]) =>
                args
                  ?.profileVariantId ===
                  undefined &&
                Boolean(
                  args?.from
                ) &&
                Boolean(
                  args?.to
                )
            )
        ).toBe(true);


        await waitFor(
          () => {
            expect(
              locationSelect
            ).not.toBeDisabled();
          }
        );


        fireEvent.change(
          locationSelect,
          {
            target: {
              value:
                "Austin, TX",
            },
          }
        );


        await waitFor(
          () => {
            expect(
              hasQueryCall({
                profileVariantId:
                  "prv_A",

                profileTargetingLocation:
                  "Austin, TX",
              })
            ).toBe(true);
          }
        );


        await waitFor(
          () => {
            expect(
              jobRoleSelect
            ).not.toBeDisabled();
          }
        );


        fireEvent.change(
          jobRoleSelect,
          {
            target: {
              value:
                "Backend Software Engineer",
            },
          }
        );


        await waitFor(
          () => {
            expect(
              hasQueryCall({
                profileVariantId:
                  "prv_A",

                profileTargetingLocation:
                  "Austin, TX",

                profileTargetingJobRole:
                  "Backend Software Engineer",
              })
            ).toBe(true);
          }
        );


        await waitFor(
          () => {
            expect(
              releaseSelect
            ).not.toBeDisabled();
          }
        );


        fireEvent.change(
          releaseSelect,
          {
            target: {
              value:
                "pv_release",
            },
          }
        );


        await waitFor(
          () => {
            expect(
              hasQueryCall({
                profileVersionId:
                  "pv_release",

                profileVariantId:
                  "prv_A",

                profileTargetingLocation:
                  "Austin, TX",

                profileTargetingJobRole:
                  "Backend Software Engineer",
              })
            ).toBe(true);
          }
        );


        const callsBeforeComparison =
          queryAnalyticsAgg
            .mock
            .calls
            .length;


        fireEvent.click(
          screen.getByRole(
            "button",
            {
              name:
                "Compare previous",
            }
          )
        );


        await waitFor(
          () => {
            expect(
              queryAnalyticsAgg
                .mock
                .calls
                .length
            ).toBeGreaterThan(
              callsBeforeComparison
            );
          }
        );


        await waitFor(
          () => {
            const comparisonCalls =
              queryAnalyticsAgg
                .mock
                .calls
                .slice(
                  callsBeforeComparison
                )
                .filter(
                  ([args]) =>
                    args
                      ?.profileVersionId ===
                      "pv_release" &&
                    args
                      ?.profileVariantId ===
                      "prv_A" &&
                    args
                      ?.profileTargetingLocation ===
                      "Austin, TX" &&
                    args
                      ?.profileTargetingJobRole ===
                      "Backend Software Engineer" &&
                    args
                      ?.trafficClassification ===
                      "likely_human"
                );

            expect(
              comparisonCalls.length
            ).toBeGreaterThanOrEqual(
              2
            );

            const ranges =
              new Set(
                comparisonCalls.map(
                  ([args]) =>
                    `${args.from}:${args.to}`
                )
              );

            expect(
              ranges.size
            ).toBeGreaterThanOrEqual(
              2
            );
          }
        );
      }
    );


    test(
      "clears only runtime Profile filters and preserves the selected legacy release",
      async () => {
        render(
          <AdminAnalytics />
        );


        await screen.findByRole(
          "option",
          {
            name:
              "prv_A",
          }
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

        const releaseSelect =
          screen.getByRole(
            "combobox",
            {
              name:
                "Legacy release",
            }
          );


        fireEvent.change(
          releaseSelect,
          {
            target: {
              value:
                "pv_release",
            },
          }
        );


        await waitFor(
          () => {
            expect(
              releaseSelect.value
            ).toBe(
              "pv_release"
            );
          }
        );


        fireEvent.change(
          variantSelect,
          {
            target: {
              value:
                "prv_A",
            },
          }
        );


        await waitFor(
          () => {
            expect(
              locationSelect
            ).not.toBeDisabled();
          }
        );


        fireEvent.change(
          locationSelect,
          {
            target: {
              value:
                "Austin, TX",
            },
          }
        );


        await waitFor(
          () => {
            expect(
              jobRoleSelect
            ).not.toBeDisabled();
          }
        );


        fireEvent.change(
          jobRoleSelect,
          {
            target: {
              value:
                "Backend Software Engineer",
            },
          }
        );


        const clearButton =
          await screen.findByRole(
            "button",
            {
              name:
                "Clear profile filters",
            }
          );


        await waitFor(
          () => {
            expect(
              clearButton
            ).not.toBeDisabled();
          }
        );


        fireEvent.click(
          clearButton
        );


        await waitFor(
          () => {
            expect(
              variantSelect.value
            ).toBe("all");

            expect(
              locationSelect.value
            ).toBe("all");

            expect(
              jobRoleSelect.value
            ).toBe("all");
          }
        );


        expect(
          releaseSelect.value
        ).toBe(
          "pv_release"
        );


        await waitFor(
          () => {
            expect(
              hasQueryCall({
                profileVersionId:
                  "pv_release",

                profileVariantId:
                  "all",

                profileTargetingLocation:
                  "all",

                profileTargetingJobRole:
                  "all",
              })
            ).toBe(true);
          }
        );
      }
    );
  }
);