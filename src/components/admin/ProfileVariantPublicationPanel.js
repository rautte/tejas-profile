// src/components/admin/ProfileVariantPublicationPanel.js

import {
  useEffect,
  useState,
} from "react";

import {
  createProfileDraft,
  evaluateProfileDraftReadiness,
} from "../../profile/draft";

import {
  buildProfilePublicationPackage,
  publishProfilePublication,
} from "../../profile/publish";

import {
  activateProfileVariant,
  createDeploymentConfiguration,
  getProfileVariant,
} from "../../utils/snapshots/snapshotsApi";

import {
  deriveObservedActivationState,
} from "./ProfileVariantActivationPanel";

import {
  listProfileVariants,
} from "../../utils/snapshots/controlPlaneCatalogApi";

import {
  loadCompleteProfileVariantCatalog,
  uniqueProfileTargetingValuesFromCatalog,
} from "../../utils/snapshots/profileVariantCatalog";

import {
  generateProfileVariantId,
  suggestProfileVariantId,
} from "../../utils/snapshots/profileVariantId";

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


export default function ProfileVariantPublicationPanel({
  activeProfileVariantId =
    "",

  activeProfile =
    null,

  onRefreshActiveProfile,

  /**
   * An externally-produced publish result (e.g. from the Data
   * page's own draft-editor publish flow) to surface through this
   * card's "Published" / "Activate Profile Variant" UI, so there is a
   * single place to activate a freshly-published variant regardless
   * of which publish path produced it. Adopted whenever its
   * profileVariantId changes -- a fresh publish always mints a new
   * id, so identity alone is a sufficient "is this new" signal.
   */
  seedPublishResult =
    null,

  loadProfileVariants =
    listProfileVariants,
}) {
  const [
    sourceId,
    setSourceId,
  ] =
    useState(
      activeProfileVariantId
    );

  const [
    sourceVariant,
    setSourceVariant,
  ] =
    useState(null);

  const [
    sourceBusy,
    setSourceBusy,
  ] =
    useState(false);

  const [
    sourceError,
    setSourceError,
  ] =
    useState("");

  const [
    newVariantId,
    setNewVariantId,
  ] =
    useState(() =>
      generateProfileVariantId()
    );

  const [
    newVariantIdTouched,
    setNewVariantIdTouched,
  ] =
    useState(false);

  const [
    newLocation,
    setNewLocation,
  ] =
    useState("");

  const [
    newJobRole,
    setNewJobRole,
  ] =
    useState("");

  const [
    knownLocations,
    setKnownLocations,
  ] =
    useState([]);

  const [
    knownJobRoles,
    setKnownJobRoles,
  ] =
    useState([]);

  const [
    validation,
    setValidation,
  ] =
    useState(null);

  const [
    publishBusy,
    setPublishBusy,
  ] =
    useState(false);

  const [
    publishError,
    setPublishError,
  ] =
    useState("");

  const [
    publishResult,
    setPublishResult,
  ] =
    useState(null);

  const [
    activateConfirming,
    setActivateConfirming,
  ] =
    useState(false);

  const [
    activateBusy,
    setActivateBusy,
  ] =
    useState(false);

  const [
    activateError,
    setActivateError,
  ] =
    useState("");

  const [
    activateDone,
    setActivateDone,
  ] =
    useState(false);

  const [
    missingDeploymentConfig,
    setMissingDeploymentConfig,
  ] =
    useState(null);

  const [
    createConfigBusy,
    setCreateConfigBusy,
  ] =
    useState(false);

  const [
    createConfigError,
    setCreateConfigError,
  ] =
    useState("");


  useEffect(
    () => {
      const seededId =
        cleanString(
          seedPublishResult
            ?.profileVariantId
        );

      if (
        !seededId
      ) {
        return;
      }

      setPublishResult(
        seedPublishResult
      );

      setValidation(
        null
      );

      setPublishError(
        ""
      );

      setActivateConfirming(
        false
      );

      setActivateError(
        ""
      );

      setActivateDone(
        false
      );

      setMissingDeploymentConfig(
        null
      );

      setCreateConfigError(
        ""
      );
    },
    [
      seedPublishResult,
    ]
  );


  useEffect(
    () => {
      let cancelled =
        false;

      (async () => {
        try {
          const catalog =
            await loadCompleteProfileVariantCatalog(
              loadProfileVariants
            );

          if (
            cancelled
          ) {
            return;
          }

          setKnownLocations(
            uniqueProfileTargetingValuesFromCatalog(
              catalog,
              "location"
            )
          );

          setKnownJobRoles(
            uniqueProfileTargetingValuesFromCatalog(
              catalog,
              "jobRole"
            )
          );
        } catch {
          /**
           * Autocomplete is a convenience, not a correctness
           * requirement. Fail closed to no suggestions rather
           * than block publication on a catalog read error.
           */
          if (
            !cancelled
          ) {
            setKnownLocations(
              []
            );

            setKnownJobRoles(
              []
            );
          }
        }
      })();

      return () => {
        cancelled =
          true;
      };
    },
    [
      loadProfileVariants,
    ]
  );


  useEffect(
    () => {
      if (
        newVariantIdTouched
      ) {
        return;
      }

      const suggested =
        suggestProfileVariantId(
          {
            location:
              newLocation,

            jobRole:
              newJobRole,
          }
        );

      if (
        suggested
      ) {
        setNewVariantId(
          suggested
        );
      }
    },
    [
      newLocation,
      newJobRole,
      newVariantIdTouched,
    ]
  );


  const resetDownstreamState = () => {
    setValidation(
      null
    );

    setPublishError(
      ""
    );

    setPublishResult(
      null
    );

    setActivateConfirming(
      false
    );

    setActivateError(
      ""
    );

    setActivateDone(
      false
    );

    setMissingDeploymentConfig(
      null
    );

    setCreateConfigError(
      ""
    );
  };


  const activateNewVariant =
    async () => {
      const targetProfileVariantId =
        cleanString(
          publishResult
            ?.profileVariantId
        );

      if (
        !targetProfileVariantId
      ) {
        return;
      }

      const observed =
        deriveObservedActivationState(
          {
            active:
              activeProfile,

            activeProfileVariantId,
          }
        );

      if (
        !observed.valid
      ) {
        setActivateError(
          "Current ACTIVE Profile state has an invalid revision. Refresh the active Profile before activating."
        );

        return;
      }

      setActivateBusy(
        true
      );

      setActivateError(
        ""
      );

      setMissingDeploymentConfig(
        null
      );

      setCreateConfigError(
        ""
      );

      try {
        await activateProfileVariant(
          {
            profileVariantId:
              targetProfileVariantId,

            expectedRevision:
              observed
                .expectedRevision,
          }
        );

        try {
          await onRefreshActiveProfile?.();
        } catch {
          // Activation already committed -- a refresh failure here
          // never implies the activation itself failed.
        }

        setActivateConfirming(
          false
        );

        setActivateDone(
          true
        );
      } catch (
        error
      ) {
        setActivateError(
          String(
            error
              ?.message ||
            error
          )
        );

        if (
          error
            ?.code ===
            "DEPLOYMENT_CONFIGURATION_MISSING" &&
          error.platformReleaseId &&
          error.profileVariantId
        ) {
          setMissingDeploymentConfig(
            {
              platformReleaseId:
                error.platformReleaseId,

              profileVariantId:
                error.profileVariantId,
            }
          );
        }
      } finally {
        setActivateBusy(
          false
        );
      }
    };


  const createMissingDeploymentConfig =
    async () => {
      if (
        !missingDeploymentConfig
      ) {
        return;
      }

      setCreateConfigBusy(
        true
      );

      setCreateConfigError(
        ""
      );

      try {
        await createDeploymentConfiguration(
          missingDeploymentConfig
        );

        setMissingDeploymentConfig(
          null
        );

        setActivateError(
          ""
        );
      } catch (
        error
      ) {
        setCreateConfigError(
          String(
            error
              ?.message ||
            error
          )
        );
      } finally {
        setCreateConfigBusy(
          false
        );
      }
    };


  const loadSourceVariant =
    async () => {
      const requestedId =
        cleanString(
          sourceId
        );


      if (
        !requestedId
      ) {
        setSourceError(
          "Enter a published Profile Variant ID to reuse its content."
        );

        return;
      }


      setSourceBusy(
        true
      );

      setSourceError(
        ""
      );

      setSourceVariant(
        null
      );

      resetDownstreamState();

      setNewVariantIdTouched(
        false
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


        if (
          !loadedId
        ) {
          throw new Error(
            "Profile Variant response is missing profileVariantId."
          );
        }


        setSourceVariant(
          result.variant
        );

        setNewLocation(
          cleanString(
            result
              ?.variant
              ?.targeting
              ?.location
          )
        );

        setNewJobRole(
          cleanString(
            result
              ?.variant
              ?.targeting
              ?.jobRole
          )
        );
      } catch (
        error
      ) {
        setSourceError(
          String(
            error
              ?.message ||
            error
          )
        );
      } finally {
        setSourceBusy(
          false
        );
      }
    };


  const validateTargeting =
    () => {
      setPublishError(
        ""
      );

      setPublishResult(
        null
      );


      if (
        !sourceVariant
      ) {
        setValidation({
          valid:
            false,

          errors: [
            "Load a source Profile Variant before validating.",
          ],
        });

        return;
      }


      const id =
        cleanString(
          newVariantId
        );

      const location =
        cleanString(
          newLocation
        );

      const jobRole =
        cleanString(
          newJobRole
        );


      const errors =
        [];


      if (!id) {
        errors.push(
          "New Profile Variant ID is required."
        );
      }

      if (
        id &&
        id ===
          cleanString(
            sourceVariant
              ?.profileVariantId
          )
      ) {
        errors.push(
          "New Profile Variant ID must differ from the source Profile Variant ID."
        );
      }

      if (!location) {
        errors.push(
          "Target location is required."
        );
      }

      if (!jobRole) {
        errors.push(
          "Target job role is required."
        );
      }

      if (
        location &&
        jobRole &&
        location ===
          cleanString(
            sourceVariant
              ?.targeting
              ?.location
          ) &&
        jobRole ===
          cleanString(
            sourceVariant
              ?.targeting
              ?.jobRole
          )
      ) {
        errors.push(
          "New targeting is identical to the source Profile Variant's current targeting. Change the location or job role -- otherwise this republish is redundant."
        );
      }


      if (
        errors.length >
        0
      ) {
        setValidation({
          valid:
            false,

          errors,
        });

        return;
      }


      try {
        const draft =
          createProfileDraft({
            draftId:
              `draft_${id}`,

            baseProfileVariantId:
              sourceVariant.profileVariantId,

            targeting: {
              location,
              jobRole,
            },

            content:
              sourceVariant.content,
          });

        const readiness =
          evaluateProfileDraftReadiness(
            draft
          );


        if (
          !readiness.publishable
        ) {
          setValidation({
            valid:
              false,

            errors:
              readiness
                .errors
                .length >
              0
                ? readiness.errors
                : [
                    `Missing targeting: ${readiness.missingTargeting.join(
                      ", "
                    )}.`,
                  ],
          });

          return;
        }


        setValidation({
          valid:
            true,

          draft,

          errors:
            [],
        });
      } catch (
        error
      ) {
        setValidation({
          valid:
            false,

          errors: [
            String(
              error
                ?.message ||
              error
            ),
          ],
        });
      }
    };


  const publishNewVariant =
    async () => {
      if (
        !validation
          ?.valid ||
        !validation.draft ||
        !sourceVariant
      ) {
        return;
      }


      setPublishBusy(
        true
      );

      setPublishError(
        ""
      );

      setPublishResult(
        null
      );


      try {
        const publication =
          await buildProfilePublicationPackage({
            draft:
              validation.draft,

            profileVariantId:
              cleanString(
                newVariantId
              ),

            provenance:
              sourceVariant.provenance ||
              {},

            assetUploads:
              sourceVariant.assets ||
              [],

            readAssetBytes:
              () => {
                throw new Error(
                  "Reused Profile Variant content requires every asset to already exist in storage."
                );
              },
          });


        const result =
          await publishProfilePublication(
            {
              publication,

              readAssetBytes:
                () => {
                  throw new Error(
                    "Reused Profile Variant content requires every asset to already exist in storage."
                  );
                },
            }
          );


        setPublishResult(
          result
        );
      } catch (
        error
      ) {
        setPublishError(
          String(
            error
              ?.message ||
            error
          )
        );
      } finally {
        setPublishBusy(
          false
        );
      }
    };


  const sourceTargetingLabel =
    [
      cleanString(
        sourceVariant
          ?.targeting
          ?.location
      ),

      cleanString(
        sourceVariant
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
          Publish new Profile Variant
        </h3>

        <p className="mt-1 text-xs text-gray-600 dark:text-gray-400 max-w-3xl">
          Reuse an already-published Profile Variant's content under new targeting.
          This publishes a new immutable Profile Variant; it does not activate it or trigger a deployment.
        </p>
      </div>


      <div className="px-6 py-5 space-y-5">
        <div className="space-y-2">
          <label
            htmlFor="profile-variant-publication-source-id"
            className="block text-xs font-semibold text-gray-700 dark:text-gray-300"
          >
            Source Profile Variant ID
          </label>

          <div className="flex flex-col sm:flex-row gap-2">
            <input
              id="profile-variant-publication-source-id"
              value={
                sourceId
              }
              onChange={(
                e
              ) => {
                setSourceId(
                  e.target
                    .value
                );

                setSourceVariant(
                  null
                );

                resetDownstreamState();
              }}
              placeholder="prv_..."
              disabled={
                sourceBusy ||
                publishBusy
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
                loadSourceVariant
              }
              disabled={
                sourceBusy ||
                publishBusy ||
                !cleanString(
                  sourceId
                )
              }
              className={cx(
                "h-10 px-4 rounded-xl border text-xs font-semibold transition",
                "border-purple-500/40 bg-purple-600 text-white hover:bg-purple-700",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              {sourceBusy
                ? "Loading…"
                : "Load source content"}
            </button>
          </div>

          {sourceError ? (
            <div className="text-xs text-red-600 dark:text-red-400 whitespace-pre-wrap break-words">
              {sourceError}
            </div>
          ) : null}
        </div>


        {sourceVariant ? (
          <div className="rounded-xl border border-gray-200/70 dark:border-white/10 bg-gray-50/70 dark:bg-white/5 p-4 space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Source content
            </div>

            <MetadataRow
              label="Profile Variant ID"
              value={
                sourceVariant.profileVariantId
              }
              mono
            />

            <MetadataRow
              label="Current targeting"
              value={
                sourceTargetingLabel
              }
            />
          </div>
        ) : null}


        {sourceVariant ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <label
                  htmlFor="profile-variant-publication-location"
                  className="block text-xs font-semibold text-gray-700 dark:text-gray-300"
                >
                  New target location
                </label>

                <input
                  id="profile-variant-publication-location"
                  list="profile-variant-publication-known-locations"
                  value={
                    newLocation
                  }
                  onChange={(
                    e
                  ) => {
                    setNewLocation(
                      e.target
                        .value
                    );

                    resetDownstreamState();
                  }}
                  disabled={
                    publishBusy
                  }
                  className={cx(
                    "w-full h-10 rounded-xl border px-3 text-sm outline-none",
                    "border-gray-200/70 dark:border-white/10",
                    "bg-white/80 dark:bg-white/10",
                    "text-gray-900 dark:text-gray-100",
                    "focus:ring-2 focus:ring-purple-500/30"
                  )}
                />

                <datalist id="profile-variant-publication-known-locations">
                  {knownLocations.map(
                    (
                      location
                    ) => (
                      <option
                        key={
                          location
                        }
                        value={
                          location
                        }
                      />
                    )
                  )}
                </datalist>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="profile-variant-publication-job-role"
                  className="block text-xs font-semibold text-gray-700 dark:text-gray-300"
                >
                  New target job role
                </label>

                <input
                  id="profile-variant-publication-job-role"
                  list="profile-variant-publication-known-job-roles"
                  value={
                    newJobRole
                  }
                  onChange={(
                    e
                  ) => {
                    setNewJobRole(
                      e.target
                        .value
                    );

                    resetDownstreamState();
                  }}
                  disabled={
                    publishBusy
                  }
                  className={cx(
                    "w-full h-10 rounded-xl border px-3 text-sm outline-none",
                    "border-gray-200/70 dark:border-white/10",
                    "bg-white/80 dark:bg-white/10",
                    "text-gray-900 dark:text-gray-100",
                    "focus:ring-2 focus:ring-purple-500/30"
                  )}
                />

                <datalist id="profile-variant-publication-known-job-roles">
                  {knownJobRoles.map(
                    (
                      jobRole
                    ) => (
                      <option
                        key={
                          jobRole
                        }
                        value={
                          jobRole
                        }
                      />
                    )
                  )}
                </datalist>
              </div>
            </div>


            <div className="space-y-2">
              <label
                htmlFor="profile-variant-publication-new-id"
                className="block text-xs font-semibold text-gray-700 dark:text-gray-300"
              >
                New Profile Variant ID
              </label>

              <input
                id="profile-variant-publication-new-id"
                value={
                  newVariantId
                }
                onChange={(
                  e
                ) => {
                  setNewVariantId(
                    e.target
                      .value
                  );

                  setNewVariantIdTouched(
                    true
                  );

                  resetDownstreamState();
                }}
                disabled={
                  publishBusy
                }
                className={cx(
                  "w-full h-10 rounded-xl border px-3 text-sm font-mono outline-none",
                  "border-gray-200/70 dark:border-white/10",
                  "bg-white/80 dark:bg-white/10",
                  "text-gray-900 dark:text-gray-100",
                  "focus:ring-2 focus:ring-purple-500/30"
                )}
              />

              <div className="text-[11px] text-gray-500 dark:text-gray-400">
                {newVariantIdTouched
                  ? "Edited manually — no longer auto-updates from location/job role."
                  : "Auto-suggested from location + job role. Edit it to override."}
              </div>
            </div>


            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={
                  validateTargeting
                }
                disabled={
                  publishBusy
                }
                className={cx(
                  "h-10 px-4 rounded-xl border text-xs font-semibold transition",
                  "border-gray-300/70 dark:border-white/10",
                  "bg-gray-50/80 dark:bg-white/10",
                  "text-gray-800 dark:text-gray-100",
                  "hover:bg-gray-100 dark:hover:bg-white/15",
                  "disabled:opacity-60"
                )}
              >
                Validate
              </button>

              <button
                type="button"
                onClick={
                  publishNewVariant
                }
                disabled={
                  publishBusy ||
                  !validation
                    ?.valid
                }
                className={cx(
                  "h-10 px-4 rounded-xl border text-xs font-semibold transition",
                  "border-emerald-500/40 bg-emerald-600 text-white hover:bg-emerald-700",
                  "disabled:opacity-60 disabled:cursor-not-allowed"
                )}
              >
                {publishBusy
                  ? "Publishing…"
                  : "Publish new Profile Variant"}
              </button>
            </div>


            {validation &&
            !validation.valid ? (
              <div className="text-xs text-red-600 dark:text-red-400 whitespace-pre-wrap break-words">
                {validation.errors.join(
                  " "
                )}
              </div>
            ) : null}

            {validation
              ?.valid ? (
              <div className="text-xs text-emerald-700 dark:text-emerald-300">
                Ready to publish.
              </div>
            ) : null}
          </div>
        ) : null}


        {publishError ? (
          <div className="text-xs text-red-600 dark:text-red-400 whitespace-pre-wrap break-words">
            {publishError}
          </div>
        ) : null}


        {publishResult ? (
          <div className="rounded-xl border border-emerald-200/70 dark:border-emerald-400/20 bg-emerald-50/50 dark:bg-emerald-500/5 p-4 space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
              {activateDone
                ? "Published & activated"
                : "Published"}
            </div>

            <MetadataRow
              label="New Profile Variant ID"
              value={
                publishResult.profileVariantId
              }
              mono
            />

            <MetadataRow
              label="Content hash"
              value={
                publishResult.contentHash
              }
              mono
            />

            <p className="text-xs text-gray-600 dark:text-gray-400 pt-1">
              {activateDone
                ? "It is now the live Profile."
                : "Not yet active. Activate it now, or from Snapshots → Profile activation later."}
            </p>

            {activateError ? (
              <div className="text-xs text-red-600 dark:text-red-400 whitespace-pre-wrap break-words">
                {
                  activateError
                }
              </div>
            ) : null}

            {missingDeploymentConfig ? (
              <div className="space-y-2">
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  This Profile Variant has never been paired with the active Platform Release. Create that pairing, then activation will work.
                </p>

                <button
                  type="button"
                  onClick={
                    createMissingDeploymentConfig
                  }
                  disabled={
                    createConfigBusy
                  }
                  className="text-xs font-semibold text-purple-600 dark:text-purple-300 hover:underline disabled:opacity-60"
                >
                  {createConfigBusy
                    ? "Creating Deployment Configuration…"
                    : "Create Deployment Configuration"}
                </button>

                {createConfigError ? (
                  <div className="text-xs text-red-600 dark:text-red-400 whitespace-pre-wrap break-words">
                    {
                      createConfigError
                    }
                  </div>
                ) : null}
              </div>
            ) : null}

            {activateConfirming ? (
              <div className="space-y-2">
                <div className="text-xs text-amber-700 dark:text-amber-300">
                  Activate this variant now? This immediately makes it the live Profile for this environment.
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={
                      activateNewVariant
                    }
                    disabled={
                      activateBusy
                    }
                    className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:underline disabled:opacity-60"
                  >
                    {activateBusy
                      ? "Activating…"
                      : "Confirm activate"}
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setActivateConfirming(
                        false
                      )
                    }
                    disabled={
                      activateBusy
                    }
                    className="text-xs font-semibold text-gray-500 dark:text-gray-400 hover:underline disabled:opacity-60"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : !activateDone ? (
              <button
                type="button"
                onClick={() =>
                  setActivateConfirming(
                    true
                  )
                }
                className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:underline"
              >
                Activate Profile Variant
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
