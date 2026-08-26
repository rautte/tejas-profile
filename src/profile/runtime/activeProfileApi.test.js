import {
  fetchActiveProfile,
  resolveActiveProfileApiUrl,
} from "./activeProfileApi";


function response({
  ok = true,
  status = 200,
  body = {},
} = {}) {
  return {
    ok,
    status,

    text:
      async () =>
        JSON.stringify(
          body
        ),
  };
}


describe(
  "Active Profile public API client",
  () => {
    test(
      "prefers dedicated Active Profile endpoint",
      () => {
        expect(
          resolveActiveProfileApiUrl({
            REACT_APP_ACTIVE_PROFILE_API:
              "https://public.example/profile/active/",

            REACT_APP_SNAPSHOTS_API:
              "https://owner.example",
          })
        ).toBe(
          "https://public.example/profile/active"
        );
      }
    );


    test(
      "temporarily falls back to the shared API base",
      () => {
        expect(
          resolveActiveProfileApiUrl({
            REACT_APP_SNAPSHOTS_API:
              "https://api.example/",
          })
        ).toBe(
          "https://api.example/profile/active"
        );
      }
    );


    test(
      "missing configuration preserves repository fallback without making a request",
      async () => {
        const fetchImpl =
          jest.fn();


        await expect(
          fetchActiveProfile({
            fetchImpl,

            apiUrl:
              "",
          })
        ).resolves.toEqual({
          configured:
            false,

          active:
            null,

          variant:
            null,

          deployment:
            null,
        });


        expect(
          fetchImpl
        ).not.toHaveBeenCalled();
      }
    );


    test(
      "public request is GET-only and never attaches owner authentication",
      async () => {
        const fetchImpl =
          jest.fn(
            async () =>
              response({
                body: {
                  ok:
                    true,

                  active:
                    null,

                  variant:
                    null,
                },
              })
          );


        await fetchActiveProfile({
          fetchImpl,

          apiUrl:
            "https://api.example/profile/active",
        });


        const [
          url,
          options,
        ] =
          fetchImpl
            .mock
            .calls[0];


        expect(
          url
        ).toBe(
          "https://api.example/profile/active"
        );


        expect(
          options.method
        ).toBe(
          "GET"
        );


        expect(
          options.headers
            ["x-owner-token"]
        ).toBeUndefined();


        expect(
          JSON.stringify(
            options.headers
          ).toLowerCase()
        ).not.toContain(
          "owner"
        );
      }
    );


    test(
      "returns explicit Platform Release and Deployment Configuration identity for an active runtime",
      async () => {
        const fetchImpl =
          jest.fn(
            async () =>
              response({
                body: {
                  ok:
                    true,

                  active: {
                    profileVariantId:
                      "prv_runtime",
                  },

                  variant: {
                    profileVariantId:
                      "prv_runtime",
                  },

                  deployment: {
                    platformReleaseId:
                      "plr_runtime",

                    deploymentConfigurationId:
                      "cfg_runtime",
                  },
                },
              })
          );


        await expect(
          fetchActiveProfile({
            fetchImpl,

            apiUrl:
              "https://api.example/profile/active",
          })
        ).resolves.toMatchObject({
          configured:
            true,

          deployment: {
            platformReleaseId:
              "plr_runtime",

            deploymentConfigurationId:
              "cfg_runtime",
          },
        });
      }
    );


    test(
      "accepts deployment null as the pre-P5F migration state",
      async () => {
        const fetchImpl =
          jest.fn(
            async () =>
              response({
                body: {
                  ok:
                    true,

                  active: {
                    profileVariantId:
                      "prv_runtime",
                  },

                  variant: {
                    profileVariantId:
                      "prv_runtime",
                  },

                  deployment:
                    null,
                },
              })
          );


        await expect(
          fetchActiveProfile({
            fetchImpl,

            apiUrl:
              "https://api.example/profile/active",
          })
        ).resolves.toMatchObject({
          configured:
            true,

          deployment:
            null,
        });
      }
    );


    test(
      "rejects partial Deployment Configuration identity",
      async () => {
        const fetchImpl =
          jest.fn(
            async () =>
              response({
                body: {
                  ok:
                    true,

                  active: {
                    profileVariantId:
                      "prv_runtime",
                  },

                  variant: {
                    profileVariantId:
                      "prv_runtime",
                  },

                  deployment: {
                    platformReleaseId:
                      "plr_runtime",
                  },
                },
              })
          );


        await expect(
          fetchActiveProfile({
            fetchImpl,

            apiUrl:
              "https://api.example/profile/active",
          })
        ).rejects.toThrow(
          "deploymentConfigurationId is invalid"
        );
      }
    );


    test(
      "API failures fail closed",
      async () => {
        const fetchImpl =
          jest.fn(
            async () =>
              response({
                ok:
                  false,

                status:
                  500,

                body: {
                  ok:
                    false,

                  error:
                    "temporary failure",
                },
              })
          );


        await expect(
          fetchActiveProfile({
            fetchImpl,

            apiUrl:
              "https://api.example/profile/active",
          })
        ).rejects.toThrow(
          "temporary failure"
        );
      }
    );
  }
);