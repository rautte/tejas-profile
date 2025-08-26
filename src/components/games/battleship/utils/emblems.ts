// src/components/games/battleship/utils/emblems.ts
import { ReactComponent as AnchorCrest } from "../../../../assets/svg/battleship-emblems/anchor-crest.svg";
import { ReactComponent as LifebuoyRope } from "../../../../assets/svg/battleship-emblems/lifebuoy-rope.svg";
import { ReactComponent as CompassShield } from "../../../../assets/svg/battleship-emblems/compass-shield.svg";
import { ReactComponent as TridentWaves } from "../../../../assets/svg/battleship-emblems/trident-waves.svg";
import { ReactComponent as HelmStar } from "../../../../assets/svg/battleship-emblems/helm-star.svg";

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
