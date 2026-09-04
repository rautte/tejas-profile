import { useEffect, useRef, useState } from "react";
import { cx } from "../../utils/cx";
import {
  confirmOwnerPasscodeChange,
  requestOwnerPasscodeChange,
} from "../../utils/snapshots/snapshotsApi";

const MIN_PASSCODE_LENGTH = 12;
const RESEND_COOLDOWN_SECONDS = 60;

export default function OwnerPasscodeModal({ open, onClose, onSubmit, error }) {
  const [value, setValue] = useState("");
  const inputRef = useRef(null);

  // "login" | "forgot"
  const [mode, setMode] = useState("login");
  // forgot-mode phase: "idle" | "sending" | "awaiting-code" | "done"
  const [forgotPhase, setForgotPhase] = useState("idle");
  const [forgotError, setForgotError] = useState("");
  const [rateLimited, setRateLimited] = useState(false);
  const [recoveredNotice, setRecoveredNotice] = useState(false);
  const [code, setCode] = useState("");
  const [newPasscode, setNewPasscode] = useState("");
  const [confirmPasscode, setConfirmPasscode] = useState("");
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [resendAvailableAt, setResendAvailableAt] = useState(0);
  const [nowTick, setNowTick] = useState(() => Date.now());

  function resetForgotState() {
    setMode("login");
    setForgotPhase("idle");
    setForgotError("");
    setRateLimited(false);
    setCode("");
    setNewPasscode("");
    setConfirmPasscode("");
    setResendAvailableAt(0);
  }

  useEffect(() => {
    if (!resendAvailableAt || resendAvailableAt <= Date.now()) return;
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, [resendAvailableAt]);

  const resendSecondsLeft = Math.max(
    0,
    Math.ceil((resendAvailableAt - nowTick) / 1000)
  );

  const rateLimitMessage =
    rateLimited && resendSecondsLeft > 0
      ? `A code was already sent recently. Try again in ${resendSecondsLeft}s.`
      : "";

  useEffect(() => {
    if (!open) return;
    setValue("");
    resetForgotState();
    setRecoveredNotice(false);
    // focus after mount
    setTimeout(() => inputRef.current?.focus?.(), 0);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onKey = (e) => {
        if (e.key === "Escape") onClose?.();
        if (mode === "login" && e.key === "Enter") onSubmit?.(value.trim());
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, value, mode, onClose, onSubmit]);

  if (!open) return null;

  async function handleSendCode() {
    const isResend = forgotPhase === "awaiting-code";
    setForgotPhase("sending");
    setForgotError("");
    setRateLimited(false);

    try {
      await requestOwnerPasscodeChange();
      setForgotPhase("awaiting-code");
      setNowTick(Date.now());
      setResendAvailableAt(Date.now() + RESEND_COOLDOWN_SECONDS * 1000);
    } catch (e) {
      setForgotPhase(isResend ? "awaiting-code" : "idle");

      if (Number.isFinite(e?.retryAfterSeconds)) {
        setRateLimited(true);
        setNowTick(Date.now());
        setResendAvailableAt(Date.now() + e.retryAfterSeconds * 1000);
      } else {
        setForgotError(String(e?.message || e));
      }
    }
  }

  async function handleConfirm(e) {
    e.preventDefault();
    setForgotError("");

    if (newPasscode !== confirmPasscode) {
      setForgotError("New passcode and confirmation do not match.");
      return;
    }

    if (newPasscode.length < MIN_PASSCODE_LENGTH) {
      setForgotError(`New passcode must be at least ${MIN_PASSCODE_LENGTH} characters.`);
      return;
    }

    setConfirmBusy(true);

    try {
      await confirmOwnerPasscodeChange({ code: code.trim(), newPasscode });
      resetForgotState();
      setRecoveredNotice(true);
      setValue("");
      setTimeout(() => inputRef.current?.focus?.(), 0);
    } catch (e) {
      setForgotError(String(e?.message || e));
    } finally {
      setConfirmBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center px-4">
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-md"
      />

      <div
        className={cx(
          "relative w-full max-w-md rounded-2xl border",
          "border-gray-200/70 dark:border-white/10",
          "bg-white/90 dark:bg-[#0b0b12]/90 backdrop-blur-xl shadow-2xl overflow-hidden"
        )}
      >
        {mode === "login" ? (
          <>
            <div className="px-5 py-4 border-b border-gray-200/70 dark:border-white/10">
              <div className="text-base font-semibold text-gray-900 dark:text-gray-100">
                Enter owner passcode
              </div>
              <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                This enables admin sections for this session only.
              </div>
            </div>

            <div className="px-5 py-4">
              {recoveredNotice && (
                <div className="mb-3 rounded-xl border border-emerald-200/70 dark:border-emerald-400/20 bg-emerald-50/50 dark:bg-emerald-500/5 p-3 text-xs text-emerald-700 dark:text-emerald-300">
                  Your passcode was changed. Sign in with your new passcode below.
                </div>
              )}

              <input
                ref={inputRef}
                type="password"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === "Escape") onClose?.();
                    if (e.key === "Enter") onSubmit?.(value.trim());
                }}
                placeholder="Passcode"
                className="
                  w-full rounded-xl px-4 py-3
                  bg-white/70 dark:bg-white/5
                  border border-gray-200/70 dark:border-white/10
                  text-gray-900 dark:text-gray-100
                  outline-none focus:ring-2 focus:ring-purple-500/50
                "
                autoComplete="current-password"
              />
              {error && (
                <div className="mt-2 text-sm text-red-500">
                    {error}
                </div>
                )}

              <button
                type="button"
                onClick={() => {
                  setRecoveredNotice(false);
                  setMode("forgot");
                }}
                className="mt-3 text-xs font-semibold text-purple-600 dark:text-purple-300 hover:underline"
              >
                Forgot password?
              </button>
            </div>

            <div className="px-5 py-4 border-t border-gray-200/70 dark:border-white/10 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="
                  px-4 py-2 rounded-lg text-sm font-semibold
                  border border-gray-300/70 dark:border-white/10
                  bg-gray-50/80 dark:bg-white/10
                  text-gray-800 dark:text-gray-100
                  hover:bg-gray-100/80 dark:hover:bg-white/15
                "
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => onSubmit?.(value.trim())}
                disabled={!value.trim()}
                className="
                  px-4 py-2 rounded-lg text-sm font-semibold
                  border border-purple-500/40
                  bg-purple-600 text-white hover:bg-purple-700
                  disabled:opacity-60 disabled:cursor-not-allowed
                "
              >
                Unlock
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="px-5 py-4 border-b border-gray-200/70 dark:border-white/10">
              <div className="text-base font-semibold text-gray-900 dark:text-gray-100">
                Reset owner passcode
              </div>
              <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                A 6-digit code will be emailed to your owner notification address.
              </div>
            </div>

            <div className="px-5 py-4 space-y-4">
              {forgotPhase === "idle" && (
                <>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    We'll email a one-time code to your owner notification address.
                    It expires in 10 minutes.
                  </p>
                  {rateLimitMessage ? (
                    <div className="text-sm text-amber-600 dark:text-amber-400">
                      {rateLimitMessage}
                    </div>
                  ) : (
                    forgotError && (
                      <div className="text-sm text-red-500">{forgotError}</div>
                    )
                  )}
                </>
              )}

              {forgotPhase === "sending" && (
                <p className="text-xs text-gray-600 dark:text-gray-400">Sending code…</p>
              )}

              {forgotPhase === "awaiting-code" && (
                <form onSubmit={handleConfirm} className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      A 6-digit code was emailed to your owner notification address.
                      It expires in 10 minutes.
                    </p>
                    <button
                      type="button"
                      onClick={handleSendCode}
                      disabled={resendSecondsLeft > 0}
                      className="shrink-0 text-xs font-semibold text-purple-600 dark:text-purple-300 hover:underline disabled:opacity-60 disabled:no-underline"
                    >
                      {resendSecondsLeft > 0
                        ? `Resend in ${resendSecondsLeft}s`
                        : "Resend code"}
                    </button>
                  </div>

                  <div className="space-y-2">
                    <label
                      htmlFor="owner-forgot-code"
                      className="block text-xs font-semibold text-gray-700 dark:text-gray-300"
                    >
                      Verification code
                    </label>
                    <input
                      id="owner-forgot-code"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      placeholder="123456"
                      className="w-full h-10 rounded-xl border border-gray-200/70 dark:border-white/10 bg-white/80 dark:bg-white/10 px-3 text-sm font-mono tracking-widest text-gray-900 dark:text-gray-100 outline-none focus:ring-2 focus:ring-purple-500/30"
                    />
                  </div>

                  <div className="space-y-2">
                    <label
                      htmlFor="owner-forgot-new"
                      className="block text-xs font-semibold text-gray-700 dark:text-gray-300"
                    >
                      New passcode
                    </label>
                    <input
                      id="owner-forgot-new"
                      type="password"
                      value={newPasscode}
                      onChange={(e) => setNewPasscode(e.target.value)}
                      autoComplete="new-password"
                      placeholder={`At least ${MIN_PASSCODE_LENGTH} characters`}
                      className="w-full h-10 rounded-xl border border-gray-200/70 dark:border-white/10 bg-white/80 dark:bg-white/10 px-3 text-sm text-gray-900 dark:text-gray-100 outline-none focus:ring-2 focus:ring-purple-500/30"
                    />
                  </div>

                  <div className="space-y-2">
                    <label
                      htmlFor="owner-forgot-confirm"
                      className="block text-xs font-semibold text-gray-700 dark:text-gray-300"
                    >
                      Confirm new passcode
                    </label>
                    <input
                      id="owner-forgot-confirm"
                      type="password"
                      value={confirmPasscode}
                      onChange={(e) => setConfirmPasscode(e.target.value)}
                      autoComplete="new-password"
                      className="w-full h-10 rounded-xl border border-gray-200/70 dark:border-white/10 bg-white/80 dark:bg-white/10 px-3 text-sm text-gray-900 dark:text-gray-100 outline-none focus:ring-2 focus:ring-purple-500/30"
                    />
                  </div>

                  {rateLimitMessage ? (
                    <div className="text-sm text-amber-600 dark:text-amber-400">
                      {rateLimitMessage}
                    </div>
                  ) : (
                    forgotError && (
                      <div className="text-sm text-red-500">{forgotError}</div>
                    )
                  )}

                  <button
                    type="submit"
                    disabled={confirmBusy || !code.trim() || !newPasscode || !confirmPasscode}
                    className="
                      w-full px-4 py-2 rounded-lg text-sm font-semibold
                      border border-purple-500/40
                      bg-purple-600 text-white hover:bg-purple-700
                      disabled:opacity-60 disabled:cursor-not-allowed
                    "
                  >
                    {confirmBusy ? "Changing…" : "Change passcode"}
                  </button>
                </form>
              )}
            </div>

            <div className="px-5 py-4 border-t border-gray-200/70 dark:border-white/10 flex justify-between gap-2">
              <button
                type="button"
                onClick={resetForgotState}
                className="text-xs font-semibold text-gray-600 dark:text-gray-400 hover:underline"
              >
                Back to sign in
              </button>

              {forgotPhase === "idle" && (
                <button
                  type="button"
                  onClick={handleSendCode}
                  disabled={resendSecondsLeft > 0}
                  className="
                    px-4 py-2 rounded-lg text-sm font-semibold
                    border border-purple-500/40
                    bg-purple-600 text-white hover:bg-purple-700
                    disabled:opacity-60 disabled:cursor-not-allowed
                  "
                >
                  {resendSecondsLeft > 0
                    ? `Send verification code (${resendSecondsLeft}s)`
                    : "Send verification code"}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
