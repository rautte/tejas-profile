import {
  OWNER_SESSION_EXPIRES_AT_KEY,
  OWNER_SESSION_KEY,
  OWNER_SESSION_TOKEN_KEY,
} from "../../config/owner";


const SNAPSHOTS_API =
  process.env
    .REACT_APP_SNAPSHOTS_API ||
  "";


/**
 * One-release cleanup for tabs that loaded the old
 * browser-master-token implementation.
 *
 * We never write this key.
 */
const LEGACY_OWNER_TOKEN_STORAGE_KEY =
  "tp_owner_token";


function apiBase(
  override
) {
  const value =
    String(
      override ||
      SNAPSHOTS_API ||
      ""
    )
      .trim()
      .replace(
        /\/+$/,
        ""
      );


  if (!value) {
    throw new Error(
      "Missing REACT_APP_SNAPSHOTS_API"
    );
  }


  return value;
}


function safeRemove(
  key
) {
  try {
    sessionStorage
      .removeItem(
        key
      );
  } catch {}
}


function clearLegacyMasterCredential() {
  safeRemove(
    LEGACY_OWNER_TOKEN_STORAGE_KEY
  );
}


export function clearOwnerBrowserSession() {
  safeRemove(
    OWNER_SESSION_KEY
  );

  safeRemove(
    OWNER_SESSION_TOKEN_KEY
  );

  safeRemove(
    OWNER_SESSION_EXPIRES_AT_KEY
  );

  clearLegacyMasterCredential();
}


export function readOwnerSessionExpiresAtMs() {
  try {
    const raw =
      sessionStorage
        .getItem(
          OWNER_SESSION_EXPIRES_AT_KEY
        );


    if (!raw) {
      return null;
    }


    const value =
      Number(
        raw
      );


    if (
      !Number.isFinite(
        value
      ) ||
      value <= 0
    ) {
      return null;
    }


    return value;
  } catch {
    return null;
  }
}


export function readOwnerSessionToken({
  nowMs =
    Date.now(),
} = {}) {
  clearLegacyMasterCredential();


  try {
    const enabled =
      sessionStorage
        .getItem(
          OWNER_SESSION_KEY
        ) ===
      "1";


    const token =
      String(
        sessionStorage
          .getItem(
            OWNER_SESSION_TOKEN_KEY
          ) ||
        ""
      ).trim();


    const expiresAtMs =
      readOwnerSessionExpiresAtMs();


    if (
      !enabled ||
      !token ||
      !expiresAtMs ||
      expiresAtMs <=
        Number(
          nowMs
        )
    ) {
      clearOwnerBrowserSession();

      return "";
    }


    return token;
  } catch {
    clearOwnerBrowserSession();

    return "";
  }
}


export function isOwnerBrowserSessionActive(
  options
) {
  return Boolean(
    readOwnerSessionToken(
      options
    )
  );
}


function persistOwnerSession({
  sessionToken,
  expiresAt,
}) {
  const token =
    String(
      sessionToken ||
      ""
    ).trim();


  const expiresAtMs =
    Date.parse(
      String(
        expiresAt ||
        ""
      )
    );


  if (!token) {
    throw new Error(
      "Owner session response did not include a session token."
    );
  }


  if (
    !Number.isFinite(
      expiresAtMs
    ) ||
    expiresAtMs <=
      Date.now()
  ) {
    throw new Error(
      "Owner session response contained an invalid expiry."
    );
  }


  clearOwnerBrowserSession();


  try {
    sessionStorage
      .setItem(
        OWNER_SESSION_TOKEN_KEY,
        token
      );

    sessionStorage
      .setItem(
        OWNER_SESSION_EXPIRES_AT_KEY,
        String(
          expiresAtMs
        )
      );

    sessionStorage
      .setItem(
        OWNER_SESSION_KEY,
        "1"
      );
  } catch (e) {
    clearOwnerBrowserSession();

    throw e;
  }


  return {
    sessionToken:
      token,

    expiresAt:
      new Date(
        expiresAtMs
      ).toISOString(),

    expiresAtMs,
  };
}


export async function exchangeOwnerPasscodeForSession(
  passcode,
  {
    fetchImpl,
    apiBaseOverride,
  } = {}
) {
  const normalizedPasscode =
    String(
      passcode ||
      ""
    ).trim();


  if (!normalizedPasscode) {
    throw new Error(
      "Enter a passcode"
    );
  }


  const request =
    fetchImpl ||
    (
        typeof fetch ===
        "function"
        ? fetch
        : null
    );


  if (
    typeof request !==
    "function"
  ) {
    throw new Error(
      "Fetch is unavailable."
    );
  }


  const response =
    await request(
      `${apiBase(
        apiBaseOverride
      )}/owner/session`,
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
              normalizedPasscode,
          }),

        cache:
          "no-store",
      }
    );


  const json =
    await response
      .json()
      .catch(
        () => ({})
      );


  if (
    !response.ok ||
    json?.ok !== true
  ) {
    clearOwnerBrowserSession();


    const error =
      new Error(
        json?.error ||
        `Owner authentication failed (${response.status}).`
      );


    error.status =
      response.status;


    throw error;
  }


  return persistOwnerSession({
    sessionToken:
      json.sessionToken,

    expiresAt:
      json.expiresAt,
  });
}