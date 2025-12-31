// components/Education.js

/**
 * TODO FIX:
 * Move any data to ../data/funZone/index.js
 * Clean the code prod-like with modular, reliable, and scalable structure
 */

import React from "react";
import { FaGraduationCap } from "react-icons/fa";
import { createPortal } from "react-dom";

import { EDUCATION } from "../data/education";

import SectionHeader from "./shared/SectionHeader";
import Pill from "./shared/Pill";

import { cx } from "../utils/cx";
import { CARD_SURFACE, CARD_ROUNDED_2XL } from "../utils/ui";

export default function Education() {
  const [openImage, setOpenImage] = React.useState(null);

  const scrollElRef = React.useRef(null);
  const scrollTopRef = React.useRef(0);
  const prevOverflowRef = React.useRef("");
  const prevPaddingRightRef = React.useRef("");

  React.useEffect(() => {
    const scrollEl = scrollElRef.current;
    if (!scrollEl) return;

    if (openImage) {
      scrollTopRef.current = scrollEl.scrollTop;

      prevOverflowRef.current = scrollEl.style.overflowY || "";
      prevPaddingRightRef.current = scrollEl.style.paddingRight || "";

      scrollEl.style.overflowY = "hidden";

      const scrollbarWidth = scrollEl.offsetWidth - scrollEl.clientWidth;
      if (scrollbarWidth > 0) {
        scrollEl.style.paddingRight = `${scrollbarWidth}px`;
      }
    } else {
      scrollEl.style.overflowY = prevOverflowRef.current;
      scrollEl.style.paddingRight = prevPaddingRightRef.current;
      scrollEl.scrollTop = scrollTopRef.current;
    }

    return () => {
      scrollEl.style.overflowY = prevOverflowRef.current;
      scrollEl.style.paddingRight = prevPaddingRightRef.current;
    };
  }, [openImage]);

  return (
    <section
      ref={scrollElRef}
      className="w-full py-0 px-4 transition-colors"
    >
      <SectionHeader icon={FaGraduationCap} title="Education" />

      {/* Cards */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-x-16 gap-y-10 px-6 max-w-6xl mx-auto">
        {EDUCATION.map((edu) => (
          <div
            key={`${edu.school}-${edu.degree}`}
            className={cx(CARD_SURFACE, CARD_ROUNDED_2XL, "p-5 text-left")}
          >
            {/* Header row */}
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl overflow-hidden bg-gray-50 dark:bg-gray-100 border border-gray-200 dark:border-gray-700 flex items-center justify-center shrink-0">
                {edu.logo ? (
                  <img
                    src={edu.logo}
                    alt={`${edu.school} logo`}
                    className="w-full h-full object-contain p-2"
                    loading="lazy"
                  />
                ) : (
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Logo
                  </div>
                )}
              </div>

              <div className="flex-1">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-lg font-semibold font-epilogue text-gray-900 dark:text-white">
                    {edu.school}
                  </h3>

                  {edu.badge && edu.attachment && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setOpenImage(edu.attachment);
                      }}
                      className="group inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full
                                 bg-green-100 text-green-800
                                 dark:bg-green-900/40 dark:text-green-200
                                 border border-green-200 dark:border-green-800
                                 hover:bg-green-200 dark:hover:bg-green-900
                                 transition-colors"
                      aria-label={`View ${edu.badge} certificate`}
                    >
                      {edu.badgeIcon}
                      <span>{edu.badge}</span>
                      <span className="opacity-0 group-hover:opacity-70 text-[10px] transition">
                        (view)
                      </span>
                    </button>
                  )}
                </div>

                <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                  {edu.degree}
                </p>

                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {edu.duration}
                  {edu.location ? ` • ${edu.location}` : ""}
                </p>
              </div>
            </div>

            {/* Coursework */}
            {edu.coursework?.length > 0 && (
              <>
                <div className="mt-5 text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">
                  Coursework
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {edu.coursework.map((c) => (
                    <Pill key={c} variant="purple">
                      {c}
                    </Pill>
                  ))}
                </div>
              </>
            )}

            {/* Activities */}
            {edu.activities?.length > 0 && (
              <p className="mt-4 text-xs text-gray-600 dark:text-gray-400">
                <span className="font-semibold">Activities:</span>{" "}
                {edu.activities.join(", ")}
              </p>
            )}

            {/* Highlights */}
            {edu.highlights?.length > 0 && (
              <ul className="mt-4 text-sm text-gray-700 dark:text-gray-300 list-disc list-outside pl-6 space-y-2">
                {edu.highlights.map((h) => (
                  <li key={h} className="leading-relaxed">
                    {h}
                  </li>
                ))}
              </ul>
            )}

            {/* Tags */}
            {edu.tags?.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4">
                {edu.tags.map((t) => (
                  <Pill key={t} variant="gray">
                    {t}
                  </Pill>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Image Modal */}
      {openImage &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setOpenImage(null)}
            role="dialog"
            aria-modal="true"
          >
            <div
              className="relative max-w-5xl w-full bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                  {openImage.title}
                </p>
                <button
                  type="button"
                  onClick={() => setOpenImage(null)}
                  className="px-3 py-1 text-sm rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-700 transition"
                >
                  Close
                </button>
              </div>

              <div className="max-h-[80vh] overflow-auto bg-black">
                <img
                  src={openImage.image}
                  alt={openImage.title}
                  className="w-full h-auto object-contain"
                />
              </div>
            </div>
          </div>,
          document.body
        )}
    </section>
  );
}
