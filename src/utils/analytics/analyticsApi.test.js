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
          parsed
            .searchParams
            .has(
              "profileVariantId"
            )
        ).toBe(false);

        expect(
          parsed
            .searchParams
            .has(
              "profileTargetingLocation"
            )
        ).toBe(false);

        expect(
          parsed
            .searchParams
            .has(
              "profileTargetingJobRole"
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
      "queryAnalyticsAgg sends exact runtime Profile filters",
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

          profileVariantId:
            "prv_A",

          profileTargetingLocation:
            "Austin, TX",

          profileTargetingJobRole:
            "Backend Software Engineer",

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
              "profileVersionId"
            )
        ).toBe(
          "pv_test"
        );

        expect(
          parsed
            .searchParams
            .get(
              "profileVariantId"
            )
        ).toBe(
          "prv_A"
        );

        expect(
          parsed
            .searchParams
            .get(
              "profileTargetingLocation"
            )
        ).toBe(
          "Austin, TX"
        );

        expect(
          parsed
            .searchParams
            .get(
              "profileTargetingJobRole"
            )
        ).toBe(
          "Backend Software Engineer"
        );

        expect(
          parsed
            .searchParams
            .has(
              "boundaryId"
            )
        ).toBe(false);
      }
    );


    test(
      "queryAnalyticsAgg sends canonical traffic classification",
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

          trafficClassification:
            "likely_automated",

          from:
            "2026-08-01",

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
          parsed.searchParams.get(
            "trafficClassification"
          )
        ).toBe(
          "likely_automated"
        );
      }
    );


    test(
      "queryAnalyticsAgg defaults Traffic to all and rejects unknown values before fetch",
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
          from:
            "2026-08-01",

          to:
            "2026-08-20",
        });


        const parsed =
          new URL(
            global.fetch
              .mock
              .calls[0][0]
          );


        expect(
          parsed.searchParams.get(
            "trafficClassification"
          )
        ).toBe(
          "all"
        );


        global.fetch
          .mockClear();


        await expect(
          queryAnalyticsAgg({
            trafficClassification:
              "definitely_a_robot",

            from:
              "2026-08-01",

            to:
              "2026-08-20",
          })
        ).rejects.toThrow(
          "trafficClassification must be"
        );


        expect(
          global.fetch
        ).not.toHaveBeenCalled();
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
      "lists CLOSED Usage Epochs through the owner archive API",
      async () => {
        global.fetch
          .mockResolvedValue(
            jsonResponse({
              ok:
                true,

              epochs:
                [],

              nextToken:
                "next-epoch",
            })
          );


        const {
          listUsageEpochs,
        } =
          loadAnalyticsApi();


        await listUsageEpochs({
          state:
            "CLOSED",

          limit:
            25,

          nextToken:
            "epoch-token",
        });


        const [
          url,
          options,
        ] =
          global.fetch
            .mock
            .calls[0];


        expect(url).toBe(
          "https://snapshots.example.test/usage-epochs/list?state=CLOSED&limit=25&nextToken=epoch-token"
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
      "configuration-scoped Usage Epoch history does not send a state selector",
      async () => {
        global.fetch
          .mockResolvedValue(
            jsonResponse({
              ok:
                true,

              epochs:
                [],
            })
          );


        const {
          listUsageEpochs,
        } =
          loadAnalyticsApi();


        await listUsageEpochs({
          deploymentConfigurationId:
            "cfg_archive",

          state:
            "CLOSED",

          limit:
            50,
        });


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
          "/usage-epochs/list"
        );

        expect(
          parsed.searchParams.get(
            "deploymentConfigurationId"
          )
        ).toBe(
          "cfg_archive"
        );

        expect(
          parsed.searchParams.has(
            "state"
          )
        ).toBe(false);
      }
    );


    test(
      "reads an immutable Configuration Analytics Report and verifies its Usage Epoch binding",
      async () => {
        global.fetch
          .mockResolvedValue(
            jsonResponse({
              ok:
                true,

              usageEpoch: {
                usageEpochId:
                  "uep_archive",

                report: {
                  reportId:
                    "car_archive",

                  reportSha256:
                    "abc123",
                },
              },

              reportSha256:
                "abc123",

              report: {
                reportId:
                  "car_archive",

                usageEpochId:
                  "uep_archive",
              },
            })
          );


        const {
          getConfigurationAnalyticsReport,
        } =
          loadAnalyticsApi();


        await getConfigurationAnalyticsReport({
          usageEpochId:
            "uep_archive",
        });


        expect(
          global.fetch
            .mock
            .calls[0][0]
        ).toBe(
          "https://snapshots.example.test/configuration-analytics-reports/get?usageEpochId=uep_archive"
        );
      }
    );


    test(
      "fails closed when immutable report response identity disagrees with its Usage Epoch",
      async () => {
        global.fetch
          .mockResolvedValue(
            jsonResponse({
              ok:
                true,

              usageEpoch: {
                usageEpochId:
                  "uep_expected",

                report: {
                  reportId:
                    "car_expected",

                  reportSha256:
                    "sha_expected",
                },
              },

              reportSha256:
                "sha_expected",

              report: {
                reportId:
                  "car_other",

                usageEpochId:
                  "uep_expected",
              },
            })
          );


        const {
          getConfigurationAnalyticsReport,
        } =
          loadAnalyticsApi();


        await expect(
          getConfigurationAnalyticsReport({
            usageEpochId:
              "uep_expected",
          })
        ).rejects.toThrow(
          "response identity does not match"
        );
      }
    );


    test(
      "getConfigurationAnalyticsReportsBatch posts deduplicated IDs and returns the scores",
      async () => {
        global.fetch
          .mockResolvedValue(
            jsonResponse({
              ok:
                true,

              scores: [
                {
                  usageEpochId:
                    "uep_one",

                  outreachScore: {
                    algorithm:
                      "outreach-score.v1",

                    score:
                      42,
                  },
                },
              ],
            })
          );


        const {
          getConfigurationAnalyticsReportsBatch,
        } =
          loadAnalyticsApi();


        const result =
          await getConfigurationAnalyticsReportsBatch(
            {
              usageEpochIds: [
                "uep_one",
                "uep_one",
                "  ",
              ],
            }
          );


        expect(
          result
        ).toEqual(
          [
            {
              usageEpochId:
                "uep_one",

              outreachScore: {
                algorithm:
                  "outreach-score.v1",

                score:
                  42,
              },
            },
          ]
        );


        const [
          url,
          options,
        ] =
          global
            .fetch
            .mock
            .calls[0];

        expect(url).toBe(
          "https://snapshots.example.test/configuration-analytics-reports/get-batch"
        );

        expect(
          JSON.parse(
            options.body
          )
        ).toEqual(
          {
            usageEpochIds: [
              "uep_one",
            ],
          }
        );
      }
    );


    test(
      "getConfigurationAnalyticsReportsBatch returns an empty array without calling fetch when given no IDs",
      async () => {
        const {
          getConfigurationAnalyticsReportsBatch,
        } =
          loadAnalyticsApi();


        const result =
          await getConfigurationAnalyticsReportsBatch(
            {
              usageEpochIds: [],
            }
          );


        expect(
          result
        ).toEqual(
          []
        );

        expect(
          global.fetch
        ).not
          .toHaveBeenCalled();
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