// infra/cdk/test/owner-passcode-change-api.test.ts

import {
  createHash,
} from "node:crypto";


const mockDynamoSend =
  jest.fn();

const mockSecretsManagerSend =
  jest.fn();

const mockSesSend =
  jest.fn();


jest.mock(
  "@aws-sdk/client-dynamodb",
  () => {
    const actual: any =
      jest.requireActual(
        "@aws-sdk/client-dynamodb"
      );

    return {
      ...actual,

      DynamoDBClient:
        jest.fn(
          () => ({
            send:
              mockDynamoSend,
          })
        ),
    };
  }
);


jest.mock(
  "@aws-sdk/client-secrets-manager",
  () => {
    const actual: any =
      jest.requireActual(
        "@aws-sdk/client-secrets-manager"
      );

    return {
      ...actual,

      SecretsManagerClient:
        jest.fn(
          () => ({
            send:
              mockSecretsManagerSend,
          })
        ),
    };
  }
);


jest.mock(
  "@aws-sdk/client-sesv2",
  () => {
    const actual: any =
      jest.requireActual(
        "@aws-sdk/client-sesv2"
      );

    return {
      ...actual,

      SESv2Client:
        jest.fn(
          () => ({
            send:
              mockSesSend,
          })
        ),
    };
  }
);


const OWNER_TOKEN =
  "owner-passcode-change-test-master-token";

const LOGIN_PASSCODE_SECRET_ID =
  "owner-login-passcode-secret-id";

const VERIFICATION_TABLE =
  "owner-passcode-verification-test-table";

const NOTIFICATION_EMAIL =
  "owner@example.com";


let handler: any;


function sha256Hex(
  value: string
) {
  return createHash("sha256")
    .update(
      value,
      "utf8"
    )
    .digest(
      "hex"
    );
}


function parsedBody(
  response: any
) {
  return JSON.parse(
    response.body
  );
}


function requestChangeEvent() {
  return {
    requestContext: {
      http: {
        method:
          "POST",

        path:
          "/owner/passcode/request-change",
      },
    },

    rawPath:
      "/owner/passcode/request-change",

    headers: {
      "x-owner-token":
        OWNER_TOKEN,
    },

    body:
      "{}",
  };
}


function confirmChangeEvent({
  code,
  newPasscode,
}: {
  code: string;
  newPasscode: string;
}) {
  return {
    requestContext: {
      http: {
        method:
          "POST",

        path:
          "/owner/passcode/confirm-change",
      },
    },

    rawPath:
      "/owner/passcode/confirm-change",

    headers: {
      "x-owner-token":
        OWNER_TOKEN,
    },

    body:
      JSON.stringify(
        {
          code,
          newPasscode,
        }
      ),
  };
}


function unmarshalledItem(
  putItemCall: any
) {
  const { unmarshall } =
    jest.requireActual(
      "@aws-sdk/util-dynamodb"
    );

  return unmarshall(
    putItemCall
      .input
      .Item
  );
}


describe(
  "Owner passcode change API",
  () => {
    beforeAll(
      async () => {
        process.env.OWNER_TOKEN =
          OWNER_TOKEN;

        process.env.OWNER_LOGIN_PASSCODE_SECRET_ID =
          LOGIN_PASSCODE_SECRET_ID;

        process.env.OWNER_PASSCODE_VERIFICATION_TABLE =
          VERIFICATION_TABLE;

        process.env.OWNER_NOTIFICATION_EMAIL =
          NOTIFICATION_EMAIL;

        process.env.STAGE =
          "dev";

        process.env.ALLOWED_ORIGINS =
          "";

        jest.resetModules();

        (
          {
            handler,
          } = await import(
            "../lambda/snapshots-handler"
          )
        );
      }
    );


    beforeEach(
      () => {
        mockDynamoSend.mockReset();
        mockSecretsManagerSend.mockReset();
        mockSesSend.mockReset();

        mockSesSend.mockResolvedValue(
          {}
        );

        mockSecretsManagerSend.mockResolvedValue(
          {}
        );
      }
    );


    afterAll(
      () => {
        delete process.env.OWNER_TOKEN;
        delete process.env.OWNER_LOGIN_PASSCODE_SECRET_ID;
        delete process.env.OWNER_PASSCODE_VERIFICATION_TABLE;
        delete process.env.OWNER_NOTIFICATION_EMAIL;
        delete process.env.STAGE;
        delete process.env.ALLOWED_ORIGINS;
      }
    );


    test(
      "requesting a change code stores only a hash of it and emails the plaintext code to the fixed owner address",
      async () => {
        mockDynamoSend.mockImplementation(
          (
            command: any
          ) => {
            if (
              command.constructor.name ===
              "GetItemCommand"
            ) {
              return Promise.resolve(
                {}
              );
            }

            return Promise.resolve(
              {}
            );
          }
        );

        const response =
          await handler(
            requestChangeEvent()
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
        ).toEqual(
          {
            ok: true,
            expiresInSeconds: 600,
          }
        );

        const putItemCall =
          mockDynamoSend.mock.calls
            .map(
              (
                call: any
              ) =>
                call[0]
            )
            .find(
              (
                command: any
              ) =>
                command.constructor.name ===
                "PutItemCommand"
            );

        expect(
          putItemCall
        ).toBeTruthy();

        const storedItem =
          unmarshalledItem(
            putItemCall
          );

        expect(
          storedItem.pk
        ).toBe(
          "OWNER_PASSCODE_CHANGE#dev"
        );

        expect(
          storedItem.sk
        ).toBe(
          "PENDING"
        );

        expect(
          storedItem.attempts
        ).toBe(
          0
        );

        expect(
          typeof storedItem.ttl
        ).toBe(
          "number"
        );

        const emailCall =
          mockSesSend.mock.calls[0][0];

        expect(
          emailCall.input.FromEmailAddress
        ).toBe(
          NOTIFICATION_EMAIL
        );

        expect(
          emailCall.input.Destination.ToAddresses
        ).toEqual(
          [
            NOTIFICATION_EMAIL,
          ]
        );

        const emailBody =
          emailCall.input.Content.Simple.Body.Text.Data as string;

        const match =
          emailBody.match(
            /\b(\d{6})\b/
          );

        expect(
          match
        ).toBeTruthy();

        const emailedCode =
          match![1];

        // The hash actually stored must match the plaintext code
        // that was actually emailed -- not just "some hash".
        expect(
          storedItem.codeHash
        ).toBe(
          sha256Hex(
            emailedCode
          )
        );
      }
    );


    test(
      "requesting a change code within 60 seconds of a previous request is rate-limited",
      async () => {
        mockDynamoSend.mockImplementation(
          (
            command: any
          ) => {
            if (
              command.constructor.name ===
              "GetItemCommand"
            ) {
              const { marshall } =
                jest.requireActual(
                  "@aws-sdk/util-dynamodb"
                );

              return Promise.resolve(
                {
                  Item:
                    marshall(
                      {
                        pk:
                          "OWNER_PASSCODE_CHANGE#dev",

                        sk:
                          "PENDING",

                        codeHash:
                          "irrelevant",

                        createdAt:
                          new Date().toISOString(),

                        attempts:
                          0,

                        ttl:
                          Math.floor(
                            Date.now() /
                              1000
                          ) +
                          600,
                      }
                    ),
                }
              );
            }

            return Promise.resolve(
              {}
            );
          }
        );

        const response =
          await handler(
            requestChangeEvent()
          );

        expect(
          response.statusCode
        ).toBe(
          429
        );

        expect(
          mockSesSend
        ).not.toHaveBeenCalled();

        const body =
          JSON.parse(
            response.body
          );

        expect(
          body.retryAfterSeconds
        ).toBeGreaterThan(
          0
        );

        expect(
          body.retryAfterSeconds
        ).toBeLessThanOrEqual(
          60
        );
      }
    );


    test(
      "confirming with the correct code rotates the login passcode secret and clears the pending record",
      async () => {
        const plainCode =
          "482913";

        mockDynamoSend.mockImplementation(
          (
            command: any
          ) => {
            if (
              command.constructor.name ===
              "GetItemCommand"
            ) {
              const { marshall } =
                jest.requireActual(
                  "@aws-sdk/util-dynamodb"
                );

              return Promise.resolve(
                {
                  Item:
                    marshall(
                      {
                        pk:
                          "OWNER_PASSCODE_CHANGE#dev",

                        sk:
                          "PENDING",

                        codeHash:
                          sha256Hex(
                            plainCode
                          ),

                        createdAt:
                          new Date().toISOString(),

                        attempts:
                          0,

                        ttl:
                          Math.floor(
                            Date.now() /
                              1000
                          ) +
                          600,
                      }
                    ),
                }
              );
            }

            return Promise.resolve(
              {}
            );
          }
        );

        const response =
          await handler(
            confirmChangeEvent(
              {
                code:
                  plainCode,

                newPasscode:
                  "a-brand-new-strong-passcode",
              }
            )
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
        ).toEqual(
          {
            ok: true,
          }
        );

        const putSecretCall =
          mockSecretsManagerSend.mock.calls
            .map(
              (
                call: any
              ) =>
                call[0]
            )
            .find(
              (
                command: any
              ) =>
                command.constructor.name ===
                "PutSecretValueCommand"
            );

        expect(
          putSecretCall.input.SecretId
        ).toBe(
          LOGIN_PASSCODE_SECRET_ID
        );

        expect(
          putSecretCall.input.SecretString
        ).toBe(
          "a-brand-new-strong-passcode"
        );

        const deleteItemCall =
          mockDynamoSend.mock.calls
            .map(
              (
                call: any
              ) =>
                call[0]
            )
            .find(
              (
                command: any
              ) =>
                command.constructor.name ===
                "DeleteItemCommand"
            );

        expect(
          deleteItemCall
        ).toBeTruthy();
      }
    );


    test(
      "confirming with an incorrect code increments attempts, returns 401, and never touches the secret",
      async () => {
        mockDynamoSend.mockImplementation(
          (
            command: any
          ) => {
            if (
              command.constructor.name ===
              "GetItemCommand"
            ) {
              const { marshall } =
                jest.requireActual(
                  "@aws-sdk/util-dynamodb"
                );

              return Promise.resolve(
                {
                  Item:
                    marshall(
                      {
                        pk:
                          "OWNER_PASSCODE_CHANGE#dev",

                        sk:
                          "PENDING",

                        codeHash:
                          sha256Hex(
                            "999999"
                          ),

                        createdAt:
                          new Date().toISOString(),

                        attempts:
                          0,

                        ttl:
                          Math.floor(
                            Date.now() /
                              1000
                          ) +
                          600,
                      }
                    ),
                }
              );
            }

            return Promise.resolve(
              {}
            );
          }
        );

        const response =
          await handler(
            confirmChangeEvent(
              {
                code:
                  "111111",

                newPasscode:
                  "a-brand-new-strong-passcode",
              }
            )
          );

        expect(
          response.statusCode
        ).toBe(
          401
        );

        expect(
          mockSecretsManagerSend
        ).not.toHaveBeenCalled();

        const putItemCall =
          mockDynamoSend.mock.calls
            .map(
              (
                call: any
              ) =>
                call[0]
            )
            .find(
              (
                command: any
              ) =>
                command.constructor.name ===
                "PutItemCommand"
            );

        expect(
          unmarshalledItem(
            putItemCall
          ).attempts
        ).toBe(
          1
        );
      }
    );


    test(
      "confirming after 5 failed attempts deletes the pending record and returns 429",
      async () => {
        mockDynamoSend.mockImplementation(
          (
            command: any
          ) => {
            if (
              command.constructor.name ===
              "GetItemCommand"
            ) {
              const { marshall } =
                jest.requireActual(
                  "@aws-sdk/util-dynamodb"
                );

              return Promise.resolve(
                {
                  Item:
                    marshall(
                      {
                        pk:
                          "OWNER_PASSCODE_CHANGE#dev",

                        sk:
                          "PENDING",

                        codeHash:
                          sha256Hex(
                            "999999"
                          ),

                        createdAt:
                          new Date().toISOString(),

                        attempts:
                          5,

                        ttl:
                          Math.floor(
                            Date.now() /
                              1000
                          ) +
                          600,
                      }
                    ),
                }
              );
            }

            return Promise.resolve(
              {}
            );
          }
        );

        const response =
          await handler(
            confirmChangeEvent(
              {
                code:
                  "999999",

                newPasscode:
                  "a-brand-new-strong-passcode",
              }
            )
          );

        expect(
          response.statusCode
        ).toBe(
          429
        );

        expect(
          mockSecretsManagerSend
        ).not.toHaveBeenCalled();

        expect(
          mockDynamoSend.mock.calls
            .map(
              (
                call: any
              ) =>
                call[0]
            )
            .some(
              (
                command: any
              ) =>
                command.constructor.name ===
                "DeleteItemCommand"
            )
        ).toBe(
          true
        );
      }
    );


    test(
      "confirming without a pending request returns 400",
      async () => {
        mockDynamoSend.mockResolvedValue(
          {}
        );

        const response =
          await handler(
            confirmChangeEvent(
              {
                code:
                  "123456",

                newPasscode:
                  "a-brand-new-strong-passcode",
              }
            )
          );

        expect(
          response.statusCode
        ).toBe(
          400
        );

        expect(
          mockSecretsManagerSend
        ).not.toHaveBeenCalled();
      }
    );


    test(
      "rejects a new passcode shorter than 12 characters before touching storage",
      async () => {
        const response =
          await handler(
            confirmChangeEvent(
              {
                code:
                  "123456",

                newPasscode:
                  "short",
              }
            )
          );

        expect(
          response.statusCode
        ).toBe(
          400
        );

        expect(
          mockDynamoSend
        ).not.toHaveBeenCalled();

        expect(
          mockSecretsManagerSend
        ).not.toHaveBeenCalled();
      }
    );
  }
);
