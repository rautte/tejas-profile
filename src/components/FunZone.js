// src/components/FunZone.js

import React from "react";
// import TicTacToeWeb from "@/components/TicTacToeWeb";
import { FaPlay, FaGithub, FaDownload } from 'react-icons/fa';
import { GiConsoleController } from 'react-icons/gi';
import JSZip from "jszip";
import { saveAs } from "file-saver";

// helper: package a zip containing the live SVG, a demo source file, README, and requirements.txt
const downloadZipBySvgId = async (id, baseName) => {
  const el = document.getElementById(id);
  if (!el) return;

  // Serialize current live SVG (includes your animations)
  const svg = new XMLSerializer().serializeToString(el);

  const zip = new JSZip();
  // 1) Raw SVG
  zip.file(`${baseName}.svg`, svg);

  // 2) Source "demo" to edit animations quickly (inline SVG)
  const demoHtml = `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<title>${baseName} demo</title>
<style>
  html,body{height:100%;margin:0}
  body{display:grid;place-items:center;background:#0f172a;color:#e5e7eb;font-family:system-ui}
</style>
<body>
  <!-- Inline SVG below: -->
  ${svg}
</body>
</html>`;
  zip.file(`source/index.html`, demoHtml);

  // 3) README with instructions
  const readme = `# ${baseName}
This ZIP was generated from https://rautte.github.io/my-profile/#/fun-zone.

## Files
- \`${baseName}.svg\` — the standalone SVG with animations.
- \`source/index.html\` — a minimal page embedding the same SVG for quick edits.
- \`requirements.txt\` — notes for local preview.

## Edit Animations
Open \`source/index.html\` in any code editor and tweak the \`<style>\` keyframes inside the SVG.

## Preview Locally
No build step required. You can:
- Open \`source/index.html\` directly in a browser, or
- Run a static server (recommended for consistent behavior).

### Static server (Node)
\`\`\`bash
npm i -g serve
serve source
\`\`\`

Then open the printed URL in your browser.`;
  zip.file("README.md", readme);

  // 4) requirements.txt (simple, since this is front-end only)
  const reqs = `# No Python/Node packages strictly required.
# Optional: 'serve' (Node) for a local static server.
`;
  zip.file("requirements.txt", reqs);

  // Build and download
  const blob = await zip.generateAsync({ type: "blob" });
  saveAs(blob, `${baseName}.zip`);
};

function Card({ title, preview, actions }) {
  return (
    <div
      className="
        group w-[320px] rounded-2xl border border-gray-200 dark:border-gray-700
        bg-white/80 dark:bg-gray-800/60 backdrop-blur-md shadow-lg
        hover:shadow-xl transition-shadow duration-300
      "
    >
      {/* Move only inner content on hover to prevent jitter */}
      <div className="transition-transform duration-300 group-hover:-translate-y-1">
        {/* Title on top */}
        <div className="px-6 pt-6">
          <h3 className="text-xl text-center font-semibold text-purple-700 dark:text-purple-300 mb-4">
            {title}
          </h3>
        </div>

        {/* Preview */}
        <div className="px-6">
          {preview}
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 pt-4">
          <div className="text-sm text-gray-700 dark:text-gray-300 space-y-3">
            {actions}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Theme-aware inline SVGs (respect dark/light via currentColor & CSS vars) **/
const MinesweeperSVG = ({ id }) => (
  <svg id={id} viewBox="0 0 160 160" className="w-40 h-40 mx-auto block">
    <defs>
      {/* These colors adapt to theme by reading currentColor and HSL vars */}
      <linearGradient id="msGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="hsl(265 90% 60%)" />
        <stop offset="100%" stopColor="hsl(265 85% 50%)" />
      </linearGradient>
    </defs>

    {/* Disc */}
    <circle
      cx="80"
      cy="80"
      r="64"
      fill="#9984ac71"
      stroke="currentColor"
      className="text-gray-500 dark:text-gray-500"
      strokeWidth="6"
      strokeOpacity="0.5"
    />
    {/* crosshair */}
    <g stroke="white" strokeOpacity="0.7" strokeWidth="6" strokeLinecap="round">
      <line x1="80" y1="30" x2="80" y2="130">
        <animate attributeName="y1" values="26;30;26" dur="2.4s" repeatCount="indefinite" />
        <animate attributeName="y2" values="134;130;134" dur="2.4s" repeatCount="indefinite" />
      </line>
      <line x1="30" y1="80" x2="130" y2="80">
        <animate attributeName="x1" values="26;30;26" dur="2s" repeatCount="indefinite" />
        <animate attributeName="x2" values="134;130;134" dur="2s" repeatCount="indefinite" />
      </line>
    </g>
    {/* center pip */}
    <circle cx="80" cy="80" r="11" fill="hsl(160 70% 45%)">
      <animate
        attributeName="r"
        values="9;12;9"
        dur="1.8s"
        repeatCount="indefinite"
      />
    </circle>
    {/* spinner “fuse” */}
    <g stroke="red" strokeOpacity="0.5" strokeWidth="4" strokeLinecap="round" transform="rotate(15 80 80)">
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

/* ---------- TicTacToe Preview (plays a tiny game, shows win, loops) ---------- */
function TicTacToeSVG({ id }) {
  // Grid is 3x3 within 120x120 content area, centered in 160x120 viewBox
  return (
    <svg
      id={id}
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
        #${id} .ttt-x, #${id} .ttt-o, #${id} .ttt-strike { opacity: 0; }

        /* One animation per mark, cumulative visibility */
        #${id} .x1 { animation: ttt_x1 5s linear infinite both; }
        #${id} .o1 { animation: ttt_o1 5s linear infinite both; }
        #${id} .x2 { animation: ttt_x2 5s linear infinite both; }
        #${id} .o2 { animation: ttt_o2 5s linear infinite both; }
        #${id} .x3 { animation: ttt_x3 5s linear infinite both; }
        #${id} .o3 { animation: ttt_o3 5s linear infinite both; }
        #${id} .x4 { animation: ttt_x4 5s linear infinite both; }
        #${id} .ttt-strike { animation: ttt_strike 5s linear infinite both; }

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
}

export default function Fun() {
  return (
    <section className="py-8 px-4 bg-gray-50 dark:bg-[#181826] transition-colors">
      {/* Title */}
      <div className="text-left px-6 mb-10">
        <h2 className="text-3xl font-bold text-purple-700 dark:text-purple-300 font-epilogue drop-shadow-md flex items-center gap-3">
          <GiConsoleController className="text-4xl text-purple-700 dark:text-purple-300" />
          Fun Zone
        </h2>
      </div>

      {/* Subtitle */}
      <p className="text-gray-600 dark:text-gray-300 px-6 mb-10 font-epilogue">
        If you’ve reached this far, take a break and enjoy some simple mini-games I built just for fun!
      </p>

      {/* Cards */}
      <div className="flex flex-wrap justify-center gap-16 px-4">
        <Card
          title="Minesweeper"
          preview={
            <div
              onDoubleClick={() => downloadZipBySvgId('svg-minesweeper', 'minesweeper')}
              title="Double-click to download ZIP to this SVG"
              className="cursor-pointer"
            >
              <MinesweeperSVG id="svg-minesweeper" />
            </div>
          }
          actions={
            <>
              {/* top row: Code (left) + GitHub (right) */}
              <div className="flex w-full gap-5 mt-3">
                <a
                  href="./downloads/Minesweeper.zip"
                  download
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md bg-gradient-to-r from-purple-500 via-purple-600 to-purple-700 text-white shadow hover:opacity-90"
                >
                  <FaDownload className="opacity-90" /> <span>Code</span>
                </a>
                <a
                  href="https://github.com/rautte/Minesweeper"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md bg-gradient-to-r from-gray-700 via-gray-800 to-gray-900 text-white shadow hover:opacity-90"
                >
                  <FaGithub className="opacity-90" /> <span>GitHub</span>
                </a>
              </div>

              {/* bottom row: Play full width */}
              <a
                href="/games/minesweeper.html"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md bg-gradient-to-r from-green-500 via-emerald-600 to-green-700 text-white shadow hover:opacity-90"
              >
                <FaPlay className="opacity-90" /> <span>Play</span>
              </a>
            </>
          }
        />

        <Card
          title="Tic-Tac-Toe (AI)"
          preview={
            <div
              onDoubleClick={() => downloadZipBySvgId('svg-ttt', 'tictactoe')}
              title="Double-click to download ZIP to this SVG"
              className="cursor-pointer"
            >
              <TicTacToeSVG id="svg-ttt" />
            </div>
          }
          actions={
            <>
              {/* top row: Code (left) + GitHub (right) */}
              <div className="flex w-full gap-5 mt-3">
                <a
                  href="./downloads/TicTacToe_AI.zip"
                  download
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md bg-gradient-to-r from-purple-500 via-purple-600 to-purple-700 text-white shadow hover:opacity-90"
                >
                  <FaDownload className="opacity-90" /> <span>Code</span>
                </a>
                <a
                  href="https://github.com/rautte/TicTacToe_AI"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md bg-gradient-to-r from-gray-700 via-gray-800 to-gray-900 text-white shadow hover:opacity-90"
                >
                  <FaGithub className="opacity-90" /> <span>GitHub</span>
                </a>
              </div>

              {/* bottom row: Play full width */}
              <a
                // href="./games/tictactoe-ai.html"
                href="#/games/tictactoe-ai"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md bg-gradient-to-r from-green-500 via-emerald-600 to-green-700 text-white shadow hover:opacity-90"
              >
                <FaPlay className="opacity-90" /> <span>Play</span>
              </a>
            </>
          }
        />
      </div>
    </section>
  );
}

