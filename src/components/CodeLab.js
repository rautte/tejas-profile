// src/components/CodeLab.js
import React from "react";
import { FaCode } from 'react-icons/fa';

export default function CodeLab({ darkMode }) {
  const snippets = [
    {
      title: "Array → Map (JS)",
      lang: "js",
      code: `const names = ["Ada", "Grace", "Linus"];
const upper = names.map(n => n.toUpperCase());
console.log(upper); // ["ADA","GRACE","LINUS"]`,
    },
    {
      title: "Debounce (React)",
      lang: "js",
      code: `function debounce(fn, delay = 300){
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  };
}`,
    },
    {
      title: "SQL: Top Projects",
      lang: "sql",
      code: `SELECT project_id, name, stars
FROM projects
ORDER BY stars DESC
LIMIT 5;`,
    },
  ];

  return (
     <section className="py-8 px-4 bg-gray-50 dark:bg-[#181826] transition-colors">
        {/* Header */}
        <div className="px-6 mb-10">
            <h2 className="text-3xl font-bold text-purple-700 dark:text-purple-300 font-epilogue drop-shadow-md flex items-center gap-3">
              <FaCode className="text-3xl text-purple-700 dark:text-purple-300" />
              Code Lab
            </h2>
            {/* <div className="w-64 h-0.5 mt-2 rounded-full bg-gradient-to-r from-purple-700 via-purple-900 to-purple-600 dark:from-purple-500 dark:via-purple-600 dark:to-purple-400 backdrop-blur-sm opacity-90 shadow-[0_0_2px_1px_rgba(147,51,234,0.6)]"></div> */}
        </div>
        <header>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
            A quick gallery of small, well-commented snippets that reflect my coding style.
            </p>
        </header>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
            {snippets.map(({ title, code, lang }, i) => (
            <article
                key={i}
                className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-[#1f2230] shadow-lg overflow-hidden"
            >
                <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <h3 className="font-semibold text-gray-800 dark:text-gray-100">{title}</h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200">
                    {lang}
                </span>
                </div>
                <pre className="p-4 overflow-x-auto text-sm leading-relaxed bg-gray-50 dark:bg-[#191b28] text-gray-800 dark:text-gray-200">
                <code>{code}</code>
                </pre>
            </article>
            ))}
        </div>
        </section>
    );
    }
