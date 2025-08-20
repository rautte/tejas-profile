// RTDB adapter (Firebase v9 modular)
import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import {
  getDatabase,
  ref,
  set,
  push,
  onValue,
  off,
  DataSnapshot,
  Database,
} from "firebase/database";
import type { MPAdapter, MPEvent, Snapshot } from "../index";

// Read config from a global injected by your HTML (or wherever you put it)
type FirebaseConfig = {
  apiKey: string;
  authDomain?: string;
  databaseURL: string;
  projectId?: string;
  appId?: string;
};

function ensureApp(): { app: FirebaseApp; db: Database } {
  // @ts-ignore
  const cfg: FirebaseConfig | undefined = (window as any).__FIREBASE;
  if (!cfg?.databaseURL) {
    throw new Error(
      "Missing window.__FIREBASE.databaseURL (example: https://your-project-id-default-rtdb.firebaseio.com)"
    );
  }
  const app = getApps().length ? getApps()[0] : initializeApp(cfg);
  const db = getDatabase(app);
  return { app, db };
}

function sortEventsSnap(s: DataSnapshot): MPEvent[] {
  const val = s.val() as Record<string, MPEvent> | null;
  if (!val) return [];
  // Children are random push IDs; stable order by key ensures consistent append order
  return Object.keys(val)
    .sort()
    .map((k) => val[k]);
}

export function firebaseAdapter(): MPAdapter {
  const { db } = ensureApp();

  return {
    async create(roomId: string) {
      await set(ref(db, `rooms/${roomId}/meta`), { created: Date.now() });
      // events list is created lazily by push()
    },

    async join(_roomId: string) {
      // You can set presence if you want; not required for gameplay
      return;
    },

    async leave(_roomId: string) {
      // No-op; we’re not removing rooms or presence here
      return;
    },

    async append(roomId: string, ev: MPEvent) {
      await push(ref(db, `rooms/${roomId}/events`), ev);
    },

    onSnapshot(roomId: string, cb: (snap: Snapshot) => void) {
      const eventsRef = ref(db, `rooms/${roomId}/events`);
      const unsubscribe = onValue(eventsRef, (snap) => {
        const events = sortEventsSnap(snap);
        cb({ events });
      });
      // Return unsubscriber compatible with our Room.watch()
      return () => {
        try {
          off(eventsRef, "value", unsubscribe as any);
        } catch {
          // onValue already returns an unsubscribe; call it too
          try {
            (unsubscribe as unknown as () => void)();
          } catch {}
        }
      };
    },
  };
}
