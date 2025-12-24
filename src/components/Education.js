// components/Education.js

/**
 * TODO FIX:
 * Move any data to ../data/funZone/index.js
 * Clean the code prod-like with modular, reliable, and scalable structure
 */

import React from "react";
import { FaGraduationCap } from "react-icons/fa";
import { MdVerified } from "react-icons/md";
import { createPortal } from "react-dom";

// ✅ Logos (add these files under: src/assets/education/)
import neuLogo from "../assets/education/neu.jpg";
import utAustinLogo from "../assets/education/utaustin.jpg";
import vitLogo from "../assets/education/vit.jpg";

// ✅ Optional award image
import specialAchiever from "../assets/education/student_special_achiever_2018-2019.jpg";

const educationData = [
  {
    school: "Northeastern University",
    logo: neuLogo,
    degree: "Master of Science (MS), Engineering Management",
    duration: "Sep 2021 – May 2023",
    location: "Boston, MA",
    coursework: [
      "Engineering Probability and Statistics",
      "Deterministic Operations Research",
      "Economic Decision Analysis",
      "Blockchain & DeFi",
      "Data Management for Analytics",
      "Data Mining Engineering Apps",
      "Project Management",
      "Managing Global Enterprises (D’Amore-McKim)",
      "Financial Engineering & Management (D’Amore-McKim)",
    ],
    highlights: [
      "Cross-disciplinary focus combining engineering systems with business and financial decision-making.",
      "Completed graduate-level business coursework through D’Amore-McKim School of Business.",
    ],
    // tags: [
    //   "Decision Science",
    //   "Operations Research",
    //   "Analytics Systems",
    //   "Data Modeling",
    //   "Optimization",
    //   "Techno-Business Strategy",
    // ],
  },
  {
    school: "The University of Texas at Austin",
    logo: utAustinLogo,
    degree: "Postgraduate Certificate (Online), Data Science & Business Analytics",
    duration: "Sep 2020 – Jul 2021",
    location: "Online",
    coursework: [
      "Python for Data Science",
      "Statistical Methods for Decision Making",
      "Data Mining",
      "Predictive Modeling",
      "Machine Learning",
      "Time Series Forecasting",
      "Optimization Techniques",
      "Marketing & Retail Analytics",
      "Finance and Risk Analytics",
    ],
    highlights: [
      "Applied, industry-oriented program focused on analytics, ML, and decision science.",
      "Built a strong foundation in translating business problems into data-driven models, with emphasis on practical forecasting, optimization, and decision-making.",
    ],
    // tags: [
    //   "Applied Data Science",
    //   "Predictive Modeling",
    //   "Time Series Analysis",
    //   "Decision Analytics",
    //   "Quantitative Modeling",
    // ],
  },
  {
    school: "Vellore Institute of Technology",
    logo: vitLogo,
    degree: "Bachelor of Technology (BTech), Mechanical Engineering",
    duration: "Jun 2016 – Apr 2020",
    location: "India",
    coursework: [
      "Differential & Difference Equations",
      "Applied Numerical Methods",
      "Operations Research & Optimization",
      "Computational Statistics & Probability",
      "Statistical Quality Control",
    ],
    highlights: [
      "Student Special Achiever (2018–2020) for two consecutive years.",
      "Formula Student team member (Pravega Racing); participated in multiple international Formula-SAE competitions.",
      // "Strong quantitative foundation spanning differential and difference equations, numerical methods, statistical quality control, operations research, and computational probability.",
    ],
    // tags: [
    //   "Quantitative Foundations",
    //   "Optimization Techniques",
    //   "Numerical Analysis",
    //   "Systems Thinking",
    // ],
    badge: "Student Special Achiever",
    badgeIcon: <MdVerified className="text-green-500" />,
    attachment: {
      title: "Student Special Achiever (2018–2019)",
      image: specialAchiever,
    },
    activities: ["Formula SAE", "Soccer", "Badminton"],
  },
];

function Chip({ children }) {
  return (
    <span className="text-xs font-medium px-3 py-1 rounded-full bg-purple-100 dark:bg-purple-800 text-purple-800 dark:text-white">
      {children}
    </span>
  );
}

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
        // Save current scrollTop
        scrollTopRef.current = scrollEl.scrollTop;

        // Save previous styles once
        prevOverflowRef.current = scrollEl.style.overflowY || "";
        prevPaddingRightRef.current = scrollEl.style.paddingRight || "";

        // Lock scrolling on the scroll container
        scrollEl.style.overflowY = "hidden";

        // Prevent layout shift when scrollbar disappears
        const scrollbarWidth = scrollEl.offsetWidth - scrollEl.clientWidth;
        if (scrollbarWidth > 0) {
          scrollEl.style.paddingRight = `${scrollbarWidth}px`;
        }
      } else {
        // Restore styles
        scrollEl.style.overflowY = prevOverflowRef.current;
        scrollEl.style.paddingRight = prevPaddingRightRef.current;

        // Restore scroll position precisely
        scrollEl.scrollTop = scrollTopRef.current;
      }

      // Cleanup safety (in case component unmounts while modal open)
      return () => {
        scrollEl.style.overflowY = prevOverflowRef.current;
        scrollEl.style.paddingRight = prevPaddingRightRef.current;
      };
    }, [openImage]);

  return (
    <section className="w-full py-0 px-4 transition-colors">
      {/* Header scaffold aligned with Project.js */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 px-6 mb-10">
        {/* Title block */}
        <div className="w-full">
          <h2 className="text-3xl font-bold text-purple-700 dark:text-purple-300 font-epilogue drop-shadow-md flex items-center gap-3">
            <FaGraduationCap className="text-3xl text-purple-700 dark:text-purple-300" />
            Education
          </h2>

          {/* Keep this placeholder to match Projects' structure */}
          <div>{/* underline placeholder */}</div>
        </div>

        {/* Right-side controls placeholder (intentionally empty to match layout rhythm) */}
        <div className="hidden sm:block" />
      </div>

      {/* Cards (gap aligned closer to Project.js) */}
      <div className="grid md:grid-cols-2 gap-x-16 gap-y-10 px-6 max-w-6xl mx-auto">
        {educationData.map((edu) => (
          <div
            key={`${edu.school}-${edu.degree}`}
            className="bg-white dark:bg-gray-900 rounded-xl p-5 shadow-md border border-gray-200 dark:border-gray-700 text-left"
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

                  {/* Optional badge */}
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
                    <Chip key={c}>{c}</Chip>
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

            {/* Skills/Tags */}
            {edu.tags?.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4">
                {edu.tags.map((t) => (
                  <span
                    key={t}
                    className="text-xs px-3 py-1 rounded-full bg-gray-200 dark:bg-gray-800 text-gray-800 dark:text-gray-200 hover:bg-purple-200 dark:hover:bg-purple-700 transition-colors"
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}

            {/* Optional attachment (award photo) -- TO HAVE A THUMBNAIL OF AWARD PHOTO -- */}
            {/* {edu.attachment?.image && (
              <div className="mt-5 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
                <div className="px-4 py-2 text-xs font-semibold bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 flex items-center justify-between">
                  <span>{edu.attachment.title}</span>
                  <button
                    type="button"
                    onClick={() => setOpenImage(edu.attachment)}
                    className="text-xs text-purple-700 dark:text-purple-300 hover:underline"
                  >
                    View
                  </button>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setOpenImage(edu.attachment);
                  }}
                  className="block w-full focus:outline-none"
                  aria-label={`Open ${edu.attachment.title}`}
                >
                  <img
                    src={edu.attachment.image}
                    alt={edu.attachment.title}
                    className="w-full h-24 object-cover object-[50%_42.5%] cursor-zoom-in"
                    loading="lazy"
                  />
                </button>
              </div>
            )} */}
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
