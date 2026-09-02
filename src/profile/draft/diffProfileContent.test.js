// src/profile/draft/diffProfileContent.test.js

import {
  diffProfileContentValues,
  formatDiffPath,
} from "./diffProfileContent";


test(
  "returns no changes for deeply equal objects",
  () => {
    const value = {
      hero: {
        name:
          "Tejas",

        tags: [
          "a",
          "b",
        ],
      },
    };

    expect(
      diffProfileContentValues(
        value,
        JSON.parse(
          JSON.stringify(
            value
          )
        )
      )
    ).toEqual(
      []
    );
  }
);


test(
  "detects a changed nested scalar",
  () => {
    const before = {
      hero: {
        name:
          "Tejas",
      },
    };

    const after = {
      hero: {
        name:
          "Tejas Raut",
      },
    };

    expect(
      diffProfileContentValues(
        before,
        after
      )
    ).toEqual(
      [
        {
          path: [
            "hero",
            "name",
          ],

          before:
            "Tejas",

          after:
            "Tejas Raut",
        },
      ]
    );
  }
);


test(
  "detects an added array item",
  () => {
    const before = {
      experience:
        [
          {
            company:
              "Acme",
          },
        ],
    };

    const after = {
      experience:
        [
          {
            company:
              "Acme",
          },

          {
            company:
              "Globex",
          },
        ],
    };

    const changes =
      diffProfileContentValues(
        before,
        after
      );

    expect(
      changes
    ).toEqual(
      [
        {
          path: [
            "experience",
            1,
          ],

          before:
            undefined,

          after: {
            company:
              "Globex",
          },
        },
      ]
    );
  }
);


test(
  "formats numeric and string path segments",
  () => {
    expect(
      formatDiffPath(
        [
          "experience",
          0,
          "highlights",
          1,
        ]
      )
    ).toBe(
      "experience[0].highlights[1]"
    );
  }
);
