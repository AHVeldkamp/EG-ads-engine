# NLSpec: ad-pipeline
# Version: 1.0
# Date: 2026-03-23
# Source: specs/INTERVIEW_ad-pipeline.md

---

## 1. Context

### 1.1 Problem Statement

Running a full ad from prompt to live Meta ad currently requires 7+ sequential API
calls across the `creative-generation` and `meta-campaigns` modules: generate a
creative, create a campaign, publish the campaign, create an ad set, publish the
ad set, create an ad, publish the ad. The `ad-pipeline` module provides a single
orchestration endpoint that executes this entire flow, tracking progress through a
`Pipeline` entity so the caller can inspect what happened at each step.

### 1.2 Prior Art

- **creative-generation module** (`src/modules/creatives/`) — `CreativesService.generate()`
  accepts `{ prompt, tags? }` and returns a `Creative` with status `COMPLETED` and
  an image saved at `uploads/creatives/{id}.png`.
- **meta-campaigns module** (`src/modules/campaigns/`, `src/modules/ad-sets/`,
  `src/modules/ads/`) — `CampaignsService`, `AdSetsService`, `AdsService` each
  expose `create()` and `publish()` methods that handle local DB persistence and
  Meta Marketing API calls respectively.
- **Existing patterns:** NestJS modules with controller/service/dto/types files,
  `class-validator` DTOs, `PrismaService` injection, `Logger` per service, offset-based
  pagination with `{ data, total, page, limit }`, HTTP exceptions for errors.

### 1.3 Scope

**IN scope:**
- `Pipeline` Prisma model tracking orchestration state
- `PipelinesModule` with controller, service, DTOs, types
- Single `POST /api/v1/pipelines` endpoint that orchestrates the full flow synchronously
- `GET /api/v1/pipelines` — list pipelines (paginated)
- `GET /api/v1/pipelines/:id` — get pipeline detail with all linked entity IDs
- `DELETE /api/v1/pipelines/:id` — delete pipeline record only (not linked entities)
- Step-by-step status tracking with error capture on failure

**OUT of scope — do NOT implement:**
- Direct Gemini API calls — delegate to `CreativesService.generate()`
- Direct Meta API calls — delegate to `CampaignsService`, `AdSetsService`, `AdsService`
- Bulk/batch pipelines (one ad per pipeline run)
- Scheduling or recurring pipelines
- Automatic retry on failure
- Rollback of already-created entities on failure
- User-facing UI (API only)
- Swagger/OpenAPI documentation decorators
- Authentication guards or middleware

---

## 2. Architecture

### 2.1 New Files

```
src/modules/pipelines/
├── pipelines.module.ts          ← NestJS module, imports dependent modules
├── pipelines.controller.ts      ← 4 Pipeline endpoints
├── pipelines.service.ts         ← Orchestration logic
├── pipelines.dto.ts             ← Pipeline DTOs (Create, List query)
├── pipelines.types.ts           ← Constants and PipelineStep type
```

### 2.2 Modified Files

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add `PipelineStatus` enum and `Pipeline` model |
| `src/app.module.ts` | Import `PipelinesModule` |

### 2.3 Module Registration

```typescript
// src/app.module.ts — add to imports array:
import { PipelinesModule } from './modules/pipelines/pipelines.module';
```

Add `PipelinesModule` to the `imports` array in `AppModule`, after `AdsModule`.

### 2.4 Module Dependencies

`PipelinesModule` must import (via NestJS module system):
- `PrismaModule` — for database access
- `CreativesModule` — to use `CreativesService.generate()`
- `CampaignsModule` — to use `CampaignsService.create()` and `.publish()`
- `AdSetsModule` — to use `AdSetsService.create()` and `.publish()`
- `AdsModule` — to use `AdsService.create()` and `.publish()`

Each of these modules must **export** their respective service so `PipelinesModule`
can inject them. If a module does not already export its service, add it to the
module's `exports` array.

### 2.5 Dependencies

**No new production or dev dependencies.** This module reuses only existing
services and packages already installed in the project.

**Uses (already installed):**
- `@nestjs/common`, `@nestjs/core` — NestJS framework
- `@nestjs/config` — Configuration
- `@prisma/client` — Database client
- `class-validator`, `class-transformer` — DTO validation

---

## 3. Data Model

### 3.1 Prisma Schema Additions

Add to `prisma/schema.prisma`:

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

**Field details:**
- `id` — UUID primary key, auto-generated
- `status` — current orchestration step (see Section 3.3)
- `prompt` — the creative generation prompt, copied from the request
- `config` — JSON object storing all campaign configuration from the request body
  (campaignName, objective, adSetName, dailyBudget, targeting, headline, body,
  callToAction, linkUrl, tags)
- `creativeId` — FK-like reference to `Creative.id` (nullable, set after creative generation)
- `campaignId` — FK-like reference to `Campaign.id` (nullable, set after campaign creation)
- `adSetId` — FK-like reference to `AdSet.id` (nullable, set after ad set creation)
- `adId` — FK-like reference to `Ad.id` (nullable, set after ad creation)
- `failedStep` — which step failed (e.g., `"GENERATING_CREATIVE"`, `"PUBLISHING"`), null on success
- `errorMessage` — error details from the failed step, null on success
- `createdAt`, `updatedAt` — standard timestamps

**Why no Prisma relations?** The Pipeline record is a lightweight orchestration log.
It references entities from other modules by ID but does not enforce foreign keys.
This avoids coupling the Pipeline model to the Creative/Campaign/AdSet/Ad models at
the schema level and allows pipeline records to survive even if linked entities are
independently deleted.

### 3.2 DTOs / Request Schemas

**CreatePipelineDto** (POST /pipelines):
```typescript
{
  prompt: string;           // required, min 1 char, max 2000 chars
  tags?: string[];          // optional, each tag max 50 chars, max 10 tags
  campaignName: string;     // required, min 1 char, max 255 chars
  objective: string;        // required, one of: "OUTCOME_TRAFFIC", "OUTCOME_SALES"
  adSetName: string;        // required, min 1 char, max 255 chars
  dailyBudget: number;      // required, integer, min 1 (cents)
  targetCountries: string[];// required, at least 1 country code
  targetAgeMin?: number;    // optional, default 18, min 18, max 65
  targetAgeMax?: number;    // optional, default 65, min 18, max 65
  targetGenders?: number[]; // optional, default [] (all genders)
  targetInterests?: Array<{ id: string; name: string }>; // optional, default []
  headline: string;         // required, min 1 char, max 255 chars
  body: string;             // required, min 1 char, max 2000 chars
  callToAction: string;     // required, one of: "SHOP_NOW", "LEARN_MORE", "SIGN_UP"
  linkUrl: string;          // required, valid URL
}
```

**ListPipelinesQueryDto** (GET /pipelines):
```typescript
{
  page?: number;            // optional, default 1, min 1
  limit?: number;           // optional, default 20, min 1, max 100
  status?: PipelineStatus;  // optional, filter by status
}
```

### 3.3 Enums / Constants

**PipelineStatus** (Prisma enum):
- `PENDING` — pipeline created, orchestration not started
- `GENERATING_CREATIVE` — calling `CreativesService.generate()`
- `CREATING_CAMPAIGN` — calling `CampaignsService.create()`
- `CREATING_AD_SET` — calling `AdSetsService.create()`
- `CREATING_AD` — calling `AdsService.create()`
- `PUBLISHING` — calling `publish()` on campaign, ad set, and ad (sequential)
- `COMPLETED` — all steps finished successfully
- `FAILED` — a step failed (check `failedStep` and `errorMessage`)

**Status lifecycle:**
```
PENDING → GENERATING_CREATIVE → CREATING_CAMPAIGN → CREATING_AD_SET → CREATING_AD → PUBLISHING → COMPLETED
Any step can → FAILED (with failedStep + errorMessage recorded)
```

**Constants** (in `pipelines.types.ts`):
```typescript
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
export const MAX_PROMPT_LENGTH = 2000;
export const MAX_TAGS = 10;
export const MAX_TAG_LENGTH = 50;
```

**PipelineStep type** (in `pipelines.types.ts`):
```typescript
export type PipelineStep =
  | 'GENERATING_CREATIVE'
  | 'CREATING_CAMPAIGN'
  | 'CREATING_AD_SET'
  | 'CREATING_AD'
  | 'PUBLISHING';
```

---

## 4. API Endpoints

All endpoints are prefixed with `/api/v1/pipelines`. The controller uses the
`@Controller('api/v1/pipelines')` decorator.

### 4.1 POST /api/v1/pipelines

- **Purpose:** Start a new ad pipeline — generates a creative, creates the full
  Meta campaign hierarchy, and publishes everything. Synchronous (blocks until
  complete or failed).
- **Auth:** None.
- **Path/Query Parameters:** None.
- **Request Body:**
```json
{
  "prompt": "Professional product photo of enduro helmet on mountain trail",
  "tags": ["helmet", "mountain"],
  "campaignName": "Helmet Spring Sale",
  "objective": "OUTCOME_TRAFFIC",
  "adSetName": "NL Adults 25-45",
  "dailyBudget": 1500,
  "targetCountries": ["NL"],
  "targetAgeMin": 25,
  "targetAgeMax": 45,
  "targetGenders": [],
  "targetInterests": [],
  "headline": "Enduro Helmets - 20% Off",
  "body": "Professional grade enduro helmets. Shop now at enduro-gear.nl",
  "callToAction": "SHOP_NOW",
  "linkUrl": "https://enduro-gear.nl/helmets"
}
```
- **Success Response (201):**
```json
{
  "id": "f1a2b3c4-d5e6-7890-abcd-ef1234567890",
  "status": "COMPLETED",
  "prompt": "Professional product photo of enduro helmet on mountain trail",
  "config": {
    "tags": ["helmet", "mountain"],
    "campaignName": "Helmet Spring Sale",
    "objective": "OUTCOME_TRAFFIC",
    "adSetName": "NL Adults 25-45",
    "dailyBudget": 1500,
    "targetCountries": ["NL"],
    "targetAgeMin": 25,
    "targetAgeMax": 45,
    "targetGenders": [],
    "targetInterests": [],
    "headline": "Enduro Helmets - 20% Off",
    "body": "Professional grade enduro helmets. Shop now at enduro-gear.nl",
    "callToAction": "SHOP_NOW",
    "linkUrl": "https://enduro-gear.nl/helmets"
  },
  "creativeId": "a1b2c3d4-e5f6-7890-abcd-111111111111",
  "campaignId": "a1b2c3d4-e5f6-7890-abcd-222222222222",
  "adSetId": "a1b2c3d4-e5f6-7890-abcd-333333333333",
  "adId": "a1b2c3d4-e5f6-7890-abcd-444444444444",
  "failedStep": null,
  "errorMessage": null,
  "createdAt": "2026-03-23T14:30:00.000Z",
  "updatedAt": "2026-03-23T14:30:25.000Z"
}
```
- **Error Responses:**

| Status | Condition | Response Body |
|--------|-----------|---------------|
| 400 | Missing or invalid fields in request body | `{ "statusCode": 400, "message": ["prompt must be longer than or equal to 1 characters", ...], "error": "Bad Request" }` |
| 422 | Any orchestration step failed (Gemini, Meta API) | `{ "statusCode": 422, "message": "Pipeline failed at GENERATING_CREATIVE: Image generation failed: ...", "error": "Unprocessable Entity" }` |

- **Side Effects:**
  1. Creates a `Pipeline` record in DB (initially `PENDING`)
  2. Creates a `Creative` record via `CreativesService.generate()`
  3. Creates a `Campaign` record via `CampaignsService.create()`
  4. Publishes the campaign via `CampaignsService.publish()`
  5. Creates an `AdSet` record via `AdSetsService.create()`
  6. Publishes the ad set via `AdSetsService.publish()`
  7. Creates an `Ad` record via `AdsService.create()`
  8. Publishes the ad via `AdsService.publish()`
  9. Updates `Pipeline` record at each step with status and entity IDs
- **Timing:** Expected ~15-30 seconds total (creative generation ~10-15s, Meta API calls ~1-2s each).

### 4.2 GET /api/v1/pipelines

- **Purpose:** List all pipelines with pagination and optional status filter.
- **Auth:** None.
- **Path/Query Parameters:**

| Name | Type | Required | Default | Validation |
|------|------|----------|---------|------------|
| `page` | number | no | 1 | min 1, integer |
| `limit` | number | no | 20 | min 1, max 100, integer |
| `status` | string | no | — | Must be valid PipelineStatus |

- **Request Body:** None.
- **Success Response (200):**
```json
{
  "data": [
    {
      "id": "f1a2b3c4-d5e6-7890-abcd-ef1234567890",
      "status": "COMPLETED",
      "prompt": "Professional product photo of enduro helmet on mountain trail",
      "config": { "..." : "..." },
      "creativeId": "a1b2c3d4-e5f6-7890-abcd-111111111111",
      "campaignId": "a1b2c3d4-e5f6-7890-abcd-222222222222",
      "adSetId": "a1b2c3d4-e5f6-7890-abcd-333333333333",
      "adId": "a1b2c3d4-e5f6-7890-abcd-444444444444",
      "failedStep": null,
      "errorMessage": null,
      "createdAt": "2026-03-23T14:30:00.000Z",
      "updatedAt": "2026-03-23T14:30:25.000Z"
    }
  ],
  "total": 5,
  "page": 1,
  "limit": 20
}
```
- **Error Responses:**

| Status | Condition | Response Body |
|--------|-----------|---------------|
| 400 | Invalid query params (e.g., page=0, limit=200) | `{ "statusCode": 400, "message": [...], "error": "Bad Request" }` |

- **Side Effects:** None — read-only.

### 4.3 GET /api/v1/pipelines/:id

- **Purpose:** Get a single pipeline by ID with all linked entity IDs.
- **Auth:** None.
- **Path/Query Parameters:**

| Name | Type | Required | Validation |
|------|------|----------|------------|
| `id` | string (UUID) | yes | Valid UUID format |

- **Request Body:** None.
- **Success Response (200):**
```json
{
  "id": "f1a2b3c4-d5e6-7890-abcd-ef1234567890",
  "status": "COMPLETED",
  "prompt": "Professional product photo of enduro helmet on mountain trail",
  "config": {
    "tags": ["helmet", "mountain"],
    "campaignName": "Helmet Spring Sale",
    "objective": "OUTCOME_TRAFFIC",
    "adSetName": "NL Adults 25-45",
    "dailyBudget": 1500,
    "targetCountries": ["NL"],
    "targetAgeMin": 25,
    "targetAgeMax": 45,
    "targetGenders": [],
    "targetInterests": [],
    "headline": "Enduro Helmets - 20% Off",
    "body": "Professional grade enduro helmets. Shop now at enduro-gear.nl",
    "callToAction": "SHOP_NOW",
    "linkUrl": "https://enduro-gear.nl/helmets"
  },
  "creativeId": "a1b2c3d4-e5f6-7890-abcd-111111111111",
  "campaignId": "a1b2c3d4-e5f6-7890-abcd-222222222222",
  "adSetId": "a1b2c3d4-e5f6-7890-abcd-333333333333",
  "adId": "a1b2c3d4-e5f6-7890-abcd-444444444444",
  "failedStep": null,
  "errorMessage": null,
  "createdAt": "2026-03-23T14:30:00.000Z",
  "updatedAt": "2026-03-23T14:30:25.000Z"
}
```
- **Error Responses:**

| Status | Condition | Response Body |
|--------|-----------|---------------|
| 404 | Pipeline ID not found | `{ "statusCode": 404, "message": "Pipeline not found", "error": "Not Found" }` |

- **Side Effects:** None — read-only.

### 4.4 DELETE /api/v1/pipelines/:id

- **Purpose:** Delete a pipeline record. Does NOT delete linked entities (creative,
  campaign, ad set, ad). Only allowed when pipeline status is `COMPLETED` or `FAILED`.
- **Auth:** None.
- **Path/Query Parameters:**

| Name | Type | Required | Validation |
|------|------|----------|------------|
| `id` | string (UUID) | yes | Valid UUID format |

- **Request Body:** None.
- **Success Response (204):** No body.
- **Error Responses:**

| Status | Condition | Response Body |
|--------|-----------|---------------|
| 404 | Pipeline ID not found | `{ "statusCode": 404, "message": "Pipeline not found", "error": "Not Found" }` |
| 409 | Pipeline status is not `COMPLETED` or `FAILED` | `{ "statusCode": 409, "message": "Cannot delete pipeline with status GENERATING_CREATIVE. Only COMPLETED or FAILED pipelines can be deleted.", "error": "Conflict" }` |

- **Side Effects:**
  1. Deletes `Pipeline` record from database
  2. Does NOT delete any linked Creative, Campaign, AdSet, or Ad records

---

## 5. Business Logic

### 5.1 Core Flow — Run Pipeline (POST /api/v1/pipelines)

The orchestration runs synchronously. Each step updates the Pipeline record in the
database before calling the downstream service, so that if the process crashes, the
last known step is recorded.

```
Step 1: Create Pipeline record (status: PENDING)
Step 2: Generate Creative
Step 3: Create Campaign
Step 4: Create Ad Set
Step 5: Create Ad
Step 6: Publish Campaign + Ad Set + Ad
Step 7: Mark COMPLETED
```

**Detailed step-by-step:**

1. **Create Pipeline record:**
   ```typescript
   const pipeline = await prisma.pipeline.create({
     data: {
       status: 'PENDING',
       prompt: dto.prompt,
       config: {
         tags: dto.tags ?? [],
         campaignName: dto.campaignName,
         objective: dto.objective,
         adSetName: dto.adSetName,
         dailyBudget: dto.dailyBudget,
         targetCountries: dto.targetCountries,
         targetAgeMin: dto.targetAgeMin ?? 18,
         targetAgeMax: dto.targetAgeMax ?? 65,
         targetGenders: dto.targetGenders ?? [],
         targetInterests: dto.targetInterests ?? [],
         headline: dto.headline,
         body: dto.body,
         callToAction: dto.callToAction,
         linkUrl: dto.linkUrl,
       },
     },
   });
   ```

2. **Generate Creative** (status → `GENERATING_CREATIVE`):
   ```typescript
   await updateStatus(pipeline.id, 'GENERATING_CREATIVE');
   const creative = await creativesService.generate({
     prompt: dto.prompt,
     tags: dto.tags,
   });
   await updatePipeline(pipeline.id, { creativeId: creative.id });
   ```

3. **Create Campaign** (status → `CREATING_CAMPAIGN`):
   ```typescript
   await updateStatus(pipeline.id, 'CREATING_CAMPAIGN');
   const campaign = await campaignsService.create({
     name: dto.campaignName,
     objective: dto.objective,
   });
   await updatePipeline(pipeline.id, { campaignId: campaign.id });
   ```

4. **Create Ad Set** (status → `CREATING_AD_SET`):
   - Derive `optimizationGoal` from objective:
     - `"OUTCOME_TRAFFIC"` → `"LINK_CLICKS"`
     - `"OUTCOME_SALES"` → `"OFFSITE_CONVERSIONS"`
   - `billingEvent` is always `"IMPRESSIONS"`
   ```typescript
   await updateStatus(pipeline.id, 'CREATING_AD_SET');
   const optimizationGoal = dto.objective === 'OUTCOME_SALES'
     ? 'OFFSITE_CONVERSIONS'
     : 'LINK_CLICKS';
   const adSet = await adSetsService.create({
     campaignId: campaign.id,
     name: dto.adSetName,
     dailyBudget: dto.dailyBudget,
     targetCountries: dto.targetCountries,
     targetAgeMin: dto.targetAgeMin,
     targetAgeMax: dto.targetAgeMax,
     targetGenders: dto.targetGenders,
     targetInterests: dto.targetInterests,
     optimizationGoal,
     billingEvent: 'IMPRESSIONS',
   });
   await updatePipeline(pipeline.id, { adSetId: adSet.id });
   ```

5. **Create Ad** (status → `CREATING_AD`):
   ```typescript
   await updateStatus(pipeline.id, 'CREATING_AD');
   const ad = await adsService.create({
     adSetId: adSet.id,
     name: dto.headline,  // Ad name = headline
     creativeId: creative.id,
     headline: dto.headline,
     body: dto.body,
     callToAction: dto.callToAction,
     linkUrl: dto.linkUrl,
   });
   await updatePipeline(pipeline.id, { adId: ad.id });
   ```

6. **Publish all** (status → `PUBLISHING`):
   Publish in order: campaign first, then ad set, then ad. Each publish call
   pushes the entity to Meta's Marketing API.
   ```typescript
   await updateStatus(pipeline.id, 'PUBLISHING');
   await campaignsService.publish(campaign.id);
   await adSetsService.publish(adSet.id);
   await adsService.publish(ad.id);
   ```

7. **Mark completed:**
   ```typescript
   const completed = await prisma.pipeline.update({
     where: { id: pipeline.id },
     data: { status: 'COMPLETED' },
   });
   return completed;
   ```

### 5.2 Error Handling — Pipeline Failure

If any step throws an exception:

1. Catch the error
2. Determine `failedStep` from the current pipeline status (the status was already
   set to the step name before calling the downstream service)
3. Extract `errorMessage` from the caught exception
4. Update the Pipeline record:
   ```typescript
   await prisma.pipeline.update({
     where: { id: pipeline.id },
     data: {
       status: 'FAILED',
       failedStep: currentStep,
       errorMessage: errorMessage,
     },
   });
   ```
5. Throw `UnprocessableEntityException` with message:
   `"Pipeline failed at {failedStep}: {errorMessage}"`

**Already-created entities are NOT rolled back.** If the pipeline fails at
`CREATING_AD_SET`, the creative and campaign created in earlier steps remain in the
database. The caller can inspect them via the meta-campaigns endpoints or start a
new pipeline.

### 5.3 Core Flow — List Pipelines

1. Parse query params (page, limit, status)
2. Build Prisma `where` clause:
   - If `status` provided: `{ status: status }`
3. Run two queries in parallel:
   ```typescript
   const [data, total] = await Promise.all([
     prisma.pipeline.findMany({
       where,
       skip: (page - 1) * limit,
       take: limit,
       orderBy: { createdAt: 'desc' },
     }),
     prisma.pipeline.count({ where }),
   ]);
   ```
4. Return `{ data, total, page, limit }`

### 5.4 Core Flow — Find One Pipeline

1. Find pipeline by ID: `prisma.pipeline.findUnique({ where: { id } })`
2. If not found → throw `NotFoundException("Pipeline not found")`
3. Return the pipeline record

### 5.5 Core Flow — Delete Pipeline

1. Find pipeline by ID — throw `NotFoundException` if not found
2. Check status: if not `COMPLETED` and not `FAILED` → throw `ConflictException`
   with message: `"Cannot delete pipeline with status {status}. Only COMPLETED or FAILED pipelines can be deleted."`
3. Delete DB record: `prisma.pipeline.delete({ where: { id } })`

### 5.6 Optimization Goal Mapping

The pipeline maps the campaign objective to an ad set optimization goal automatically:

| Campaign Objective | Optimization Goal | Billing Event |
|--------------------|-------------------|---------------|
| `OUTCOME_TRAFFIC` | `LINK_CLICKS` | `IMPRESSIONS` |
| `OUTCOME_SALES` | `OFFSITE_CONVERSIONS` | `IMPRESSIONS` |

### 5.7 Ad Name Derivation

The ad entity's `name` field is set to the `headline` value from the request. The
pipeline does not take a separate `adName` field.

### 5.8 External Service Interactions

This module makes NO direct external API calls. All external interactions are
delegated to existing services:

| Service | Methods Used | What It Does |
|---------|-------------|--------------|
| `CreativesService` | `generate({ prompt, tags })` | Calls Gemini API, saves image, returns `Creative` |
| `CampaignsService` | `create({ name, objective })` | Creates local Campaign record |
| `CampaignsService` | `publish(id)` | Pushes campaign to Meta Marketing API |
| `AdSetsService` | `create({ campaignId, name, dailyBudget, targetCountries, targetAgeMin, targetAgeMax, targetGenders, targetInterests, optimizationGoal, billingEvent })` | Creates local AdSet record |
| `AdSetsService` | `publish(id)` | Pushes ad set to Meta Marketing API |
| `AdsService` | `create({ adSetId, name, creativeId, headline, body, callToAction, linkUrl })` | Creates local Ad record |
| `AdsService` | `publish(id)` | Uploads image, creates Meta creative, creates Meta ad |

### 5.9 Multi-Tenancy / Tenant Isolation

Not applicable — single-tenant service.

---

## 6. Exemplars

### 6.1 Reference Module

Follow the patterns established by the `meta-campaigns` module:
- `src/modules/campaigns/campaigns.service.ts` — service structure, Logger usage,
  error handling pattern
- `src/modules/campaigns/campaigns.controller.ts` — controller structure, route
  decorators, HTTP status codes
- `src/modules/campaigns/campaigns.dto.ts` — class-validator decorators, query DTOs

### 6.2 What to Replicate

From `CampaignsService`:
- `private readonly logger = new Logger(PipelinesService.name)` pattern
- Try/catch with status update to FAILED on error
- `Logger.log()` for successful operations, `Logger.warn()` for failures

From `CampaignsController`:
- `@Controller('api/v1/pipelines')` decorator
- `@Post()`, `@Get()`, `@Get(':id')`, `@Delete(':id')` route decorators
- `@HttpCode(HttpStatus.NO_CONTENT)` for DELETE
- `@HttpCode(HttpStatus.CREATED)` for POST
- `@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))` or
  global validation pipe

From DTOs:
- `@Type(() => Number)` on query number fields
- Same pagination pattern with `page` and `limit`

### 6.3 What NOT to Replicate

- Do NOT create `update()` or `patch()` methods — pipelines are immutable once created
- Do NOT add `publish()` — the pipeline publishes everything during creation
- Do NOT add Meta API calls directly — delegate to existing services

---

## 7. Constraints

### 7.1 Forbidden Approaches

- Do NOT call Gemini API directly — use `CreativesService.generate()`
- Do NOT call Meta Marketing API directly — use `CampaignsService`, `AdSetsService`,
  `AdsService` publish methods
- Do NOT implement automatic retry logic
- Do NOT roll back entities on pipeline failure
- Do NOT add asynchronous processing (queues, background jobs, events)
- Do NOT add Swagger decorators
- Do NOT add authentication guards
- Do NOT create files in `test/`
- Do NOT add an `update()` endpoint — pipelines are immutable
- Do NOT store pipeline config fields as individual columns — use the `config` JSON field

### 7.2 Error Handling

Use NestJS built-in exceptions:
- `NotFoundException` — pipeline not found (404)
- `ConflictException` — cannot delete pipeline in progress (409)
- `UnprocessableEntityException` — orchestration step failed (422)
- `BadRequestException` — invalid input (400, auto-thrown by class-validator)

When catching errors from downstream services, the downstream services may throw
`UnprocessableEntityException`, `NotFoundException`, or `ConflictException`. Catch
ALL exceptions from downstream services, record the failure in the pipeline record,
and re-throw as a single `UnprocessableEntityException` with the pipeline context.

### 7.3 Logging

Use NestJS `Logger` in `PipelinesService`:
- `logger.log()` — pipeline started, each step completed, pipeline completed (INFO)
- `logger.warn()` — pipeline step failed (WARN)
- `logger.error()` — unexpected errors (ERROR)

Example log messages:
- `"Pipeline {id} started"`
- `"Pipeline {id} step GENERATING_CREATIVE completed (creativeId: {creativeId})"`
- `"Pipeline {id} step CREATING_CAMPAIGN completed (campaignId: {campaignId})"`
- `"Pipeline {id} completed successfully"`
- `"Pipeline {id} failed at GENERATING_CREATIVE: {errorMessage}"`

### 7.4 Protected Files

- `test/**` — Do NOT create, modify, or delete any files in the test directory.

---

## 8. Frontend Impact

### Verdict C — "Frontend not required"

- **Why not needed:** This is a backend-only orchestration API. The pipeline is
  operated via a single HTTP POST call (curl/Postman). There is no user-facing UI
  in this project.
- **End-to-end usability confirmed:** A developer can create a pipeline, inspect its
  status and linked entity IDs, list all pipelines, and delete completed pipelines
  entirely through HTTP API calls without any frontend.

---

## 9. Acceptance Criteria

### 9.1 Functional

- [ ] `POST /api/v1/pipelines` with full config returns HTTP 201 with a pipeline record
- [ ] Pipeline status is `COMPLETED` and all four entity IDs (`creativeId`, `campaignId`, `adSetId`, `adId`) are populated
- [ ] Creative image exists on disk at `uploads/creatives/{creativeId}.png`
- [ ] Campaign, ad set, and ad exist in local DB with Meta IDs (metaCampaignId, metaAdSetId, metaAdId)
- [ ] Pipeline `config` JSON contains all input fields (campaignName, objective, targeting, etc.)
- [ ] `GET /api/v1/pipelines/:id` returns the pipeline with all linked entity IDs
- [ ] `GET /api/v1/pipelines` returns paginated list with `{ data, total, page, limit }`
- [ ] `GET /api/v1/pipelines?status=COMPLETED` filters by status
- [ ] `DELETE /api/v1/pipelines/:id` on a COMPLETED pipeline returns HTTP 204 and removes the record
- [ ] `DELETE /api/v1/pipelines/:id` does NOT delete linked creative, campaign, ad set, or ad
- [ ] `DELETE` on a pipeline with status `GENERATING_CREATIVE` returns HTTP 409
- [ ] If Gemini fails during creative generation, pipeline status is `FAILED` with `failedStep = "GENERATING_CREATIVE"`
- [ ] If Meta API fails during campaign publish, pipeline status is `FAILED` with `failedStep = "PUBLISHING"`
- [ ] Failed pipeline returns HTTP 422 with descriptive error message
- [ ] Pipeline not found returns HTTP 404
- [ ] Missing required fields in POST body returns HTTP 400
- [ ] Optimization goal is correctly derived: `OUTCOME_TRAFFIC` → `LINK_CLICKS`, `OUTCOME_SALES` → `OFFSITE_CONVERSIONS`
- [ ] Billing event is always `IMPRESSIONS`

### 9.2 Tenant Isolation

Not applicable — single-tenant service.

### 9.3 Structural

- [ ] Files in correct directories per ARCHITECTURE.md (`src/modules/pipelines/`)
- [ ] `PipelinesModule` registered in `AppModule` imports
- [ ] `PipelinesModule` imports `CreativesModule`, `CampaignsModule`, `AdSetsModule`, `AdsModule` via NestJS module system
- [ ] `CreativesModule`, `CampaignsModule`, `AdSetsModule`, `AdsModule` export their respective services
- [ ] Prisma schema has `PipelineStatus` enum with 8 values
- [ ] Prisma schema has `Pipeline` model with 12 fields
- [ ] DTOs use `class-validator` decorators for input validation
- [ ] No `console.log` statements — use NestJS `Logger`
- [ ] No files created inside `test/`
- [ ] No new npm dependencies added

### 9.4 Build

- [ ] `npm run build` passes
- [ ] `npm run lint` passes
- [ ] `npm run test` passes (clean exit)
- [ ] `npx prisma generate` succeeds with the updated schema
