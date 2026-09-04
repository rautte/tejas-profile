// src/components/admin/Settings.js

import {
  useEffect,
  useState,
} from "react";

import {
  FaCog,
} from "react-icons/fa";

import SectionHeader from "../shared/SectionHeader";

import {
  confirmOwnerPasscodeChange,
  requestOwnerPasscodeChange,
} from "../../utils/snapshots/snapshotsApi";

import {
  cx,
} from "../../utils/cx";

import {
  CARD_ROUNDED_2XL,
  CARD_SURFACE,
} from "../../utils/ui";


const MIN_PASSCODE_LENGTH =
  12;

const RESEND_COOLDOWN_SECONDS =
  60;


function OwnerPasscodeChangeCard() {
  const [
    phase,
    setPhase,
  ] =
    useState(
      "idle"
    );

  const [
    requestError,
    setRequestError,
  ] =
    useState(
      ""
    );

  const [
    code,
    setCode,
  ] =
    useState(
      ""
    );

  const [
    newPasscode,
    setNewPasscode,
  ] =
    useState(
      ""
    );

  const [
    confirmPasscode,
    setConfirmPasscode,
  ] =
    useState(
      ""
    );

  const [
    confirmBusy,
    setConfirmBusy,
  ] =
    useState(
      false
    );

  const [
    confirmError,
    setConfirmError,
  ] =
    useState(
      ""
    );

  const [
    resendAvailableAt,
    setResendAvailableAt,
  ] =
    useState(
      0
    );

  const [
    nowTick,
    setNowTick,
  ] =
    useState(
      () => Date.now()
    );

  useEffect(
    () => {
      if (
        !resendAvailableAt ||
        resendAvailableAt <=
          Date.now()
      ) {
        return;
      }

      const id =
        setInterval(
          () =>
            setNowTick(
              Date.now()
            ),
          1000
        );

      return () =>
        clearInterval(
          id
        );
    },
    [
      resendAvailableAt,
    ]
  );

  const resendSecondsLeft =
    Math.max(
      0,
      Math.ceil(
        (
          resendAvailableAt -
          nowTick
        ) /
          1000
      )
    );


  async function handleSendCode() {
    const isResend =
      phase ===
      "awaiting-code";

    setPhase(
      "sending"
    );

    setRequestError(
      ""
    );

    try {
      await requestOwnerPasscodeChange();

      setPhase(
        "awaiting-code"
      );

      setNowTick(
        Date.now()
      );

      setResendAvailableAt(
        Date.now() +
          RESEND_COOLDOWN_SECONDS *
            1000
      );
    } catch (
      error
    ) {
      setRequestError(
        String(
          error
            ?.message ||
          error
        )
      );

      setPhase(
        isResend
          ? "awaiting-code"
          : "idle"
      );
    }
  }


  async function handleConfirm(
    e
  ) {
    e.preventDefault();

    setConfirmError(
      ""
    );

    if (
      newPasscode !==
      confirmPasscode
    ) {
      setConfirmError(
        "New passcode and confirmation do not match."
      );

      return;
    }

    if (
      newPasscode.length <
      MIN_PASSCODE_LENGTH
    ) {
      setConfirmError(
        `New passcode must be at least ${MIN_PASSCODE_LENGTH} characters.`
      );

      return;
    }

    setConfirmBusy(
      true
    );

    try {
      await confirmOwnerPasscodeChange(
        {
          code:
            code.trim(),

          newPasscode,
        }
      );

      setPhase(
        "done"
      );

      setCode(
        ""
      );

      setNewPasscode(
        ""
      );

      setConfirmPasscode(
        ""
      );
    } catch (
      error
    ) {
      setConfirmError(
        String(
          error
            ?.message ||
          error
        )
      );
    } finally {
      setConfirmBusy(
        false
      );
    }
  }


  function startOver() {
    setPhase(
      "idle"
    );

    setRequestError(
      ""
    );

    setConfirmError(
      ""
    );

    setCode(
      ""
    );

    setNewPasscode(
      ""
    );

    setConfirmPasscode(
      ""
    );

    setResendAvailableAt(
      0
    );
  }


  return (
    <div
      className={cx(
        CARD_SURFACE,
        CARD_ROUNDED_2XL,
        "p-6 space-y-4 max-w-xl"
      )}
    >
      <div>
        <h3 className="text-left font-epilogue text-lg font-semibold text-gray-900 dark:text-gray-100">
          Change owner passcode
        </h3>

        <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
          This is the passcode you type when you sign in as owner (Cmd/Ctrl+Shift+O).
          Changing it never affects deploys or CI/CD -- those use a separate credential.
        </p>
      </div>


      {phase ===
      "done" ? (
        <div className="space-y-3">
          <div className="rounded-xl border border-emerald-200/70 dark:border-emerald-400/20 bg-emerald-50/50 dark:bg-emerald-500/5 p-4 text-xs text-emerald-700 dark:text-emerald-300">
            Your owner passcode has been changed. Use the new passcode the next time you sign in.
          </div>

          <button
            type="button"
            onClick={
              startOver
            }
            className="text-xs font-semibold text-purple-600 dark:text-purple-300 hover:underline"
          >
            Done
          </button>
        </div>
      ) : phase ===
        "awaiting-code" ? (
        <form
          onSubmit={
            handleConfirm
          }
          className="space-y-4"
        >
          <p className="text-xs text-gray-600 dark:text-gray-400">
            A 6-digit code was emailed to your owner notification address. It expires in 10 minutes.
          </p>

          <div className="space-y-2">
            <label
              htmlFor="owner-passcode-change-code"
              className="block text-xs font-semibold text-gray-700 dark:text-gray-300"
            >
              Verification code
            </label>

            <input
              id="owner-passcode-change-code"
              value={
                code
              }
              onChange={(
                e
              ) =>
                setCode(
                  e.target
                    .value
                )
              }
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              className="w-full h-10 rounded-xl border border-gray-200/70 dark:border-white/10 bg-white/80 dark:bg-white/10 px-3 text-sm font-mono tracking-widest text-gray-900 dark:text-gray-100 outline-none focus:ring-2 focus:ring-purple-500/30"
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="owner-passcode-change-new"
              className="block text-xs font-semibold text-gray-700 dark:text-gray-300"
            >
              New passcode
            </label>

            <input
              id="owner-passcode-change-new"
              type="password"
              value={
                newPasscode
              }
              onChange={(
                e
              ) =>
                setNewPasscode(
                  e.target
                    .value
                )
              }
              autoComplete="new-password"
              placeholder={`At least ${MIN_PASSCODE_LENGTH} characters`}
              className="w-full h-10 rounded-xl border border-gray-200/70 dark:border-white/10 bg-white/80 dark:bg-white/10 px-3 text-sm text-gray-900 dark:text-gray-100 outline-none focus:ring-2 focus:ring-purple-500/30"
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="owner-passcode-change-confirm"
              className="block text-xs font-semibold text-gray-700 dark:text-gray-300"
            >
              Confirm new passcode
            </label>

            <input
              id="owner-passcode-change-confirm"
              type="password"
              value={
                confirmPasscode
              }
              onChange={(
                e
              ) =>
                setConfirmPasscode(
                  e.target
                    .value
                )
              }
              autoComplete="new-password"
              className="w-full h-10 rounded-xl border border-gray-200/70 dark:border-white/10 bg-white/80 dark:bg-white/10 px-3 text-sm text-gray-900 dark:text-gray-100 outline-none focus:ring-2 focus:ring-purple-500/30"
            />
          </div>

          {confirmError ? (
            <div className="text-xs text-red-600 dark:text-red-400 whitespace-pre-wrap break-words">
              {
                confirmError
              }
            </div>
          ) : null}

          {requestError ? (
            <div className="text-xs text-red-600 dark:text-red-400 whitespace-pre-wrap break-words">
              {
                requestError
              }
            </div>
          ) : null}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={
                confirmBusy ||
                !code.trim() ||
                !newPasscode ||
                !confirmPasscode
              }
              className={cx(
                "h-10 px-4 rounded-xl border text-xs font-semibold transition",
                "border-emerald-500/40 bg-emerald-600 text-white hover:bg-emerald-700",
                "disabled:opacity-60 disabled:cursor-not-allowed"
              )}
            >
              {confirmBusy
                ? "Confirming…"
                : "Confirm change"}
            </button>

            <button
              type="button"
              onClick={
                handleSendCode
              }
              disabled={
                confirmBusy ||
                resendSecondsLeft >
                  0
              }
              className="text-xs font-semibold text-purple-600 dark:text-purple-300 hover:underline disabled:opacity-60"
            >
              {resendSecondsLeft >
              0
                ? `Resend code in ${resendSecondsLeft}s`
                : "Resend code"}
            </button>

            <button
              type="button"
              onClick={
                startOver
              }
              disabled={
                confirmBusy
              }
              className="text-xs font-semibold text-gray-500 dark:text-gray-400 hover:underline disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="space-y-3">
          <button
            type="button"
            onClick={
              handleSendCode
            }
            disabled={
              phase ===
                "sending" ||
              resendSecondsLeft >
                0
            }
            className={cx(
              "h-10 px-4 rounded-xl border text-xs font-semibold transition",
              "border-purple-500/40 bg-purple-600 text-white hover:bg-purple-700",
              "disabled:opacity-60 disabled:cursor-not-allowed"
            )}
          >
            {phase ===
            "sending"
              ? "Sending…"
              : resendSecondsLeft >
                0
              ? `Send verification code (${resendSecondsLeft}s)`
              : "Send verification code"}
          </button>

          {requestError ? (
            <div className="text-xs text-red-600 dark:text-red-400 whitespace-pre-wrap break-words">
              {
                requestError
              }
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}


export default function SettingsAdmin() {
  return (
    <section className="py-0 px-4 transition-colors">
      <SectionHeader
        icon={
          FaCog
        }
        title="Settings"
      />

      <div className="px-6 mt-10 space-y-6">
        <OwnerPasscodeChangeCard />
      </div>
    </section>
  );
}
