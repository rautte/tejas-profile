const mockReadPublicActiveProfile =
  jest.fn();

const mockReadEffectiveDeploymentConfiguration =
  jest.fn();


jest.mock(
  "../lambda/active-profile-reader",
  () => ({
    readPublicActiveProfile:
      mockReadPublicActiveProfile,
  })
);


jest.mock(
  "../lambda/effective-deployment-configuration-reader",
  () => ({
    readEffectiveDeploymentConfiguration:
      mockReadEffectiveDeploymentConfiguration,
  })
);


let handler:
  any;


function event() {
  return {
    rawPath:
      "/profile/active",

    requestContext: {
      http: {
        method:
          "GET",

        path:
          "/profile/active",
      },
    },

    /**
     * Public runtime deliberately has no owner token.
     */
    headers:
      {},
  };
}


function parsedBody(
  response:
    any
) {
  return JSON.parse(
    response.body
  );
}


beforeAll(
  async () => {
    process.env.PROFILE_ACTIVATION_TABLE =
      "profile-activation-test-table";

    process.env.PROFILE_VARIANTS_BUCKET =
      "profile-variants-test-bucket";

    process.env.PLATFORM_DEPLOYMENT_TABLE =
      "platform-deployment-test-table";

    process.env.PLATFORM_RELEASES_BUCKET =
      "platform-releases-test-bucket";

    process.env.DEPLOYMENT_CONFIGURATIONS_BUCKET =
      "deployment-configurations-test-bucket";

    process.env.STAGE =
      "prod";


    ({
      handler,
    } =
      await import(
        "../lambda/active-profile-handler"
      ));
  }
);


beforeEach(
  () => {
    mockReadPublicActiveProfile
      .mockReset();

    mockReadEffectiveDeploymentConfiguration
      .mockReset();
  }
);


afterAll(
  () => {
    delete process.env.PROFILE_ACTIVATION_TABLE;
    delete process.env.PROFILE_VARIANTS_BUCKET;
    delete process.env.PLATFORM_DEPLOYMENT_TABLE;
    delete process.env.PLATFORM_RELEASES_BUCKET;
    delete process.env.DEPLOYMENT_CONFIGURATIONS_BUCKET;
    delete process.env.STAGE;
  }
);


describe(
  "public active Profile runtime identity",
  () => {
    test(
      "delivers explicit Platform Release and Deployment Configuration identities without owner auth",
      async () => {
        const active = {
          revision:
            7,

          activationId:
            "act_runtime",

          profileVariantId:
            "prv_runtime",

          activatedAt:
            "2026-08-23T10:00:00.000Z",

          contentSchemaVersion:
            1,

          contentHash:
            "a".repeat(
              64
            ),
        };


        mockReadPublicActiveProfile
          .mockResolvedValueOnce({
            active,

            manifestSha256:
              "b".repeat(
                64
              ),

            variant: {
              profileVariantId:
                "prv_runtime",
            },
          });


        mockReadEffectiveDeploymentConfiguration
          .mockResolvedValueOnce({
            activePlatform: {
              revision:
                3,

              deploymentId:
                "pdep_runtime",

              platformReleaseId:
                "plr_runtime",

              deployedAt:
                "2026-08-23T11:00:00.000Z",
            },

            platformReleaseId:
              "plr_runtime",

            deploymentConfigurationId:
              "cfg_runtime",

            platformReleaseSha256:
              "c".repeat(
                64
              ),

            configurationSha256:
              "d".repeat(
                64
              ),
          });


        const response =
          await handler(
            event()
          );


        expect(
          response.statusCode
        ).toBe(
          200
        );


        expect(
          parsedBody(
            response
          )
        ).toMatchObject({
          ok:
            true,

          active: {
            profileVariantId:
              "prv_runtime",
          },

          deployment: {
            platformReleaseId:
              "plr_runtime",

            deploymentConfigurationId:
              "cfg_runtime",
          },
        });


        expect(
          mockReadEffectiveDeploymentConfiguration
        ).toHaveBeenCalledTimes(
          1
        );


        expect(
          mockReadEffectiveDeploymentConfiguration
            .mock
            .calls[0][0]
            .activeProfilePointer
        ).toBe(
          active
        );
      }
    );


    test(
      "preserves the migration state when Profile is active but no formal Platform pointer exists yet",
      async () => {
        mockReadPublicActiveProfile
          .mockResolvedValueOnce({
            active: {
              revision:
                1,

              activationId:
                "act_runtime",

              profileVariantId:
                "prv_runtime",

              activatedAt:
                "2026-08-23T10:00:00.000Z",

              contentSchemaVersion:
                1,

              contentHash:
                "a".repeat(
                  64
                ),
            },

            variant: {
              profileVariantId:
                "prv_runtime",
            },
          });


        mockReadEffectiveDeploymentConfiguration
          .mockResolvedValueOnce(
            null
          );


        const response =
          await handler(
            event()
          );


        expect(
          response.statusCode
        ).toBe(
          200
        );


        expect(
          parsedBody(
            response
          ).deployment
        ).toBeNull();
      }
    );


    test(
      "does not resolve Platform identity when no Profile Variant is active",
      async () => {
        mockReadPublicActiveProfile
          .mockResolvedValueOnce(
            null
          );


        const response =
          await handler(
            event()
          );


        expect(
          response.statusCode
        ).toBe(
          200
        );


        expect(
          parsedBody(
            response
          )
        ).toMatchObject({
          ok:
            true,

          active:
            null,

          variant:
            null,

          deployment:
            null,
        });


        expect(
          mockReadEffectiveDeploymentConfiguration
        ).not.toHaveBeenCalled();
      }
    );


    test(
      "fails closed when effective runtime configuration cannot be verified",
      async () => {
        mockReadPublicActiveProfile
          .mockResolvedValueOnce({
            active: {
              revision:
                1,

              activationId:
                "act_runtime",

              profileVariantId:
                "prv_runtime",

              activatedAt:
                "2026-08-23T10:00:00.000Z",

              contentSchemaVersion:
                1,

              contentHash:
                "a".repeat(
                  64
                ),
            },

            variant: {
              profileVariantId:
                "prv_runtime",
            },
          });


        mockReadEffectiveDeploymentConfiguration
          .mockRejectedValueOnce(
            new Error(
              "Effective Deployment Configuration does not exist."
            )
          );


        const response =
          await handler(
            event()
          );


        expect(
          response.statusCode
        ).toBe(
          500
        );


        expect(
          parsedBody(
            response
          ).ok
        ).toBe(
          false
        );
      }
    );
  }
);