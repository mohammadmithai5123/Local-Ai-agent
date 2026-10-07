# Private Gmail setup

Implementation is present. Actual Google consent, token refresh and sending remain unverified because this workspace has no OAuth configuration. Development tests use injected transports and synthetic addresses; no real messages were sent.

Official docs checked October 8, 2026: [OAuth web-server flow](https://developers.google.com/identity/protocols/oauth2/web-server), [Gmail scopes](https://developers.google.com/workspace/gmail/api/auth/scopes), [send endpoint](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/send), [MIME sending](https://developers.google.com/workspace/gmail/api/guides/sending), [errors and limits](https://developers.google.com/workspace/gmail/api/guides/handle-errors). Only `https://www.googleapis.com/auth/gmail.send` is requested. There is no inbox read, Gmail draft management, profile or broad mail scope. Local drafts stay local. This uses documented HTTPS/REST endpoints with built-in Node fetch; no Google SDK bundle was added.

## Configure your own Google project

1. Open [Google Cloud Console](https://console.cloud.google.com/) in your normal browser. Select/create your project and enable **Gmail API**. Keep billing disabled. If a console step asks you to enable billing, stop; this app does not authorize purchases or billing changes.
2. Configure the Google Auth Platform consent screen. For a personal external app, use Testing and add your Google account as a test user. Request only gmail.send. Google's testing/verification and organization restrictions still apply; do not bypass them. Testing refresh tokens may expire after seven days for non-basic scopes; reconnect when required. Production publication/verification is a separate user decision.
3. Create an OAuth client of type **Web application**. Register this exact Authorized redirect URI:

   `http://localhost:3000/api/gmail/callback`

   If PORT changes, register the matching URI. Start the app at **localhost**, not 127.0.0.1, for the OAuth flow so the callback state cookie matches. No out-of-band callback or pasted authorization code is used.
4. Edit `.env` privately. If it does not exist, copy `.env.example`; do not overwrite an existing file. Fill GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GMAIL_SENDER_EMAIL. The sender must be the account you will authorize or one of its verified send-as aliases. Send-only access does not independently read/verify your account email; compare the account shown in Google consent yourself.
5. Leave **GMAIL_ENABLE_SENDING=false** during configuration. Restart the server and open Connections → Connect Google account. Complete the Google sign-in/consent yourself. This grants Gmail sending access and stores tokens locally; it does not send a message. Check authentication to verify a real refresh-token exchange. A saved token or successful refresh is not proof that a send works.

```powershell
Set-Location 'M:\Local Ai agent'
# Only if .env is absent:
Copy-Item .env.example .env
notepad .env
npm.cmd run build
npm.cmd start
```

Secrets must never be pasted into chat. The OAuth callback validates a one-time, ten-minute random state against an HttpOnly SameSite=Lax cookie and uses S256 PKCE. It immediately redirects to `/` without placing authorization codes in the frontend. A restart invalidates pending consent flows; start again.

## Token protection and disconnect

Access/refresh tokens are AES-256-GCM encrypted in `data/credentials/gmail.enc`; the random encryption key is `data/credentials/oauth.key`. Neither tokens nor client secrets are returned by API state. `data/`, `.env`, credential JSON downloads and token files are excluded from Git. The encryption key is on the same laptop, so this does **not** protect against another process/person that can read both files. Use a private Windows account, protected directory permissions and disk encryption. POSIX mode 0600 is requested on writes; Windows inherited ACLs still govern access. Do not share the credentials directory or put it in source/cloud sync. Backups that contain key and ciphertext carry account access.

Disconnect pauses campaigns, removes local token ciphertext, invalidates pending OAuth flows and requests Google token revocation. If revocation cannot be confirmed (network/provider failure), the app says so; remove this app in [Google Account third-party connections](https://myaccount.google.com/connections). Reconnecting creates a new connection identity, so existing campaigns require explicit review/reauthorization before sending. Token corruption can also be cleared with Disconnect.

## Campaign authorization and optional test

When you are ready for a real send later, privately set GMAIL_ENABLE_SENDING=true and restart. This flag alone never authorizes a message.

In Gmail, select saved drafts, set a title and a maximum message count (up to 100), and save the campaign review. Inspect every fixed recipient, subject/body and configured From address. Check the explicit authorization box and press **Authorize and send campaign** only when you intend real delivery. Authorization lasts one hour in the UI (API maximum 24 hours). The count must fit the limit. Sample leads and reserved example domains cannot be sent to. Demo-generated content for real prospects is labeled for review; live AI is not required for user-authorized sending.

The optional single-test form lets you supply a real recipient privately in the app. Saving that form only creates a review. It requires the same explicit one-recipient authorization afterward. **No recipient was supplied or authorized for a real test during this milestone.**

Outcomes are separate: draft, queued, sending, sent, failed, uncertain. `sent` means Gmail accepted the API request, not guaranteed inbox delivery. Gmail message IDs and a stable RFC Message-ID are persisted. One durable action per saved draft, plus unique recipient/subject/body fingerprints across campaigns, prevents accidental duplicate sends. Campaign snapshots do not change when a lead is later edited. Cancelled/failed records remain durable; identical content is blocked from new campaigns. Intentional repeat outreach must be reviewed as distinct content.

Pause/cancel affects subsequent messages. A message already dispatched can still be accepted and is recorded. 429/rate-limit rejections and expired auth pause the campaign without automatic retries. Retry-After is shown when available, otherwise a 30-second fallback; it is not a quota-reset prediction. Fix/check auth or quotas, then resume existing authorization if still valid. Expired authorization or changed sender/account needs explicit reauthorization of remaining items.

Timeout, network loss after dispatch, 5xx, missing success ID, or restart during sending creates **uncertain**. No automatic resend is allowed. With send-only scope the app cannot search Sent, so inspect Gmail manually using the displayed `rfc822msgid:` search and recipient/content/time. Lack of search results alone is not proof of non-delivery. Record your evidence and mark sent or not sent; neither resolution queues a resend. Keep unresolved uncertainty blocked. Automatic reconciliation would require additional read permissions and is deferred.
