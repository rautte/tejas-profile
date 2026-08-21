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


function loadAnalyticsApi({
  owner = true,
} = {}) {
  jest.resetModules();

  process.env
    .REACT_APP_SNAPSHOTS_API =
    "https://snapshots.example.test/";

  process.env
    .REACT_APP_ANALYTICS_INGEST_API =
    "https://edge.example.test/";

  const {
    OWNER_SESSION_KEY,
    OWNER_TOKEN_KEY,
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
        OWNER_TOKEN_KEY,
        "test-owner-token"
      );
  }

  return require(
    "./analyticsApi"
  );
}


describe(
  "analyticsApi",
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
      "queryAnalyticsAgg omits boundaryId for All history",
      async () => {
        global.fetch
          .mockResolvedValue(
            jsonResponse({
              ok: true,
              overview: {},
            })
          );

        const {
          queryAnalyticsAgg,
        } =
          loadAnalyticsApi();

        await queryAnalyticsAgg({
          profileVersionId:
            "pv_test",

          boundaryId:
            "all",

          from:
            "2026-08-01",

          to:
            "2026-08-20",
        });

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

        const parsed =
          new URL(url);

        expect(
          parsed.origin
        ).toBe(
          "https://snapshots.example.test"
        );

        expect(
          parsed.pathname
        ).toBe(
          "/analytics/query"
        );

        expect(
          parsed
            .searchParams
            .get(
              "profileVersionId"
            )
        ).toBe(
          "pv_test"
        );

        expect(
          parsed
            .searchParams
            .has(
              "boundaryId"
            )
        ).toBe(false);

        expect(
          options.method
        ).toBe("GET");

        expect(
          options
            .headers[
              "x-owner-token"
            ]
        ).toBe(
          "test-owner-token"
        );
      }
    );


    test(
      "queryAnalyticsAgg sends a specific boundary",
      async () => {
        global.fetch
          .mockResolvedValue(
            jsonResponse({
              ok: true,
              overview: {},
            })
          );

        const {
          queryAnalyticsAgg,
        } =
          loadAnalyticsApi();

        await queryAnalyticsAgg({
          profileVersionId:
            "pv_test",

          boundaryId:
            "reset-123",

          from:
            "2026-08-20",

          to:
            "2026-08-20",
        });

        const [
          url,
        ] =
          global.fetch
            .mock
            .calls[0];

        const parsed =
          new URL(url);

        expect(
          parsed
            .searchParams
            .get(
              "boundaryId"
            )
        ).toBe(
          "reset-123"
        );
      }
    );


    test(
      "queryAnalyticsMeta uses the direct owner API",
      async () => {
        global.fetch
          .mockResolvedValue(
            jsonResponse({
              ok: true,
              releases: [],
              boundaries: [],
            })
          );

        const {
          queryAnalyticsMeta,
        } =
          loadAnalyticsApi();

        await queryAnalyticsMeta();

        const [
          url,
          options,
        ] =
          global.fetch
            .mock
            .calls[0];

        expect(url).toBe(
          "https://snapshots.example.test/analytics/meta"
        );

        expect(
          options.method
        ).toBe("GET");

        expect(
          options.cache
        ).toBe(
          "no-store"
        );

        expect(
          options
            .headers[
              "x-owner-token"
            ]
        ).toBe(
          "test-owner-token"
        );
      }
    );


    test(
      "createAnalyticsBoundary POSTs reset metadata to the direct owner API",
      async () => {
        global.fetch
          .mockResolvedValue(
            jsonResponse({
              ok: true,

              boundary: {
                boundaryId:
                  "reset-test",
              },
            })
          );

        const {
          createAnalyticsBoundary,
        } =
          loadAnalyticsApi();

        await createAnalyticsBoundary({
          boundaryId:
            "reset-test",

          type:
            "reset",

          effectiveAt:
            123456789,

          note:
            "test reset",
        });

        const [
          url,
          options,
        ] =
          global.fetch
            .mock
            .calls[0];

        expect(url).toBe(
          "https://snapshots.example.test/analytics/boundaries"
        );

        expect(
          options.method
        ).toBe("POST");

        expect(
          options
            .headers[
              "x-owner-token"
            ]
        ).toBe(
          "test-owner-token"
        );

        expect(
          JSON.parse(
            options.body
          )
        ).toEqual({
          boundaryId:
            "reset-test",

          type:
            "reset",

          effectiveAt:
            123456789,

          note:
            "test reset",
        });
      }
    );


    test(
      "public ingest uses the analytics edge URL",
      async () => {
        global.fetch
          .mockResolvedValue(
            jsonResponse(
              null,
              {
                status: 204,
              }
            )
          );

        const {
          ingestAnalyticsBatch,
        } =
          loadAnalyticsApi({
            owner: false,
          });

        await ingestAnalyticsBatch({
          events: [
            {
              eventId:
                "event-1",
            },
          ],
        });

        const [
          url,
          options,
        ] =
          global.fetch
            .mock
            .calls[0];

        expect(url).toBe(
          "https://edge.example.test/analytics/ingest"
        );

        expect(
          options.method
        ).toBe("POST");

        expect(
          options.keepalive
        ).toBe(true);

        expect(
          options.headers[
            "x-owner-token"
          ]
        ).toBeUndefined();
      }
    );


    test(
      "owner-only queries fail closed without Owner Mode",
      async () => {
        const {
          queryAnalyticsMeta,
        } =
          loadAnalyticsApi({
            owner: false,
          });

        await expect(
          queryAnalyticsMeta()
        ).rejects.toThrow(
          "Owner mode is required"
        );

        expect(
          global.fetch
        ).not
          .toHaveBeenCalled();
      }
    );
  }
);