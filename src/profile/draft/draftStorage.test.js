// src/profile/draft/draftStorage.test.js

import {
  discardDraftFromStorage,
  loadDraftFromStorage,
  saveDraftToStorage,
} from "./draftStorage";


function memoryStorage() {
  const store =
    new Map();

  return {
    getItem:
      (
        key
      ) =>
        store.has(
          key
        )
          ? store.get(
              key
            )
          : null,

    setItem:
      (
        key,
        value
      ) =>
        store.set(
          key,
          value
        ),

    removeItem:
      (
        key
      ) =>
        store.delete(
          key
        ),

    _store:
      store,
  };
}


describe(
  "draftStorage",
  () => {
    test(
      "saves and loads a draft scoped by baseProfileVariantId",
      () => {
        const storage =
          memoryStorage();

        const draft = {
          baseProfileVariantId:
            "prv_a",

          revision:
            1,
        };

        saveDraftToStorage(
          draft,
          {
            storage,
          }
        );

        expect(
          loadDraftFromStorage(
            "prv_a",
            {
              storage,
            }
          )
        ).toEqual(
          draft
        );
      }
    );


    test(
      "keeps drafts for different base variants independent",
      () => {
        const storage =
          memoryStorage();

        saveDraftToStorage(
          {
            baseProfileVariantId:
              "prv_a",

            revision:
              1,
          },
          {
            storage,
          }
        );

        saveDraftToStorage(
          {
            baseProfileVariantId:
              "prv_b",

            revision:
              5,
          },
          {
            storage,
          }
        );

        expect(
          loadDraftFromStorage(
            "prv_a",
            {
              storage,
            }
          )
            .revision
        ).toBe(
          1
        );

        expect(
          loadDraftFromStorage(
            "prv_b",
            {
              storage,
            }
          )
            .revision
        ).toBe(
          5
        );
      }
    );


    test(
      "returns null for a missing entry rather than throwing",
      () => {
        const storage =
          memoryStorage();

        expect(
          loadDraftFromStorage(
            "prv_never_saved",
            {
              storage,
            }
          )
        ).toBeNull();
      }
    );


    test(
      "fails closed on a corrupt stored entry instead of throwing",
      () => {
        const storage =
          memoryStorage();

        storage.setItem(
          "tejas-profile:owner-draft:prv_corrupt",
          "{not valid json"
        );

        expect(
          loadDraftFromStorage(
            "prv_corrupt",
            {
              storage,
            }
          )
        ).toBeNull();
      }
    );


    test(
      "discard removes only the targeted base variant's draft",
      () => {
        const storage =
          memoryStorage();

        saveDraftToStorage(
          {
            baseProfileVariantId:
              "prv_a",

            revision:
              1,
          },
          {
            storage,
          }
        );

        saveDraftToStorage(
          {
            baseProfileVariantId:
              "prv_b",

            revision:
              1,
          },
          {
            storage,
          }
        );

        discardDraftFromStorage(
          "prv_a",
          {
            storage,
          }
        );

        expect(
          loadDraftFromStorage(
            "prv_a",
            {
              storage,
            }
          )
        ).toBeNull();

        expect(
          loadDraftFromStorage(
            "prv_b",
            {
              storage,
            }
          )
        ).not.toBeNull();
      }
    );


    test(
      "saveDraftToStorage requires baseProfileVariantId",
      () => {
        const storage =
          memoryStorage();

        expect(
          () =>
            saveDraftToStorage(
              {
                revision:
                  1,
              },
              {
                storage,
              }
            )
        ).toThrow(
          "Draft is missing baseProfileVariantId."
        );
      }
    );
  }
);
