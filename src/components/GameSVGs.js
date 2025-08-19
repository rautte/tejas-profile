// src/components/GameSVGs.js

import React from "react";

/** ---------- Battleship SVG ---------- */
/** Theme-aware inline SVGs (respect dark/light via currentColor & CSS vars) **/
export function BattleshipSVG() {
  return (
    <svg 
      id="battleship-svg"
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 160 160" 
      className="w-40 h-40 mx-auto block"
    >
      <defs>
        {/* These colors adapt to theme by reading currentColor and HSL vars */}
        <linearGradient id="msGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="hsl(265 90% 60%)" />
          <stop offset="100%" stopColor="hsl(265 85% 50%)" />
        </linearGradient>

        {/* Use user-space coordinates so cx/cy/r match the 160×160 viewBox */}
        <mask id="crosshairHole" maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse">
          {/* white = keep, black = cut out */}
          <rect x="0" y="0" width="160" height="160" fill="white" />
          <circle cx="80" cy="80" r="14" fill="black" />
        </mask>
      </defs>

      {/* Disc */}
      <circle
        cx="80"
        cy="80"
        r="68"
        fill="#9984ac71"
        stroke="currentColor"
        className="text-gray-500 dark:text-gray-500"
        strokeWidth="6"
        strokeOpacity="0.5"
      />

      {/* crosshair with hole radius 20 (static, no pulsing) */}
      <g stroke="white" strokeOpacity="0.6" strokeWidth="6" strokeLinecap="round">
        {/* vertical lines */}
        <line x1="80" y1="22" x2="80" y2="60" />
        <line x1="80" y1="100" x2="80" y2="138" />

        {/* horizontal lines */}
        <line x1="22" y1="80" x2="60" y2="80" />
        <line x1="100" y1="80" x2="138" y2="80" />
      </g>

      {/* center "ship" (pulsing like the circle) */}
      <g transform="translate(80 78)">
        {/* Draw the ship centered at (0,0) so scaling is around the middle */}
        <g
          fill="hsl(160 70% 45%)"
          stroke="rgba(0,0,0,0.35)"
          strokeWidth="1.2"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        >
          {/* Move the highlight BEFORE the hull and slightly inset so it doesn't sit exactly on the edge */}
          <path
            d="M -15 7 L -12.5 12"
            stroke="rgba(255,255,255,0.45)"
            strokeWidth="0.9"
            fill="none"
          />

          {/* Hull (simple trapezoid) */}
          <path d="M -16 6 L 16 6 L 12 12 L -12 12 Z" />

          {/* Superstructure */}
          <rect x="-6" y="-3" width="12" height="7" rx="1.5" />

          {/* Stack */}
          <rect x="2" y="-10" width="3.5" height="7" rx="1" />
        </g>
      {/* </g> */}

        {/* Pulse scale (matches the old 1.8s rhythm) */}
        <animateTransform
          attributeName="transform"
          type="scale"
          values="0.9;1.2;0.9"
          dur="1.8s"
          repeatCount="indefinite"
          additive="sum"
        />
      </g>
      
      {/* spinner “fuse” */}
      <g stroke="red" strokeOpacity="0.7" strokeWidth="4" strokeLinecap="round" transform="rotate(15 80 80)">
        {Array.from({ length: 4 }).map((_, i) => {
          const a = i * 90;
          const r1 = 30, r2 = 55;
          const x1 = 80 + r1 * Math.cos((a * Math.PI) / 180);
          const y1 = 80 + r1 * Math.sin((a * Math.PI) / 180);
          const x2 = 80 + r2 * Math.cos((a * Math.PI) / 180);
          const y2 = 80 + r2 * Math.sin((a * Math.PI) / 180);
          return (
            <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}>
              <animateTransform
                attributeName="transform"
                type="rotate"
                from={`0 80 80`}
                to={`360 80 80`}
                dur="6s"
                repeatCount="indefinite"
              />
            </line>
          );
        })}
      </g>
    </svg>
  );
};


/** ---------- Minesweeper SVG (animated) ---------- */
// Animated Minesweeper preview: A → B → C, pause, then return; reveals sync with selector
export function MinesweeperSVG() {
  // Geometry (unchanged)
  const size = 34;
  const step = 42;
  const start = 24; // cells at 24, 66, 108

  // Timeline (seconds) based on total dur = 6s
  const T = 6;
  const tA = 0.1 * T;   // arrive A
  const tB = 0.4 * T;   // arrive B
  const tC = 0.6 * T;   // arrive C
  const tPauseEnd = 0.8 * T; // leave C (all hide here)
  // const tLoop = T;

  return (
    <svg
      id="minesweeper-svg"
      viewBox="0 0 160 160"
      className="mx-auto block"
      style={{ width: 160, height: 160, transform: 'scale(1.20)', transformOrigin: '50% 50%' }}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* master loop clock */}
      <g opacity="0">
        <animate
          id="clock"
          attributeName="opacity"
          values="1;1"
          dur={`${T}s`}
          begin="0s;clock.end"
          fill="remove"
        />
      </g>

      {/* Covered tiles (base) */}
      <g>
        {Array.from({ length: 3 }).map((_, r) =>
          Array.from({ length: 3 }).map((_, c) => {
            const x = start + c * step;
            const y = start + r * step;
            return (
              <rect
                key={`cov-${r}-${c}`}
                x={x}
                y={y}
                width={size}
                height={size}
                rx="7"
                className="fill-gray-200 dark:fill-gray-800"
                fill="#e5e7eb"
                stroke="none"
              />
            );
          })
        )}
      </g>

      {/* Selection highlight */}
      <rect
        x={start}
        y={start}
        width={size}
        height={size}
        rx="8"
        className="fill-purple-500/10 dark:fill-purple-400/10 stroke-purple-500/70 dark:stroke-purple-300/70"
        fill="rgba(139,92,246,0.10)"
        stroke="rgba(139,92,246,0.70)"
        strokeWidth="2.5"
      >
        {/* X: A(24) → B(66) → C(108) → pause → back to A(24) with same speed */}
        <animate
          attributeName="x"
          begin="clock.begin"
          dur={`${T}s`}
          values="24;24;66;108;108;66;24"
          keyTimes="0;0.2;0.4;0.6;0.8;0.9;1"
          calcMode="linear"
          fill="remove"
        />
        {/* Y: A/B(24) → C(66) → pause → back to A(24) */}
        <animate
          attributeName="y"
          begin="clock.begin"
          dur={`${T}s`}
          values="24;24;24;66;66;66;24"
          keyTimes="0;0.2;0.4;0.6;0.8;0.9;1"
          calcMode="linear"
          fill="remove"
        />
      </rect>

      {/* Click ripples (fire only on arrival; no stray on load) */}
      <g className="fill-none stroke-purple-500/60 dark:stroke-purple-300/60" stroke="#8b5cf699" strokeWidth="2">
        {/* A @ (41,41) */}
        <circle cx="41" cy="41" r="2" opacity="0">
          <set attributeName="opacity" to="1" begin={`clock.begin+${tA}s`} dur="0.001s" fill="remove" />
          <animate attributeName="r" begin={`clock.begin+${tA + 0.02}s`} dur="0.28s" values="2;16" fill="freeze" />
          <animate attributeName="opacity" begin={`clock.begin+${tA + 0.02}s`} dur="0.28s" values="1;0" fill="freeze" />
        </circle>
        {/* B @ (83,41) */}
        <circle cx="83" cy="41" r="2" opacity="0">
          <set attributeName="opacity" to="1" begin={`clock.begin+${tB}s`} dur="0.001s" fill="remove" />
          <animate attributeName="r" begin={`clock.begin+${tB + 0.02}s`} dur="0.28s" values="2;16" fill="freeze" />
          <animate attributeName="opacity" begin={`clock.begin+${tB + 0.02}s`} dur="0.28s" values="1;0" fill="freeze" />
        </circle>
        {/* C @ (125,83) */}
        <circle cx="125" cy="83" r="2" opacity="0">
          <set attributeName="opacity" to="1" begin={`clock.begin+${tC}s`} dur="0.001s" fill="remove" />
          <animate attributeName="r" begin={`clock.begin+${tC + 0.02}s`} dur="0.28s" values="2;16" fill="freeze" />
          <animate attributeName="opacity" begin={`clock.begin+${tC + 0.02}s`} dur="0.28s" values="1;0" fill="freeze" />
        </circle>
      </g>

      {/* SAFE reveal #1 at A (r0,c0) */}
      <g opacity="0">
        <rect
          x={start}
          y={start}
          width={size}
          height={size}
          rx="7"
          className="fill-emerald-500/10 dark:fill-emerald-400/10 stroke-emerald-500/60 dark:stroke-emerald-300/60"
          fill="rgba(16,185,129,0.10)"
          stroke="rgba(16,185,129,0.60)"
          strokeWidth="1.5"
        />
        <text
          x={start + size / 2}
          y={start + size / 2 + 6}
          textAnchor="middle"
          className="fill-blue-600 dark:fill-blue-400"
          fill="#2563eb"
          fontFamily="ui-sans-serif, system-ui"
          fontWeight="700"
          fontSize="14"
        >
          1
        </text>

        {/* Appear exactly at arrival A (0s); stay until we leave C (tPauseEnd) */}
        <set attributeName="opacity" to="1" begin={`clock.begin+${tA}s`} dur="0.001s" fill="freeze" />
        <set attributeName="opacity" to="0" begin={`clock.begin+${tPauseEnd}s`} dur="0.001s" fill="freeze" />
      </g>

      {/* SAFE reveal #2 at B (r0,c1) */}
      <g opacity="0">
        <rect
          x={start + step}
          y={start}
          width={size}
          height={size}
          rx="7"
          className="fill-emerald-500/10 dark:fill-emerald-400/10 stroke-emerald-500/60 dark:stroke-emerald-300/60"
          fill="rgba(16,185,129,0.10)"
          stroke="rgba(16,185,129,0.60)"
          strokeWidth="1.5"
        />
        <text
          x={start + step + size / 2}
          y={start + size / 2 + 6}
          textAnchor="middle"
          className="fill-emerald-600 dark:fill-emerald-400"
          fill="#059669"
          fontFamily="ui-sans-serif, system-ui"
          fontWeight="700"
          fontSize="14"
        >
          2
        </text>

        {/* Appear at arrival B; stay until we leave C */}
        <set attributeName="opacity" to="1" begin={`clock.begin+${tB}s`} dur="0.001s" fill="freeze" />
        <set attributeName="opacity" to="0" begin={`clock.begin+${tPauseEnd}s`} dur="0.001s" fill="freeze" />
      </g>

      {/* MINE reveal #3 at C (r1,c2) */}
      <g
        opacity="0"
        transform={`translate(${start + 2 * step + size / 2} ${start + step + size / 2})`}
      >
        {/* revealed tile background */}
        <rect
          x={-size / 2}
          y={-size / 2}
          width={size}
          height={size}
          rx="7"
          className="fill-rose-500/10 dark:fill-rose-400/10 stroke-rose-500/60 dark:stroke-rose-300/60"
          fill="rgba(244,63,94,0.10)"
          stroke="rgba(244,63,94,0.60)"
          strokeWidth="1.5"
        />
        {/* Mine: core + spikes + spark */}
        <g>
          <circle r="5" className="fill-rose-600 dark:fill-rose-400" fill="#e11d48" />
          {Array.from({ length: 8 }).map((_, i) => {
            const a = (i * 45 * Math.PI) / 180;
            const x1 = 5 * Math.cos(a), y1 = 5 * Math.sin(a);
            const x2 = 10 * Math.cos(a), y2 = 10 * Math.sin(a);
            return (
              <line
                key={i}
                x1={x1} y1={y1} x2={x2} y2={y2}
                className="stroke-rose-600 dark:stroke-rose-400"
                stroke="#e11d48"
                strokeWidth="2" strokeLinecap="round"
              />
            );
          })}
        </g>

        {/* Appear at arrival C; hide exactly when leaving C (tPauseEnd) */}
        <set attributeName="opacity" to="1" begin={`clock.begin+${tC}s`} dur="0.001s" fill="freeze" />
        <set attributeName="opacity" to="0" begin={`clock.begin+${tPauseEnd}s`} dur="0.001s" fill="freeze" />

        {/* gentle pop on appearance */}
        <animateTransform
          attributeName="transform"
          type="scale"
          values="1;1.25;1"
          keyTimes="0;0.5;1"
          dur="0.9s"
          begin={`clock.begin+${tC}s`}
          repeatCount="1"
          additive="sum"
        />
      </g>
    </svg>
  );
};


/** ---------- TicTacToe SVG (animated) ---------- */
export function TicTacToeSVG() {
  // Grid is 3x3 within 120x120 content area, centered in 160x120 viewBox
  return (
    <svg
      id="tictactoe-svg"
      viewBox="0 0 160 120"
      className="w-full h-40 rounded-lg bg-transparent"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* board frame */}
      <rect x="20" y="0" width="120" height="120" rx="12" fill="transparent" />

      {/* grid */}
      <g stroke="currentColor" strokeOpacity="0.35" strokeWidth="4">
        {/* verticals */}
        <line x1="60" y1="12" x2="60" y2="108" />
        <line x1="100" y1="12" x2="100" y2="108" />
        {/* horizontals */}
        <line x1="28" y1="40" x2="132" y2="40" />
        <line x1="28" y1="80" x2="132" y2="80" />
      </g>

      {/* Marks (centered in each 40×40 cell) */}
      <g strokeLinecap="round" strokeLinejoin="round" strokeWidth="4">
        {/* 1) X @ row 2, col 3 → (120,60) */}
        <g className="ttt-x x1" stroke="#F87171">
          <line x1="113" y1="53" x2="127" y2="67" />
          <line x1="127" y1="53" x2="113" y2="67" />
        </g>

        {/* 2) O @ row 2, col 2 → (80,60) */}
        <circle className="ttt-o o1" cx="80" cy="60" r="7" fill="none" stroke="#34D399" />

        {/* 3) X @ row 1, col 1 → (40,20) */}
        <g className="ttt-x x2" stroke="#F87171">
          <line x1="33" y1="13" x2="47" y2="27" />
          <line x1="47" y1="13" x2="33" y2="27" />
        </g>

        {/* 4) O @ row 3, col 1 → (40,100) */}
        <circle className="ttt-o o2" cx="40" cy="100" r="7" fill="none" stroke="#34D399" />

        {/* 5) X @ row 1, col 3 → (120,20) */}
        <g className="ttt-x x3" stroke="#F87171">
          <line x1="113" y1="13"  x2="127" y2="27" />
          <line x1="127" y1="13"  x2="113" y2="27" />
        </g>

        {/* 6) O @ row 3, col 3 → (120,100) */}
        <circle className="ttt-o o3" cx="120" cy="100" r="7" fill="none" stroke="#34D399" />

        {/* 7) X @ row 1, col 2 → (80,20) */}
        <g className="ttt-x x4" stroke="#F87171">
          <line x1="73" y1="13" x2="87" y2="27" />
          <line x1="87" y1="13" x2="73" y2="27" />
        </g>
      </g>

      {/* Win strike: top row (y = 20) from left to right */}
      <line
        className="ttt-strike"
        x1="28" y1="20" x2="132" y2="20"
        stroke="#5c5c5cff" strokeWidth="4" strokeLinecap="round"
      />

      <style>{`
        /* Scope to the runtime id */
        #tictactoe-svg .ttt-x, #tictactoe-svg .ttt-o, #tictactoe-svg .ttt-strike { opacity: 0; }

        /* One animation per mark, cumulative visibility */
        #tictactoe-svg .x1 { animation: ttt_x1 5s linear infinite both; }
        #tictactoe-svg .o1 { animation: ttt_o1 5s linear infinite both; }
        #tictactoe-svg .x2 { animation: ttt_x2 5s linear infinite both; }
        #tictactoe-svg .o2 { animation: ttt_o2 5s linear infinite both; }
        #tictactoe-svg .x3 { animation: ttt_x3 5s linear infinite both; }
        #tictactoe-svg .o3 { animation: ttt_o3 5s linear infinite both; }
        #tictactoe-svg .x4 { animation: ttt_x4 5s linear infinite both; }
        #tictactoe-svg .ttt-strike { animation: ttt_strike 5s linear infinite both; }

        /* keyframes unchanged */
        @keyframes ttt_x1     { 0%,  1.99%{opacity:0}  2%, 98%{opacity:1} 100%{opacity:0} }
        @keyframes ttt_o1     { 0%, 11.99%{opacity:0} 12%, 98%{opacity:1} 100%{opacity:0} }
        @keyframes ttt_x2     { 0%, 23.99%{opacity:0} 24%, 98%{opacity:1} 100%{opacity:0} }
        @keyframes ttt_o2     { 0%, 35.99%{opacity:0} 36%, 98%{opacity:1} 100%{opacity:0} }
        @keyframes ttt_x3     { 0%, 47.99%{opacity:0} 48%, 98%{opacity:1} 100%{opacity:0} }
        @keyframes ttt_o3     { 0%, 59.99%{opacity:0} 60%, 98%{opacity:1} 100%{opacity:0} }
        @keyframes ttt_x4     { 0%, 71.99%{opacity:0} 72%, 98%{opacity:1} 100%{opacity:0} }
        @keyframes ttt_strike { 0%, 85.99%{opacity:0} 86%, 98%{opacity:1} 100%{opacity:0} }
      `}</style>
    </svg>
  );
};