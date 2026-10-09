# Integration boundaries — October 10, 2026

## Public discovery and costs

Before this change, “search” meant filtering local imported leads. Demo samples and Gemini replies are never public search results. The new explicitly selected adapter uses Tavily's official REST `/search` endpoint with Basic depth, auto-parameters off, no generated answer and at most 20 retrieved sources per request. No SDK or browser crawling is installed. Gemini only classifies intent and extracts facts from retrieved excerpts; its normal free-tier inference is separate from search credits.

[Tavily credits/pricing](https://docs.tavily.com/documentation/api-credits) lists 1,000 credits/month without a credit card; Basic search uses one credit/request. The app caps local reservations at 100/month, counting interrupted calls conservatively, and never enables paid overages or auto-upgrades. This local count cannot establish remaining credits used by other apps or account billing status. Confirm the actual Researcher free plan/no payment method/no paid overages yourself. Provider quota/access errors pause without automatic search retries. Cached retrieved pages are reused after extraction pauses.

[Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing) lists normal Flash-Lite inference free but Search grounding unavailable on the configured 3.5 Flash-Lite free tier. Its paid-tier free allowance is not an unbilled free-tier connection. Grounding was not enabled and the existing Gemini model was preserved.

Private setup: sign in yourself at https://app.tavily.com, keep Researcher Free, no card/paid overages, copy the key directly into local `.env` as `TAVILY_API_KEY`. Set `SEARCH_FREE_TIER_CONFIRMED=true` after console review and `SEARCH_DATA_CONSENT=true` only if country/category queries may go to Tavily and retrieved excerpts to Gemini. Never paste secrets into conversation. Restart the app, resume the paused discovery and inspect actual sources/count. A configured key is not verified search or proof of account billing. No usable search key was present during implementation; live retrieval remains blocked until setup and a real provider run.

## Gmail sending versus filing

Existing Gmail authentication and the one-attempt sent ledger are preserved. Sending stays disabled in this milestone. `gmail.send` does not permit reading, labeling, moving or filing mail. Filing is not implemented and would require a defined feature, justified minimum extra scope and fresh user consent. Chat never authorizes messages; the existing immutable defined-campaign authorization remains mandatory.

## LinkedIn

[Official Community Management access guidance](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/community-management-api-migration-guide) describes product application/review and organization/page prerequisites; it is not unrestricted personal messaging access. [Official Page messaging help](https://www.linkedin.com/help/linkedin/answer/a1469428) says Page admins can message members only after those members message the Page. Partner API access is separate. No approved developer product, eligible organization/page, OAuth grant or account entitlement has been verified for this user. Consequently, personal unattended outreach DMs cannot be promised or implemented here. No LinkedIn account is connected and no account-specific price/permission is inferred. Manual draft handoff remains possible; supported account access must be established before an adapter can perform external actions.

## WhatsApp

Official references: [Cloud API setup](https://developers.facebook.com/docs/whatsapp/cloud-api/get-started), [pricing](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing), [opt-in guidance](https://developers.facebook.com/docs/whatsapp/overview/getting-opt-in/). The developer pages returned HTTP 429 during this audit; no access restrictions were bypassed and no current rate card is claimed verified. No business account/number ownership, permitted templates, opt-ins, app review or zero-paid-cost account path has been verified for this user. A public phone number does not establish WhatsApp availability or outreach consent. Consumer-session scraping is not an alternative. This integration remains disabled pending official eligibility/cost checks and account consent.

The accessible official [Business Platform pricing overview](https://business.whatsapp.com/products/platform-pricing) states per-delivered-message charges vary by market/category, with specific service/response allowances. This does not establish free proactive outreach for this account. The official [Business Messaging Policy](https://business.whatsapp.com/policy) requires recipient opt-in and approved templates for business-initiated conversations, with the defined response window governing free-form replies. Exact account/market rates and technical onboarding remain unverified; no sending path was enabled.

`server/integration-boundaries.ts` provides explicitly disabled status interfaces only, not working connection/send adapters. Voice and remote deployment remain pending.
