import {
  createOwnerSessionToken,
  OWNER_SESSION_TTL_SECONDS,
  verifyOwnerSessionToken,
} from "../lambda/owner-session-auth";


describe(
  "owner session authentication contract",
  () => {
    const signingKey =
      "unit-test-owner-session-signing-key-0123456789";

    const now =
      Date.UTC(
        2026,
        7,
        25,
        5,
        0,
        0
      );


    test(
      "creates and verifies an exact stage-bound short-lived session",
      () => {
        const created =
          createOwnerSessionToken({
            stage:
              "dev",

            signingKey,

            nowMs:
              now,
          });


        expect(
          created.token
        ).toMatch(
          /^tp1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/
        );


        expect(
          created.expiresInSeconds
        ).toBe(
          OWNER_SESSION_TTL_SECONDS
        );


        const verified =
          verifyOwnerSessionToken({
            token:
              created.token,

            stage:
              "dev",

            signingKey,

            nowMs:
              now +
              1000,
          });


        expect(
          verified.ok
        ).toBe(
          true
        );
      }
    );


    test(
      "rejects wrong stage",
      () => {
        const created =
          createOwnerSessionToken({
            stage:
              "dev",

            signingKey,

            nowMs:
              now,
          });


        expect(
          verifyOwnerSessionToken({
            token:
              created.token,

            stage:
              "prod",

            signingKey,

            nowMs:
              now,
          }).ok
        ).toBe(
          false
        );
      }
    );


    test(
      "rejects tampering",
      () => {
        const created =
          createOwnerSessionToken({
            stage:
              "dev",

            signingKey,

            nowMs:
              now,
          });


        const tampered =
          `${created.token}x`;


        expect(
          verifyOwnerSessionToken({
            token:
              tampered,

            stage:
              "dev",

            signingKey,

            nowMs:
              now,
          }).ok
        ).toBe(
          false
        );
      }
    );


    test(
      "rejects expired sessions",
      () => {
        const created =
          createOwnerSessionToken({
            stage:
              "dev",

            signingKey,

            nowMs:
              now,
          });


        expect(
          verifyOwnerSessionToken({
            token:
              created.token,

            stage:
              "dev",

            signingKey,

            nowMs:
              now +
              (
                OWNER_SESSION_TTL_SECONDS +
                1
              ) *
              1000,
          }).ok
        ).toBe(
          false
        );
      }
    );


    test(
      "rejects a different signing key",
      () => {
        const created =
          createOwnerSessionToken({
            stage:
              "prod",

            signingKey,

            nowMs:
              now,
          });


        expect(
          verifyOwnerSessionToken({
            token:
              created.token,

            stage:
              "prod",

            signingKey:
              "different-signing-key",

            nowMs:
              now,
          }).ok
        ).toBe(
          false
        );
      }
    );
  }
);