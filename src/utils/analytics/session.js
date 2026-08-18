// src/utils/analytics/session.js

const VISITOR_KEY = "tp_visitor_id_v1";
const SESSION_KEY = "tp_session_id_v1";
const SESSION_TS_KEY = "tp_session_last_ts_v1";
const SESSION_TAB_OWNER_KEY = "tp_session_tab_owner_v1";

const INACTIVITY_MS = 30 * 60 * 1000; // 30 min
const HEARTBEAT_MS = 10 * 1000;       // 10s keepalive
const bc = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("tp_analytics") : null;

function randId(prefix) {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

function now() {
  return Date.now();
}

function getLS(k) {
  try { return localStorage.getItem(k) || ""; } catch { return ""; }
}
function setLS(k, v) {
  try { localStorage.setItem(k, v); } catch {}
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
  const id = getLS(SESSION_KEY);
  const last = Number(getLS(SESSION_TS_KEY) || 0);
  return { id, last };
}

function writeSession(id) {
  setLS(SESSION_KEY, id);
  setLS(SESSION_TS_KEY, String(now()));
}

export function getOrCreateSharedSessionId() {
  const { id, last } = readSession();
  const fresh = id && last && (now() - last) <= INACTIVITY_MS;
  if (fresh) {
    writeSession(id);
    return id;
  }
  const newId = randId("s");
  writeSession(newId);
  // announce to other tabs
  bc?.postMessage({ t: "session_new", sessionId: newId });
  return newId;
}

// Call once on app boot
export function startSharedSessionHeartbeat() {
  const tabId = randId("tab");
  setLS(SESSION_TAB_OWNER_KEY, tabId);

  // Listen for other tab session announcements
  bc?.addEventListener("message", (ev) => {
    const msg = ev?.data || {};
    if (msg.t === "session_new" && msg.sessionId) {
      // accept newer session if ours is stale
      const { id, last } = readSession();
      if (!id || !last || (now() - last) > INACTIVITY_MS) {
        writeSession(String(msg.sessionId));
      }
    }
  });

  // heartbeat keeps session alive while any tab is active
  const int = window.setInterval(() => {
    const { id } = readSession();
    if (id) setLS(SESSION_TS_KEY, String(now()));
  }, HEARTBEAT_MS);

  return () => window.clearInterval(int);
}
