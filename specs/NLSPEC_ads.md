# NLSpec: Ads (Meta Ad Management)

## 1. Overview

The Ads module manages individual Meta advertisements. An ad combines a creative image (from the Creatives module) with ad copy (headline, body, call-to-action, link URL) and is linked to a parent ad set. Publishing an ad to Meta is a multi-step process: upload the image, create a Meta ad creative object, then create the Meta ad itself.

## 2. Data Model

```prisma
model Ad {
  id               String             @id @default(uuid())
  adSetId          String
  name             String
  creativeId       String
  headline         String
  body             String
  callToAction     String
  linkUrl          String
  status           MetaCampaignStatus @default(DRAFT)
  metaAdId         String?
  metaCreativeId   String?
  metaImageHash    String?
  errorMessage     String?
  createdAt        DateTime           @default(now())
  updatedAt        DateTime           @updatedAt

  adSet            AdSet              @relation(fields: [adSetId], references: [id], onDelete: Cascade)
  creative         Creative           @relation(fields: [creativeId], references: [id])

  @@map("ads")
}
```

## 3. Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/ads` | Create a new ad under an ad set |
| GET | `/ads` | List ads with pagination, optional adSetId and status filters |
| GET | `/ads/:id` | Get a single ad with its creative included |
| PATCH | `/ads/:id` | Update ad fields |
| DELETE | `/ads/:id` | Delete a DRAFT or FAILED ad |
| POST | `/ads/:id/publish` | Publish ad to Meta Marketing API (3-step process) |

## 4. Business Logic

### `create(dto)`
1. Verifies the parent ad set exists (NotFoundException if not).
2. Verifies the referenced creative exists (NotFoundException if not).
3. Creates the ad with status DRAFT.
4. Supported `callToAction` values: `SHOP_NOW`, `LEARN_MORE`, `SIGN_UP`.

### `findOne(id)`
Returns the ad with the associated `creative` object included.

### `update(id, dto)`
- If ad is PAUSED or ACTIVE: only `name` and `status` can be updated.
- If `creativeId` is being changed, the new creative must exist.

### `remove(id)`
Only DRAFT and FAILED ads can be deleted.

### `publish(id)`
A three-step idempotent process. Each step is skipped if its output already exists (allowing retry after partial failures):

1. **Upload image**: Reads the creative's PNG from `uploads/creatives/{creativeId}.png`. Calls `MetaApiService.uploadImage()`. Stores the returned `metaImageHash`.
2. **Create Meta ad creative**: Calls `MetaApiService.createAdCreative()` with the image hash, link URL, body text, headline, and call-to-action. Uses the configured `META_PAGE_ID`. Stores `metaCreativeId`.
3. **Create Meta ad**: Calls `MetaApiService.createAd()` with the ad set's Meta ID and the creative ID. Status set to PAUSED. Stores `metaAdId`.

Prerequisites:
- Parent ad set must be published (must have `metaAdSetId`).
- Creative image file must exist on disk.
- Only DRAFT or FAILED ads can be published.

On failure at any step: status set to FAILED with error message. Previously completed steps are preserved for retry.

## 5. External Integrations

| Service | Purpose |
|---------|---------|
| Meta Marketing API (`MetaApiService`) | `uploadImage()` — uploads creative PNG, returns image hash |
| Meta Marketing API (`MetaApiService`) | `createAdCreative()` — creates ad creative object with page link data |
| Meta Marketing API (`MetaApiService`) | `createAd()` — creates the final ad object linked to ad set and creative |

## 6. Error Handling

| Scenario | Response |
|----------|----------|
| Ad not found | 404 NotFoundException |
| Parent ad set not found (on create) | 404 NotFoundException |
| Creative not found (on create or update) | 404 NotFoundException |
| Creative image file missing (on publish) | 404 NotFoundException |
| Update locked fields on PAUSED/ACTIVE | 409 ConflictException |
| Delete PAUSED or ACTIVE ad | 409 ConflictException |
| Publish already-published ad | 409 ConflictException |
| Publish without published parent ad set | 409 ConflictException |
| Meta API failure at any publish step | 422 UnprocessableEntityException; status set to FAILED |
