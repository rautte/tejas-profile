// src/data/profileAssets/index.js

/**
 * Pure-data catalog of assets that belong to recruiter-facing
 * Profile Variants.
 *
 * IMPORTANT:
 * - sourcePath is repository-authoring provenance.
 * - Browser components resolve these IDs to actual imported/runtime URLs.
 * - Platform/game assets such as Battleship ship frames do NOT belong here.
 */
export const PROFILE_ASSET_CATALOG =
  Object.freeze({
    "profile.primary": {
      kind:
        "profile_photo",

      sourcePath:
        "src/assets/images/LI_Profile.jpg",

      contentType:
        "image/jpeg",
    },

    "education.neu": {
      kind:
        "education_image",

      sourcePath:
        "src/assets/images/education/neu.jpg",

      contentType:
        "image/jpeg",
    },

    "education.utaustin": {
      kind:
        "education_image",

      sourcePath:
        "src/assets/images/education/utaustin.jpg",

      contentType:
        "image/jpeg",
    },

    "education.vit": {
      kind:
        "education_image",

      sourcePath:
        "src/assets/images/education/vit.jpg",

      contentType:
        "image/jpeg",
    },

    "education.student-special-achiever-2018-2019":
      {
        kind:
          "attachment",

        sourcePath:
          "src/assets/images/education/student_special_achiever_2018-2019.jpg",

        contentType:
          "image/jpeg",
      },

    "resume.primary": {
      kind:
        "resume_pdf",

      sourcePath:
        "public/downloads/Tejas_Resume.pdf",

      contentType:
        "application/pdf",
    },
  });


export function getProfileAssetDefinition(
  assetId
) {
  const id =
    String(
      assetId || ""
    ).trim();

  return (
    PROFILE_ASSET_CATALOG[
      id
    ] ||
    null
  );
}