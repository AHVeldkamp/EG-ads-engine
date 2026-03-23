# NLSpec: creative-generation
# Version: 1.0
# Date: 2026-03-23
# Source: specs/INTERVIEW_creative-generation.md

## 1. Context

### 1.1 Problem Statement
The EG-ads-engine needs to generate ad creative images for enduro-gear.nl products.
This module integrates with Google Gemini's Nano Banana image generation model
(`gemini-2.5-flash-image`) to create and refine ad images from text prompts. It is
the foundation for all ad content creation in the platform — the meta-campaigns and
ad-pipeline features depend on this module producing creative assets.

### 1.2 Prior Art
The scaffold (`feature/project-scaffold`) established the NestJS project skeleton
with AppModule, ConfigModule, Prisma, and a health endpoint. This is the first
feature module, and it will establish the pattern for all future modules.

Existing patterns to follow:
- `src/app.module.ts` — module registration via `@Module` imports array
- `src/app.service.ts` — NestJS `Logger` usage, `PrismaClient` usage
- `src/config/env.validation.ts` — Joi env validation schema

### 1.3 Scope

**IN scope:**
- Prisma model for `Creative` entity with all specified fields
- NestJS feature module: `CreativesModule` with controller, service, DTOs
- Generate endpoint: call Gemini API, save image to filesystem, create DB record
- Edit endpoint: load existing image, send to Gemini chat with edit prompt, save new image
- List endpoint with offset-based pagination and status/tag filters
- Get single creative by ID
- Serve PNG image file via StreamableFile
- Delete creative (record + file) with status guard
- Shared `PrismaModule` for database access (first module to need it)
- `GeminiModule` wrapping the `@google/genai` SDK

**OUT of scope — do NOT implement:**
- Meta Marketing API integration (separate `meta-campaigns` feature)
- Video generation
- Bulk/batch generation (multiple images per request)
- User-facing UI (API only)
- Rate limiting or cost tracking
- Authentication guards or middleware
- Image format conversion (WebP, JPEG)
- Aspect ratio or resolution control (use model defaults)
- Swagger/OpenAPI documentation decorators

## 2. Architecture

### 2.1 New Files

```
# Prisma module (shared — first module to create this)
src/prisma/prisma.module.ts
src/prisma/prisma.service.ts

# Gemini integration module
src/modules/gemini/gemini.module.ts
src/modules/gemini/gemini.service.ts

# Creative feature module
src/modules/creatives/creatives.module.ts
src/modules/creatives/creatives.controller.ts
src/modules/creatives/creatives.service.ts
src/modules/creatives/creatives.dto.ts
src/modules/creatives/creatives.types.ts
```

### 2.2 Modified Files

1. **`prisma/schema.prisma`** — Add `Creative` model with all fields
2. **`src/app.module.ts`** — Import `PrismaModule`, `GeminiModule`, and `CreativesModule`
3. **`src/config/env.validation.ts`** — Make `GEMINI_API_KEY` required (currently optional)
4. **`.gitignore`** — Add `uploads/` directory
5. **`package.json`** — Add `@google/genai` and `class-validator` + `class-transformer` dependencies

### 2.3 Module Registration

In `src/app.module.ts`, add imports:
```typescript
import { PrismaModule } from './prisma/prisma.module';
import { GeminiModule } from './modules/gemini/gemini.module';
import { CreativesModule } from './modules/creatives/creatives.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validationSchema: envValidationSchema }),
    PrismaModule,
    GeminiModule,
    CreativesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

### 2.4 Dependencies

**New production dependencies to add:**
- `@google/genai` — Google Gemini AI SDK (image generation)
- `class-validator` — DTO validation decorators
- `class-transformer` — DTO transformation (required by class-validator with NestJS)
- `uuid` — UUID generation for creative IDs

**New dev dependencies to add:**
- `@types/uuid` — UUID type definitions

**Uses (already installed):**
- `@nestjs/common`, `@nestjs/core` — NestJS framework
- `@nestjs/config` — Configuration with env vars
- `@prisma/client` — Database client
- `joi` — Env validation

**Does NOT use:**
- `multer` / `@nestjs/platform-express` file upload — no image upload by caller
- `sharp` / `jimp` — no image processing or conversion
- `@nestjs/swagger` — no API documentation in this feature
- `@nestjs/passport` / `passport` — no authentication
- `facebook-nodejs-business-sdk` — Meta integration is a separate feature
- `@google/generative-ai` — DEPRECATED, use `@google/genai` instead

## 3. Data Model

### 3.1 Entity / Model

Add to `prisma/schema.prisma`:
```prisma
enum CreativeStatus {
  PENDING
  GENERATING
  COMPLETED
  EDITING
  FAILED
}

model Creative {
  id           String          @id @default(uuid())
  prompt       String          // The text prompt used for generation
  model        String          @default("gemini-2.5-flash-image") // Gemini model name
  imagePath    String?         // Filesystem path to PNG (null while generating)
  status       CreativeStatus  @default(PENDING)
  errorMessage String?         // Error details if generation failed
  tags         String[]        @default([]) // Optional labels for organization
  createdAt    DateTime        @default(now())
  updatedAt    DateTime        @updatedAt

  @@map("creatives")
}
```

### 3.2 DTOs / Request Schemas

**GenerateCreativeDto** (POST /generate):
```typescript
{
  prompt: string;    // required, min 1 char, max 2000 chars
  tags?: string[];   // optional, each tag max 50 chars, max 10 tags
}
```

**EditCreativeDto** (POST /:id/edit):
```typescript
{
  prompt: string;    // required, min 1 char, max 2000 chars — the edit instruction
}
```

**ListCreativesQueryDto** (GET /):
```typescript
{
  page?: number;    // optional, default 1, min 1
  limit?: number;   // optional, default 20, min 1, max 100
  status?: CreativeStatus;  // optional filter by status
  tag?: string;     // optional filter by tag (exact match in array)
}
```

### 3.3 Enums / Constants

**CreativeStatus** (Prisma enum, also exported as TypeScript type):
- `PENDING` — record created, generation not started yet
- `GENERATING` — Gemini API call in progress
- `COMPLETED` — image generated and saved successfully
- `EDITING` — edit request in progress via Gemini chat
- `FAILED` — generation or edit failed

**Constants:**
- `UPLOAD_DIR = 'uploads/creatives'` — filesystem directory for images
- `DEFAULT_MODEL = 'gemini-2.5-flash-image'` — default Gemini model
- `MAX_PROMPT_LENGTH = 2000`
- `MAX_TAGS = 10`
- `MAX_TAG_LENGTH = 50`
- `DEFAULT_PAGE_SIZE = 20`
- `MAX_PAGE_SIZE = 100`

## 4. API Endpoints

### 4.1 POST /creatives/generate

- **Purpose:** Generate a new ad creative image from a text prompt.
- **Auth:** None (single-tenant, no auth in scaffold).
- **Path/Query Parameters:** None.
- **Request Body:**
```json
{
  "prompt": "Professional product photo of a motorcycle helmet on a white background, studio lighting",
  "tags": ["helmet", "product-shot"]
}
```
- **Success Response (201):**
```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "prompt": "Professional product photo of a motorcycle helmet on a white background, studio lighting",
  "model": "gemini-2.5-flash-image",
  "imagePath": "uploads/creatives/a1b2c3d4-e5f6-7890-abcd-ef1234567890.png",
  "status": "COMPLETED",
  "errorMessage": null,
  "tags": ["helmet", "product-shot"],
  "createdAt": "2026-03-23T14:30:00.000Z",
  "updatedAt": "2026-03-23T14:30:05.000Z"
}
```
- **Error Responses:**

| Status | Condition | Response Body |
|--------|-----------|---------------|
| 400 | Missing or invalid `prompt` | `{ "statusCode": 400, "message": ["prompt must be longer than or equal to 1 characters"], "error": "Bad Request" }` |
| 400 | Tags validation failure | `{ "statusCode": 400, "message": ["each value in tags must be shorter than or equal to 50 characters"], "error": "Bad Request" }` |
| 422 | Gemini API error (rate limit, content policy, network) | `{ "statusCode": 422, "message": "Image generation failed: [error from Gemini]", "error": "Unprocessable Entity" }` |

- **Side Effects:**
  1. Creates a `Creative` record in DB (initially `PENDING`, then `GENERATING`, then `COMPLETED` or `FAILED`)
  2. Saves PNG image file to `uploads/creatives/{id}.png`
  3. Creates `uploads/creatives/` directory if it doesn't exist
- **Security Notes:** No sensitive data. Prompt content is user-controlled.

### 4.2 POST /creatives/:id/edit

- **Purpose:** Refine an existing creative image with an edit instruction.
- **Auth:** None.
- **Path/Query Parameters:**

| Name | Type | Required | Validation |
|------|------|----------|------------|
| `id` | string (UUID) | yes | Valid UUID format |

- **Request Body:**
```json
{
  "prompt": "Change the background to an outdoor mountain trail scene"
}
```
- **Success Response (200):**
```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "prompt": "Change the background to an outdoor mountain trail scene",
  "model": "gemini-2.5-flash-image",
  "imagePath": "uploads/creatives/a1b2c3d4-e5f6-7890-abcd-ef1234567890.png",
  "status": "COMPLETED",
  "errorMessage": null,
  "tags": ["helmet", "product-shot"],
  "createdAt": "2026-03-23T14:30:00.000Z",
  "updatedAt": "2026-03-23T14:35:00.000Z"
}
```
Note: The `prompt` field is updated to the edit instruction. The image file is
overwritten with the new version.

- **Error Responses:**

| Status | Condition | Response Body |
|--------|-----------|---------------|
| 400 | Missing or invalid `prompt` | `{ "statusCode": 400, "message": ["prompt must be longer than or equal to 1 characters"], "error": "Bad Request" }` |
| 404 | Creative ID not found | `{ "statusCode": 404, "message": "Creative not found", "error": "Not Found" }` |
| 409 | Creative status is `GENERATING` or `EDITING` | `{ "statusCode": 409, "message": "Creative is currently being processed", "error": "Conflict" }` |
| 409 | Creative status is `PENDING` | `{ "statusCode": 409, "message": "Creative has no image to edit", "error": "Conflict" }` |
| 422 | Gemini API error during edit | `{ "statusCode": 422, "message": "Image editing failed: [error from Gemini]", "error": "Unprocessable Entity" }` |

- **Side Effects:**
  1. Updates `Creative` record: status → `EDITING` → `COMPLETED` (or `FAILED`), prompt updated
  2. Overwrites existing PNG file with edited version
- **Security Notes:** None.

### 4.3 GET /creatives

- **Purpose:** List all creatives with pagination and optional filters.
- **Auth:** None.
- **Path/Query Parameters:**

| Name | Type | Required | Default | Validation |
|------|------|----------|---------|------------|
| `page` | number | no | 1 | min 1, integer |
| `limit` | number | no | 20 | min 1, max 100, integer |
| `status` | string | no | — | Must be valid CreativeStatus |
| `tag` | string | no | — | Exact match against tags array |

- **Request Body:** None.
- **Success Response (200):**
```json
{
  "data": [
    {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "prompt": "Professional product photo of a motorcycle helmet...",
      "model": "gemini-2.5-flash-image",
      "imagePath": "uploads/creatives/a1b2c3d4-e5f6-7890-abcd-ef1234567890.png",
      "status": "COMPLETED",
      "errorMessage": null,
      "tags": ["helmet", "product-shot"],
      "createdAt": "2026-03-23T14:30:00.000Z",
      "updatedAt": "2026-03-23T14:30:05.000Z"
    }
  ],
  "total": 42,
  "page": 1,
  "limit": 20
}
```
- **Error Responses:**

| Status | Condition | Response Body |
|--------|-----------|---------------|
| 400 | Invalid query params (e.g., page=0, limit=200) | `{ "statusCode": 400, "message": [...], "error": "Bad Request" }` |

- **Side Effects:** None — read-only.

### 4.4 GET /creatives/:id

- **Purpose:** Get a single creative by ID.
- **Auth:** None.
- **Path/Query Parameters:**

| Name | Type | Required | Validation |
|------|------|----------|------------|
| `id` | string (UUID) | yes | Valid UUID format |

- **Request Body:** None.
- **Success Response (200):**
```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "prompt": "Professional product photo of a motorcycle helmet...",
  "model": "gemini-2.5-flash-image",
  "imagePath": "uploads/creatives/a1b2c3d4-e5f6-7890-abcd-ef1234567890.png",
  "status": "COMPLETED",
  "errorMessage": null,
  "tags": ["helmet", "product-shot"],
  "createdAt": "2026-03-23T14:30:00.000Z",
  "updatedAt": "2026-03-23T14:30:05.000Z"
}
```
- **Error Responses:**

| Status | Condition | Response Body |
|--------|-----------|---------------|
| 404 | Creative ID not found | `{ "statusCode": 404, "message": "Creative not found", "error": "Not Found" }` |

- **Side Effects:** None — read-only.

### 4.5 GET /creatives/:id/image

- **Purpose:** Serve the generated PNG image file.
- **Auth:** None.
- **Path/Query Parameters:**

| Name | Type | Required | Validation |
|------|------|----------|------------|
| `id` | string (UUID) | yes | Valid UUID format |

- **Request Body:** None.
- **Success Response (200):**
  Binary PNG data with headers:
  - `Content-Type: image/png`
  - `Content-Disposition: inline; filename="{id}.png"`

  Use NestJS `StreamableFile` to stream the file.

- **Error Responses:**

| Status | Condition | Response Body |
|--------|-----------|---------------|
| 404 | Creative ID not found | `{ "statusCode": 404, "message": "Creative not found", "error": "Not Found" }` |
| 404 | Creative exists but has no image (status PENDING or FAILED with no file) | `{ "statusCode": 404, "message": "Image not available", "error": "Not Found" }` |

- **Side Effects:** None — read-only.

### 4.6 DELETE /creatives/:id

- **Purpose:** Delete a creative record and its image file from disk.
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
| 404 | Creative ID not found | `{ "statusCode": 404, "message": "Creative not found", "error": "Not Found" }` |
| 409 | Creative status is `GENERATING` or `EDITING` | `{ "statusCode": 409, "message": "Cannot delete creative while it is being processed", "error": "Conflict" }` |

- **Side Effects:**
  1. Deletes `Creative` record from database
  2. Deletes PNG file from filesystem (if exists — don't throw if file is already gone)

## 5. Business Logic

### 5.1 Core Flow — Generate

1. Validate request body (prompt required, tags optional)
2. Create `Creative` record in DB with status `PENDING`
3. Update status to `GENERATING`
4. Call Gemini API:
   a. Initialize: `new GoogleGenAI({ apiKey: configService.get('GEMINI_API_KEY') })`
   b. Call: `ai.models.generateContent({ model: 'gemini-2.5-flash-image', contents: prompt, config: { responseModalities: ['TEXT', 'IMAGE'] } })`
   c. Extract image: iterate `response.candidates[0].content.parts`, find part with `inlineData`
   d. Decode: `Buffer.from(part.inlineData.data, 'base64')`
5. Ensure `uploads/creatives/` directory exists (`fs.mkdirSync` with `recursive: true`)
6. Save PNG to `uploads/creatives/{id}.png`
7. Update DB record: `imagePath`, status → `COMPLETED`
8. Return the creative record

**On Gemini API failure (step 4):**
- Catch the error
- Update DB record: status → `FAILED`, `errorMessage` = error message string
- Throw `UnprocessableEntityException` with the error message

### 5.2 Core Flow — Edit

1. Validate request body (prompt required)
2. Find creative by ID — throw `NotFoundException` if not found
3. Check status: must be `COMPLETED` or `FAILED`
   - If `GENERATING` or `EDITING` → throw `ConflictException("Creative is currently being processed")`
   - If `PENDING` → throw `ConflictException("Creative has no image to edit")`
4. Update status to `EDITING`
5. Read existing image from disk: `fs.readFileSync(creative.imagePath)`
6. Convert to base64: `imageBuffer.toString('base64')`
7. Call Gemini chat API:
   a. Create chat: `ai.chats.create({ model: 'gemini-2.5-flash-image', config: { responseModalities: ['TEXT', 'IMAGE'] } })`
   b. Send message with image + edit prompt:
      ```
      chat.sendMessage({
        contents: [
          { inlineData: { data: base64Image, mimeType: 'image/png' } },
          { text: editPrompt }
        ]
      })
      ```
   c. Extract new image from response (same as generate step 4c-d)
8. Overwrite existing PNG file with new image
9. Update DB record: `prompt` updated to edit instruction, status → `COMPLETED`
10. Return updated creative record

**On edit failure:**
- Catch the error
- Update DB record: status → `FAILED`, `errorMessage` = error message
- Throw `UnprocessableEntityException`

### 5.3 Core Flow — List

1. Parse query params (page, limit, status, tag)
2. Build Prisma `where` clause:
   - If `status` provided: `{ status: status }`
   - If `tag` provided: `{ tags: { has: tag } }`
   - Combine with AND
3. Run two queries in parallel:
   - `prisma.creative.findMany({ where, skip: (page-1)*limit, take: limit, orderBy: { createdAt: 'desc' } })`
   - `prisma.creative.count({ where })`
4. Return `{ data, total, page, limit }`

### 5.4 Core Flow — Delete

1. Find creative by ID — throw `NotFoundException` if not found
2. Check status: if `GENERATING` or `EDITING` → throw `ConflictException`
3. Delete DB record: `prisma.creative.delete({ where: { id } })`
4. Delete file from disk: `fs.unlinkSync(creative.imagePath)` — wrap in try/catch,
   ignore `ENOENT` (file already gone)

### 5.5 External Service Interactions

**Google Gemini API** via `@google/genai` SDK:
- Authentication: API key from `GEMINI_API_KEY` env var
- Model: `gemini-2.5-flash-image`
- Generate: `ai.models.generateContent()` with `responseModalities: ['TEXT', 'IMAGE']`
- Edit: `ai.chats.create()` → `chat.sendMessage()` with image + text

⚠️ NEEDS VERIFICATION: The exact `@google/genai` SDK API for chat-based image
editing should be verified against the latest SDK documentation before implementation.
The SDK has undergone breaking changes (the old `@google/generative-ai` package is
deprecated). Verify:
1. `ai.chats.create()` method signature and config options
2. How to pass `inlineData` (image bytes) in `sendMessage()`
3. Whether `responseModalities` config is needed for chat mode
4. Whether the response shape for chat is the same as `generateContent`

### 5.6 Multi-Tenancy / Tenant Isolation
Not applicable — single-tenant service.

## 6. Exemplars

### 6.1 Reference Module
No existing feature modules yet. This is the first. Use the scaffold's `AppService`
and `AppController` as the closest reference for NestJS patterns (Logger usage,
PrismaClient usage, controller decorators).

### 6.2 What to Replicate
From `src/app.service.ts`:
- `private readonly logger = new Logger(CreativesService.name)` pattern
- Try/catch with `this.logger.warn()` for external service failures

From `src/app.module.ts`:
- `@Module` decorator with `imports`, `controllers`, `providers`

### 6.3 What NOT to Replicate
From `src/app.service.ts`:
- Do NOT create a local `PrismaClient` instance — use the shared `PrismaService`
  via dependency injection instead
- Do NOT implement `OnModuleDestroy` for Prisma — that's handled by `PrismaService`

## 7. Constraints

### 7.1 Forbidden Approaches
- Do NOT use `@google/generative-ai` — it is deprecated. Use `@google/genai`.
- Do NOT create a local `PrismaClient` in `CreativesService` — inject `PrismaService`.
- Do NOT store images as base64 in the database — save to filesystem.
- Do NOT use `multer` or file upload middleware — the caller does not upload images.
- Do NOT add Swagger decorators.
- Do NOT add authentication guards.
- Do NOT create files in `test/`.
- Do NOT make the generate/edit endpoints asynchronous (no queues, no background jobs).
- Do NOT add image processing (resize, convert, optimize).
- Do NOT hardcode the Gemini API key — read from ConfigService.

### 7.2 Error Handling
Use NestJS built-in exceptions:
- `NotFoundException` — creative not found (404)
- `ConflictException` — cannot delete/edit while processing (409)
- `UnprocessableEntityException` — Gemini API failure (422)
- `BadRequestException` — invalid input (400, auto-thrown by class-validator)

### 7.3 Logging
Use NestJS `Logger` in all services:
- `CreativesService`: `new Logger(CreativesService.name)`
  - `logger.log()` — successful generation/edit (INFO)
  - `logger.warn()` — Gemini API failure, file not found on delete (WARN)
  - `logger.error()` — unexpected errors (ERROR)
- `GeminiService`: `new Logger(GeminiService.name)`
  - `logger.log()` — API call initiated (INFO)
  - `logger.warn()` — API call failed (WARN)

### 7.4 Protected Files
- `test/**` — Do NOT create, modify, or delete any files in the test directory.

## 8. Frontend Impact

### Verdict C — "Frontend not required"
- **Why not needed:** This is a backend API module. The creative generation pipeline
  is operated via API calls (curl/Postman). There is no user-facing UI in this project.
- **End-to-end usability confirmed:** A developer can generate, view, edit, list, and
  delete creatives entirely through HTTP API calls without any frontend.

## 9. Acceptance Criteria

### 9.1 Functional
- [ ] `POST /api/v1/creatives/generate` with a prompt returns HTTP 201 with creative record
- [ ] Generated image is saved to `uploads/creatives/{id}.png`
- [ ] `GET /api/v1/creatives/:id` returns the creative record with status `COMPLETED`
- [ ] `GET /api/v1/creatives/:id/image` serves the PNG file with correct Content-Type
- [ ] `POST /api/v1/creatives/:id/edit` with an edit prompt returns HTTP 200 with updated creative
- [ ] Edit overwrites the existing image file with the refined version
- [ ] `GET /api/v1/creatives` returns paginated list with `data`, `total`, `page`, `limit`
- [ ] `GET /api/v1/creatives?status=COMPLETED` filters by status
- [ ] `GET /api/v1/creatives?tag=helmet` filters by tag
- [ ] `DELETE /api/v1/creatives/:id` returns HTTP 204 and removes record + file
- [ ] `DELETE` on a `GENERATING` creative returns HTTP 409
- [ ] Generation failure saves record with status `FAILED` and returns HTTP 422
- [ ] Edit on a `PENDING` creative returns HTTP 409
- [ ] Missing creative returns HTTP 404
- [ ] Missing image file on GET /:id/image returns HTTP 404

### 9.2 Tenant Isolation
Not applicable — single-tenant service.

### 9.3 Structural
- [ ] Files in correct directories per ARCHITECTURE.md (`src/modules/creatives/`, `src/modules/gemini/`, `src/prisma/`)
- [ ] `CreativesModule` registered in `AppModule` imports
- [ ] `PrismaModule` registered in `AppModule` imports (global)
- [ ] `GeminiModule` registered in `AppModule` imports
- [ ] Prisma schema has `Creative` model with all 9 fields
- [ ] DTOs use `class-validator` decorators for input validation
- [ ] No `console.log` statements — use NestJS `Logger`
- [ ] No files created inside `test/`
- [ ] `uploads/` added to `.gitignore`
- [ ] `GEMINI_API_KEY` made required in env validation

### 9.4 Build
- [ ] `npm run build` passes
- [ ] `npm run lint` passes
- [ ] `npm run test` passes (zero tests, clean exit)
- [ ] `npx prisma generate` succeeds with the updated schema
