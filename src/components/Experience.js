// components/Experience.js

/**
 * TODO FIX:
 * Move any data to ../data/funZone/index.js
 * Clean the code prod-like with modular, reliable, and scalable structure
 */

import React from "react";
import { FaBriefcase } from "react-icons/fa";
import { EXPERIENCE } from "../data/experience";

import SectionHeader from "./shared/SectionHeader";
import Pill from "./shared/Pill";

import { cx } from "../utils/cx";
import { CARD_SURFACE, CARD_ROUNDED_XL } from "../utils/ui";

function ExperienceCard({ exp }) {
  return (
    <div className={cx(CARD_SURFACE, CARD_ROUNDED_XL, "p-6 text-left")}>
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold font-epilogue text-gray-900 dark:text-white">
            {exp.company}
          </h3>

          <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
            {exp.role}
            {exp.employmentType ? (
              <span className="text-gray-500 dark:text-gray-400">
                {" "}
                • {exp.employmentType}
              </span>
            ) : null}
          </p>

          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {exp.duration}
            {exp.location ? ` • ${exp.location}` : ""}
          </p>
        </div>
      </div>

      {/* Highlights */}
      {exp.highlights?.length > 0 && (
        <ul className="mt-4 text-sm text-gray-700 dark:text-gray-300 list-disc list-outside pl-6 space-y-2">
          {exp.highlights.map((h) => (
            <li key={h} className="leading-relaxed">
              {h}
            </li>
          ))}
        </ul>
      )}

      {/* Tags */}
      {exp.tags?.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-4">
          {exp.tags.map((t) => (
            <Pill key={t} variant="purple">
              {t}
            </Pill>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Experience() {
  // const [showEarly, setShowEarly] = React.useState(false);

  return (
    <section className="w-full py-0 px-4 transition-colors">
      <SectionHeader icon={FaBriefcase} title="Experience" />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-x-16 gap-y-10 px-6 max-w-6xl mx-auto">
        {EXPERIENCE.map((exp) => (
          <ExperienceCard key={`${exp.company}-${exp.role}`} exp={exp} />
        ))}
      </div>

      {/* Collapsible Early Experience (kept commented as-is) */}
      {/* ... */}
    </section>
  );
}
