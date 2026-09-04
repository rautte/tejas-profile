// src/components/admin/adminQueryTools.test.js

import {
  applyKeyValueFilters,
  comparePrimitive,
  matchesFilter,
  normalizeText,
} from "./adminQueryTools";


test(
  "normalizeText lowercases and trims",
  () => {
    expect(
      normalizeText(
        "  Hello World  "
      )
    ).toBe(
      "hello world"
    );

    expect(
      normalizeText(
        null
      )
    ).toBe(
      ""
    );
  }
);


test(
  "matchesFilter supports contains/eq/startsWith/endsWith, case-insensitively",
  () => {
    expect(
      matchesFilter(
        "Backend Engineer",
        "contains",
        "eng"
      )
    ).toBe(
      true
    );

    expect(
      matchesFilter(
        "Backend Engineer",
        "eq",
        "backend engineer"
      )
    ).toBe(
      true
    );

    expect(
      matchesFilter(
        "Backend Engineer",
        "eq",
        "backend"
      )
    ).toBe(
      false
    );

    expect(
      matchesFilter(
        "Backend Engineer",
        "startsWith",
        "back"
      )
    ).toBe(
      true
    );

    expect(
      matchesFilter(
        "Backend Engineer",
        "endsWith",
        "neer"
      )
    ).toBe(
      true
    );

    expect(
      matchesFilter(
        "Backend Engineer",
        "contains",
        ""
      )
    ).toBe(
      true
    );
  }
);


test(
  "applyKeyValueFilters filters rows using each column's getValue, requiring every filter to match",
  () => {
    const cols = [
      {
        id:
          "name",

        getValue:
          (
            row
          ) =>
            row.name,
      },

      {
        id:
          "role",

        getValue:
          (
            row
          ) =>
            row.role,
      },
    ];

    const rows = [
      {
        name:
          "prv_a",

        role:
          "Backend Engineer",
      },

      {
        name:
          "prv_b",

        role:
          "Frontend Engineer",
      },
    ];

    const result =
      applyKeyValueFilters(
        rows,
        cols,
        [
          {
            col:
              "role",

            op:
              "contains",

            value:
              "backend",
          },
        ]
      );

    expect(
      result
    ).toEqual(
      [
        rows[0],
      ]
    );
  }
);


test(
  "applyKeyValueFilters returns rows unchanged when there are no filters",
  () => {
    const rows = [
      {
        id:
          1,
      },
    ];

    expect(
      applyKeyValueFilters(
        rows,
        [],
        []
      )
    ).toBe(
      rows
    );
  }
);


test(
  "comparePrimitive orders numbers and strings by direction",
  () => {
    expect(
      comparePrimitive(
        1,
        2,
        "asc"
      )
    ).toBeLessThan(
      0
    );

    expect(
      comparePrimitive(
        1,
        2,
        "desc"
      )
    ).toBeGreaterThan(
      0
    );

    expect(
      comparePrimitive(
        "a",
        "b",
        "asc"
      )
    ).toBeLessThan(
      0
    );

    expect(
      comparePrimitive(
        null,
        "b",
        "asc"
      )
    ).toBeLessThan(
      0
    );

    expect(
      comparePrimitive(
        "x",
        "x",
        "asc"
      )
    ).toBe(
      0
    );
  }
);
