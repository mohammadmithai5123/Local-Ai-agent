# Verification — milestone 2, October 8, 2026

## Verified locally

- `npm.cmd run build`: strict TypeScript check, compiled Node server/tests and Vite production bundle passed. Bundle ~248 kB JavaScript (~77 kB gzip), ~6.7 kB CSS.
- `npm.cmd test`: **20 tests passed, 0 failed**. Real HTTP workflows run against both development and production servers using isolated temporary databases. No real messages are sent by tests.
- Foundation: CSV quoted/multiline parsing, bad extension/size/record rejection, mapping, normalization, row errors, duplicate skipping, XLSX formula rejection, persisted chat/draft/source retention across reopen and additive schema migration. Draft supervisor close/reopen recovery, bounded mocked rate-limit retries, pause/cancel during a call, unique request IDs and invalid structured-plan rejection.
- Material foundation fixes: prevent starting unreviewed/in-flight plans; reject invalid pause/resume transitions; private HTTP file blocks plus Vite filesystem deny rules; invalid URL escapes return 400 instead of crashing.
- AI diagnostics (mocked upstream): missing key, invalid/expired key, unavailable model, forbidden access, 429/Retry-After, network failure and allowlist refusal. Provider payloads and secrets are not surfaced. Demo/live remain separate.
- Gmail (mocked transports): encrypted token storage, cookie-bound one-use OAuth state, S256 PKCE, exact send scope, revocation, review digest/limit/consent checks, no dispatch before authorization, accepted-ID persistence, durable duplicate prevention, uncertain timeout/5xx outcomes without resend, restart recovery, 429/401 pauses, in-flight pause behavior, expiry/changed connection blocks and MIME header safety.
- HTTP checks: campaign review persists without sending; real sending/authorization disabled without the private flag; private data/credential/.env paths return 403 in both dev and production; foreign Origin rejected. OAuth/client secrets and tokens are not in state responses.
- `npm.cmd audit`: **0 known vulnerabilities**. No new dependencies, browser binaries, Docker, model weights or paid services were installed for this milestone.
- Secret/private-data exclusions cover .env, data, credentials, uploads, sessions, cache, generated runtime/builds and test evidence. Staged source/docs are checked with `node scripts/verify-staged.mjs` before the local commit.

## Blocked or unverified

- **Live AI blocked:** no .env/Gemini key, unbilled-project attestation or data consent is configured. `node scripts/verify-live.mjs` recorded blocked (exit 2) in ignored `test-results/live-ai-verification.json`. No live model success is claimed. The opt-in script is ready to verify a real Roman Urdu instruction against isolated imported synthetic Karachi/Lahore prospects and check personalization/storage after private setup.
- Official Gemini pricing was rechecked and lists standard gemini-3.8-flash input/output free tier. Account/region/quota availability remains unverified. A successful request cannot prove billing status: inspect AI Studio project tier and Cloud Console billing yourself; keep billing disabled.
- **Gmail account verification blocked:** no Google OAuth client, sender setting or account consent. Actual consent/callback, refresh/revocation, send acceptance/delivery, and provider-specific rate limits are not live-verified. All successful Gmail tests are explicitly simulated. No real recipient was supplied/authorized; no real email was sent. OAuth storage/connection is not labeled a verified send.
- **Browser UX unverified:** `cua.getState()` returned no apps/browsers. No new binary was downloaded. Source implementation and a successful build are not a visual/keyboard pass.

## Short manual browser checklist

1. At 375, 768 and 1440 px, inspect all tabs, Gmail previews, forms and navigation; confirm no page horizontal overflow and readable contrast/focus.
2. Enter submits once; Shift+Enter adds a newline; empty/whitespace input never submits. Hold Enter and click rapidly during loading; confirm one chat/task. Test IME Enter finishes composition without submitting.
3. Use only Tab/Shift+Tab/Enter/Space to navigate forms and campaign checkboxes. Verify errors are visible and controls are usable without a mouse.
4. Refresh/reconnect after drafting, pause and campaign review; confirm stored history, progress and action outcomes return. Demo/live is visibly labeled; refresh intentionally defaults back to demo. Do not authorize a real send for this UI check.

## Git and storage

Milestone source/docs committed locally on main; retrieve the exact hash with `git log -1 --oneline`. No remote exists and nothing was pushed/published. Existing Git Credential Manager/author identity was reused; remote authentication is not verified. A per-command safe.directory setting was used for the different sandbox account, without changing global Git trust. README lists private-repository connection commands.

Measured before commit, rounded file sizes (allocation can differ): dependencies ~95 MiB; separate workspace npm cache ~153.5 MiB; dist ~0.24 MiB; compiled runtime ~0.08 MiB; data ~0.12 MiB before additive tables; source/docs/lockfile under 0.4 MiB. Total about 249 MiB including the disposable workspace cache. Shared system/browser caches are excluded and were not intentionally changed. Recheck with folder-size tools as data grows.

The sandbox process helper could not start; local verification used reviewed escalation. Windows npm.ps1 remains blocked, so commands use npm.cmd. Existing personal data was not deleted/replaced. Test databases are isolated and removed. The local server must be restarted after source/env changes; run only one process against the personal database. Gmail real sending stays disabled during development.
