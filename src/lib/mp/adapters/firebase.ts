// Very small Firebase Realtime Database adapter.
// 1) npm i firebase
// 2) put your keys in a <script> tag or env and pass here as needed.
//    For simplicity we read from window.__FIREBASE (optional).

import { initializeApp, getApps } from "firebase/app";
import {
  getDatabase, ref, set, push, onValue, off, get,
} from "firebase/database";
import type { MPAdapter, MPEvent, Snapshot } from "../index";

function ensureApp() {
  if (!getApps().length) {
    const cfg = (window as any).__FIREBASE || {
      apiKey: "YOUR_API_KEY",
      authDomain: "YOUR_AUTH_DOMAIN",
      databaseURL: "YOUR_DB_URL",
      projectId: "YOUR_PROJECT_ID",
      appId: "YOUR_APP_ID",
    };
    initializeApp(cfg);
  }
  return getDatabase();
}

export function firebaseAdapter(): MPAdapter {
  const db = ensureApp();

  return {
    async create(roomId) {
      const roomRef = ref(db, `rooms/${roomId}`);
      const snap = await get(roomRef);
      if (!snap.exists()) await set(roomRef, { events: [] });
    },
    async join(roomId) {
      // touch the room to ensure it exists
      const roomRef = ref(db, `rooms/${roomId}`);
      const snap = await get(roomRef);
      if (!snap.exists()) await set(roomRef, { events: [] });
    },
    async leave(_roomId) {
      // noop (no connection state we must tear down)
    },
    async append(roomId, ev: MPEvent) {
      const listRef = ref(db, `rooms/${roomId}/events`);
      const node = push(listRef);
      await set(node, ev);
    },
    onSnapshot(roomId, cb) {
      const roomRef = ref(db, `rooms/${roomId}`);
      const stop = onValue(roomRef, (s) => {
        const val = s.val() || { events: [] };
        const snap: Snapshot = { events: Array.isArray(val.events) ? val.events : Object.values(val.events || {}) };
        // sort by ts for determinism
        snap.events.sort((a: any, b: any) => (a.ts ?? 0) - (b.ts ?? 0));
        cb(snap);
      });
      return () => off(roomRef, "value", stop as any);
    },
  };
}
