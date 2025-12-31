import React from "react";
import { FaSun, FaMoon } from "react-icons/fa";

export default function ThemeToggle({ darkMode, onToggle, className = "" }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`
        p-2 bg-[#26263a] text-white border border-[#31314a]
        rounded-full shadow-sm transition
        hover:ring-2 hover:ring-purple-600
        ${className}
      `}
      title="Toggle dark mode"
      aria-label="Toggle dark mode"
    >
      {darkMode ? (
        <FaSun className="text-yellow-400" />
      ) : (
        <FaMoon className="text-purple-400" />
      )}
    </button>
  );
}
