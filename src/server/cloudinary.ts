import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';

// Configure Cloudinary from environment variables
// Supports both CLOUDINARY_URL or CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET.
if (process.env.CLOUDINARY_URL) {
  cloudinary.config({
    cloudinary_url: process.env.CLOUDINARY_URL,
    secure: true,
  });
} else if (
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

export function isCloudinaryConfigured(): boolean {
  const config = cloudinary.config();
  return Boolean(config.cloud_name && config.api_key && config.api_secret);
}

export function getCloudinaryConfigInfo() {
  const config = cloudinary.config();
  return {
    configured: isCloudinaryConfigured(),
    cloud_name: config.cloud_name || null,
    folder: 'addis_baltina/products',
  };
}

export interface UploadResult {
  success: boolean;
  url: string;
  public_id: string;
  format?: string;
  width?: number;
  height?: number;
  bytes?: number;
  provider: 'cloudinary' | 'local_fallback';
  message?: string;
}

export async function uploadImage(
  fileData: string,
  options?: {
    folder?: string;
    public_id?: string;
    tags?: string[];
  }
): Promise<UploadResult> {
  if (isCloudinaryConfigured()) {
    try {
      const folder = options?.folder || 'addis_baltina/products';
      const result: UploadApiResponse = await cloudinary.uploader.upload(fileData, {
        folder,
        public_id: options?.public_id,
        tags: options?.tags || ['addis_baltina', 'product'],
        resource_type: 'image',
        transformation: [
          { quality: 'auto:good' },
          { fetch_format: 'auto' },
        ],
      });

      return {
        success: true,
        url: result.secure_url,
        public_id: result.public_id,
        format: result.format,
        width: result.width,
        height: result.height,
        bytes: result.bytes,
        provider: 'cloudinary',
      };
    } catch (error: any) {
      console.error('[Cloudinary Upload Error]:', error);
      throw new Error(error.message || 'Cloudinary upload failed');
    }
  }

  // Graceful fallback when credentials are not yet configured in environment
  console.warn(
    '[Cloudinary] Environment credentials (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET or CLOUDINARY_URL) not set. Storing image with fallback URL.'
  );

  const fallbackId = `fallback_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  return {
    success: true,
    url: fileData,
    public_id: fallbackId,
    provider: 'local_fallback',
    message:
      'Cloudinary credentials not configured in environment. The image is saved locally in demo mode. Add CLOUDINARY_* to your environment variables to enable Cloudinary CDN storage.',
  };
}

export async function deleteFromCloudinary(publicId: string): Promise<boolean> {
  if (!isCloudinaryConfigured()) {
    return true;
  }
  try {
    const res = await cloudinary.uploader.destroy(publicId);
    return res.result === 'ok';
  } catch (err) {
    console.error('[Cloudinary Delete Error]:', err);
    return false;
  }
}

export { cloudinary };
