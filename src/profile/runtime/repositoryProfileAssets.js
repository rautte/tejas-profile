// src/profile/runtime/repositoryProfileAssets.js

import profilePhoto
  from "../../assets/images/LI_Profile.jpg";

import neuLogo
  from "../../assets/images/education/neu.jpg";

import utAustinLogo
  from "../../assets/images/education/utaustin.jpg";

import vitLogo
  from "../../assets/images/education/vit.jpg";

import specialAchiever
  from "../../assets/images/education/student_special_achiever_2018-2019.jpg";


export const REPOSITORY_PROFILE_ASSET_URLS =
  Object.freeze({
    "profile.primary":
      profilePhoto,

    "education.neu":
      neuLogo,

    "education.utaustin":
      utAustinLogo,

    "education.vit":
      vitLogo,

    "education.student-special-achiever-2018-2019":
      specialAchiever,

    "resume.primary":
      `${process.env.PUBLIC_URL || ""}/downloads/Tejas_Resume.pdf`,
  });


export function getRepositoryProfileAssetUrl(
  assetId
) {
  const id =
    String(
      assetId || ""
    ).trim();


  return (
    REPOSITORY_PROFILE_ASSET_URLS[
      id
    ] ||
    null
  );
}