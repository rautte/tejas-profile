import {
  verifyOwnerSessionToken,
} from "../lambda/owner-session-auth";


const LOGIN_PASSCODE =
  "owner-session-api-login-passcode";


const SIGNING_KEY =
  "owner-session-api-signing-key-0123456789";


let handler:
  any;


function event(
  body:
    any
) {
  return {
    rawPath:
      "/owner/session",

    requestContext: {
      http: {
        method:
          "POST",

        path:
          "/owner/session",
      },
    },

    headers: {
      origin:
        "http://localhost:3000",

      "content-type":
        "application/json",
    },

    queryStringParameters:
      null,

    body:
      JSON.stringify(
        body
      ),
  };
}


function parsed(
  response:
    any
) {
  return JSON.parse(
    String(
      response?.body ||
      "{}"
    )
  );
}


describe(
  "owner browser session API",
  () => {
    beforeAll(
      () => {
        jest.resetModules();

        process.env
          .OWNER_LOGIN_PASSCODE =
          LOGIN_PASSCODE;

        process.env
          .OWNER_SESSION_SIGNING_KEY =
          SIGNING_KEY;

        process.env
          .STAGE =
          "dev";

        process.env
          .ALLOWED_ORIGINS =
          "http://localhost:3000";


        handler =
          require(
            "../lambda/snapshots-handler"
          ).handler;
      }
    );


    afterAll(
      () => {
        delete process.env
          .OWNER_LOGIN_PASSCODE;

        delete process.env
          .OWNER_SESSION_SIGNING_KEY;

        delete process.env
          .STAGE;

        delete process.env
          .ALLOWED_ORIGINS;
      }
    );


    test(
      "exchanges the login passcode for a short-lived signed session",
      async () => {
        const response =
          await handler(
            event({
              passcode:
                LOGIN_PASSCODE,
            })
          );


        expect(
          response.statusCode
        ).toBe(
          200
        );


        const body =
          parsed(
            response
          );


        expect(
          body.ok
        ).toBe(
          true
        );


        expect(
          body.sessionToken
        ).toMatch(
          /^tp1\./
        );


        expect(
          typeof body.expiresAt
        ).toBe(
          "string"
        );


        expect(
          body.expiresInSeconds
        ).toBe(
          3600
        );


        const verification =
          verifyOwnerSessionToken({
            token:
              body.sessionToken,

            stage:
              "dev",

            signingKey:
              SIGNING_KEY,
          });


        expect(
          verification.ok
        ).toBe(
          true
        );


        expect(
          response.body
        ).not.toContain(
          LOGIN_PASSCODE
        );
      }
    );


    test(
      "rejects an incorrect login passcode",
      async () => {
        const response =
          await handler(
            event({
              passcode:
                "wrong-passcode",
            })
          );


        expect(
          response.statusCode
        ).toBe(
          401
        );


        expect(
          parsed(
            response
          )
        ).toEqual({
          ok:
            false,

          error:
            "Unauthorized",
        });
      }
    );


    test(
      "rejects a missing passcode",
      async () => {
        const response =
          await handler(
            event({})
          );


        expect(
          response.statusCode
        ).toBe(
          400
        );
      }
    );
  }
);