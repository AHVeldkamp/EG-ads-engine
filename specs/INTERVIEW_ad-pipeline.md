# Interview — ad-pipeline

## Round 1: Scope & Purpose

**What problem does this solve?**
Provides end-to-end orchestration: one API call generates an ad creative, creates the full Meta campaign hierarchy (campaign → ad set → ad), and publishes everything to Meta. Automates the entire flow from prompt to live ad for enduro-gear.nl.

**What's IN scope?**
- Single orchestration endpoint: prompt + targeting + budget → live ad on Meta
- Coordinates between creative-generation and meta-campaigns modules
- Pipeline entity tracking the overall progress and status of the orchestration
- Step-by-step status tracking (creative generation → campaign creation → ad set creation → ad creation → publish)

**What's OUT of scope?**
- No new Gemini or Meta API calls — reuses existing services
- No bulk/batch pipelines (one ad per pipeline run)
- No scheduling or recurring pipelines
- No user-facing UI (API only)

**Backend-only, frontend-only, or both?**
Backend-only. API-only.

## Round 2: Data & Rules

**Pipeline data model:**
- `id` — UUID primary key
- `status` — enum: PENDING, GENERATING_CREATIVE, CREATING_CAMPAIGN, CREATING_AD_SET, CREATING_AD, PUBLISHING, COMPLETED, FAILED
- `prompt` — the creative generation prompt
- `creativeId` — FK to Creative (after generation)
- `campaignId` — FK to Campaign (after creation)
- `adSetId` — FK to AdSet (after creation)
- `adId` — FK to Ad (after creation)
- `config` — JSON object with campaign config (name, objective, targeting, budget, headline, body, callToAction, linkUrl)
- `errorMessage` — nullable, error details if any step failed
- `failedStep` — nullable, which step failed
- `createdAt`, `updatedAt` — timestamps

**Status lifecycle:**
PENDING → GENERATING_CREATIVE → CREATING_CAMPAIGN → CREATING_AD_SET → CREATING_AD → PUBLISHING → COMPLETED
Any step can → FAILED (with errorMessage and failedStep recorded)

## Round 3: User Experience (API)

**Endpoints:**
1. `POST /api/v1/pipelines` — Start a new pipeline (synchronous — blocks until complete or failed)
2. `GET /api/v1/pipelines` — List pipelines (paginated)
3. `GET /api/v1/pipelines/:id` — Get pipeline detail (includes all linked entity IDs)
4. `DELETE /api/v1/pipelines/:id` — Delete pipeline record (does NOT delete linked entities)

**POST /api/v1/pipelines request body:**
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

**Sync/Async:** Synchronous. The endpoint blocks through all steps and returns the completed pipeline. Total time ~15-30 seconds (creative generation + Meta API calls).

## Round 4: Integration & Edge Cases

**Error handling:** If any step fails, mark pipeline as FAILED with the step name and error message. Return HTTP 422. Already-created entities (creative, campaign, etc.) are NOT rolled back — they remain in their current state for manual cleanup or retry.

**Retry:** No automatic retry. User starts a new pipeline. Previously created entities from a failed pipeline can be reused manually via meta-campaigns endpoints.

**Dependencies:** Reuses CreativesService (generate), CampaignsService (create + publish), AdSetsService (create + publish), AdsService (create + publish).

## Round 5: Frontend Impact

**Frontend: Not required.** API-only orchestration endpoint.

## Round 6: Verification

1. `POST /api/v1/pipelines` with full config returns HTTP 201 with completed pipeline
2. Pipeline has status COMPLETED and all entity IDs populated
3. Creative image exists on disk
4. Campaign, ad set, ad exist in local DB with Meta IDs
5. `GET /api/v1/pipelines/:id` returns pipeline with all linked data
6. `GET /api/v1/pipelines` lists pipelines (paginated)
7. If Gemini fails, pipeline status is FAILED with failedStep = GENERATING_CREATIVE
8. If Meta publish fails, pipeline status is FAILED with appropriate failedStep
9. `npm run build` passes
10. `npm run lint` passes

## Ambiguity Resolutions

**1. Pagination:** Same as other modules: offset-based, default 20, max 100, `{ data, total, page, limit }`.

**2. Pipeline deletion:** Deleting a pipeline only removes the pipeline record. The linked creative, campaign, ad set, and ad remain untouched. Return HTTP 409 if pipeline status is not COMPLETED or FAILED.

**3. Optimization goal and billing event:** Use defaults: `optimizationGoal: "LINK_CLICKS"` for OUTCOME_TRAFFIC, `optimizationGoal: "OFFSITE_CONVERSIONS"` for OUTCOME_SALES. `billingEvent: "IMPRESSIONS"` always.
