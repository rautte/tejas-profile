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
import { CARD_SURFACE, CARD_ROUNDED_XL } from "../utils/ui";

import { SKILLS } from "../data/skills";


export default function Skills() {
  return (
    <section className="py-0 px-4 transition-colors">
      <SectionHeader icon={FaCogs} title="Skills" />

      <div className="grid md:grid-cols-2 gap-8 px-6">
        {SKILLS.map(({ category, icon, skills }) => (
          <div key={category} className={cx(CARD_SURFACE, CARD_ROUNDED_XL, "p-6")}>
            <div className="flex items-center gap-3 mb-4">
              {icon}
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white">{category}</h3>
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
    </section>
  );
}