# Settings — Feature Guide

The Settings admin section is the owner's self-service surface for rotating the owner login passcode.

For repository deployment procedures, see:

> **[Root README](../../README.md)**

---

## 1. Access

Settings is available only from owner/admin mode:

```text
Admin
→ Settings
```

Public visitors do not use this page.

---

## 2. Mental Model

Two distinct owner credentials exist, and Settings only ever touches one of them:

```text
OWNER_TOKEN (master credential)
    used by CI/CD, GitHub Actions, deploy workflows
    never seen or changed from this UI

owner login passcode
    used to sign in as owner in the browser (Cmd/Ctrl+Shift+O)
    this is what Settings rotates
```

Changing the login passcode never affects deploys, CI/CD, or any automation.

---

## 3. Owner Passcode Change

The flow is a two-step, email-verified rotation:

```text
Send verification code
    ↓
6-digit code emailed to the fixed owner notification address
    ↓
enter code + new passcode + confirmation
    ↓
confirm change
```

The verification code expires 10 minutes after it is sent.

A resend is available after a 60-second cooldown, shown as a live countdown on the button itself.

New passcodes must be at least 12 characters and must match their confirmation field before submission is allowed.

---

## 4. Rate Limiting

The request-change endpoint is rate-limited server-side.

When rate-limited, the backend returns a `retryAfterSeconds` value.

The UI turns this into a live countdown message rather than a static error, so the owner always knows exactly when they can try again.

---

## 5. Recovery Path (Forgot Password)

The same two endpoints this page uses are also reused by the "Forgot password?" link inside the Cmd/Ctrl+Shift+O owner login modal (`src/components/shared/OwnerPasscodeModal.js`).

This is a deliberate design requirement:

```text
recovery must work WITHOUT an existing owner session
```

Because of this, `POST /owner/passcode/request-change` and `POST /owner/passcode/confirm-change` are two of the very few control-plane routes that are reachable without a prior owner session — the owner-auth gate (`requireOwner()`) in the Lambda is positioned intentionally after these two routes, not before them.

Settings itself is still only reachable from inside owner mode; only the passcode-change *endpoints* are exempt from requiring a prior session, and only so recovery is possible in the first place.

---

## 6. Email Delivery

The verification code and any related notifications are sent via SES to a single fixed owner notification address (same address is used as the SES sending identity in both DEV and PROD, since SES sandbox mode requires both sides of a send to be verified).

If a verification email does not arrive, check spam/junk — SES delivery succeeding is not the same as inbox placement, and providers without a DKIM-capable sending domain (the current setup) are more likely to be junked by some mail providers.

---

## 7. Data Model

No dedicated Settings data model exists. State lives in:

```text
Secrets Manager
    tejas-profile/<stage>/owner-login-passcode

DynamoDB (rate limiting / verification-code state)
    Owner Passcode Verification table
```

The login passcode secret is stage-scoped (DEV and PROD have independent passcodes).

---

## 8. DEV vs PROD

DEV and PROD owner login passcodes are independent secrets.

Rotating the passcode in one stage has no effect on the other.

---

## 9. How to Modify

```text
1. Frontend UI:       src/components/admin/Settings.js
2. Shared login/forgot-password UI: src/components/shared/OwnerPasscodeModal.js
3. API client:         src/utils/snapshots/snapshotsApi.js
                        (requestOwnerPasscodeChange, confirmOwnerPasscodeChange)
4. Backend routes:     infra/cdk/lambda/snapshots-handler.ts
                        POST /owner/passcode/request-change
                        POST /owner/passcode/confirm-change
5. Secrets/table wiring: infra/cdk/lib/snapshots-stack.ts
```

---

## 10. Important Invariants

```text
OWNER_TOKEN != owner login passcode

changing the login passcode never affects CI/CD

passcode-change endpoints must remain reachable without a prior
owner session, or recovery becomes impossible

DEV and PROD login passcodes are independent secrets

new passcodes must be at least 12 characters
```

---

## 11. Relevant Source Files

Frontend:

```text
src/components/admin/Settings.js
src/components/shared/OwnerPasscodeModal.js
src/utils/snapshots/snapshotsApi.js
```

Backend:

```text
infra/cdk/lambda/snapshots-handler.ts
infra/cdk/lib/snapshots-stack.ts
```

---

## 12. Related Documentation

> **[Snapshots Feature Guide](./snapshots.md)**

> **[Snapshots and Profile Platform Architecture](../architecture/snapshots-architecture.md)**

> **[Root README](../../README.md)**
