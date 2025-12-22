// src/data/footer/index.js
// keep this as "edit-only" stuff (links + labels)

export const FOOTER_LINKS = [
  {
    key: "linkedin",
    href: "https://www.linkedin.com/in/tejas-raut/",
    label: "LinkedIn",
    colorClass: "text-blue-400 hover:text-[#0A66C2]",
  },
  {
    key: "github",
    href: "https://github.com/rautte/rautte.github.io",
    label: "GitHub",
    colorClass:
      "text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white",
  },
  {
    key: "portfolio",
    href: "https://rautte.github.io/tejas-profile",
    label: "Portfolio",
    colorClass: "text-green-500 hover:text-green-600",
  },
  {
    key: "email",
    href: "mailto:raut.tejas@outlook.com",
    label: "Email",
    colorClass: "text-red-400 hover:text-red-500",
  },
];

// small layout knobs (safe to tweak later)
export const FOOTER_DRAG = {
  marginPx: 14,
  fallbackPillWidthPx: 320,
  defaultOffsetPx: 0,
};
