# WhatsApp setup — zero-paid-budget scope

Official documentation checked October 12, 2026. Is milestone mein automatic WhatsApp sending implement/enabled nahi hai. Koi message send nahi hua.

## Kaunsa WhatsApp product?

| Product | Is app mein supported behavior | Cost/access boundary |
| --- | --- | --- |
| Personal WhatsApp | User manually approved preview ko apne client mein review kar sakta hai | Consumer account ko unattended API/session automation mein convert nahi karte; unofficial libraries/QR scraping nahi |
| WhatsApp Business App | User-assisted one-to-one review/handoff | Business app aur Business Platform alag hain. Paid features, ads, subscription ya billing enable nahi karte; normal connectivity costs ho sakti hain |
| Meta Cloud API development/test assets | Optional server-side read-only phone-asset access check | Official Developer Hub free test numbers/sandbox advertise karta hai. Sirf Meta-provided test assets; account ke current allowed recipients/limits console mein confirm honge |
| Cloud API production | Blocked / automatic sending not implemented | Meta business portfolio, WABA, permitted business number/token, permissions and applicable verification/access reviews required. Proactive business outreach ke templates, recipient opt-in aur message pricing apply hoti hai; free unlimited outreach promise nahi |

[Official Developer Hub](https://whatsappbusiness.com/developers/developer-hub/) explicitly offers free testing. [Meta's official Cloud API collection](https://www.postman.com/meta/whatsapp-business-platform/collection/wlk6lh4/whatsapp-cloud-api) describes business portfolio/WABA/business-number requirements and token permissions/lifetimes. Consumer WhatsApp or the Business App alone is not a Cloud API connection. Do not delete/migrate your existing personal/business number for this test; supported coexistence/production onboarding eligibility has not been checked for this account.

[Official pricing overview](https://whatsappbusiness.com/products/platform-pricing/) describes per-delivered-message market/category pricing and specific response/free-entry allowances. Its accessible overview describes service responses and qualifying utility responses as uncharged within the customer-service context. The versioned developer pricing/rate-card pages returned HTTP 429 during this audit; exact current regional rates, dated allowance changes and account eligibility remain unverified. Do not rely on an old free allowance or assume API success proves no billing. This app implements no production send transport, allowance counter or paid fallback. Any request for a payment method is a stop condition for our selected test setup.

[Official Business Messaging Policy](https://whatsappbusiness.com/policy/) requires recipient permission, opt-out handling and appropriate business identity. Platform-initiated conversations use approved templates; free-form replies require an open 24-hour customer-service window. An AI preview is not an approved template. A public directory phone is neither WhatsApp availability nor consent. Sandbox access is development access, not production permission, and its currently allowed recipient list must be verified privately in Meta. Exact current test quota was not independently retrievable; no unlimited-test claim is made.

## Abhi bina Meta account setup ke kya kar sakte hain?

1. Leads ki row ya saved company-result row par **WhatsApp preview** choose karein. Sirf woh ek context use hota hai; koi extra search nahi hoti.
2. Recipient country khud select karein. Local digits ya full +country number dein. Other ke liye + required hai. Pakistan/UAE/India/UK/US-Canada ke conservative format/length rules hain. Yeh active account, carrier ya deliverability check nahi.
3. Offer/instruction likhein. Live mode existing consented Gemini/model/retry budget use karta hai aur final message English mein banata hai, Roman Urdu instruction ke bawajood. Exact recipient phone/email/model ko nahi bhejte; ek selected name/company/location/industry/public source context aur aapki instruction bhejte hain. Demo visibly labeled hai aur handoff disabled hai.
4. Saved **Prepared — not submitted** preview ko Chat mein review karein. API sending permanently disabled in this implementation; Gemini text cannot authorize anything.
5. Actual recipient opt-in hone par exact number/body-bound consent checkbox se **Prepare manual handoff** kar sakte hain. Yeh local wa.me link banata hai, send nahi karta. Agla **Open WhatsApp manually** click recipient aur text WhatsApp ko prefill ke liye share karta hai. Account/sender aap WhatsApp mein khud choose/verify karte hain. Recipient/body edit wahan karne par original preview ka outcome report na karein.
6. Send button aap khud outside this app press karte hain. Sirf exact reviewed message ke liye truthful manual outcome record karein: Submitted manually, receipt Confirmed by user, Uncertain, ya verified not-sent/closed. Opening a link is not submission; API acceptance/webhook evidence is never inferred. Uncertain outcomes have no handoff/resend path. App cannot stop duplicates you manually send outside it.

Repeated preparation with the same recipient/context/instruction/mode returns the original task. Identical recipient/body from different requests is suppressed. Saved preview content/recipient is immutable; changed content requires a new preview. Refresh restores progress/reports. AI quota pauses need manual Resume, honoring known retry timing and never inventing a reset. Pause/cancel stops further generation and discards late output. Gmail sending stays false independently.

## Optional official test setup — aik step at a time

**Pehla action:** [Meta Developers](https://developers.facebook.com/apps/) par khud login karein. Sirf non-secret result “Login complete” ya exact non-secret blocker report karein. Password/OTP/token chat mein mat dein. App permissions/consent aap khud approve karenge. Manual-only workflow ke liye yeh setup zaroori nahi.

Login ke baad agle steps, jab aap ready hon:

1. Existing suitable developer app use karein ya WhatsApp business-messaging use case ke saath app banayein; business portfolio/WABA prompts ko khud review karein. Sirf provided development test number tak rahein. Production registration, existing number migration, payment method/billing ya paid partner signup mat karein.
2. WhatsApp API Setup/Getting Started mein Meta-provided test number aur test Phone Number ID identify karein. Current allowed-recipient list/limits wahin check karein; apna controlled test recipient number Meta mein khud verify karein. OTP chat mein nahi. **Send Message button mat dabayein**; is milestone mein koi send authorization nahi hai.
3. Token directly private local .env mein save karein. Existing .env ko replace na karein. Exact implemented settings:

~~~dotenv
WHATSAPP_TEST_ACCESS_TOKEN=
WHATSAPP_TEST_PHONE_NUMBER_ID=
WHATSAPP_GRAPH_VERSION=
WHATSAPP_TEST_ASSET_CONFIRMED=false
WHATSAPP_TEST_NO_BILLING_CONFIRMED=false
WHATSAPP_TEST_DATA_CONSENT=false
~~~

WHATSAPP_GRAPH_VERSION mein apne app dashboard ka supported vNN.0 version copy karein; app version silently choose/update nahi karti. WHATSAPP_TEST_ACCESS_TOKEN is server-only temporary/user test token; official collection says dashboard user tokens typically expire after 24 hours. Regenerate privately when needed. Metadata reading uses WhatsApp business-management access to your own phone asset; do not request business_management portfolio access or unrelated scopes. Dashboard's supplied test token may already include whatsapp_business_messaging; this app does not use it to send. Sender identity/production approval remains unverified.

WHATSAPP_TEST_ASSET_CONFIRMED=true sirf tab jab console confirms provided TEST asset (not production). WHATSAPP_TEST_NO_BILLING_CONFIRMED=true sirf tab jab test path no payment/billing require karta ho; this local attestation is not provider-established billing proof. WHATSAPP_TEST_DATA_CONSENT=true means you allow a read-only request sending token in Authorization header, Graph version and phone-asset ID to Meta (plus normal network metadata). No imported lead database, recipient message/body or phone is sent to Meta by the access check. Keep all three false until you personally confirm them.

4. App restart ke baad Connections → WhatsApp → **Check test asset access**. Backend does one bounded GET of id/display_phone_number, validates the expected phone asset and stores configuration-bound evidence. It does not register numbers, send messages, debug tokens via query strings, subscribe webhooks or enable billing. Configured but unverified is separate from verified read access. Verified read access cannot prove test/no-billing eligibility, sending permission, template approval or delivery.
5. Disconnect: **Clear local test verification** removes the local receipt only. Remove the token privately from .env, revoke it in Meta's token/app settings yourself and restart. Changing token/asset/version/flags invalidates old evidence. Never paste token into this conversation or a public issue.

API send/test-send is not implemented in this milestone. A later test would require an exact preview of sender/test recipient/template or permitted content, your explicit once-only authorization and a separately reviewed test-only transport. No present UI action or flag sends it. Production pricing/permission access and public HTTPS webhook setup remain blockers; this loopback application is not exposed or tunneled. Manual reports are not webhook-confirmed outcomes.

## Local storage and recovery

WhatsApp preview/context/recipient and user-reported outcomes are private SQLite records, excluded from Git. Backup schema v3 includes them, excluding tokens/configuration receipts; old v1/v2 backups remain supported. Restore always creates a new database, pauses unfinished tasks and quarantines previously prepared manual handoff links as Uncertain for reconciliation, never reopening/sending automatically. Existing result CSV snapshots and email drafts/ledger are unchanged.
