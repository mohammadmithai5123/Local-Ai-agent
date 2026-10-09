# Roadmap

October 10 chat fix: the former lead-planner-only Chat now routes live conversation, explicit lead drafts and unsupported tool requests separately. Live greeting/question/unsupported explanation, Roman Urdu one-lead selection and personalized draft persistence passed through the actual dashboard HTTP contract in an isolated database. Restart persistence and duplicate requests passed. Chat mode/progress/error controls are implemented; browser UI execution remains unverified. User reported the layout looks fine without identifying viewport checks. Gmail sending remains disabled; WhatsApp, LinkedIn and voice remain pending.

October 10: user explicitly authorized the selected public GitHub repository, overriding the prior private-only requirement. Source backup may proceed after inspection; local data and credentials remain private. Browser/manual verification, WhatsApp, LinkedIn and voice remain pending.

## Current backup/verification milestone — October 9, 2026

User confirms receipt of the one authorized email; inbox versus spam placement is unspecified. Gmail authentication, one API acceptance and user-confirmed receipt are distinct verified results. Sending is disabled in both running state and private configuration. Historical pending-send notes below are superseded.

Private local data export and non-overwriting restore are implemented and verified against an isolated restored copy, preserving sent IDs and one-attempt history while removing authorization. GitHub authentication works, but the supplied repository is public: push is blocked until private visibility is verified. Browser automation failed at sandbox initialization; responsive/keyboard/IME checks remain unverified pending one-at-a-time manual confirmation. WhatsApp, LinkedIn, voice, hosting and automatic mailbox reconciliation remain pending; the product is not finished.

English outgoing-draft preference and safe revision of an unused, unauthorized single-test preview are implemented. No send is inferred from editing or requesting the sending switch. Exact revised content still requires explicit authorization.

October 9, 2026: actual Gmail Web OAuth consent/callback and refresh authentication verified, using only gmail.send. No email sent; sending stays disabled. Local single-test preview is ready for a later user-supplied recipient and separate authorization. Send acceptance/delivery and live revocation remain unverified.

Latest milestone: bounded single-layer 503 retry, durable paused planning/draft resume, cancel-aware waits/requests, safe stage diagnostics and explicit configurable same-provider Flash-Lite option are implemented. Live Flash-Lite one-lead and small multi-lead Roman Urdu drafts passed; Flash 3.8 drafting was still 503-blocked. Browser and Gmail account/send verification remain pending. No automatic fallback or paid usage.

October 8 connectivity follow-up: permanent IPv4-first launch flags, explicit upstream 503 diagnostics and clearer live verification startup/planning failures are implemented and tested. Actual Google metadata, minimal generation, structured JSON and the exact app health request each returned 200 during diagnosis; full workflow attempts also encountered intermittent 503. Successful small requests do not prove a completed workflow or billing tier.

## Guided setup milestone — implemented, account checks pending

Five evidence-based setup steps, private local instructions/official links, callback diagnostics, bounded UAE hardware sample verification, country/industry import/filter support, persisted receipts and private Git history/tool checks are implemented. Demo workflow is locally verified; live Gemini, Google consent/refresh, optional authorized email, browser UX and private GitHub access remain pending. No new dependencies or integrations were added. WhatsApp and LinkedIn remain deferred.

## Foundation — implemented, demo and local validation

- Responsive React dashboard, guided setup, persistent chat, editable SQLite leads and source tracking.
- CSV/XLSX preview/mapping/validation, skipped errors and duplicates; no executed formulas.
- Gemini free-tier adapter and structured validation, live Flash-Lite sample verification passed. No Groq adapter yet: one provider minimizes setup and dependencies.
- English/Roman Urdu planning (live sample verified); explicitly limited deterministic demo.
- Durable per-lead draft workflow, task controls, restart recovery, bounded rate-limit retries and activity.
- Gmail OAuth/sending integration and campaign ledger are implemented, with actual account consent and send verification blocked on private configuration. WhatsApp/LinkedIn are not implemented.
- Browser layout/IME checks remain unverified because no browser automation surface was available.

## Gmail — implemented, actual account verification blocked

Web OAuth with local callback, state cookie/PKCE, encrypted token files, refresh and revoke/disconnect. Only gmail.send scope. Immutable campaign review, explicit expiring authorization, sender/connection binding, limits, durable per-draft/fingerprint deduplication, Gmail IDs, and distinct draft/queued/sending/sent/failed/uncertain outcomes. Send interruptions require manual reconciliation without automatic resend. Optional one-email review is ready for a later supplied recipient and explicit authorization. Real sending defaults disabled. Local drafts are not Gmail drafts. Account setup/consent and an explicitly authorized live test remain user steps. Automatic Sent reconciliation is deferred because it would expand OAuth permissions.

## WhatsApp — feasibility deferred

Assess official WhatsApp Business Platform/Cloud API eligibility, business number, template approval, opt-in and messaging costs before implementation. Do not promise zero-cost unattended messaging. Consumer WhatsApp Web sessions are not a supported substitute for unrestricted automation; no credential scraping or CAPTCHA bypass. Confirm supported session/authentication rules in current official docs when implementing.

## LinkedIn — feasibility deferred

Review approved APIs, application access and allowed use cases. Do not assume personal outreach or automated invitations are permitted. No scraping, session-cookie extraction or prohibited browser automation. If supported access does not cover a workflow, offer manual draft preparation and handoff.

## Browser and voice — deferred

Only add browser tooling for justified workflows; reuse an installed browser with an isolated automation profile. Local authenticated bridge required for hosted UI to operate laptop resources. Voice: explicit microphone consent, supported-browser speech recognition where available, and typed-input fallback. A provider transcription fallback requires fresh free-tier/cost/privacy verification.

## Hosting — deferred

Measure memory, CPU, database/storage and workload before choosing hosting. Verify current free allowances and resource/time limits; never promise unlimited uptime or messaging. Local workers/browser tasks need the laptop online unless deliberately moved to supported cloud infrastructure. Add authentication and deployment hardening before any remote exposure.
