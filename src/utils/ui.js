// src/utils/ui.js
// Centralized UI class tokens (Tailwind) so styles stay consistent across sections.

// ---- Card surfaces ----
export const CARD_SURFACE =
  "border border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-800/60 backdrop-blur-md shadow-lg hover:shadow-xl transition-shadow duration-300";

export const CARD_ROUNDED_XL = "rounded-xl";
export const CARD_ROUNDED_2XL = "rounded-2xl";

// ---- Pills / tags ----
export const PILL_BASE =
  "text-xs font-medium px-3 py-1 rounded-full transition-colors";

// Interactive (default across site)
export const PILL_GRAY =
  "bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white hover:bg-purple-200 dark:hover:bg-purple-600";

export const PILL_PURPLE =
  "bg-purple-100 text-purple-800 dark:bg-purple-800 dark:text-white hover:bg-purple-200 dark:hover:bg-purple-700";

// ✅ Static (no hover) — used ONLY where we want “label pills”
export const PILL_GRAY_STATIC =
  "bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white";

export const PILL_PURPLE_STATIC =
  "bg-purple-100 text-purple-800 dark:bg-purple-800 dark:text-white";

// ---- Section title tokens (your established style) ----
export const SECTION_TITLE =
  "text-3xl font-bold text-purple-700 dark:text-purple-300 font-epilogue drop-shadow-md flex items-center gap-3";

export const SECTION_ICON =
  "text-3xl text-purple-700 dark:text-purple-300";

export const SECTION_UNDERLINE =
  "w-64 h-0.5 mt-2 rounded-full bg-gradient-to-r from-purple-700 via-purple-900 to-purple-600 dark:from-purple-500 dark:via-purple-600 dark:to-purple-400 backdrop-blur-sm opacity-90 shadow-[0_0_2px_1px_rgba(147,51,234,0.6)]";

// MOBILE CONSISTENCY
export const SECTION_SHELL = "w-full py-1 px-1 md:px-4 transition-colors";
export const SECTION_CONTAINER = "px-0 sm:px-6 md:px-4 max-w-6xl mx-auto";

// (optional) common mobile body text
export const BODY_TEXT =
  "text-gray-800 dark:text-gray-300 leading-relaxed font-epilogue text-[12px] sm:text-md md:text-[15px]";
