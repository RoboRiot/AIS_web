# AIS AI search visibility: implementation and measurement

Prepared October 22, 2026. Status: changes built and tested locally; not published.

## What we are improving

Help facilities find and accurately evaluate Advanced Imaging Services for MRI/CT equipment service and mobile trailer rentals when an assistant searches the web. Success means relevant citations, qualified inquiries, and accurate answers. There is no guaranteed first position across ChatGPT, Claude, Grok, Copilot, Gemini, or Perplexity; answers vary by question, location, search mode, and time.

| Buyer intent | Canonical destination |
| --- | --- |
| MRI scanner service, repair, preventive maintenance | `/services/mri-service` |
| CT scanner service, repair, preventive maintenance | `/services/ct-service` |
| Mobile MRI trailer rental or lease | `/trailers/mobile-mri-trailer-rental` |
| Mobile CT trailer rental or lease | `/trailers/mobile-ct-trailer-rental` |
| Compare equipment service options | `/services` |
| Compare mobile rental modalities | `/trailers` |

Use these canonical routes in new content and reports. Older `/services/mobile-*-trailer-*` URLs redirect; they are not separate optimization targets.

## Verified baseline before publication

- Public `robots.txt`: HTTP 200, `User-Agent: *`, `Allow: /`, canonical sitemap link. Search crawlers are already allowed by the file; no access-policy change was necessary. This does not prove an actual crawler reached the server or rule out IP-specific firewall blocking.
- The four priority pages and sitemap returned HTTP 200 on live release `996f7cf686d3-mvjz0v36` with no `X-Robots-Tag` header. Public search returned the relevant AIS URLs for all four buyer-intent queries below. This is discoverability evidence, not an assistant ranking/citation test.
- Signed-in Google Search Console for `advancedimagingparts.com`: Settings > Search generative AI showed **Include**. No account setting was changed.
- Its Generative AI features report showed **6.62K total impressions** for July 21-October 20, 2026 (3-month view). Visible page rows included the home page (417), services hub (132), Siemens MRI service (46), and trailers hub (41). Sitewide impressions include parts pages and must not be called MRI/CT service leads, ChatGPT visits, or results of today's changes.
- Existing read-only marketing report for September 22-October 21, 2026, UTC: `chatgpt.com` had **8 tracked visitors, 20 page views, zero recorded accepted inquiries**, grouped as `other_campaign`. The bounded report was not truncated. Missing referrers, consent limits, off-site calls, and untagged visits mean this is not a complete count of AI influence.
- Google also displayed an existing Product snippets eligibility issue. That is separate from service/rental discovery; do not fabricate prices, reviews, or availability to qualify quote-only parts pages.

## Implemented locally

1. Added concise company/modality summaries, service facts, and five visible questions and answers on each of the 12 existing service pages. The same answer data generates FAQPage JSON-LD. The content explains scope, geography, request information, remote support, and quotes; it does not invent response deadlines or new model coverage.
2. Added contextual links from service pages to the matching rental modality. Existing rental FAQs, price conditions, sitemap membership, and canonical URLs remain in place.
3. Made rental introductions name AIS and the facility use case directly, with location/date availability confirmation. No fleet prices or availability were changed.
4. Aligned default metadata, organization description/aliases, and visible footer copy around equipment service, parts, and trailer rentals. Kept the existing organization ID, address, and phone.
5. Added `ai_referral` to the shared attribution classifier for identifiable ChatGPT, Claude, Grok, Perplexity, Copilot, and Gemini hosts or explicit source tags. Existing consent/privacy rules apply. Paid and explicit email/social/outreach attribution retain priority. General Google, Bing, and X traffic is not presumed to be AI.
6. Added `scripts/verify-ai-discovery.mjs` to check all 24 service/rental pages over HTTP: canonical URLs, one H1, indexability, provider identity, valid JSON-LD, and structured answers present in server HTML. It reports the release and page hashes. It does not validate rankings or actual crawler access.

Historical event classifications are not rewritten. Existing browser sessions may keep their original classification until a new session/campaign. AI citations with no click cannot be measured by referral tracking, and AI traffic without a recognizable source may remain direct/referral. The change does not configure custom GA4 channel groups.

## Validation

- `npm.cmd test`: 111 tests passed, including source spoofing, paid priority, attribution persistence, lead normalization, privacy, and reporting regressions.
- `npm.cmd run lint`: passed.
- Production build `ai-discovery-20261022`: succeeded; 117 rendered files and 62 static references verified by the existing release script.
- `node scripts/verify-ai-discovery.mjs http://127.0.0.1:3022`: 24/24 pages passed; FAQ answers match server-rendered text.
- Chrome preview of the exact production build: MRI service, CT service, MRI rental, and CT rental rendered; service FAQ anchors and service-to-rental links worked. FAQ and rental layouts were visually inspected. Captured browser error/warning logs were empty during those checks. On a later CT preview, reCAPTCHA displayed a connection warning; local CAPTCHA operation and form delivery are not verified. No forms were submitted. Mobile-specific layout and post-publication behavior are not claimed as verified.
- Local supporting evidence is in `.tmp/ai-search-2026-10-22/` (`baseline.json`, `render-validation.json`, `build.log`, `ct-service-preview.jpg`). The build is in `.next-releases/ai-discovery-20261022`; the current local release pointer was not switched.

## Publication and the next 30 days

1. Publish the reviewed AIS website candidate through the normal authorized release process, retaining the previous release. Recheck live release headers/assets, all four priority pages, links, browser errors, and crawler-facing HTML. Do not use the DigitalOcean web console or remote execution without the user's required authorization. This work does not change or deploy Magmo.
2. After publication, inspect the four canonical URLs in Google Search Console and Bing Webmaster Tools. Confirm sitemap processing and Bing indexing, then request recrawl for changed URLs through the normal tools. Review Bing AI Performance if available. IndexNow is an optional later integration; no key, submission, or integration was created here.
3. Confirm consistent company name, website, address, phone, and real service scope on Google Business Profile, Bing Places, LinkedIn, and existing legitimate imaging-industry listings. Public results show conflicting historical company-age/contact facts. Resolve from company records before editing external listings; do not create invented regional offices or bulk directory submissions.
4. Prepare two evidence-based case studies: an MRI/CT repair and an interim trailer deployment. Use approved photos and verifiable equipment, problem, service scope, and outcome. Obtain permission for customer names, quotes, or identifying facility details. Do not publish internal work orders or patient information.
5. Review on deployment day, day 14, and day 30. Compare the same questions and date windows; review again around day 60 if data is sparse. This is a suggested cadence, not a scheduled automation.

## Measurement protocol

Use these fixed questions in new, neutral search-enabled conversations on ChatGPT, Claude, Grok, Copilot, Gemini, and Perplexity, where access exists:

- Which companies provide MRI scanner maintenance and repair in the United States?
- Which companies service CT scanners for hospitals and imaging centers?
- Where can a hospital rent a mobile MRI trailer during a renovation?
- Who offers mobile CT trailer rentals for scanner downtime?
- What should we prepare before requesting a mobile MRI or CT rental quote?
- For a planned scanner replacement, how do we compare equipment repair and an interim mobile trailer?

Record date, assistant, visible model/search mode, geographic context, exact question, whether AIS is mentioned, whether a link actually cites AIS, cited URL, competing sources, and factual errors. Do not prepend AIS's name to discovery tests or count a forced mention as an unsolicited recommendation. Keep branded fact-check questions separate. Repeat checks because a single answer is not a stable ranking.

Track separately: Google AI impressions by priority URL; Bing citation counts/cited URLs; identifiable AI visitors; accepted inquiries; reviewed qualified leads; quotes and rentals won. Count only confirmed server lead events and reviewed qualification. Phone/email clicks are not completed inquiries. Baseline public search-tool queries used on October 22 were `MRI scanner service repair provider USA`, `CT scanner service repair provider USA`, `mobile MRI trailer rental nationwide`, and `mobile CT trailer rental nationwide`; AIS appeared in the returned sample for each.

## Source basis and limits

- [OpenAI crawler documentation](https://developers.openai.com/api/docs/bots): OAI-SearchBot governs ChatGPT search discovery; GPTBot is a separate training control. Allowing training is not a ranking strategy.
- [Anthropic crawler documentation](https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler): Claude-SearchBot and Claude-User support search/retrieval; ClaudeBot serves training purposes.
- [Google AI optimization guidance](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide): useful, original, accessible content and existing search fundamentals remain the foundation.
- [Google AI features guidance](https://developers.google.com/search/docs/appearance/ai-features): no special AI text file or special schema is required. `llms.txt` was not added as a supposed ranking shortcut. FAQ markup mirrors visible content; it is not a promise of a Google rich result.
- [Google inclusion control](https://support.google.com/webmasters/answer/16908024) and [AI performance report](https://support.google.com/webmasters/answer/16984139): account inclusion and impression reporting are distinct from crawling and from leads. Both were inspected in AIS's signed-in account.
- [Bing AI Performance](https://blogs.bing.com/webmaster/2026/2/Introducing-AI-Performance-in-Bing-Webmaster-Tools-Public-Preview/): citation trends, cited pages, and grounding queries can support measurement; citations are not rank or revenue.
- [xAI web search](https://docs.x.ai/developers/tools/web-search): Grok can search and browse public pages. No verified publisher ranking recipe was identified; no invented Grok crawler rule was added.

Existing ISO certification wording, company founding date, model coverage lists, and fleet availability should be supported by current records before expanding them into new authority claims. These were not newly certified or independently validated in this task.
