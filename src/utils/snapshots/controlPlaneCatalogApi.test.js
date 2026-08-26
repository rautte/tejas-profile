// src/utils/snapshots/controlPlaneCatalogApi.test.js

import {
  OWNER_SESSION_EXPIRES_AT_KEY,
  OWNER_SESSION_KEY,
  OWNER_SESSION_TOKEN_KEY,
} from "../../config/owner";


const ORIGINAL_ENV =
  process.env;


function response({
  status =
    200,

  body = {},
} = {}) {
  return {
    ok:
      status >=
        200 &&
      status <
        300,

    status,

    json:
      jest.fn(
        async () =>
          body
      ),
  };
}


describe(
  "controlPlaneCatalogApi",
  () => {
    beforeEach(
      () => {
        jest
          .resetModules();


        process.env = {
          ...ORIGINAL_ENV,

          REACT_APP_SNAPSHOTS_API:
            "https://api.example.test/",
        };


        sessionStorage
          .clear();


        sessionStorage
          .setItem(
            OWNER_SESSION_KEY,
            "1"
          );


        sessionStorage
          .setItem(
            OWNER_SESSION_TOKEN_KEY,
            "catalog-owner-token"
        );

        sessionStorage
          .setItem(
            OWNER_SESSION_EXPIRES_AT_KEY,
            String(
            Date.now() +
              60 * 60 * 1000
          )
        );


        global.fetch =
          jest.fn();
      }
    );


    afterAll(
      () => {
        process.env =
          ORIGINAL_ENV;
      }
    );


    test(
      "lists Profile Variants with owner auth, bounded pagination and no-store caching",
      async () => {
        global.fetch
          .mockResolvedValue(
            response({
              body: {
                ok:
                  true,

                variants:
                  [],

                nextToken:
                  "next-profile",
              },
            })
          );


        const {
          listProfileVariants,
        } =
          require(
            "./controlPlaneCatalogApi"
          );


        await listProfileVariants({
          limit:
            25,

          nextToken:
            "catalog-token",
        });


        expect(
          global.fetch
        ).toHaveBeenCalledWith(
          "https://api.example.test/profile-variants/list?limit=25&nextToken=catalog-token",
          {
            method:
              "GET",

            headers: {
              "content-type":
                "application/json",

              "x-owner-token":
                "catalog-owner-token",
            },

            cache:
              "no-store",
          }
        );
      }
    );


    test(
      "reads entity-specific Profile Activation and Platform Deployment history",
      async () => {
        global.fetch
          .mockResolvedValue(
            response({
              body: {
                ok:
                  true,

                activations:
                  [],
              },
            })
          )
          .mockResolvedValueOnce(
            response({
              body: {
                ok:
                  true,

                deployments:
                  [],
              },
            })
          );


        const {
          listProfileActivations,
          listPlatformDeployments,
        } =
          require(
            "./controlPlaneCatalogApi"
          );


        await listProfileActivations({
          profileVariantId:
            "prv:one",

          limit:
            50,
        });


        await listPlatformDeployments({
          platformReleaseId:
            "plr:one",

          limit:
            50,
        });


        expect(
          global.fetch
            .mock
            .calls[0][0]
        ).toBe(
          "https://api.example.test/profile-activations/list?profileVariantId=prv%3Aone&limit=50"
        );


        expect(
          global.fetch
            .mock
            .calls[1][0]
        ).toBe(
          "https://api.example.test/platform-deployments/list?platformReleaseId=plr%3Aone&limit=50"
        );
      }
    );


    test(
      "reads Platform Release catalog and validates direct-read identity",
      async () => {
        global.fetch
          .mockResolvedValueOnce(
            response({
              body: {
                ok:
                  true,

                releases:
                  [],
              },
            })
          )
          .mockResolvedValueOnce(
            response({
              body: {
                ok:
                  true,

                release: {
                  platformReleaseId:
                    "plr:two",
                },
              },
            })
          );


        const {
          listPlatformReleases,
          getPlatformRelease,
        } =
          require(
            "./controlPlaneCatalogApi"
          );


        await listPlatformReleases({
          limit:
            10,
        });


        await getPlatformRelease(
          "plr:two"
        );


        expect(
          global.fetch
            .mock
            .calls[0][0]
        ).toBe(
          "https://api.example.test/platform-releases/list?limit=10"
        );


        expect(
          global.fetch
            .mock
            .calls[1][0]
        ).toBe(
          "https://api.example.test/platform-releases/get?platformReleaseId=plr%3Atwo"
        );
      }
    );


    test(
      "requires exactly one Deployment Configuration reverse-lookup selector",
      async () => {
        const {
          listDeploymentConfigurations,
        } =
          require(
            "./controlPlaneCatalogApi"
          );


        await expect(
          listDeploymentConfigurations()
        ).rejects.toThrow(
          "Exactly one of profileVariantId or platformReleaseId is required."
        );


        await expect(
          listDeploymentConfigurations({
            profileVariantId:
              "prv_one",

            platformReleaseId:
              "plr_one",
          })
        ).rejects.toThrow(
          "Exactly one of profileVariantId or platformReleaseId is required."
        );


        expect(
          global.fetch
        ).not
          .toHaveBeenCalled();
      }
    );


    test(
      "queries and reads Deployment Configurations through the dedicated owner transport",
      async () => {
        global.fetch
          .mockResolvedValueOnce(
            response({
              body: {
                ok:
                  true,

                configurations:
                  [],
              },
            })
          )
          .mockResolvedValueOnce(
            response({
              body: {
                ok:
                  true,

                configuration: {
                  deploymentConfigurationId:
                    "cfg:one",
                },
              },
            })
          );


        const {
          listDeploymentConfigurations,
          getDeploymentConfiguration,
        } =
          require(
            "./controlPlaneCatalogApi"
          );


        await listDeploymentConfigurations({
          profileVariantId:
            "prv:one",

          limit:
            20,
        });


        await getDeploymentConfiguration(
          "cfg:one"
        );


        expect(
          global.fetch
            .mock
            .calls[0][0]
        ).toBe(
          "https://api.example.test/deployment-configurations/list?profileVariantId=prv%3Aone&limit=20"
        );


        expect(
          global.fetch
            .mock
            .calls[1][0]
        ).toBe(
          "https://api.example.test/deployment-configurations/get?deploymentConfigurationId=cfg%3Aone"
        );
      }
    );


    test(
      "rejects out-of-contract limits before making a request",
      async () => {
        const {
          listProfileVariants,
          listProfileActivations,
        } =
          require(
            "./controlPlaneCatalogApi"
          );


        await expect(
          listProfileVariants({
            limit:
              51,
          })
        ).rejects.toThrow(
          "limit must be an integer between 1 and 50."
        );


        await expect(
          listProfileActivations({
            limit:
              101,
          })
        ).rejects.toThrow(
          "limit must be an integer between 1 and 100."
        );


        expect(
          global.fetch
        ).not
          .toHaveBeenCalled();
      }
    );


    test(
      "fails closed when a direct-read response identity differs from the requested identity",
      async () => {
        global.fetch
          .mockResolvedValue(
            response({
              body: {
                ok:
                  true,

                variant: {
                  profileVariantId:
                    "prv_other",
                },
              },
            })
          );


        const {
          getProfileVariant,
        } =
          require(
            "./controlPlaneCatalogApi"
          );


        await expect(
          getProfileVariant(
            "prv_expected"
          )
        ).rejects.toThrow(
          "Profile Variant response identity does not match the requested ID."
        );
      }
    );


    test(
      "surfaces backend errors without replacing their message",
      async () => {
        global.fetch
          .mockResolvedValue(
            response({
              status:
                500,

              body: {
                ok:
                  false,

                error:
                  "catalog integrity failure",
              },
            })
          );


        const {
          listPlatformReleases,
        } =
          require(
            "./controlPlaneCatalogApi"
          );


        await expect(
          listPlatformReleases()
        ).rejects.toThrow(
          "catalog integrity failure"
        );
      }
    );
  }
);