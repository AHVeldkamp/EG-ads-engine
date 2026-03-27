# NLSpec: Brand Assets & Image-Seeded Creative Generation

## 1. Overview

Extend the EG-ads-engine with two new capabilities:

1. **Brand Assets** — a module to upload and manage brand elements (logos, watermarks) that can be referenced by ID when generating creatives. These are composited pixel-perfect using image processing, never by AI.
2. **Image-Seeded Generation** — extend the creatives module to accept a seed/inspiration image alongside a text prompt. The AI generates a completely new image inspired by the seed, then optionally composites brand assets on top.

## 2. Brand Assets Module

### 2.1 Data Model

New Prisma model `BrandAsset`:

```
model BrandAsset {
  id          String   @id @default(uuid())
  name        String
  type        String   // "logo", "watermark", "badge"
  filePath    String
  mimeType    String
  width       Int
  height      Int
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@map("brand_assets")
}
```

### 2.2 Endpoints

All under `/api/v1/brand-assets`:

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/` | Upload a brand asset (multipart/form-data: `file` + `name` + `type`) |
| `GET` | `/` | List all brand assets |
| `GET` | `/:id` | Get brand asset metadata |
| `GET` | `/:id/image` | Get brand asset image file |
| `DELETE` | `/:id` | Delete a brand asset |

### 2.3 Upload Rules

- Accepted MIME types: `image/png`, `image/jpeg`, `image/svg+xml`, `image/webp`
- Max file size: 5 MB
- Files stored in `uploads/brand-assets/` directory
- Image dimensions (width/height) extracted and stored on upload using sharp or Pillow equivalent

### 2.4 Storage

Files stored at `uploads/brand-assets/{id}.{ext}`. The `filePath` field stores the full relative path.

## 3. Image-Seeded Creative Generation

### 3.1 Extended Generate Endpoint

Extend `POST /api/v1/creatives/generate` to accept `multipart/form-data` instead of JSON when a seed image is provided:

**Fields:**
- `prompt` (string, required) — text prompt for generation
- `tags` (string[], optional) — tags for the creative
- `seedImage` (file, optional) — inspiration/seed image
- `brandAssetId` (string, optional) — UUID of a brand asset to composite on top
- `brandAssetPosition` (string, optional) — placement of brand asset: `top-left`, `top-right`, `top-center`, `bottom-left`, `bottom-right`, `bottom-center`. Default: `bottom-right`
- `brandAssetScale` (number, optional) — scale as percentage of image width (5-50). Default: `25`

**Backward compatibility:** The endpoint must continue to accept `application/json` requests (prompt + tags only) for the existing text-only generation flow. When `Content-Type` is `multipart/form-data`, parse the form fields instead.

### 3.2 Generation Flow

1. If `seedImage` is provided:
   - Save seed temporarily
   - Send seed image + prompt to Gemini with instruction to create a NEW original image inspired by the seed (not edit it)
   - Use model `gemini-2.5-flash-image`
2. If no `seedImage`:
   - Existing text-only flow (unchanged)
3. If `brandAssetId` is provided:
   - After AI generation completes, load the brand asset image
   - Composite it onto the generated image at the specified position and scale using image processing (Pillow/sharp — NOT AI)
   - The brand asset must be placed pixel-perfect with transparency preserved (PNG alpha channel)
4. Save final image to `uploads/creatives/{id}.png`
5. Return creative record with `imagePath`

### 3.3 Gemini Service Extension

Add method to `GeminiService`:

```typescript
async generateFromSeedImage(
  seedImageBuffer: Buffer,
  seedMimeType: string,
  prompt: string,
  model: string,
): Promise<Buffer>
```

This method sends the seed image + prompt to Gemini with `responseModalities: ['TEXT', 'IMAGE']`, instructing it to create a new image inspired by the seed.

### 3.4 Image Compositing Service

New service `ImageCompositeService` (can live in `common/` or in `creatives/`):

```typescript
async compositeOverlay(
  baseImageBuffer: Buffer,
  overlayImageBuffer: Buffer,
  position: BrandAssetPosition,
  scalePercent: number,
): Promise<Buffer>
```

Uses the `sharp` npm package to:
1. Resize overlay to `scalePercent`% of base image width (maintain aspect ratio)
2. Calculate x/y based on `position` enum with padding (3% of image dimensions)
3. Composite overlay on base with alpha transparency
4. Return resulting PNG buffer

## 4. Dependencies

Add to `package.json`:
- `sharp` — image processing (resize, composite)
- `@nestjs/platform-express` already provides `multer` for file uploads

## 5. Database Migration

Add `BrandAsset` table via Prisma migration.

## 6. Error Handling

- Upload non-image file → 400 Bad Request
- Upload exceeds 5 MB → 413 Payload Too Large
- Reference non-existent brand asset ID → 404 Not Found
- Gemini generation fails → 422 Unprocessable Entity (existing pattern)
- Compositing fails → 422 Unprocessable Entity

## 7. Frontend

Frontend: Not required — this is an API-only service. Operational interaction happens via the dark-factory agent (Claude) calling the API.

## 8. File Structure

```
src/modules/brand-assets/
├── brand-assets.module.ts
├── brand-assets.controller.ts
├── brand-assets.service.ts
├── brand-assets.dto.ts
└── brand-assets.types.ts

src/common/
└── image-composite.service.ts
```

Modifications to existing files:
- `src/modules/creatives/creatives.controller.ts` — accept multipart
- `src/modules/creatives/creatives.service.ts` — handle seed image + brand asset compositing
- `src/modules/creatives/creatives.dto.ts` — new DTO fields
- `src/modules/gemini/gemini.service.ts` — add `generateFromSeedImage`
- `src/app.module.ts` — register `BrandAssetsModule`
- `prisma/schema.prisma` — add `BrandAsset` model
- `src/config/env.validation.ts` — no changes (no new env vars needed)
