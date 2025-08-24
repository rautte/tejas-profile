// src/components/games/battleship/utils/emblems.ts
import { ReactComponent as AnchorCrest } from "../../../../assets/anchor-crest.svg";
import { ReactComponent as LifebuoyRope } from "../../../../assets/lifebuoy-rope.svg";
import { ReactComponent as CompassShield } from "../../../../assets/compass-shield.svg";
import { ReactComponent as TridentWaves } from "../../../../assets/trident-waves.svg";
import { ReactComponent as HelmStar } from "../../../../assets/helm-star.svg";

export const EMBLEMS = [AnchorCrest, LifebuoyRope, CompassShield, TridentWaves, HelmStar] as const;

export function hashSeed(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export type EmblemIcon = (typeof EMBLEMS)[number];
