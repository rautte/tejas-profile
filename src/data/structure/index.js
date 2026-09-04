// src/data/structure/index.js
// Single source of truth for the site's default section structure:
// public section order, the sidebar "Quick Look" category groupings,
// and the default landing section. Owner-editable via
// content.structure (Admin -> Data -> Structure); this is the
// fallback used whenever a Profile Variant has no structure of its
// own -- including the very first render, before any network call
// resolves.

export const DEFAULT_SECTION =
  "About Me";

export const PUBLIC_SECTION_ORDER =
  [
    "About Me",
    "Experience",
    "Skills",
    "Education",
    "Resume",
    "Projects",
    "Code Lab",
    "Fun Zone",
    "Timeline",
  ];

export const SITE_STRUCTURE_GROUP_IDS =
  [
    "pinned",
    "recruiter",
    "hiringManager",
    "explore",
  ];

export const SIDEBAR_GROUPS =
  {
    pinned: [
      "About Me",
    ],

    recruiter: [
      "Experience",
      "Skills",
      "Education",
      "Resume",
    ],

    hiringManager: [
      "Projects",
      "Code Lab",
      "Fun Zone",
    ],

    explore: [
      "Timeline",
    ],
  };


export function defaultSiteStructure() {
  return {
    defaultSection:
      DEFAULT_SECTION,

    order: [
      ...PUBLIC_SECTION_ORDER,
    ],

    groups: {
      pinned: [
        ...SIDEBAR_GROUPS.pinned,
      ],

      recruiter: [
        ...SIDEBAR_GROUPS.recruiter,
      ],

      hiringManager: [
        ...SIDEBAR_GROUPS.hiringManager,
      ],

      explore: [
        ...SIDEBAR_GROUPS.explore,
      ],
    },
  };
}


function isPlainObject(
  value
) {
  return Boolean(
    value &&
    typeof value ===
      "object" &&
    !Array.isArray(
      value
    )
  );
}


/**
 * Resolves a (possibly absent/partial/malformed) content.structure
 * value into a fully valid, fully defaulted site structure.
 *
 * The section vocabulary is fixed (PUBLIC_SECTION_ORDER) -- this
 * never lets the owner rename or invent sections, only reorder,
 * hide, and recategorize the known 9. Anything unrecognized is
 * dropped; anything missing falls back to the platform default.
 * The same resolution runs in the admin editor and at public
 * render time, so what you see while editing is what ships.
 */
export function resolveSiteStructure(
  rawStructure
) {
  const source =
    isPlainObject(
      rawStructure
    )
      ? rawStructure
      : {};

  const seen =
    new Set();

  const order =
    (
      Array.isArray(
        source.order
      )
        ? source.order
        : []
    ).filter(
      (
        label
      ) => {
        if (
          typeof label !==
            "string" ||
          !PUBLIC_SECTION_ORDER.includes(
            label
          ) ||
          seen.has(
            label
          )
        ) {
          return false;
        }

        seen.add(
          label
        );

        return true;
      }
    );

  const effectiveOrder =
    order.length >
    0
      ? order
      : [
          ...PUBLIC_SECTION_ORDER,
        ];

  const orderedSet =
    new Set(
      effectiveOrder
    );

  const rawGroups =
    isPlainObject(
      source.groups
    )
      ? source.groups
      : SIDEBAR_GROUPS;

  const assigned =
    new Set();

  const groups = {};

  for (
    const groupId of
      SITE_STRUCTURE_GROUP_IDS
  ) {
    const list =
      Array.isArray(
        rawGroups[
          groupId
        ]
      )
        ? rawGroups[
            groupId
          ]
        : [];

    groups[
      groupId
    ] =
      list.filter(
        (
          label
        ) => {
          if (
            typeof label !==
              "string" ||
            !orderedSet.has(
              label
            ) ||
            assigned.has(
              label
            )
          ) {
            return false;
          }

          assigned.add(
            label
          );

          return true;
        }
      );
  }

  // Any visible section the groups didn't place lands in "explore"
  // rather than silently disappearing from the sidebar.
  const unassigned =
    effectiveOrder.filter(
      (
        label
      ) =>
        !assigned.has(
          label
        )
    );

  if (
    unassigned.length >
    0
  ) {
    groups.explore =
      [
        ...(
          groups.explore ||
          []
        ),
        ...unassigned,
      ];
  }

  // A group's array only decides MEMBERSHIP above -- its display
  // order must come from the single `order` list, not from
  // whatever position the stored group array happened to have.
  // Otherwise moving a section up/down in the owner's flat list
  // (which only ever edits `order`) has no visible effect on a
  // grouped navigation menu that reads its own array's order
  // instead, letting the two silently drift apart.
  for (
    const groupId of
      SITE_STRUCTURE_GROUP_IDS
  ) {
    groups[
      groupId
    ] =
      [
        ...(
          groups[
            groupId
          ] ||
          []
        ),
      ].sort(
        (
          a,
          b
        ) =>
          effectiveOrder.indexOf(
            a
          ) -
          effectiveOrder.indexOf(
            b
          )
      );
  }

  const defaultSection =
    typeof source.defaultSection ===
      "string" &&
    orderedSet.has(
      source.defaultSection
    )
      ? source.defaultSection
      : orderedSet.has(
          DEFAULT_SECTION
        )
        ? DEFAULT_SECTION
        : effectiveOrder[0];

  return {
    defaultSection,
    order:
      effectiveOrder,
    groups,
  };
}
