function jsonResponse(
  body,
  {
    status = 200,
  } = {}
) {
  return {
    ok:
      status >= 200 &&
      status < 300,

    status,

    text:
      jest.fn()
        .mockResolvedValue(
          body == null
            ? ""
            : JSON.stringify(
                body
              )
        ),
  };
}


function loadUsageApi({
  owner = true,
} = {}) {
  jest.resetModules();

  process.env
    .REACT_APP_SNAPSHOTS_API =
    "https://snapshots.example.test/";

  const {
    OWNER_SESSION_EXPIRES_AT_KEY,
    OWNER_SESSION_KEY,
    OWNER_SESSION_TOKEN_KEY,
  } =
    require(
      "../../config/owner"
    );

  window
    .sessionStorage
    .clear();

  if (owner) {
    window
      .sessionStorage
      .setItem(
        OWNER_SESSION_KEY,
        "1"
      );

    window
      .sessionStorage
      .setItem(
        OWNER_SESSION_TOKEN_KEY,
        "test-owner-token"
      );

    window
      .sessionStorage
      .setItem(
        OWNER_SESSION_EXPIRES_AT_KEY,
        String(
          Date.now() +
          60 * 60 * 1000
        )
      );
  }

  return require(
    "./usageApi"
  );
}


describe(
  "usageApi",
  () => {
    beforeEach(
      () => {
        jest
          .restoreAllMocks();

        window
          .sessionStorage
          .clear();

        global.fetch =
          jest.fn();
      }
    );


    afterEach(
      () => {
        delete global.fetch;
      }
    );


    test(
      "getUsageSummary GETs /usage/summary with the owner token and returns config + snapshots",
      async () => {
        global.fetch
          .mockResolvedValue(
            jsonResponse(
              {
                ok: true,

                config: {
                  intervalDays:
                    1,
                },

                snapshots: {
                  day: {
                    totalCostUsd:
                      1.5,
                  },

                  week:
                    null,

                  month:
                    null,
                },
              }
            )
          );

        const {
          getUsageSummary,
        } =
          loadUsageApi();

        const result =
          await getUsageSummary();

        expect(
          global.fetch
        ).toHaveBeenCalledTimes(
          1
        );

        const [
          url,
          options,
        ] =
          global.fetch
            .mock
            .calls[0];

        expect(
          url
        ).toBe(
          "https://snapshots.example.test/usage/summary"
        );

        expect(
          options.method
        ).toBe(
          "GET"
        );

        expect(
          options
            .headers[
            "x-owner-token"
          ]
        ).toBe(
          "test-owner-token"
        );

        expect(
          result.config
            .intervalDays
        ).toBe(
          1
        );

        expect(
          result.snapshots
            .day
            .totalCostUsd
        ).toBe(
          1.5
        );
      }
    );


    test(
      "getUsageSummary throws when the owner session is missing, without calling fetch",
      async () => {
        const {
          getUsageSummary,
        } =
          loadUsageApi(
            {
              owner:
                false,
            }
          );

        await expect(
          getUsageSummary()
        ).rejects.toThrow(
          /Owner mode/
        );

        expect(
          global.fetch
        ).not.toHaveBeenCalled();
      }
    );


    test(
      "getUsageHistory encodes periodType and limit as query params",
      async () => {
        global.fetch
          .mockResolvedValue(
            jsonResponse(
              {
                ok: true,

                periodType:
                  "week",

                snapshots: [
                  {
                    periodKey:
                      "2026-W36",
                  },
                ],
              }
            )
          );

        const {
          getUsageHistory,
        } =
          loadUsageApi();

        const rows =
          await getUsageHistory(
            {
              periodType:
                "week",

              limit:
                5,
            }
          );

        const [
          url,
        ] =
          global.fetch
            .mock
            .calls[0];

        const parsed =
          new URL(
            url
          );

        expect(
          parsed.pathname
        ).toBe(
          "/usage/history"
        );

        expect(
          parsed.searchParams.get(
            "periodType"
          )
        ).toBe(
          "week"
        );

        expect(
          parsed.searchParams.get(
            "limit"
          )
        ).toBe(
          "5"
        );

        expect(
          rows
        ).toEqual(
          [
            {
              periodKey:
                "2026-W36",
            },
          ]
        );
      }
    );


    test(
      "setUsageRefreshConfig POSTs the requested intervalDays and returns the persisted config",
      async () => {
        global.fetch
          .mockResolvedValue(
            jsonResponse(
              {
                ok: true,

                config: {
                  intervalDays:
                    3,
                },
              }
            )
          );

        const {
          setUsageRefreshConfig,
        } =
          loadUsageApi();

        const config =
          await setUsageRefreshConfig(
            {
              intervalDays:
                3,
            }
          );

        const [
          url,
          options,
        ] =
          global.fetch
            .mock
            .calls[0];

        expect(
          url
        ).toBe(
          "https://snapshots.example.test/usage/config"
        );

        expect(
          options.method
        ).toBe(
          "POST"
        );

        expect(
          JSON.parse(
            options.body
          )
        ).toEqual(
          {
            intervalDays:
              3,
          }
        );

        expect(
          config.intervalDays
        ).toBe(
          3
        );
      }
    );


    test(
      "refreshUsageNow POSTs /usage/refresh-now and returns whether it was triggered",
      async () => {
        global.fetch
          .mockResolvedValue(
            jsonResponse(
              {
                ok: true,

                triggered:
                  true,
              }
            )
          );

        const {
          refreshUsageNow,
        } =
          loadUsageApi();

        const triggered =
          await refreshUsageNow();

        const [
          url,
          options,
        ] =
          global.fetch
            .mock
            .calls[0];

        expect(
          url
        ).toBe(
          "https://snapshots.example.test/usage/refresh-now"
        );

        expect(
          options.method
        ).toBe(
          "POST"
        );

        expect(
          triggered
        ).toBe(
          true
        );
      }
    );


    test(
      "surfaces the server error message when a call fails",
      async () => {
        global.fetch
          .mockResolvedValue(
            jsonResponse(
              {
                ok: false,

                error:
                  "intervalDays must be one of 1, 2, 3, 7.",
              },
              {
                status:
                  400,
              }
            )
          );

        const {
          setUsageRefreshConfig,
        } =
          loadUsageApi();

        await expect(
          setUsageRefreshConfig(
            {
              intervalDays:
                4,
            }
          )
        ).rejects.toThrow(
          /intervalDays must be one of/
        );
      }
    );
  }
);
