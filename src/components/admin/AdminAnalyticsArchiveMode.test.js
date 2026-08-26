import {
  act,
  fireEvent,
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


jest.mock(
  "./ConfigurationAnalyticsArchivePanel",
  () => {
    const React =
      require(
        "react"
      );


    return function MockConfigurationAnalyticsArchivePanel() {
      return React.createElement(
        "div",
        {
          "data-testid":
            "configuration-analytics-archive-panel",
        },
        "Archive panel"
      );
    };
  }
);

function createDeferred() {
  let resolve;
  let reject;


  const promise =
    new Promise(
      (
        resolvePromise,
        rejectPromise
      ) => {
        resolve =
          resolvePromise;

        reject =
          rejectPromise;
      }
    );


  return {
    promise,
    resolve,
    reject,
  };
}


const META_RESPONSE = {
  ok:
    true,

  releases:
    [],

  boundaries:
    [],
};


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


beforeEach(
  () => {
    jest.clearAllMocks();


    queryAnalyticsMeta
      .mockResolvedValue(
        META_RESPONSE
      );


    queryAnalyticsAgg
      .mockResolvedValue(
        AGG_RESPONSE
      );
  }
);


test(
  "keeps live Analytics and immutable archive as distinct owner views",
  async () => {
    const initialMetadataDeferred =
      createDeferred();

    const initialAnalyticsDeferred =
      createDeferred();

    const reentryMetadataDeferred =
      createDeferred();

    const reentryAnalyticsDeferred =
      createDeferred();


    /**
     * Initial Live-mode request chain.
     *
     * Keep both asynchronous stages pending until this test explicitly
     * resolves them inside act().
     */
    queryAnalyticsMeta
      .mockReset()
      .mockReturnValue(
        initialMetadataDeferred
          .promise
      );


    queryAnalyticsAgg
      .mockReset()
      .mockReturnValue(
        initialAnalyticsDeferred
          .promise
      );


    render(
      <AdminAnalytics />
    );


    expect(
      queryAnalyticsMeta
    ).toHaveBeenCalledTimes(
      1
    );


    /**
     * Initial Live load — metadata stage.
     *
     * Resolving metadata commits:
     *
     *   setReleaseCatalog
     *   setBoundaryCatalog
     *   setMetaLoading
     *   setMetadataReady
     *
     * The resulting metadataReady=true render enables the Analytics
     * aggregate effect.
     */
    await act(
      async () => {
        initialMetadataDeferred
          .resolve(
            META_RESPONSE
          );


        await initialMetadataDeferred
          .promise;
      }
    );


    expect(
      queryAnalyticsAgg
    ).toHaveBeenCalled();


    /**
     * Initial Live load — aggregate stage.
     *
     * Every aggregate request in this initial batch receives the same
     * deferred promise, so the complete batch settles under this act().
     */
    await act(
      async () => {
        initialAnalyticsDeferred
          .resolve(
            AGG_RESPONSE
          );


        await initialAnalyticsDeferred
          .promise;
      }
    );


    expect(
      screen.getByText(
        "Overview"
      )
    ).toBeInTheDocument();


    expect(
      screen.getByText(
        "Analytics window"
      )
    ).toBeInTheDocument();


    /**
     * Leave Live mode.
     */
    fireEvent.click(
      screen.getByRole(
        "button",
        {
          name:
            "Historical archive",
        }
      )
    );


    expect(
      screen.getByTestId(
        "configuration-analytics-archive-panel"
      )
    ).toBeInTheDocument();


    expect(
      screen.queryByText(
        "Analytics window"
      )
    ).not.toBeInTheDocument();


    /**
     * Returning from Archive to Live starts a NEW asynchronous request
     * lifecycle.
     *
     * Do not allow those requests to reuse the already-resolved initial
     * promises. Give the re-entry lifecycle its own controlled promises.
     */
    const metadataCallsBeforeReentry =
      queryAnalyticsMeta
        .mock.calls
        .length;

    const aggregateCallsBeforeReentry =
      queryAnalyticsAgg
        .mock.calls
        .length;


    queryAnalyticsMeta
      .mockReturnValue(
        reentryMetadataDeferred
          .promise
      );


    queryAnalyticsAgg
      .mockReturnValue(
        reentryAnalyticsDeferred
          .promise
      );


    /**
     * Re-enter Live mode.
     *
     * metadataReady is already true from the first Live lifecycle, so
     * Analytics.js may start both metadata and aggregate work as part of
     * this mode transition. Both promises are therefore controlled before
     * the click happens.
     */
    fireEvent.click(
      screen.getByRole(
        "button",
        {
          name:
            "Live analytics",
        }
      )
    );


    expect(
      queryAnalyticsMeta
        .mock.calls
        .length
    ).toBeGreaterThan(
      metadataCallsBeforeReentry
    );


    expect(
      queryAnalyticsAgg
        .mock.calls
        .length
    ).toBeGreaterThan(
      aggregateCallsBeforeReentry
    );


    /**
     * Re-entry metadata settlement.
     */
    await act(
      async () => {
        reentryMetadataDeferred
          .resolve(
            META_RESPONSE
          );


        await reentryMetadataDeferred
          .promise;
      }
    );


    /**
     * Re-entry aggregate settlement.
     */
    await act(
      async () => {
        reentryAnalyticsDeferred
          .resolve(
            AGG_RESPONSE
          );


        await reentryAnalyticsDeferred
          .promise;
      }
    );


    /**
     * The second Live lifecycle is now fully settled before the test ends.
     */
    expect(
      screen.getByText(
        "Analytics window"
      )
    ).toBeInTheDocument();


    expect(
      screen.getByText(
        "Overview"
      )
    ).toBeInTheDocument();
  }
);