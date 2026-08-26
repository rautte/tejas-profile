// src/components/admin/CurrentRuntimeCompositionCard.js

import {
  CARD_ROUNDED_2XL,
  CARD_SURFACE,
} from "../../utils/ui";

import {
  cx,
} from "../../utils/cx";

import {
  Badge,
  cleanString,
  displayValue,
} from "./controlPlaneCatalogUi";


function IdentityCell({
  label,
  value,
  testId,
}) {
  return (
    <div className="rounded-xl border border-gray-200/70 dark:border-white/10 bg-gray-50/70 dark:bg-white/5 px-4 py-3 min-w-0">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {label}
      </div>

      <div
        data-testid={
          testId
        }
        className="mt-1 font-mono text-xs text-gray-800 dark:text-gray-200 break-all"
      >
        {displayValue(
          value
        )}
      </div>
    </div>
  );
}


export default function CurrentRuntimeCompositionCard({
  activeProfileVariantId =
    "",

  activePlatformReleaseId =
    "",

  activeDeploymentConfigurationId =
    "",
}) {
  const profileVariantId =
    cleanString(
      activeProfileVariantId
    );

  const platformReleaseId =
    cleanString(
      activePlatformReleaseId
    );

  const deploymentConfigurationId =
    cleanString(
      activeDeploymentConfigurationId
    );


  const hasProfile =
    Boolean(
      profileVariantId
    );

  const hasPlatform =
    Boolean(
      platformReleaseId
    );

  const hasConfiguration =
    Boolean(
      deploymentConfigurationId
    );


  const inconsistent =
    hasPlatform !==
      hasConfiguration ||
    (
      !hasProfile &&
      (
        hasPlatform ||
        hasConfiguration
      )
    );


  let statusLabel =
    "No formal active composition";

  let statusTone =
    "neutral";


  if (
    inconsistent
  ) {
    statusLabel =
      "Inconsistent runtime identity";

    statusTone =
      "danger";
  } else if (
    hasProfile &&
    hasPlatform &&
    hasConfiguration
  ) {
    statusLabel =
      "Formal composition active";

    statusTone =
      "active";
  } else if (
    hasProfile
  ) {
    statusLabel =
      "Profile active · Platform identity not established";

    statusTone =
      "warning";
  }


  return (
    <div
      className={cx(
        CARD_SURFACE,
        CARD_ROUNDED_2XL
      )}
      data-testid="current-runtime-composition-card"
    >
      <div className="px-6 py-4 border-b border-gray-200/70 dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-left font-epilogue text-lg font-semibold text-gray-900 dark:text-gray-100">
            Current runtime composition
          </h3>

          <p className="mt-1 text-xs text-gray-600 dark:text-gray-400 max-w-3xl">
            Formal identities delivered by the active runtime.
            These values are not inferred from Git SHA, legacy profileVersion, or Snapshot history.
          </p>
        </div>

        <Badge
          tone={
            statusTone
          }
        >
          {statusLabel}
        </Badge>
      </div>


      <div className="px-6 py-5">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <IdentityCell
            label="Profile Variant"
            value={
              profileVariantId
            }
            testId="runtime-profile-variant-id"
          />

          <IdentityCell
            label="Platform Release"
            value={
              platformReleaseId
            }
            testId="runtime-platform-release-id"
          />

          <IdentityCell
            label="Deployment Configuration"
            value={
              deploymentConfigurationId
            }
            testId="runtime-deployment-configuration-id"
          />
        </div>

        {!inconsistent &&
        !hasProfile &&
        !hasPlatform &&
        !hasConfiguration ? (
          <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
            No formal control-plane composition is active in this environment yet.
            These identities populate after a Profile Variant is activated and a
            formal Platform deployment establishes the effective configuration.
          </div>
        ) : null}

        {!inconsistent &&
        hasProfile &&
        !hasPlatform &&
        !hasConfiguration ? (
          <div className="mt-3 text-xs text-amber-700 dark:text-amber-300">
            Profile content is active, but no formal Platform deployment identity
            has been established yet.
          </div>
        ) : null}

        {inconsistent ? (
          <div className="mt-3 text-xs text-red-600 dark:text-red-400">
            The observed formal identities are incomplete or inconsistent.
            No missing identity is inferred from Git SHA, profileVersion, or
            Snapshot history.
          </div>
        ) : null}
      </div>
    </div>
  );
}