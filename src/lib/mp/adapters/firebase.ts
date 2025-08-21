// src/lib/mp/adapters/firebase.ts
// -------------------------------------------------------------
// Firebase RTDB adapter for Battleship MP
// - Uses Realtime Database (RTDB) instead of Firestore
// - Epoch segmentation fixes the "late-join sees old match" bug
// - Pass-through of hello/bye/shot/result/phase/ready/quit/reveal/state
// - CRA-safe env resolver (no import.meta)
// -------------------------------------------------------------

import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import {
  getDatabase,
  Database,
  ref,
  push,
  onChildAdded,
  off,
  orderByKey,
  query as rtdbQuery,
  get,
  set,
  serverTimestamp,
} from "firebase/database";
import type { MPAdapter, MPEvent } from "../index";

// ------------------------------
// [CFG] CRA-safe config resolver
// ------------------------------
type FBClientCfg = {
  apiKey: string;
  projectId: string;
  appId: string;
  authDomain?: string;
  databaseURL?: string;
  storageBucket?: string;
  messagingSenderId?: string;
};

const ENV = (typeof process !== "undefined" ? (process as any).env : {}) || {};
const env = (k: string) =>
  ENV[`REACT_APP_FIREBASE_${k}`] ?? ENV[`VITE_FIREBASE_${k}`] ?? undefined;

function resolveFirebaseConfig(): FBClientCfg {
  // 1) Prefer runtime config injected via public/index.html (you already set window.__FIREBASE)
  const winCfg: Partial<FBClientCfg> =
    (typeof window !== "undefined" &&
      (((window as any).__FIREBASE as Partial<FBClientCfg>) ||
        (window as any).__FZ_FB__)) ||
    {};

  // 2) Fallback to .env (CRA/Vite)
  const envCfg: Partial<FBClientCfg> = {
    apiKey: env("API_KEY"),
    authDomain: env("AUTH_DOMAIN"),
    projectId: env("PROJECT_ID"),
    databaseURL: env("DATABASE_URL"),
    storageBucket: env("STORAGE_BUCKET"),
    messagingSenderId: env("MESSAGING_SENDER_ID"),
    appId: env("APP_ID"),
  };

  const cfg = { ...envCfg, ...winCfg } as Partial<FBClientCfg>;

  // [GUARD] Keys that must exist (RTDB works fine with these three)
  const required = ["apiKey", "projectId", "appId"] as const;
  const missing = required.filter((k) => !cfg[k]);
  if (missing.length) {
    throw new Error(
      `[Firebase config] Missing: ${missing.join(
        ", "
      )}. Provide window.__FIREBASE in public/index.html or .env values.`
    );
  }
  return cfg as FBClientCfg;
}

// ------------------------------
// [BOOT] Single init + getters
// ------------------------------
let _app: FirebaseApp | null = null;
let _db: Database | null = null;

function ensureFirebase() {
  if (!_app) {
    const cfg = resolveFirebaseConfig();
    _app = getApps()[0] || initializeApp(cfg); // [SAFE] no double-init
    _db = getDatabase(_app);
  }
  return { app: _app!, db: _db! };
}

// ------------------------------
// [RTDB paths & helpers]
// ------------------------------
const metaPath = (code: string) => `rooms/${code}/meta/state`; // { epoch: number }
const eventsPath = (code: string, epoch: number) => `rooms/${code}/epochs/${epoch}/events`;

// Publish an event under the current epoch (push key preserves time order)
async function publish(db: Database, code: string, epoch: number, e: MPEvent) {
  const evRef = ref(db, eventsPath(code, epoch));
  // Store both a server timestamp and a client time for debugging
  await push(evRef, { ...e, at: serverTimestamp(), atClient: Date.now() });
}

async function getOrInitEpoch(db: Database, code: string): Promise<number> {
  const mref = ref(db, metaPath(code));
  const snap = await get(mref);
  if (!snap.exists()) {
    await set(mref, { epoch: 0, createdAt: serverTimestamp() });
    return 0;
  }
  const val = snap.val() || {};
  return typeof val.epoch === "number" ? val.epoch : 0;
}

async function setEpoch(db: Database, code: string, n: number) {
  const mref = ref(db, metaPath(code));
  await set(mref, { epoch: n, updatedAt: serverTimestamp() });
}

// -------------------------------------------------------------
// Factory
// -------------------------------------------------------------
export function createFirebaseAdapter(): MPAdapter {
  const { db } = ensureFirebase();

  let roomCode = "";
  let currentEpoch = 0;
  let unsub: (() => void) | null = null;
  let onEvent: (e: MPEvent) => void = () => {};

  // Listen to events in a given epoch in push-key order
  function listenToEpoch(n: number) {
    if (unsub) {
        unsub();
        unsub = null;
    }

    const q = rtdbQuery(ref(db, eventsPath(roomCode, n)), orderByKey());

    // onChildAdded returns an unsubscribe function in v9
    const detach = onChildAdded(q, (snap) => {
        const data = snap.val() as any;
        // serverTimestamp resolves later; atClient is immediate
        const ev = { ...data, at: data?.atClient ?? Date.now() } as MPEvent;
        onEvent(ev);
    });

    // keep a single consolidated unsubscribe
    unsub = () => {
        detach();   // detach the listener
        off(q);     // extra safety: remove any remaining listeners on this ref/query
    };
    }

  return {
    async connect(code, _role, onEv) {
      roomCode = code.toUpperCase();
      onEvent = onEv;

      // Read or initialize epoch
      currentEpoch = await getOrInitEpoch(db, roomCode);

      // Subscribe to current epoch only
      listenToEpoch(currentEpoch);

      // UI will emit 'hello' explicitly after connect (keeps logic deterministic)
      return currentEpoch;
    },

    async send(e) {
      await publish(db, roomCode, currentEpoch, e);
    },

    async bumpEpoch() {
      // Host rotates to a fresh epoch after grace timeout
      const next = currentEpoch + 1;
      await setEpoch(db, roomCode, next);
      currentEpoch = next;

      // Rewire listener to the fresh epoch and announce it
      listenToEpoch(currentEpoch);
      await publish(db, roomCode, currentEpoch, { t: "epoch", n: currentEpoch, at: Date.now() } as MPEvent);
      return currentEpoch;
    },

    async leave() {
      if (unsub) {
        unsub();
        unsub = null;
      }
    },
  };
}

// Support both named and default imports
export default createFirebaseAdapter;
