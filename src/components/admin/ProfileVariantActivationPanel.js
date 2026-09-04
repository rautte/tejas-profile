// src/components/admin/ProfileVariantActivationPanel.js

import {
  useMemo,
  useState,
} from "react";

import {
  activateProfileVariant,
  getProfileVariant,
} from "../../utils/snapshots/snapshotsApi";

import {
  cx,
} from "../../utils/cx";

import {
  CARD_ROUNDED_2XL,
  CARD_SURFACE,
} from "../../utils/ui";


function cleanString(
  value
) {
  return String(
    value || ""
  ).trim();
}


export function deriveObservedActivationState({
  active,
  activeProfileVariantId,
}) {
  const currentProfileVariantId =
    cleanString(
      activeProfileVariantId ||
        active
          ?.profileVariantId
    );


  /**
   * No ACTIVE pointer observed.
   *
   * This is the legitimate optimistic-concurrency revision-0
   * case established in P3.5A.
   */
  if (!active) {
    if (currentProfileVariantId) {
      return {
        valid:
          false,

        currentProfileVariantId,

        expectedRevision:
          null,

        revisionLabel:
          "Invalid",
      };
    }


    return {
      valid:
        true,

      currentProfileVariantId:
        "",

      expectedRevision:
        0,

      revisionLabel:
        "0 (no active pointer)",
    };
  }


  const revision =
    Number(
      active
        ?.revision
    );


  /**
   * Once an ACTIVE pointer exists, its revision must be a
   * positive integer.
   *
   * Never silently convert malformed active state into revision
   * zero, because that would defeat optimistic concurrency.
   */
  if (
    !Number.isInteger(
      revision
    ) ||
    revision < 1
  ) {
    return {
      valid:
        false,

      currentProfileVariantId,

      expectedRevision:
        null,

      revisionLabel:
        "Invalid",
    };
  }


  return {
    valid:
      true,

    currentProfileVariantId,

    expectedRevision:
      revision,

    revisionLabel:
      String(
        revision
      ),
  };
}


function MetadataRow({
  label,
  value,
  mono = false,
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[150px_minmax(0,1fr)] gap-1 sm:gap-3">
      <div className="text-xs font-semibold text-gray-500 dark:text-gray-400">
        {label}
      </div>

      <div
        className={cx(
          "text-xs text-gray-800 dark:text-gray-200 break-words",
          mono
            ? "font-mono"
            : ""
        )}
      >
        {value || "—"}
      </div>
    </div>
  );
}


export default function ProfileVariantActivationPanel({
  active = null,

  activeProfileVariantId =
    "",

  onRefreshActiveProfile,
}) {
  const [
    inputId,
    setInputId,
  ] =
    useState(
      ""
    );


  const [
    targetResult,
    setTargetResult,
  ] =
    useState(
      null
    );


  const [
    lookupBusy,
    setLookupBusy,
  ] =
    useState(
      false
    );


  const [
    lookupError,
    setLookupError,
  ] =
    useState(
      ""
    );


  const [
    confirmOpen,
    setConfirmOpen,
  ] =
    useState(
      false
    );


  const [
    activationBusy,
    setActivationBusy,
  ] =
    useState(
      false
    );


  const [
    activationError,
    setActivationError,
  ] =
    useState(
      ""
    );


  const [
    activationSuccess,
    setActivationSuccess,
  ] =
    useState(
      ""
    );


  const observed =
    useMemo(
      () =>
        deriveObservedActivationState({
          active,

          activeProfileVariantId,
        }),
      [
        active,
        activeProfileVariantId,
      ]
    );


  const targetVariant =
    targetResult
      ?.variant ||
    null;


  const targetProfileVariantId =
    cleanString(
      targetVariant
        ?.profileVariantId
    );


  const alreadyActive =
    Boolean(
      targetProfileVariantId &&
      observed
        .currentProfileVariantId &&
      targetProfileVariantId ===
        observed
          .currentProfileVariantId
    );


  const resetTargetState = () => {
    setTargetResult(
      null
    );

    setLookupError(
      ""
    );

    setConfirmOpen(
      false
    );

    setActivationError(
      ""
    );

    setActivationSuccess(
      ""
    );
  };


  const loadTargetVariant =
    async () => {
      const requestedId =
        cleanString(
          inputId
        );


      if (!requestedId) {
        setLookupError(
          "Enter a published Profile Variant ID."
        );

        return;
      }


      setLookupBusy(
        true
      );

      setLookupError(
        ""
      );

      setTargetResult(
        null
      );

      setConfirmOpen(
        false
      );

      setActivationError(
        ""
      );

      setActivationSuccess(
        ""
      );


      try {
        const result =
          await getProfileVariant(
            requestedId
          );


        const loadedId =
          cleanString(
            result
              ?.variant
              ?.profileVariantId
          );


        if (!loadedId) {
          throw new Error(
            "Profile Variant response is missing profileVariantId."
          );
        }


        if (
          loadedId !==
            requestedId
        ) {
          throw new Error(
            "Loaded Profile Variant ID does not match the requested ID."
          );
        }


        setTargetResult(
          result
        );
      } catch (
        error
      ) {
        setLookupError(
          String(
            error
              ?.message ||
            error
          )
        );
      } finally {
        setLookupBusy(
          false
        );
      }
    };


  const refreshActiveProfile =
    async () => {
      if (
        typeof onRefreshActiveProfile !==
          "function"
      ) {
        return;
      }


      await onRefreshActiveProfile();
    };


  const activateTargetVariant =
    async () => {
      if (
        !targetProfileVariantId
      ) {
        return;
      }


      if (
        !observed.valid
      ) {
        setActivationError(
          "Current ACTIVE Profile state has an invalid revision. Refresh the active Profile before activating another variant."
        );

        return;
      }


      if (
        alreadyActive
      ) {
        return;
      }


      setActivationBusy(
        true
      );

      setActivationError(
        ""
      );

      setActivationSuccess(
        ""
      );


      try {
        const result =
          await activateProfileVariant({
            profileVariantId:
              targetProfileVariantId,

            expectedRevision:
              observed
                .expectedRevision,
          });


        /**
         * Activation has already committed at this point.
         *
         * Refreshing the observed public Profile runtime state is
         * deliberately separate from the mutation itself so a refresh
         * problem can never cause an accidental second activation attempt.
         */
        try {
          await refreshActiveProfile();
        } catch (
          refreshError
        ) {
          setConfirmOpen(
            false
          );

          setActivationSuccess(
            `Profile Variant "${targetProfileVariantId}" was activated, but the page could not refresh the ACTIVE Profile state automatically: ${
              refreshError
                ?.message ||
              refreshError
            }`
          );

          return;
        }


        setConfirmOpen(
          false
        );

        setActivationSuccess(
          `Profile Variant "${cleanString(
            result
              ?.active
              ?.profileVariantId
          ) || targetProfileVariantId}" is now active.`
        );
      } catch (
        error
      ) {
        if (
          error
            ?.code ===
            "PROFILE_ACTIVATION_CONFLICT"
        ) {
          /**
           * Never automatically retry a 409.
           *
           * Another owner/device changed ACTIVE after our observed
           * revision. Refresh the state and require explicit review
           * before another attempt.
           */
          try {
            await refreshActiveProfile();
          } catch {
            // Keep the original conflict as the primary failure.
          }


          setActivationError(
            "Active Profile changed before this activation committed. The current ACTIVE state was refreshed. Review the updated revision and retry explicitly."
          );

          return;
        }


        setActivationError(
          String(
            error
              ?.message ||
            error
          )
        );
      } finally {
        setActivationBusy(
          false
        );
      }
    };


  const targetingLabel =
    [
      cleanString(
        targetVariant
          ?.targeting
          ?.location
      ),

      cleanString(
        targetVariant
          ?.targeting
          ?.jobRole
      ),
    ]
      .filter(
        Boolean
      )
      .join(
        " · "
      );


  return (
    <div
      className={cx(
        CARD_SURFACE,
        CARD_ROUNDED_2XL
      )}
    >
      <div className="px-6 py-4 border-b border-gray-200/70 dark:border-white/10">
        <h3 className="text-left font-epilogue text-lg font-semibold text-gray-900 dark:text-gray-100">
          Profile activation
        </h3>

        <p className="mt-1 text-xs text-gray-600 dark:text-gray-400 max-w-3xl">
          Activate an already-published immutable Profile Variant on the current application platform.
          This changes Profile content only and does not trigger a Git or GitHub Pages deployment.
        </p>
      </div>


      <div className="px-6 py-5 space-y-5">
        <div className="rounded-xl border border-gray-200/70 dark:border-white/10 bg-gray-50/70 dark:bg-white/5 p-4 space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Current ACTIVE Profile
          </div>

          <MetadataRow
            label="Profile Variant ID"
            value={
              observed
                .currentProfileVariantId ||
              "No active Profile Variant"
            }
            mono
          />

          <MetadataRow
            label="Observed revision"
            value={
              observed
                .revisionLabel
            }
          />

          {!observed.valid ? (
            <div className="mt-2 text-xs text-red-600 dark:text-red-400">
              ACTIVE pointer metadata is inconsistent. Activation is disabled until the runtime state is refreshed.
            </div>
          ) : null}
        </div>


        <div className="space-y-2">
          <label
            htmlFor="profile-variant-activation-id"
            className="block text-xs font-semibold text-gray-700 dark:text-gray-300"
          >
            Published Profile Variant ID
          </label>

          <div className="text-[11px] text-gray-500 dark:text-gray-400">
            Use a published <span className="font-mono">prv_*</span> identity
            from Profile Variant history below. Loading is read-only; activation
            happens only after you review the variant and confirm explicitly.
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <input
              id="profile-variant-activation-id"
              value={
                inputId
              }
              onChange={(
                event
              ) => {
                setInputId(
                  event
                    .target
                    .value
                );

                resetTargetState();
              }}
              placeholder="prv_..."
              disabled={
                lookupBusy ||
                activationBusy
              }
              className={cx(
                "flex-1 h-10 rounded-xl border px-3 text-sm outline-none",
                "border-gray-200/70 dark:border-white/10",
                "bg-white/80 dark:bg-white/10",
                "text-gray-900 dark:text-gray-100",
                "placeholder:text-gray-400 dark:placeholder:text-gray-500",
                "focus:ring-2 focus:ring-purple-500/30"
              )}
            />

            <button
              type="button"
              onClick={
                loadTargetVariant
              }
              disabled={
                lookupBusy ||
                activationBusy ||
                !cleanString(
                  inputId
                )
              }
              className={cx(
                "h-10 px-4 rounded-xl border text-xs font-semibold transition",
                "border-purple-500/40 bg-purple-600 text-white hover:bg-purple-700",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              {lookupBusy
                ? "Loading…"
                : "Load variant"}
            </button>
          </div>

          {lookupError ? (
            <div className="text-xs text-red-600 dark:text-red-400 whitespace-pre-wrap break-words">
              {lookupError}
            </div>
          ) : null}
        </div>


        {targetVariant ? (
          <div className="rounded-xl border border-purple-200/70 dark:border-purple-400/20 bg-purple-50/50 dark:bg-purple-500/5 p-4 space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-purple-700 dark:text-purple-300">
              Target Profile Variant
            </div>

            <MetadataRow
              label="Profile Variant ID"
              value={
                targetProfileVariantId
              }
              mono
            />

            <MetadataRow
              label="Content hash"
              value={
                targetVariant
                  .contentHash
              }
              mono
            />

            <MetadataRow
              label="Targeting"
              value={
                targetingLabel
              }
            />

            <MetadataRow
              label="Created at"
              value={
                targetVariant
                  .createdAt
              }
            />

            <MetadataRow
              label="Manifest SHA-256"
              value={
                targetResult
                  ?.manifestSha256
              }
              mono
            />


            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  setActivationError(
                    ""
                  );

                  setActivationSuccess(
                    ""
                  );

                  setConfirmOpen(
                    true
                  );
                }}
                disabled={
                  activationBusy ||
                  alreadyActive ||
                  !observed.valid
                }
                className={cx(
                  "inline-flex items-center justify-center px-4 py-2 rounded-lg",
                  "text-xs font-semibold border transition shadow-sm",
                  alreadyActive
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                    : "border-emerald-500/40 bg-emerald-600 text-white hover:bg-emerald-700",
                  "disabled:opacity-60 disabled:cursor-not-allowed"
                )}
              >
                {alreadyActive
                  ? "Already active"
                  : "Review activation"}
              </button>
            </div>
          </div>
        ) : null}


        {confirmOpen &&
        targetVariant ? (
          <div
            role="dialog"
            aria-label="Confirm Profile Variant activation"
            className="rounded-xl border border-amber-300/70 dark:border-amber-400/25 bg-amber-50/70 dark:bg-amber-500/5 p-4 space-y-4"
          >
            <div>
              <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Confirm Profile activation
              </div>

              <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                This updates only the ACTIVE Profile content pointer. It does not redeploy the application.
              </p>
            </div>


            <div className="space-y-2">
              <MetadataRow
                label="Current"
                value={
                  observed
                    .currentProfileVariantId ||
                  "No active Profile Variant"
                }
                mono
              />

              <MetadataRow
                label="Target"
                value={
                  targetProfileVariantId
                }
                mono
              />

              <MetadataRow
                label="Expected revision"
                value={
                  String(
                    observed
                      .expectedRevision
                  )
                }
              />
            </div>


            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={
                  activationBusy
                }
                onClick={() =>
                  setConfirmOpen(
                    false
                  )
                }
                className={cx(
                  "px-3 py-2 rounded-lg text-xs font-semibold border transition",
                  "border-gray-300/70 dark:border-white/10",
                  "bg-gray-50/80 dark:bg-white/10",
                  "text-gray-800 dark:text-gray-100",
                  "hover:bg-gray-100 dark:hover:bg-white/15",
                  "disabled:opacity-60"
                )}
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={
                  activationBusy ||
                  alreadyActive ||
                  !observed.valid
                }
                onClick={
                  activateTargetVariant
                }
                className={cx(
                  "px-3 py-2 rounded-lg text-xs font-semibold border transition",
                  "border-emerald-500/40 bg-emerald-600 text-white hover:bg-emerald-700",
                  "disabled:opacity-60 disabled:cursor-not-allowed"
                )}
              >
                {activationBusy
                  ? "Activating…"
                  : "Activate Profile Variant"}
              </button>
            </div>
          </div>
        ) : null}


        {activationError ? (
          <div className="text-xs text-red-600 dark:text-red-400 whitespace-pre-wrap break-words">
            {activationError}
          </div>
        ) : null}


        {activationSuccess ? (
          <div className="text-xs text-emerald-700 dark:text-emerald-300 whitespace-pre-wrap break-words">
            {activationSuccess}
          </div>
        ) : null}
      </div>
    </div>
  );
}