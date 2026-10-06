import { v2 as cloudinary, UploadApiResponse, UploadApiErrorResponse } from 'cloudinary';
import { env } from '../config/env';
import { Readable } from 'stream';

// ─── Configure Cloudinary SDK ─────────────────────────────────────────────────

let configured = false;

const ensureConfigured = (): void => {
  if (configured) return;
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });
  configured = true;
};

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CloudinaryUploadOptions {
  /** Cloudinary folder path, e.g. "derma-tracker/hospitals/Apollo/patients/PAT-001_Ravi" */
  folder: string;
  /** Fixed public_id for predictable URLs (e.g. "hospital-logo"). Omit for auto-generated IDs. */
  publicId?: string;
  /** Overwrite existing asset with same public_id (useful for logos/banners) */
  overwrite?: boolean;
  /** Tags for organization & search (e.g. ["scalp", "PAT-001"]) */
  tags?: string[];
}

export interface CloudinaryResult {
  /** Full HTTPS URL with auto-optimization */
  secure_url: string;
  /** Unique Cloudinary public ID (used for deletion) */
  public_id: string;
  /** Original width in pixels */
  width: number;
  /** Original height in pixels */
  height: number;
  /** Format delivered (e.g. "jpg", "png", "webp") */
  format: string;
  /** File size in bytes */
  bytes: number;
}

// ─── Core Functions ───────────────────────────────────────────────────────────

/**
 * Returns true if Cloudinary is enabled, credentials are configured,
 * and LOCALSTORAGE_ENABLED is not set to true.
 */
export const isEnabled = (): boolean => {
  if (env.LOCALSTORAGE_ENABLED === 'true') {
    return false;
  }
  return (
    env.CLOUDINARY_ENABLED === 'true' &&
    !!env.CLOUDINARY_CLOUD_NAME &&
    !!env.CLOUDINARY_API_KEY &&
    !!env.CLOUDINARY_API_SECRET
  );
};

/**
 * Upload a file buffer to Cloudinary.
 * Returns the secure URL and public_id for storage in MongoDB.
 */
export const uploadImage = (
  buffer: Buffer,
  originalFilename: string,
  options: CloudinaryUploadOptions
): Promise<CloudinaryResult> => {
  ensureConfigured();

  return new Promise((resolve, reject) => {
    const uploadOptions: Record<string, any> = {
      folder: options.folder,
      resource_type: 'image',
      overwrite: options.overwrite ?? false,
      invalidate: options.overwrite ? true : false,
      // Preserve quality — no Cloudinary-side compression for medical images
      quality: 'auto:best',
      fetch_format: 'auto',
    };

    if (options.publicId) {
      uploadOptions.public_id = options.publicId;
    }

    if (options.tags && options.tags.length > 0) {
      uploadOptions.tags = options.tags;
    }

    const uploadStream = cloudinary.uploader.upload_stream(
      uploadOptions,
      (error: UploadApiErrorResponse | undefined, result: UploadApiResponse | undefined) => {
        if (error) {
          console.error('[Cloudinary] Upload error:', error.message);
          return reject(new Error(`Cloudinary upload failed: ${error.message}`));
        }
        if (!result) {
          return reject(new Error('Cloudinary upload returned no result'));
        }
        resolve({
          secure_url: result.secure_url,
          public_id: result.public_id,
          width: result.width,
          height: result.height,
          format: result.format,
          bytes: result.bytes,
        });
      }
    );

    // Pipe the buffer into the upload stream
    const readable = new Readable();
    readable.push(buffer);
    readable.push(null);
    readable.pipe(uploadStream);
  });
};

/**
 * Delete an image from Cloudinary by its public_id.
 */
export const deleteImage = async (publicId: string): Promise<void> => {
  ensureConfigured();
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: 'image', invalidate: true });
    console.log(`[Cloudinary] Deleted: ${publicId}`);
  } catch (error: any) {
    console.error(`[Cloudinary] Delete error for ${publicId}:`, error.message);
  }
};

/**
 * Extract the Cloudinary public_id from a full secure_url.
 * e.g. "https://res.cloudinary.com/dxyz/image/upload/v123/derma-tracker/hospitals/Apollo/logo.jpg"
 *   → "derma-tracker/hospitals/Apollo/logo"
 */
export const extractPublicId = (url: string): string | null => {
  try {
    const match = url.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.\w+)?$/);
    return match ? (match[1] ?? null) : null;
  } catch {
    return null;
  }
};

/**
 * Check if a stored image path/URL is a Cloudinary URL.
 */
export const isCloudinaryUrl = (value: string): boolean => {
  return value.startsWith('https://res.cloudinary.com/');
};

/**
 * Build the Cloudinary folder path for a scalp image.
 */
export const buildScalpFolder = (hospitalName: string, patientId: string, patientName: string): string => {
  const safeHosp = sanitize(hospitalName || 'General_Hospital');
  const safePatient = sanitize(`${patientId || 'PAT-UNKNOWN'}_${patientName || 'Patient'}`);
  return `derma-tracker/hospitals/${safeHosp}/patients/${safePatient}`;
};

/**
 * Build the Cloudinary folder path for hospital branding.
 */
export const buildHospitalFolder = (hospitalName: string): string => {
  const safeHosp = sanitize(hospitalName || 'General_Hospital');
  return `derma-tracker/hospitals/${safeHosp}`;
};

/**
 * Build the Cloudinary folder path for medicine images.
 */
export const buildMedicineFolder = (hospitalName: string): string => {
  const safeHosp = sanitize(hospitalName || 'General_Hospital');
  return `derma-tracker/hospitals/${safeHosp}/medicines`;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const sanitize = (str: string): string => {
  return (str || '').replace(/[/\\?%*:|"<>]/g, '_').trim();
};
