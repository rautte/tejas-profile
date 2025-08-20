// src/lib/mp/index.ts

export type Role = "host" | "guest";
export type MPMode = "bot" | "mp";

export type MPEvent =
  | { t: "shot"; by: Role; r: number; c: number; ts: number }
  | { t: "result"; to: Role; result: "miss" | "hit" | "sunk"; r: number; c: number; ts: number }
  | { t: "phase"; phase: "place" | "play" | "over"; ts: number }
  // legacy rematch (no payload) — keep for backwards compat
  | { t: "rematch"; ts: number }
  // structured rematch handshake
  | { t: "rematch"; action: "propose" | "accept" | "decline"; by: Role; ts: number }
  // explicit quit
  | { t: "quit"; by: Role; ts: number }
  // session reset marker
  | { t: "epoch"; n: number; ts: number }
  // presence / greetings
  | { t: "hello"; by: Role; ts: number }
  // ✅ ADD: readiness signal
  | { t: "ready"; by: Role; ready: boolean; ts: number }
  // ✅ ADD: optional peer-leave marker (only if your adapter emits it)
  | { t: "bye"; by: Role; ts: number }
  | { t: "reveal"; by: Role; grid: number[][]; fleet: Record<string, any>; ts: number };

export type Snapshot = { events: MPEvent[] };

export interface MPAdapter {
  create(roomId: string): Promise<void>;
  join(roomId: string): Promise<void>;
  leave(roomId: string): Promise<void>;
  append(roomId: string, ev: MPEvent): Promise<void>;
  onSnapshot(roomId: string, cb: (snap: Snapshot) => void): () => void;
}

// ---- helpers ----
const ALPH = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export function generateCode(n = 4) {
  let s = "";
  for (let i = 0; i < n; i++) s += ALPH[Math.floor(Math.random() * ALPH.length)];
  return s;
}

export function parseRoomCodeFromHash(): string | null {
  // Accept:
  //   #/fun-zone/battleship-ABCD
  //   #/fun-zone/battleship-abcd
  //   #/fun-zone/battleship-abcd/        (trailing slash)
  //   #/fun-zone/battleship-abcd?x=y     (accidental params after hash)
  //   #/FUN-ZONE/BATTLESHIP-ABCD         (any case)
  const h = window.location.hash || "";
  const m = h.match(/#\/fun-zone\/battleship-([A-Z0-9]{4})(?:[/?].*)?$/i);
  return m ? m[1].toUpperCase() : null;
}

export function buildInviteHash(code: string) {
  return `#/fun-zone/battleship-${code.toUpperCase()}`;
}

export async function createFirebaseAdapter(): Promise<MPAdapter> {
  const mod = await import("./adapters/firebase");
  return mod.firebaseAdapter();
}
