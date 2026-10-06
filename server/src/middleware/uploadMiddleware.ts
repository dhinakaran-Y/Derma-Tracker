import multer from 'multer';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorMiddleware';
import * as cloudinaryService from '../services/cloudinaryService';

export type UploadCategory = 'scalp' | 'hospitals' | 'medicines';

export const getUploadCategoryDir = (category?: UploadCategory): string => {
  const base = path.join(process.cwd(), 'uploads');
  const target = category ? path.join(base, category) : base;
  if (!fs.existsSync(target)) {
    fs.mkdirSync(target, { recursive: true });
  }
  return target;
};

// Ensure all categorized directories exist on startup
getUploadCategoryDir('scalp');
getUploadCategoryDir('hospitals');
getUploadCategoryDir('medicines');

export const createCategoryStorage = (category?: UploadCategory) =>
  multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, getUploadCategoryDir(category));
    },
    filename: (_req, file, cb) => {
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
      cb(null, `${uniqueSuffix}${ext}`);
    },
  });

/**
 * When Cloudinary is enabled, use memory storage so we get a buffer
 * that can be streamed to Cloudinary. When disabled, use disk storage.
 */
export const createSmartStorage = (category?: UploadCategory) => {
  if (cloudinaryService.isEnabled()) {
    return multer.memoryStorage();
  }
  return createCategoryStorage(category);
};

export const sanitizeFolderName = (str: string): string => {
  return (str || '').replace(/[/\\?%*:|"<>]/g, '_').trim();
};

/**
 * Moves an uploaded scalp examination photo into its permanent hierarchical location:
 * uploads/hospitals/<Hospital Name>/patients/<Patient ID>_<Patient Name>/<filename>
 */
export const storeScalpImageInHierarchy = (
  file: Express.Multer.File,
  hospitalName?: string,
  patientId?: string,
  patientName?: string
): string => {
  const safeHosp = sanitizeFolderName(hospitalName || 'General_Hospital');
  const safePatient = sanitizeFolderName(`${patientId || 'PAT-UNKNOWN'}_${patientName || 'Patient'}`);
  const targetDir = path.join(process.cwd(), 'uploads', 'hospitals', safeHosp, 'patients', safePatient);

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const targetPath = path.join(targetDir, file.filename);
  if (file.path && fs.existsSync(file.path) && file.path !== targetPath) {
    fs.renameSync(file.path, targetPath);
    file.path = targetPath;
  }
  return targetPath;
};

/**
 * Cloud-aware scalp image upload.
 * When Cloudinary is enabled, uploads buffer to cloud and returns the https:// URL.
 * When disabled, falls back to local disk hierarchy.
 */
export const storeScalpImage = async (
  file: Express.Multer.File,
  hospitalName?: string,
  patientId?: string,
  patientName?: string
): Promise<string> => {
  if (cloudinaryService.isEnabled() && file.buffer) {
    const folder = cloudinaryService.buildScalpFolder(
      hospitalName || 'General_Hospital',
      patientId || 'PAT-UNKNOWN',
      patientName || 'Patient'
    );
    const result = await cloudinaryService.uploadImage(file.buffer, file.originalname, {
      folder,
      tags: ['scalp', patientId || 'unknown'].filter(Boolean) as string[],
    });
    return result.secure_url;
  }
  // Fallback: local disk
  storeScalpImageInHierarchy(file, hospitalName, patientId, patientName);
  return file.filename;
};

/**
 * Moves an uploaded hospital logo/banner into its permanent location:
 * uploads/hospitals/<Hospital Name>/hospital-logo.<ext> or hospital-banner.<ext>
 */
export const storeHospitalMediaInHierarchy = (
  file: Express.Multer.File,
  hospitalName?: string,
  kind?: 'logo' | 'banner' | string
): string => {
  const safeHosp = sanitizeFolderName(hospitalName || 'General_Hospital');
  const targetDir = path.join(process.cwd(), 'uploads', 'hospitals', safeHosp);

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  let finalFilename = file.filename;
  if (kind === 'logo' || kind === 'banner') {
    const ext = path.extname(file.originalname || file.filename) || '.jpeg';
    const baseName = kind === 'logo' ? 'hospital-logo' : 'hospital-banner';
    finalFilename = `${baseName}${ext.toLowerCase()}`;

    // Clean up any older file with different extension (e.g. hospital-logo.png if now uploading hospital-logo.jpeg)
    try {
      if (fs.existsSync(targetDir)) {
        const existing = fs.readdirSync(targetDir);
        for (const f of existing) {
          if (f.startsWith(`${baseName}.`) && f !== finalFilename) {
            const oldFilePath = path.join(targetDir, f);
            if (fs.existsSync(oldFilePath) && !fs.lstatSync(oldFilePath).isSymbolicLink()) {
              fs.unlinkSync(oldFilePath);
            }
          }
        }
      }
    } catch {}
  }

  const targetPath = path.join(targetDir, finalFilename);
  if (file.path && fs.existsSync(file.path) && file.path !== targetPath) {
    fs.renameSync(file.path, targetPath);
    file.path = targetPath;
  }
  file.filename = finalFilename;
  return targetPath;
};

/**
 * Cloud-aware hospital media upload (logo / banner).
 * When Cloudinary is enabled, uploads buffer with a fixed publicId so
 * re-uploads overwrite the previous logo/banner.
 */
export const storeHospitalMedia = async (
  file: Express.Multer.File,
  hospitalName?: string,
  kind?: 'logo' | 'banner' | string
): Promise<string> => {
  if (cloudinaryService.isEnabled() && file.buffer) {
    const folder = cloudinaryService.buildHospitalFolder(hospitalName || 'General_Hospital');
    const publicId = kind === 'logo' ? 'hospital-logo' : kind === 'banner' ? 'hospital-banner' : undefined;
    const result = await cloudinaryService.uploadImage(file.buffer, file.originalname, {
      folder,
      publicId,
      overwrite: true,
      tags: ['hospital', kind || 'branding'],
    });
    return result.secure_url;
  }
  // Fallback: local disk
  storeHospitalMediaInHierarchy(file, hospitalName, kind);
  return file.filename;
};


/**
 * Moves an uploaded medicine catalog image into its hospital-specific medicines folder:
 * uploads/hospitals/<Hospital Name>/medicines/<filename>
 */
export const storeMedicineImageInHierarchy = (
  file: Express.Multer.File,
  hospitalName?: string
): string => {
  const safeHosp = sanitizeFolderName(hospitalName || 'General_Hospital');
  const targetDir = path.join(process.cwd(), 'uploads', 'hospitals', safeHosp, 'medicines');

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const targetPath = path.join(targetDir, file.filename);
  if (file.path && fs.existsSync(file.path) && file.path !== targetPath) {
    fs.renameSync(file.path, targetPath);
    file.path = targetPath;
  }
  return targetPath;
};

/**
 * Cloud-aware medicine image upload.
 * When Cloudinary is enabled, uploads buffer to the hospital's medicines folder.
 */
export const storeMedicineImage = async (
  file: Express.Multer.File,
  hospitalName?: string
): Promise<string> => {
  if (cloudinaryService.isEnabled() && file.buffer) {
    const folder = cloudinaryService.buildMedicineFolder(hospitalName || 'General_Hospital');
    const result = await cloudinaryService.uploadImage(file.buffer, file.originalname, {
      folder,
      tags: ['medicine', hospitalName || 'general'],
    });
    return result.secure_url;
  }
  // Fallback: local disk
  storeMedicineImageInHierarchy(file, hospitalName);
  return file.filename;
};

const fileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new AppError('Only genuine JPEG, PNG, and WebP images are permitted.', 400, 'UNSUPPORTED_MEDIA_TYPE'));
  }
};

/** Specialized uploader for patient scalp examination photos */
export const uploadScalp = multer({
  storage: createSmartStorage('scalp'),
  fileFilter,
  limits: { fileSize: 25 * 1024 * 1024 },
});

/** Specialized uploader for hospital logos and facility photos */
export const uploadHospital = multer({
  storage: createSmartStorage('hospitals'),
  fileFilter,
  limits: { fileSize: 25 * 1024 * 1024 },
});

/** Specialized uploader for pharmacy medicine catalog packaging */
export const uploadMedicine = multer({
  storage: createSmartStorage('medicines'),
  fileFilter,
  limits: { fileSize: 25 * 1024 * 1024 },
});

/** Default fallback uploader (defaults to scalp category) */
export const upload = uploadScalp;
/**
 * Validates actual binary magic bytes (first 12 bytes of file on disk)
 * to prevent MIME spoofing attacks.
 */
export const verifyImageMagicBytes = (filePath: string): boolean => {
  try {
    const fd = fs.openSync(filePath, 'r');
    const buffer = Buffer.alloc(12);
    fs.readSync(fd, buffer, 0, 12, 0);
    fs.closeSync(fd);

    const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    const isPng =
      buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47 &&
      buffer[4] === 0x0d && buffer[5] === 0x0a && buffer[6] === 0x1a && buffer[7] === 0x0a;
    const isWebp =
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP';

    return isJpeg || isPng || isWebp;
  } catch {
    return false;
  }
};

/**
 * Strips EXIF, GPS location coordinates, camera serial numbers, and device tags
 * from uploaded scalp photos and medical images using Sharp,
 * while strictly preserving 100% original quality and color fidelity.
 */
export const stripImageExif = async (filePath: string): Promise<void> => {
  const tempPath = `${filePath}.clean-${Date.now()}`;
  const metadata = await sharp(filePath).metadata();

  let pipeline = sharp(filePath).rotate();
  if (metadata.format === 'jpeg' || metadata.format === 'jpg') {
    pipeline = pipeline.jpeg({ quality: 100, chromaSubsampling: '4:4:4' });
  } else if (metadata.format === 'png') {
    pipeline = pipeline.png({ compressionLevel: 6 });
  } else if (metadata.format === 'webp') {
    pipeline = pipeline.webp({ lossless: true, quality: 100 });
  }

  await pipeline.toFile(tempPath);

  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
  fs.renameSync(tempPath, filePath);
};

/**
 * Verify magic bytes from a Buffer (for memory-storage / Cloudinary mode).
 */
export const verifyBufferMagicBytes = (buf: Buffer): boolean => {
  if (!buf || buf.length < 12) return false;

  const isJpeg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  const isPng =
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
    buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a;
  const isWebp =
    buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buf.subarray(8, 12).toString('ascii') === 'WEBP';

  return isJpeg || isPng || isWebp;
};

/**
 * Strip EXIF from a buffer (for memory-storage / Cloudinary mode).
 * Returns a clean buffer with EXIF/GPS data removed.
 */
export const stripBufferExif = async (buf: Buffer): Promise<Buffer> => {
  const metadata = await sharp(buf).metadata();
  let pipeline = sharp(buf).rotate();

  if (metadata.format === 'jpeg' || metadata.format === 'jpg') {
    pipeline = pipeline.jpeg({ quality: 100, chromaSubsampling: '4:4:4' });
  } else if (metadata.format === 'png') {
    pipeline = pipeline.png({ compressionLevel: 6 });
  } else if (metadata.format === 'webp') {
    pipeline = pipeline.webp({ lossless: true, quality: 100 });
  }

  return pipeline.toBuffer();
};

/**
 * Express middleware executing post-upload security verification:
 * - Magic-byte inspection
 * - File size cap verification
 * - EXIF / GPS stripping
 * Supports both disk-based files (file.path) and memory buffers (file.buffer).
 */
export const sanitizeUploadedImage = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  const filesToProcess: Express.Multer.File[] = [];

  if (req.file) {
    filesToProcess.push(req.file);
  }

  if (req.files) {
    if (Array.isArray(req.files)) {
      filesToProcess.push(...req.files);
    } else {
      Object.values(req.files).forEach((item) => {
        if (Array.isArray(item)) filesToProcess.push(...item);
        else if (item) filesToProcess.push(item);
      });
    }
  }

  for (const file of filesToProcess) {
    // ── Buffer mode (Cloudinary / memory storage) ──
    if (file.buffer && file.buffer.length > 0) {
      // 1. Verify file size cap
      if (file.buffer.length > 5 * 1024 * 1024) {
        return next(new AppError('Uploaded file exceeds 5MB size limit', 400, 'FILE_TOO_LARGE'));
      }

      // 2. Verify magic bytes from buffer
      if (!verifyBufferMagicBytes(file.buffer)) {
        return next(
          new AppError(
            'Security check failed: File does not have a valid JPEG, PNG, or WebP binary signature.',
            400,
            'INVALID_IMAGE_MAGIC_BYTES'
          )
        );
      }

      // 3. Strip EXIF & GPS from buffer
      try {
        file.buffer = await stripBufferExif(file.buffer);
      } catch (err) {
        return next(new AppError('Failed to sanitize image metadata', 500, 'IMAGE_SANITIZATION_FAILED'));
      }

      continue;
    }

    // ── Disk mode (local storage) ──
    if (!file?.path || !fs.existsSync(file.path)) continue;

    // 1. Verify file size cap
    const stats = fs.statSync(file.path);
    if (stats.size > 5 * 1024 * 1024) {
      fs.unlinkSync(file.path);
      return next(new AppError('Uploaded file exceeds 5MB size limit', 400, 'FILE_TOO_LARGE'));
    }

    // 2. Verify magic bytes
    const isValidSignature = verifyImageMagicBytes(file.path);
    if (!isValidSignature) {
      fs.unlinkSync(file.path);
      return next(
        new AppError(
          'Security check failed: File does not have a valid JPEG, PNG, or WebP binary signature.',
          400,
          'INVALID_IMAGE_MAGIC_BYTES'
        )
      );
    }

    // 3. Strip EXIF & GPS location tags
    try {
      await stripImageExif(file.path);
    } catch (err) {
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      return next(new AppError('Failed to sanitize image metadata', 500, 'IMAGE_SANITIZATION_FAILED'));
    }
  }

  next();
};
