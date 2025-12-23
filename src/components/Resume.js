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

/**
 * Resume page notes:
 * - App scroll is on <main role="main"> (overflow-y-auto). Lock that when modal is open.
 * - PDF modal is portal'd to document.body to avoid inheriting any scroll offset / hero collapse.
 */

// -----------------------------
// Styling constants (single source of truth)
// -----------------------------
const CODE_SNIPPETS_CLASS =
  "text-xs text-purple-500 hover:text-purple-600 underline italic underline-offset-2";

const PILL_BASE_CLASS =
  "inline-flex items-center rounded-full bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white px-3 py-1 text-xs font-medium border border-indigo-100/80 dark:border-white/10";

const PILL_INTERACTIVE_CLASS =
  "group-hover:bg-purple-200 dark:group-hover:bg-purple-600 transition-colors duration-200";

const SECTION_CARD_CLASS =
  "rounded-2xl border border-gray-200/70 dark:border-white/10 bg-white/80 dark:bg-white/5 backdrop-blur-md shadow-sm";

const SECTION_HEADER_CLASS =
  "px-6 py-3 border-b rounded-t-2xl bg-gray-200/70 dark:bg-gray-700/70 border-gray-200/70 dark:border-white/10 flex items-center justify-between";

const BULLET_LIST_CLASS =
  "list-disc list-outside text-left text-sm text-gray-700 dark:text-gray-200 space-y-2 w-full max-w-[97%] pl-6";

const BULLET_ITEM_CLASS = "pl-2";

const DIVIDER_CLASS = "mt-6 h-px w-full bg-gray-200/80 dark:bg-white/10";

// -----------------------------
// CodeLab deep-link mapping (simple, scalable)
// -----------------------------
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
// Small UI primitives
// -----------------------------
function Pill({ children, interactive = false }) {
  return (
    <span
      className={[
        PILL_BASE_CLASS,
        interactive ? PILL_INTERACTIVE_CLASS : "",
      ].join(" ")}
    >
      {children}
    </span>
  );
}

function SectionCard({ title, action, children }) {
  return (
    <div className={SECTION_CARD_CLASS}>
      <div className={SECTION_HEADER_CLASS}>
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

  // Keep current position; on unlock we restore it exactly.
  scrollTopRef.current = host.scrollTop;

  const prev = {
    overflow: host.style.overflow,
    overscrollBehavior: host.style.overscrollBehavior,
    scrollBehavior: host.style.scrollBehavior,
  };

  // Prevent background scrolling + scroll chaining.
  host.style.overflow = "hidden";
  host.style.overscrollBehavior = "none";

  // If anything else uses smooth scrolling, don’t let it fight the lock.
  host.style.scrollBehavior = "auto";

  // Block wheel/touch scroll outside the modal panel.
  const blockScroll = (e) => {
    const panel = modalPanelRef.current;
    if (!panel) return;

    // Allow scroll + clicks inside modal panel.
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

    // Restore scroll position precisely.
    host.scrollTop = scrollTopRef.current;
  };
}

export default function Resume() {
  const pdfSrc = "./downloads/TejasRaut_Resume.pdf";

  const hdr = RESUME_DATA.header;

  // Normalize once; keeps rendering clean.
  const websiteUrl = useMemo(() => normalizeUrl(hdr.website), [hdr.website]);
  const linkedinUrl = useMemo(() => normalizeUrl(hdr.linkedin), [hdr.linkedin]);

  const [isPdfPreviewOpen, setIsPdfPreviewOpen] = useState(false);

  const modalPanelRef = useRef(null);
  const scrollTopRef = useRef(0);

  // Lock background scroll while modal is open (App scroll lives on <main role="main">).
  useEffect(() => {
    if (!isPdfPreviewOpen) return;
    const unlock = lockMainScroll(modalPanelRef, scrollTopRef);
    return unlock || undefined;
  }, [isPdfPreviewOpen]);

  // Close modal on Escape.
  useEffect(() => {
    if (!isPdfPreviewOpen) return;

    const onKeyDown = (e) => {
      if (e.key === "Escape") setIsPdfPreviewOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isPdfPreviewOpen]);

  return (
    <section className="py-0 px-4 bg-gray-50 dark:bg-[#181826] transition-colors">
      {/* Title (matches your global title style) */}
      <div className="text-left px-6 mb-10">
        <h2 className="text-3xl font-bold text-purple-700 dark:text-purple-300 font-epilogue drop-shadow-md flex items-center gap-3">
          <FaFileAlt className="text-3xl text-purple-700 dark:text-purple-300" />
          Resume
        </h2>
        {/* <div className="w-64 h-0.5 mt-2 rounded-full bg-gradient-to-r from-purple-700 via-purple-900 to-purple-600 dark:from-purple-500 dark:via-purple-600 dark:to-purple-400 backdrop-blur-sm opacity-90 shadow-[0_0_2px_1px_rgba(147,51,234,0.6)]" /> */}
      </div>

      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header card */}
        <SectionCard
          title="Quick Info"
          action={
            <div className="flex gap-2">
              <button
                onClick={() => setIsPdfPreviewOpen(true)}
                className="inline-flex items-center gap-2 text-xs px-3 py-2 bg-green-600 text-white rounded-lg shadow hover:bg-green-700 transition font-small"
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
                  <Pill interactive>
                    <FaMapMarkerAlt className="mr-2 opacity-80" /> {hdr.location}
                  </Pill>
                </span>

                <a href={mailto(hdr.email)} className="hover:opacity-90 transition">
                  <span className="group">
                    <Pill interactive>
                      <FaEnvelope className="mr-2 opacity-80" /> {hdr.email}
                    </Pill>
                  </span>
                </a>

                <span className="group">
                  <Pill interactive>
                    <FaPhoneAlt className="mr-2 opacity-80" /> {hdr.phone}
                  </Pill>
                </span>

                <a
                  href={websiteUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:opacity-90 transition"
                >
                  <span className="group">
                    <Pill interactive>
                      <FaLink className="mr-2 opacity-80" /> {hdr.website}
                    </Pill>
                  </span>
                </a>

                <a
                  href={linkedinUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:opacity-90 transition"
                >
                  <span className="group">
                    <Pill interactive>
                      <FaLink className="mr-2 opacity-80" /> {hdr.linkedin}
                    </Pill>
                  </span>
                </a>
              </div>
            </div>
          </div>
        </SectionCard>

        {/* Experience */}
        <SectionCard title="Professional Experience">
          <div className="space-y-0">
            {RESUME_DATA.experience.map((x, idx) => (
              <div key={`${x.company}-${x.dates}`} className="pb-6">
                <div className="flex flex-col md:flex-row md:items-baseline md:justify-between gap-1">
                  <div className="text-left">
                    <div className="font-semibold text-gray-900 dark:text-gray-100">
                      {x.company} • {x.title}
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

        {/* Education */}
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

        {/* Projects */}
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
                        <a
                          href={`#/code-lab?from=${codeLabFrom}`}
                          className={CODE_SNIPPETS_CLASS}
                        >
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
                      <Pill key={s}>{s}</Pill>
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

        {/* Skills */}
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
                      <Pill key={s}>{s}</Pill>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </SectionCard>
      </div>

      {/* PDF Preview Modal (portal to body so it always centers in viewport) */}
      {isPdfPreviewOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center px-4"
            role="dialog"
            aria-modal="true"
            aria-label="Resume PDF preview"
          >
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setIsPdfPreviewOpen(false)}
            />

            {/* Modal Panel */}
            <div
              ref={modalPanelRef}
              className="relative w-full max-w-5xl rounded-2xl border border-gray-200/70 dark:border-white/10 bg-white dark:bg-[#181826] shadow-2xl overflow-hidden"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-gray-200/70 dark:border-white/10">
                <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Resume PDF Preview
                </div>

                <div className="flex items-center gap-2">
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
                  >
                    Close
                  </button>
                </div>
              </div>

              {/* PDF Body */}
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
