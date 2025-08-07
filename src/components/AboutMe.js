// components/AboutMe.js
import React from "react";
import { FaUser } from 'react-icons/fa';
import profilePic from "../assets/LI_Profile.jpg"; // Replace with your image path

export default function AboutMe() {
  const [expanded, setExpanded] = React.useState(null);

  const toggle = (idx) => {
    setExpanded(prev => prev === idx ? null : idx);
  };

  const qaList = [
    {
      question: "What programming languages are you most comfortable with?",
      answer: "I'm most confident in JavaScript (React), Python, and SQL. I also enjoy using Go and Bash for scripting."
    },
    {
      question: "What kind of projects excite you the most?",
      answer: "I love working on full-stack applications that mix frontend polish with backend complexity—especially data-driven ones."
    },
    {
      question: "Are you more of a frontend or backend developer?",
      answer: "Both! I’m a full-stack developer, but I enjoy backend architecture and frontend design equally."
    },
    {
      question: "What's your proudest technical achievement?",
      answer: "Building a real-time data pipeline with alerting, automation, and dashboards end-to-end on AWS."
    },
    {
      question: "How do you stay updated with tech trends?",
      answer: "I follow blogs, newsletters like TLDR/Tech, attend meetups, and occasionally browse Hacker News."
    },
    {
      question: "What’s your approach to debugging tough issues?",
      answer: "Break the problem down, isolate components, reproduce the bug, and use logs/test cases to trace root causes."
    },
    {
      question: "Favorite UI libraries or frameworks?",
      answer: "Tailwind CSS is my favorite for styling, along with Framer Motion and shadcn/ui for animations and components."
    },
    {
      question: "What motivates you to code every day?",
      answer: "The joy of building and solving real-world problems while learning new concepts keeps me going."
    },
    {
      question: "Are you open to collaborations or freelance work?",
      answer: "Yes! If it’s an interesting project that aligns with my skills and values, I’d love to contribute."
    },
    {
      question: "What's one non-tech thing you're passionate about?",
      answer: "I love experimenting with matcha drinks, photography, and discovering visually stunning indie games."
    }
  ];

  return (
    <section className="py-8 px-4 bg-gray-50 dark:bg-[#181826] transition-colors">
      {/* Header with Title and Filter Button */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 px-6 mb-10">
        {/* Title and divider */}
        <div>
          <h2 className="text-3xl font-bold text-purple-700 dark:text-purple-300 font-epilogue drop-shadow-md flex items-center gap-3">
            <FaUser className="text-3xl text-purple-700 dark:text-purple-300" />
            About Me
          </h2>
          <div
            // className="w-64 h-0.5 mt-2 rounded-full bg-gradient-to-r from-purple-700 via-purple-900 to-purple-600 dark:from-purple-500 dark:via-purple-600 dark:to-purple-400 backdrop-blur-sm opacity-90 shadow-[0_0_2px_1px_rgba(147,51,234,0.6)]"
          ></div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-700 shadow-2xl px-8 py-12 mx-auto max-w-5xl">
        {/* Picture + Quote */}
        <div className="flex flex-col md:flex-row items-center justify-center gap-20 mb-12">
          {/* Image */}
          <div className="w-48 h-48 rounded-full overflow-hidden border-4 border-purple-400 dark:border-purple-300 shadow-lg">
            <img
              src={profilePic}
              alt="Tejas Raut"
              className="w-60 h-60 rounded-full object-cover [object-position:70%_80%]"
            />
          </div>

          {/* Quote */}
          <blockquote className="text-xl italic text-gray-700 dark:text-gray-300 text-center md:text-left max-w-xl">
            “Lately, I’ve realized I build systems that make sense to humans - and sometimes even to machines.”
          </blockquote>
        </div>

        {/* Content */}
        <div className="text-gray-800 dark:text-gray-300 space-y-6 leading-relaxed text-md font-epilogue px-4 md:px-10">
          <p>
            I'm a curious and creative full-stack developer with a passion for crafting meaningful software experiences. Whether it's building cloud pipelines or designing sleek frontends, I enjoy blending logic with aesthetics.
          </p>
          <p>
            With a background in data engineering and cloud platforms, I love solving real-world problems and simplifying complexity. I believe the best tech solutions are both robust and beautiful.
          </p>
          <p>
            When I'm not developing, you’ll find me exploring new design trends, brewing the perfect matcha, or diving into story-driven video games.
          </p>
        </div>
      </div>

      {/* Know More Section */}
      <div className="mt-20 px-4 md:px-10 max-w-5xl mx-auto">
        <h3 className="text-2xl font-bold text-purple-700 dark:text-purple-300 mb-6 font-epilogue">
          💡 Know More
        </h3>

        {qaList.map((item, idx) => (
          <div key={idx} className="dark:bg-[#2a2a40] p-1.5 mb-2 rounded-2xl shadow-xl border border-white/10 dark:border-white/20 transition-transform transform-gpu hover:scale-[1.01] duration-200">
            <button
              className="w-full flex justify-between items-center text-left px-6 py-4 bg-gray-100 dark:bg-white/10 text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-white/20 transition-all"
              onClick={() => toggle(idx)}
            >
              <span className="font-semibold">{item.question}</span>
              <span className="text-xl">{expanded === idx ? "−" : "+"}</span>
            </button>
            {expanded === idx && (
              <div className="px-6 py-4 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
                {item.answer}
              </div>
            )}
          </div>
        ))}
      </div>

    </section>
  );
}

