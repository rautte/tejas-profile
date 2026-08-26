import {
  OWNER_SESSION_EXPIRES_AT_KEY,
  OWNER_SESSION_KEY,
  OWNER_SESSION_TOKEN_KEY,
} from "../../config/owner";

import {
  clearOwnerBrowserSession,
  exchangeOwnerPasscodeForSession,
  isOwnerBrowserSessionActive,
  readOwnerSessionToken,
} from "./ownerSession";


describe(
  "browser owner session",
  () => {
    beforeEach(
      () => {
        sessionStorage.clear();

        global.fetch =
          jest.fn();
      }
    );


    afterEach(
      () => {
        sessionStorage.clear();

        jest.restoreAllMocks();

        delete global.fetch;
      }
    );


    test(
      "exchanges master passcode but persists only returned session credential",
      async () => {
        global.fetch
          .mockResolvedValue({
            ok:
              true,

            status:
              200,

            json:
              async () => ({
                ok:
                  true,

                sessionToken:
                  "tp1.session.signature",

                expiresAt:
                  "2100-01-01T00:00:00.000Z",

                expiresInSeconds:
                  3600,
              }),
          });


        await exchangeOwnerPasscodeForSession(
          "master-passcode",
          {
            apiBaseOverride:
              "https://api.example.test/",
          }
        );


        expect(
          global.fetch
        ).toHaveBeenCalledWith(
          "https://api.example.test/owner/session",
          {
            method:
              "POST",

            headers: {
              "content-type":
                "application/json",
            },

            body:
              JSON.stringify({
                passcode:
                  "master-passcode",
              }),

            cache:
              "no-store",
          }
        );


        expect(
          sessionStorage
            .getItem(
              OWNER_SESSION_KEY
            )
        ).toBe(
          "1"
        );


        expect(
          sessionStorage
            .getItem(
              OWNER_SESSION_TOKEN_KEY
            )
        ).toBe(
          "tp1.session.signature"
        );


        expect(
          Number(
            sessionStorage
              .getItem(
                OWNER_SESSION_EXPIRES_AT_KEY
              )
          )
        ).toBeGreaterThan(
          Date.now()
        );


        expect(
          sessionStorage
            .getItem(
              "tp_owner_token"
            )
        ).toBeNull();


        expect(
          Object.values(
            sessionStorage
          )
        ).not.toContain(
          "master-passcode"
        );
      }
    );


    test(
      "rejects bad passcode without persisting browser owner state",
      async () => {
        global.fetch
          .mockResolvedValue({
            ok:
              false,

            status:
              401,

            json:
              async () => ({
                ok:
                  false,

                error:
                  "Unauthorized",
              }),
          });


        await expect(
          exchangeOwnerPasscodeForSession(
            "wrong",
            {
              apiBaseOverride:
                "https://api.example.test",
            }
          )
        ).rejects.toThrow(
          "Unauthorized"
        );


        expect(
          sessionStorage
            .getItem(
              OWNER_SESSION_TOKEN_KEY
            )
        ).toBeNull();


        expect(
          sessionStorage
            .getItem(
              OWNER_SESSION_KEY
            )
        ).toBeNull();
      }
    );


    test(
      "expired session is rejected and cleared",
      () => {
        sessionStorage
          .setItem(
            OWNER_SESSION_KEY,
            "1"
          );

        sessionStorage
          .setItem(
            OWNER_SESSION_TOKEN_KEY,
            "tp1.expired.signature"
          );

        sessionStorage
          .setItem(
            OWNER_SESSION_EXPIRES_AT_KEY,
            "1000"
          );


        expect(
          readOwnerSessionToken({
            nowMs:
              2000,
          })
        ).toBe(
          ""
        );


        expect(
          isOwnerBrowserSessionActive({
            nowMs:
              2000,
          })
        ).toBe(
          false
        );


        expect(
          sessionStorage
            .getItem(
              OWNER_SESSION_TOKEN_KEY
            )
        ).toBeNull();
      }
    );


    test(
      "clears stale legacy browser master credential",
      () => {
        sessionStorage
          .setItem(
            "tp_owner_token",
            "legacy-master"
          );


        clearOwnerBrowserSession();


        expect(
          sessionStorage
            .getItem(
              "tp_owner_token"
            )
        ).toBeNull();
      }
    );
  }
);