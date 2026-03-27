# NLSpec: Pipelines (End-to-End Orchestration)

## 1. Overview

The Pipelines module provides a single-request orchestration flow that creates an entire ad campaign from scratch: generating a creative image, creating a campaign, ad set, and ad, then publishing everything to Meta. It tracks progress through discrete steps and records which step failed if the pipeline does not complete.

## 2. Data Model

```prisma
enum PipelineStatus {
  PENDING
  GENERATING_CREATIVE
  CREATING_CAMPAIGN
  CREATING_AD_SET
  CREATING_AD
  PUBLISHING
  COMPLETED
  FAILED
}

model Pipeline {
  id             String          @id @default(uuid())
  status         PipelineStatus  @default(PENDING)
  prompt         String
  config         Json
  creativeId     String?
  campaignId     String?
  adSetId        String?
  adId           String?
  failedStep     String?
  errorMessage   String?
  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt

  @@map("pipelines")
}
```

The `config` JSON field stores a snapshot of all input parameters at creation time (tags, campaign name, objective, ad set config, targeting, ad copy).

## 3. Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/pipelines` | Run a full end-to-end pipeline |
| GET | `/pipelines` | List pipelines with pagination and optional status filter |
| GET | `/pipelines/:id` | Get a single pipeline by ID |
| DELETE | `/pipelines/:id` | Delete a COMPLETED or FAILED pipeline |

## 4. Business Logic

### `run(dto)`
Executes a sequential 7-step pipeline. Each step updates the pipeline status and stores the created entity's ID.

**Step 1 — Create Pipeline record**: Saves all input config as a JSON snapshot. Status: PENDING.

**Step 2 — Generate Creative**: Calls `CreativesService.generate()` with the prompt and tags. Stores `creativeId`. Status: GENERATING_CREATIVE.

**Step 3 — Create Campaign**: Calls `CampaignsService.create()` with campaign name and objective. Stores `campaignId`. Status: CREATING_CAMPAIGN.

**Step 4 — Create Ad Set**: Calls `AdSetsService.create()`. Derives `optimizationGoal` from the campaign objective:
- `OUTCOME_SALES` -> `OFFSITE_CONVERSIONS`
- `OUTCOME_TRAFFIC` -> `LINK_CLICKS`

Sets `billingEvent` to `IMPRESSIONS`. Stores `adSetId`. Status: CREATING_AD_SET.

**Step 5 — Create Ad**: Calls `AdsService.create()` with the ad set, creative, headline, body, call-to-action, and link URL. The ad `name` is set to the headline value. Stores `adId`. Status: CREATING_AD.

**Step 6 — Publish All**: Publishes entities in dependency order:
1. `CampaignsService.publish(campaignId)`
2. `AdSetsService.publish(adSetId)`
3. `AdsService.publish(adId)`

Status: PUBLISHING.

**Step 7 — Mark Completed**: Sets status to COMPLETED.

On failure at any step: records `failedStep` (the step name string), `errorMessage`, sets status to FAILED, and throws UnprocessableEntityException.

### `findAll(query)`
Paginated listing (default 20, max 100). Optional filter by `status` (PipelineStatus enum).

### `findOne(id)`
Returns a single pipeline record.

### `remove(id)`
Only COMPLETED or FAILED pipelines can be deleted. In-progress pipelines (any other status) throw ConflictException.

## 5. External Integrations

The Pipelines module itself does not call external APIs directly. It orchestrates through the other service modules:

| Service | Operations Used |
|---------|----------------|
| `CreativesService` | `generate()` |
| `CampaignsService` | `create()`, `publish()` |
| `AdSetsService` | `create()`, `publish()` |
| `AdsService` | `create()`, `publish()` |

Indirectly, the pipeline triggers calls to:
- Google Gemini API (via CreativesService -> GeminiService)
- Meta Marketing API (via publish methods -> MetaApiService)

## 6. Error Handling

| Scenario | Response |
|----------|----------|
| Pipeline not found | 404 NotFoundException |
| Delete in-progress pipeline | 409 ConflictException |
| Failure at any step | 422 UnprocessableEntityException; status=FAILED with `failedStep` and `errorMessage` recorded |

The `failedStep` field records the exact step that failed: `GENERATING_CREATIVE`, `CREATING_CAMPAIGN`, `CREATING_AD_SET`, `CREATING_AD`, or `PUBLISHING`. This aids debugging and allows understanding where in the flow the failure occurred.

Note: The pipeline does not support retry or resume. A failed pipeline leaves partially-created entities (creative, campaign, etc.) in the database. A new pipeline run must be initiated from scratch.

### Input Validation

| Field | Constraint |
|-------|-----------|
| prompt | 1-2000 characters |
| tags | Optional, max 10 items, each max 50 chars |
| campaignName | 1-255 characters |
| objective | `OUTCOME_TRAFFIC` or `OUTCOME_SALES` |
| adSetName | 1-255 characters |
| dailyBudget | Integer, min 1 (cents) |
| targetCountries | At least 1 ISO country code |
| targetAgeMin/Max | Optional, 18-65 |
| targetGenders | Optional, array of integers |
| targetInterests | Optional, array of `{ id, name }` |
| headline | 1-255 characters |
| body | 1-2000 characters |
| callToAction | `SHOP_NOW`, `LEARN_MORE`, or `SIGN_UP` |
| linkUrl | Valid URL |
