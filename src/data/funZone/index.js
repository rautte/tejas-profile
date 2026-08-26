// src/data/funZone/index.js
// Recruiter-facing Fun Zone catalog/content only.
//
// Game implementation, routes, preview components,
// CTA IDs, download implementation and rendering belong
// to the current platform.

export const FUN_ZONE_DATA = {
  subtitle:
    "If you’ve reached this far, take a break and enjoy some simple mini-games I built just for fun!",

  games: [
    {
      id:
        "minesweeper",

      title:
        "Minesweeper",

      enabled:
        true,

      githubUrl:
        "https://github.com/rautte/Minesweeper",
    },

    {
      id:
        "battleship",

      title:
        "Battleship",

      enabled:
        true,

      githubUrl:
        "https://github.com/rautte/Battleship",
    },

    {
      id:
        "tictactoe",

      title:
        "Tic Tac Toe (AI)",

      enabled:
        true,

      githubUrl:
        "https://github.com/rautte/TicTacToe_AI",
    },
  ],
};