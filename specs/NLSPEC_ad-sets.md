# NLSpec: Ad Sets (Meta Ad Set Management)

## 1. Overview

The Ad Sets module manages Meta ad sets, which sit between campaigns and individual ads. An ad set defines the targeting parameters (geography, age, gender, interests), daily budget, optimization goal, and billing event. Ad sets are created locally in DRAFT status, linked to a parent campaign, and can be published to Meta once the parent campaign is published.

## 2. Data Model

```prisma
model AdSet {
  id                String             @id @default(uuid())
  campaignId        String
  name              String
  dailyBudget       Int
  targetCountries   String[]
  targetAgeMin      Int                @default(18)
  targetAgeMax      Int                @default(65)
  targetGenders     Int[]              @default([])
  targetInterests   Json               @default("[]")
  optimizationGoal  String
  billingEvent      String
  status            MetaCampaignStatus @default(DRAFT)
  metaAdSetId       String?
  errorMessage      String?
  createdAt         DateTime           @default(now())
  updatedAt         DateTime           @updatedAt

  campaign          Campaign           @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  ads               Ad[]

  @@map("ad_sets")
}
```

## 3. Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/ad-sets` | Create a new ad set under a campaign |
| GET | `/ad-sets` | List ad sets with pagination, optional campaignId and status filters |
| GET | `/ad-sets/:id` | Get a single ad set with nested ads |
| PATCH | `/ad-sets/:id` | Update ad set fields |
| DELETE | `/ad-sets/:id` | Delete a DRAFT or FAILED ad set |
| POST | `/ad-sets/:id/publish` | Publish ad set to Meta Marketing API |

## 4. Business Logic

### `create(dto)`
1. Verifies the parent campaign exists (NotFoundException if not).
2. Creates the ad set with the provided targeting and budget configuration.
3. Status starts as DRAFT.
4. `dailyBudget` is an integer (cents). `targetCountries` is an array of ISO country codes. `targetGenders` uses Meta's encoding (empty = all, [1] = male, [2] = female). `targetInterests` is a JSON array of `{ id, name }` objects matching Meta's interest targeting format.

### `findAll(query)`
Paginated listing (default 20, max 100). Filters by `campaignId` (UUID) and `status` (enum).

### `findOne(id)`
Returns the ad set with nested `ads` included.

### `update(id, dto)`
- If ad set is PAUSED or ACTIVE: only `name` and `status` can be updated. Other field changes throw ConflictException.
- DRAFT and FAILED ad sets: all fields can be updated.

### `remove(id)`
Only DRAFT and FAILED ad sets can be deleted. Cascade deletes child ads via Prisma.

### `publish(id)`
1. Only DRAFT or FAILED ad sets can be published.
2. Parent campaign must already be published (must have a `metaCampaignId`). Throws ConflictException if not.
3. Calls `MetaApiService.createAdSet()` with the campaign's Meta ID, targeting parameters (geo_locations, age, gender, interests), budget, optimization goal, billing event, and status=PAUSED.
4. On success: stores `metaAdSetId`, sets status to PAUSED, clears error.
5. On failure: sets status to FAILED, throws UnprocessableEntityException.

## 5. External Integrations

| Service | Purpose |
|---------|---------|
| Meta Marketing API (`MetaApiService`) | `createAdSet()` — creates the ad set on Meta with targeting and budget configuration |

## 6. Error Handling

| Scenario | Response |
|----------|----------|
| Ad set not found | 404 NotFoundException |
| Parent campaign not found (on create) | 404 NotFoundException |
| Update locked fields on PAUSED/ACTIVE | 409 ConflictException |
| Delete PAUSED or ACTIVE ad set | 409 ConflictException |
| Publish already-published ad set | 409 ConflictException |
| Publish without published parent campaign | 409 ConflictException |
| Meta API failure on publish | 422 UnprocessableEntityException; status set to FAILED |
| Age out of range (18-65) | 400 validation error |
