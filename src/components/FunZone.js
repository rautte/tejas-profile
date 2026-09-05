// src/components/FunZone.js

import React from "react";

import {
  FaDownload,
  FaGithub,
  FaPlay,
} from "react-icons/fa";

import {
  GiConsoleController,
} from "react-icons/gi";

import JSZip from "jszip";

import {
  saveAs,
} from "file-saver";

import SectionHeader from "./shared/SectionHeader";

import {
  cx,
} from "../utils/cx";

import {
  CARD_ROUNDED_2XL,
  CARD_SURFACE,
} from "../utils/ui";

import {
  CTA_IDS,
} from "../utils/analytics/ids";

import {
  BattleshipSVG,
  MinesweeperSVG,
  TicTacToeSVG,
} from "./games/GameSVGs";


/**
 * Platform-owned runtime mapping.
 *
 * Profile content says WHAT should be exposed.
 * The current platform decides HOW that game is rendered,
 * routed, downloaded and instrumented.
 */
const GAME_RUNTIME =
  Object.freeze({
    minesweeper: {
      svgId:
        "minesweeper-svg",

      baseName:
        "minesweeper",

      Preview:
        MinesweeperSVG,

      codeHref:
        "./downloads/Minesweeper.zip",

      playHref:
        "#/fun-zone/minesweeper",

      analytics: {
        code:
          CTA_IDS
            .FUN_ZONE_MINESWEEPER_CODE,

        github:
          CTA_IDS
            .FUN_ZONE_MINESWEEPER_GITHUB,

        play:
          CTA_IDS
            .FUN_ZONE_MINESWEEPER_PLAY,
      },
    },


    battleship: {
      svgId:
        "battleship-svg",

      baseName:
        "battleship",

      Preview:
        BattleshipSVG,

      codeHref:
        "./downloads/Battleship.zip",

      playHref:
        "#/fun-zone/battleship",

      analytics: {
        code:
          CTA_IDS
            .FUN_ZONE_BATTLESHIP_CODE,

        github:
          CTA_IDS
            .FUN_ZONE_BATTLESHIP_GITHUB,

        play:
          CTA_IDS
            .FUN_ZONE_BATTLESHIP_PLAY,
      },
    },


    tictactoe: {
      svgId:
        "tictactoe-svg",

      baseName:
        "tictactoe",

      Preview:
        TicTacToeSVG,

      codeHref:
        "./downloads/TicTacToe_AI.zip",

      playHref:
        "#/fun-zone/tictactoe",

      analytics: {
        code:
          CTA_IDS
            .FUN_ZONE_TICTACTOE_CODE,

        github:
          CTA_IDS
            .FUN_ZONE_TICTACTOE_GITHUB,

        play:
          CTA_IDS
            .FUN_ZONE_TICTACTOE_PLAY,
      },
    },
  });


/**
 * Package a ZIP containing the live SVG,
 * a demo source file, README and requirements.txt.
 *
 * This remains Platform behavior.
 */
const downloadZipBySvgId =
  async (
    id,
    baseName
  ) => {
    const root =
      document.getElementById(
        id
      );

    if (!root) {
      return;
    }

    const svgEl =
      root.tagName
        ?.toLowerCase() ===
      "svg"
        ? root
        : root.querySelector(
            "svg"
          );

    if (!svgEl) {
      return;
    }

    const clone =
      svgEl.cloneNode(
        true
      );

    if (
      !clone.getAttribute(
        "xmlns"
      )
    ) {
      clone.setAttribute(
        "xmlns",
        "http://www.w3.org/2000/svg"
      );
    }

    if (
      !clone.getAttribute(
        "xmlns:xlink"
      )
    ) {
      clone.setAttribute(
        "xmlns:xlink",
        "http://www.w3.org/1999/xlink"
      );
    }

    const serialized =
      new XMLSerializer()
        .serializeToString(
          clone
        );

    const svg =
      `<?xml version="1.0" encoding="UTF-8"?>\n${serialized}`;

    const zip =
      new JSZip();

    zip.file(
      `${baseName}.svg`,
      svg
    );

    const demoHtml =
      `<!doctype html>
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

    zip.file(
      "source/index.html",
      demoHtml
    );

    const readme =
      `# ${baseName}
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

    zip.file(
      "README.md",
      readme
    );

    const reqs =
      `# No Python/Node packages strictly required.
# Optional: 'serve' (Node) for a local static server.
`;

    zip.file(
      "requirements.txt",
      reqs
    );

    const blob =
      await zip.generateAsync({
        type:
          "blob",
      });

    saveAs(
      blob,
      `${baseName}.zip`
    );
  };


function GameActions({
  game,
  runtime,
}) {
  return (
    <>
      <div className="flex w-full gap-5 mt-3">
        <a
          href={
            runtime.codeHref
          }
          data-analytics={
            runtime
              .analytics
              .code
          }
          download
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md bg-gradient-to-r from-purple-500/80 via-purple-600/80 to-purple-700/80 text-white shadow hover:opacity-90"
        >
          <FaDownload className="opacity-90" />

          <span>
            Code
          </span>
        </a>


        {game.githubUrl ? (
          <a
            href={
              game.githubUrl
            }
            data-analytics={
              runtime
                .analytics
                .github
            }
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md bg-gradient-to-r from-gray-700/80 via-gray-800/80 to-gray-900/80 text-white shadow hover:opacity-90"
          >
            <FaGithub className="opacity-90" />

            <span>
              GitHub
            </span>
          </a>
        ) : null}
      </div>


      <a
        href={
          runtime.playHref
        }
        data-analytics={
          runtime
            .analytics
            .play
        }
        className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md bg-gradient-to-r from-green-500/80 via-emerald-600/80 to-green-700/80 text-white shadow hover:opacity-90"
      >
        <FaPlay className="opacity-90" />

        <span>
          Play
        </span>
      </a>
    </>
  );
}


function GameCard({
  game,
  runtime,
}) {
  const Preview =
    runtime.Preview;

  return (
    <div
      className={cx(
        CARD_SURFACE,
        CARD_ROUNDED_2XL,
        "group w-full max-w-[320px]"
      )}
    >
      <div className="transition-transform duration-300 group-hover:-translate-y-1">
        <div className="px-6 pt-6">
          <h3 className="text-xl text-center font-semibold text-purple-700 dark:text-purple-300 mb-4">
            {game.title}
          </h3>
        </div>


        <div className="px-6">
          <div
            id={
              runtime.svgId
            }
            onDoubleClick={() =>
              downloadZipBySvgId(
                runtime.svgId,
                runtime.baseName
              )
            }
            title="Double-click to download ZIP generated from this SVG"
            className="cursor-pointer"
          >
            <Preview />
          </div>
        </div>


        <div className="px-6 pb-6 pt-4">
          <div className="text-sm text-gray-700 dark:text-gray-300 space-y-3">
            <GameActions
              game={
                game
              }
              runtime={
                runtime
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}


export default function FunZone({
  funZone = {},
}) {
  const visibleGames =
    Array.isArray(
      funZone.games
    )
      ? funZone.games.filter(
          (game) =>
            game?.enabled !==
            false
        )
      : [];


  return (
    <section className="py-0 px-4 transition-colors">
      <SectionHeader
        icon={
          GiConsoleController
        }
        title="Fun Zone"
      />


      <p className="text-gray-600 dark:text-gray-300 px-6 mb-14 font-epilogue">
        {
          funZone.subtitle
        }
      </p>


      <div className="flex flex-wrap justify-center gap-10 px-4">
        {visibleGames.map(
          (game) => {
            const runtime =
              GAME_RUNTIME[
                game.id
              ];

            /**
             * Fail closed for a Profile Variant that references
             * a game capability the current Platform does not know.
             *
             * P3 activation compatibility will eventually catch
             * this before activation.
             */
            if (!runtime) {
              return null;
            }

            return (
              <GameCard
                key={
                  game.id
                }
                game={
                  game
                }
                runtime={
                  runtime
                }
              />
            );
          }
        )}
      </div>
    </section>
  );
}