// src/profile/draft/useProfileDraftSession.js

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  createProfileDraft,
  updateProfileDraft,
  validateProfileDraft,
} from "./profileDraft";

import {
  deriveProfileDraftStatus,
} from "./draftStatus";

import {
  discardDraftFromStorage,
  loadDraftFromStorage,
  saveDraftToStorage,
} from "./draftStorage";


const AUTOSAVE_DEBOUNCE_MS =
  800;


function cleanString(
  value
) {
  return String(
    value || ""
  ).trim();
}


/**
 * Owner draft session: create/resume/discard a Profile Draft,
 * autosave every edit to localStorage, and derive its lifecycle
 * status. Never touches production Profile state — publication
 * (a later phase) is the only thing that does.
 */
export function useProfileDraftSession({
  baseProfileVariantId,
  baseTargeting,
  baseContent,
  storage,
} = {}) {
  const [
    draft,
    setDraft,
  ] =
    useState(null);

  const [
    resumableDraft,
    setResumableDraft,
  ] =
    useState(null);

  const [
    autosaveError,
    setAutosaveError,
  ] =
    useState("");

  const autosaveTimerRef =
    useRef(null);

  const cleanBaseId =
    cleanString(
      baseProfileVariantId
    );


  useEffect(
    () => {
      setDraft(
        null
      );

      setResumableDraft(
        null
      );

      setAutosaveError(
        ""
      );

      if (
        !cleanBaseId
      ) {
        return;
      }

      const stored =
        loadDraftFromStorage(
          cleanBaseId,
          {
            storage,
          }
        );

      if (
        !stored
      ) {
        return;
      }

      const validation =
        validateProfileDraft(
          stored
        );

      if (
        !validation.valid
      ) {
        // Corrupt/incompatible persisted draft — fail closed.
        discardDraftFromStorage(
          cleanBaseId,
          {
            storage,
          }
        );

        return;
      }

      setResumableDraft(
        stored
      );
    },
    [
      cleanBaseId,
      storage,
    ]
  );


  useEffect(
    () => () => {
      if (
        autosaveTimerRef.current
      ) {
        clearTimeout(
          autosaveTimerRef.current
        );
      }
    },
    []
  );


  const persistDebounced =
    useCallback(
      (
        nextDraft
      ) => {
        if (
          autosaveTimerRef.current
        ) {
          clearTimeout(
            autosaveTimerRef.current
          );
        }

        autosaveTimerRef.current =
          setTimeout(
            () => {
              try {
                saveDraftToStorage(
                  nextDraft,
                  {
                    storage,
                  }
                );

                setAutosaveError(
                  ""
                );
              } catch (
                error
              ) {
                setAutosaveError(
                  String(
                    error
                      ?.message ||
                    error
                  )
                );
              }
            },
            AUTOSAVE_DEBOUNCE_MS
          );
      },
      [
        storage,
      ]
    );


  const startDraft =
    useCallback(
      () => {
        if (
          !cleanBaseId
        ) {
          return;
        }

        const now =
          new Date().toISOString();

        const next =
          createProfileDraft(
            {
              draftId: `draft_${cleanBaseId}_${Date.now().toString(
                36
              )}`,

              baseProfileVariantId:
                cleanBaseId,

              targeting:
                baseTargeting ||
                {},

              content:
                baseContent ||
                {},

              createdAt:
                now,

              updatedAt:
                now,
            }
          );

        setDraft(
          next
        );

        setResumableDraft(
          null
        );

        setAutosaveError(
          ""
        );

        // Immediate, not debounced — a fresh draft is never
        // silently lost between creation and the first edit.
        saveDraftToStorage(
          next,
          {
            storage,
          }
        );
      },
      [
        cleanBaseId,
        baseTargeting,
        baseContent,
        storage,
      ]
    );


  const resumeDraft =
    useCallback(
      () => {
        if (
          !resumableDraft
        ) {
          return;
        }

        setDraft(
          resumableDraft
        );

        setResumableDraft(
          null
        );
      },
      [
        resumableDraft,
      ]
    );


  const discardDraft =
    useCallback(
      () => {
        if (
          autosaveTimerRef.current
        ) {
          clearTimeout(
            autosaveTimerRef.current
          );
        }

        if (
          cleanBaseId
        ) {
          discardDraftFromStorage(
            cleanBaseId,
            {
              storage,
            }
          );
        }

        setDraft(
          null
        );

        setResumableDraft(
          null
        );

        setAutosaveError(
          ""
        );
      },
      [
        cleanBaseId,
        storage,
      ]
    );


  const patchDraft =
    useCallback(
      (
        patch
      ) => {
        setDraft(
          (
            current
          ) => {
            if (
              !current
            ) {
              return current;
            }

            const next =
              updateProfileDraft(
                current,
                patch,
                {
                  expectedRevision:
                    current.revision,
                }
              );

            persistDebounced(
              next
            );

            return next;
          }
        );
      },
      [
        persistDebounced,
      ]
    );


  const resetSection =
    useCallback(
      (
        sectionKey
      ) => {
        if (
          !baseContent
        ) {
          return;
        }

        patchDraft(
          {
            content: {
              [sectionKey]:
                baseContent[
                  sectionKey
                ],
            },
          }
        );
      },
      [
        baseContent,
        patchDraft,
      ]
    );


  const status =
    useMemo(
      () =>
        deriveProfileDraftStatus(
          {
            draft,
            baseProfileVariantId:
              cleanBaseId,

            baseTargeting,
            baseContent,
          }
        ),
      [
        draft,
        cleanBaseId,
        baseTargeting,
        baseContent,
      ]
    );


  return {
    draft,
    resumableDraft,
    status,
    autosaveError,
    startDraft,
    resumeDraft,
    discardDraft,
    patchDraft,
    resetSection,
  };
}
