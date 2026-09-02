// src/profile/editor/metadata.js

import {
  CURRENT_PROFILE_CONTENT_SCHEMA_VERSION,
  cloneJson,
} from "../../utils/profileVariant";

import {
  CURRENT_PROFILE_EDITOR_METADATA_VERSION,
  PROFILE_EDITOR_METADATA_DOCUMENT_SCHEMA,
} from "./constants";


function deepFreeze(
  value
) {
  if (
    !value ||
    typeof value !== "object" ||
    Object.isFrozen(value)
  ) {
    return value;
  }

  Object.freeze(value);

  for (
    const child of
      Object.values(value)
  ) {
    deepFreeze(child);
  }

  return value;
}


/**
 * Editor metadata is deliberately separate from:
 *
 * 1. Profile Content schema
 *    → what data is valid
 *
 * 2. Profile Draft
 *    → mutable working state
 *
 * 3. React/Admin UI
 *    → how a particular control is rendered
 *
 * This metadata only describes editing semantics.
 */
export const PROFILE_EDITOR_METADATA =
  deepFreeze({
    schema:
      PROFILE_EDITOR_METADATA_DOCUMENT_SCHEMA,

    editorMetadataVersion:
      CURRENT_PROFILE_EDITOR_METADATA_VERSION,

    contentSchemaVersion:
      CURRENT_PROFILE_CONTENT_SCHEMA_VERSION,


    /**
     * Visible in a future Owner UI, but never directly editable.
     */
    systemFields: [
      {
        path:
          "schema",

        label:
          "Draft Schema",

        kind:
          "text",

        readOnly:
          true,
      },

      {
        path:
          "draftSchemaVersion",

        label:
          "Draft Schema Version",

        kind:
          "number",

        readOnly:
          true,
      },

      {
        path:
          "draftId",

        label:
          "Draft ID",

        kind:
          "text",

        readOnly:
          true,
      },

      {
        path:
          "baseProfileVariantId",

        label:
          "Base Profile Variant",

        kind:
          "text",

        readOnly:
          true,
      },

      {
        path:
          "revision",

        label:
          "Revision",

        kind:
          "number",

        readOnly:
          true,
      },

      {
        path:
          "contentSchemaVersion",

        label:
          "Content Schema Version",

        kind:
          "number",

        readOnly:
          true,
      },

      {
        path:
          "createdAt",

        label:
          "Created",

        kind:
          "datetime",

        readOnly:
          true,
      },

      {
        path:
          "updatedAt",

        label:
          "Last Updated",

        kind:
          "datetime",

        readOnly:
          true,
      },
    ],


    groups: [
      /**
       * --------------------------------------------------------
       * TARGETING
       * --------------------------------------------------------
       */
      {
        id:
          "targeting",

        path:
          "targeting",

        label:
          "Profile Targeting",

        kind:
          "object",

        fields: [
          {
            path:
              "location",

            label:
              "Location",

            kind:
              "text",

            requiredForPublish:
              true,
          },

          {
            path:
              "jobRole",

            label:
              "Job Role",

            kind:
              "text",

            requiredForPublish:
              true,
          },
        ],
      },


      /**
       * --------------------------------------------------------
       * HERO
       * --------------------------------------------------------
       */
      {
        id:
          "hero",

        path:
          "content.hero",

        label:
          "Hero",

        kind:
          "object",

        fields: [
          {
            path:
              "greeting",

            label:
              "Greeting",

            kind:
              "text",
          },

          {
            path:
              "name",

            label:
              "Display Name",

            kind:
              "text",
          },

          {
            path:
              "rotatingTitles",

            label:
              "Rotating Titles",

            kind:
              "collection",

            reorderable:
              true,

            itemKey:
              "id",

            itemFields: [
              {
                path:
                  "id",

                label:
                  "Title ID",

                kind:
                  "text",

                readOnly:
                  true,
              },

              {
                path:
                  "text",

                label:
                  "Text",

                kind:
                  "text",
              },
            ],
          },
        ],
      },


      /**
       * --------------------------------------------------------
       * ABOUT ME
       * --------------------------------------------------------
       */
      {
        id:
          "aboutMe",

        path:
          "content.aboutMe",

        label:
          "About Me",

        kind:
          "object",

        fields: [
          {
            path:
              "name",

            label:
              "Name",

            kind:
              "text",
          },

          {
            path:
              "profilePhotoAssetId",

            label:
              "Profile Photo",

            kind:
              "asset",

            assetKinds: [
              "profile_photo",
            ],
          },

          {
            path:
              "mobile",

            label:
              "Mobile Content",

            kind:
              "object",

            fields: [
              {
                path:
                  "quote",

                label:
                  "Quote",

                kind:
                  "textarea",
              },

              {
                path:
                  "paragraphs",

                label:
                  "Paragraphs",

                kind:
                  "string-list",

                reorderable:
                  true,
              },
            ],
          },

          {
            path:
              "desktop",

            label:
              "Desktop Content",

            kind:
              "object",

            fields: [
              {
                path:
                  "quote",

                label:
                  "Quote",

                kind:
                  "textarea",
              },

              {
                path:
                  "paragraphs",

                label:
                  "Paragraphs",

                kind:
                  "string-list",

                reorderable:
                  true,
              },
            ],
          },
        ],
      },


      /**
       * --------------------------------------------------------
       * EXPERIENCE
       * --------------------------------------------------------
       */
      {
        id:
          "experience",

        path:
          "content.experience",

        label:
          "Experience",

        kind:
          "collection",

        reorderable:
          true,

        itemFields: [
          {
            path:
              "company",

            label:
              "Company",

            kind:
              "text",
          },

          {
            path:
              "role",

            label:
              "Role",

            kind:
              "text",
          },

          {
            path:
              "employmentType",

            label:
              "Employment Type",

            kind:
              "text",
          },

          {
            path:
              "duration",

            label:
              "Duration",

            kind:
              "text",
          },

          {
            path:
              "location",

            label:
              "Location",

            kind:
              "text",
          },

          {
            path:
              "highlights",

            label:
              "Highlights",

            kind:
              "string-list",

            reorderable:
              true,
          },

          {
            path:
              "tags",

            label:
              "Tags",

            kind:
              "string-list",

            reorderable:
              true,
          },
        ],
      },


      /**
       * --------------------------------------------------------
       * EDUCATION
       * --------------------------------------------------------
       */
      {
        id:
          "education",

        path:
          "content.education",

        label:
          "Education",

        kind:
          "collection",

        reorderable:
          true,

        itemFields: [
          {
            path:
              "school",

            label:
              "School",

            kind:
              "text",
          },

          {
            path:
              "logoAssetId",

            label:
              "School Logo",

            kind:
              "asset",

            assetKinds: [
              "education_image",
            ],
          },

          {
            path:
              "degree",

            label:
              "Degree",

            kind:
              "text",
          },

          {
            path:
              "duration",

            label:
              "Duration",

            kind:
              "text",
          },

          {
            path:
              "location",

            label:
              "Location",

            kind:
              "text",
          },

          {
            path:
              "coursework",

            label:
              "Coursework",

            kind:
              "string-list",

            reorderable:
              true,
          },

          {
            path:
              "highlights",

            label:
              "Highlights",

            kind:
              "string-list",

            reorderable:
              true,
          },

          {
            path:
              "badge",

            label:
              "Badge",

            kind:
              "text",
          },

          {
            path:
              "attachment",

            label:
              "Attachment",

            kind:
              "object",

            fields: [
              {
                path:
                  "title",

                label:
                  "Title",

                kind:
                  "text",
              },

              {
                path:
                  "assetId",

                label:
                  "Attachment",

                kind:
                  "asset",

                assetKinds: [
                  "attachment",
                ],
              },
            ],
          },

          {
            path:
              "activities",

            label:
              "Activities",

            kind:
              "string-list",

            reorderable:
              true,
          },

          {
            path:
              "tags",

            label:
              "Tags",

            kind:
              "string-list",

            reorderable:
              true,
          },
        ],
      },


      /**
       * --------------------------------------------------------
       * SKILLS
       * --------------------------------------------------------
       */
      {
        id:
          "skills",

        path:
          "content.skills",

        label:
          "Skills",

        kind:
          "collection",

        reorderable:
          true,

        itemFields: [
          {
            path:
              "category",

            label:
              "Category",

            kind:
              "text",
          },

          {
            path:
              "skills",

            label:
              "Skills",

            kind:
              "string-list",

            reorderable:
              true,
          },
        ],
      },


      /**
       * --------------------------------------------------------
       * RESUME
       * --------------------------------------------------------
       */
      {
        id:
          "resume",

        path:
          "content.resume",

        label:
          "Resume",

        kind:
          "object",

        // Which of this group's fields are internally reorderable
        // (the resume's own Experience/Education/Projects/Skills
        // blocks), and where their display order is stored. This is
        // separate from -- and much narrower than -- site-wide
        // section structure (Structure tab), which stays read-only.
        reorderableFieldGroups: [
          "experience",
          "education",
          "projects",
          "skills",
        ],

        fieldOrderPath:
          "sectionOrder",

        fields: [
          {
            path:
              "pdfAssetId",

            label:
              "Resume PDF",

            kind:
              "asset",

            assetKinds: [
              "resume_pdf",
            ],
          },

          {
            path:
              "header",

            label:
              "Header",

            kind:
              "object",

            fields: [
              {
                path:
                  "name",

                label:
                  "Name",

                kind:
                  "text",
              },

              {
                path:
                  "location",

                label:
                  "Location",

                kind:
                  "text",
              },

              {
                path:
                  "linkedin",

                label:
                  "LinkedIn Display",

                kind:
                  "text",
              },

              {
                path:
                  "linkedinURL",

                label:
                  "LinkedIn URL",

                kind:
                  "url",
              },

              {
                path:
                  "email",

                label:
                  "Email",

                kind:
                  "email",
              },

              {
                path:
                  "website",

                label:
                  "Website Display",

                kind:
                  "text",
              },

              {
                path:
                  "websiteURL",

                label:
                  "Website URL",

                kind:
                  "url",
              },

              {
                path:
                  "phone",

                label:
                  "Phone",

                kind:
                  "phone",
              },
            ],
          },

          {
            path:
              "education",

            label:
              "Resume Education",

            kind:
              "collection",

            reorderable:
              true,

            itemFields: [
              {
                path:
                  "school",

                label:
                  "School",

                kind:
                  "text",
              },

              {
                path:
                  "location",

                label:
                  "Location",

                kind:
                  "text",
              },

              {
                path:
                  "date",

                label:
                  "Date",

                kind:
                  "text",
              },

              {
                path:
                  "degree",

                label:
                  "Degree",

                kind:
                  "text",
              },

              {
                path:
                  "program",

                label:
                  "Program",

                kind:
                  "text",
              },
            ],
          },

          {
            path:
              "experience",

            label:
              "Resume Experience",

            kind:
              "collection",

            reorderable:
              true,

            itemFields: [
              {
                path:
                  "company",

                label:
                  "Company",

                kind:
                  "text",
              },

              {
                path:
                  "title",

                label:
                  "Title",

                kind:
                  "text",
              },

              {
                path:
                  "location",

                label:
                  "Location",

                kind:
                  "text",
              },

              {
                path:
                  "dates",

                label:
                  "Dates",

                kind:
                  "text",
              },

              {
                path:
                  "bullets",

                label:
                  "Bullets",

                kind:
                  "string-list",

                reorderable:
                  true,
              },
            ],
          },

          {
            path:
              "skills",

            label:
              "Resume Skills",

            kind:
              "record-string-list",
          },

          {
            path:
              "projects",

            label:
              "Resume Projects",

            kind:
              "collection",

            reorderable:
              true,

            itemFields: [
              {
                path:
                  "name",

                label:
                  "Name",

                kind:
                  "text",
              },

              {
                path:
                  "dates",

                label:
                  "Dates",

                kind:
                  "text",
              },

              {
                path:
                  "stack",

                label:
                  "Technology Stack",

                kind:
                  "string-list",

                reorderable:
                  true,
              },

              {
                path:
                  "bullets",

                label:
                  "Bullets",

                kind:
                  "string-list",

                reorderable:
                  true,
              },
            ],
          },
        ],
      },


      /**
       * --------------------------------------------------------
       * PROJECTS
       * --------------------------------------------------------
       */
      {
        id:
          "projects",

        path:
          "content.projects",

        label:
          "Projects",

        kind:
          "collection",

        reorderable:
          true,

        itemKey:
          "id",

        itemFields: [
          {
            path:
              "id",

            label:
              "Project ID",

            kind:
              "text",

            readOnly:
              true,
          },

          {
            path:
              "title",

            label:
              "Title",

            kind:
              "text",
          },

          {
            path:
              "description",

            label:
              "Description",

            kind:
              "textarea",
          },

          {
            path:
              "techStack",

            label:
              "Technology Stack",

            kind:
              "string-list",

            reorderable:
              true,
          },

          {
            path:
              "domain",

            label:
              "Domain",

            kind:
              "text",
          },

          {
            path:
              "industry",

            label:
              "Industry",

            kind:
              "text",
          },

          {
            path:
              "demo",

            label:
              "Live Demo URL",

            kind:
              "url",
          },

          {
            path:
              "github",

            label:
              "GitHub URL",

            kind:
              "url",
          },

          {
            path:
              "status",

            label:
              "Status",

            kind:
              "select",

            options: [
              "Deployed",
              "Completed",
              "In-Progress",
            ],
          },
        ],
      },


      /**
       * --------------------------------------------------------
       * CODE LAB
       * --------------------------------------------------------
       */
      {
        id:
          "codeLab",

        path:
          "content.codeLab",

        label:
          "Code Lab",

        kind:
          "collection",

        reorderable:
          true,

        itemKey:
          "id",

        itemFields: [
          {
            path:
              "id",

            label:
              "Snippet ID",

            kind:
              "text",

            readOnly:
              true,
          },

          {
            path:
              "title",

            label:
              "Title",

            kind:
              "text",
          },

          {
            path:
              "lang",

            label:
              "Language",

            kind:
              "text",
          },

          {
            path:
              "from",

            label:
              "Source",

            kind:
              "text",
          },

          {
            path:
              "why",

            label:
              "Why",

            kind:
              "textarea",
          },

          {
            path:
              "code",

            label:
              "Code",

            kind:
              "code",
          },

          {
            path:
              "technology",

            label:
              "Technology",

            kind:
              "string-list",

            reorderable:
              true,
          },

          {
            path:
              "domain",

            label:
              "Domain",

            kind:
              "string-list",

            reorderable:
              true,
          },

          {
            path:
              "concepts",

            label:
              "Concepts",

            kind:
              "string-list",

            reorderable:
              true,
          },
        ],
      },


      /**
       * --------------------------------------------------------
       * FUN ZONE
       * --------------------------------------------------------
       */
      {
        id:
          "funZone",

        path:
          "content.funZone",

        label:
          "Fun Zone",

        kind:
          "object",

        fields: [
          {
            path:
              "subtitle",

            label:
              "Subtitle",

            kind:
              "textarea",
          },

          {
            path:
              "games",

            label:
              "Games",

            kind:
              "collection",

            reorderable:
              true,

            itemKey:
              "id",

            itemFields: [
              {
                path:
                  "id",

                label:
                  "Game ID",

                kind:
                  "text",

                readOnly:
                  true,
              },

              {
                path:
                  "title",

                label:
                  "Title",

                kind:
                  "text",
              },

              {
                path:
                  "enabled",

                label:
                  "Visible",

                kind:
                  "boolean",
              },

              {
                path:
                  "githubUrl",

                label:
                  "GitHub URL",

                kind:
                  "url",
              },
            ],
          },
        ],
      },


      /**
       * --------------------------------------------------------
       * TIMELINE
       * --------------------------------------------------------
       */
      {
        id:
          "timeline",

        path:
          "content.timeline",

        label:
          "Timeline",

        kind:
          "collection",

        reorderable:
          true,

        itemFields: [
          {
            path:
              "duration",

            label:
              "Duration",

            kind:
              "text",
          },

          {
            path:
              "role",

            label:
              "Role",

            kind:
              "text",
          },

          {
            path:
              "company",

            label:
              "Company",

            kind:
              "text",
          },

          {
            path:
              "description",

            label:
              "Description",

            kind:
              "textarea",
          },
        ],
      },


      /**
       * --------------------------------------------------------
       * CONTACT LINKS
       * --------------------------------------------------------
       */
      {
        id:
          "contactLinks",

        path:
          "content.contactLinks",

        label:
          "Contact Links",

        kind:
          "collection",

        reorderable:
          true,

        itemKey:
          "key",

        itemFields: [
          {
            path:
              "key",

            label:
              "Link Type",

            kind:
              "text",

            readOnly:
              true,
          },

          {
            path:
              "href",

            label:
              "Destination",

            kind:
              "url",
          },

          {
            path:
              "label",

            label:
              "Label",

            kind:
              "text",
          },
        ],
      },
    ],
  });


export function getProfileEditorMetadata() {
  return cloneJson(
    PROFILE_EDITOR_METADATA
  );
}


export function getProfileEditorGroup(
  groupId
) {
  const normalized =
    String(
      groupId || ""
    ).trim();

  const group =
    PROFILE_EDITOR_METADATA
      .groups
      .find(
        (candidate) =>
          candidate.id ===
          normalized
      );

  return group
    ? cloneJson(group)
    : null;
}