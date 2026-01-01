// src/components/Skills.js
// import React from "react";

/**
 * TODO FIX:
 * Move any data to ../data/funZone/index.js
 * Clean the code prod-like with modular, reliable, and scalable structure
 */

import { cx } from "../utils/cx";
import Pill from "./shared/Pill";
import { FaCogs } from "react-icons/fa";
import SectionHeader from "./shared/SectionHeader";
import {
  CARD_SURFACE,
  CARD_ROUNDED_XL,
  SECTION_SHELL,
  SECTION_CONTAINER,
} from "../utils/ui";

import { SKILLS } from "../data/skills";

export default function Skills() {
  return (
    <section className={SECTION_SHELL}>
      <SectionHeader icon={FaCogs} title="Skills" />

      <div className={SECTION_CONTAINER}>
        <div className="grid md:grid-cols-2 gap-8">
          {SKILLS.map(({ category, icon, skills }) => (
            <div
              key={category}
              className={cx(CARD_SURFACE, CARD_ROUNDED_XL, "p-4 sm:p-6")}
            >
              <div className="flex items-center gap-3 mb-4">
                {icon}
                <h3 className="text-md md:text-lg font-semibold text-gray-800 dark:text-white">
                  {category}
                </h3>
              </div>

              <div className="flex flex-wrap gap-2">
                {skills.map((s) => (
                  <Pill key={s} variant="gray">
                    {s}
                  </Pill>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
