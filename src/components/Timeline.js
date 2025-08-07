import React, { useRef, useState, useEffect } from "react";
import boyImage from "../assets/time-travel-boy.svg";
import { FaMapMarkedAlt } from "react-icons/fa";
import { MdArrowBackIosNew, MdArrowForwardIos } from "react-icons/md";
import { AnimatePresence } from "framer-motion";
import { motion } from "framer-motion";

const timelineData = [
  {
    year: "2025",
    role: "Data Engineer",
    company: "Amazon",
    description: "Optimized cloud pipelines and built real-time data systems on AWS."
  },
  {
    year: "2024",
    role: "Graduate Teaching Assistant",
    company: "Northeastern University",
    description: "Assisted in Data Engineering and Big Data Systems coursework."
  },
  {
    year: "2023",
    role: "Product Data Analyst",
    company: "Startup XYZ",
    description: "Built dashboards and data pipelines for product analytics."
  },
  {
    year: "2022",
    role: "MS in CS",
    company: "Northeastern University",
    description: "Specialized in Big Data, Cloud Systems, and Software Engineering."
  }
];

export default function Timeline() {
  const containerRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [scrollProgress, setScrollProgress] = useState(0);
  const cardWidth = 360 + 24; // Card + gap

  const introDistance = 0 - activeIndex; // Distance of intro from active card
  const introAbsDistance = Math.abs(introDistance);

  // You can make it start fading before index 1, e.g., start fading at absDistance > 0.3
  const introOpacity = introAbsDistance < 1 ? 1 - introAbsDistance : 0;

  // Snap to center card
  const scrollToIndex = (index) => {
    const container = containerRef.current;
    const scrollX = index * cardWidth - container.offsetWidth / 2 + cardWidth / 2;
    container.scrollTo({ left: scrollX, behavior: "smooth" });
  };

  const scrollLeft = () => {
    if (activeIndex > 0) scrollToIndex(activeIndex - 1);
  };

  const scrollRight = () => {
    if (activeIndex < timelineData.length - 1) scrollToIndex(activeIndex + 1);
  };

  // Scroll tracking
  useEffect(() => {
    const container = containerRef.current;

    const handleScroll = () => {
      const scrollLeft = container.scrollLeft;
      const center = scrollLeft + container.offsetWidth / 2;

      let closestIndex = 0;
      let closestDistance = Infinity;

      // const cards = container.querySelectorAll(".timeline-card");
      const cards = Array.from(container.children).filter(child =>
        child.classList.contains("timeline-card")
      );
      cards.forEach((card, i) => {
        const cardCenter = card.offsetLeft + card.offsetWidth / 2;
        const distance = Math.abs(center - cardCenter);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestIndex = i;
        }
      });

      setActiveIndex(closestIndex);

      // Update scroll progress (discrete based on active index)
      const maxScroll = timelineData.length;
      const progress = ((closestIndex + 1) / maxScroll) * 100;
      setScrollProgress(progress);
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
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
          className="flex gap-6 overflow-x-auto scroll-smooth snap-x snap-mandatory py-6 no-scrollbar pl-[50%] pr-[50%] md:pl-[calc(50%-180px)] md:pr-[calc(50%-180px)]"
        >
          <motion.div
            className="shrink-0 snap-start w-[360px] h-64 flex items-center justify-start pl-6 select-none"
            initial={{ opacity: 0, x: -40 }}
            animate={{
              opacity: introOpacity,
              x: introAbsDistance < 1 ? 0 : -40,
            }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            style={{ pointerEvents: "none" }}
          >
            <div className="flex flex-col items-center gap-8 -translate-x-10">
              <img
                src={boyImage}
                alt="Time travel begins"
                className="w-40 h-auto drop-shadow-[0_5px_15px_rgba(139,92,246,0.45)]"
              />
              <p className="text-xl font-semibold font-epilogue text-gray-600 dark:text-gray-400 drop-shadow-sm whitespace-nowrap">
                <blockquote className="text-xl italic">
                 "Time Travel Begins"
                </blockquote>
              </p>
            </div>
          </motion.div>

          <AnimatePresence initial={false} mode="popLayout">
            {timelineData.map((entry, i) => {
              const distance = i - activeIndex;
              const absDistance = Math.abs(distance);

              const isActive = i === activeIndex;
              const scale = isActive ? 1.1 : Math.max(0.75, 1 - absDistance * 0.15);
              const translateX = distance * (cardWidth * 0.88);

              return (
                <motion.div
                  key={i}
                  className="timeline-card snap-center shrink-0 w-[360px] h-64 px-6 py-6 rounded-3xl 
                    border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg relative
                    transition-transform duration-500 ease-out"
                  initial={{ opacity: 0, y: 40, scale: 0.8 }}
                  animate={{
                    zIndex: isActive ? 50 : timelineData.length - absDistance,
                    opacity: absDistance > 1 ? 0 : isActive ? 1 : 0.5,
                    y: absDistance * 10,
                    scale: absDistance > 1 ? 0.8 : scale,
                  }}
                  exit={{ opacity: 0, y: -40, scale: 0.7 }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  style={{
                    transform: `translateX(${translateX}px)`,
                    filter: isActive ? "none" : "blur(1px) grayscale(40%)",
                    pointerEvents: isActive ? "auto" : "none",
                  }}
                >
                  <h3 className="text-xl mt-2 mb-4 font-bold text-purple-700 dark:text-purple-300 font-epilogue">
                    {entry.role}
                  </h3>
                  <p className="text-sm text-gray-700 dark:text-gray-300">{entry.company}</p>
                  <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">{entry.description}</p>
                  <span className="absolute bottom-4 right-6 text-xs text-gray-400">{entry.year}</span>
                </motion.div>
              );
            })}
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
