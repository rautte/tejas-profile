// src/components/shared/quickConnectPresentation.js

import {
  FaEnvelope,
  FaGithub,
  FaGlobe,
  FaLinkedin,
} from "react-icons/fa";


const PRESENTATION =
  Object.freeze({
    linkedin: {
      Icon:
        FaLinkedin,

      colorClass:
        "text-blue-400 hover:text-[#0A66C2]",
    },

    github: {
      Icon:
        FaGithub,

      colorClass:
        "text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white",
    },

    portfolio: {
      Icon:
        FaGlobe,

      colorClass:
        "text-green-500 hover:text-green-600",
    },

    email: {
      Icon:
        FaEnvelope,

      colorClass:
        "text-red-400 hover:text-red-500",
    },
  });


export function getQuickConnectPresentation(
  key
) {
  return (
    PRESENTATION[
      String(
        key || ""
      ).trim()
    ] || {
      Icon:
        FaGlobe,

      colorClass:
        "text-gray-600 dark:text-gray-400",
    }
  );
}