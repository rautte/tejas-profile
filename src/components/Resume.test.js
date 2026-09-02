// src/components/Resume.test.js

import {
  render,
  screen,
} from "@testing-library/react";

import Resume from "./Resume";


function baseResume(
  overrides = {}
) {
  return {
    pdfAssetId:
      "resume.primary",

    header: {
      name:
        "Tejas Raut",
    },

    experience: [
      {
        company:
          "Acme Corp",

        title:
          "Engineer",

        location:
          "Remote",

        dates:
          "2023 - 2025",

        bullets:
          [],
      },
    ],

    education: [
      {
        school:
          "State University",

        location:
          "",

        date:
          "",

        degree:
          "",

        program:
          "",
      },
    ],

    skills: {},

    projects: [
      {
        name:
          "Portfolio",

        dates:
          "",

        stack:
          [],

        bullets:
          [],
      },
    ],

    ...overrides,
  };
}


function sectionCardOrder(
  container
) {
  return Array.from(
    container.querySelectorAll(
      "h3"
    )
  ).map(
    (
      el
    ) =>
      el.textContent
  );
}


test(
  "renders resume sections in the historical default order when sectionOrder is absent",
  () => {
    const {
      container,
    } =
      render(
        <Resume
          resume={baseResume()}
        />
      );

    expect(
      sectionCardOrder(
        container
      )
    ).toEqual(
      [
        "Quick Info",
        "Professional Experience",
        "Education",
        "Relevant Projects",
        "Technical Skills",
      ]
    );
  }
);


test(
  "renders resume sections in the owner-declared sectionOrder, with Quick Info always first",
  () => {
    const {
      container,
    } =
      render(
        <Resume
          resume={baseResume(
            {
              sectionOrder:
                [
                  "education",
                  "skills",
                  "experience",
                  "projects",
                ],
            }
          )}
        />
      );

    expect(
      sectionCardOrder(
        container
      )
    ).toEqual(
      [
        "Quick Info",
        "Education",
        "Technical Skills",
        "Professional Experience",
        "Relevant Projects",
      ]
    );
  }
);


test(
  "falls back to the default order for an incomplete or invalid sectionOrder",
  () => {
    const {
      container,
    } =
      render(
        <Resume
          resume={baseResume(
            {
              sectionOrder:
                [
                  "skills",
                  "not-a-real-section",
                ],
            }
          )}
        />
      );

    expect(
      sectionCardOrder(
        container
      )
    ).toEqual(
      [
        "Quick Info",
        "Technical Skills",
        "Professional Experience",
        "Education",
        "Relevant Projects",
      ]
    );
  }
);
