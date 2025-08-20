// Minimal multiplayer façade + helpers

export type Role = "host" | "guest";
export type MPMode = "bot" | "mp";

export type MPEvent =
  | { t: "shot"; by: Role; r: number; c: number; ts: number }
  | { t: "result"; to: Role; result: "miss" | "hit" | "sunk"; r: number; c: number; ts: number }
  | { t: "phase"; phase: "place" | "play" | "over"; ts: number }
  | { t: "rematch"; ts: number }
  | { t: "hello"; by: Role; ts: number }
  // NEW: announce placement ready-state; carry who changed & the full state
  | { t: "ready"; by: Role; ready: { host: boolean; guest: boolean }; ts: number };

export type Snapshot = { events: MPEvent[] };

export interface MPAdapter {
  create(roomId: string): Promise<void>;
  join(roomId: string): Promise<void>;
  leave(roomId: string): Promise<void>;
  append(roomId: string, ev: MPEvent): Promise<void>;
  onSnapshot(roomId: string, cb: (snap: Snapshot) => void): () => void;
}

// ---- helpers ----
const ALPH = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O/I/L
export function generateCode(n = 4) {
  let s = "";
  for (let i = 0; i < n; i++) s += ALPH[Math.floor(Math.random() * ALPH.length)];
  return s;
}

export function parseRoomCodeFromHash(): string | null {
  // matches #/fun-zone/battleship-AX9G
  const h = (window.location.hash || "");
  const m = h.match(/^#\/fun-zone\/battleship-([A-Z0-9]{4})$/i);
  return m ? m[1].toUpperCase() : null;
}

export function buildInviteHash(code: string) {
  return `#/fun-zone/battleship-${code.toUpperCase()}`;
}

// lazy import Firebase adapter
export async function createFirebaseAdapter() {
  const mod = await import("./adapters/firebase");
  return mod.firebaseAdapter();
}

