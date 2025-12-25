// src/components/FunZone.js

/**
 * TODO FIX:
 * Update a Note inside Battleship game play "open sea" option mentioning out-of-order
 * Reestablish the Firebase DB connection for room availability
 * Check the Downloadable code for all three games if they are up-to-date
 * Move any data to ../data/funZone/index.js
 * Clean the code prod-like with modular, reliable, and scalable structure
 */

import React from "react";
import { FaPlay, FaGithub, FaDownload } from "react-icons/fa";
import { GiConsoleController } from "react-icons/gi";
import JSZip from "jszip";
import { saveAs } from "file-saver";

import SectionHeader from "./shared/SectionHeader";
import { cx } from "../utils/cx";
import { CARD_SURFACE, CARD_ROUNDED_2XL } from "../utils/ui";

import { BattleshipSVG, MinesweeperSVG, TicTacToeSVG } from "./games/GameSVGs";

// helper: package a zip containing the live SVG, a demo source file, README, and requirements.txt
const downloadZipBySvgId = async (id, baseName) => {
  const root = document.getElementById(id);
  if (!root) return;

  // Accept either the SVG itself or a wrapper containing one
  const svgEl =
    root.tagName?.toLowerCase() === "svg" ? root : root.querySelector("svg");
  if (!svgEl) return;

  // Clone so we can tweak attrs without touching the live DOM
  const clone = svgEl.cloneNode(true);

  // Ensure required namespaces for a clean standalone SVG
  if (!clone.getAttribute("xmlns"))
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  if (!clone.getAttribute("xmlns:xlink"))
    clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");

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

function GameCard({ title, svgId, baseName, preview, actions }) {
  return (
    <div className={cx(CARD_SURFACE, CARD_ROUNDED_2XL, "group w-[320px]")}>
      {/* Move only inner content on hover to prevent jitter */}
      <div className="transition-transform duration-300 group-hover:-translate-y-1">
        {/* Title */}
        <div className="px-6 pt-6">
          <h3 className="text-xl text-center font-semibold text-purple-700 dark:text-purple-300 mb-4">
            {title}
          </h3>
        </div>

        {/* Preview (double-click → generate zip from SVG) */}
        <div className="px-6">
          <div
            id={svgId}
            onDoubleClick={() => downloadZipBySvgId(svgId, baseName)}
            title="Double-click to download ZIP generated from this SVG"
            className="cursor-pointer"
          >
            {preview}
          </div>
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

export default function FunZone() {
  return (
    <section className="py-0 px-4 transition-colors">
      <SectionHeader icon={GiConsoleController} title="Fun Zone" />

      {/* Subtitle */}
      <p className="text-gray-600 dark:text-gray-300 px-6 mb-14 font-epilogue">
        If you’ve reached this far, take a break and enjoy some simple mini-games I built just for fun!
      </p>

      {/* Cards */}
      <div className="flex flex-wrap justify-center gap-10 px-4">
        <GameCard
          title="Minesweeper"
          svgId="minesweeper-svg"
          baseName="minesweeper"
          preview={<MinesweeperSVG />}
          actions={
            <>
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

              <a
                href="#/fun-zone/minesweeper"
                className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md bg-gradient-to-r from-green-500/80 via-emerald-600/80 to-green-700/80 text-white shadow hover:opacity-90"
              >
                <FaPlay className="opacity-90" /> <span>Play</span>
              </a>
            </>
          }
        />

        <GameCard
          title="Battleship"
          svgId="battleship-svg"
          baseName="battleship"
          preview={<BattleshipSVG />}
          actions={
            <>
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

              <a
                href="#/fun-zone/battleship"
                className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md bg-gradient-to-r from-green-500/80 via-emerald-600/80 to-green-700/80 text-white shadow hover:opacity-90"
              >
                <FaPlay className="opacity-90" /> <span>Play</span>
              </a>
            </>
          }
        />

        <GameCard
          title="Tic Tac Toe (AI)"
          svgId="tictactoe-svg"
          baseName="tictactoe"
          preview={<TicTacToeSVG />}
          actions={
            <>
              <div className="flex w-full gap-5 mt-3">
                <a
                  href="./downloads/TicTacToe_AI.zip"
                  download
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md bg-gradient-to-r from-purple-500/80 via-purple-600/80 to-purple-700/80 text-white shadow hover:opacity-90"
                >
                  <FaDownload className="opacity-90" /> <span>Code</span>
                </a>

                <a
                  href="https://github.com/rautte/TicTacToe_AI"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md bg-gradient-to-r from-gray-700/80 via-gray-800/80 to-gray-900/80 text-white shadow hover:opacity-90"
                >
                  <FaGithub className="opacity-90" /> <span>GitHub</span>
                </a>
              </div>

              <a
                href="#/fun-zone/tictactoe"
                className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md bg-gradient-to-r from-green-500/80 via-emerald-600/80 to-green-700/80 text-white shadow hover:opacity-90"
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
