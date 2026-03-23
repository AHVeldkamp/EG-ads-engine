# Interview — creative-generation

## Round 1: Scope & Purpose

**What problem does this solve?**
Enables generating ad creative images for enduro-gear.nl products using Google Gemini's Nano Banana image generation model. This is the foundation for all ad content creation in the platform.

**What's IN scope?**
Full creative pipeline: generate images from prompts, edit/refine existing images via Gemini chat, store creative assets on local filesystem, manage creative records (CRUD), serve images via API.

**What's OUT of scope?**
- No Meta integration (separate meta-campaigns feature)
- No video generation
- No bulk/batch generation
- No user-facing UI (API only)

**Backend-only, frontend-only, or both?**
Backend-only. API-only service.

**Which Gemini model?**
`gemini-2.5-flash-image` (Nano Banana). Fast, ~$0.04/image. Using the `@google/genai` SDK (v1.46+).

## Round 2: Data & Rules

**Creative data model fields:**
- `id` — UUID primary key
- `prompt` — the text prompt used for generation
- `model` — Gemini model name used (e.g., `gemini-2.5-flash-image`)
- `imagePath` — filesystem path to the saved PNG image
- `status` — enum: `pending`, `generating`, `completed`, `editing`, `failed`
- `errorMessage` — nullable, error details if generation failed
- `tags` — optional string array for labeling (e.g., `["helmet", "summer-sale"]`)
- `createdAt` — timestamp
- `updatedAt` — timestamp

**Status lifecycle:**
- `pending` → `generating` → `completed` (happy path)
- `pending` → `generating` → `failed` (generation error)
- `completed` → `editing` → `completed` (refinement via edit endpoint)
- `completed` → `editing` → `failed` (edit error)

**Images per request:** 1 image per generation request.

**Relationships:** No foreign keys to products or campaigns. Tag-based organization only. Linking to campaigns happens in the ad-pipeline feature.

## Round 3: User Experience (API)

**Endpoints:**
1. `POST /api/v1/creatives/generate` — Create a new creative from a prompt
2. `POST /api/v1/creatives/:id/edit` — Refine an existing creative with a new prompt
3. `GET /api/v1/creatives` — List all creatives (with optional status/tag filters)
4. `GET /api/v1/creatives/:id` — Get a single creative by ID
5. `GET /api/v1/creatives/:id/image` — Serve the PNG image file
6. `DELETE /api/v1/creatives/:id` — Delete a creative and its image file

**Sync/Async:** Synchronous. POST /generate blocks until the image is ready (~5-15 seconds) and returns the result directly.

**Error handling on generation failure:**
- Save the DB record with status `failed` and the error message
- Return HTTP 422 with the error details
- User can retry by calling POST /generate again with the same prompt

## Round 4: Integration & Edge Cases

**Rate limits:** No limits for MVP. No cost tracking.

**Image format:** PNG (Gemini's default output).

**File storage:** `uploads/creatives/{id}.png` on local filesystem. Add `uploads/` to `.gitignore`.

**Image serving:** `GET /api/v1/creatives/:id/image` serves the PNG file via NestJS `StreamableFile`.

**Gemini API details:**
- SDK: `@google/genai` package
- Model: `gemini-2.5-flash-image`
- Method: `ai.models.generateContent()` with text prompt
- Response: `response.candidates[0].content.parts` — iterate parts, find `inlineData` with base64 image bytes
- Edit: Use `ai.chats.create()` with the model, send the existing image + edit prompt

## Round 5: Frontend Impact

**Frontend: Not required.** API-only feature. A developer uses curl/Postman to generate, list, edit, and view creatives.

## Round 6: Verification

Manual verification steps:
1. `POST /api/v1/creatives/generate` with a prompt returns HTTP 201 with creative record including `imagePath`
2. `GET /api/v1/creatives/:id` returns the creative record with status `completed`
3. `GET /api/v1/creatives/:id/image` serves the PNG file (correct content-type, valid image)
4. `POST /api/v1/creatives/:id/edit` with a refinement prompt returns updated creative
5. `GET /api/v1/creatives` lists all creatives
6. `DELETE /api/v1/creatives/:id` removes the record and the image file from disk
7. Generation failure saves record with status `failed` and returns HTTP 422
8. `npm run build` passes
9. `npm run lint` passes

## Ambiguity Resolutions

**1. Listing pagination:** GET /api/v1/creatives uses offset-based pagination with `?page=1&limit=20`. Default page size is 20. Response includes `total` count, `page`, and `limit` fields.

**2. Edit endpoint input:** POST /:id/edit receives only a text instruction (`{ "prompt": "change the background to white" }`). The service loads the existing image from disk and sends both the image + edit prompt to Gemini chat. No image upload by the caller.

**3. Delete during in-progress status:** Cannot delete creatives in `generating` or `editing` status. Return HTTP 409 Conflict. Only creatives in `completed` or `failed` status can be deleted.
