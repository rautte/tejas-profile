import {
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";


export const OWNER_SESSION_TTL_SECONDS =
  60 * 60;


const OWNER_SESSION_TOKEN_PREFIX =
  "tp1";


const OWNER_SESSION_TYPE =
  "owner_session";


const OWNER_SESSION_VERSION =
  1;


const MAX_CLOCK_SKEW_SECONDS =
  30;


type OwnerSessionPayload = {
  v:
    number;

  typ:
    string;

  stage:
    string;

  iat:
    number;

  exp:
    number;

  nonce:
    string;
};


export type OwnerSessionVerification =
  | {
      ok:
        true;

      payload:
        OwnerSessionPayload;
    }
  | {
      ok:
        false;

      reason:
        string;
    };


function encodeBase64Url(
  value:
    string |
    Buffer
) {
  return Buffer
    .from(
      value
    )
    .toString(
      "base64url"
    );
}


function signatureFor(
  signingInput:
    string,

  signingKey:
    string
) {
  return createHmac(
    "sha256",
    signingKey
  )
    .update(
      signingInput,
      "utf8"
    )
    .digest();
}


function signaturesMatch(
  actualEncoded:
    string,

  expected:
    Buffer
) {
  let actual:
    Buffer;


  try {
    actual =
      Buffer.from(
        actualEncoded,
        "base64url"
      );
  } catch {
    return false;
  }


  if (
    actual.length !==
    expected.length
  ) {
    return false;
  }


  return timingSafeEqual(
    actual,
    expected
  );
}


function normalizedStage(
  stage:
    unknown
) {
  const value =
    String(
      stage ??
      ""
    ).trim();


  if (
    value !== "dev" &&
    value !== "prod"
  ) {
    throw new Error(
      "Owner session stage must be dev or prod."
    );
  }


  return value;
}


function normalizedSigningKey(
  signingKey:
    unknown
) {
  const value =
    String(
      signingKey ??
      ""
    ).trim();


  if (!value) {
    throw new Error(
      "Owner session signing key is required."
    );
  }


  return value;
}


export function createOwnerSessionToken({
  stage,
  signingKey,
  nowMs =
    Date.now(),
}: {
  stage:
    "dev" |
    "prod";

  signingKey:
    string;

  nowMs?:
    number;
}) {
  const normalized =
    normalizedStage(
      stage
    );


  const key =
    normalizedSigningKey(
      signingKey
    );


  const iat =
    Math.floor(
      Number(
        nowMs
      ) /
      1000
    );


  if (
    !Number.isFinite(
      iat
    )
  ) {
    throw new Error(
      "Owner session issue time is invalid."
    );
  }


  const exp =
    iat +
    OWNER_SESSION_TTL_SECONDS;


  const payload:
    OwnerSessionPayload = {
      v:
        OWNER_SESSION_VERSION,

      typ:
        OWNER_SESSION_TYPE,

      stage:
        normalized,

      iat,

      exp,

      nonce:
        randomBytes(
          16
        ).toString(
          "base64url"
        ),
    };


  const payloadEncoded =
    encodeBase64Url(
      JSON.stringify(
        payload
      )
    );


  const signingInput =
    `${OWNER_SESSION_TOKEN_PREFIX}.${payloadEncoded}`;


  const signature =
    signatureFor(
      signingInput,
      key
    ).toString(
      "base64url"
    );


  return {
    token:
      `${signingInput}.${signature}`,

    expiresAt:
      new Date(
        exp *
        1000
      ).toISOString(),

    expiresInSeconds:
      OWNER_SESSION_TTL_SECONDS,

    payload,
  };
}


export function verifyOwnerSessionToken({
  token,
  stage,
  signingKey,
  nowMs =
    Date.now(),
}: {
  token:
    string;

  stage:
    "dev" |
    "prod";

  signingKey:
    string;

  nowMs?:
    number;
}):
  OwnerSessionVerification {
  const raw =
    String(
      token ??
      ""
    ).trim();


  if (!raw) {
    return {
      ok:
        false,

      reason:
        "missing",
    };
  }


  let expectedStage:
    string;


  let key:
    string;


  try {
    expectedStage =
      normalizedStage(
        stage
      );

    key =
      normalizedSigningKey(
        signingKey
      );
  } catch {
    return {
      ok:
        false,

      reason:
        "configuration",
    };
  }


  const parts =
    raw.split(
      "."
    );


  if (
    parts.length !== 3 ||
    parts[0] !==
      OWNER_SESSION_TOKEN_PREFIX
  ) {
    return {
      ok:
        false,

      reason:
        "format",
    };
  }


  const [
    prefix,
    payloadEncoded,
    signatureEncoded,
  ] =
    parts;


  const signingInput =
    `${prefix}.${payloadEncoded}`;


  const expectedSignature =
    signatureFor(
      signingInput,
      key
    );


  if (
    !signaturesMatch(
      signatureEncoded,
      expectedSignature
    )
  ) {
    return {
      ok:
        false,

      reason:
        "signature",
    };
  }


  let payload:
    OwnerSessionPayload;


  try {
    payload =
      JSON.parse(
        Buffer.from(
          payloadEncoded,
          "base64url"
        ).toString(
          "utf8"
        )
      );
  } catch {
    return {
      ok:
        false,

      reason:
        "payload",
    };
  }


  if (
    !payload ||
    payload.v !==
      OWNER_SESSION_VERSION ||
    payload.typ !==
      OWNER_SESSION_TYPE ||
    payload.stage !==
      expectedStage ||
    !Number.isInteger(
      payload.iat
    ) ||
    !Number.isInteger(
      payload.exp
    ) ||
    typeof payload.nonce !==
      "string" ||
    !payload.nonce
  ) {
    return {
      ok:
        false,

      reason:
        "claims",
    };
  }


  if (
    payload.exp <=
    payload.iat ||
    (
      payload.exp -
      payload.iat
    ) >
      OWNER_SESSION_TTL_SECONDS
  ) {
    return {
      ok:
        false,

      reason:
        "ttl",
    };
  }


  const now =
    Math.floor(
      Number(
        nowMs
      ) /
      1000
    );


  if (
    !Number.isFinite(
      now
    )
  ) {
    return {
      ok:
        false,

      reason:
        "clock",
    };
  }


  if (
    payload.iat >
      now +
      MAX_CLOCK_SKEW_SECONDS
  ) {
    return {
      ok:
        false,

      reason:
        "future",
    };
  }


  if (
    payload.exp <=
    now
  ) {
    return {
      ok:
        false,

      reason:
        "expired",
    };
  }


  return {
    ok:
      true,

    payload,
  };
}