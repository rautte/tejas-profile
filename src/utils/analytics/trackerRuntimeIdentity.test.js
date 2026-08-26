// src/utils/analytics/trackerRuntimeIdentity.test.js


jest.mock(
  "./session",
  () => ({
    getVisitorId:
      jest.fn(
        () =>
          "visitor-fixed"
      ),

    getOrCreateSharedSessionId:
      jest.fn(
        () =>
          "session-fixed"
      ),

    /**
     * Keep session lifecycle out of this focused test.
     * We want exactly the two explicitly tracked events.
     */
    claimSessionStart:
      jest.fn(
        () =>
          false
      ),

    startSharedSessionHeartbeat:
      jest.fn(
        () =>
          jest.fn()
      ),
  })
);


jest.mock(
  "../profileVersion",
  () => ({
    readBuildProfileVersion:
      jest.fn(
        () => ({
          id:
            "pv_legacy",

          gitSha:
            "legacy-git-sha",
        })
      ),
  })
);


jest.mock(
  "./exclusion",
  () => ({
    ANALYTICS_EXCLUSION_CHANGED_EVENT:
      "analytics-exclusion-changed-test",

    shouldCollectAnalytics:
      jest.fn(
        () =>
          true
      ),
  })
);


jest.mock(
  "./analyticsApi",
  () => ({
    ingestAnalyticsBatch:
      jest.fn(
        () =>
          Promise.resolve(
            true
          )
      ),

    sendAnalyticsBatchBeacon:
      jest.fn(
        () =>
          true
      ),
  })
);


jest.mock(
  "./store",
  () => ({
    clearEvents:
      jest.fn(),
  })
);


describe(
  "tracker runtime Profile identity",
  () => {
    beforeEach(
      () => {
        /**
         * tracker.js owns module-level queue/session state.
         *
         * Reset the module registry so each test gets a fresh
         * tracker and a fresh runtimeIdentity singleton.
         */
        jest.resetModules();

        jest.clearAllMocks();
      }
    );


    test(
      "changes Profile identity per event without changing visitor, session or legacy release identity",
      () => {
        /**
         * Require these only AFTER resetModules().
         *
         * This guarantees:
         *
         * test setter
         *       ↓
         * runtimeIdentity singleton
         *       ↑
         * tracker reader
         *
         * all refer to one module instance.
         */
        const {
          clearAnalyticsRuntimeIdentity,
          setAnalyticsRuntimeIdentity,
        } =
          require(
            "./runtimeIdentity"
          );


        const {
          flushForNavigation,
          trackEvent,
        } =
          require(
            "./tracker"
          );


        const {
          sendAnalyticsBatchBeacon,
        } =
          require(
            "./analyticsApi"
          );


        clearAnalyticsRuntimeIdentity();


        setAnalyticsRuntimeIdentity({
          profileVariantId:
            "prv_A",

          contentSchemaVersion:
            3,

          targeting: {
            location:
              "Austin, TX",

            jobRole:
              "Backend Software Engineer",
          },

          platformReleaseId:
            "plr_runtime_001",

          deploymentConfigurationId:
            "cfg_A",
        });


        trackEvent({
          type:
            "section_view",

          section:
            "About Me",
        });


        /**
         * Simulate:
         *
         * owner activation
         *      ↓
         * ProfileRuntimeContext.refresh()
         *      ↓
         * App.js synchronizes the newly ACTIVE Profile.
         *
         * Visitor/session identity remains unchanged.
         */
        setAnalyticsRuntimeIdentity({
          profileVariantId:
            "prv_B",

          contentSchemaVersion:
            4,

          targeting: {
            location:
              "Pune, India",

            jobRole:
              "AI Software Engineer",
          },

          platformReleaseId:
            "plr_runtime_001",

          deploymentConfigurationId:
            "cfg_B",
        });


        trackEvent({
          type:
            "section_view",

          section:
            "Experience",
        });


        const beaconQueued =
          flushForNavigation();


        expect(
          beaconQueued
        ).toBe(
          true
        );


        expect(
          sendAnalyticsBatchBeacon
        ).toHaveBeenCalledTimes(
          1
        );


        const payload =
          sendAnalyticsBatchBeacon
            .mock
            .calls[0][0];


        expect(
          payload.events
        ).toHaveLength(
          2
        );


        const [
          firstEvent,
          secondEvent,
        ] =
          payload.events;


        // -----------------------------
        // Visitor/session stay stable.
        // -----------------------------

        expect(
          firstEvent.visitorId
        ).toBe(
          "visitor-fixed"
        );

        expect(
          secondEvent.visitorId
        ).toBe(
          "visitor-fixed"
        );


        expect(
          firstEvent.sessionId
        ).toBe(
          "session-fixed"
        );

        expect(
          secondEvent.sessionId
        ).toBe(
          "session-fixed"
        );


        expect(
          secondEvent.tabId
        ).toBe(
          firstEvent.tabId
        );


        // -----------------------------
        // Legacy identity coexists.
        // -----------------------------

        expect(
          firstEvent.profileVersionId
        ).toBe(
          "pv_legacy"
        );

        expect(
          secondEvent.profileVersionId
        ).toBe(
          "pv_legacy"
        );


        expect(
          firstEvent.gitSha
        ).toBe(
          "legacy-git-sha"
        );

        expect(
          secondEvent.gitSha
        ).toBe(
          "legacy-git-sha"
        );


        // -----------------------------
        // First ACTIVE Profile.
        // -----------------------------

        expect(
          firstEvent.profileVariantId
        ).toBe(
          "prv_A"
        );

        expect(
          firstEvent.contentSchemaVersion
        ).toBe(
          3
        );

        expect(
          firstEvent.profileTargetingLocation
        ).toBe(
          "Austin, TX"
        );

        expect(
          firstEvent.profileTargetingJobRole
        ).toBe(
          "Backend Software Engineer"
        );


        // -----------------------------
        // Newly ACTIVE Profile.
        // -----------------------------

        expect(
          secondEvent.profileVariantId
        ).toBe(
          "prv_B"
        );

        expect(
          secondEvent.contentSchemaVersion
        ).toBe(
          4
        );

        expect(
          secondEvent.profileTargetingLocation
        ).toBe(
          "Pune, India"
        );

        expect(
          secondEvent.profileTargetingJobRole
        ).toBe(
          "AI Software Engineer"
        );


        // -----------------------------
        // No stale prv_A targeting.
        // -----------------------------

        expect(
          secondEvent.profileTargetingLocation
        ).not.toBe(
          firstEvent.profileTargetingLocation
        );

        expect(
          secondEvent.profileTargetingJobRole
        ).not.toBe(
          firstEvent.profileTargetingJobRole
        );


        // -----------------------------
        // P5 effective runtime identity.
        //
        // Platform stays the same while Profile activation
        // changes the effective Deployment Configuration.
        // -----------------------------

        expect(
          firstEvent.platformReleaseId
        ).toBe(
          "plr_runtime_001"
        );

        expect(
          secondEvent.platformReleaseId
        ).toBe(
          "plr_runtime_001"
        );


        expect(
          firstEvent.deploymentConfigurationId
        ).toBe(
          "cfg_A"
        );

        expect(
          secondEvent.deploymentConfigurationId
        ).toBe(
          "cfg_B"
        );

      }
    );
  }
);