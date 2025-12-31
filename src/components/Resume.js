// src/components/Resume.js
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { HiOutlineEye } from "react-icons/hi";
import {
  FaFileAlt,
  FaLink,
  FaEnvelope,
  FaPhoneAlt,
  FaMapMarkerAlt,
} from "react-icons/fa";

import { RESUME_DATA } from "../data/resume";
import { normalizeUrl, mailto } from "../lib/resume/template";

import SectionHeader from "./shared/SectionHeader";
import Pill from "./shared/Pill";

import { cx } from "../utils/cx";
import { CARD_SURFACE, CARD_ROUNDED_2XL } from "../utils/ui";

// -----------------------------
// Local helpers (keep local: Resume-specific)
// -----------------------------
const CODE_SNIPPETS_CLASS =
  "text-xs text-purple-500 hover:text-purple-600 underline italic underline-offset-2";

const BULLET_LIST_CLASS =
  "list-disc list-outside text-left text-sm text-gray-700 dark:text-gray-200 space-y-2 w-full max-w-[97%] pl-6";

const BULLET_ITEM_CLASS = "pl-2";
const DIVIDER_CLASS = "mt-6 h-px w-full bg-gray-200/80 dark:bg-white/10";

// Pill layout for Resume chips (icons + border)
const RESUME_PILL_CLASS =
  "inline-flex items-center gap-2 border border-indigo-100/80 dark:border-white/10";

// ✅ Only Quick Info pills should highlight on hover
const RESUME_PILL_INTERACTIVE_CLASS =
  "group-hover:bg-purple-200 dark:group-hover:bg-purple-600 transition-colors duration-200";

/** CodeLab deep-link mapping */
const CODE_SNIPPETS_FROM_BY_MATCH = [
  { match: "battleship", from: "battleship" },
  { match: "formula", from: "formula" },
  { match: "developer", from: "syzmaniac,sys_managed" },
];

function getCodeLabFrom(projectName) {
  const name = String(projectName || "").toLowerCase();
  const hit = CODE_SNIPPETS_FROM_BY_MATCH.find((x) => name.includes(x.match));
  return hit?.from || null;
}

// -----------------------------
// Section Card (kept local: Resume has specific header/body style)
// -----------------------------
function SectionCard({ title, action, children }) {
  return (
    <div className={cx(CARD_SURFACE, CARD_ROUNDED_2XL)}>
      <div className="px-6 py-3 border-b rounded-t-2xl bg-gray-200/70 dark:bg-gray-700/70 border-gray-200/70 dark:border-white/10 flex items-center justify-between">
        <h3 className="text-left font-epilogue text-lg font-semibold text-gray-900 dark:text-gray-100">
          {title}
        </h3>
        {action && <div>{action}</div>}
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}

// -----------------------------
// Scroll lock helpers (for <main role="main">)
// -----------------------------
function lockMainScroll(modalPanelRef, scrollTopRef) {
  const host = document.querySelector('main[role="main"]');
  if (!host) return null;

  scrollTopRef.current = host.scrollTop;

  const prev = {
    overflow: host.style.overflow,
    overscrollBehavior: host.style.overscrollBehavior,
    scrollBehavior: host.style.scrollBehavior,
  };

  host.style.overflow = "hidden";
  host.style.overscrollBehavior = "none";
  host.style.scrollBehavior = "auto";

  const blockScroll = (e) => {
    const panel = modalPanelRef.current;
    if (!panel) return;
    if (panel.contains(e.target)) return;
    e.preventDefault();
  };

  document.addEventListener("wheel", blockScroll, { passive: false });
  document.addEventListener("touchmove", blockScroll, { passive: false });

  return () => {
    document.removeEventListener("wheel", blockScroll);
    document.removeEventListener("touchmove", blockScroll);

    host.style.overflow = prev.overflow;
    host.style.overscrollBehavior = prev.overscrollBehavior;
    host.style.scrollBehavior = prev.scrollBehavior;

    host.scrollTop = scrollTopRef.current;
  };
}

export default function Resume() {
  const pdfSrc = "./downloads/TejasRaut_Resume.pdf";

  const hdr = RESUME_DATA.header;

  const websiteUrl = useMemo(() => normalizeUrl(hdr.websiteURL), [hdr.websiteURL]);
  const linkedinUrl = useMemo(() => normalizeUrl(hdr.linkedinURL), [hdr.linkedinURL]);

  const [isPdfPreviewOpen, setIsPdfPreviewOpen] = useState(false);

  const modalPanelRef = useRef(null);
  const scrollTopRef = useRef(0);

  useEffect(() => {
    if (!isPdfPreviewOpen) return;
    const unlock = lockMainScroll(modalPanelRef, scrollTopRef);
    return unlock || undefined;
  }, [isPdfPreviewOpen]);

  useEffect(() => {
    if (!isPdfPreviewOpen) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") setIsPdfPreviewOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isPdfPreviewOpen]);

  return (
    <section className="py-0 px-4 transition-colors">
      <SectionHeader icon={FaFileAlt} title="Resume" />

      <div className="max-w-5xl mx-auto space-y-6">
        {/* 1) Quick Info (ONLY card with interactive pills) */}
        <SectionCard
          title="Quick Info"
          action={
            <div className="flex gap-2">
              <button
                onClick={() => setIsPdfPreviewOpen(true)}
                className="inline-flex items-center gap-2 text-xs px-3 py-2 bg-green-600 text-white rounded-lg shadow hover:bg-green-700 transition font-small"
                type="button"
              >
                <HiOutlineEye className="text-base" />
                View PDF
              </button>
            </div>
          }
        >
          <div className="flex flex-col gap-4">
            <div className="text-center">
              <div className="text-2xl font-semibold text-gray-900 dark:text-gray-100 font-epilogue">
                {hdr.name}
              </div>

              <div className="mt-6 flex justify-center flex-wrap gap-2 text-sm">
                <span className="group">
                  <Pill
                    variant="grayStatic"
                    className={cx(RESUME_PILL_CLASS, RESUME_PILL_INTERACTIVE_CLASS)}
                  >
                    <FaMapMarkerAlt className="opacity-80" />
                    {hdr.location}
                  </Pill>
                </span>

                 <a href={linkedinUrl} target="_blank" rel="noreferrer" className="hover:opacity-90 transition">
                  <span className="group">
                    <Pill
                      variant="grayStatic"
                      className={cx(RESUME_PILL_CLASS, RESUME_PILL_INTERACTIVE_CLASS)}
                    >
                      <FaLink className="opacity-80" />
                      {hdr.linkedin}
                    </Pill>
                  </span>
                </a>

                <a href={mailto(hdr.email)} className="hover:opacity-90 transition">
                  <span className="group">
                    <Pill
                      variant="grayStatic"
                      className={cx(RESUME_PILL_CLASS, RESUME_PILL_INTERACTIVE_CLASS)}
                    >
                      <FaEnvelope className="opacity-80" />
                      {hdr.email}
                    </Pill>
                  </span>
                </a>

                <a href={websiteUrl} target="_blank" rel="noreferrer" className="hover:opacity-90 transition">
                  <span className="group">
                    <Pill
                      variant="grayStatic"
                      className={cx(RESUME_PILL_CLASS, RESUME_PILL_INTERACTIVE_CLASS)}
                    >
                      <FaLink className="opacity-80" />
                      {hdr.website}
                    </Pill>
                  </span>
                </a>

                <span className="group">
                  <Pill
                    variant="grayStatic"
                    className={cx(RESUME_PILL_CLASS, RESUME_PILL_INTERACTIVE_CLASS)}
                  >
                    <FaPhoneAlt className="opacity-80" />
                    {hdr.phone}
                  </Pill>
                </span>

              </div>
            </div>
          </div>
        </SectionCard>

        {/* 2) Experience (no interactive pills here) */}
        <SectionCard title="Professional Experience">
          <div className="space-y-0">
            {RESUME_DATA.experience.map((x, idx) => (
              <div key={`${x.company}-${x.dates}`} className="pb-6">
                <div className="flex flex-col md:flex-row md:items-baseline md:justify-between gap-1">
                  <div className="text-left">
                    <div className="font-semibold text-gray-900 dark:text-gray-100">
                      {x.title} • {x.company}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-300">
                      {x.location}
                    </div>
                  </div>
                  <div className="text-left md:text-right text-xs text-gray-500 dark:text-gray-400">
                    {x.dates}
                  </div>
                </div>

                <div className="mt-3 flex justify-center">
                  <ul className={BULLET_LIST_CLASS}>
                    {x.bullets.map((b, i) => (
                      <li key={i} className={BULLET_ITEM_CLASS}>
                        {b}
                      </li>
                    ))}
                  </ul>
                </div>

                {idx !== RESUME_DATA.experience.length - 1 && (
                  <div className={DIVIDER_CLASS} />
                )}
              </div>
            ))}
          </div>
        </SectionCard>

        {/* 3) Education */}
        <SectionCard title="Education">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {RESUME_DATA.education.map((e) => (
              <div key={`${e.school}-${e.date}`} className="px-1 py-1">
                <div className="text-left font-semibold text-gray-900 dark:text-gray-100">
                  {e.school}
                </div>
                <div className="text-left text-sm text-gray-600 dark:text-gray-300 mt-1">
                  {e.degree} • {e.program}
                </div>
                <div className="text-left text-xs text-gray-500 dark:text-gray-400 mt-2">
                  {e.location} • {e.date}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* 4) Projects (pills must be static) */}
        <SectionCard title="Relevant Projects">
          <div className="space-y-0">
            {RESUME_DATA.projects.map((p, idx) => {
              const codeLabFrom = getCodeLabFrom(p.name);

              return (
                <div key={`${p.name}-${p.dates}`} className="pb-6">
                  <div className="flex flex-col md:flex-row md:items-baseline md:justify-between gap-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-left font-semibold text-gray-900 dark:text-gray-100">
                        {p.name}
                      </span>

                      {codeLabFrom && (
                        <a href={`#/code-lab?from=${codeLabFrom}`} className={CODE_SNIPPETS_CLASS}>
                          Code Snippets
                        </a>
                      )}
                    </div>

                    <div className="text-left md:text-right text-xs text-gray-500 dark:text-gray-400">
                      {p.dates}
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {p.stack.map((s) => (
                      <Pill key={s} variant="grayStatic" className={RESUME_PILL_CLASS}>
                        {s}
                      </Pill>
                    ))}
                  </div>

                  <div className="mt-3 flex justify-center">
                    <ul className={BULLET_LIST_CLASS}>
                      {p.bullets.map((b, i) => (
                        <li key={i} className={BULLET_ITEM_CLASS}>
                          {b}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {idx !== RESUME_DATA.projects.length - 1 && (
                    <div className={DIVIDER_CLASS} />
                  )}
                </div>
              );
            })}
          </div>
        </SectionCard>

        {/* 5) Technical Skills (pills must be static) */}
        <SectionCard title="Technical Skills">
          <div className="flex justify-center">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-[97%]">
              {Object.entries(RESUME_DATA.skills).map(([group, items]) => (
                <div key={group} className="px-4 py-2">
                  <div className="text-left font-semibold text-gray-900 dark:text-gray-100">
                    {group}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {items.map((s) => (
                      <Pill key={s} variant="grayStatic" className={RESUME_PILL_CLASS}>
                        {s}
                      </Pill>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </SectionCard>
      </div>

      {/* PDF Preview Modal */}
      {isPdfPreviewOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center px-4"
            role="dialog"
            aria-modal="true"
            aria-label="Resume PDF preview"
          >
            <div
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setIsPdfPreviewOpen(false)}
            />

            <div
              ref={modalPanelRef}
              className="relative w-full max-w-5xl rounded-2xl border border-gray-200/70 dark:border-white/10 bg-white dark:bg-[#181826] shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-gray-200/70 dark:border-white/10">
                <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Resume PDF Preview
                </div>

                <button
                  onClick={() => setIsPdfPreviewOpen(false)}
                  className="inline-flex items-center text-xs px-3 py-2 rounded-lg
                              border border-red-500/70 dark:border-red-600/70
                              text-gray-50
                              bg-gradient-to-br from-red-800/90 via-red-700/90 to-red-600/90
                              dark:from-red-600/80 dark:via-red-600/60 dark:to-red-600/50
                              backdrop-blur-md shadow-sm
                              hover:from-red-900/90 hover:via-red-800/90 hover:to-red-700/90
                              dark:hover:from-red-500/80 dark:hover:via-red-500/60 dark:hover:to-red-500/50
                              transition-all font-medium"
                  type="button"
                >
                  Close
                </button>
              </div>

              <div className="h-[78vh] bg-gray-50 dark:bg-[#141422]">
                <iframe
                  src={pdfSrc}
                  title="Tejas Raut Resume PDF Preview"
                  className="w-full h-full"
                />
              </div>
            </div>
          </div>,
          document.body
        )}
    </section>
  );
}
