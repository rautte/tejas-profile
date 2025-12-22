// components/Experience.js

import React from "react";
import { FaBriefcase } from "react-icons/fa";
// import { FiChevronDown, FiChevronUp } from "react-icons/fi";

const experiencePrimary = [
  {
    company: "CloudBig Technology",
    role: "Software Engineer",
    employmentType: "Full-time",
    duration: "Jun 2024 – Present",
    location: "Remote · San Francisco, CA",
    highlights: [
      "Owned event-driven notification processing on AWS (SNS/SQS → Lambda), implementing failure recovery, idempotency guards, and automated resubmission to reduce operational toil.",
      "Built and scaled an OpenSearch ingestion pipeline using AWS CDK, reliably processing 90M+ records/month by optimizing bulk indexing, update semantics, and document versioning patterns.",
      "Improved reliability to 99.9% successful processing by engineering DLQ strategies, visibility-timeout tuning, and retry policies with clear runbooks and alarm thresholds.",
      "Implemented CDK integration tests and CI/CD with staged rollouts plus automated rollback mechanisms to reduce deployment risk and improve change velocity.",
    ],
    tags: [
      "AWS",
      "Event-Driven Systems",
      "AWS CDK",
      "Lambda",
      "SQS / SNS",
      "OpenSearch",
      "CI/CD",
      "Reliability Engineering",
    ],
  },
  {
    company: "Mystry Inc.",
    role: "Data Engineer",
    employmentType: "Full-time",
    duration: "Oct 2023 – Jun 2024",
    location: "Remote · Bellevue, WA",
    highlights: [
      "Led migration from on-prem to Azure, redesigning storage and query patterns to improve performance by 35% and reduce platform cost by 25%.",
      "Built automated Azure ETL pipelines processing 2TB+ daily, improving deployment throughput by 40% and reducing downtime by 30% through stronger CI/CD and operational safeguards.",
      "Designed analytics-ready data marts and segmentation models in Python, improving customer targeting and increasing marketing engagement by 15%.",
    ],
    tags: [
      "Azure",
      "ETL Pipelines",
      "Data Warehousing",
      "Data Modeling",
      "Python",
      "CI/CD",
      "Inventory Optimization",
    ],
  },
  {
    company: "Highbar Technologies Ltd.",
    role: "Business Intelligence Engineer – Investment Risk Analysis",
    employmentType: "Full-time",
    duration: "May 2020 – Jun 2021",
    location: "Mumbai, India · On-site",
    highlights: [
      "Delivered an 11% revenue uplift by building KPI-driven Tableau dashboards and optimizing SAP HANA queries for faster, decision-grade reporting across finance and operations.",
      "Improved risk planning accuracy by 20% by building Python/Excel variance and stress-testing tools for credit and operational risk models.",
      "Automated reporting workflows using Azure Data Factory, reducing refresh latency and improving reliability of scheduled reporting runs.",
    ],
    tags: [
      "Business Intelligence",
      "Tableau",
      "Risk Analytics",
      "SQL",
      "SAP HANA",
      "Azure Data Factory",
      "Automation",
    ],
  },
];

// const experienceEarly = [
//   {
//     company: "Pravega Racing (Formula Student)",
//     role: "Data Analyst – Vehicle Dynamics Design Optimization",
//     employmentType: "Team / Project",
//     duration: "Sep 2018 – Aug 2019",
//     location: "Vellore, India · On-site",
//     highlights: [
//       "Led a cross-functional team of 4 across chassis, wheel assembly, and aero packages; owned analysis workflow and delivery timelines under competition constraints.",
//       "Built Python and MATLAB simulations for kinematics and vehicle dynamics to guide design tradeoffs and validate geometry changes before fabrication.",
//       "Analyzed 100k+ data points across tires and suspension; computed Lateral Load Transfer Distribution and Center of Pressure to improve handling and stability.",
//     ],
//     tags: [
//       "Systems Modeling",
//       "Optimization",
//       "Python",
//       "MATLAB",
//       "Simulation",
//       "Data Analysis",
//       "Cross-Functional Leadership",
//     ],
//   },
//   {
//     company: "Filtrum Autocomp Private Limited",
//     role: "Supply Chain Analyst Intern",
//     employmentType: "Internship",
//     duration: "Aug 2019 – Nov 2019",
//     location: "Pune, India · On-site",
//     highlights: [
//       "Applied a replenishment model to manage demand variability and improve warehouse capacity utilization by 15% through data-backed inventory tuning.",
//       "Performed value stream mapping to reduce lead time by 5% and improve parts availability by aligning procurement cadence with demand patterns.",
//     ],
//     tags: [
//       "Operations",
//       "Optimization",
//       "Analytics",
//       "Supply Chain",
//       "Process Improvement",
//       "Excel",
//     ],
//   },
// ];

function Tag({ children }) {
  return (
    <span
      className="text-xs font-medium px-3 py-1 rounded-full
                 bg-purple-100 text-purple-800
                 dark:bg-purple-800 dark:text-white
                 hover:bg-purple-200 dark:hover:bg-purple-700
                 transition-colors"
    >
      {children}
    </span>
  );
}

function ExperienceCard({ exp }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl p-6 shadow-md border border-gray-200 dark:border-gray-700 text-left">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold font-epilogue text-gray-900 dark:text-white">
            {exp.company}
          </h3>

          <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
            {exp.role}
            {exp.employmentType ? (
              <span className="text-gray-500 dark:text-gray-400">
                {" "}
                • {exp.employmentType}
              </span>
            ) : null}
          </p>

          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {exp.duration}
            {exp.location ? ` • ${exp.location}` : ""}
          </p>
        </div>
      </div>

      {/* Highlights */}
      {exp.highlights?.length > 0 && (
        <ul className="mt-4 text-sm text-gray-700 dark:text-gray-300 list-disc list-outside pl-6 space-y-2">
          {exp.highlights.map((h) => (
            <li key={h} className="leading-relaxed">
              {h}
            </li>
          ))}
        </ul>
      )}

      {/* Tags */}
      {exp.tags?.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-4">
          {exp.tags.map((t) => (
            <Tag key={t}>{t}</Tag>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Experience() {
  // const [showEarly, setShowEarly] = React.useState(false);

  return (
    <section className="w-full py-0 px-4 bg-transparent">
      {/* Header scaffold aligned with Projects/Education */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 px-6 mb-10">
        <div className="w-full">
          <h2 className="text-3xl font-bold text-purple-700 dark:text-purple-300 font-epilogue drop-shadow-md flex items-center gap-3">
            <FaBriefcase className="text-3xl text-purple-700 dark:text-purple-300" />
            Experience
          </h2>
          <div>{/* underline placeholder to match Projects */}</div>
        </div>

        <div className="hidden sm:block" />
      </div>

      {/* Primary roles */}
      {/* <div className="grid md:grid-cols-2 gap-x-16 gap-y-10 px-6 max-w-6xl mx-auto"> */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-x-16 gap-y-10 px-6 max-w-6xl mx-auto">
        {experiencePrimary.map((exp) => (
          <ExperienceCard key={`${exp.company}-${exp.role}`} exp={exp} />
        ))}
      </div>

      {/* Collapsible Early Experience */}
      {/* <div className="px-6 max-w-6xl mx-auto mt-10">
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-md">
          <button
            type="button"
            onClick={() => setShowEarly((v) => !v)}
            className="w-full flex items-center justify-between px-5 py-4 text-left"
            aria-expanded={showEarly}
          >
            <div>
              <div className="text-sm font-semibold text-gray-900 dark:text-white">
                Early Engineering Experience
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Formula Student + operations internship
              </div>
            </div>

            <div className="text-purple-700 dark:text-purple-300">
              {showEarly ? <FiChevronUp size={18} /> : <FiChevronDown size={18} />}
            </div>
          </button>

          {showEarly && (
            <div className="px-5 pb-5">
              <div className="grid md:grid-cols-2 gap-x-16 gap-y-10">
                {experienceEarly.map((exp) => (
                  <ExperienceCard key={`${exp.company}-${exp.role}`} exp={exp} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div> */}
    </section>
  );
}
