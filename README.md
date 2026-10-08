# Outreach Workbench

A local personal web app for importing prospects, planning draft-only tasks in English or Roman Urdu, watching resumable progress, and reviewing explicitly authorized Gmail campaigns. The existing foundation and data are preserved; Gmail storage is additive. Node 22.17.1 and Git were already installed.

## Run locally (PowerShell)

```powershell
Set-Location 'M:\Local Ai agent'
npm.cmd install --cache .npm-cache --no-audit --no-fund
npm.cmd run dev
```

Open http://localhost:3000. The one command compiles the server, then starts the API and Vite. Node 22.13+ is required for built-in SQLite; the experimental SQLite warning on the installed Node version is expected. No SQLite native add-on is downloaded. Server source edits require restart; frontend edits use Vite hot reload. TypeScript compilation replaces tsx because its Windows user-profile lookup failed in the execution sandbox.

For a built application:

```powershell
npm.cmd run build
npm.cmd start
```

Stop the server with Ctrl+C. Do not run multiple servers against the same database. For checks, run `npm.cmd test`. Use `npm.cmd` because this machine's PowerShell execution policy blocks npm.ps1.

## First workflow

Start in **Setup** for five guided steps: free-tier AI, Gmail, draft verification, optional single email and private GitHub. Statuses come from backend evidence, not the presence of keys. Checks record their time; changed private configuration invalidates relevant evidence. Nothing on Setup creates a repository, pushes or sends mail.

Run **Run labeled demo check** to import four clearly labeled synthetic samples and verify the exact UAE hardware-store instruction selects two leads and saves two personalized website-service drafts. This remains demo evidence, never a live pass. Samples are blocked from sending. After private AI setup, run **Check actual AI connection**, then **Run real live sample check**. Inspect Tasks for saved drafts. Map country and industry when importing your own leads for these filters.

1. In Chat, load labeled demo samples, or in Leads upload CSV/XLSX.
2. Map distinct name and email columns. Validate and inspect row errors. Import valid rows; duplicate emails are skipped, never overwritten.
3. Try `Karachi ke 2 leads ke liye outreach drafts banao` in Chat.
4. In Tasks, inspect the selected leads and press Start drafts. Use pause, resume or cancel as needed.
5. Open a lead's saved draft. Nothing has been sent.

Demo is deterministic, not live AI. It recognizes Karachi/Lahore/Islamabad, a numeric limit (default 10, max 100), and common Roman Urdu cues; arbitrary instructions are not interpreted. Live AI supports city/company/country/industry filters and drafts, with server-validated structured responses. Refresh restores database history and progress; server restart pauses unfinished generation for manual review/resume. A plan interrupted by restart is marked failed and must be recreated.

## Private Gemini setup — optional

Official documentation checked October 8, 2026: [pricing](https://ai.google.dev/gemini-api/docs/pricing), [billing](https://ai.google.dev/gemini-api/docs/billing), [rate limits](https://ai.google.dev/gemini-api/docs/rate-limits), [structured output](https://ai.google.dev/gemini-api/docs/structured-output). The current pricing page lists standard `gemini-3.8-flash` text input/output as free tier. Availability is account/region/quota dependent and is not guaranteed.

No account was available in this environment; no live key was used or live health claimed. In [Google AI Studio](https://aistudio.google.com/), verify eligibility and an **unbilled** project. Do not enable billing. Then privately:

```powershell
# Only if .env is absent; preserve existing credentials:
Copy-Item .env.example .env
notepad .env
```

Fill GEMINI_API_KEY in that file. Set FREE_TIER_CONFIRMED=true only after checking billing is disabled. Set AI_DATA_CONSENT=true only if sharing selected lead fields with Gemini is acceptable: free-tier content may be used to improve Google's products. Restart the server, use Setup → Check actual AI connection, then select Live in Settings. The health check performs a small real text request without lead data and consumes quota. No key entry appears in the webpage. No fallback provider or paid API is used.

The API cannot reliably infer billing tier from a key. These local confirmations are the spending boundary: **do not use a key from a billed project**. The app does not manage billing. The model allowlist deliberately permits only the documented model; review official pricing before updating it. Failed live requests never fall back to demo.

Before setting FREE_TIER_CONFIRMED, inspect the selected project's API tier in AI Studio and its Billing page in Google Cloud Console; confirm it has no linked billing account/paid tier. A successful model request cannot establish this. Do not use an account with uncertain billing status. Connection diagnostics distinguish missing key, consent required, invalid/expired key, unavailable model, access restrictions, rate limit and network failure without returning provider payloads or secrets.

After private configuration, run this opt-in real check:

```powershell
npm.cmd run build
node scripts/verify-live.mjs
```

It performs real Gemini requests and consumes free quota, using two synthetic prospects imported into an isolated temporary database. It checks a Roman Urdu instruction selects Karachi rather than Lahore and saves an Ayesha/Harbor personalized draft. It also verifies the exact UAE hardware-store instruction with four isolated labeled samples and two persisted website-service drafts. It never sends mail or changes your personal database. Evidence is in ignored `test-results/live-ai-verification.json`. Missing configuration produces `blocked` (exit 2), not success. A failure or rate limit is reported honestly; no automatic fallback is used. Separately review language quality with your actual prospects after setup.

## Gmail setup and campaigns

See [GMAIL_SETUP.md](GMAIL_SETUP.md) for exact Google console, private `.env`, callback, scope, token protection, disconnect and single-test instructions. Configure OAuth Web application credentials and `GMAIL_SENDER_EMAIL`, register `http://localhost:3000/api/gmail/callback`, then connect and consent yourself. Keep `GMAIL_ENABLE_SENDING=false` during setup. No account was connected and no real message was sent during development.

The Gmail screen snapshots selected drafts and recipients, shows complete subject/body previews, and requires an explicit campaign authorization with a maximum count and expiry. Real sending additionally needs `GMAIL_ENABLE_SENDING=true`. Merely enabling the flag, connecting OAuth, saving a campaign or creating a single-test review does not authorize delivery. Only gmail.send scope is used; drafts are local and the app cannot read Sent. Uncertain outcomes must be manually reconciled and are never automatically resent. Sent means accepted by Gmail, not guaranteed delivery. WhatsApp and LinkedIn remain unimplemented.

## Import and storage

CSV must have a header, UTF-8 encoding and consistent column counts. XLSX uses its first worksheet. Limit: 2 MB uploaded, 1,000 data rows, 50 columns, 2,000 characters per cell. XLSX decompression is limited to 20 MB from ZIP directory metadata. This is a local input guard, not a hardened public file-processing sandbox. Formula cells and formula-like leading `=`, `+`, `@` mapped values are rejected. No formulas, links or macros are executed. CSV row numbers count parsed records; multiline cells mean these may differ from physical line numbers.

Previews remain in memory for 15 minutes, capped at 10. They disappear on restart; original files are not written to disk. SQLite in `data/workbench.sqlite` stores leads, source filename, chat, tasks, per-lead attempts, drafts, campaign/action ledgers and activity. Editing a lead affects subsequent draft generation; task recipient IDs remain fixed and reviewed Gmail recipient/content snapshots are immutable. Notes are stored locally and included only in live per-lead draft requests; email is not needed in AI prompts. Back up the data folder while the server is stopped. The database is not encrypted; protect the Windows account and disk. OAuth tokens use encrypted local files as described in GMAIL_SETUP.md. Mode selection resets to demo on page refresh.

## Troubleshooting

- Permission error with npm's shared cache: use the command above with the workspace `.npm-cache`.
- Port occupied: privately set PORT=3001 in .env and restart. Open the matching localhost URL.
- Live option disabled: check all three configuration values and restart. Keys are never sent to the browser.
- 429: generation pauses until Retry-After, or a 30-second bounded fallback. After three attempts it needs your help; check quota before manual resume. The retry time is not a quota-reset prediction.
- Planning failures: review the task and connection; create a new request. Plans are not retried automatically.
- No selected leads: check city/company filters or import records first.
- `.env` changes require restart. `npm.cmd start` requires a successful build.
- Browser verification was unavailable in this tool environment; see VERIFICATION.md for checks and limitations.

## GitHub

The Setup screen inspects installed tooling, tracked files and reachable history with `node scripts/verify-history.mjs`. GitHub CLI is unavailable here; installed Git Credential Manager is not proof of authentication. No origin exists. Supply an existing private repository URL or create one with **Private** selected at https://github.com/new. Without GitHub CLI, the app honestly leaves repository privacy unverified; inspect its visibility in GitHub yourself. Do not put credentials in its URL. The check never pushes; verify a later push using `git ls-remote origin refs/heads/main` against `git rev-parse HEAD`.

Source and documentation only belong in Git. Git Credential Manager is installed, but account authentication was not exercised. No repository was published and no remote was supplied. After creating a **private** GitHub repository yourself, review files and connect:

```powershell
git status --short
git remote add origin https://github.com/YOUR_ACCOUNT/YOUR_PRIVATE_REPOSITORY.git
git push -u origin main
```

The local milestone is committed; inspect `git log -1` and `git status` before connecting. Authenticate through Git Credential Manager's supported browser flow. Never put a token in a remote URL. Publishing/pushing remains a user step; review exclusions first. Future staging can be checked with `node scripts/verify-staged.mjs`; it scans staged paths, credential patterns and placeholder values without printing their contents. This is a targeted check, not a guarantee against every secret format.
