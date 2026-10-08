# Verification — milestone 3, October 8, 2026

English preference/preview follow-up: user requested English outgoing email and outreach content. Added private OUTREACH_LANGUAGE=english override for future drafts and a draft-only test-preview revision guarded by digest, zero authorization, zero attempts and fixed recipient. Pending preview is English and remains unauthorized; no email sent. English live prompt behavior is implemented, while actual English-model language quality remains unverified until a future live run. Test recipient/content remain in ignored SQLite, not this document or Git.

Real local API preview revision returned success; resulting action remains draft, attempts 0, no campaign authorization, and sending false. Build and 31 tests passed, including English demo output and rejection of stale-digest/attempted-preview edits. Browser visual rendering remains unverified; the exact saved preview is available on the existing Gmail campaign screen.

## Gmail authentication — October 9, 2026 (Asia/Karachi)

Relevant existing Gmail tests: 9 passed, 0 failed (mocked transports only). They cover encrypted storage, state/PKCE, authorization, duplicate dispatch, uncertainty/restart, auth/rate limits and MIME safety. No source/dependency changes were needed; no new build was required for documentation/private configuration updates.

Actual user consent and Web client callback code exchange succeeded at http://localhost:3000/api/gmail/callback. Real POST /api/gmail/check returned HTTP 200 after a Google refresh-token exchange, granting only gmail.send. Setup Gmail status is Verified for authentication; send acceptance/delivery, sender account identity and live revocation are not established by this check. GMAIL_ENABLE_SENDING remains false in private configuration and running state. No real email was sent. Existing single-test preview is available, no test campaign exists, and later sending still requires separate explicit authorization. This supersedes historical missing-OAuth notes below.

## Latest live workflow result (supersedes earlier snapshots below)

Personal app persistence was also verified after stopping/restarting the server: the same two live drafts and completed task returned, Setup workflow status remained Verified, and Gmail sending stayed false. Planning now returns a durable task immediately while generation continues in the background, so UI Pause/Cancel remains available; paused planning has a Resume planning control. Browser visual/keyboard behavior remains unverified.

From commit 2ceb649, reproduced on gemini-3.8-flash: health returned 503 then 200 after a bounded retry; Roman Urdu planning returned 200; single-lead drafting returned three 503s and paused. Same endpoint v1beta/generateContent, concurrency one, JSON Schema, 30-second request timeout and 2,048-token output cap were used. Health payload was 545 bytes, planning 1,087 bytes, draft 837 bytes. The failing draft was smaller than successful planning, so payload size alone is not established as the cause. Earlier uncapped requests also intermittently failed; request complexity was not proven causal.

Official free-tier pricing lists gemini-3.5-flash-lite text input/output free of charge; account metadata returned 200 with generateContent support. Explicitly selected that model in private configuration (visible in Settings), with no fallback/billing change. First reproduction exposed unwanted inferred country filtering; prompt now requires empty unspecified filters. Then actual live verification passed connectivity, minimal Roman Urdu planning, one persisted personalized live draft and the two-lead UAE hardware website-service workflow. Flash-Lite success payloads were 545 bytes (health), 1,255/1,307 bytes (planning) and 837/943/964 bytes (drafts), all HTTP 200. No concurrency or validation was relaxed. Three live drafts were saved in isolated SQLite via the API; that synthetic verification database is removed after checking. The personal app separately completed two labeled sample drafts, with live mode, personalization/service/language validation and sending false. Safe evidence is ignored under test-results/live-ai-verification.json, live-ai-3.8-investigation.json and live-app-verification.json.

Build passed; 29 tests passed. Retry tests cover max attempts, elapsed cap, Retry-After seconds/date and long-delay stop, jitter, cancellation during wait, 503-to-200 success, safe metadata, manual planning resume, no empty-task completion and duplicate prevention. Existing import/persistence/recovery/rate-limit/Gmail boundary checks remain passing. Browser visual/keyboard checks and real Gmail consent/sending remain unverified. No real emails sent; no billing/dependency/browser changes.

Official references: https://ai.google.dev/gemini-api/docs/troubleshooting and https://ai.google.dev/gemini-api/docs/pricing. Successful API calls never prove billing status.

## Live connectivity follow-up (supersedes missing-configuration status below)

The user provided console evidence showing Free tier and explicitly approved private confirmation/data-consent flags. The private configuration is present and remains Git-excluded. This laptop's IPv6 HTTPS route timed out; IPv4-first returned Google responses with normal TLS validation, and this preference is now in normal launchers and the live verification child. Actual model metadata, minimal generation, structured JSON and an exact app health request each returned HTTP 200. Full verification attempts also returned intermittent HTTP 503; small request success is not a full workflow pass. No billing was enabled and no messages were sent. The provider now distinguishes temporary 503 unavailability without retry/fallback; the script reports sanitized planning failures and allows 60 seconds for local startup. Build passed; 25 tests passed, including 503 non-retry and secret-leak prevention.

## Verified locally

Production application at localhost:3000 also passed the guided demo HTTP check: four labeled synthetic leads imported, the two UAE hardware leads selected, two personalized demo drafts saved. Setup reports Configured but unverified for live workflow; sending remains false. Existing data is preserved.

- Guided setup tests cover configuration versus proof, key-change invalidation, callback mismatch, withheld secrets/fingerprints, UAE/industry filtering, four labeled imports/two persisted demo drafts, reopen recovery, idempotency, sample-send blocking and one durable optional test review. No real provider credentials or messages are used.

- `npm.cmd run build`: strict TypeScript check, compiled Node server/tests and Vite production bundle passed. Bundle ~256.5 kB JavaScript (~79.5 kB gzip), ~7 kB CSS.
- `npm.cmd test`: **24 tests passed, 0 failed**. Real HTTP workflows run against both development and production servers using isolated temporary databases. No real messages are sent by tests.
- Foundation: CSV quoted/multiline parsing, bad extension/size/record rejection, mapping, normalization, row errors, duplicate skipping, XLSX formula rejection, persisted chat/draft/source retention across reopen and additive schema migration. Draft supervisor close/reopen recovery, bounded mocked rate-limit retries, pause/cancel during a call, unique request IDs and invalid structured-plan rejection.
- Material foundation fixes: prevent starting unreviewed/in-flight plans; reject invalid pause/resume transitions; private HTTP file blocks plus Vite filesystem deny rules; invalid URL escapes return 400 instead of crashing.
- AI diagnostics (mocked upstream): missing key, invalid/expired key, unavailable model, forbidden access, 429/Retry-After, network failure and allowlist refusal. Provider payloads and secrets are not surfaced. Demo/live remain separate.
- Gmail (mocked transports): encrypted token storage, cookie-bound one-use OAuth state, S256 PKCE, exact send scope, revocation, review digest/limit/consent checks, no dispatch before authorization, accepted-ID persistence, durable duplicate prevention, uncertain timeout/5xx outcomes without resend, restart recovery, 429/401 pauses, in-flight pause behavior, expiry/changed connection blocks and MIME header safety.
- HTTP checks: campaign review persists without sending; real sending/authorization disabled without the private flag; private data/credential/.env paths return 403 in both dev and production; foreign Origin rejected. OAuth/client secrets and tokens are not in state responses.
- `npm.cmd audit`: **0 known vulnerabilities**. No new dependencies, browser binaries, Docker, model weights or paid services were installed for this milestone.
- Secret/private-data exclusions cover .env, data, credentials, uploads, sessions, cache, generated runtime/builds and test evidence. Staged source/docs are checked with `node scripts/verify-staged.mjs` before the local commit.

## Blocked or unverified

- Guided live sample verification is ready for the exact UAE hardware-store instruction and checks persisted personalization/mode. Until a real run passes, the workflow step is not Verified. Google callback registration is not inferred from local matching. GitHub CLI is not installed; Git Credential Manager is present, authentication untested, and no origin has been selected.

- **Live AI blocked:** no .env/Gemini key, unbilled-project attestation or data consent is configured. `node scripts/verify-live.mjs` recorded blocked (exit 2) in ignored `test-results/live-ai-verification.json`. No live model success is claimed. The opt-in script is ready to verify a real Roman Urdu instruction against isolated imported synthetic Karachi/Lahore prospects and check personalization/storage after private setup.
- Official Gemini pricing was rechecked and lists standard gemini-3.8-flash input/output free tier. Account/region/quota availability remains unverified. A successful request cannot prove billing status: inspect AI Studio project tier and Cloud Console billing yourself; keep billing disabled.
- **Gmail account verification blocked:** no Google OAuth client, sender setting or account consent. Actual consent/callback, refresh/revocation, send acceptance/delivery, and provider-specific rate limits are not live-verified. All successful Gmail tests are explicitly simulated. No real recipient was supplied/authorized; no real email was sent. OAuth storage/connection is not labeled a verified send.
- **Browser UX unverified:** Available browser tooling failed to initialize: its kernel exited with a sandbox process-helper error. No new binary was downloaded. Source implementation and a successful build are not a visual/keyboard pass.

## Short manual browser checklist

1. At 375, 768 and 1440 px, inspect all tabs, Gmail previews, forms and navigation; confirm no page horizontal overflow and readable contrast/focus.
2. Enter submits once; Shift+Enter adds a newline; empty/whitespace input never submits. Hold Enter and click rapidly during loading; confirm one chat/task. Test IME Enter finishes composition without submitting.
3. Use only Tab/Shift+Tab/Enter/Space to navigate forms and campaign checkboxes. Verify errors are visible and controls are usable without a mouse.
4. Refresh/reconnect after drafting, pause and campaign review; confirm stored history, progress and action outcomes return. Demo/live is visibly labeled; refresh intentionally defaults back to demo. Do not authorize a real send for this UI check.

## Git and storage

Milestone source/docs committed locally on main; retrieve the exact hash with `git log -1 --oneline`. No remote exists and nothing was pushed/published. Existing Git Credential Manager/author identity was reused; remote authentication is not verified. A per-command safe.directory setting was used for the different sandbox account, without changing global Git trust. README lists private-repository connection commands.

Measured before commit, rounded file sizes (allocation can differ): dependencies ~95 MiB; separate workspace npm cache ~153.5 MiB; dist ~0.25 MiB; compiled runtime ~0.11 MiB; data ~0.35 MiB after labeled guided demo; source/docs/lockfile under 0.4 MiB. Total about 249.7 MiB including the disposable workspace cache. Shared system/browser caches are excluded and were not intentionally changed. Recheck with folder-size tools as data grows.

The sandbox process helper could not start; local verification used reviewed escalation. Windows npm.ps1 remains blocked, so commands use npm.cmd. Existing personal data was not deleted/replaced. Test databases are isolated and removed. The local server must be restarted after source/env changes; run only one process against the personal database. Gmail real sending stays disabled during development.
