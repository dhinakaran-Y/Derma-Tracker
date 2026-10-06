import { Router, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { AuthRequest, optionalAuth } from '../middleware/authMiddleware';
import { auditMiddleware } from '../middleware/auditMiddleware';
import { AppError } from '../middleware/errorMiddleware';
import { sanitizeFolderName } from '../middleware/uploadMiddleware';

const router = Router();

const pathCache = new Map<string, string>();

function findFileRecursive(dir: string, targetFilename: string): string | null {
  if (!fs.existsSync(dir)) return null;
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isFile() && entry.name === targetFilename) {
        return fullPath;
      }
      if (entry.isDirectory()) {
        const found = findFileRecursive(fullPath, targetFilename);
        if (found) return found;
      }
    }
  } catch {}
  return null;
}

export const resolveUploadPath = (filename: string, category?: string): string | null => {
  const safeFilename = path.basename(filename);

  // Check cache first
  const cached = pathCache.get(safeFilename);
  if (cached && fs.existsSync(cached)) {
    return cached;
  }

  const baseUploadsDirs = [
    path.join(process.cwd(), 'uploads'),
    path.join(process.cwd(), 'server', 'uploads'),
    path.join(__dirname, '../../uploads'),
    path.join(__dirname, '../uploads'),
  ];

  for (const baseDir of baseUploadsDirs) {
    if (!fs.existsSync(baseDir)) continue;

    // Search recursively across hospital/patient subdirectories
    const found = findFileRecursive(baseDir, safeFilename);
    if (found) {
      pathCache.set(safeFilename, found);
      return found;
    }
  }
  return null;
};

// Route for patient scalp clinical photos
router.get('/scalp/:filename', optionalAuth, (req: AuthRequest, res: Response) => {
  const param = req.params.filename as string;
  const filePath = resolveUploadPath(param, 'scalp');
  if (!filePath) throw new AppError('File not found', 404, 'FILE_NOT_FOUND');

  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.sendFile(filePath);
});

// Route for hospital-specific medicine assets: /api/uploads/hospitals/:hospitalName/medicines/:filename
router.get('/hospitals/:hospitalName/medicines/:filename', (req, res: Response) => {
  const hospitalName = req.params.hospitalName as string;
  const filename = req.params.filename as string;
  const safeHosp = sanitizeFolderName(hospitalName);
  const safeFilename = path.basename(filename);

  const baseUploadsDirs = [
    path.join(process.cwd(), 'uploads'),
    path.join(process.cwd(), 'server', 'uploads'),
    path.join(__dirname, '../../uploads'),
    path.join(__dirname, '../uploads'),
  ];

  for (const baseDir of baseUploadsDirs) {
    const candidate = path.join(baseDir, 'hospitals', safeHosp, 'medicines', safeFilename);
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.sendFile(candidate);
    }
  }

  const fallback = resolveUploadPath(safeFilename, 'medicines');
  if (fallback) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.sendFile(fallback);
  }

  throw new AppError('File not found', 404, 'FILE_NOT_FOUND');
});

// Route for hospital-specific assets (e.g. /api/uploads/hospitals/:hospitalName/:filename)
router.get('/hospitals/:hospitalName/:filename', (req, res: Response) => {
  const hospitalName = req.params.hospitalName as string;
  const filename = req.params.filename as string;
  const safeHosp = sanitizeFolderName(hospitalName);
  const safeFilename = path.basename(filename);

  const baseUploadsDirs = [
    path.join(process.cwd(), 'uploads'),
    path.join(process.cwd(), 'server', 'uploads'),
    path.join(__dirname, '../../uploads'),
    path.join(__dirname, '../uploads'),
  ];

  for (const baseDir of baseUploadsDirs) {
    const candidate = path.join(baseDir, 'hospitals', safeHosp, safeFilename);
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.sendFile(candidate);
    }
  }

  const fallback = resolveUploadPath(safeFilename, 'hospitals');
  if (fallback) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.sendFile(fallback);
  }

  throw new AppError('File not found', 404, 'FILE_NOT_FOUND');
});

// Route for hospital logos and facility photos (legacy / direct filename)
router.get('/hospitals/:filename', (req, res: Response) => {
  const param = req.params.filename as string;
  const filePath = resolveUploadPath(param, 'hospitals');
  if (!filePath) throw new AppError('File not found', 404, 'FILE_NOT_FOUND');

  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.sendFile(filePath);
});

// Route for pharmacy medicine packaging images
router.get('/medicines/:filename', (req, res: Response) => {
  const param = req.params.filename as string;
  const filePath = resolveUploadPath(param, 'medicines');
  if (!filePath) throw new AppError('File not found', 404, 'FILE_NOT_FOUND');

  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.sendFile(filePath);
});

// Public route to serve hospital logos/banners and medicine catalog assets (cacheable, nosniff)
router.get('/public/:filename', (req, res: Response) => {
  const param = req.params.filename as string;
  const filePath = resolveUploadPath(param);

  if (!filePath) {
    throw new AppError('File not found', 404, 'FILE_NOT_FOUND');
  }

  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.sendFile(filePath);
});

// Universal / legacy fallback route to serve uploaded clinical images
// Checks categorized subdirectories (scalp, hospitals, medicines) transparently
// Also handles redirect for Cloudinary-stored URLs
router.get('/:filename', optionalAuth, (req: AuthRequest, res: Response) => {
  const param = req.params.filename as string;

  // If the param is a Cloudinary URL (shouldn't happen normally but handles edge cases)
  if (param.startsWith('http://') || param.startsWith('https://')) {
    return res.redirect(301, param);
  }

  const filePath = resolveUploadPath(param);

  if (!filePath) {
    throw new AppError('File not found', 404, 'FILE_NOT_FOUND');
  }

  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.sendFile(filePath);
});

export default router;

