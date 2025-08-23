// src/components/games/battleship/BattleshipWeb.tsx

import React from "react";
import ReactDOM from "react-dom";

import { ReactComponent as AnchorCrest } from "../../../assets/anchor-crest.svg";
import { ReactComponent as LifebuoyRope } from "../../../assets/lifebuoy-rope.svg";
import { ReactComponent as CompassShield } from "../../../assets/compass-shield.svg";
import { ReactComponent as TridentWaves } from "../../../assets/trident-waves.svg";
import { ReactComponent as HelmStar } from "../../../assets/helm-star.svg";

import {
  SIZE, FLEET_SIZES, Orientation,
  Grid, Shots, Fleet,
  makeGrid, makeShots, randomFleet,
  placeShip, canPlace, receiveShot, allSunk,
  makeAIState, aiPick, aiOnHit,
} from "lib/battleship";

import {
  MPMode, Role, generateCode, parseRoomCodeFromHash, buildInviteHash,
  createFirebaseAdapter,
} from "lib/mp";
import { Room } from "lib/mp/room";

/* ----------------- Icons & small UI helpers ----------------- */

const IconSignal: React.FC<React.SVGProps<SVGSVGElement>> = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
       strokeLinecap="round" strokeLinejoin="round" width="1em" height="1em" {...p}>
    <path d="M2 20a10 10 0 0 1 20 0" />
    <path d="M6 20a6 6 0 0 1 12 0" />
    <path d="M10 20a2 2 0 0 1 4 0" />
  </svg>
);

const IconLink: React.FC<React.SVGProps<SVGSVGElement>> = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
       strokeLinecap="round" strokeLinejoin="round" width="1em" height="1em" {...p}>
    <path d="M10 13a5 5 0 0 0 7.07 0l1.17-1.17a5 5 0 0 0-7.07-7.07L9.9 5"/>
    <path d="M14 11a5 5 0 0 0-7.07 0L5.76 12.2a5 5 0 0 0 7.07 7.07L14.1 19"/>
  </svg>
);

const IconCpu: React.FC<React.SVGProps<SVGSVGElement>> = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
       strokeLinecap="round" strokeLinejoin="round" width="1em" height="1em" {...p}>
    <rect x="6" y="6" width="12" height="12" rx="2"/>
    <path d="M9 1v3M15 1v3M9 20v3M15 20v3M1 9h3M1 15h3M20 9h3M20 15h3"/>
  </svg>
);

const HitMark = () => (
  <svg viewBox="0 0 100 100" className="w-2/3 h-2/3 text-rose-500 dark:text-rose-300">
    <line x1="20" y1="20" x2="80" y2="80" stroke="currentColor" strokeWidth="12" strokeLinecap="round" />
    <line x1="80" y1="20" x2="20" y2="80" stroke="currentColor" strokeWidth="12" strokeLinecap="round" />
  </svg>
);
const MissMark = () => (
  <svg viewBox="0 0 100 100" className="w-1/3 h-1/3 text-gray-500 dark:text-gray-400">
    <circle cx="50" cy="50" r="15" stroke="currentColor" strokeWidth="8" fill="none" />
  </svg>
);

/* ----------------- Styling constants ----------------- */

// const cellBase =
//   "relative aspect-square rounded-md ring-1 transition select-none " +
//   "ring-gray-300 dark:ring-white/10 bg-gray-100 dark:bg-gray-800 " +
//   "hover:bg-gray-200 dark:hover:bg-gray-700 flex items-center justify-center";

const cellBase =
  "relative aspect-square transition select-none flex items-center justify-center " +
  "ring-0 bg-transparent rounded-[10px] " +                     // no per-cell border/fill
  "hover:bg-black/[0.1] dark:hover:bg-white/[0.1]";  

// width for the single placement grid (MP only)
const PLACE_GRID_WIDTH = "min(92vw, 520px)";
// left/right rail width (same on both sides) — tweak this to scale the center board
const SIDE_RAIL_PX = 350; // was 320
const RIGHT_FLEET_MAXW = 300; // px (try 260–320)
const SHELL_MAXW = "min(1360px, calc(100vw - 96px))";

// watermark: keep edges from touching cards
const WATERMARK_SAFE_INSET = -240;

/* ----------------- Signal Deck (radio-style intel log) ----------------- */

type IntelLine = {
  id: number;
  t: number;
  voice: "CIC" | "Ops" | "Gunnery";
  text: string;
  flavor?: boolean;
};

const SignalDeck: React.FC<{
  role: Role;
  Icon: React.FunctionComponent<React.SVGProps<SVGSVGElement>>;
  roleLabel: Role;
  log: IntelLine[];
}> = ({ role, Icon, roleLabel, log }) => {
  const wrapRef = React.useRef<HTMLDivElement>(null);

  // auto-scroll to newest line
  React.useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [log]);

  const bubbleBgClass = role === "host" ? "bg-blue-600/10" : "bg-emerald-600/10";

  return (
    <div
      className="
        relative overflow-hidden
        rounded-2xl p-3
        bg-white/[0.08] dark:bg-white/[0.045]
        backdrop-blur-xl backdrop-saturate-150
        border border-white/15 dark:border-white/[0.06]
        ring-1 ring-white/[0.06] dark:ring-black/[0.25]
        shadow-lg
      "
    >
      {/* sheen */}
      <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-white/20 via-white/10 to-transparent dark:from-gray-800/50 dark:via-gray-900/30 dark:to-transparent" />

      {/* header */}
      <div className="relative z-10 flex items-center gap-2 pb-2">
        <span className={`inline-flex items-center justify-center rounded-full ring-1 ring-black/10 dark:ring-white/10 ${bubbleBgClass}`} style={{ width: 24, height: 24 }}>
          <Icon width={18} height={18} aria-hidden />
        </span>
        <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">
          Signal Deck <span className="ml-1 text-xs font-normal text-gray-500 dark:text-gray-400">({roleLabel})</span>
        </div>
      </div>

      {/* log */}
      <div
        ref={wrapRef}
        className="
          relative z-10 mt-1 pr-1
          max-h-[20vh] overflow-y-auto
          text-[13px] leading-5 text-gray-800 dark:text-gray-100
          scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent
        "
        aria-live="polite"
        aria-label="Signal Deck messages"
      >
        {log.length === 0 ? (
          <div className="text-xs text-gray-500 dark:text-gray-400">CIC link standing by…</div>
        ) : (
          <ul className="space-y-1.5">
            {log.map((ln) => (
              <li key={ln.id} className="flex gap-3">
                <span className="w-16 shrink-0 text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  {ln.voice}
                </span>
                <span className={ln.flavor ? "text-gray-700 dark:text-gray-200" : ""}>{ln.text}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

/* ----------------- Naval Compass (full metallic + printed dial text) ----------------- */

type CompassDir = "N" | "E" | "S" | "W";

const NavalCompass: React.FC<{
  dir: CompassDir;
  canInteract: boolean;
  onChoose: (d: CompassDir) => void;
  Emblem?: React.FunctionComponent<React.SVGProps<SVGSVGElement>>;
}> = ({ dir, canInteract, onChoose, Emblem: EmblemIcon }) => { 
  const initialDirRef = React.useRef<CompassDir>(dir);
  const [localDir, setLocalDir] = React.useState<CompassDir>(initialDirRef.current);
  const [tick, setTick] = React.useState(0);
  const uid = React.useId();
  const id = (s: string) => `${uid}-${s}`;

  // cycle
  const order: CompassDir[] = ["N", "E", "S", "W"];
  const nextDir = (d: CompassDir): CompassDir => order[(order.indexOf(d) + 1) % order.length];

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!canInteract) return;
      if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        const nd = nextDir(localDir);
        setLocalDir(nd);
        onChoose(nd);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canInteract, localDir, onChoose]);

  const baseAngle = localDir === "N" ? 0 : localDir === "E" ? 90 : localDir === "S" ? 180 : -90;

  React.useEffect(() => {
    if (canInteract) return;
    let raf: number | null = null;
    const loop = () => { setTick(Date.now()); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => { if (raf) cancelAnimationFrame(raf); };
  }, [canInteract]);

  const wobble = canInteract ? 0 : Math.sin(tick / 600) * 5;
  const angle = baseAngle + wobble;

  // palette (unchanged)
  const ring  = "stroke-black/10 dark:stroke-white/10";
  const tickC = "stroke-gray-500 dark:stroke-gray-400";
  const textFill = "fill-gray-700 dark:fill-gray-200";

  const size = 200;
  const cx = size / 2, cy = size / 2, r = 80;

  // button ring pos (unchanged)
  const R_PCT = ((r + 18) / size) * 100;
  const BTN_GAP_PX = 6;

  const DirButton: React.FC<{
    d: CompassDir; style: React.CSSProperties; centerX?: boolean; centerY?: boolean;
  }> = ({ d, style, centerX, centerY }) => (
    <button
      type="button"
      onClick={canInteract ? () => { setLocalDir(d); onChoose(d); } : undefined}
      disabled={!canInteract}
      className={[
        "absolute px-2 py-1 rounded-md text-xs font-semibold",
        centerX ? "-translate-x-1/2" : "",
        centerY ? "-translate-y-1/2" : "",
        "ring-1 ring-black/10 dark:ring-white/10",
        localDir === d
          ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900"
          : "bg-white/80 text-gray-800 dark:bg-gray-700 dark:text-gray-100",
        canInteract ? "cursor-pointer hover:opacity-90" : "cursor-not-allowed opacity-70",
      ].join(" ")}
      style={style}
      aria-label={`Point ${d}`}
    >
      {d}
    </button>
  );

  return (
    // background kept transparent; shadow is handled inside SVG so only the round compass casts it
    <div className="relative mx-auto w-full max-w-[190px] mb-3 select-none bg-transparent" aria-label="Naval compass">
      {/* Direction buttons (unchanged) */}
      <DirButton d="N" centerX centerY style={{ top: `calc(50% - ${R_PCT}% - ${BTN_GAP_PX}px)`, left: "50%" }} />
      <DirButton d="E" centerX centerY style={{ top: "50%", left: `calc(50% + ${R_PCT}% + ${BTN_GAP_PX}px)` }} />
      <DirButton d="S" centerX centerY style={{ top: `calc(50% + ${R_PCT}% + ${BTN_GAP_PX}px)`, left: "50%" }} />
      <DirButton d="W" centerX centerY style={{ top: "50%", left: `calc(50% - ${R_PCT}% - ${BTN_GAP_PX}px)` }} />

      <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-auto" style={{ overflow: "visible" }}>
        {/* ==== metallic gradients & filters ==== */}
        <defs>
          {/* Bezel (metal) */}
          <linearGradient id={id("bezelLight")} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stopColor="#f3f4f6"/>
            <stop offset="25%"  stopColor="#e5e7eb"/>
            <stop offset="55%"  stopColor="#cdd3da"/>
            <stop offset="80%"  stopColor="#b9c0c9"/>
            <stop offset="100%" stopColor="#98a2ad"/>
          </linearGradient>
          <linearGradient id={id("bezelDark")} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stopColor="rgba(255,255,255,0.25)"/>
            <stop offset="40%"  stopColor="rgba(255,255,255,0.12)"/>
            <stop offset="100%" stopColor="rgba(255,255,255,0.06)"/>
          </linearGradient>
          <radialGradient id={id("bezelSheenL")} cx="30%" cy="28%" r="65%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.55)"/>
            <stop offset="35%" stopColor="rgba(255,255,255,0.20)"/>
            <stop offset="100%" stopColor="rgba(255,255,255,0)"/>
          </radialGradient>
          <radialGradient id={id("bezelSheenD")} cx="30%" cy="28%" r="65%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.28)"/>
            <stop offset="35%" stopColor="rgba(255,255,255,0.12)"/>
            <stop offset="100%" stopColor="rgba(255,255,255,0)"/>
          </radialGradient>

          {/* Dial (brushed metal) */}
          <radialGradient id={id("dialL")} cx="50%" cy="45%" r="65%">
            <stop offset="0%"   stopColor="#f7f7f7"/>
            <stop offset="55%"  stopColor="#e5e7eb"/>
            <stop offset="100%" stopColor="#cbd5e1"/>
          </radialGradient>
          <radialGradient id={id("dialD")} cx="50%" cy="50%" r="65%">
            <stop offset="0%"   stopColor="#2a2f36"/>
            <stop offset="60%"  stopColor="#20242a"/>
            <stop offset="100%" stopColor="#151922"/>
          </radialGradient>
          {/* Brushed effect — CLIPPED to SourceAlpha so it can't extend past the circle */}
          <filter id={id("brushed")} x="-10%" y="-10%" width="120%" height="120%">
            <feTurbulence type="fractalNoise" baseFrequency="0.8 0.03" numOctaves="1" seed="3" result="n"/>
            <feGaussianBlur in="n" stdDeviation="0.6" result="nb"/>
            <feColorMatrix in="nb" type="saturate" values="0.2" result="nbs"/>
            <feComponentTransfer in="nbs" result="na">
              <feFuncA type="table" tableValues="0 0.12"/>
            </feComponentTransfer>

            {/* blend noise onto the dial graphics */}
            <feBlend mode="multiply" in="SourceGraphic" in2="na" result="mul"/>

            {/* NEW: clip the blended result to the dial's shape */}
            <feComposite in="mul" in2="SourceAlpha" operator="in"/>
          </filter>

          {/* Inner ring metallic stroke */}
          <linearGradient id={id("ringStrokeL")} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#bfc7d1"/>
            <stop offset="50%" stopColor="#eef0f3"/>
            <stop offset="100%" stopColor="#a1aab5"/>
          </linearGradient>
          <linearGradient id={id("ringStrokeD")} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#94a3b8"/>
            <stop offset="50%" stopColor="#e5e7eb"/>
            <stop offset="100%" stopColor="#64748b"/>
          </linearGradient>

          {/* Needles (colored metal) */}
          <linearGradient id={id("roseMetalL")} x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%"   stopColor="#ffd1d6"/>
            <stop offset="45%"  stopColor="#fb7185"/>
            <stop offset="75%"  stopColor="#dc3b52"/>
            <stop offset="100%" stopColor="#a61935"/>
          </linearGradient>
          {/* DARK MODE NEEDLES — darker, more metallic */}
          <linearGradient id={id("roseMetalD")} x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%"   stopColor="#fde2e4"/>
            <stop offset="45%"  stopColor="#f27386"/>
            <stop offset="75%"  stopColor="#b91c1c"/>
            <stop offset="100%" stopColor="#5b0f19"/>
          </linearGradient>
          <linearGradient id={id("blueMetalL")} x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%"   stopColor="#dbeafe"/>
            <stop offset="45%"  stopColor="#93c5fd"/>
            <stop offset="75%"  stopColor="#3b82f6"/>
            <stop offset="100%" stopColor="#1e3a8a"/>
          </linearGradient>
          {/* DARK MODE NEEDLES — deeper navy */}
          <linearGradient id={id("blueMetalD")} x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%"   stopColor="#dbeafe"/>
            <stop offset="45%"  stopColor="#60a5fa"/>
            <stop offset="75%"  stopColor="#1d4ed8"/>
            <stop offset="100%" stopColor="#0b255f"/>
          </linearGradient>

          {/* Hub (metallic cap) */}
          <radialGradient id={id("hubL")} cx="50%" cy="45%" r="60%">
            <stop offset="0%"   stopColor="#ffffff"/>
            <stop offset="55%"  stopColor="#e5e7eb"/>
            <stop offset="100%" stopColor="#cbd5e1"/>
          </radialGradient>
          <radialGradient id={id("hubD")} cx="50%" cy="45%" r="60%">
            <stop offset="0%"   stopColor="#e5e7eb"/>
            <stop offset="55%"  stopColor="#9ca3af"/>
            <stop offset="100%" stopColor="#111827"/>
          </radialGradient>

          {/* Printed dial text: slight ink bleed for realism */}
          <filter id={id("printBleed")} x="-5%" y="-5%" width="110%" height="110%">
            <feGaussianBlur stdDeviation="0.25" />
          </filter>

          {/* SHAPE-ONLY SHADOW (approx Tailwind shadow-lg) */}
          <filter id={id("compassShadow")} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="8" stdDeviation="6" flood-color="#000000" flood-opacity="0.35" />
          </filter>
        </defs>

        {/* Wrap all shapes so only the circle casts a shadow (not the rectangular box) */}
        <g filter={`url(#${id("compassShadow")})`}>
          {/* Bezel */}
          <circle cx={cx} cy={cy} r={r + 18} className="dark:hidden" fill={`url(#${id("bezelLight")})`} />
          <circle cx={cx} cy={cy} r={r + 18} className="hidden dark:block" fill={`url(#${id("bezelDark")})`} />
          <circle cx={cx} cy={cy} r={r + 18} className="pointer-events-none dark:hidden" fill={`url(#${id("bezelSheenL")})`} />
          <circle cx={cx} cy={cy} r={r + 18} className="pointer-events-none hidden dark:block" fill={`url(#${id("bezelSheenD")})`} />

          {/* Dial (brushed metal) */}
          <circle cx={cx} cy={cy} r={r + 6} className="dark:hidden" fill={`url(#${id("dialL")})`} filter={`url(#${id("brushed")})`} />
          <circle cx={cx} cy={cy} r={r + 6} className="hidden dark:block" fill={`url(#${id("dialD")})`} filter={`url(#${id("brushed")})`} />

          {/* Inner ring (metallic stroke) */}
          <circle cx={cx} cy={cy} r={r} className={ring} fill="none" strokeWidth={2.2} stroke={`url(#${id("ringStrokeL")})`} />
          <circle cx={cx} cy={cy} r={r} className={`hidden dark:inline ${ring}`} fill="none" strokeWidth={2.2} stroke={`url(#${id("ringStrokeD")})`} />

          {/* Ticks */}
          {[...Array(60)].map((_, i) => {
            const a = (i * 6) * Math.PI / 180;
            const isMajor = i % 5 === 0;
            const r1 = r - (isMajor ? 10 : 5);
            const r2 = r;
            const x1 = cx + r1 * Math.cos(a), y1 = cy + r1 * Math.sin(a);
            const x2 = cx + r2 * Math.cos(a), y2 = cy + r2 * Math.sin(a);
            return (
              <line
                key={i}
                x1={x1} y1={y1} x2={x2} y2={y2}
                className={tickC}
                strokeWidth={isMajor ? 2 : 1}
                opacity={isMajor ? 0.95 : 0.7}
              />
            );
          })}

          {/* Printed dial text (lowered a bit, still upper-half; behind needle) */}
          <g filter={`url(#${id("printBleed")})`} textAnchor="middle" dominantBaseline="middle">
            {/* Light theme */}
            <g className="dark:hidden" fill="rgba(31,41,55,0.75)">
              <text x={cx + 2} y={cy - 35} fontSize="10" fontWeight={800} style={{ letterSpacing: "0.25em" }}>
                HEADING
              </text>
              <text x={cx + 2} y={cy - 25} fontSize="8" fontWeight={700} style={{ letterSpacing: "0.06em" }}>
                Compass
              </text>
            </g>
            {/* Dark theme */}
            <g className="hidden dark:block" fill="rgba(229,231,235,0.75)">
              <text x={cx + 2} y={cy - 35} fontSize="10" fontWeight={800} style={{ letterSpacing: "0.25em" }}>
                HEADING
              </text>
              <text x={cx + 2} y={cy - 25} fontSize="8" fontWeight={700} style={{ letterSpacing: "0.06em" }}>
                Compass
              </text>
            </g>
          </g>

          {/* === Team emblem (lower-half, mirrored to HEADING; no background) === */}
          {/* Place after the Printed dial text <g>, before NESW markers */}
          <g filter={`url(#${id("printBleed")})`} aria-label="team-emblem">
            {/* Light mode — same color as HEADING */}
            <g className="dark:hidden" fill="rgba(31,41,55,0.75)" stroke="rgba(31,41,55,0.75)">
              <g transform={`translate(${cx - 9}, ${cy + 20}) scale(0.85)`}>
                {/* Use the glyph-only emblem component (no wrapper circle). 
                  It must respect currentColor (fill/stroke). */}
                {EmblemIcon ? (
                  <EmblemIcon
                    width={22}
                    height={22}
                    fill="currentColor"
                    stroke="currentColor"
                    style={{ color: "rgba(31,41,55,0.75)" }} // same as HEADING (light)
                    aria-hidden
                  />
                ) : null}
              </g>
            </g>

            {/* Dark mode — same color as HEADING */}
            <g className="hidden dark:block" fill="rgba(229,231,235,0.75)" stroke="rgba(229,231,235,0.75)">
              <g transform={`translate(${cx - 9}, ${cy + 20}) scale(0.85)`}>
                {EmblemIcon ? (
                  <EmblemIcon
                    width={22}
                    height={22}
                    fill="currentColor"
                    stroke="currentColor"
                    style={{ color: "rgba(229,231,235,0.75)" }} // same as HEADING (dark)
                    aria-hidden
                  />
                ) : null}
              </g>
            </g>
          </g>

          {/* NESW markers (unchanged) */}
          <g fontSize="13" fontWeight={700} className={textFill} textAnchor="middle" dominantBaseline="middle">
            <text x={cx} y={cy - r + 22}>N</text>
            <text x={cx + r - 18} y={cy}>E</text>
            <text x={cx} y={cy + r - 22}>S</text>
            <text x={cx - r + 18} y={cy}>W</text>
          </g>

          {/* Needle (metallic, above text) */}
          <g style={{ transformOrigin: `${cx}px ${cy}px`, transform: `rotate(${angle}deg)` }}>
            {/* North pointer */}
            <polygon
              points={`${cx},${cy - (r - 12)} ${cx - 7},${cy + 11} ${cx + 7},${cy + 11}`}
              className="dark:hidden"
              fill={`url(#${id("roseMetalL")})`}
              opacity={0.98}
            />
            <polygon
              points={`${cx},${cy - (r - 12)} ${cx - 7},${cy + 11} ${cx + 7},${cy + 11}`}
              className="hidden dark:block"
              fill={`url(#${id("roseMetalD")})`}
              opacity={0.98}
            />

            {/* South pointer */}
            <polygon
              points={`${cx},${cy + (r - 12)} ${cx - 7},${cy - 11} ${cx + 7},${cy - 11}`}
              className="dark:hidden"
              fill={`url(#${id("blueMetalL")})`}
              opacity={0.95}
            />
            <polygon
              points={`${cx},${cy + (r - 12)} ${cx - 7},${cy - 11} ${cx + 7},${cy - 11}`}
              className="hidden dark:block"
              fill={`url(#${id("blueMetalD")})`}
              opacity={0.95}
            />

            {/* hub (metal cap) */}
            <circle cx={cx} cy={cy} r={9} className="dark:hidden" fill={`url(#${id("hubL")})`} stroke="rgba(0,0,0,0.15)" strokeWidth={1.2}/>
            <circle cx={cx} cy={cy} r={9} className="hidden dark:block" fill={`url(#${id("hubD")})`} stroke="rgba(255,255,255,0.20)" strokeWidth={1.2}/>
          </g>
        </g>
      </svg>
    </div>
  );
};


/* ----------------- Emblems & watermark ----------------- */

const EMBLEMS = [AnchorCrest, LifebuoyRope, CompassShield, TridentWaves, HelmStar] as const;

function hashSeed(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const TeamEmblem: React.FC<{
  role: Role;
  Icon?: React.FunctionComponent<React.SVGProps<SVGSVGElement>>;
  size?: number;
  title?: string;
}> = ({ role, Icon, size = 40, title }) => {
  const bubble =
    role === "host"
      ? "bg-blue-600/10 text-blue-700 dark:text-blue-300"
      : "bg-emerald-600/10 text-emerald-600 dark:text-emerald-300";
  const Fallback = role === "host" ? AnchorCrest : LifebuoyRope;
  const IconToUse = Icon ?? Fallback;
  const iconSize = Math.max(10, size - 4);

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full ring-1 ring-black/10 dark:ring-white/10 ${bubble}`}
      style={{ width: size, height: size }}
      aria-label={title ?? (role === "host" ? "Host emblem" : "Guest emblem")}
      title={title ?? (role === "host" ? "Host emblem" : "Guest emblem")}
    >
      <IconToUse width={iconSize} height={iconSize} aria-hidden="true" />
    </span>
  );
};

const WatermarkEmblem: React.FC<{
  role: Role;
  Icon: React.FunctionComponent<React.SVGProps<SVGSVGElement>>;
  size?: number | string;
  opacity?: number;
  ring?: boolean;
}> = ({ role, Icon, size = 520, opacity = 1, ring = true }) => {
  const bubbleBgClass = role === "host" ? "bg-blue-600/10" : "bg-emerald-600/10";
  const iconColorClass =
    role === "host" ? "text-blue-700 dark:text-blue-300" : "text-emerald-600 dark:text-emerald-300";
  const ringClass = ring ? "ring-1 ring-black/10 dark:ring-white/10" : "";
  const dim = typeof size === "number" ? `${size}px` : size;

  return (
    <div className="relative pointer-events-none" style={{ width: dim, height: dim, opacity }}>
      <div className={`absolute inset-0 rounded-full ${bubbleBgClass} ${ringClass}`} aria-hidden />
      <Icon className={`absolute ${iconColorClass}`} style={{ top: 12, right: 12, bottom: 12, left: 12, position: "absolute" }} aria-hidden="true" />
    </div>
  );
};

/* ----------------- Board overlays ----------------- */

type SunkOverlay = { r0: number; c0: number; r1: number; c1: number; cells: string[]; };

function computeSunkOverlays(grid: Grid, shots: Shots): SunkOverlay[] {
  const byId: Record<number, Array<[number, number]>> = {};
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
    const id = grid[r][c]; if (id > 0) (byId[id] ||= []).push([r, c]);
  }
  const out: SunkOverlay[] = [];
  for (const id of Object.keys(byId)) {
    const cells = byId[Number(id)];
    const sunk = cells.every(([r, c]) => shots[r][c] === 2);
    if (!sunk) continue;
    let r0 = Infinity, c0 = Infinity, r1 = -1, c1 = -1;
    const keys: string[] = [];
    for (const [r, c] of cells) {
      if (r < r0) r0 = r; if (c < c0) c0 = c;
      if (r > r1) r1 = r; if (c > c1) c1 = c;
      keys.push(`${r},${c}`);
    }
    out.push({ r0, c0, r1, c1, cells: keys });
  }
  return out;
}

function BoardGrid({
  title, grid, shots, revealShips = false, onCellClick, disabled = false, greenEllipseOnly = false,
}: {
  title: React.ReactNode;
  grid: Grid;
  shots: Shots;
  revealShips?: boolean;
  onCellClick?: (r: number, c: number) => void;
  disabled?: boolean;
  greenEllipseOnly?: boolean;
}) {
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const [metrics, setMetrics] = React.useState<{ cell: number; gap: number; padX: number; padY: number } | null>(null);

  const sunkOverlays = React.useMemo(() => computeSunkOverlays(grid, shots), [grid, shots]);
  const sunkCells = React.useMemo(() => {
    const s = new Set<string>();
    sunkOverlays.forEach(o => o.cells.forEach(k => s.add(k)));
    return s;
  }, [sunkOverlays]);

  React.useLayoutEffect(() => {
    const el = wrapRef.current; if (!el) return;
    const ro = new ResizeObserver(() => {
      const firstBtn = el.querySelector<HTMLButtonElement>('button[data-rc="0,0"]');
      const nextBtn  = el.querySelector<HTMLButtonElement>('button[data-rc="0,1"]');
      if (!firstBtn || !nextBtn) return;
      const wrapBox = el.getBoundingClientRect();
      const a = firstBtn.getBoundingClientRect();
      const b = nextBtn.getBoundingClientRect();
      const cell = a.width;
      const gap = Math.max(0, b.left - a.right);
      const padX = a.left - wrapBox.left;
      const padY = a.top  - wrapBox.top;
      setMetrics({ cell, gap, padX, padY });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="w-full">
      <div className="flex items-center gap-2 mb-4 sm:mb-5 font-semibold text-gray-700 dark:text-gray-200">
        {title}
      </div>

      <div
        ref={wrapRef}
        className="
          relative w-full grid grid-cols-10 gap-1 p-2 rounded-xl
          bg-transparent
          ring-1 ring-black/10 dark:ring-white/10
          shadow-2xl
        "
      >
        {/* === NAVAL CHART BACKDROP + TACTICAL OVERLAY (purely visual; behind cells) === */}
        {metrics && (() => {
          const { cell, gap, padX, padY } = metrics;
          const total = SIZE * cell + (SIZE - 1) * gap;

          // anchor at the visual grid center-lines (half-gap offset) so lines are concentric
          const lineX = (i: number) => padX - gap / 2 + i * (cell + gap);
          const lineY = (i: number) => padY - gap / 2 + i * (cell + gap);

          const isMajor = (i: number) => (i % 5 === 0);

          // (unchanged style names)
          const minorLine = "bg-black/70 dark:bg-white/60";
          const majorLine = "bg-black dark:bg-white";
          const tickLine  = "bg-black/80 dark:bg-white/70";
          const labelC    = "text-[10px] font-semibold tracking-wide text-gray-900 dark:text-gray-100 opacity-95";

          // grid lines — span from outer line to outer line
          const vLine = (i: number) => (
            <div
              key={`v-${i}`}
              className={`absolute w-px pointer-events-none ${isMajor(i) ? majorLine : minorLine} z-0`}
              style={{ left: lineX(i), top: lineY(0), height: total + gap }}
              aria-hidden
            />
          );
          const hLine = (i: number) => (
            <div
              key={`h-${i}`}
              className={`absolute h-px pointer-events-none ${isMajor(i) ? majorLine : minorLine} z-0`}
              style={{ top: lineY(i), left: lineX(0), width: total + gap }}
              aria-hidden
            />
          );

          // edge ticks — lock to outer lines
          const topTick = (i: number) => {
            const h = isMajor(i) ? 10 : 6;
            return <div key={`tt-${i}`} className={`absolute w-px pointer-events-none ${tickLine} z-0`} style={{ left: lineX(i), top: lineY(0) - h, height: h }} />;
          };
          const bottomTick = (i: number) => {
            const h = isMajor(i) ? 10 : 6;
            return <div key={`bt-${i}`} className={`absolute w-px pointer-events-none ${tickLine} z-0`} style={{ left: lineX(i), top: lineY(SIZE), height: h }} />;
          };
          const leftTick = (i: number) => {
            const w = isMajor(i) ? 10 : 6;
            return <div key={`lt-${i}`} className={`absolute h-px pointer-events-none ${tickLine} z-0`} style={{ top: lineY(i), left: lineX(0) - w, width: w }} />;
          };
          const rightTick = (i: number) => {
            const w = isMajor(i) ? 10 : 6;
            return <div key={`rt-${i}`} className={`absolute h-px pointer-events-none ${tickLine} z-0`} style={{ top: lineY(i), left: lineX(SIZE), width: w }} />;
          };

          // numeric 00–09 on both axes
          const nums2 = Array.from({ length: SIZE }, (_, i) => i.toString().padStart(2, "0"));
          const topLabel = (i: number) => (
            <div key={`tl-${i}`} className={`absolute ${labelC} z-0`} style={{ top: lineY(0) - 18, left: padX + i * (cell + gap) + cell / 2, transform: "translateX(-50%)" }}>
              {nums2[i]}
            </div>
          );
          const bottomLabel = (i: number) => (
            <div key={`bl-${i}`} className={`absolute ${labelC} z-0`} style={{ top: lineY(SIZE) + 8, left: padX + i * (cell + gap) + cell / 2, transform: "translateX(-50%)" }}>
              {nums2[i]}
            </div>
          );
          const leftLabel = (i: number) => (
            <div key={`ll-${i}`} className={`absolute ${labelC} z-0`} style={{ left: lineX(0) - 22, top: padY + i * (cell + gap) + cell / 2, transform: "translateY(-50%)" }}>
              {nums2[i]}
            </div>
          );
          const rightLabel = (i: number) => (
            <div key={`rl-${i}`} className={`absolute ${labelC} z-0`} style={{ left: lineX(SIZE) + 8, top: padY + i * (cell + gap) + cell / 2, transform: "translateY(-50%)" }}>
              {nums2[i]}
            </div>
          );

          return (
            <>
              {/* BACKDROP — increased overall opacity slightly */}
              <div
                className="absolute inset-0 rounded-xl pointer-events-none z-0 block dark:hidden"
                style={{
                  backgroundColor: "rgba(14,165,233,0.28)",
                  backgroundImage: [
                    "radial-gradient(circle at 22% 28%, rgba(14,165,233,0.35), rgba(14,165,233,0) 46%)",
                    "radial-gradient(circle at 74% 26%, rgba(2,132,199,0.30), rgba(2,132,199,0) 52%)",
                    "radial-gradient(circle at 70% 72%, rgba(59,130,246,0.28), rgba(59,130,246,0) 50%)",
                    "radial-gradient(circle at 30% 74%, rgba(2,132,199,0.26), rgba(2,132,199,0) 52%)",
                    "repeating-linear-gradient(45deg, rgba(0,0,0,0.06) 0 2px, transparent 2px 6px)",
                  ].join(", "),
                }}
                aria-hidden
              />
              <div
                className="absolute inset-0 rounded-xl pointer-events-none z-0 hidden dark:block"
                style={{
                  backgroundColor: "rgba(2,6,23,0.75)",
                  backgroundImage: [
                    "radial-gradient(circle at 22% 28%, rgba(56,189,248,0.30), rgba(56,189,248,0) 46%)",
                    "radial-gradient(circle at 74% 26%, rgba(14,165,233,0.28), rgba(14,165,233,0) 50%)",
                    "radial-gradient(circle at 70% 72%, rgba(59,130,246,0.28), rgba(59,130,246,0) 48%)",
                    "radial-gradient(circle at 30% 74%, rgba(2,132,199,0.26), rgba(2,132,199,0) 52%)",
                    "repeating-linear-gradient(45deg, rgba(255,255,255,0.04) 0 2px, transparent 2px 6px)",
                  ].join(", "),
                }}
                aria-hidden
              />
              <div
                className="absolute inset-0 rounded-xl pointer-events-none z-0
                           bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.11),transparent_72%)]
                           dark:bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.09),transparent_72%)]"
                aria-hidden
              />

              {/* CONTOURS — softened: lighter opacity + slight blur; still dotted and mode-aware */}
              <svg
                className="absolute pointer-events-none z-0"
                style={{ left: padX, top: padY, width: total, height: total }}
                viewBox={`0 0 ${total} ${total}`}
              >
                <defs>
                  <filter id="ct-soft" x="-5%" y="-5%" width="110%" height="110%">
                    <feGaussianBlur stdDeviation="0.6" />
                  </filter>
                </defs>

                <g className="stroke-black/60 dark:stroke-white/60" filter="url(#ct-soft)">
                  {[
                    { seed: 11, base: total * 0.22, amp: total * 0.07, k1: 0.7, k2: 1.3, tilt: total * 0.04 },
                    { seed: 29, base: total * 0.48, amp: total * 0.06, k1: 1.0, k2: 1.9, tilt: -total * 0.02 },
                    { seed: 41, base: total * 0.72, amp: total * 0.05, k1: 0.9, k2: 1.5, tilt: total * 0.03 },
                    { seed: 57, base: total * 0.35, amp: total * 0.04, k1: 1.4, k2: 2.1, tilt: -total * 0.015 },
                  ].map((cfg, i) => (
                    <path
                      key={`wave-light-${i}`}
                      d={(function makeWavyPath(seed:number, baseY:number, amp:number, k1:number, k2:number, tilt:number){
                        const srnd=(seed:number)=>{let s=seed>>>0;return()=> (s=(s*1664525+1013904223)>>>0)/0xffffffff;};
                        const R=srnd(seed); const pts: Array<{x:number;y:number}> = []; const steps=14;
                        for(let i=0;i<=steps;i++){const t=i/steps; const x=t*total; const nx=t*Math.PI*2;
                          const y=baseY + amp*Math.sin(nx*k1 + seed*0.13) + amp*0.6*Math.cos(nx*k2 + seed*0.29 + R()*0.4) + (t-0.5)*tilt;
                          pts.push({x,y});
                        }
                        let d=`M ${pts[0].x} ${pts[0].y}`;
                        for(let i=1;i<pts.length;i++){const p0=pts[i-1], p1=pts[i]; const dx=(p1.x-p0.x)/2; d+=` C ${p0.x+dx} ${p0.y} ${p1.x-dx} ${p1.y} ${p1.x} ${p1.y}`;}
                        return d;
                      })(cfg.seed,cfg.base,cfg.amp,cfg.k1,cfg.k2,cfg.tilt)}
                      className="fill-none"
                      strokeWidth={1.0}
                      strokeDasharray="4 6"
                    />
                  ))}
                  {(function makeBlobPaths(){
                    const makeBlob=(seed:number,cx:number,cy:number,r:number)=>{
                      const srnd=(seed:number)=>{let s=seed>>>0;return()=> (s=(s*1664525+1013904223)>>>0)/0xffffffff;};
                      const R=srnd(seed); const segs=12; const pts:Array<{x:number;y:number}>=[];
                      for(let i=0;i<segs;i++){const a=(i/segs)*Math.PI*2; const jitter=0.75+R()*0.5; const rr=r*jitter; pts.push({x:cx+Math.cos(a)*rr,y:cy+Math.sin(a)*rr});}
                      let d=`M ${pts[0].x} ${pts[0].y}`;
                      for(let i=1;i<=segs;i++){const p0=pts[(i-1)%segs], p1=pts[i%segs]; const dx=(p1.x-p0.x)/2, dy=(p1.y-p0.y)/2; d+=` C ${p0.x+dx} ${p0.y+dy} ${p1.x-dx} ${p1.y-dy} ${p1.x} ${p1.y}`;}
                      return d+" Z";
                    };
                    return (
                      <>
                        <path d={makeBlob(73, total * 0.22, total * 0.62, total * 0.08)} className="fill-none" strokeWidth={0.9} strokeDasharray="3 6" />
                        <path d={makeBlob(97, total * 0.78, total * 0.18, total * 0.06)} className="fill-none" strokeWidth={0.9} strokeDasharray="3 6" />
                      </>
                    );
                  })()}
                </g>

                <g className="hidden dark:block stroke-white/55" filter="url(#ct-soft)">
                  {[
                    { seed: 11, base: total * 0.22, amp: total * 0.07, k1: 0.7, k2: 1.3, tilt: total * 0.04 },
                    { seed: 29, base: total * 0.48, amp: total * 0.06, k1: 1.0, k2: 1.9, tilt: -total * 0.02 },
                    { seed: 41, base: total * 0.72, amp: total * 0.05, k1: 0.9, k2: 1.5, tilt: total * 0.03 },
                    { seed: 57, base: total * 0.35, amp: total * 0.04, k1: 1.4, k2: 2.1, tilt: -total * 0.015 },
                  ].map((cfg, i) => (
                    <path
                      key={`wave-dark-${i}`}
                      d={(function makeWavyPath(seed:number, baseY:number, amp:number, k1:number, k2:number, tilt:number){
                        const srnd=(seed:number)=>{let s=seed>>>0;return()=> (s=(s*1664525+1013904223)>>>0)/0xffffffff;};
                        const R=srnd(seed); const pts: Array<{x:number;y:number}> = []; const steps=14;
                        for(let i=0;i<=steps;i++){const t=i/steps; const x=t*total; const nx=t*Math.PI*2;
                          const y=baseY + amp*Math.sin(nx*k1 + seed*0.13) + amp*0.6*Math.cos(nx*k2 + seed*0.29 + R()*0.4) + (t-0.5)*tilt;
                          pts.push({x,y});
                        }
                        let d=`M ${pts[0].x} ${pts[0].y}`;
                        for(let i=1;i<pts.length;i++){const p0=pts[i-1], p1=pts[i]; const dx=(p1.x-p0.x)/2; d+=` C ${p0.x+dx} ${p0.y} ${p1.x-dx} ${p1.y} ${p1.x} ${p1.y}`;}
                        return d;
                      })(cfg.seed,cfg.base,cfg.amp,cfg.k1,cfg.k2,cfg.tilt)}
                      className="fill-none"
                      strokeWidth={1.0}
                      strokeDasharray="4 6"
                    />
                  ))}
                  {(function makeBlobPaths(){
                    const makeBlob=(seed:number,cx:number,cy:number,r:number)=>{
                      const srnd=(seed:number)=>{let s=seed>>>0;return()=> (s=(s*1664525+1013904223)>>>0)/0xffffffff;};
                      const R=srnd(seed); const segs=12; const pts:Array<{x:number;y:number}>=[];
                      for(let i=0;i<segs;i++){const a=(i/segs)*Math.PI*2; const jitter=0.75+R()*0.5; const rr=r*jitter; pts.push({x:cx+Math.cos(a)*rr,y:cy+Math.sin(a)*rr});}
                      let d=`M ${pts[0].x} ${pts[0].y}`;
                      for(let i=1;i<=segs;i++){const p0=pts[(i-1)%segs], p1=pts[i%segs]; const dx=(p1.x-p0.x)/2, dy=(p1.y-p0.y)/2; d+=` C ${p0.x+dx} ${p0.y+dy} ${p1.x-dx} ${p1.y-dy} ${p1.x} ${p1.y}`;}
                      return d+" Z";
                    };
                    return (
                      <>
                        <path d={makeBlob(73, total * 0.22, total * 0.62, total * 0.08)} className="fill-none" strokeWidth={0.9} strokeDasharray="3 6" />
                        <path d={makeBlob(97, total * 0.78, total * 0.18, total * 0.06)} className="fill-none" strokeWidth={0.9} strokeDasharray="3 6" />
                      </>
                    );
                  })()}
                </g>
              </svg>

              {/* grid lines (minor + major every 5) */}
              <div className="absolute inset-0 pointer-events-none z-0" aria-hidden>
                {Array.from({ length: SIZE + 1 }, (_, i) => vLine(i))}
                {Array.from({ length: SIZE + 1 }, (_, i) => hLine(i))}
              </div>

              {/* edge ticks */}
              <div className="absolute inset-0 pointer-events-none z-0" aria-hidden>
                {Array.from({ length: SIZE + 1 }, (_, i) => topTick(i))}
                {Array.from({ length: SIZE + 1 }, (_, i) => bottomTick(i))}
                {Array.from({ length: SIZE + 1 }, (_, i) => leftTick(i))}
                {Array.from({ length: SIZE + 1 }, (_, i) => rightTick(i))}
              </div>

              {/* numeric coordinate labels */}
              <div className="absolute inset-0 pointer-events-none z-0" aria-hidden>
                {Array.from({ length: SIZE }, (_, i) => topLabel(i))}
                {Array.from({ length: SIZE }, (_, i) => bottomLabel(i))}
                {Array.from({ length: SIZE }, (_, i) => leftLabel(i))}
                {Array.from({ length: SIZE }, (_, i) => rightLabel(i))}
              </div>

              {/* corner squares pinned to outer lines */}
              <div className="absolute pointer-events-none z-0" aria-hidden>
                <div className="absolute w-[6px] h-[6px] rounded-[2px] bg-gray-700/90 dark:bg-gray-200/80" style={{ left: lineX(0) - 3,  top: lineY(0) - 3 }} />
                <div className="absolute w-[6px] h-[6px] rounded-[2px] bg-gray-700/90 dark:bg-gray-200/80" style={{ left: lineX(SIZE) - 3, top: lineY(0) - 3 }} />
                <div className="absolute w-[6px] h-[6px] rounded-[2px] bg-gray-700/90 dark:bg-gray-200/80" style={{ left: lineX(0) - 3,  top: lineY(SIZE) - 3 }} />
                <div className="absolute w-[6px] h-[6px] rounded-[2px] bg-gray-700/90 dark:bg-gray-200/80" style={{ left: lineX(SIZE) - 3, top: lineY(SIZE) - 3 }} />
              </div>
            </>
          );
        })()}

        {/* === CELLS (behavior unchanged) === */}
        {Array.from({ length: SIZE * SIZE }).map((_, i) => {
          const r = Math.floor(i / SIZE), c = i % SIZE;
          const shipId = grid[r][c];
          const shot = shots[r][c];

          const canClick = !disabled && !!onCellClick && shot === 0;
          const classes = cellBase + (canClick ? " cursor-pointer" : " cursor-default");

          const inSunk = sunkCells.has(`${r},${c}`);
          const showGreen = revealShips && shipId > 0;

          return (
            <button
              key={`cell-${title}-${r}-${c}`}
              data-rc={`${r},${c}`}
              className={`${classes} w-full z-10`}
              onClick={canClick ? () => onCellClick!(r, c) : undefined}
              disabled={!canClick}
              aria-label={`${title} ${r},${c}`}
            >
              {showGreen && greenEllipseOnly && (
                <span className="absolute inset-0 rounded-full bg-emerald-500/25 dark:bg-emerald-400/20 pointer-events-none" />
              )}
              {showGreen && !greenEllipseOnly && (
                <span className="absolute inset-0 rounded-lg bg-emerald-500/20 dark:bg-emerald-400/20 pointer-events-none" />
              )}
              {!inSunk && (shot === 2 ? <HitMark /> : shot === 1 ? <MissMark /> : null)}
            </button>
          );
        })}

        {/* sunk overlays (unchanged, above cells) */}
        {metrics &&
          sunkOverlays.map((o, idx) => {
            const { cell, gap, padX, padY } = metrics;
            const x = padX + o.c0 * (cell + gap);
            const y = padY + o.r0 * (cell + gap);
            const w = (o.c1 - o.c0 + 1) * cell + (o.c1 - o.c0) * gap;
            const h = (o.r1 - o.r0 + 1) * cell + (o.r1 - o.r0) * gap;
            const radius = Math.min(w, h) / 2;
            return (
              <div
                key={`sunk-${idx}`}
                className="absolute pointer-events-none bg-rose-500/30 ring-1 ring-rose-500/40 z-20"
                style={{ left: x, top: y, width: w, height: h, borderRadius: radius }}
                aria-hidden
                title="Sunk vessel"
              />
            );
          })}
      </div>
    </div>
  );
}


/* ----------------- Main ----------------- */

type Phase = "place" | "play" | "over";
type Entry = "landing" | "bot" | "mp";
type Props = { onRegisterReset?: (fn: () => void) => void; };

export default function BattleshipWeb({ onRegisterReset }: Props) {
  // deep-link / invite detection
  const codeFromHash = parseRoomCodeFromHash() || "";
  const fromInvite = !!codeFromHash;

  // entry & MP mode
  const [entry, setEntry] = React.useState<Entry>(fromInvite ? "mp" : "landing");
  const [mode, setMode] = React.useState<MPMode>(() => (fromInvite ? "mp" : "bot"));
  const [role, setRole] = React.useState<Role>(fromInvite ? "guest" : "host");
  const [roomCode, setRoomCode] = React.useState<string>(() => codeFromHash);

  // landing join UX
  const [landingJoinOpen, setLandingJoinOpen] = React.useState(false);
  const [joinCode, setJoinCode] = React.useState("");

  // room + presence
  const roomRef = React.useRef<Room | null>(null);
  const everHadPeerRef = React.useRef(false);
  const [peerPresent, setPeerPresent] = React.useState(false);
  const [peerState, setPeerState] = React.useState<"joining" | "placing" | "ready" | "quit" | "left">("joining");
  const peerPresentRef = React.useRef(peerPresent);
  React.useEffect(() => { peerPresentRef.current = peerPresent; }, [peerPresent]);
  const rejoinTimerRef = React.useRef<number | null>(null);

  // game state
  const [phase, setPhase] = React.useState<Phase>("place");
  const [orientation, setOrientation] = React.useState<Orientation>("H");
  const [epoch, setEpoch] = React.useState<number>(0);
  const [playerGrid, setPlayerGrid]   = React.useState<Grid>(() => makeGrid());
  const [playerFleet, setPlayerFleet] = React.useState<Fleet>({});
  const [playerShots, setPlayerShots] = React.useState<Shots>(() => makeShots());
  const [enemyGrid, setEnemyGrid]     = React.useState<Grid>(() => makeGrid());
  const [enemyFleet, setEnemyFleet]   = React.useState<Fleet>({});
  const [enemyShots, setEnemyShots]   = React.useState<Shots>(() => makeShots());
  const [toPlace, setToPlace]         = React.useState<number[]>(() => [...FLEET_SIZES]);
  const [turn, setTurn]               = React.useState<"player" | "ai">("player");
  const [msg, setMsg]                 = React.useState("Deploy your fleet (press R to rotate)");
  const [rematchAskFromPeer, setRematchAskFromPeer] = React.useState<null | Role>(null);

  // Compass heading (remembers last H and V picks)
  type CompassDir = "N" | "E" | "S" | "W";
  const [compassDir, setCompassDir] = React.useState<CompassDir>("E");
  const lastHDirRef = React.useRef<Extract<CompassDir,"E"|"W">>("E");
  const lastVDirRef = React.useRef<Extract<CompassDir,"N"|"S">>("N");

  const onCompassChoose = (d: CompassDir) => {
    setCompassDir(d);
    if (d === "N" || d === "S") {
      lastVDirRef.current = d;
      setOrientation("V");
    } else {
      lastHDirRef.current = d;
      setOrientation("H");
    }
  };

  // keep compass in sync if orientation changes via keyboard (R) or other paths
  React.useEffect(() => {
    if (orientation === "H" && (compassDir !== "E" && compassDir !== "W")) {
      setCompassDir(lastHDirRef.current);
    }
    if (orientation === "V" && (compassDir !== "N" && compassDir !== "S")) {
      setCompassDir(lastVDirRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orientation]);

  // measure enemy board to cap Signal Deck to 50% of its height
  const enemyWrapRef = React.useRef<HTMLDivElement | null>(null);
  const [enemyH, setEnemyH] = React.useState(0);

  React.useLayoutEffect(() => {
    const el = enemyWrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const box = el.getBoundingClientRect();
      setEnemyH(Math.max(0, Math.floor(box.height)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // --- Signal Deck state & helpers ---
  const [intelLog, setIntelLog] = React.useState<IntelLine[]>([]);
  const nextIntelIdRef = React.useRef(0);
  const lastFlavorAtRef = React.useRef(0);

  function pushIntel(text: string, voice: IntelLine["voice"] = "CIC", flavor = false) {
    setIntelLog((prev) => {
      const id = ++nextIntelIdRef.current;
      const next = [...prev, { id, t: Date.now(), voice, text, flavor }];
      return next.length > 100 ? next.slice(next.length - 100) : next;
    });
  }

  // mirror every new `msg` into the Signal Deck
  const lastMsgRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!msg || msg === lastMsgRef.current) return;
    lastMsgRef.current = msg;
    pushIntel(msg, "CIC", false);
  }, [msg]);

  // small flavor engine (rare, throttled)
  const FLAVOR_COOLDOWN_MS = 12000;
  function maybeFlavor(lines: string[], voice: IntelLine["voice"] = "Ops", probability = 0.35) {
    const now = Date.now();
    if (now - lastFlavorAtRef.current < FLAVOR_COOLDOWN_MS) return;
    if (Math.random() > probability) return;
    lastFlavorAtRef.current = now;
    const pick = lines[(Math.random() * lines.length) | 0];
    pushIntel(pick, voice, true);
  }

  // remaining ship cells helper (for near-win/loss cues)
  function countRemainingCells(grid: Grid, shots: Shots): number {
    let n = 0;
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
      if (grid[r][c] > 0 && shots[r][c] !== 2) n++;
    }
    return n;
  }

  const turnRef = React.useRef(turn);
  React.useEffect(() => { turnRef.current = turn; }, [turn]);

  // mirrors (refs used inside socket handlers)
  const phaseRef = React.useRef(phase);
  const roleRef = React.useRef(role);
  const playerGridRef = React.useRef(playerGrid);
  const playerFleetRef = React.useRef(playerFleet);
  const playerShotsRef = React.useRef(playerShots);
  React.useEffect(() => { phaseRef.current = phase; }, [phase]);
  React.useEffect(() => { roleRef.current = role; }, [role]);
  React.useEffect(() => { playerGridRef.current = playerGrid; }, [playerGrid]);
  React.useEffect(() => { playerFleetRef.current = playerFleet; }, [playerFleet]);
  React.useEffect(() => { playerShotsRef.current = playerShots; }, [playerShots]);

  // reveal + AI
  const [enemyRevealed, setEnemyRevealed] = React.useState(false);
  const sentRevealRef = React.useRef(false);
  const aiRef = React.useRef(makeAIState());

  const crisisWarnedRef = React.useRef<{ me: boolean; them: boolean }>({
    me: false,
    them: false,
  });

  // ready flags
  const [iAmReady, setIAmReady] = React.useState(false);
  const [peerReady, setPeerReady] = React.useState(false);
  const peerReadyRef = React.useRef(peerReady);
  React.useEffect(() => { peerReadyRef.current = peerReady; }, [peerReady]);
  const iAmReadyRef = React.useRef(iAmReady);
  React.useEffect(() => { iAmReadyRef.current = iAmReady; }, [iAmReady]);

  // resume window
  const RESUME_WINDOW_MS = 30_000;
  const lastSnapshotRef = React.useRef<any>(null);
  const resumedWithinGraceRef = React.useRef(false);
  const lastHelloAckSentAtRef = React.useRef(0);

  // local resume keys
  const resumeKey = (code: string, role: Role) => `bs:${code}:${role}:resume-v1` as const;
  type ResumeBlob = {
    exp: number;
    playerGrid: Grid;
    playerFleet: Fleet;
    iAmReady: boolean;
    turn: "player" | "ai";
  };

  // resume helpers
  const saveLocalResume = React.useCallback((code: string, role: Role, blob: ResumeBlob) => {
    try { localStorage.setItem(resumeKey(code, role), JSON.stringify(blob)); } catch {}
  }, []);

  function loadLocalResume(code: string, role: Role): ResumeBlob | null {
    try {
      const raw = localStorage.getItem(resumeKey(code, role));
      if (!raw) return null;
      const data = JSON.parse(raw) as ResumeBlob;
      if (!data || Date.now() > data.exp) return null;
      return data;
    } catch { return null; }
  }
  function clearLocalResume(code: string, role: Role) {
    try { localStorage.removeItem(resumeKey(code, role)); } catch {}
  }

  // state snapshot (kept handy; adapter may pull it)
  const buildStateSnapshot = React.useCallback(() => ({
    phase, turn,
    playerGrid, playerFleet, playerShots,
    enemyGrid, enemyFleet, enemyShots,
    iAmReady, peerReady, msg,
  }), [
    phase, turn,
    playerGrid, playerFleet, playerShots,
    enemyGrid, enemyFleet, enemyShots,
    iAmReady, peerReady, msg
  ]);
  const captureStateSnapshot = React.useCallback(() => {
    lastSnapshotRef.current = buildStateSnapshot();
  }, [buildStateSnapshot]);

  const applyStateSnapshot = React.useCallback((s: any) => {
    try {
      if (s.phase) setPhase(s.phase);
      if (s.turn) setTurn(s.turn);
      if (s.playerGrid) setPlayerGrid(s.playerGrid);
      if (s.playerFleet) setPlayerFleet(s.playerFleet);
      if (s.playerShots) setPlayerShots(s.playerShots);
      if (s.enemyGrid) setEnemyGrid(s.enemyGrid);
      if (s.enemyFleet) setEnemyFleet(s.enemyFleet);
      if (s.enemyShots) setEnemyShots(s.enemyShots);
      if (typeof s.iAmReady === "boolean") setIAmReady(s.iAmReady);
      if (typeof s.peerReady === "boolean") setPeerReady(s.peerReady);
      if (typeof s.msg === "string") setMsg(s.msg);
      setEnemyRevealed(false);
    } catch {}
  }, []);

  // persist a quick-resume blob on tab close
  React.useEffect(() => {
    const onBeforeUnload = () => {
      if (!roomCode || !roomRef.current) return;
      try {
        saveLocalResume(roomCode, roleRef.current, {
          exp: Date.now() + RESUME_WINDOW_MS,
          playerGrid: playerGridRef.current,
          playerFleet: playerFleetRef.current,
          iAmReady: iAmReadyRef.current ?? false,
          turn: turnRef.current,
        });
      } catch {}
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [roomCode, saveLocalResume]);

  // seed bot enemy when needed
  React.useEffect(() => {
    if (mode === "bot") {
      const { grid, fleet } = randomFleet();
      setEnemyGrid(grid); setEnemyFleet(fleet);
    }
  }, [mode]);

  // local reset
  const resetLocal = React.useCallback(() => {
    setPeerState(prev => (prev === "quit" ? (peerPresent ? "present" : "left") : prev));
    setPhase("place"); setOrientation("H");
    setIntelLog([]);
    setPlayerGrid(makeGrid()); setPlayerFleet({});
    setPlayerShots(makeShots());
    setEnemyGrid(makeGrid()); setEnemyFleet({});
    setEnemyShots(makeShots());
    setToPlace([...FLEET_SIZES]);
    setTurn("player");
    aiRef.current = makeAIState();
    setMsg("Deploy your fleet (press R to rotate)");
    setIAmReady(false); setPeerReady(false);
    setEnemyRevealed(false);
    sentRevealRef.current = false;
    lastSnapshotRef.current = null;
    crisisWarnedRef.current = { me: false, them: false };

    if (mode === "bot") {
      const { grid, fleet } = randomFleet(); setEnemyGrid(grid); setEnemyFleet(fleet);
    }
  }, [mode, peerPresent]);

  // MP wiring
  const ensureRoom = React.useCallback(async (asHost: boolean) => {
    const adapter = await createFirebaseAdapter();
    const code = asHost ? (roomCode || generateCode()) : roomCode;
    if (!code) return;
    setRoomCode(code);

    setPeerState(asHost ? "joining" : "present");
    setPeerPresent(!asHost);

    const r = new Room(adapter, code, asHost ? "host" : "guest", {
      onShot: ({ by, r, c }) => {
        const myRole = roleRef.current;
        const theyTargetedUs = (by === "host" && myRole === "guest") || (by === "guest" && myRole === "host");
        if (!theyTargetedUs) return;

        const res = receiveShot(
          playerGridRef.current,
          playerShotsRef.current,
          playerFleetRef.current,
          r, c
        );
        setPlayerShots(() => res.shots);
        setPlayerFleet(() => res.fleet);

        try {
          const mineLeft = countRemainingCells(playerGridRef.current, res.shots);
          if (!crisisWarnedRef.current.me && mineLeft <= 3) {
            crisisWarnedRef.current.me = true;
            maybeFlavor([
              "Mayday, Mayday—bulkheads failing! Damage control to stations!",
              "We’re taking water—brace for further impact!",
            ], "Ops", 1.0);
          }
          if (res.result === "hit" || res.result === "sunk") {
            maybeFlavor([
              "Enemy has our range. Recommend evasive pattern Delta.",
              "Incoming plot corrected—expect follow-up salvos.",
            ], "CIC");
          }
        } catch {}

        roomRef.current?.result(by, (res.result === "hit" || res.result === "sunk") ? res.result : "miss", r, c);

        if (allSunk(res.fleet)) {
          setPhase("over");
          setEnemyRevealed(true);
          setMsg("Enemy fleet prevails—mission failed.");
          roomRef.current?.phase("over");
        } else {
          setTurn("player");
          setMsg(res.result === "miss" ? "Their salvo splashed—your move!" : "We’re hit—return fire!");
        }
        captureStateSnapshot();
      },

      onResult: ({ to, result, r, c }) => {
        const myRole = roleRef.current;
        if (to !== myRole) return;

        setEnemyShots(prev => {
          const next = prev.map(row => row.slice());
          next[r][c] = result === "miss" ? 1 : 2;

          // Flavor with UPDATED shots
          const enemyLeft = countRemainingCells(enemyGrid, next);
          if (!crisisWarnedRef.current.them && enemyLeft <= 3) {
            crisisWarnedRef.current.them = true;
            maybeFlavor([
              "They’re listing—press the advantage!",
              "Enemy frames buckling; recommend continuous fire.",
            ], "Gunnery", 1.0);
          }
          if (result === "sunk") {
            maybeFlavor([
              "Enemy hull breached—she’s going under.",
              "Target struck below the waterline—confirming loss.",
            ], "Gunnery");
          }

          return next;
        });

        setMsg(
          result === "sunk" ? "Ship down! Passing initiative..." :
          result === "hit"  ? "Direct hit! Opponent’s turn..." :
                              "Shot wide—opponent’s turn..."
        );
        setTurn("ai");
        captureStateSnapshot();
      },

      onPhase: (ph) => {
        if (ph === "over" && !peerPresentRef.current) return;
        setPhase(ph);
        captureStateSnapshot();
      },

      onRematch: () => resetLocal(),

      onReady: ({ by, ready }) => {
        const me = roleRef.current;
        if (by === me) {
          setIAmReady(ready);
        } else {
          setPeerReady(ready);
        }
        const bothReady = (by === me ? ready : iAmReadyRef.current) && (by === me ? peerReadyRef.current : ready);
        if (bothReady && phaseRef.current !== "play" && me === "host") {
          try { roomRef.current?.phase("play"); } catch {}
        }
      },

      // 30s grace on disconnect
      onPeerBye: async () => {
        setPeerPresent(false);
        setPeerState("left");
        setPeerReady(false);
        setMsg("Contact lost—holding station for 30 s...");

        if (rejoinTimerRef.current) clearTimeout(rejoinTimerRef.current);
        rejoinTimerRef.current = window.setTimeout(async () => {
          rejoinTimerRef.current = null;
          if (peerPresentRef.current) return;
          if (roleRef.current === "host") {
            try { await roomRef.current?.bumpEpoch(); } catch {}
          }
          resetLocal();
          setPeerState("joining");
          setMsg("No contact—awaiting new vessel...");
        }, RESUME_WINDOW_MS);
      },

      onPeerHello: () => {
        const now = Date.now();

        everHadPeerRef.current = true;
        setPeerPresent(true);
        setPeerState(phase === "place" ? "placing" : "present");
        setMsg(phase === "play" ? "Comms restored—engagement resumes." : "New contact—battle stations.");

        if (rejoinTimerRef.current) {
          clearTimeout(rejoinTimerRef.current);
          rejoinTimerRef.current = null;
        }

        if (now - lastHelloAckSentAtRef.current > 2000) {
          try { roomRef.current?.hello(roleRef.current); } catch {}
          lastHelloAckSentAtRef.current = now;
        }
      },

      onQuit: () => {
        setPeerState("quit");
        setPhase("over");
        setMsg("Enemy struck colors. Revealing charts...");
        if (!sentRevealRef.current) {
          sentRevealRef.current = true;
          try {
            roomRef.current?.reveal(
              roleRef.current, playerGridRef.current as any, playerFleetRef.current as any
            );
          } catch {}
        }
      },

      onRematchSignal: ({ action, by }) => {
        const me = roleRef.current;
        if (action === "propose" && by !== me) {
          setRematchAskFromPeer(by);
          setMsg("Enemy requests re-engagement. Accept?");
        } else if (action === "accept") {
          setRematchAskFromPeer(null);
          resetLocal();
          setMsg("Rearm complete—deploy your fleet.");
        } else if (action === "decline") {
          setRematchAskFromPeer(null);
          setMsg("Re-engagement declined.");
        }
      },

      onEpoch: (n) => {
        setEpoch(typeof n === "number" ? n : 0);
        everHadPeerRef.current = false;
        resetLocal();
        setMsg("New operation initiated.");
      },

      onReveal: ({ by, grid, fleet }) => {
        const mine = roleRef.current;
        if (by === mine) return;
        setEnemyGrid(grid as unknown as Grid);
        setEnemyFleet(fleet as unknown as Fleet);
        setEnemyRevealed(true);
      },

      onState: ({ by, state }) => {
        const me = roleRef.current;
        if (by === me) return;
        applyStateSnapshot(state);
        setMsg("State synced—resume engagement.");
      },
    });

    roomRef.current = r;
    setRole(asHost ? "host" : "guest");

    if (asHost) {
      const e = (await (r.create() as unknown)) as number | void;
      setPeerPresent(false);
      setPeerState("joining");
      if (typeof e === "number") setEpoch(e);

      const blobH = loadLocalResume(code, "host");
      if (blobH) {
        setPlayerGrid(blobH.playerGrid);
        setPlayerFleet(blobH.playerFleet);
        setIAmReady(!!blobH.iAmReady);
        setTurn(blobH.turn);
        try { if (blobH.iAmReady) roomRef.current?.ready("host", true); } catch {}
        clearLocalResume(code, "host");
        resumedWithinGraceRef.current = true;
        setMsg("Your fleet restored—awaiting enemy.");
      }

    } else {
      const e = (await (r.join() as unknown)) as number | void;
      if (typeof e === "number") setEpoch(e);

      const blob = loadLocalResume(code, "guest");
      if (blob) {
        setPlayerGrid(blob.playerGrid);
        setPlayerFleet(blob.playerFleet);
        setIAmReady(!!blob.iAmReady);
        setTurn(blob.turn);
        try { if (blob.iAmReady) roomRef.current?.ready("guest", true); } catch {}
        clearLocalResume(code, "guest");
        resumedWithinGraceRef.current = true;
        setMsg("Your fleet restored—checking contact...");
      }
    }
    try { roomRef.current?.hello(roleRef.current); } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // host nudges play if both ready but ordering was odd (rejoin etc.)
  React.useEffect(() => {
    if (iAmReady && peerReady && phase !== "play" && roleRef.current === "host" && roomRef.current) {
      try { roomRef.current.phase("play"); } catch {}
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iAmReady, peerReady, phase]);

  // nudge the peer shortly after connect if still absent
  React.useEffect(() => {
    if (!peerPresent && roomRef.current) {
      const id = window.setTimeout(() => {
        if (!peerPresent && roomRef.current) {
          try { roomRef.current.hello(roleRef.current); } catch {}
        }
      }, 1000);
      return () => clearTimeout(id);
    }
  }, [peerPresent]);

  // direct invite: auto-join
  React.useEffect(() => {
    if (!fromInvite) return;
    if (roomRef.current) return;
    setEntry("mp");
    setMode("mp");
    setRole("guest");
    setRoomCode(codeFromHash);
    ensureRoom(false);
    setMsg("Establishing comms...");
  }, [fromInvite, codeFromHash, ensureRoom]);

  /* ---- Handlers ---- */

  const onPlaceClick = (r: number, c: number) => {
    if (phase !== "place" || toPlace.length === 0) return;
    const length = toPlace[0];
    if (!canPlace(playerGrid, r, c, length, orientation)) { setMsg("Negative—collision course."); return; }
    const nextId = Object.keys(playerFleet).length + 1;
    const res = placeShip(playerGrid, playerFleet, nextId, r, c, length, orientation);
    setPlayerGrid(res.grid); setPlayerFleet(res.fleet);

    const remaining = toPlace.slice(1);
    setToPlace(remaining);
    setMsg(remaining.length ? `Laid down ${length}-deck ship. Next: ${remaining[0]} (press R to rotate)` : "Fleet deployed—stand by.");

    captureStateSnapshot();

    if (remaining.length === 0) {
      if (mode === "bot") {
        setPhase("play"); setTurn("player"); setMsg("Fire for effect →");
      } else {
        setIAmReady(true);
        try { roomRef.current?.ready(roleRef.current, true); } catch {}
        setMsg("Standing by—awaiting enemy deployment...");
      }
      captureStateSnapshot();
    }
  };

  const aiTurn = () => {
    const ai = aiRef.current;
    const [rr, cc] = aiPick(playerShots, ai);
    const res = receiveShot(playerGrid, playerShots, playerFleet, rr, cc);
    setPlayerShots(res.shots); setPlayerFleet(res.fleet);
    if (res.result === "hit" || res.result === "sunk") aiOnHit(rr, cc, res.shots, ai);
    if (allSunk(res.fleet)) {
      setPhase("over");
      setEnemyRevealed(true);
      setMsg("Training Bot prevails—our fleet is sunk.");
      return;
    }
    setTurn("player"); setMsg(res.result === "miss" ? "Training salvo wide—your guns!" : "We’re hit—return fire!");
  };

  const onEnemyClick = (r: number, c: number) => {
    if (phase !== "play") return;

    if (mode === "bot") {
      if (turn !== "player" || enemyShots[r][c] !== 0) return;
      try {
        const res = receiveShot(enemyGrid, enemyShots, enemyFleet, r, c);
        setEnemyShots(res.shots); setEnemyFleet(res.fleet);
        if (allSunk(res.fleet)) {
          setPhase("over"); setMsg("Enemy fleet sunk—victory! 🎖️");
          setEnemyRevealed(true);
          return;
        }
        setTurn("ai"); setMsg(res.result === "miss" ? "You missed. Bot's turn…" : "Hit! Bot's turn…");
        setTimeout(() => aiTurn(), 400);
      } catch {}
      return;
    }

    // MP
    if (turn !== "player" || enemyShots[r][c] !== 0 || !peerPresent) return;
    roomRef.current?.shot(roleRef.current, r, c);
    setMsg("Rounds away—awaiting splash...");
  };

  // ready gate (both players done placing)
  React.useEffect(() => {
    if (mode !== "mp") return;
    if (phase !== "place") return;
    if (!iAmReady || !peerReady) return;

    setPhase("play");

    if (!resumedWithinGraceRef.current) {
      const amHost = roleRef.current === "host";
      setTurn(amHost ? "player" : "ai");
      setMsg(amHost ? "You have initiative—open fire." : "Enemy has initiative—hold...");
    } else {
      setMsg(turnRef.current === "player" ? "Initiative retained—resume fire." : "Enemy’s move—hold fire...");
    }

    try { roomRef.current?.phase("play"); } catch {}
    captureStateSnapshot();
    resumedWithinGraceRef.current = false;
  }, [mode, phase, iAmReady, peerReady, captureStateSnapshot]);

  const inviteHash = roomCode ? buildInviteHash(roomCode) : "";

  // emblem picks (stable per room + epoch)
  const [HostEmblemIcon, GuestEmblemIcon] = React.useMemo(() => {
    if (!roomCode) return [EMBLEMS[0], EMBLEMS[1]] as const;
    const seed = hashSeed(`${roomCode}|${epoch}`);
    const hostIdx = seed % EMBLEMS.length;
    let guestIdx = ((seed * 1103515245 + 12345) >>> 0) % EMBLEMS.length;
    if (guestIdx === hostIdx) guestIdx = (guestIdx + 1) % EMBLEMS.length;
    return [EMBLEMS[hostIdx], EMBLEMS[guestIdx]] as const;
  }, [roomCode, epoch]);

  const MyEmblemIcon = role === "host" ? HostEmblemIcon : GuestEmblemIcon;

  // opponent status line
  const opponentStatus = React.useMemo(() => {
    const isHost = role === "host";
    if (!peerPresent) {
      if (isHost) return peerState === "left" ? "Guest (signal lost)" : "Guest (raising radio contact...)";
      return "";
    }
    if (isHost) {
      if (peerState === "quit") return "Guest (surrendered)";
      if (phase === "place")    return peerReady ? "Guest (battle ready)" : "Guest (charting the grid...)";
      return "Guest (at war)";
    } else {
      if (peerState === "quit") return "Host (surrendered)";
      if (phase === "place")    return peerReady ? "Host (battle ready)" : "Host (charting the grid...)";
      return "Host (at war)";
    }
  }, [role, peerPresent, peerReady, peerState, phase]);

  /* ----------------- Landing ----------------- */

  if (entry === "landing") {
    return (
      <div className="w-full mt-16 flex justify-center">
        <div
          className="
            relative overflow-hidden
            w-full max-w-sm mx-auto p-6 rounded-2xl
            min-h-[220px] md:min-h-[260px]
            bg-white/[0.08] dark:bg-white/[0.045]
            backdrop-blur-xl backdrop-saturate-150
            border border-white/15 dark:border-white/[0.06]
            ring-1 ring-white/[0.06] dark:ring-black/[0.25]
            shadow-lg
            transition-all
          "
        >
          <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-white/25 via-white/10 to-transparent dark:from-gray-800/60 dark:via-gray-900/40 dark:to-transparent" />

          <div className="relative z-10 flex flex-col items-center gap-1">
            {/* Local */}
            <div className="pl-0 md:pl-0">
              <div className="text-sm text-center mb-2 font-semibold tracking-wide text-gray-700 dark:text-gray-200">
                Local Waters
              </div>
              <div className="mt-2 h-px w-40 sm:w-20 md:w-44 bg-gray-300 dark:bg-white/10 backdrop-blur-lg rounded-full mx-auto" />
            </div>

            <div className="mt-4 flex justify-center">
              <button
                className="px-4 py-2 rounded-lg text-sm bg-gradient-to-r from-purple-600 via-purple-700 to-purple-800 text-white"
                onClick={() => { setEntry("bot"); setMode("bot"); resetLocal(); }}
              >
                <span className="inline-flex items-center gap-2">
                  <IconCpu className="w-4 h-4 opacity-90" aria-hidden="true" />
                  Drill with Bot
                </span>
              </button>
            </div>

            {/* Online */}
            <div className="mt-8 pl-0 md:pl-0">
              <div className="text-sm text-center mb-2 font-semibold tracking-wide text-gray-700 dark:text-gray-200">
                Open Seas
              </div>
              <div className="mt-2 h-px w-40 sm:w-20 md:w-44 bg-gray-300 dark:bg-white/10 backdrop-blur-sm rounded-full mx-auto" />
            </div>

            {!landingJoinOpen ? (
              <div className="mt-4 flex items-center justify-center gap-8">
                <button
                  className="px-4 py-2 rounded-lg text-sm bg-gradient-to-r from-emerald-600 via-emerald-700 to-emerald-800 text-white"
                  onClick={() => { setEntry("mp"); setMode("mp"); resetLocal(); ensureRoom(true); }}
                >
                  <span className="inline-flex items-center gap-2">
                    <IconSignal className="w-4 h-4 opacity-90" aria-hidden="true" />
                    Open Theater
                  </span>
                </button>

                <button
                  className="px-4 py-2 rounded-lg text-sm bg-gradient-to-r from-indigo-600 via-indigo-700 to-indigo-800 text-white"
                  onClick={() => { setLandingJoinOpen(true); setJoinCode(""); }}
                >
                  <span className="inline-flex items-center gap-2">
                    <IconLink className="w-4 h-4 opacity-90" aria-hidden="true" />
                    Join Theater
                  </span>
                </button>
              </div>
            ) : (
              <div className="mt-4 flex flex-col items-center gap-3">
                <div className="w-full flex items-center justify-center gap-3">
                  <input
                    autoFocus
                    inputMode="text"
                    pattern="[A-Za-z0-9]{4}"
                    maxLength={4}
                    value={joinCode}
                    onChange={(e) =>
                      setJoinCode(
                        e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4)
                      )
                    }
                    placeholder="Op Code (e.g., AX9G)"
                    className="w-44 px-3 py-2 rounded-md bg-white/90 dark:bg-gray-700 text-xs text-gray-900 dark:text-gray-100 ring-1 ring-black/10 dark:ring-white/10 outline-none text-center tracking-widest"
                    aria-label="Room code"
                  />
                  <button
                    className="px-3 py-2 rounded-lg bg-indigo-600 text-white disabled:opacity-50"
                    disabled={joinCode.length !== 4}
                    onClick={() => {
                      setEntry("mp");
                      setMode("mp");
                      setRole("guest");
                      setRoomCode(joinCode);
                      resetLocal();
                      ensureRoom(false);
                      setMsg("Joining room…");
                    }}
                  >
                    <span className="inline-flex items-center gap-2">
                      <IconLink className="w-4 h-4 opacity-90" aria-hidden="true" />
                      Join
                    </span>
                  </button>
                </div>
                <button
                  className="text-xs text-gray-600 dark:text-gray-400 hover:underline"
                  onClick={() => setLandingJoinOpen(false)}
                >
                  Stand down
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ----------------- MP header (narrow container) ----------------- */

  const MPHeader = () => (
    <div className="p-3 rounded-xl ring-1 ring-black/10 dark:ring-white/10 bg-gray-100 dark:bg-gray-800 space-y-3 shadow-lg">
      <div className="flex items-center justify-between">
        <div className="font-semibold text-sm text-gray-800 dark:text-gray-200">
          {opponentStatus ? (
            <div className="font-semibold text-sm text-gray-800 dark:text-gray-200 flex items-center gap-2">
              {(everHadPeerRef.current && (peerPresent || rejoinTimerRef.current != null)) && (
                <TeamEmblem
                  role={role === "host" ? "guest" : "host"}
                  Icon={role === "host" ? GuestEmblemIcon : HostEmblemIcon}
                  size={25}
                />
              )}
              <span className={`inline-block ${peerPresent ? "bg-emerald-500" : "bg-rose-500"} w-3 h-3 rounded-full`} aria-hidden />
              <span>{opponentStatus}</span>
            </div>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <button
            className="px-3 py-1.5 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-100 hover:bg-gray-300 dark:hover:bg-gray-600"
            onClick={() => { roomRef.current?.leave(); setEntry("landing"); setMode("bot"); resetLocal(); }}
            title="Return to harbor"
          >
            ← Back to Harbor
          </button>
          {roomRef.current && phase !== "over" && (
            <button
              className="px-3 py-1.5 rounded-lg bg-rose-600 text-white hover:bg-rose-700 dark:hover:bg-rose-500"
              title="Quit Game"
              onClick={() => {
                try {
                  roomRef.current?.quit(roleRef.current);
                  if (!sentRevealRef.current) {
                    sentRevealRef.current = true;
                    roomRef.current?.reveal(
                      roleRef.current,
                      playerGrid as unknown as number[][],
                      playerFleet as unknown as Record<string, any>
                    );
                  }
                } catch {}
                setPhase("over");
                setMsg("You strike colors—revealing charts...");
              }}
            >
              Strike Colors
            </button>
          )}
          {roomRef.current && (
            <button
              className="px-3 py-1.5 rounded-lg bg-gray-700 text-white hover:bg-gray-900 dark:hover:bg-gray-600"
              onClick={async () => {
                try {
                  if (roomCode) {
                    saveLocalResume(roomCode, roleRef.current, {
                      exp: Date.now() + RESUME_WINDOW_MS,
                      playerGrid: playerGridRef.current,
                      playerFleet: playerFleetRef.current,
                      iAmReady: iAmReadyRef.current ?? false,
                      turn: turnRef.current,
                    });
                  }
                } catch {}
                try { await roomRef.current?.leave(); } catch {}
                setEntry("landing");
              }}
              title="Leave room"
            >
              Leave Theater
            </button>
          )}
        </div>
      </div>

      {!roomRef.current ? (
        <div className="text-sm text-gray-700 dark:text-gray-300">
          {role === "host" ? "Creating room…" : "Joining room…"}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-gray-800 dark:text-gray-200">
            Op Code: <b>{roomCode}</b>
          </span>
          <button
            className="px-3 py-1 rounded-lg text-sm bg-gray-700 text-white hover:bg-gray-900 dark:hover:bg-gray-600"
            onClick={() => {
              const { origin, pathname } = window.location;
              const isDark = document.documentElement.classList.contains("dark");
              const theme = isDark ? "dark" : "light";
              navigator.clipboard.writeText(`${origin}${pathname}?theme=${theme}${inviteHash}`);
            }}
          >
            Copy Signal Link
          </button>
        </div>
      )}
    </div>
  );

  /* ----------------- Title adornments via portal ----------------- */

  const hasDOM = typeof document !== "undefined";
  const inRoom = entry !== "landing" && !!roomRef.current;

  return (
    <div className="w-full">
      {/* title-left emblem (in-room only) */}
      {hasDOM && inRoom && (() => {
        const slot = document.getElementById("title-left-slot");
        return slot
          ? ReactDOM.createPortal(
              <span className="inline-flex items-center">
                <TeamEmblem
                  role={role}
                  Icon={MyEmblemIcon}
                  size={30}
                  title="Your fleet emblem"
                />
              </span>,
              slot
            )
          : null;
      })()}

      {/* title-right role label (in-room only) */}
      {hasDOM && inRoom && (() => {
        const slot = document.getElementById("title-right-slot");
        return slot
          ? ReactDOM.createPortal(
              <span className="text-xs sm:text-sm font-normal text-gray-600 dark:text-gray-300">
                ({role})
              </span>,
              slot
            )
          : null;
      })()}

      {/* ===== Header region (match battlefield shell) ===== */}
      <div
        className="w-full mx-auto px-4 md:px-6 overflow-x-clip"
        style={{ maxWidth: SHELL_MAXW }}
      >
        {mode === "mp" && <MPHeader />}

        {phase === "place" && (
          <div className="mt-6 flex items-center justify-between rounded-xl p-3 ring-1 ring-black/10 dark:ring-white/10 bg-gray-100 dark:bg-gray-800">
            <div className="text-sm font-medium text-gray-800 dark:text-gray-200">
              Vessels to deploy: <span className="tracking-wide">{toPlace.join(", ")}</span>
            </div>
            <div className="flex items-center gap-3" />
          </div>
        )}
      </div>

      {/* ===== Battlefield region (match header width) ===== */}
      <div className="w-full mt-6">
        {/* same width as header + small side padding */}
        <div
          className="relative mx-auto px-4 md:px-6 overflow-x-clip"
          style={{ maxWidth: SHELL_MAXW }}
        >
          {/* watermark now constrained to the same width */}
          <div className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center overflow-hidden">
            <WatermarkEmblem
              role={role}
              Icon={MyEmblemIcon}
              size={`min(1060px, calc(100% - ${WATERMARK_SAFE_INSET * 2}px))`}
              opacity={0.1}
            />
          </div>

          {/* foreground battlefield */}
          <div className="relative z-10">
            {mode === "bot" ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-8 2xl:gap-x-10">
                <BoardGrid
                  title={
                    <span className="inline-flex items-center gap-2">
                      <TeamEmblem role={role} Icon={role === "host" ? HostEmblemIcon : GuestEmblemIcon} size={14} />
                      Your Fleet
                    </span>
                  }
                  grid={playerGrid}
                  shots={playerShots}
                  revealShips
                  greenEllipseOnly
                  onCellClick={phase === "place" ? onPlaceClick : undefined}
                  disabled={phase !== "place"}
                />
                <BoardGrid
                  title={
                    <span className="inline-flex items-center gap-2">
                      <TeamEmblem role={role === "host" ? "guest" : "host"} Icon={role === "host" ? GuestEmblemIcon : HostEmblemIcon} size={14} />
                      Enemy Waters
                    </span>
                  }
                  grid={enemyGrid}
                  shots={enemyShots}
                  revealShips={phase === "over" && enemyRevealed}
                  onCellClick={onEnemyClick}
                  disabled={phase !== "play" || turn !== "player"}
                />
              </div>
            ) : (
              <>
                {/* Desktop and up: 3-column battlefield */}
                <div className="hidden md:block">
                  <div className="w-full">
                    <div 
                      className="grid gap-y-6 gap-x-10 xl:gap-x-12 2xl:gap-x-16"
                      style={{ gridTemplateColumns: `${SIDE_RAIL_PX}px minmax(0,1fr) ${SIDE_RAIL_PX}px`, columnGap: 80 }}
                    >
                      {/* LEFT RAIL — Compass (top) then Wardroom */}
                      <div className="mt-4" style={{ width: SIDE_RAIL_PX }}>
                        <div className="flex flex-col space-y-5">
                          <NavalCompass
                            dir={compassDir}
                            canInteract={phase === "place"}
                            onChoose={onCompassChoose}
                            Emblem={MyEmblemIcon}
                          />
                          {(phase === "play" || phase === "over") && (
                            <div className="w-full">
                              <div className="mx-auto w-full" style={{ maxWidth: RIGHT_FLEET_MAXW }}>
                                <BoardGrid
                                  title={
                                    <span className="inline-flex items-center gap-2">
                                      <TeamEmblem
                                        role={role}
                                        Icon={role === "host" ? HostEmblemIcon : GuestEmblemIcon}
                                        size={14}
                                      />
                                      Your Fleet
                                    </span>
                                  }
                                  grid={playerGrid}
                                  shots={playerShots}
                                  revealShips
                                  greenEllipseOnly
                                  disabled
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* CENTER (flexible; gets all extra width) */}
                      <div className="min-w-0" ref={enemyWrapRef}>
                        <div className="w-full">
                          {phase === "place" ? (
                            <div className="grid grid-cols-1 gap-6">
                              <div className="w-full">
                                <BoardGrid
                                  title="Deploy Your Fleet"
                                  grid={playerGrid}
                                  shots={playerShots}
                                  revealShips
                                  greenEllipseOnly
                                  onCellClick={onPlaceClick}
                                  disabled={toPlace.length === 0}
                                />
                              </div>

                              {iAmReady && !peerReady && (
                                <div className="text-sm text-gray-700 dark:text-gray-300">
                                  You’re ready. Waiting for opponent…
                                </div>
                              )}
                              {!iAmReady && peerReady && (
                                <div className="text-sm text-gray-700 dark:text-gray-300">
                                  Opponent is ready. Place your ships!
                                </div>
                              )}
                            </div>
                          ) : (
                            <BoardGrid
                              title={
                                <span className="inline-flex items-center gap-2">
                                  <TeamEmblem
                                    role={role === "host" ? "guest" : "host"}
                                    Icon={role === "host" ? GuestEmblemIcon : HostEmblemIcon}
                                    size={14}
                                  />
                                  Enemy Waters
                                </span>
                              }
                              grid={enemyGrid}
                              shots={enemyShots}
                              revealShips={phase === "over" && enemyRevealed}
                              onCellClick={phase === "play" ? onEnemyClick : undefined}
                              disabled={!peerPresent || phase !== "play" || turn !== "player"}
                            />
                          )}
                        </div>
                      </div>

                      {/* RIGHT RAIL — Signal Deck (top) then Your Fleet */}
                      <div style={{ width: SIDE_RAIL_PX }}>
                        {phase === "play" || phase === "over" ? (
                          <div className="space-y-6">
                            {/* Signal Deck */}
                            {roomRef.current && (
                              <SignalDeck
                                role={role}
                                Icon={MyEmblemIcon}
                                roleLabel={role}
                                log={intelLog}
                              />
                            )}

                            {/* Shrunk board, centered within the rail */}
                            <div className="rounded-2xl ring-1 ring-white/10 bg-white/5 shadow-lg p-3 text-sm text-gray-200 backdrop-blur">
                              <div className="font-semibold mb-1">Wardroom</div>
                              <div className="text-xs text-gray-400">Chat docks here…</div>
                            </div>
                          </div>
                        ) : (
                          // Pre-match: Signal Deck + Wardroom (Wardroom always visible)
                          <div className="space-y-6">
                            {roomRef.current && (
                              <SignalDeck
                                role={role}
                                Icon={MyEmblemIcon}
                                roleLabel={role}
                                log={intelLog}
                              />
                            )}
                            <div className="rounded-2xl ring-1 ring-white/10 bg-white/5 shadow-lg p-3 text-sm text-gray-200 backdrop-blur">
                              <div className="font-semibold mb-1">Wardroom</div>
                              <div className="text-xs text-gray-400">Chat docks here…</div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Mobile / <md: stacked boards */}
                <div className="md:hidden">
                  {phase === "place" ? (
                    <div className="mx-auto" style={{ width: PLACE_GRID_WIDTH }}>
                      <BoardGrid
                        title="Deploy Your Fleet"
                        grid={playerGrid}
                        shots={playerShots}
                        revealShips
                        greenEllipseOnly
                        onCellClick={onPlaceClick}
                        disabled={toPlace.length === 0}
                      />
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-6">
                      <BoardGrid
                        title="Your Fleet"
                        grid={playerGrid}
                        shots={playerShots}
                        revealShips
                        greenEllipseOnly
                        disabled
                      />
                      <BoardGrid
                        title="Enemy Waters"
                        grid={enemyGrid}
                        shots={enemyShots}
                        revealShips={phase === "over" && enemyRevealed}
                        onCellClick={phase === "play" ? onEnemyClick : undefined}
                        disabled={!peerPresent || phase !== "play" || turn !== "player"}
                      />
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Bottom bar */}
            <div className="mt-6 flex items-center justify-between">
              {mode === "bot" ? (
                <button
                  onClick={resetLocal}
                  className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-500 via-purple-600 to-purple-700 text-white shadow hover:opacity-90"
                >
                  Refit
                </button>
              ) : roomRef.current ? (
                phase === "over" ? (
                  <button
                    onClick={() => {
                      try { roomRef.current?.rematch("propose", roleRef.current); } catch {}
                      setMsg("Requesting re-engagement...");
                    }}
                    className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-500 via-purple-600 to-purple-700 text-white shadow hover:opacity-90"
                  >
                    Rearm & Reengage
                  </button>
                ) : (
                  <div />
                )
              ) : (
                <div />
              )}
              <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">{msg}</div>
            </div>

            {rematchAskFromPeer && (
              <div className="flex items-center gap-3 text-sm text-gray-800 dark:text-gray-200">
                Opponent wants a rematch. Accept?
                <button
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white"
                  onClick={() => {
                    try { roomRef.current?.rematch("accept", roleRef.current); } catch {}
                    setRematchAskFromPeer(null);
                    resetLocal();
                    setMsg("Rematch starting. Place your ships.");
                  }}
                >
                  Yes
                </button>
                <button
                  className="px-3 py-1.5 rounded-lg bg-gray-600 text-white"
                  onClick={() => {
                    try { roomRef.current?.rematch("decline", roleRef.current); } catch {}
                    setRematchAskFromPeer(null);
                    setMsg("Rematch declined.");
                  }}
                >
                  No
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}





// // src/components/games/battleship/BattleshipWeb.tsx

// import { ReactComponent as AnchorCrest } from "../../../assets/anchor-crest.svg";
// import { ReactComponent as LifebuoyRope } from "../../../assets/lifebuoy-rope.svg";
// import { ReactComponent as CompassShield } from "../../../assets/compass-shield.svg";
// import { ReactComponent as TridentWaves } from "../../../assets/trident-waves.svg";
// import { ReactComponent as HelmStar } from "../../../assets/helm-star.svg";

// import React from "react";
// import ReactDOM from "react-dom";

// import {
//   SIZE, FLEET_SIZES, Orientation,
//   Grid, Shots, Fleet,
//   makeGrid, makeShots, randomFleet,
//   placeShip, canPlace, receiveShot, allSunk,
//   makeAIState, aiPick, aiOnHit,
// } from "lib/battleship";

// import {
//   MPMode, Role, generateCode, parseRoomCodeFromHash, buildInviteHash,
//   createFirebaseAdapter,
// } from "lib/mp";

// import { Room } from "lib/mp/room";

// /* ----------------- UI bits ----------------- */
// const cellBase =
//   "relative aspect-square rounded-md ring-1 transition select-none " +
//   "ring-gray-300 dark:ring-white/10 bg-gray-100 dark:bg-gray-800 " +
//   "hover:bg-gray-200 dark:hover:bg-gray-700 flex items-center justify-center";

// // Controls the width of the *single* placement grid (MP only)
// const PLACE_GRID_WIDTH = "min(92vw, 520px)"; // tweak freely (e.g., "min(90vw, 460px)")

// // --- Emblem pool (ordered list) ---
// const EMBLEMS = [AnchorCrest, LifebuoyRope, CompassShield, TridentWaves, HelmStar] as const;

// // --- Deterministic hash (FNV-1a-ish) to keep picks stable per session ---
// function hashSeed(str: string): number {
//   let h = 2166136261 >>> 0;
//   for (let i = 0; i < str.length; i++) {
//     h ^= str.charCodeAt(i);
//     h = Math.imul(h, 16777619);
//   }
//   return h >>> 0;
// }

// const HitMark = () => (
//   <svg viewBox="0 0 100 100" className="w-2/3 h-2/3 text-rose-500 dark:text-rose-300">
//     <line x1="20" y1="20" x2="80" y2="80" stroke="currentColor" strokeWidth="12" strokeLinecap="round" />
//     <line x1="80" y1="20" x2="20" y2="80" stroke="currentColor" strokeWidth="12" strokeLinecap="round" />
//   </svg>
// );
// const MissMark = () => (
//   <svg viewBox="0 0 100 100" className="w-1/3 h-1/3 text-gray-500 dark:text-gray-400">
//     <circle cx="50" cy="50" r="15" stroke="currentColor" strokeWidth="8" fill="none" />
//   </svg>
// );

// // simple, crisp line icons that inherit currentColor
// const IconSignal: React.FC<React.SVGProps<SVGSVGElement>> = (p) => (
//   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
//        strokeLinecap="round" strokeLinejoin="round" width="1em" height="1em" {...p}>
//     <path d="M2 20a10 10 0 0 1 20 0" />
//     <path d="M6 20a6 6 0 0 1 12 0" />
//     <path d="M10 20a2 2 0 0 1 4 0" />
//   </svg>
// );

// const IconLink: React.FC<React.SVGProps<SVGSVGElement>> = (p) => (
//   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
//        strokeLinecap="round" strokeLinejoin="round" width="1em" height="1em" {...p}>
//     <path d="M10 13a5 5 0 0 0 7.07 0l1.17-1.17a5 5 0 0 0-7.07-7.07L9.9 5"/>
//     <path d="M14 11a5 5 0 0 0-7.07 0L5.76 12.2a5 5 0 0 0 7.07 7.07L14.1 19"/>
//   </svg>
// );

// const IconCpu: React.FC<React.SVGProps<SVGSVGElement>> = (p) => (
//   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
//        strokeLinecap="round" strokeLinejoin="round" width="1em" height="1em" {...p}>
//     <rect x="6" y="6" width="12" height="12" rx="2"/>
//     <path d="M9 1v3M15 1v3M9 20v3M15 20v3M1 9h3M1 15h3M20 9h3M20 15h3"/>
//   </svg>
// );

// // --- Team emblem badge (SVG from assets; accepts a chosen Icon) ---
// const TeamEmblem: React.FC<{
//   role: Role;
//   Icon?: React.FunctionComponent<React.SVGProps<SVGSVGElement>>;
//   size?: number;
//   title?: string;
// }> = ({ role, Icon, size = 40, title }) => {
//   const bubble =
//     role === "host"
//       ? "bg-blue-600/10 text-blue-700 dark:text-blue-300"
//       : "bg-emerald-600/10 text-emerald-600 dark:text-emerald-300";

//   const iconSize = Math.max(10, size - 4);
//   // Fallback: if no Icon passed, default to basic role icons
//   const Fallback = role === "host" ? AnchorCrest : LifebuoyRope;
//   const IconToUse = Icon ?? Fallback;

//   return (
//     <span
//       className={`inline-flex items-center justify-center rounded-full ring-1 ring-black/10 dark:ring-white/10 ${bubble}`}
//       style={{ width: size, height: size }}
//       aria-label={title ?? (role === "host" ? "Host emblem" : "Guest emblem")}
//       title={title ?? (role === "host" ? "Host emblem" : "Guest emblem")}
//     >
//       <IconToUse width={iconSize} height={iconSize} aria-hidden="true" />
//     </span>
//   );
// };

// const WATERMARK_SAFE_INSET = 4; // ← tweak this: 48..96 works well

// const WatermarkEmblem: React.FC<{
//   role: Role;
//   Icon: React.FunctionComponent<React.SVGProps<SVGSVGElement>>;
//   size?: number | string;    // px number or CSS string (e.g., "56vw")
//   opacity?: number;          // overall fade (0..1)
//   ring?: boolean;            // keep subtle ring
// }> = ({ role, Icon, size = 520, opacity = 1, ring = true }) => {
//   // EXACT same palette as TeamEmblem
//   const bubbleBgClass = role === "host" ? "bg-blue-600/10" : "bg-emerald-600/10";
//   const iconColorClass = role === "host"
//     ? "text-blue-700 dark:text-blue-300"
//     : "text-emerald-600 dark:text-emerald-300";
//   const ringClass = ring ? "ring-1 ring-black/10 dark:ring-white/10" : "";

//   const dim = typeof size === "number" ? `${size}px` : size;

//   return (
//     // sized box; parent flex will center this in the viewport
//     <div className="relative pointer-events-none" style={{ width: dim, height: dim, opacity }}>
//       {/* badge (big circle) */}
//       <div className={`absolute inset-0 rounded-full ${bubbleBgClass} ${ringClass}`} aria-hidden />
//       {/* emblem icon tinted exactly like TeamEmblem */}
//       <Icon
//         className={`absolute ${iconColorClass}`}
//         style={{ top: 12, right: 12, bottom: 12, left: 12, position: "absolute" }} // inner padding
//         aria-hidden="true"
//       />
//     </div>
//   );
// };


// /* -------- sunk overlays -------- */
// type SunkOverlay = { r0: number; c0: number; r1: number; c1: number; cells: string[]; };
// function computeSunkOverlays(grid: Grid, shots: Shots): SunkOverlay[] {
//   const byId: Record<number, Array<[number, number]>> = {};
//   for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
//     const id = grid[r][c]; if (id > 0) (byId[id] ||= []).push([r, c]);
//   }
//   const out: SunkOverlay[] = [];
//   for (const id of Object.keys(byId)) {
//     const cells = byId[Number(id)];
//     const sunk = cells.every(([r, c]) => shots[r][c] === 2);
//     if (!sunk) continue;
//     let r0 = Infinity, c0 = Infinity, r1 = -1, c1 = -1;
//     const keys: string[] = [];
//     for (const [r, c] of cells) {
//       if (r < r0) r0 = r; if (c < c0) c0 = c;
//       if (r > r1) r1 = r; if (c > c1) c1 = c;
//       keys.push(`${r},${c}`);
//     }
//     out.push({ r0, c0, r1, c1, cells: keys });
//   }
//   return out;
// }

// function BoardGrid({
//   title, grid, shots, revealShips = false, onCellClick, disabled = false,
//   greenEllipseOnly = false,
// }: {
//   title: React.ReactNode;
//   grid: Grid;
//   shots: Shots;
//   revealShips?: boolean;
//   onCellClick?: (r: number, c: number) => void;
//   disabled?: boolean;
//   greenEllipseOnly?: boolean;
// }) {
//   const wrapRef = React.useRef<HTMLDivElement>(null);
//   const [metrics, setMetrics] = React.useState<{ cell: number; gap: number; pad: number } | null>(null);

//   const sunkOverlays = React.useMemo(() => computeSunkOverlays(grid, shots), [grid, shots]);
//   const sunkCells = React.useMemo(() => {
//     const s = new Set<string>();
//     sunkOverlays.forEach(o => o.cells.forEach(k => s.add(k)));
//     return s;
//   }, [sunkOverlays]);

//   React.useLayoutEffect(() => {
//     const el = wrapRef.current; if (!el) return;
//     const ro = new ResizeObserver(() => {
//       const firstBtn = el.querySelector<HTMLButtonElement>('button[data-rc="0,0"]');
//       const nextBtn  = el.querySelector<HTMLButtonElement>('button[data-rc="0,1"]');
//       if (!firstBtn || !nextBtn) return;
//       const wrapBox = el.getBoundingClientRect();
//       const a = firstBtn.getBoundingClientRect();
//       const b = nextBtn.getBoundingClientRect();
//       const cell = a.width;
//       const gap = Math.max(0, b.left - a.right);
//       const padLeft = a.left - wrapBox.left;
//       setMetrics({ cell, gap, pad: padLeft });
//     });
//     ro.observe(el);
//     return () => ro.disconnect();
//   }, []);

//   return (
//     <div className="w-full">
//       <div className="mb-2 font-semibold text-gray-700 dark:text-gray-200">{title}</div>

//       <div ref={wrapRef} className="relative grid grid-cols-10 gap-1 p-2 rounded-xl bg-gray-200 dark:bg-gray-900 ring-1 ring-black/10 dark:ring-white/10">
//         {Array.from({ length: SIZE * SIZE }).map((_, i) => {
//           const r = Math.floor(i / SIZE), c = i % SIZE;
//           const shipId = grid[r][c];
//           const shot = shots[r][c];

//           const canClick = !disabled && !!onCellClick && shot === 0;
//           const classes = cellBase + (canClick ? " cursor-pointer" : " cursor-default");

//           const inSunk = sunkCells.has(`${r},${c}`);
//           const showGreen = revealShips && shipId > 0;

//           return (
//             <button
//               key={`cell-${title}-${r}-${c}`}
//               data-rc={`${r},${c}`}
//               className={classes}
//               onClick={canClick ? () => onCellClick!(r, c) : undefined}
//               disabled={!canClick}
//               aria-label={`${title} ${r},${c}`}
//             >
//               {/* emerald pill for any ship (non-sunk) cells when revealShips is true */}
//               {showGreen && greenEllipseOnly && (
//                 <span className="absolute inset-0 rounded-full bg-emerald-500/25 dark:bg-emerald-400/20 pointer-events-none" />
//               )}
//               {showGreen && !greenEllipseOnly && (
//                 <span className="absolute inset-0 rounded-lg bg-emerald-500/20 dark:bg-emerald-400/20 pointer-events-none" />
//               )}
//               {/* hide X when entire ship sunk; always show O for misses */}
//               {!inSunk && (shot === 2 ? <HitMark /> : shot === 1 ? <MissMark /> : null)}
//             </button>
//           );
//         })}

//         {/* sunk overlays (red pill) */}
//         {metrics &&
//           sunkOverlays.map((o, idx) => {
//             const { cell, gap, pad } = metrics;
//             const x = pad + o.c0 * (cell + gap);
//             const y = pad + o.r0 * (cell + gap);
//             const w = (o.c1 - o.c0 + 1) * cell + (o.c1 - o.c0) * gap;
//             const h = (o.r1 - o.r0 + 1) * cell + (o.r1 - o.r0) * gap;
//             const radius = Math.min(w, h) / 2;
//             return (
//               <div
//                 key={`sunk-${idx}`}
//                 className="absolute pointer-events-none bg-rose-500/30 ring-1 ring-rose-500/40"
//                 style={{ left: x, top: y, width: w, height: h, borderRadius: radius }}
//                 aria-hidden
//                 title="Sunk vessel"
//               />
//             );
//           })}
//       </div>
//     </div>
//   );
// }

// /* ----------------- Main ----------------- */
// type Phase = "place" | "play" | "over";
// type Entry = "landing" | "bot" | "mp";
// type Props = { onRegisterReset?: (fn: () => void) => void; };

// export default function BattleshipWeb({ onRegisterReset }: Props) {
//   // Invite link detection
//   const codeFromHash = parseRoomCodeFromHash() || "";
//   const fromInvite = !!codeFromHash;

//   // Landing vs Bot vs MP
//   const [entry, setEntry] = React.useState<Entry>(fromInvite ? "mp" : "landing");
//   const [mode, setMode] = React.useState<MPMode>(() => (fromInvite ? "mp" : "bot"));
//   const [role, setRole] = React.useState<Role>(fromInvite ? "guest" : "host");
//   const [roomCode, setRoomCode] = React.useState<string>(() => codeFromHash);

//   // Landing “Join Room” inline box
//   const [landingJoinOpen, setLandingJoinOpen] = React.useState(false);
//   const [joinCode, setJoinCode] = React.useState("");

//   // MP
//   const roomRef = React.useRef<Room | null>(null);

//   // [FIX] Show emblem only after we've ever seen the peer at least once this session
//   const everHadPeerRef = React.useRef(false);

//   // Game state
//   const [phase, setPhase] = React.useState<Phase>("place");
//   const [orientation, setOrientation] = React.useState<Orientation>("H");

//   // [FIX] session id for emblem seeding
//   const [epoch, setEpoch] = React.useState<number>(0);

//   // Player
//   const [playerGrid, setPlayerGrid]   = React.useState<Grid>(() => makeGrid());
//   const [playerFleet, setPlayerFleet] = React.useState<Fleet>({});
//   const [playerShots, setPlayerShots] = React.useState<Shots>(() => makeShots());

//   // Enemy
//   const [enemyGrid, setEnemyGrid]   = React.useState<Grid>(() => makeGrid());
//   const [enemyFleet, setEnemyFleet] = React.useState<Fleet>({});
//   const [enemyShots, setEnemyShots] = React.useState<Shots>(() => makeShots());

//   const [toPlace, setToPlace] = React.useState<number[]>(() => [...FLEET_SIZES]);
//   const [turn, setTurn] = React.useState<"player" | "ai">("player");
//   const [msg, setMsg] = React.useState("Deploy your fleet (press R to rotate)");

//   // ask/answer flow for rematch when game is over (incl. quit)
//   const [rematchAskFromPeer, setRematchAskFromPeer] = React.useState<null | Role>(null);

//   const turnRef = React.useRef(turn);
//   React.useEffect(() => { turnRef.current = turn; }, [turn]);

//   // live refs for MP handlers
//   const phaseRef = React.useRef(phase);
//   const roleRef = React.useRef(role);
//   const playerGridRef = React.useRef(playerGrid);
//   const playerFleetRef = React.useRef(playerFleet);
//   const playerShotsRef = React.useRef(playerShots);
//   // // presence ack bookkeeping
//   // const lastHelloFromPeerAtRef = React.useRef(0);
//   const lastHelloAckSentAtRef = React.useRef(0);
//   // [FIX] indicates a grace-resume is in progress (prevents resetting turn)
//   const resumedWithinGraceRef = React.useRef(false);

//   React.useEffect(() => { phaseRef.current = phase; }, [phase]);
//   React.useEffect(() => { roleRef.current = role; }, [role]);
//   React.useEffect(() => { playerGridRef.current = playerGrid; }, [playerGrid]);
//   React.useEffect(() => { playerFleetRef.current = playerFleet; }, [playerFleet]);
//   React.useEffect(() => { playerShotsRef.current = playerShots; }, [playerShots]);

//   // reveal state
//   const [enemyRevealed, setEnemyRevealed] = React.useState(false);
//   const sentRevealRef = React.useRef(false);

//   const aiRef = React.useRef(makeAIState());

//   // Ready flags
//   const [iAmReady, setIAmReady] = React.useState(false);
//   const [peerReady, setPeerReady] = React.useState(false);

//   const peerReadyRef = React.useRef(peerReady);
//   React.useEffect(() => { peerReadyRef.current = peerReady; }, [peerReady]);

//   const iAmReadyRef = React.useRef(iAmReady);
//   React.useEffect(() => { iAmReadyRef.current = iAmReady; }, [iAmReady]);

//   // MP presence/status of the *opponent*
//   const [peerPresent, setPeerPresent] = React.useState(false);
//   const [peerState, setPeerState] = React.useState<"joining" | "placing" | "ready" | "quit" | "left">("joining");

//   // Presence tracking for timers
//   const peerPresentRef = React.useRef(peerPresent);
//   React.useEffect(() => { peerPresentRef.current = peerPresent; }, [peerPresent]);
//   const rejoinTimerRef = React.useRef<number | null>(null);
//   const lastByeAtRef = React.useRef<number | null>(null);
//   const RESUME_WINDOW_MS = 30_000;

//    // [FIX] use localStorage so new tabs (invite link) can resume within 30s
//   const saveLocalResume = React.useCallback(
//     (code: string, role: Role, blob: ResumeBlob) => {
//       try {
//         localStorage.setItem(resumeKey(code, role), JSON.stringify(blob));
//       } catch {}
//     },
//     [] // no closures; safe to keep empty
//   );

//   React.useEffect(() => {
//     const onBeforeUnload = () => {
//       if (!roomCode || !roomRef.current) return; // no active MP session
//       try {
//         saveLocalResume(roomCode, roleRef.current, {
//           exp: Date.now() + RESUME_WINDOW_MS,
//           playerGrid: playerGridRef.current,
//           playerFleet: playerFleetRef.current,
//           iAmReady: iAmReadyRef.current ?? false,
//           turn: turnRef.current, // [FIX]
//         });
//       } catch {}
//     };
//     window.addEventListener("beforeunload", onBeforeUnload);
//     return () => window.removeEventListener("beforeunload", onBeforeUnload);
//   }, [roomCode, saveLocalResume]); // rebind when room changes

//   // [ADD] sessionStorage key helpers for per-room, per-role resumes
//   const resumeKey = (code: string, role: Role) => `bs:${code}:${role}:resume-v1` as const;

//   type ResumeBlob = {
//     exp: number;                  // expiry timestamp
//     playerGrid: Grid;
//     playerFleet: Fleet;
//     iAmReady: boolean;
//     turn: "player" | "ai";        // [FIX] preserve whose turn it was
//   };

//   function loadLocalResume(code: string, role: Role): ResumeBlob | null {
//     try {
//       const raw = localStorage.getItem(resumeKey(code, role));
//       if (!raw) return null;
//       const data = JSON.parse(raw) as ResumeBlob;
//       if (!data || Date.now() > data.exp) return null; // expired
//       return data;
//     } catch { return null; }
//   }
//   function clearLocalResume(code: string, role: Role) {
//     try { localStorage.removeItem(resumeKey(code, role)); } catch {}
//   }

//   // Snapshot buffer for resume
//   const lastSnapshotRef = React.useRef<any>(null);

//   // helper: build a compact state snapshot to send to the peer
//   const buildStateSnapshot = React.useCallback(() => ({
//     phase,
//     turn,
//     playerGrid,
//     playerFleet,
//     playerShots,
//     enemyGrid,
//     enemyFleet,
//     enemyShots,
//     iAmReady,
//     peerReady,
//     msg,
//   }), [
//     phase, turn,
//     playerGrid, playerFleet, playerShots,
//     enemyGrid, enemyFleet, enemyShots,
//     iAmReady, peerReady, msg
//   ]);

//   // apply a snapshot received from the peer (used when I rejoin)
//   const applyStateSnapshot = React.useCallback((s: any) => {
//     try {
//       if (s.phase) setPhase(s.phase);
//       if (s.turn) setTurn(s.turn);
//       if (s.playerGrid) setPlayerGrid(s.playerGrid);
//       if (s.playerFleet) setPlayerFleet(s.playerFleet);
//       if (s.playerShots) setPlayerShots(s.playerShots);
//       if (s.enemyGrid) setEnemyGrid(s.enemyGrid);
//       if (s.enemyFleet) setEnemyFleet(s.enemyFleet);
//       if (s.enemyShots) setEnemyShots(s.enemyShots);
//       if (typeof s.iAmReady === "boolean") setIAmReady(s.iAmReady);
//       if (typeof s.peerReady === "boolean") setPeerReady(s.peerReady);
//       if (typeof s.msg === "string") setMsg(s.msg);
//       setEnemyRevealed(false); // on resume, do NOT reveal
//     } catch {}
//   }, []);

//   // keep snapshot fresh at key points (local only)
//   const captureStateSnapshot = React.useCallback(() => {
//     lastSnapshotRef.current = buildStateSnapshot();
//   }, [buildStateSnapshot]);

//   // Seed bot enemy when needed
//   React.useEffect(() => {
//     if (mode === "bot") {
//       const { grid, fleet } = randomFleet();
//       setEnemyGrid(grid); setEnemyFleet(fleet);
//     }
//   }, [mode]);

//   // Global rotate hotkey — ignore if user is typing
//   React.useEffect(() => {
//     const onKey = (e: KeyboardEvent) => {
//       const target = e.target as HTMLElement | null;
//       if (target && (target.closest('input, textarea, [contenteditable="true"]'))) return;
//       if (phase === "place" && (e.key === "r" || e.key === "R")) {
//         setOrientation((o) => (o === "H" ? "V" : "H"));
//       }
//     };
//     window.addEventListener("keydown", onKey);
//     return () => window.removeEventListener("keydown", onKey);
//   }, [phase]);

//   // Reset (local)
//   const resetLocal = React.useCallback(() => {
//     setPeerState(prev => (prev === "quit" ? (peerPresent ? "present" : "left") : prev));
//     setPhase("place"); setOrientation("H");
//     setPlayerGrid(makeGrid()); setPlayerFleet({});
//     setPlayerShots(makeShots());
//     setEnemyGrid(makeGrid()); setEnemyFleet({});
//     setEnemyShots(makeShots());
//     setToPlace([...FLEET_SIZES]);
//     setTurn("player");
//     aiRef.current = makeAIState();
//     setMsg("Deploy your fleet (press R to rotate)");
//     setIAmReady(false); setPeerReady(false);
//     setEnemyRevealed(false);
//     sentRevealRef.current = false;
//     lastSnapshotRef.current = null;

//     if (mode === "bot") {
//       const { grid, fleet } = randomFleet(); setEnemyGrid(grid); setEnemyFleet(fleet);
//     }
//   }, [mode, peerPresent]);

//   /* ---- MP wiring ---- */
//   const ensureRoom = React.useCallback(async (asHost: boolean) => {
//     const adapter = await createFirebaseAdapter();
//     const code = asHost ? (roomCode || generateCode()) : roomCode;
//     if (!code) return;
//     setRoomCode(code);

//     // If I'm host, I'm waiting for a guest; if I'm guest, host already exists
//     setPeerState(asHost ? "joining" : "present");
//     setPeerPresent(!asHost);

//     const r = new Room(adapter, code, asHost ? "host" : "guest", {
//       onShot: ({ by, r, c }) => {
//         const myRole = roleRef.current;
//         const theyTargetedUs = (by === "host" && myRole === "guest") || (by === "guest" && myRole === "host");
//         if (!theyTargetedUs) return;

//         const res = receiveShot(
//           playerGridRef.current,
//           playerShotsRef.current,
//           playerFleetRef.current,
//           r, c
//         );
//         setPlayerShots(() => res.shots);
//         setPlayerFleet(() => res.fleet);

//         // tell attacker their result
//         roomRef.current?.result(by, (res.result === "hit" || res.result === "sunk") ? res.result : "miss", r, c);

//         if (allSunk(res.fleet)) {
//           setPhase("over");
//           setEnemyRevealed(true);
//           setMsg("Enemy fleet prevails—mission failed.");
//           roomRef.current?.phase("over");
//         } else {
//           setTurn("player");
//           setMsg(res.result === "miss" ? "Their salvo splashed—your move!" : "We’re hit—return fire!");
//         }
//         captureStateSnapshot();
//       },

//       onResult: ({ to, result, r, c }) => {
//         const myRole = roleRef.current;
//         if (to !== myRole) return;
//         setEnemyShots(prev => {
//           const next = prev.map(row => row.slice());
//           next[r][c] = result === "miss" ? 1 : 2;
//           return next;
//         });
//         setMsg(
//           result === "sunk" ? "Ship down! Passing initiative..." :
//           result === "hit"  ? "Direct hit! Opponent’s turn..." :
//                               "Shot wide—opponent’s turn..."
//         );
//         setTurn("ai");
//         captureStateSnapshot();
//       },

//       onPhase: (ph) => {
//         if (ph === "over" && !peerPresentRef.current) return;
//         setPhase(ph);
//         captureStateSnapshot();
//       },

//       onRematch: () => resetLocal(),

//       onReady: ({ by, ready }) => {
//         const me = roleRef.current;
//         if (by === me) {
//           setIAmReady(ready);
//         } else {
//           setPeerReady(ready);
//         }

//         // [FIX] If both are ready and we’re not in play, host authoritatively resumes play.
//         // This covers rejoin where the leaver re-emits ready after restoring.
//         const bothReady = (by === me ? ready : iAmReadyRef.current) && (by === me ? peerReadyRef.current : ready);
//         if (bothReady && phaseRef.current !== "play" && me === "host") {
//           try { roomRef.current?.phase("play"); } catch {}
//         }
//       },

//       // 30s grace on disconnect — no reveal, no reset yet
//       onPeerBye: async () => {
//         lastByeAtRef.current = Date.now();
//         setPeerPresent(false);
//         setPeerState("left");
//         setPeerReady(false);
//         setMsg("Contact lost—holding station for 30 s...");

//         if (rejoinTimerRef.current) clearTimeout(rejoinTimerRef.current);
//         rejoinTimerRef.current = window.setTimeout(async () => {
//           rejoinTimerRef.current = null;
//           if (peerPresentRef.current) return; // returned in time
//           if (roleRef.current === "host") {
//             try { await roomRef.current?.bumpEpoch(); } catch {}
//           }
//           resetLocal();
//           setPeerState("joining");
//           setMsg("No contact—awaiting new vessel...");
//         }, RESUME_WINDOW_MS); // <— use constant
//       },

//       onPeerHello: (by) => {
//         const now = Date.now();

//         everHadPeerRef.current = true; // [FIX] we have seen the peer in this session
//         setPeerPresent(true);
//         setPeerState(phase === "place" ? "placing" : "present");
//         setMsg(phase === "play" ? "Comms restored—engagement resumes." : "New contact—battle stations.");

//         if (rejoinTimerRef.current) {
//           clearTimeout(rejoinTimerRef.current);
//           rejoinTimerRef.current = null;
//         }

//         if (now - lastHelloAckSentAtRef.current > 2000) {
//           try { roomRef.current?.hello(roleRef.current); } catch {}
//           lastHelloAckSentAtRef.current = now;
//         }
//       },

//       onQuit: () => {
//         setPeerState("quit");
//         setPhase("over");
//         setMsg("Enemy struck colors. Revealing charts...");
//         // reveal only on Quit (never on Leave)
//         if (!sentRevealRef.current) {
//           sentRevealRef.current = true;
//           try {
//             roomRef.current?.reveal(
//               roleRef.current, playerGridRef.current as any, playerFleetRef.current as any
//             );
//           } catch {}
//         }
//       },

//       onRematchSignal: ({ action, by }) => {
//         const me = roleRef.current;
//         if (action === "propose" && by !== me) {
//           setRematchAskFromPeer(by);
//           setMsg("Enemy requests re-engagement. Accept?");
//         } else if (action === "accept") {
//           setRematchAskFromPeer(null);
//           resetLocal();
//           setMsg("Rearm complete—deploy your fleet.");
//         } else if (action === "decline") {
//           setRematchAskFromPeer(null);
//           setMsg("Re-engagement declined.");
//         }
//       },

//       onEpoch: (n) => {
//         setEpoch(typeof n === "number" ? n : 0);
//         everHadPeerRef.current = false; // [FIX] new session: no peer yet
//         resetLocal();
//         setMsg("New operation initiated.");
//       },

//       onReveal: ({ by, grid, fleet }) => {
//         const mine = roleRef.current;
//         if (by === mine) return;
//         setEnemyGrid(grid as unknown as Grid);
//         setEnemyFleet(fleet as unknown as Fleet);
//         setEnemyRevealed(true);
//       },

//       // Resume handler: apply peer’s snapshot if I’m the one who rejoined
//       onState: ({ by, state }) => {
//         const me = roleRef.current;
//         if (by === me) return;
//         applyStateSnapshot(state);
//         setMsg("State synced—resume engagement.");
//       },
//     });

//     roomRef.current = r;
//     setRole(asHost ? "host" : "guest");

//     if (asHost) {
//       const e = (await (r.create() as unknown)) as number | void; // may return epoch
//       setPeerPresent(false);
//       setPeerState("joining");
//       if (typeof e === "number") setEpoch(e); // [FIX] seed from connect

//       const blobH = loadLocalResume(code, "host");
//       if (blobH) {
//         setPlayerGrid(blobH.playerGrid);
//         setPlayerFleet(blobH.playerFleet);
//         setIAmReady(!!blobH.iAmReady);
//         setTurn(blobH.turn); // [FIX]
//         try {
//           if (blobH.iAmReady) { roomRef.current?.ready("host", true); }
//         } catch {}
//         clearLocalResume(code, "host");
//         resumedWithinGraceRef.current = true; // [FIX]
//         setMsg("Your fleet restored—awaiting enemy.");
//       }

//     } else {
//       const e = (await (r.join() as unknown)) as number | void; // may return epoch
//       if (typeof e === "number") setEpoch(e); // [FIX] seed from connect

//       // [ADD] Attempt local resume if within 30s and same room
//       const blob = loadLocalResume(code, "guest");
//       if (blob) {
//         setPlayerGrid(blob.playerGrid);
//         setPlayerFleet(blob.playerFleet);
//         setIAmReady(!!blob.iAmReady);
//         setTurn(blob.turn); // [FIX] keep the real turn
//         try {
//           if (blob.iAmReady) { roomRef.current?.ready("guest", true); }
//         } catch {}
//         clearLocalResume(code, "guest");
//         resumedWithinGraceRef.current = true; // [FIX] don't reset turn in ready gate
//         setMsg("Your fleet restored—checking contact...");
//       }
//     }
//     // proactively say hello once we’re connected (idempotent)
//     try { roomRef.current?.hello(roleRef.current); } catch {}
//   // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, []);

//   // [ADD] if both ready but not in play (e.g., rejoin ordering), host asserts play once.
//   React.useEffect(() => {
//     if (iAmReady && peerReady && phase !== "play" && roleRef.current === "host" && roomRef.current) {
//       try { roomRef.current.phase("play"); } catch {}
//     }
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [iAmReady, peerReady, phase]);

//   // nudge the peer if we still think they're absent shortly after connect
//   React.useEffect(() => {
//     if (!peerPresent && roomRef.current) {
//       const id = window.setTimeout(() => {
//         if (!peerPresent && roomRef.current) {
//           try { roomRef.current.hello(roleRef.current); } catch {}
//         }
//       }, 1000); // 1s after mount/rejoin
//       return () => clearTimeout(id);
//     }
//   }, [peerPresent]);

//   // DIRECT INVITE: auto-join room immediately (skip 3-button landing)
//   React.useEffect(() => {
//     if (!fromInvite) return;
//     if (roomRef.current) return;
//     setEntry("mp");
//     setMode("mp");
//     setRole("guest");
//     setRoomCode(codeFromHash);
//     ensureRoom(false); // join as guest
//     setMsg("Establishing comms...");
//   }, [fromInvite, codeFromHash, ensureRoom]);

//   /* ---- Placement ---- */
//   const onPlaceClick = (r: number, c: number) => {
//     if (phase !== "place" || toPlace.length === 0) return;
//     const length = toPlace[0];
//     if (!canPlace(playerGrid, r, c, length, orientation)) { setMsg("Negative—collision course."); return; }
//     const nextId = Object.keys(playerFleet).length + 1;
//     const res = placeShip(playerGrid, playerFleet, nextId, r, c, length, orientation);
//     setPlayerGrid(res.grid); setPlayerFleet(res.fleet);

//     const remaining = toPlace.slice(1);
//     setToPlace(remaining);
//     setMsg(remaining.length ? `Laid down ${length}-deck ship. Next: ${remaining[0]} (press R to rotate)` : "Fleet deployed—stand by.");

//     captureStateSnapshot();

//     if (remaining.length === 0) {
//       if (mode === "bot") {
//         setPhase("play"); setTurn("player"); setMsg("Fire for effect →");
//       } else {
//         setIAmReady(true);
//         try { roomRef.current?.ready(roleRef.current, true); } catch {}
//         setMsg("Standing by—awaiting enemy deployment...");
//       }
//       captureStateSnapshot();
//     }
//   };

//   /* ---- Bot turn ---- */
//   const aiTurn = () => {
//     const ai = aiRef.current;
//     const [rr, cc] = aiPick(playerShots, ai);
//     const res = receiveShot(playerGrid, playerShots, playerFleet, rr, cc);
//     setPlayerShots(res.shots); setPlayerFleet(res.fleet);
//     if (res.result === "hit" || res.result === "sunk") aiOnHit(rr, cc, res.shots, ai);
//     if (allSunk(res.fleet)) {
//       setPhase("over");
//       setEnemyRevealed(true);
//       setMsg("Training Bot prevails—our fleet is sunk.");
//       return;
//     }
//     setTurn("player"); setMsg(res.result === "miss" ? "Training salvo wide—your guns!" : "We’re hit—return fire!");
//   };

//   /* ---- Fire on enemy ---- */
//   const onEnemyClick = (r: number, c: number) => {
//     if (phase !== "play") return;

//     if (mode === "bot") {
//       if (turn !== "player" || enemyShots[r][c] !== 0) return;
//       try {
//         const res = receiveShot(enemyGrid, enemyShots, enemyFleet, r, c);
//         setEnemyShots(res.shots); setEnemyFleet(res.fleet);
//         if (allSunk(res.fleet)) {
//           setPhase("over"); setMsg("Enemy fleet sunk—victory! 🎖️");
//           setEnemyRevealed(true);
//           return;
//         }
//         setTurn("ai"); setMsg(res.result === "miss" ? "You missed. Bot's turn…" : "Hit! Bot's turn…");
//         setTimeout(() => aiTurn(), 400);
//       } catch { /* noop */ }
//       return;
//     }

//     // MP
//     if (turn !== "player" || enemyShots[r][c] !== 0 || !peerPresent) return;
//     roomRef.current?.shot(roleRef.current, r, c);
//     setMsg("Rounds away—awaiting splash...");
//   };

//   /* ---- Ready gate ---- */
//   React.useEffect(() => {
//     if (mode !== "mp") return;
//     if (phase !== "place") return;
//     if (!iAmReady || !peerReady) return;

//     setPhase("play");

//     if (!resumedWithinGraceRef.current) {
//       // [FIX] only set initial turn for fresh games
//       const amHost = roleRef.current === "host";
//       setTurn(amHost ? "player" : "ai");
//       setMsg(amHost ? "You have initiative—open fire." : "Enemy has initiative—hold...");
//     } else {
//       // [FIX] resume path: keep existing turn, just update status
//       setMsg(turnRef.current === "player" ? "Initiative retained—resume fire." : "Enemy’s move—hold fire...");
//     }

//     try { roomRef.current?.phase("play"); } catch {}
//     captureStateSnapshot();

//     // clear the flag once we've transitioned
//     resumedWithinGraceRef.current = false;
//   }, [mode, phase, iAmReady, peerReady, captureStateSnapshot]);

//   const inviteHash = roomCode ? buildInviteHash(roomCode) : "";

//   // [FIX] Pick a stable emblem per role for this session (roomCode + epoch)
//   const [HostEmblemIcon, GuestEmblemIcon] = React.useMemo(() => {
//     if (!roomCode) return [EMBLEMS[0], EMBLEMS[1]] as const;
//     const seed = hashSeed(`${roomCode}|${epoch}`);
//     const hostIdx = seed % EMBLEMS.length;

//     // derive a second index for guest; ensure distinct
//     let guestIdx = ((seed * 1103515245 + 12345) >>> 0) % EMBLEMS.length;
//     if (guestIdx === hostIdx) guestIdx = (guestIdx + 1) % EMBLEMS.length;

//     return [EMBLEMS[hostIdx], EMBLEMS[guestIdx]] as const;
//   }, [roomCode, epoch]);

//   // [ADD] pick my own emblem icon for the watermark
//   const MyEmblemIcon = role === "host" ? HostEmblemIcon : GuestEmblemIcon;

//   // Compute opponent status (must be before any early returns so hooks are not conditional)
//   const opponentStatus = React.useMemo(() => {
//     const isHost = role === "host";

//     if (!peerPresent) {
//       if (isHost) {
//         return peerState === "left" ? "Guest (signal lost)" : "Guest (raising radio contact...)";
//       }
//       // Guest never shows "Host (making radio contact...)"
//       return "";
//     }

//     if (isHost) {
//       if (peerState === "quit") return "Guest (surrendered)";
//       if (phase === "place")    return peerReady ? "Guest (battle ready)" : "Guest (charting the grid...)";
//       return "Guest (at war)";
//     } else {
//       if (peerState === "quit") return "Host (surrendered)";
//       if (phase === "place")    return peerReady ? "Host (battle ready)" : "Host (charting the grid...)";
//       return "Host (at war)";
//     }
//   }, [role, peerPresent, peerReady, peerState, phase]);

//   /* ---- Landing with Local / Online sections ---- */
//   if (entry === "landing") {
//     return (
//       <div className="w-full mt-16 flex justify-center">
//         <div
//           className="
//             relative overflow-hidden
//             w-full max-w-sm mx-auto p-6 rounded-2xl
//             min-h-[220px] md:min-h-[260px]
//             bg-white/[0.08] dark:bg-white/[0.045]
//             backdrop-blur-xl backdrop-saturate-150
//             border border-white/15 dark:border-white/[0.06]
//             ring-1 ring-white/[0.06] dark:ring-black/[0.25]
//             shadow-[0_4px_16px_rgba(0,0,0,0.35)]
//             transition-all
//           "
//         >
//           {/* glass highlight (subtle gradient sheen) */}
//           <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-white/25 via-white/10 to-transparent dark:from-gray-800/60 dark:via-gray-900/40 dark:to-transparent" />

//           {/* content (lift above the sheen) */}
//           <div className="relative z-10 flex flex-col items-center gap-1">
            
//             {/* LOCAL */}
//             <div className="pl-0 md:pl-0">
//               <div className="text-sm text-center mb-2 font-semibold tracking-wide text-gray-700 dark:text-gray-200">
//                 Local Waters
//               </div>
//               <div className="mt-2 h-px w-40 sm:w-20 md:w-44 bg-gray-300 dark:bg-white/10 backdrop-blur-lg rounded-full mx-auto" />
//             </div>

//             <div className="mt-4 flex justify-center">
//               <button
//                 className="px-4 py-2 rounded-lg text-sm bg-gradient-to-r from-purple-600 via-purple-700 to-purple-800 text-white"
//                 onClick={() => { setEntry("bot"); setMode("bot"); resetLocal(); }}
//               >
//                 <span className="inline-flex items-center gap-2">
//                   {/* keep your CPU icon component if you added it earlier */}
//                   <IconCpu className="w-4 h-4 opacity-90" aria-hidden="true" />
//                   Drill with Bot
//                 </span>
//               </button>
//             </div>

//             {/* ONLINE */}
//             <div className="mt-8 pl-0 md:pl-0">
//               <div className="text-sm text-center mb-2 font-semibold tracking-wide text-gray-700 dark:text-gray-200">
//                 Open Seas
//               </div>
//               <div className="mt-2 h-px w-40 sm:w-20 md:w-44 bg-gray-300 dark:bg-white/10 backdrop-blur-sm rounded-full mx-auto" />
//             </div>

//             {!landingJoinOpen ? (
//               // two centered buttons
//               <div className="mt-4 flex items-center justify-center gap-8">
//                 <button
//                   className="px-4 py-2 rounded-lg text-sm bg-gradient-to-r from-emerald-600 via-emerald-700 to-emerald-800 text-white"
//                   onClick={() => { setEntry("mp"); setMode("mp"); resetLocal(); ensureRoom(true); }}
//                 >
//                   <span className="inline-flex items-center gap-2">
//                     <IconSignal className="w-4 h-4 opacity-90" aria-hidden="true" />
//                     Open Theater
//                   </span>
//                 </button>

//                 <button
//                   className="px-4 py-2 rounded-lg text-sm bg-gradient-to-r from-indigo-600 via-indigo-700 to-indigo-800 text-white"
//                   onClick={() => { setLandingJoinOpen(true); setJoinCode(""); }}
//                 >
//                   <span className="inline-flex items-center gap-2">
//                     <IconLink className="w-4 h-4 opacity-90" aria-hidden="true" />
//                     Join Theater
//                   </span>
//                 </button>
//               </div>
//             ) : (
//               // centered join form keeps same functionality
//               <div className="mt-4 flex flex-col items-center gap-3">
//                 <div className="w-full flex items-center justify-center gap-3">
//                   <input
//                     autoFocus
//                     inputMode="text"
//                     pattern="[A-Za-z0-9]{4}"
//                     maxLength={4}
//                     value={joinCode}
//                     onChange={(e) =>
//                       setJoinCode(
//                         e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4)
//                       )
//                     }
//                     placeholder="Op Code (e.g., AX9G)"
//                     className="w-44 px-3 py-2 rounded-md bg-white/90 dark:bg-gray-700 text-xs text-gray-900 dark:text-gray-100 ring-1 ring-black/10 dark:ring-white/10 outline-none text-center tracking-widest"
//                     aria-label="Room code"
//                   />
//                   <button
//                     className="px-3 py-2 rounded-lg bg-indigo-600 text-white disabled:opacity-50"
//                     disabled={joinCode.length !== 4}
//                     onClick={() => {
//                       setEntry("mp");
//                       setMode("mp");
//                       setRole("guest");
//                       setRoomCode(joinCode);
//                       resetLocal();
//                       ensureRoom(false);
//                       setMsg("Joining room…");
//                     }}
//                   >
//                     <span className="inline-flex items-center gap-2">
//                       <IconLink className="w-4 h-4 opacity-90" aria-hidden="true" />
//                       Join
//                     </span>
//                   </button>
//                 </div>
//                 <button
//                   className="text-xs text-gray-600 dark:text-gray-400 hover:underline"
//                   onClick={() => setLandingJoinOpen(false)}
//                 >
//                   Stand down
//                 </button>
//               </div>
//             )}
//           </div>
//         </div>
//       </div>
//     );
//   }

//   const MPHeader = () => (
//     <div className="p-3 rounded-xl ring-1 ring-black/10 dark:ring-white/10 bg-gray-100 dark:bg-gray-800 space-y-3">
//       <div className="flex items-center justify-between">
//         <div className="font-semibold text-sm text-gray-800 dark:text-gray-200">
//           {opponentStatus ? (
//             <div className="font-semibold text-sm text-gray-800 dark:text-gray-200 flex items-center gap-2">
//               {/* [FIX] Opponent emblem:
//                   - hidden initially (making radio contact) until we ever saw them
//                   - visible during 30s grace (rejoinTimerRef.current != null)
//                   - visible when present
//               */}
//               {(everHadPeerRef.current && (peerPresent || rejoinTimerRef.current != null)) && (
//                 <TeamEmblem
//                   role={role === "host" ? "guest" : "host"}
//                   Icon={role === "host" ? GuestEmblemIcon : HostEmblemIcon}
//                   size={30}
//                 />
//               )}

//               {/* presence dot (red when not present; green when present) */}
//               <span
//                 className={`inline-block ${peerPresent ? "bg-emerald-500" : "bg-rose-500"} w-3 h-3 rounded-full`}
//                 aria-hidden
//               />

//               <span>{opponentStatus}</span>
//             </div>
//           ) : null}
//         </div>
//         <div className="flex items-center gap-2">
//           <button
//             className="px-3 py-1.5 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-100"
//             onClick={() => { roomRef.current?.leave(); setEntry("landing"); setMode("bot"); resetLocal(); }}
//             title="Return to harbor"
//           >
//             ← Back to Harbor
//           </button>
//           {roomRef.current && phase !== "over" && (
//             <button
//               className="px-3 py-1.5 rounded-lg bg-rose-600 text-white"
//               title="Quit Game"
//               onClick={() => {
//                 try {
//                   roomRef.current?.quit(roleRef.current);
//                   if (!sentRevealRef.current) {
//                     sentRevealRef.current = true;
//                     roomRef.current?.reveal(
//                       roleRef.current,
//                       playerGrid as unknown as number[][],
//                       playerFleet as unknown as Record<string, any>
//                     );
//                   }
//                 } catch {}
//                 setPhase("over");
//                 setMsg("You strike colors—revealing charts...");
//               }}
//             >
//               Strike Colors
//             </button>
//           )}
//           {roomRef.current && (
//             <button
//               className="px-3 py-1.5 rounded-lg bg-gray-700 text-white"
//               onClick={async () => {
//                 // persist my local placement + ready so I can resume within 30s
//                 try {
//                   if (roomCode) {
//                     saveLocalResume(roomCode, roleRef.current, {
//                       exp: Date.now() + RESUME_WINDOW_MS,
//                       playerGrid: playerGridRef.current,
//                       playerFleet: playerFleetRef.current,
//                       iAmReady: iAmReadyRef.current ?? false,
//                       turn: turnRef.current, // [FIX]
//                     });
//                   }
//                 } catch {}

//                 // tell the room we are leaving; do NOT call quit() or bumpEpoch() here
//                 try { await roomRef.current?.leave(); } catch {}

//                 // go back to landing or your default
//                 setEntry("landing");
//                 // (don’t resetLocal() if you want to keep single-player state; optional)
//               }}
//               title="Leave room"
//             >
//               Leave Theater
//             </button>
//           )}
//         </div>
//       </div>

//       {/* Status while connecting */}
//       {!roomRef.current ? (
//         <div className="text-sm text-gray-700 dark:text-gray-300">
//           {role === "host" ? "Creating room…" : "Joining room…"}
//         </div>
//       ) : (
//         <div className="flex flex-wrap items-center gap-2">
//           <span className="text-sm text-gray-800 dark:text-gray-200">
//             Op Code: <b>{roomCode}</b>
//           </span>
//           <button
//             className="px-3 py-1 rounded-lg text-sm bg-gray-700 text-white"
//             onClick={() => {
//               const { origin, pathname } = window.location;
//               const isDark = document.documentElement.classList.contains("dark");
//               const theme = isDark ? "dark" : "light";
//               navigator.clipboard.writeText(`${origin}${pathname}?theme=${theme}${inviteHash}`);
//             }}
//           >
//             Copy Signal Link
//           </button>
//         </div>
//       )}
//     </div>
//   );

//   return (
//     <div className="w-full flex justify-center">
//       {/* Title-left emblem (only when inside a room) */}
//       {typeof document !== "undefined" &&
//         entry !== "landing" &&
//         roomRef.current &&
//         (() => {
//           const slot = document.getElementById("title-left-slot");
//           return slot
//             ? ReactDOM.createPortal(
//                 <span className="inline-flex items-center">
//                   <TeamEmblem
//                     role={role}
//                     Icon={MyEmblemIcon}   // same emblem you use for the watermark
//                     size={30}             // tweak 18–26 if you like
//                     title="Your fleet emblem"
//                   />
//                 </span>,
//                 slot
//               )
//             : null;
//         })()
//       }

//       {/* Title-right role label (only when inside a room) */}
//       {typeof document !== "undefined" &&
//         entry !== "landing" &&
//         roomRef.current &&
//         (() => {
//           const slot = document.getElementById("title-right-slot");
//           return slot
//             ? ReactDOM.createPortal(
//                 <span className="text-xs sm:text-sm font-normal text-gray-600 dark:text-gray-300">
//                   ({role})
//                 </span>,
//                 slot
//               )
//             : null;
//         })()
//       }

//       {/* container with stacking context so watermark can sit behind content */}
//       {/* <div className="w-full max-w-5xl mx-auto relative overflow-hidden"> */}
//       <div className="w-full max-w-5xl mx-auto relative">
//         {/* Watermark — your own emblem, faint and behind all cards/dialogs */}
//         <div className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center overflow-hidden">
//           <WatermarkEmblem
//             role={role}
//             Icon={MyEmblemIcon}
//             // max 1060px, but never wider than (container width - 2 × SAFE_INSET)
//             size={`min(1060px, calc(100% - ${WATERMARK_SAFE_INSET * 2}px))`}
//             opacity={0.1}
//           />
//         </div>

//         {/* Foreground content sits above watermark */}
//         <div className="flex flex-col gap-6 relative z-10">
//           {mode === "mp" && <MPHeader />}

//           {/* Placement controls */}
//           {phase === "place" && (
//             <div className="flex items-center justify-between rounded-xl p-3 ring-1 ring-black/10 dark:ring-white/10 bg-gray-100 dark:bg-gray-800">
//               <div className="text-sm font-medium text-gray-800 dark:text-gray-200">
//                 Vessels to deploy: <span className="tracking-wide">{toPlace.join(", ")}</span>
//               </div>
//               <div className="flex items-center gap-3">
//                 <span className="text-sm text-gray-700 dark:text-gray-300">Heading:</span>
//                 <button
//                   onClick={() => setOrientation((o) => (o === "H" ? "V" : "H"))}
//                   className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-purple-500 via-purple-600 to-purple-700 text-white shadow hover:opacity-90"
//                 >
//                   {orientation === "H" ? "East-West" : "North-South"} (R)
//                 </button>
//               </div>
//             </div>
//           )}

//           {/* Boards */}
//           {mode === "bot" ? (
//             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
//               <BoardGrid
//                 title={
//                   <span className="inline-flex items-center gap-2">
//                     <TeamEmblem role={role} Icon={role === "host" ? HostEmblemIcon : GuestEmblemIcon} size={14} />
//                     Your Fleet
//                   </span>
//                 }
//                 grid={playerGrid}
//                 shots={playerShots}
//                 revealShips
//                 greenEllipseOnly
//                 onCellClick={phase === "place" ? onPlaceClick : undefined}
//                 disabled={phase !== "place"}
//               />
//               <BoardGrid
//                 title={
//                   <span className="inline-flex items-center gap-2">
//                     <TeamEmblem role={role === "host" ? "guest" : "host"} Icon={role === "host" ? GuestEmblemIcon : HostEmblemIcon} size={14} />
//                     Enemy Waters
//                   </span>
//                 }
//                 grid={enemyGrid}
//                 shots={enemyShots}
//                 revealShips={phase === "over" && enemyRevealed}
//                 onCellClick={onEnemyClick}
//                 disabled={phase !== "play" || turn !== "player"}
//               />
//             </div>
//           ) : (
//             <>
//               {phase === "place" && (
//                 <div className="grid grid-cols-1 gap-6">
//                   <div className="mx-auto w-full" style={{ width: PLACE_GRID_WIDTH }}>
//                     <BoardGrid
//                       title="Deploy Your Fleet"
//                       grid={playerGrid}
//                       shots={playerShots}
//                       revealShips
//                       greenEllipseOnly
//                       onCellClick={onPlaceClick}
//                       disabled={toPlace.length === 0}
//                     />
//                   </div>

//                   {iAmReady && !peerReady && (
//                     <div className="text-sm text-gray-700 dark:text-gray-300">
//                       You’re ready. Waiting for opponent…
//                     </div>
//                   )}
//                   {!iAmReady && peerReady && (
//                     <div className="text-sm text-gray-700 dark:text-gray-300">
//                       Opponent is ready. Place your ships!
//                     </div>
//                   )}
//                 </div>
//               )}
//               {phase === "play" && (
//                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
//                   <BoardGrid
//                     title={
//                       <span className="inline-flex items-center gap-2">
//                         <TeamEmblem role={role} Icon={role === "host" ? HostEmblemIcon : GuestEmblemIcon} size={14} />
//                         Your Fleet
//                       </span>
//                     }
//                     grid={playerGrid}
//                     shots={playerShots}
//                     revealShips
//                     greenEllipseOnly
//                     disabled
//                   />
//                   <BoardGrid
//                     title={
//                       <span className="inline-flex items-center gap-2">
//                         <TeamEmblem role={role === "host" ? "guest" : "host"} Icon={role === "host" ? GuestEmblemIcon : HostEmblemIcon} size={14} />
//                         Enemy Waters
//                       </span>
//                     }
//                     grid={enemyGrid}
//                     shots={enemyShots}
//                     revealShips={phase === "over" && enemyRevealed}
//                     onCellClick={onEnemyClick}
//                     disabled={!peerPresent || phase !== "play" || turn !== "player"} // [FIX]
//                   />
//                 </div>
//               )}
//               {phase === "over" && (
//                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
//                   <BoardGrid
//                     title={
//                       <span className="inline-flex items-center gap-2">
//                         <TeamEmblem role={role} Icon={role === "host" ? HostEmblemIcon : GuestEmblemIcon} size={14} />
//                         Your Fleet
//                       </span>
//                     }
//                     grid={playerGrid}
//                     shots={playerShots}
//                     revealShips
//                     greenEllipseOnly
//                     disabled
//                   />
//                   <BoardGrid
//                     title={
//                       <span className="inline-flex items-center gap-2">
//                         <TeamEmblem role={role === "host" ? "guest" : "host"} Icon={role === "host" ? GuestEmblemIcon : HostEmblemIcon} size={14} />
//                         Enemy Waters
//                       </span>
//                     }
//                     grid={enemyGrid}
//                     shots={enemyShots}
//                     revealShips={enemyRevealed}
//                     onCellClick={() => {}}
//                     disabled
//                   />
//                 </div>
//               )}
//             </>
//           )}

//           {/* Bottom bar */}
//           <div className="flex items-center justify-between">
//             {mode === "bot" ? (
//               <button
//                 onClick={resetLocal}
//                 className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-500 via-purple-600 to-purple-700 text-white shadow hover:opacity-90"
//               >
//                 Refit
//               </button>
//             ) : roomRef.current ? (
//               phase === "over" ? (
//                 <button
//                   onClick={() => {
//                     try { roomRef.current?.rematch("propose", roleRef.current); } catch {}
//                     setMsg("Requesting re-engagement...");
//                   }}
//                   className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-500 via-purple-600 to-purple-700 text-white shadow hover:opacity-90"
//                 >
//                   Rearm & Reengage
//                 </button>
//               ) : (
//                 <div />
//               )
//             ) : (
//               <div />
//             )}
//             <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">{msg}</div>
//           </div>

//           {rematchAskFromPeer && (
//             <div className="flex items-center gap-3 text-sm text-gray-800 dark:text-gray-200">
//               Opponent wants a rematch. Accept?
//               <button
//                 className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white"
//                 onClick={() => {
//                   try { roomRef.current?.rematch("accept", roleRef.current); } catch {}
//                   setRematchAskFromPeer(null);
//                   resetLocal();
//                   setMsg("Rematch starting. Place your ships.");
//                 }}
//               >
//                 Yes
//               </button>
//               <button
//                 className="px-3 py-1.5 rounded-lg bg-gray-600 text-white"
//                 onClick={() => {
//                   try { roomRef.current?.rematch("decline", roleRef.current); } catch {}
//                   setRematchAskFromPeer(null);
//                   setMsg("Rematch declined.");
//                 }}
//               >
//                 No
//               </button>
//             </div>
//           )}

//         </div> {/* end: foreground content wrapper */}
//       </div>   {/* end: max-w container with watermark */}
//     </div>
//   );
// }

