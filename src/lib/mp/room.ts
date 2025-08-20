// src/lib/mp/room.ts
import type { MPAdapter, MPEvent, Role, Snapshot } from "./index";

export type RoomHandlers = {
  onShot?: (payload: { by: Role; r: number; c: number }) => void;
  onResult?: (payload: { to: Role; result: "miss" | "hit" | "sunk"; r: number; c: number }) => void;
  onPhase?: (phase: "place" | "play" | "over") => void;
  onRematch?: () => void;
  onPeerHello?: (by: Role) => void;
  onReady?: (payload: { by: Role; ready: boolean }) => void; // boolean
};

export class Room {
  private unsub: null | (() => void) = null;

  // (Optional) local aggregate state—useful for UI, but never sent on the wire
  private readyState: { host: boolean; guest: boolean } = { host: false, guest: false };

  constructor(
    private adapter: MPAdapter,
    private roomId: string,
    private role: Role,
    private handlers: RoomHandlers = {}
  ) {}

  async create() {
    await this.adapter.create(this.roomId);
    await this.adapter.append(this.roomId, { t: "hello", by: this.role, ts: Date.now() });
    this.watch();
  }

  async join() {
    await this.adapter.join(this.roomId);
    await this.adapter.append(this.roomId, { t: "hello", by: this.role, ts: Date.now() });
    this.watch();
  }

  leave() {
    if (this.unsub) this.unsub();
    this.unsub = null;
    return this.adapter.leave(this.roomId);
  }

  private watch() {
    if (this.unsub) this.unsub();
    this.unsub = this.adapter.onSnapshot(this.roomId, (snap: Snapshot) => {
      for (const ev of snap.events) this.dispatch(ev);
    });
  }

  private dispatch(ev: MPEvent) {
    switch (ev.t) {
      case "shot":
        this.handlers.onShot?.({ by: ev.by, r: ev.r, c: ev.c });
        break;
      case "result":
        this.handlers.onResult?.({ to: ev.to, result: ev.result, r: ev.r, c: ev.c });
        break;
      case "phase":
        this.handlers.onPhase?.(ev.phase);
        break;
      case "rematch":
        this.handlers.onRematch?.();
        break;
      case "hello":
        this.handlers.onPeerHello?.(ev.by);
        break;
      case "ready": {
        // maintain local aggregate (not required, but handy)
        this.readyState = {
          ...this.readyState,
          [ev.by]: ev.ready,
        };
        this.handlers.onReady?.({ by: ev.by, ready: ev.ready });
        break;
      }
    }
  }

  // ----- actions -----
  shot(by: Role, r: number, c: number) {
    return this.adapter.append(this.roomId, { t: "shot", by, r, c, ts: Date.now() });
  }
  result(to: Role, result: "miss" | "hit" | "sunk", r: number, c: number) {
    return this.adapter.append(this.roomId, { t: "result", to, result, r, c, ts: Date.now() });
  }
  phase(phase: "place" | "play" | "over") {
    return this.adapter.append(this.roomId, { t: "phase", phase, ts: Date.now() });
  }
  rematch() {
    // clear our local aggregate on rematch
    this.readyState = { host: false, guest: false };
    return this.adapter.append(this.roomId, { t: "rematch", ts: Date.now() });
  }
  ready(by: Role, ready: boolean) {
    return this.adapter.append(this.roomId, { t: "ready", by, ready, ts: Date.now() });
  }
}
