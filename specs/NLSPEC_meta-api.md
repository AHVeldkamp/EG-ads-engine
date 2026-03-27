# NLSpec: Meta API (Meta Marketing API Integration Layer)

## 1. Overview

The Meta API module is a service-only integration layer (no controller/endpoints) that wraps the `facebook-nodejs-business-sdk` to provide typed methods for interacting with the Meta Marketing API. It handles SDK initialization, ad account operations, and error extraction from Meta's SDK response format.

## 2. Data Model

No Prisma models. This module operates on external Meta API objects.

### TypeScript Interfaces

- `MetaCampaignParams` — name, objective, status, special_ad_categories
- `MetaAdSetParams` — campaign_id, name, daily_budget, optimization_goal, billing_event, targeting (geo_locations, age, gender, interests), status
- `MetaAdCreativeParams` — name, object_story_spec (page_id, link_data with image_hash, link, message, headline, call_to_action)
- `MetaAdParams` — name, adset_id, creative (creative_id), status

## 3. Endpoints

None. This is a service-only module consumed by Campaigns, Ad Sets, and Ads modules.

## 4. Business Logic

### Initialization
On construction, reads from environment variables:
- `META_ACCESS_TOKEN` — OAuth access token
- `META_APP_ID` — Facebook app ID
- `META_APP_SECRET` — Facebook app secret
- `META_AD_ACCOUNT_ID` — Ad account ID (e.g., `act_123456`)
- `META_PAGE_ID` — Facebook Page ID for ad creatives

Calls `FacebookAdsApi.init()` with the token, app ID, and secret.

### `getPageId()`
Returns the configured `META_PAGE_ID`. Used by the Ads module when constructing ad creative payloads.

### `createCampaign(params)`
Creates a campaign on Meta via `AdAccount.createCampaign()`. Returns `{ id }`.

### `createAdSet(params)`
Creates an ad set on Meta via `AdAccount.createAdSet()`. Returns `{ id }`.

### `uploadImage(imagePath)`
Uploads a local image file to Meta via `AdAccount.createAdImage()`. Extracts the image hash from the response (keyed by filename). Returns `{ hash }`.

### `createAdCreative(params)`
Creates an ad creative on Meta via `AdAccount.createAdCreative()`. Returns `{ id }`.

### `createAd(params)`
Creates an ad on Meta via `AdAccount.createAd()`. Returns `{ id }`.

### `extractErrorMessage(error)`
Private helper that extracts human-readable error messages from Meta SDK errors. Checks `error.response.body.error.message` and `error._body.error.message` before falling back to `error.message`.

## 5. External Integrations

| Service | SDK | Purpose |
|---------|-----|---------|
| Meta Marketing API | `facebook-nodejs-business-sdk` | All campaign, ad set, ad creative, ad, and image operations |

The SDK is initialized once on service construction. All methods use the `AdAccount` class to make API calls.

## 6. Error Handling

All methods follow the same pattern:
1. Attempt the SDK call.
2. On failure: extract the error message using `extractErrorMessage()` (which digs into Meta's nested error response format).
3. Re-throw as a plain `Error` with the extracted message.
4. Callers (Campaigns, Ad Sets, Ads services) are responsible for mapping these to HTTP exceptions and updating entity status.

The SDK may return errors in two formats:
- `error.response.body.error.message` — standard Meta API error
- `error._body.error.message` — alternative SDK error wrapper
