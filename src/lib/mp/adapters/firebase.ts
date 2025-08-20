// src/lib/mp/adapters/firebase.ts
import type { MPAdapter, MPEvent, Role, Snapshot } from "../index";
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  getDatabase, ref, child, set, get, push, onChildAdded, onDisconnect, off, Database, DatabaseReference, remove,
} from "firebase/database";

function ensureApp(): { app: FirebaseApp; db: Database } {
  if (!window || !(window as any).__FIREBASE) {
    throw new Error("Firebase config missing. Provide window.__FIREBASE in index.html.");
  }
  const cfg = (window as any).__FIREBASE;
  let app = getApps()[0] || initializeApp(cfg);
  const db = getDatabase(app);
  return { app, db };
}

type Unsub = () => void;

export function firebaseAdapter(): MPAdapter {
  const { db } = ensureApp();

  // per-adapter state
  let eventsUnsub: Unsub | null = null;
  let roomPath: string | null = null;
  let myRole: Role | null = null;
  let presenceRef: DatabaseReference | null = null;

  async function create(roomId: string) {
    roomPath = `/rooms/${roomId}`;
    const rRef = ref(db, roomPath);
    // stay idempotent: only set createdAt if missing
    const snap = await get(rRef);
    if (!snap.exists()) {
      await set(rRef, { createdAt: Date.now() });
    }
  }

  async function join(roomId: string) {
    roomPath = `/rooms/${roomId}`;
    const rRef = ref(db, roomPath);
    const snap = await get(rRef);
    if (!snap.exists()) throw new Error("ROOM_NOT_FOUND");
  }

  function leave(_roomId: string) {
    // cleanup listeners
    if (eventsUnsub) { eventsUnsub(); eventsUnsub = null; }
    // drop our presence immediately (onDisconnect covers crash cases)
    if (presenceRef) { remove(presenceRef).catch(()=>{}); presenceRef = null; }
    myRole = null;
    roomPath = null;
    return Promise.resolve();
  }

  async function append(roomId: string, ev: MPEvent) {
    if (!roomPath) roomPath = `/rooms/${roomId}`;

    // Enforce occupancy on "hello"
    if (ev.t === "hello") {
      myRole = ev.by;
      const pRef = ref(db, `${roomPath}/presence`);
      const pSnap = await get(pRef);
      const presence = (pSnap.exists() ? pSnap.val() : {}) as { host?: boolean; guest?: boolean };

      if (ev.by === "host" && presence.host) throw new Error("HOST_TAKEN");
      if (ev.by === "guest" && presence.guest) throw new Error("GUEST_TAKEN");

      // set presence and onDisconnect removal
      presenceRef = child(pRef, ev.by);
      await set(presenceRef, true);
      try { onDisconnect(presenceRef).remove(); } catch {}

      // NOTE: presence is independent of events stream; continue to push the event
    }

    // Normal event push
    const eRef = ref(db, `${roomPath}/events`);
    await push(eRef, ev);
  }

  function onSnapshot(roomId: string, cb: (snap: Snapshot) => void): Unsub {
    if (!roomPath) roomPath = `/rooms/${roomId}`;
    const eRef = ref(db, `${roomPath}/events`);

    // stream each new child as it arrives (avoids re-dispatch loops)
    const detach = onChildAdded(eRef, (snap) => {
      const v = snap.val() as MPEvent;
      cb({ events: [v] });
    });

    eventsUnsub = () => {
      off(eRef, "child_added", detach as any);
    };
    return eventsUnsub;
  }

  return {
    create,
    join,
    leave,
    append,
    onSnapshot,
  };
}
