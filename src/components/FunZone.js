// src/components/FunZone.js

import React from "react";
// import TicTacToeWeb from "@/components/TicTacToeWeb";
import { FaPlay, FaGithub, FaDownload } from 'react-icons/fa';
import { GiConsoleController } from 'react-icons/gi';
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { BattleshipSVG, MinesweeperSVG, TicTacToeSVG } from "./games/GameSVGs";

// helper: package a zip containing the live SVG, a demo source file, README, and requirements.txt
const downloadZipBySvgId = async (id, baseName) => {
  const root = document.getElementById(id);
  if (!root) return;

  // Accept either the SVG itself or a wrapper containing one
  const svgEl = root.tagName?.toLowerCase() === "svg" ? root : root.querySelector("svg");
  if (!svgEl) return;

  // Clone so we can tweak attrs without touching the live DOM
  const clone = svgEl.cloneNode(true);

  // Ensure required namespaces for a clean standalone SVG
  if (!clone.getAttribute("xmlns")) clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  if (!clone.getAttribute("xmlns:xlink")) clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");

  const serialized = new XMLSerializer().serializeToString(clone);
  const svg = `<?xml version="1.0" encoding="UTF-8"?>\n${serialized}`;

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
This ZIP was generated from https://rautte.github.io/tejas-profile/#/fun-zone.

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


export default function Fun() {
  return (
    <section className="py-0 px-4 bg-gray-50 dark:bg-[#181826] transition-colors">
      {/* Title */}
      <div className="text-left px-6 mb-10">
        <h2 className="text-3xl font-bold text-purple-700 dark:text-purple-300 font-epilogue drop-shadow-md flex items-center gap-3">
          <GiConsoleController className="text-4xl text-purple-700 dark:text-purple-300" />
          Fun Zone
        </h2>
      </div>

      {/* Subtitle */}
      <p className="text-gray-600 dark:text-gray-300 px-6 mb-14 font-epilogue">
        If you’ve reached this far, take a break and enjoy some simple mini-games I built just for fun!
      </p>

      {/* Cards */}
      <div className="flex flex-wrap justify-center gap-10 px-4">
        <Card
          title="Minesweeper"
          preview={
            <div
              onDoubleClick={() => downloadZipBySvgId('minesweeper-svg', 'minesweeper')}
              title="Double-click to download ZIP to this SVG"
              className="cursor-pointer"
            >
              < MinesweeperSVG />
            </div>
          }
          actions={
            <>
              {/* top row: Code (left) + GitHub (right) */}
              <div className="flex w-full gap-5 mt-3">
                <a
                  href="./downloads/Minesweeper.zip"
                  download
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md bg-gradient-to-r from-purple-500/80 via-purple-600/80 to-purple-700/80 text-white shadow hover:opacity-90"
                >
                  <FaDownload className="opacity-90" /> <span>Code</span>
                </a>
                <a
                  href="https://github.com/rautte/Minesweeper"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md bg-gradient-to-r from-gray-700/80 via-gray-800/80 to-gray-900/80 text-white shadow hover:opacity-90"
                >
                  <FaGithub className="opacity-90" /> <span>GitHub</span>
                </a>
              </div>

              {/* bottom row: Play full width */}
              <a
                href="#/fun-zone/minesweeper"
                className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md bg-gradient-to-r from-green-500/80 via-emerald-600/80 to-green-700/80 text-white shadow hover:opacity-90"
              >
                <FaPlay className="opacity-90" /> <span>Play</span>
              </a>
            </>
          }
        />

        <Card
          title="Battleship"
          preview={
            <div
              onDoubleClick={() => downloadZipBySvgId('battleship-svg', 'battleship')}
              title="Double-click to download ZIP to this SVG"
              className="cursor-pointer"
            >
              < BattleshipSVG />
            </div>
          }
          actions={
            <>
              {/* top row: Code (left) + GitHub (right) */}
              <div className="flex w-full gap-5 mt-3">
                <a
                  href="./downloads/Battleship.zip"
                  download
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md bg-gradient-to-r from-purple-500/80 via-purple-600/80 to-purple-700/80 text-white shadow hover:opacity-90"
                >
                  <FaDownload className="opacity-90" /> <span>Code</span>
                </a>
                <a
                  href="https://github.com/rautte/Battleship"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md bg-gradient-to-r from-gray-700/80 via-gray-800/80 to-gray-900/80 text-white shadow hover:opacity-90"
                >
                  <FaGithub className="opacity-90" /> <span>GitHub</span>
                </a>
              </div>

              {/* bottom row: Play full width */}
              <a
                href="#/fun-zone/battleship"
                className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md bg-gradient-to-r from-green-500/80 via-emerald-600/80 to-green-700/80 text-white shadow hover:opacity-90"
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
              onDoubleClick={() => downloadZipBySvgId('tictactoe-svg', 'tictactoe')}
              title="Double-click to download ZIP to this SVG"
              className="cursor-pointer"
            >
              < TicTacToeSVG />
            </div>
          }
          actions={
            <>
              {/* top row: Code (left) + GitHub (right) */}
              <div className="flex w-full gap-5 mt-3">
                <a
                  href="./downloads/TicTacToe.zip"
                  download
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md bg-gradient-to-r from-purple-500/90 via-purple-600/90 to-purple-700/90 text-white shadow hover:opacity-90"
                >
                  <FaDownload className="opacity-90" /> <span>Code</span>
                </a>
                <a
                  href="https://github.com/rautte/TicTacToe"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md bg-gradient-to-r from-gray-700/90 via-gray-800/90 to-gray-900/90 text-white shadow hover:opacity-90"
                >
                  <FaGithub className="opacity-90" /> <span>GitHub</span>
                </a>
              </div>

              {/* bottom row: Play full width */}
              <a
                href="#/fun-zone/tictactoe"
                // target="_blank"
                // rel="noopener noreferrer"
                className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md bg-gradient-to-r from-green-500/90 via-emerald-600/90 to-green-700/90 text-white shadow hover:opacity-90"
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

