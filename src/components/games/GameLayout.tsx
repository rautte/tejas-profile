// src/components/GameLayout.tsx

import React from "react";
import { FaSun, FaMoon } from "react-icons/fa";

type Props = {
  title: string;
  darkMode: boolean;
  setDarkMode: (v: boolean) => void;
  children: React.ReactNode;
  backHref?: string; // default: "#/fun-zone"
};

export default function GameLayout({
  title,
  darkMode,
  setDarkMode,
  children,
  backHref = "#/fun-zone",
}: Props) {
  return (
    <main className="min-h-screen flex flex-col items-center bg-gray-50 dark:bg-[#181826] transition-colors p-6">
      {/* Fixed Back link — top-left (exactly like your previous code) */}
        <a
        href={backHref}
        className="
            fixed top-4 left-4 z-50 px-3 py-1.5 rounded-md
            bg-white/80 text-gray-800 ring-1 ring-black/10 hover:bg-white
            dark:bg-[#26263a] dark:text-gray-100 dark:ring-white/10 dark:hover:bg-[#2f2f46]
            transition
        "
        aria-label="Back to Fun Zone"
        >
        ← Back to Fun Zone
        </a>

        {/* Fixed Dark mode toggle — top-right (exactly like your previous code) */}
        <button
        onClick={() => setDarkMode(!darkMode)}
        className="fixed top-4 right-4 z-50 p-2 bg-[#26263a] text-white border border-[#31314a] rounded-full shadow-sm transition hover:ring-2 hover:ring-purple-600"
        title="Toggle dark mode"
        aria-label="Toggle dark mode"
        >
        {darkMode ? (
            <span className="text-yellow-300">
            <FaSun size={18} />
            </span>
        ) : (
            <span className="text-purple-400">
            <FaMoon size={18} />
            </span>
        )}
        </button>

        {/* Title centered below, non-fixed */}
        <div className="w-full mb-4 max-w-4xl px-4 pt-12 pb-2 flex items-center justify-center">
        <h1 className="text-lg sm:text-xl md:text-2xl font-semibold text-gray-800 dark:text-gray-100 text-center">
            {title}
        </h1>
        </div>

        {/* Body */}
        <div className="w-full max-w-4xl px-4 pb-8">{children}</div>
    </main>
  );
}
