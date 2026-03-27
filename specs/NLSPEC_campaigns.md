# NLSpec: Campaigns (Meta Campaign Management)

## 1. Overview

The Campaigns module manages the lifecycle of Meta (Facebook) advertising campaigns. Campaigns are created locally in DRAFT status, can be edited, and then published to the Meta Marketing API. Once published, campaigns are set to PAUSED status on Meta and only name/status can be updated locally.

## 2. Data Model

```prisma
enum MetaCampaignStatus {
  DRAFT
  PAUSED
  ACTIVE
  FAILED
}

model Campaign {
  id               String             @id @default(uuid())
  name             String
  objective        String
  status           MetaCampaignStatus @default(DRAFT)
  metaCampaignId   String?
  errorMessage     String?
  createdAt        DateTime           @default(now())
  updatedAt        DateTime           @updatedAt

  adSets           AdSet[]

  @@map("campaigns")
}
```

## 3. Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/campaigns` | Create a new campaign in DRAFT status |
| GET | `/campaigns` | List campaigns with pagination and optional status filter |
| GET | `/campaigns/:id` | Get a single campaign with nested ad sets and ads |
| PATCH | `/campaigns/:id` | Update campaign fields |
| DELETE | `/campaigns/:id` | Delete a DRAFT or FAILED campaign |
| POST | `/campaigns/:id/publish` | Publish campaign to Meta Marketing API |

## 4. Business Logic

### `create(dto)`
Creates a campaign with the given name and objective. Status is always DRAFT. Supported objectives: `OUTCOME_TRAFFIC`, `OUTCOME_SALES`.

### `findOne(id)`
Returns the campaign with nested `adSets` (which in turn include nested `ads`). Provides a full campaign hierarchy in one call.

### `update(id, dto)`
- If campaign is PAUSED or ACTIVE: only `name` and `status` fields are editable. Attempting to change other fields throws ConflictException.
- DRAFT and FAILED campaigns: all fields (name, status, objective) can be updated.

### `remove(id)`
Only DRAFT and FAILED campaigns can be deleted. Attempting to delete a PAUSED or ACTIVE campaign throws ConflictException. Cascade deletes child ad sets and ads (via Prisma relation).

### `publish(id)`
1. Only DRAFT or FAILED campaigns can be published; others throw ConflictException.
2. Calls `MetaApiService.createCampaign()` with name, objective, status=PAUSED, and empty `special_ad_categories`.
3. On success: stores the `metaCampaignId` from Meta, sets status to PAUSED, clears any previous error.
4. On failure: sets status to FAILED with error message, throws UnprocessableEntityException.

## 5. External Integrations

| Service | Purpose |
|---------|---------|
| Meta Marketing API (`MetaApiService`) | `createCampaign()` — creates the campaign on Meta's ad platform |

## 6. Error Handling

| Scenario | Response |
|----------|----------|
| Campaign not found | 404 NotFoundException |
| Update locked fields on PAUSED/ACTIVE | 409 ConflictException |
| Delete PAUSED or ACTIVE campaign | 409 ConflictException |
| Publish already-published campaign | 409 ConflictException |
| Meta API failure on publish | 422 UnprocessableEntityException; status set to FAILED |
