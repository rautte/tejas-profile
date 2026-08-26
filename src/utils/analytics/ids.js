// src/utils/analytics/ids.js

export const CTA_IDS =
  Object.freeze({
    // Floating / mobile quick connect
    QUICK_CONNECT_LINKEDIN:
      "quick_connect_linkedin",

    QUICK_CONNECT_GITHUB:
      "quick_connect_github",

    QUICK_CONNECT_WEBSITE:
      "quick_connect_website",

    QUICK_CONNECT_EMAIL:
      "quick_connect_email",

    // Desktop footer
    FOOTER_LINKEDIN:
      "footer_linkedin",

    FOOTER_GITHUB:
      "footer_github",

    FOOTER_WEBSITE:
      "footer_website",

    FOOTER_EMAIL:
      "footer_email",

    // Resume
    RESUME_VIEW_PDF:
      "resume_view_pdf",

    RESUME_DOWNLOAD_PDF:
      "resume_download_pdf",

    RESUME_LINKEDIN:
      "resume_linkedin",

    RESUME_EMAIL:
      "resume_email",

    RESUME_WEBSITE:
      "resume_website",

    RESUME_CODE_SNIPPETS:
      "resume_code_snippets",

    // Project action classes.
    // Individual project identity is carried separately as projectId.
    PROJECT_LIVE_DEMO:
      "project_live_demo",

    PROJECT_README:
      "project_readme",

    PROJECT_GITHUB:
      "project_github",

    // Fun Zone — Minesweeper
    FUN_ZONE_MINESWEEPER_CODE:
      "fun_zone_minesweeper_code",

    FUN_ZONE_MINESWEEPER_GITHUB:
      "fun_zone_minesweeper_github",

    FUN_ZONE_MINESWEEPER_PLAY:
      "fun_zone_minesweeper_play",

    // Fun Zone — Battleship
    FUN_ZONE_BATTLESHIP_CODE:
      "fun_zone_battleship_code",

    FUN_ZONE_BATTLESHIP_GITHUB:
      "fun_zone_battleship_github",

    FUN_ZONE_BATTLESHIP_PLAY:
      "fun_zone_battleship_play",

    // Fun Zone — Tic-Tac-Toe
    FUN_ZONE_TICTACTOE_CODE:
      "fun_zone_tictactoe_code",

    FUN_ZONE_TICTACTOE_GITHUB:
      "fun_zone_tictactoe_github",

    FUN_ZONE_TICTACTOE_PLAY:
      "fun_zone_tictactoe_play",
  });

const QUICK_CONNECT_BY_KEY =
  Object.freeze({
    linkedin:
      CTA_IDS
        .QUICK_CONNECT_LINKEDIN,

    github:
      CTA_IDS
        .QUICK_CONNECT_GITHUB,

    portfolio:
      CTA_IDS
        .QUICK_CONNECT_WEBSITE,

    email:
      CTA_IDS
        .QUICK_CONNECT_EMAIL,
  });

const FOOTER_BY_KEY =
  Object.freeze({
    linkedin:
      CTA_IDS.FOOTER_LINKEDIN,

    github:
      CTA_IDS.FOOTER_GITHUB,

    portfolio:
      CTA_IDS.FOOTER_WEBSITE,

    email:
      CTA_IDS.FOOTER_EMAIL,
  });

export function quickConnectCtaId(
  key
) {
  return (
    QUICK_CONNECT_BY_KEY[
      String(key || "")
    ] || ""
  );
}

export function footerCtaId(
  key
) {
  return (
    FOOTER_BY_KEY[
      String(key || "")
    ] || ""
  );
}