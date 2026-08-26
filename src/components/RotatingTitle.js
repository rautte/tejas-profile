// src/components/RotatingTitle.js

import { useEffect, useState } from "react";
import {
  FaBrain,
  FaChartLine,
  FaCloud,
  FaCode,
  FaDatabase,
} from "react-icons/fa";


const ROTATING_TITLE_PRESENTATION =
  Object.freeze({
    "full-stack": {
      Icon: FaCode,

      className:
        "inline-block mr-2 text-purple-800 dark:text-purple-400",
    },

    cloud: {
      Icon: FaCloud,

      className:
        "inline-block mr-2 text-blue-300 dark:text-blue-400",
    },

    "big-data": {
      Icon: FaDatabase,

      className:
        "inline-block mr-2 text-green-300 dark:text-green-400",
    },

    "business-intelligence": {
      Icon: FaChartLine,

      className:
        "inline-block mr-2 text-yellow-300 dark:text-yellow-600",
    },

    "artificial-intelligence": {
      Icon: FaBrain,

      className:
        "inline-block mr-2 text-pink-300 dark:text-pink-400",
    },
  });


function getRotatingTitlePresentation(
  id
) {
  return (
    ROTATING_TITLE_PRESENTATION[
      String(id || "").trim()
    ] || {
      Icon: FaCode,

      className:
        "inline-block mr-2 text-purple-800 dark:text-purple-400",
    }
  );
}


export default function RotatingTitle({
  hero = {},
}) {
  const items =
    Array.isArray(
      hero.rotatingTitles
    )
      ? hero.rotatingTitles
      : [];

  const [index, setIndex] =
    useState(0);

  const [
    displayText,
    setDisplayText,
  ] =
    useState("");

  const [
    charIndex,
    setCharIndex,
  ] =
    useState(0);

  const currentItem =
    items.length > 0
      ? items[
          index %
            items.length
        ]
      : null;

  const currentText =
    String(
      currentItem?.text || ""
    );


  useEffect(() => {
    if (!items.length) {
      return undefined;
    }

    if (
      charIndex <
      currentText.length
    ) {
      const timeout =
        setTimeout(() => {
          setDisplayText(
            (prev) =>
              prev +
              currentText[
                charIndex
              ]
          );

          setCharIndex(
            (prev) =>
              prev + 1
          );
        }, 30);

      return () =>
        clearTimeout(
          timeout
        );
    }

    const delay =
      setTimeout(() => {
        setIndex(
          (prev) =>
            (prev + 1) %
            items.length
        );

        setDisplayText("");
        setCharIndex(0);
      }, 2500);

    return () =>
      clearTimeout(
        delay
      );
  }, [
    charIndex,
    currentText,
    items.length,
  ]);


  if (!currentItem) {
    return null;
  }

  const {
    Icon,
    className:
      iconClassName,
  } =
    getRotatingTitlePresentation(
      currentItem.id
    );


  return (
    <p className="mt-4 text-lg text-purple-200 dark:text-gray-400 font-jakarta transition-all duration-500 ease-in-out">
      <Icon
        className={
          iconClassName
        }
      />

      <span className="ml-1">
        {displayText}
      </span>

      <span className="animate-pulse ml-0.5">
        _
      </span>
    </p>
  );
}