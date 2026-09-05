// src/profile/content/buildProfileContent.js

import {
  ABOUT_ME,
} from "../../data/aboutMe";

import {
  CODE_LAB_SNIPPETS,
} from "../../data/codeLab";

import {
  EDUCATION,
} from "../../data/education";

import {
  EXPERIENCE,
} from "../../data/experience";

import {
  FOOTER_LINKS,
} from "../../data/footer";

import {
  FUN_ZONE_DATA,
} from "../../data/funZone";

import {
  HERO_DATA,
} from "../../data/hero";

import {
  PROJECTS,
} from "../../data/projects";

import {
  RESUME_DATA,
} from "../../data/resume";

import {
  defaultSiteStructure,
} from "../../data/structure";

import {
  SKILLS,
} from "../../data/skills";

import {
  timelineData,
} from "../../data/timeline";

import {
  createProfileContent,
  validateProfileContent,
} from "../../utils/profileVariant";

import activeSnapshot from "./activeSnapshot.json";


/**
 * Repository authoring adapter.
 *
 * This is the ONLY place that should need to know how the
 * current repository spreads recruiter-facing content across
 * src/data modules.
 *
 * It produces the same canonical ProfileContent DTO that a
 * future Admin → Data editor will eventually produce.
 *
 * Prefers activeSnapshot.json (see scripts/sync-repository-
 * profile.mjs) when present and valid, so the very first paint --
 * before the Active Profile API resolves -- already matches
 * whatever Profile Variant is actually live, instead of visibly
 * flashing older hand-authored content. Falls back to the
 * hand-authored src/data modules below if the snapshot is ever
 * missing, empty, or fails validation -- that path is never
 * allowed to regress.
 */
export function buildProfileContent() {
  const fromSnapshot =
    buildProfileContentFromSnapshot();

  if (fromSnapshot) {
    return fromSnapshot;
  }


  const content =
    createProfileContent({
      hero:
        HERO_DATA,

      aboutMe:
        ABOUT_ME,

      experience:
        EXPERIENCE,

      education:
        EDUCATION,

      skills:
        SKILLS,

      resume:
        RESUME_DATA,

      projects:
        PROJECTS,

      codeLab:
        CODE_LAB_SNIPPETS,

      funZone:
        FUN_ZONE_DATA,

      timeline:
        timelineData,

      contactLinks:
        FOOTER_LINKS,

      structure:
        defaultSiteStructure(),
    });


  const validation =
    validateProfileContent(
      content
    );


  if (
    !validation.valid
  ) {
    throw new Error(
      [
        "Repository Profile Content is invalid.",
        ...validation.errors,
      ].join(" ")
    );
  }


  return content;
}


function buildProfileContentFromSnapshot() {
  try {
    const snapshotContent =
      activeSnapshot
        ?.content;

    if (
      !snapshotContent ||
      typeof snapshotContent !==
        "object"
    ) {
      return null;
    }


    const content =
      createProfileContent({
        ...snapshotContent,

        structure:
          snapshotContent.structure ||
          defaultSiteStructure(),
      });


    const validation =
      validateProfileContent(
        content
      );


    if (
      !validation.valid
    ) {
      return null;
    }


    return content;
  } catch {
    return null;
  }
}