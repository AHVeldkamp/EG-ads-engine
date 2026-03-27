# NLSpec: Creatives (Text-to-Image Generation)

## 1. Overview

The Creatives module handles AI-powered ad creative image generation. Users provide a text prompt and optional tags; the system generates an image via Google Gemini, stores it on disk, and tracks the creative's lifecycle through status transitions (PENDING -> GENERATING -> COMPLETED/FAILED). The module also supports editing existing creatives by sending the current image plus a new prompt back to Gemini.

Note: Seed-image generation and brand-asset overlay capabilities are covered in the separate `NLSPEC_brand-assets-and-image-seeded-creatives.md` spec.

## 2. Data Model

```prisma
enum CreativeStatus {
  PENDING
  GENERATING
  COMPLETED
  EDITING
  FAILED
}

model Creative {
  id           String         @id @default(uuid())
  prompt       String
  model        String         @default("gemini-2.5-flash-image")
  imagePath    String?
  status       CreativeStatus @default(PENDING)
  errorMessage String?
  tags         String[]       @default([])
  createdAt    DateTime       @default(now())
  updatedAt    DateTime       @updatedAt

  ads          Ad[]

  @@map("creatives")
}
```

## 3. Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/creatives/generate` | Generate a new creative from a text prompt (JSON body) or with seed image (multipart form) |
| POST | `/creatives/:id/edit` | Edit an existing creative's image using a new prompt |
| GET | `/creatives` | List creatives with pagination, optional status and tag filters |
| GET | `/creatives/:id` | Get a single creative by ID |
| GET | `/creatives/:id/image` | Stream the creative's PNG image as a binary response |
| DELETE | `/creatives/:id` | Delete a creative and its image file |

## 4. Business Logic

### `generate(dto)`
1. Creates a Creative record with status PENDING.
2. Transitions to GENERATING.
3. Calls `GeminiService.generateImage()` with the prompt and default model (`gemini-2.5-flash-image`).
4. Writes the returned image buffer to `uploads/creatives/{id}.png`.
5. Sets status to COMPLETED with the `imagePath` stored.
6. On failure: sets status to FAILED with `errorMessage`, throws `UnprocessableEntityException`.

### `edit(id, dto)`
1. Finds the creative; throws NotFoundException if missing.
2. Rejects if status is GENERATING or EDITING (ConflictException).
3. Rejects if status is PENDING — no image to edit (ConflictException).
4. Transitions to EDITING.
5. Reads the current image from disk, sends it plus the new prompt to `GeminiService.editImage()`.
6. Overwrites the image file with the new result.
7. Updates prompt and sets status to COMPLETED.
8. On failure: sets status to FAILED, throws `UnprocessableEntityException`.

### `findAll(query)`
Paginated listing (default 20, max 100). Filters by `status` (enum) and `tag` (array `has` check). Returns `{ data, total, page, limit }`.

### `getImageBuffer(id)`
Reads the image file from the creative's `imagePath`. Returns the buffer for streaming. Throws NotFoundException if the creative or file is missing.

### `remove(id)`
Rejects deletion if creative is currently GENERATING or EDITING (ConflictException). Deletes the DB record and the image file from disk. Silently ignores ENOENT errors on file deletion.

## 5. External Integrations

| Service | Purpose |
|---------|---------|
| Google Gemini (`GeminiService`) | `generateImage()` for text-to-image; `editImage()` for image editing with prompt |

Images are stored locally at `uploads/creatives/{creative_id}.png`.

## 6. Error Handling

| Scenario | Response |
|----------|----------|
| Creative not found | 404 NotFoundException |
| Generate/edit while GENERATING or EDITING | 409 ConflictException |
| Edit when PENDING (no image) | 409 ConflictException |
| Delete while GENERATING or EDITING | 409 ConflictException |
| Gemini API failure | 422 UnprocessableEntityException; creative status set to FAILED with error message |
| Image file missing on read | 404 NotFoundException |
| Prompt too long (>2000 chars) | 400 validation error |
| Too many tags (>10) or tag too long (>50 chars) | 400 validation error |
