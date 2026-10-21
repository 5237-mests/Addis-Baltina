/**
 * Validation for image sources accepted by `POST /api/v1/upload`.
 *
 * The endpoint accepts either an inline base64 data URI or an HTTPS URL that a
 * trusted host serves. Arbitrary remote URLs are rejected because Cloudinary
 * would otherwise fetch them on our behalf — an SSRF vector (internal
 * metadata endpoints, localhost services, cloud provider metadata, ...).
 *
 * Allowed hosts can be extended with the comma-separated `UPLOAD_ALLOWED_HOSTS`
 * environment variable (e.g. a company CDN).
 */

const DATA_URI_PATTERN =
  /^data:image\/(?:png|jpe?g|webp|gif|avif);base64,[A-Za-z0-9+/=\r\n]+$/i;

const DEFAULT_ALLOWED_HOSTS = ['res.cloudinary.com', 'images.unsplash.com'];

export type ImageSourceCheck =
  | { valid: true; kind: 'data_uri' | 'remote_url'; host?: string }
  | { valid: false; reason: string };

function allowedHosts(): string[] {
  const configured = (process.env.UPLOAD_ALLOWED_HOSTS || '')
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
  return [...DEFAULT_ALLOWED_HOSTS, ...configured];
}

/** Returns the validated image source, or a user-safe rejection reason. */
export function checkImageSource(source: unknown): ImageSourceCheck {
  if (typeof source !== 'string' || source.trim().length === 0) {
    return { valid: false, reason: 'Image data (base64 data URI or image URL) is required' };
  }

  const value = source.trim();

  if (value.toLowerCase().startsWith('data:')) {
    if (!DATA_URI_PATTERN.test(value)) {
      return {
        valid: false,
        reason: 'Only base64 PNG, JPEG, WEBP, GIF or AVIF data URIs are accepted',
      };
    }
    return { valid: true, kind: 'data_uri' };
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { valid: false, reason: 'Image URL is not a valid absolute URL' };
  }

  if (url.protocol !== 'https:') {
    return { valid: false, reason: 'Image URLs must use HTTPS' };
  }

  const host = url.hostname.toLowerCase();
  if (!allowedHosts().includes(host)) {
    return {
      valid: false,
      reason: `Image host "${host}" is not allowed. Upload a file instead.`,
    };
  }

  return { valid: true, kind: 'remote_url', host };
}
