import { useEffect, useState } from 'react';
import { FaCode, FaCloud, FaDatabase, FaChartLine, FaBrain } from 'react-icons/fa';

const rotatingItems = [
  { icon: <FaCode className="inline-block mr-2 text-purple-800 dark:text-purple-400" />, text: 'Full-Stack • Python, TypeScript, SQL, React, JavaScript, Node.js' },
  { icon: <FaCloud className="inline-block mr-2 text-blue-300 dark:text-blue-400" />, text: 'Cloud • AWS, Azure' },
  { icon: <FaDatabase className="inline-block mr-2 text-green-300 dark:text-green-400" />, text: 'Big Data • SQL, Python, Airflow, dbt, Spark, Hadoop' },
  { icon: <FaChartLine className="inline-block mr-2 text-yellow-300 dark:text-yellow-600" />, text: 'Business Intelligence • Tableau, Power BI, MATLAB, Minitab' },
  { icon: <FaBrain className="inline-block mr-2 text-pink-300 dark:text-pink-400" />, text: 'Artificial Intelligence • Python, TensorFlow, PyTorch, OpenCV, Scikit-learn' },
];

export default function RotatingTitle() {
  const [index, setIndex] = useState(0);
  const [displayText, setDisplayText] = useState('');
  const [charIndex, setCharIndex] = useState(0);

  useEffect(() => {
    const currentText = rotatingItems[index].text;

    if (charIndex < currentText.length) {
      const timeout = setTimeout(() => {
        setDisplayText((prev) => prev + currentText[charIndex]);
        setCharIndex((prev) => prev + 1);
      }, 30);
      return () => clearTimeout(timeout);
    } else {
      // Wait before going to next item
      const delay = setTimeout(() => {
        setIndex((prev) => (prev + 1) % rotatingItems.length);
        setDisplayText('');
        setCharIndex(0);
      }, 2500); // Hold final text for 2.5s
      return () => clearTimeout(delay);
    }
  }, [charIndex, index]);

  return (
    <p className="mt-4 text-lg text-purple-200 dark:text-gray-400 font-jakarta transition-all duration-500 ease-in-out">
      {rotatingItems[index].icon}
      <span className="ml-1">{displayText}</span>
      <span className="animate-pulse ml-0.5">_</span>
    </p>
  );
}



// import { useEffect, useState } from 'react';
// import { FaCode, FaCloud, FaDatabase, FaChartLine } from 'react-icons/fa';

// const rotatingItems = [
//   { icon: <FaCode className="inline-block mr-2 text-purple-300 dark:text-purple-400" />, text: 'Full-Stack Developer' },
//   { icon: <FaCloud className="inline-block mr-2 text-blue-300 dark:text-blue-400" />, text: 'Cloud Platforms: AWS, Azure' },
//   { icon: <FaDatabase className="inline-block mr-2 text-green-300 dark:text-green-400" />, text: 'Data Engineering: SQL, Airflow, dbt' },
//   { icon: <FaChartLine className="inline-block mr-2 text-yellow-300 dark:text-yellow-400" />, text: 'BI: Tableau, Power BI, MATLAB' },
// ];

// export default function RotatingTitle() {
//   const [index, setIndex] = useState(0);

//   useEffect(() => {
//     const interval = setInterval(() => {
//       setIndex((prev) => (prev + 1) % rotatingItems.length);
//     }, 3500); // Rotate every 3.5 seconds
//     return () => clearInterval(interval);
//   }, []);

//   return (
//     <p className="mt-4 text-lg text-purple-200 dark:text-gray-400 font-jakarta transition-all duration-500 ease-in-out">
//       {rotatingItems[index].icon}
//       {rotatingItems[index].text}
//     </p>
//   );
// }
