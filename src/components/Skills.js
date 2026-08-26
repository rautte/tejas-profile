// src/components/Skills.js
// import React from "react";

import { cx } from "../utils/cx";
import Pill from "./shared/Pill";
import {
  FaAws,
  FaChartBar,
  FaCloud,
  FaCode,
  FaCogs,
  FaDatabase,
  FaTools,
} from "react-icons/fa";
import SectionHeader from "./shared/SectionHeader";
import {
  CARD_SURFACE,
  CARD_ROUNDED_XL,
  SECTION_SHELL,
  SECTION_CONTAINER,
} from "../utils/ui";


const SKILL_PRESENTATION =
  Object.freeze({
    "Programming Languages": {
      Icon:
        FaCode,

      className:
        "text-gray-600 dark:text-gray-200 text-lg",
    },

    "Python Libraries & ML/AI": {
      Icon:
        FaCode,

      className:
        "text-pink-500 dark:text-pink-400 text-lg",
    },

    AWS: {
      Icon:
        FaAws,

      className:
        "text-indigo-500 dark:text-indigo-300 text-lg",
    },

    "Databases & Big Data": {
      Icon:
        FaDatabase,

      className:
        "text-green-600 dark:text-green-400 text-lg",
    },

    "Cloud & DevOps": {
      Icon:
        FaCloud,

      className:
        "text-blue-500 dark:text-blue-400 text-lg",
    },

    "Frameworks & Web": {
      Icon:
        FaTools,

      className:
        "text-yellow-500 dark:text-yellow-400 text-lg",
    },

    "Visualization & ERP": {
      Icon:
        FaChartBar,

      className:
        "text-indigo-500 dark:text-indigo-300 text-lg",
    },
  });


function skillPresentation(
  category
) {
  return (
    SKILL_PRESENTATION[
      category
    ] || {
      Icon:
        FaTools,

      className:
        "text-gray-600 dark:text-gray-300 text-lg",
    }
  );
}

export default function Skills({
  skills = [],
}) {
  return (
    <section className={SECTION_SHELL}>
      <SectionHeader icon={FaCogs} title="Skills" />

      <div className={SECTION_CONTAINER}>
        <div className="grid md:grid-cols-2 gap-8">
          {skills.map(({
            category,
            skills:
              items,
          }) => {
            const {
              Icon,
              className: iconClassName,
            } =
              skillPresentation(
                category
              );

            return (
            <div
              key={category}
              className={cx(CARD_SURFACE, CARD_ROUNDED_XL, "p-4 sm:p-6")}
            >
              <div className="flex items-center gap-3 mb-4">
                <Icon className={iconClassName} />
                <h3 className="text-md md:text-lg font-semibold text-gray-800 dark:text-white">
                  {category}
                </h3>
              </div>

              <div className="flex flex-wrap gap-2">
                {items.map((s) => (
                  <Pill key={s} variant="gray">
                    {s}
                  </Pill>
                ))}
              </div>
            </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
