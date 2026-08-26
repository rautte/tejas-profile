// src/utils/snapshots/profileActivationApi.test.js

describe(
  "activateProfileVariant",
  () => {
    const ORIGINAL_API =
      process.env
        .REACT_APP_SNAPSHOTS_API;


    beforeEach(
      () => {
        jest.resetModules();

        process.env
          .REACT_APP_SNAPSHOTS_API =
          "https://api.example.test";

        sessionStorage.clear();

        global.fetch =
          jest.fn();
      }
    );


    afterEach(
      () => {
        sessionStorage.clear();

        jest.restoreAllMocks();

        if (
          ORIGINAL_API ===
            undefined
        ) {
          delete process.env
            .REACT_APP_SNAPSHOTS_API;
        } else {
          process.env
            .REACT_APP_SNAPSHOTS_API =
            ORIGINAL_API;
        }
      }
    );


    function enableOwner() {
      const {
        OWNER_SESSION_EXPIRES_AT_KEY,
        OWNER_SESSION_KEY,
        OWNER_SESSION_TOKEN_KEY,
      } =
        require(
          "../../config/owner"
        );


      sessionStorage.setItem(
        OWNER_SESSION_KEY,
        "1"
      );

      sessionStorage.setItem(
        OWNER_SESSION_TOKEN_KEY,
        "owner-test-token"
      );

      sessionStorage.setItem(
        OWNER_SESSION_EXPIRES_AT_KEY,
        String(
            Date.now() +
            60 * 60 * 1000
        )
      );
    }


    test(
      "activates a published Profile Variant with optimistic concurrency",
      async () => {
        enableOwner();


        global.fetch.mockResolvedValue({
          ok:
            true,

          status:
            201,

          json:
            async () => ({
              ok:
                true,

              active: {
                profileVariantId:
                  "prv:test-one",

                revision:
                  4,
              },
            }),
        });


        const {
          activateProfileVariant,
        } =
          require(
            "./snapshotsApi"
          );


        const result =
          await activateProfileVariant({
            profileVariantId:
              "prv:test-one",

            expectedRevision:
              3,
          });


        expect(
          global.fetch
        ).toHaveBeenCalledTimes(
          1
        );


        expect(
          global.fetch
        ).toHaveBeenCalledWith(
          "https://api.example.test/profile-variants/activate",
          {
            method:
              "POST",

            headers: {
              "content-type":
                "application/json",

              "x-owner-token":
                "owner-test-token",
            },

            body:
              JSON.stringify({
                profileVariantId:
                  "prv:test-one",

                expectedRevision:
                  3,
              }),

            cache:
              "no-store",
          }
        );


        expect(
          result
            .active
            .profileVariantId
        ).toBe(
          "prv:test-one"
        );


        expect(
          result
            .active
            .revision
        ).toBe(
          4
        );
      }
    );


    test(
        "sends expectedRevision zero when no active Profile pointer was observed",
        async () => {
            enableOwner();

            global.fetch.mockResolvedValue({
            ok: true,
            status: 201,
            json: async () => ({
                ok: true,
            }),
            });

            const {
            activateProfileVariant,
            } =
            require(
                "./snapshotsApi"
            );

            await activateProfileVariant({
            profileVariantId:
                "prv:first",

            expectedRevision:
                0,
            });

            const [
            ,
            options,
            ] =
            global.fetch
                .mock
                .calls[0];

            expect(
            JSON.parse(
                options.body
            )
            ).toEqual({
            profileVariantId:
                "prv:first",

            expectedRevision:
                0,
            });
        }
        );


    test(
      "surfaces a 409 as an activation conflict",
      async () => {
        enableOwner();


        global.fetch.mockResolvedValue({
          ok:
            false,

          status:
            409,

          json:
            async () => ({
              ok:
                false,

              error:
                "Activation revision conflict.",
            }),
        });


        const {
          activateProfileVariant,
        } =
          require(
            "./snapshotsApi"
          );


        let caught =
          null;


        try {
          await activateProfileVariant({
            profileVariantId:
              "prv:test-two",

            expectedRevision:
              7,
          });
        } catch (
          error
        ) {
          caught =
            error;
        }


        expect(
          caught
        ).toBeTruthy();


        expect(
          caught.code
        ).toBe(
          "PROFILE_ACTIVATION_CONFLICT"
        );


        expect(
          caught.status
        ).toBe(
          409
        );


        expect(
          caught.message
        ).toContain(
          "Activation revision conflict"
        );
      }
    );


    test(
      "rejects an empty Profile Variant ID before making a request",
      async () => {
        const {
          activateProfileVariant,
        } =
          require(
            "./snapshotsApi"
          );


        await expect(
          activateProfileVariant({
            profileVariantId:
              "   ",
          })
        ).rejects.toThrow(
          "profileVariantId is required"
        );


        expect(
          global.fetch
        ).not
          .toHaveBeenCalled();
      }
    );


    test(
      "rejects invalid expectedRevision before making a request",
      async () => {
        const {
          activateProfileVariant,
        } =
          require(
            "./snapshotsApi"
          );


        await expect(
            activateProfileVariant({
                profileVariantId:
                "prv:test-three",

                expectedRevision:
                -1,
            })
            ).rejects.toThrow(
            "expectedRevision must be a non-negative integer"
            );


        expect(
          global.fetch
        ).not
          .toHaveBeenCalled();
      }
    );
  }
);