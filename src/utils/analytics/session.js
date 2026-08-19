// src/utils/analytics/session.js

const VISITOR_KEY = "tp_visitor_id_v1";
const SESSION_KEY = "tp_session_id_v2";
const SESSION_LAST_ACTIVITY_KEY = "tp_session_last_activity_v2";
const SESSION_START_CLAIM_KEY = "tp_session_start_claim_v2";

const INACTIVITY_MS = 30 * 60 * 1000; // 30 minutes
const HEARTBEAT_MS = 15 * 1000;       // only while foreground + focused
const ACTIVITY_WRITE_THROTTLE_MS = 5 * 1000;

function randId(prefix) {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

function now() {
  return Date.now();
}

function getLS(key) {
  try {
    return localStorage.getItem(key) || "";
  } catch {
    return "";
  }
}

function setLS(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}

function isDocumentActive() {
  if (typeof document === "undefined") return false;

  if (document.visibilityState !== "visible") {
    return false;
  }

  if (
    typeof document.hasFocus === "function" &&
    !document.hasFocus()
  ) {
    return false;
  }

  return true;
}

export function getVisitorId() {
  let id = getLS(VISITOR_KEY);

  if (!id) {
    id = randId("v");
    setLS(VISITOR_KEY, id);
  }

  return id;
}

function readSession() {
  return {
    id: getLS(SESSION_KEY),
    lastActivity: Number(getLS(SESSION_LAST_ACTIVITY_KEY) || 0),
  };
}

function writeSession(id, timestamp = now()) {
  setLS(SESSION_KEY, id);
  setLS(SESSION_LAST_ACTIVITY_KEY, String(timestamp));
}

function ensureSession() {
  const timestamp = now();
  const { id, lastActivity } = readSession();

  const fresh =
    Boolean(id) &&
    Boolean(lastActivity) &&
    timestamp - lastActivity <= INACTIVITY_MS;

  if (fresh) {
    writeSession(id, timestamp);

    return {
      sessionId: id,
      isNew: false,
    };
  }

  const sessionId = randId("s");

  writeSession(sessionId, timestamp);

  return {
    sessionId,
    isNew: true,
  };
}

/**
 * Returns the logical browser session shared across tabs.
 *
 * Calling this represents meaningful analytics activity, so the
 * session's last-active timestamp is refreshed.
 */
export function getOrCreateSharedSessionId() {
  return ensureSession().sessionId;
}

/**
 * Prevent multiple tabs / refreshes from intentionally emitting
 * duplicate session_start events for the same logical session.
 *
 * Phase 3 will ALSO dedupe sessions server-side, so correctness
 * never depends solely on this client-side claim.
 */
export function claimSessionStart(sessionId) {
  const id = String(sessionId || "").trim();

  if (!id) return false;

  const claimed = getLS(SESSION_START_CLAIM_KEY);

  if (claimed === id) {
    return false;
  }

  setLS(SESSION_START_CLAIM_KEY, id);
  return true;
}

/**
 * Keeps a session alive only while at least this tab is genuinely active.
 *
 * Hidden/background tabs DO NOT keep sessions alive indefinitely.
 */
export function startSharedSessionHeartbeat({
  onSessionChanged,
} = {}) {
  let stopped = false;
  let lastObservedSessionId = readSession().id || "";
  let lastActivityWrite = 0;

  const touch = (force = false) => {
    if (stopped) return;
    if (!isDocumentActive()) return;

    const timestamp = now();

    if (
      !force &&
      timestamp - lastActivityWrite < ACTIVITY_WRITE_THROTTLE_MS
    ) {
      return;
    }

    lastActivityWrite = timestamp;

    const { sessionId, isNew } = ensureSession();

    if (
      sessionId &&
      (isNew ||
        (lastObservedSessionId &&
          sessionId !== lastObservedSessionId))
    ) {
      onSessionChanged?.(sessionId);
    }

    lastObservedSessionId = sessionId;
  };

  const onVisibilityChange = () => {
    if (document.visibilityState === "visible") {
      touch(true);
    }
  };

  const onFocus = () => touch(true);
  const onActivity = () => touch(false);

  document.addEventListener(
    "visibilitychange",
    onVisibilityChange
  );

  window.addEventListener("focus", onFocus);
  window.addEventListener("pointerdown", onActivity, {
    passive: true,
  });
  window.addEventListener("keydown", onActivity);
  window.addEventListener("touchstart", onActivity, {
    passive: true,
  });
  window.addEventListener("scroll", onActivity, {
    passive: true,
    capture: true,
  });

  const intervalId = window.setInterval(
    () => touch(true),
    HEARTBEAT_MS
  );

  return () => {
    stopped = true;

    window.clearInterval(intervalId);

    document.removeEventListener(
      "visibilitychange",
      onVisibilityChange
    );

    window.removeEventListener("focus", onFocus);
    window.removeEventListener("pointerdown", onActivity);
    window.removeEventListener("keydown", onActivity);
    window.removeEventListener("touchstart", onActivity);
    window.removeEventListener("scroll", onActivity, true);
  };
}