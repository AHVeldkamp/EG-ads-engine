export const BRAND_ASSETS_UPLOAD_DIR = 'uploads/brand-assets';

export const ALLOWED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/svg+xml',
  'image/webp',
];

export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

export const MIME_TO_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/svg+xml': 'svg',
  'image/webp': 'webp',
};
