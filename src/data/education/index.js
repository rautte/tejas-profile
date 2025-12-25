// src/data/education/index.js
// keep this as "edit-only" stuff

import { MdVerified } from "react-icons/md";

// ✅ Logos (added these files under: src/assets/images/education/)
import neuLogo from "../../assets/images/education/neu.jpg";
import utAustinLogo from "../../assets/images/education/utaustin.jpg";
import vitLogo from "../../assets/images/education/vit.jpg";

// ✅ Optional award image
import specialAchiever from "../../assets/images/education/student_special_achiever_2018-2019.jpg";


export const EDUCATION = [
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
    ],
    badge: "Student Special Achiever",
    badgeIcon: <MdVerified className="text-green-500" />,
    attachment: {
      title: "Student Special Achiever (2018–2019)",
      image: specialAchiever,
    },
    activities: ["Formula SAE", "Soccer", "Badminton"],
  },
];