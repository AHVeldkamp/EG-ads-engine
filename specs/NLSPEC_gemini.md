# NLSpec: Gemini (Google Gemini AI Integration)

## 1. Overview

The Gemini module is a service-only integration layer (no controller/endpoints) that wraps the `@google/genai` SDK to provide image generation and editing capabilities using Google's Gemini multimodal models. It is the AI backbone for the Creatives module.

## 2. Data Model

No Prisma models. This module operates on image buffers (binary data).

## 3. Endpoints

None. This is a service-only module consumed by the Creatives module.

## 4. Business Logic

### Initialization
On construction, reads `GEMINI_API_KEY` from environment variables and instantiates `GoogleGenAI`.

### `generateImage(prompt, model)`
Generates an image from a text prompt.
1. Calls `ai.models.generateContent()` with the prompt and `responseModalities: ['TEXT', 'IMAGE']`.
2. Extracts the image from the response via `extractImageFromResponse()`.
3. Returns a `Buffer` containing the PNG image data.

### `editImage(imageBuffer, editPrompt, model)`
Edits an existing image using a conversational approach.
1. Converts the input image to base64.
2. Creates a chat session with `ai.chats.create()` using `responseModalities: ['TEXT', 'IMAGE']`.
3. Sends a message containing both the image (as `inlineData` with `image/png` mimeType) and the edit prompt text.
4. Extracts and returns the new image buffer from the response.

### `generateFromSeedImage(seedImageBuffer, seedMimeType, prompt, model)`
Generates a new original image inspired by a seed/reference image.
1. Converts the seed image to base64.
2. Calls `ai.models.generateContent()` with a multipart content array containing the seed image and an augmented prompt that instructs Gemini to create a NEW image inspired by (not a modification of) the seed.
3. The system prompt prefix: "Create a completely NEW original image inspired by the attached seed/reference image. Do NOT edit or modify the seed image directly. Use it only as visual inspiration for style, composition, and mood."
4. Returns the generated image buffer.

### `extractImageFromResponse(response)` (private)
Parses the Gemini API response structure:
1. Navigates `response.candidates[0].content.parts`.
2. Iterates parts looking for one with `inlineData`.
3. Decodes the base64 `inlineData.data` into a Buffer.
4. Throws `Error('No content parts in Gemini response')` if no candidates/parts exist.
5. Throws `Error('No image data found in Gemini response')` if no part contains `inlineData`.

## 5. External Integrations

| Service | SDK | Purpose |
|---------|-----|---------|
| Google Gemini API | `@google/genai` (GoogleGenAI) | Text-to-image generation, image editing, seed-image-based generation |

Default model used by the Creatives module: `gemini-2.5-flash-image`.

## 6. Error Handling

| Scenario | Behavior |
|----------|----------|
| Gemini API call fails | Logs warning, re-throws the original error |
| No content parts in response | Throws `Error('No content parts in Gemini response')` |
| No image data in response parts | Throws `Error('No image data found in Gemini response')` |

Errors are not wrapped — they propagate as-is to the Creatives service, which handles status updates and HTTP response mapping.
