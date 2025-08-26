import React, { useRef, useState, useEffect } from "react";
import innovationBoy from "../assets/svg/timeline/time-travel-boy.svg";
import programmingBoy from "../assets/svg/timeline/Programming-boy.svg";
import { FaMapMarkedAlt } from "react-icons/fa";
import { MdArrowBackIosNew, MdArrowForwardIos } from "react-icons/md";
import { AnimatePresence } from "framer-motion";
import { motion } from "framer-motion";

const timelineData = [
  {
    duration: "10 months",
    role: "Software Data Engineer",
    company: "CloudBig Technology",
    description: "Built real-time notification error handling system on AWS for customers/vendors."
  },
  {
    duration: "9 months",
    role: "Data Engineer",
    company: "Mystry Inc.",
    description: "Data migration, orchestration, ETL, and OLAP."
  },
  {
    duration: "2023",
    role: "Product Data Analyst",
    company: "Startup XYZ",
    description: "Built dashboards and data pipelines for product analytics."
  },
  {
    duration: "2022",
    role: "MS in CS",
    company: "Northeastern University",
    description: "Specialized in Big Data, Cloud Systems, and Software Engineering."
  },
  {
    duration: "2022",
    role: "Business Intelligence Engineer",
    company: "Highbar Technology",
    description: "Specialized in Big Data, Cloud Systems, and Software Engineering."
  },
  {
    duration: "2022",
    role: "BTech in Mechanical Engineering",
    company: "Vellore Institute of Technology",
    description: "Specialized in Big Data, Cloud Systems, and Software Engineering."
  }
];

export default function Timeline() {
  const containerRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [scrollProgress] = useState(0); // const [scrollProgress, setScrollProgress] = useState(0);
  // const cardWidth = 360 + 24; // Card + gap

  const introDistance = 0 - activeIndex;
  const introAbsDistance = Math.abs(introDistance);
  const introOpacity = introAbsDistance < 1 ? 1 - introAbsDistance : 0;

  const outroDistance = activeIndex - (timelineData.length - 1);
  const outroAbsDistance = Math.abs(outroDistance);
  const outroOpacity = outroAbsDistance < 1 ? 1 - outroAbsDistance : 0;

  // const introDistance = 0 - activeIndex; // Distance of intro from active card
  // const introAbsDistance = Math.abs(introDistance);

  // // You can make it start fading before index 1, e.g., start fading at absDistance > 0.3
  // const introOpacity = introAbsDistance < 0.7 ? 1 - introAbsDistance : 0;

  // Snap to center card
  const scrollToIndex = (idx) => {
    const el = containerRef.current;
    if (!el) return;
    const items = Array.from(el.querySelectorAll(".timeline-card, [data-snap-intro], [data-snap-outro]"));
    const node = items[Math.max(0, Math.min(idx, items.length - 1))];
    node?.scrollIntoView({ inline: "center", behavior: "smooth", block: "nearest" });
  };

  const scrollLeft = () => {
    if (activeIndex > 0) scrollToIndex(activeIndex - 1);
  };

  const scrollRight = () => {
    if (activeIndex < timelineData.length - 1) scrollToIndex(activeIndex + 1);
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const { left: cL, width: cW } = el.getBoundingClientRect();
        const cCenter = cL + cW / 2;

        // children array: [intro, ...cards, outro]
        const kids = Array.from(el.querySelectorAll(".timeline-card, [data-snap-intro], [data-snap-outro]"));

        let best = 0;
        let bestDist = Infinity;
        kids.forEach((node, idx) => {
          const r = node.getBoundingClientRect();
          const center = r.left + r.width / 2;
          const d = Math.abs(center - cCenter);
          if (d < bestDist) {
            bestDist = d;
            best = idx;
          }
        });

        // Only set state if changed to avoid thrash
        setActiveIndex((prev) => (prev === best ? prev : best));
      });
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <section className="py-10 px-4 bg-gray-50 dark:bg-[#181826] transition-colors relative">

      {/* Section Title */}
      <div className="text-left px-6 mb-10">
        <h2 className="text-3xl font-bold text-purple-700 dark:text-purple-300 font-epilogue drop-shadow-md flex items-center gap-3">
          <FaMapMarkedAlt className="text-3xl" />
          Timeline
        </h2>
        {/* <div className="w-64 h-0.5 mt-2 rounded-full bg-gradient-to-r from-purple-700 via-purple-900 to-purple-600 dark:from-purple-500 dark:via-purple-600 dark:to-purple-400 shadow-[0_0_2px_1px_rgba(147,51,234,0.6)]" /> */}
      </div>

      {/* Main Timeline */}
      <div className="relative w-full mt-24 flex items-center justify-center">
        {/* ← Button */}
        <button
          onClick={scrollLeft}
          className="absolute left-2 z-10 p-2 bg-white dark:bg-gray-700 rounded-full shadow hover:bg-purple-100 dark:hover:bg-purple-800"
        >
          <MdArrowBackIosNew className="text-purple-700 dark:text-purple-300" />
        </button>

        {/* Cards Row */}
        <div
          ref={containerRef}
          className="flex gap-6 overflow-x-auto scroll-smooth snap-x snap-mandatory py-6 no-scrollbar
+            pl-[calc(50%-180px)] pr-[calc(50%-180px)]"
        >
          {/* Intro (Start Message) */}
          <AnimatePresence mode="wait">
            {activeIndex <= 1 && (
              <motion.div
                key="intro"
                className="shrink-0 w-[360px] h-64 flex items-center justify-start pl-24 select-none snap-start"
                initial={{ opacity: 0, x: -40 }}
                animate={{
                  opacity: introOpacity,
                  x: introAbsDistance < 1 ? 0 : -40,
                }}
                exit={{ opacity: 0, x: -40 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                style={{ pointerEvents: "none" }}
              >
                <div className="flex flex-col items-center gap-8 -translate-x-0">
                  <img
                    src={innovationBoy}
                    alt="Time travel begins"
                    className="w-45 h-auto drop-shadow-[0_5px_15px_rgba(139,92,246,0.45)]"
                  />
                  <p className="text-xl font-semibold font-epilogue text-gray-600 dark:text-gray-400 drop-shadow-sm whitespace-nowrap">
                    <blockquote className="text-xl italic">"Time Travel Begins"</blockquote>
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Cards for timeline (Details) */}
          <AnimatePresence initial={false} mode="popLayout">
            {timelineData.map((entry, i) => {
              const distance = i - activeIndex;
              const absDistance = Math.abs(distance);
              const isActive = i === activeIndex;
              const scale = isActive ? 1.1 : Math.max(0.75, 1 - absDistance * 0.15);

              return (
                <motion.div
                  key={i}
                  className="
                    timeline-card snap-center snap-always shrink-0 w-[360px] h-64 px-6 py-6 rounded-3xl
                    border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg relative
                    transition-transform duration-500 ease-out
                  "
                  initial={{ opacity: 0, y: 40, scale: 0.8 }}
                  animate={{
                    zIndex: isActive ? 50 : timelineData.length - absDistance,
                    opacity: isActive ? 1 : absDistance === 1 ? 0.6 : 0.35,
                    y: absDistance * 10,
                    scale: absDistance > 1 ? 0.8 : scale,
                    // no translateX here
                  }}
                  exit={{ opacity: 0, y: -40, scale: 0.7 }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  style={{
                    filter: isActive ? "none" : "blur(1px) grayscale(40%)",
                    pointerEvents: isActive ? "auto" : "none",
                  }}
                >
                  <h3 className="text-xl mt-2 mb-4 font-bold text-purple-700 dark:text-purple-300 font-epilogue">
                    {entry.role}
                  </h3>
                  <p className="text-sm text-gray-700 dark:text-gray-300">{entry.company}</p>
                  <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">{entry.description}</p>
                  <span className="absolute bottom-4 right-6 text-xs text-gray-400">{entry.duration}</span>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {/* Outro (End Message) */}
          <AnimatePresence mode="wait">
            {activeIndex >= timelineData.length - 2 && (
              <motion.div
                key="outro"
                className="shrink-0 w-[360px] h-64 flex items-center justify-start pl-6 select-none snap-end"
                initial={{ opacity: 0, x: 40 }}
                animate={{
                  opacity: outroOpacity,
                  x: outroAbsDistance < 1 ? 0 : 40,
                }}
                exit={{ opacity: 0, x: 60 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                style={{ pointerEvents: "none" }}
              >
                <div className="flex flex-col items-center gap-8 translate-x-10">
                  <img
                    src={programmingBoy}
                    alt="To be continued"
                    className="w-40 h-auto drop-shadow-[0_5px_15px_rgba(139,92,246,0.45)]"
                  />
                  <p className="text-xl font-semibold font-epilogue text-gray-600 dark:text-gray-400 drop-shadow-sm whitespace-nowrap">
                    <blockquote className="text-xl italic">"Time Travel Ends"</blockquote>
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

        </div>

        {/* → Button */}
        <button
          onClick={scrollRight}
          className="absolute right-2 z-10 p-2 bg-white dark:bg-gray-700 rounded-full shadow hover:bg-purple-100 dark:hover:bg-purple-800"
        >
          <MdArrowForwardIos className="text-purple-700 dark:text-purple-300" />
        </button>
      </div>

      {/* Scroll Progress Bar - moved to bottom */}
      <div className="w-full h-1 mt-44 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden shadow-inner">
        <div
          className="h-full bg-gradient-to-r from-purple-500 via-pink-500 to-indigo-500 dark:from-purple-400 dark:via-pink-400 dark:to-indigo-400 
                    transition-all duration-300 ease-in-out"
          style={{ width: `${scrollProgress}%` }}
        />
      </div>
    </section>
  );
}
