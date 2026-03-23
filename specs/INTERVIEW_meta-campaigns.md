# Interview — meta-campaigns

## Round 1: Scope & Purpose

**What problem does this solve?**
Enables creating and managing Meta (Facebook/Instagram) ad campaigns for enduro-gear.nl. Manages the full Meta hierarchy: Campaign → Ad Set → Ad → Creative. Stores campaign data locally in PostgreSQL and syncs to Meta via the Marketing API.

**What's IN scope?**
- Full CRUD for campaigns, ad sets, and ads (local DB)
- Publish endpoints to push each level to Meta's API
- Image upload to Meta (from local creative-generation files) when publishing ads
- Meta creative creation (linking uploaded image to ad)
- Track Meta IDs (campaign ID, ad set ID, ad ID, image hash) locally
- Full targeting: country, age, gender, interests

**What's OUT of scope?**
- No automated bidding optimization
- No analytics/reporting (read campaign performance data)
- No audience creation (custom/lookalike audiences)
- No A/B testing
- No scheduling automation
- No user-facing UI (API only)

**Backend-only, frontend-only, or both?**
Backend-only. API-only service.

**Meta App credentials:**
User has a Meta App with Marketing API access, access token, App ID, App Secret, Facebook Page ID, and Ad Account ID.

## Round 2: Data & Rules

**Campaign objectives supported:**
- `OUTCOME_TRAFFIC` — drive visitors to enduro-gear.nl
- `OUTCOME_SALES` — conversions/purchases on the shop

**Budget model:** Daily budget only (in cents). All ad sets use daily budget. No lifetime budget support.

**Targeting options:**
- `countries` — required, array of country codes (e.g., `["NL", "DE", "BE"]`)
- `ageMin` — optional, default 18, range 18-65
- `ageMax` — optional, default 65, range 18-65
- `genders` — optional, array of 1 (male) and/or 2 (female), default all
- `interests` — optional, array of interest objects with `id` and `name` (e.g., `[{ "id": "6003107902433", "name": "Motorcycle" }]`)

**Local statuses (for Campaign, AdSet, Ad):**
- `DRAFT` — exists only locally, not yet pushed to Meta
- `PAUSED` — pushed to Meta in paused state
- `ACTIVE` — live on Meta
- `FAILED` — sync to Meta failed, error message stored

**Data model — Campaign:**
- `id` — UUID primary key
- `name` — campaign name
- `objective` — enum: OUTCOME_TRAFFIC, OUTCOME_SALES
- `status` — enum: DRAFT, PAUSED, ACTIVE, FAILED
- `metaCampaignId` — nullable, Meta's campaign ID after publish
- `errorMessage` — nullable, error from Meta API
- `createdAt`, `updatedAt` — timestamps

**Data model — AdSet:**
- `id` — UUID primary key
- `campaignId` — FK to Campaign
- `name` — ad set name
- `dailyBudget` — integer, in cents (e.g., 1000 = €10.00)
- `targetCountries` — string array (country codes)
- `targetAgeMin` — integer, default 18
- `targetAgeMax` — integer, default 65
- `targetGenders` — integer array (1=male, 2=female), default []
- `targetInterests` — JSON array of {id, name} objects, default []
- `optimizationGoal` — string (e.g., "LINK_CLICKS", "OFFSITE_CONVERSIONS")
- `billingEvent` — string (e.g., "IMPRESSIONS")
- `status` — enum: DRAFT, PAUSED, ACTIVE, FAILED
- `metaAdSetId` — nullable, Meta's ad set ID after publish
- `errorMessage` — nullable
- `createdAt`, `updatedAt` — timestamps

**Data model — Ad:**
- `id` — UUID primary key
- `adSetId` — FK to AdSet
- `name` — ad name
- `creativeId` — FK to Creative (from creative-generation module)
- `headline` — ad headline text
- `body` — ad body text
- `callToAction` — enum (e.g., SHOP_NOW, LEARN_MORE, SIGN_UP)
- `linkUrl` — destination URL (e.g., https://enduro-gear.nl/product/...)
- `status` — enum: DRAFT, PAUSED, ACTIVE, FAILED
- `metaAdId` — nullable, Meta's ad ID after publish
- `metaCreativeId` — nullable, Meta's creative ID after publish
- `metaImageHash` — nullable, Meta's image hash after upload
- `errorMessage` — nullable
- `createdAt`, `updatedAt` — timestamps

## Round 3: User Experience (API)

**Endpoints — Campaigns:**
1. `POST /api/v1/campaigns` — Create campaign (local, DRAFT)
2. `GET /api/v1/campaigns` — List campaigns (paginated)
3. `GET /api/v1/campaigns/:id` — Get campaign detail
4. `PATCH /api/v1/campaigns/:id` — Update campaign
5. `DELETE /api/v1/campaigns/:id` — Delete campaign (only DRAFT/FAILED)
6. `POST /api/v1/campaigns/:id/publish` — Push to Meta

**Endpoints — Ad Sets:**
7. `POST /api/v1/ad-sets` — Create ad set (local, DRAFT)
8. `GET /api/v1/ad-sets` — List ad sets (filter by campaignId)
9. `GET /api/v1/ad-sets/:id` — Get ad set detail
10. `PATCH /api/v1/ad-sets/:id` — Update ad set
11. `DELETE /api/v1/ad-sets/:id` — Delete ad set (only DRAFT/FAILED)
12. `POST /api/v1/ad-sets/:id/publish` — Push to Meta

**Endpoints — Ads:**
13. `POST /api/v1/ads` — Create ad (local, DRAFT)
14. `GET /api/v1/ads` — List ads (filter by adSetId)
15. `GET /api/v1/ads/:id` — Get ad detail
16. `PATCH /api/v1/ads/:id` — Update ad
17. `DELETE /api/v1/ads/:id` — Delete ad (only DRAFT/FAILED)
18. `POST /api/v1/ads/:id/publish` — Push to Meta (uploads image, creates creative, creates ad)

**Publish flow:** Each level published independently via its own /publish endpoint. Publishing an ad set requires its parent campaign to already be published (have a metaCampaignId). Publishing an ad requires its parent ad set to already be published.

## Round 4: Integration & Edge Cases

**Image upload flow (when publishing an ad):**
1. Read PNG from `uploads/creatives/{creativeId}.png` (from creative-generation)
2. Upload to Meta: `POST /{ad_account_id}/adimages`
3. Store `metaImageHash` on the Ad record
4. Create Meta creative with the image hash + headline + body + CTA
5. Store `metaCreativeId` on the Ad record
6. Create Meta ad linking the creative
7. Store `metaAdId` on the Ad record

**Error handling on publish failure:**
- Update local status to `FAILED`
- Store Meta's error message in `errorMessage`
- Return HTTP 422 with the error details
- User retries by calling /publish again

**Environment variables to add:**
- `META_AD_ACCOUNT_ID` — e.g., `act_123456789`
- `META_PAGE_ID` — Facebook Page ID for ad delivery

**SDK:** `facebook-nodejs-business-sdk` npm package.

## Round 5: Frontend Impact

**Frontend: Not required.** API-only feature.

## Round 6: Verification

Manual verification steps:
1. `POST /api/v1/campaigns` creates a local DRAFT campaign
2. `POST /api/v1/ad-sets` creates a local DRAFT ad set under the campaign
3. `POST /api/v1/ads` creates a local DRAFT ad linking a creative
4. `POST /api/v1/campaigns/:id/publish` pushes to Meta, returns metaCampaignId
5. `POST /api/v1/ad-sets/:id/publish` pushes to Meta, returns metaAdSetId
6. `POST /api/v1/ads/:id/publish` uploads image + creates creative + creates ad on Meta
7. List/get/update/delete work for all three levels
8. Publishing an ad set without a published campaign returns error
9. Delete on ACTIVE campaign returns error
10. `npm run build` passes
11. `npm run lint` passes

## Ambiguity Resolutions

**1. Pagination:** All list endpoints use offset-based pagination: `?page=1&limit=20`, default 20 items, max 100. Response includes `data`, `total`, `page`, `limit`.

**2. Delete constraints:** Only DRAFT and FAILED records can be deleted. PAUSED and ACTIVE records return HTTP 409 Conflict. Deleting a campaign also deletes its ad sets and ads (cascade).

**3. Update constraints:** DRAFT records can be freely updated. PAUSED/ACTIVE records can only update `name` and `status` (pause/unpause). Other fields are locked after publish.

**4. Publish prerequisites:** Publishing an ad set requires `campaign.metaCampaignId` to exist (campaign must be published first). Publishing an ad requires `adSet.metaAdSetId` to exist. Return HTTP 409 if prerequisite not met.

**5. Interest targeting format:** Interests use Meta's targeting API format: `{ "id": "6003107902433", "name": "Motorcycle" }`. The `id` is Meta's interest ID (string). Users must look up interest IDs via Meta's targeting search API or manually.
