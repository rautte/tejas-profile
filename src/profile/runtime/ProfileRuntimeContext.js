// src/profile/runtime/ProfileRuntimeContext.js

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  fetchActiveProfile,
} from "./activeProfileApi";

import {
  createActiveRuntimeProfile,
  createRepositoryRuntimeProfile,
  resolveRuntimeProfileAsset,
} from "./runtimeProfile";


const REPOSITORY_RUNTIME =
  createRepositoryRuntimeProfile();


const ProfileRuntimeContext =
  createContext(
    null
  );


export function ProfileRuntimeProvider({
  children,

  loadActiveProfile =
    fetchActiveProfile,
}) {
  /**
   * Critical UX behavior:
   *
   * First render is today's repository ProfileContent.
   *
   * We never blank the screen while waiting on the network.
   */
  const [
    runtimeProfile,
    setRuntimeProfile,
  ] =
    useState(
      REPOSITORY_RUNTIME
    );


  const [
    status,
    setStatus,
  ] =
    useState(
      "repository"
    );


  const [
    error,
    setError,
  ] =
    useState(
      null
    );


  const requestIdRef =
    useRef(0);


  const refresh =
    useCallback(
      async ({
        signal,
      } = {}) => {
        const requestId =
          ++requestIdRef.current;


        setStatus(
          "loading"
        );

        setError(
          null
        );


        try {
          const response =
            await loadActiveProfile({
              signal,
            });


          if (
            requestId !==
              requestIdRef.current
          ) {
            return;
          }


          /**
           * Either:
           * - endpoint not configured yet, or
           * - no Profile Variant has ever been activated.
           *
           * Both safely preserve the repository profile.
           */
          if (
            !response
              ?.configured ||
            !response
              ?.active ||
            !response
              ?.variant
          ) {
            setRuntimeProfile(
              REPOSITORY_RUNTIME
            );

            setStatus(
              response?.configured
                ? "repository-no-activation"
                : "repository-unconfigured"
            );

            return;
          }


          const next =
            createActiveRuntimeProfile(
              response
            );


          setRuntimeProfile(
            next
          );

          setStatus(
            "active"
          );
        } catch (
          nextError
        ) {
          if (
            signal
              ?.aborted
          ) {
            return;
          }


          if (
            requestId !==
              requestIdRef.current
          ) {
            return;
          }


          /**
           * Fail safe:
           *
           * A temporary API/network/runtime-validation problem must
           * never make the public portfolio unavailable.
           */
          setRuntimeProfile(
            REPOSITORY_RUNTIME
          );

          setStatus(
            "repository-error"
          );

          setError(
            nextError
          );
        }
      },
      [
        loadActiveProfile,
      ]
    );


  useEffect(
    () => {
        const controller =
        new AbortController();


        refresh({
        signal:
            controller.signal,
        });


        return () => {
        controller.abort();
        };
    },
    [
        refresh,
    ]
    );


  const resolveAsset =
    useCallback(
      (
        assetId
      ) =>
        resolveRuntimeProfileAsset(
          runtimeProfile,
          assetId
        ),
      [
        runtimeProfile,
      ]
    );


  const value =
    useMemo(
      () => ({
        content:
          runtimeProfile
            .content,

        source:
          runtimeProfile
            .source,

        active:
          runtimeProfile
            .active,

        profileVariantId:
          runtimeProfile
            .profileVariantId,

        platformReleaseId:
          runtimeProfile
            .platformReleaseId,

        deploymentConfigurationId:
          runtimeProfile
            .deploymentConfigurationId,

        targeting:
          runtimeProfile
            .targeting,

        status,

        error,

        resolveAsset,

        /**
         * P3.5 will use this after an owner activates another
         * Profile Variant, so the page can refresh without reload.
         */
        refresh,
      }),
      [
        runtimeProfile,
        status,
        error,
        resolveAsset,
        refresh,
      ]
    );


  return (
    <ProfileRuntimeContext.Provider
      value={
        value
      }
    >
      {children}
    </ProfileRuntimeContext.Provider>
  );
}


export function useProfileRuntime() {
  const value =
    useContext(
      ProfileRuntimeContext
    );


  if (!value) {
    throw new Error(
      "useProfileRuntime must be used inside ProfileRuntimeProvider."
    );
  }


  return value;
}