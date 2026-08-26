import {
  clearAnalyticsRuntimeIdentity,
  readAnalyticsRuntimeIdentity,
  setAnalyticsRuntimeIdentity,
} from "./runtimeIdentity";


describe(
  "analytics runtime identity",
  () => {
    beforeEach(
      () => {
        clearAnalyticsRuntimeIdentity();
      }
    );


    test(
      "starts with no runtime Profile or Platform identity",
      () => {
        expect(
          readAnalyticsRuntimeIdentity()
        ).toEqual({
          profileVariantId:
            null,

          contentSchemaVersion:
            null,

          targeting: {
            location:
              null,

            jobRole:
              null,
          },

          platformReleaseId:
            null,

          deploymentConfigurationId:
            null,
        });
      }
    );


    test(
      "normalizes explicit runtime identity without deriving anything",
      () => {
        setAnalyticsRuntimeIdentity({
          profileVariantId:
            "  prv_backend_india  ",

          contentSchemaVersion:
            4,

          targeting: {
            location:
              "  Pune, India  ",

            jobRole:
              "  Backend Software Engineer  ",
          },

          platformReleaseId:
            "  platform_R42  ",

          deploymentConfigurationId:
            "  cfg_42_backend_india  ",
        });


        expect(
          readAnalyticsRuntimeIdentity()
        ).toEqual({
          profileVariantId:
            "prv_backend_india",

          contentSchemaVersion:
            4,

          targeting: {
            location:
              "Pune, India",

            jobRole:
              "Backend Software Engineer",
          },

          platformReleaseId:
            "platform_R42",

          deploymentConfigurationId:
            "cfg_42_backend_india",
        });
      }
    );


    test(
      "rejects invalid Profile Variant and schema identity",
      () => {
        setAnalyticsRuntimeIdentity({
          profileVariantId:
            "bad variant id",

          contentSchemaVersion:
            0,

          targeting: {
            location:
              "",

            jobRole:
              null,
          },
        });


        expect(
          readAnalyticsRuntimeIdentity()
        ).toEqual({
          profileVariantId:
            null,

          contentSchemaVersion:
            null,

          targeting: {
            location:
              null,

            jobRole:
              null,
          },

          platformReleaseId:
            null,

          deploymentConfigurationId:
            null,
        });
      }
    );


    test(
      "replaces previous identity so stale Profile state cannot leak across runtime changes",
      () => {
        setAnalyticsRuntimeIdentity({
          profileVariantId:
            "prv_active",

          contentSchemaVersion:
            3,

          targeting: {
            location:
              "Austin, TX",

            jobRole:
              "Software Engineer",
          },
        });


        setAnalyticsRuntimeIdentity({});


        expect(
          readAnalyticsRuntimeIdentity()
        ).toEqual({
          profileVariantId:
            null,

          contentSchemaVersion:
            null,

          targeting: {
            location:
              null,

            jobRole:
              null,
          },

          platformReleaseId:
            null,

          deploymentConfigurationId:
            null,
        });
      }
    );


    test(
      "returns immutable identity objects",
      () => {
        const identity =
          setAnalyticsRuntimeIdentity({
            profileVariantId:
              "prv_test",

            targeting: {
              location:
                "Dubai",

              jobRole:
                "Software Engineer",
            },
          });


        expect(
          Object.isFrozen(
            identity
          )
        ).toBe(
          true
        );


        expect(
          Object.isFrozen(
            identity.targeting
          )
        ).toBe(
          true
        );
      }
    );
  }
);