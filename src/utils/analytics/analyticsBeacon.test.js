// src/utils/analytics/analyticsBeacon.test.js

describe(
  "analytics navigation beacon",
  () => {
    const originalBeacon =
      navigator.sendBeacon;

    beforeEach(() => {
      jest.resetModules();

      process.env.REACT_APP_ANALYTICS_INGEST_API =
        "https://analytics.example.test";
    });

    afterEach(() => {
      Object.defineProperty(
        navigator,
        "sendBeacon",
        {
          configurable: true,
          value: originalBeacon,
        }
      );
    });

    test(
      "queues public analytics through sendBeacon",
      () => {
        const sendBeacon =
          jest.fn(() => true);

        Object.defineProperty(
          navigator,
          "sendBeacon",
          {
            configurable: true,
            value: sendBeacon,
          }
        );

        const {
          sendAnalyticsBatchBeacon,
        } =
          require(
            "./analyticsApi"
          );

        const result =
          sendAnalyticsBatchBeacon({
            events: [
              {
                eventId: "event-1",
                type: "cta_click",
              },
            ],
          });

        expect(result).toBe(true);

        expect(
          sendBeacon
        ).toHaveBeenCalledTimes(1);

        expect(
          sendBeacon.mock.calls[0][0]
        ).toBe(
          "https://analytics.example.test/analytics/ingest"
        );

        expect(
          sendBeacon.mock.calls[0][1]
        ).toBeInstanceOf(Blob);
      }
    );

    test(
      "fails closed when sendBeacon is unavailable",
      () => {
        Object.defineProperty(
          navigator,
          "sendBeacon",
          {
            configurable: true,
            value: undefined,
          }
        );

        const {
          sendAnalyticsBatchBeacon,
        } =
          require(
            "./analyticsApi"
          );

        expect(
          sendAnalyticsBatchBeacon({
            events: [],
          })
        ).toBe(false);
      }
    );
  }
);