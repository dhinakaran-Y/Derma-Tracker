import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { CaptureSession } from '../models/CaptureSession';
import { Visit } from '../models/Visit';
import { Patient } from '../models/Patient';
import { User } from '../models/User';
import { AuthRequest, authMiddleware } from '../middleware/authMiddleware';
import { doctorOnly } from '../middleware/roleMiddleware';
import { upload, uploadScalp, sanitizeUploadedImage, storeScalpImage } from '../middleware/uploadMiddleware';
import * as cloudinaryService from '../services/cloudinaryService';
import { uploadLimiter } from '../middleware/rateLimitMiddleware';
import { AppError } from '../middleware/errorMiddleware';
import { emitToUser } from '../config/socket';
import { resolveUploadPath } from './uploadRoutes';

const router = Router();

function getLocalIp(): string {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

function getBaseClientUrl(customBaseUrl?: string): string {
  if (customBaseUrl && typeof customBaseUrl === 'string' && customBaseUrl.trim().startsWith('http')) {
    return customBaseUrl.trim().replace(/\/+$/, '');
  }
  if (process.env.PUBLIC_APP_URL) {
    return process.env.PUBLIC_APP_URL.replace(/\/+$/, '');
  }
  const clientPort = process.env.CLIENT_PORT || '3000';
  const ip = getLocalIp();
  return `http://${ip}:${clientPort}`;
}

// ==================== CREATE CAPTURE SESSION (Doctor authenticated) ====================

router.post('/', authMiddleware, doctorOnly, async (req: AuthRequest, res: Response) => {
  const { visitId, patientId, customBaseUrl } = req.body;
  if (!visitId || !patientId) {
    throw new AppError('visitId and patientId are required', 400, 'BAD_REQUEST');
  }

  const visit = await Visit.findOne({ _id: visitId, doctorId: req.user!.id });
  if (!visit) {
    throw new AppError('Visit not found', 404, 'NOT_FOUND');
  }

  if (visit.scalpImages && visit.scalpImages.length >= 5) {
    throw new AppError('Maximum limit of 5 scalp images already reached for this visit', 400, 'MAX_IMAGES_REACHED');
  }

  // Deactivate any previous active sessions for this visit
  await CaptureSession.updateMany(
    { visitId, status: 'active' },
    { $set: { status: 'expired' } }
  );

  const token = crypto.randomBytes(16).toString('hex');
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes TTL

  const session = await CaptureSession.create({
    token,
    doctorId: req.user!.id,
    patientId,
    visitId,
    expiresAt,
    status: 'active',
    isPasswordVerified: false,
  });

  const baseUrl = getBaseClientUrl(customBaseUrl);
  const captureUrl = `${baseUrl}/capture/${token}`;

  res.json({
    success: true,
    data: {
      token: session.token,
      captureUrl,
      expiresAt: session.expiresAt,
      currentCount: visit.scalpImages?.length || 0,
      maxImages: 5,
    },
  });
});

// ==================== VALIDATE SESSION (Public for mobile phone) ====================

router.get('/:token', async (req: Request, res: Response) => {
  const { token } = req.params;

  const session = await CaptureSession.findOne({
    token,
    status: 'active',
    expiresAt: { $gt: new Date() },
  });

  if (!session) {
    throw new AppError('Capture session is invalid, expired, or completed. Please request a new QR code from the doctor workbench.', 404, 'SESSION_EXPIRED');
  }

  const [visit, patient, doctor] = await Promise.all([
    Visit.findById(session.visitId).select('visitDate scalpImages status'),
    Patient.findById(session.patientId).select('name patientId gender dateOfBirth'),
    User.findById(session.doctorId).select('fullName username'),
  ]);

  if (!visit) {
    throw new AppError('Associated visit record no longer exists', 404, 'VISIT_NOT_FOUND');
  }

  res.json({
    success: true,
    data: {
      valid: true,
      token,
      patientName: patient ? patient.name : 'Unknown Patient',
      patientUhid: patient ? patient.patientId : '',
      doctorName: doctor?.fullName || 'Consulting Dermatologist',
      doctorUsername: doctor?.username || '',
      isPasswordVerified: !!session.isPasswordVerified,
      visitDate: visit.visitDate,
      count: visit.scalpImages?.length || 0,
      maxImages: 5,
      scalpImages: visit.scalpImages || [],
    },
  });
});

// ==================== VERIFY DOCTOR PASSWORD ====================

router.post('/:token/verify-password', async (req: Request, res: Response) => {
  const { token } = req.params;
  const { password } = req.body;

  if (!password || typeof password !== 'string') {
    throw new AppError('Doctor password is required', 400, 'BAD_REQUEST');
  }

  const session = await CaptureSession.findOne({
    token,
    status: 'active',
    expiresAt: { $gt: new Date() },
  });

  if (!session) {
    throw new AppError('Capture session is invalid or expired. Please refresh from doctor screen.', 404, 'SESSION_EXPIRED');
  }

  let doctor;
  try {
    doctor = await User.findById(session.doctorId);
  } catch (dbErr: any) {
    console.error('MongoDB error during doctor lookup in verify-password:', dbErr?.message || dbErr);
    throw new AppError('Database temporarily unavailable. Please try again in a few seconds.', 503, 'DB_UNAVAILABLE');
  }

  if (!doctor) {
    throw new AppError('Doctor account not found', 404, 'DOCTOR_NOT_FOUND');
  }

  let isMatch: boolean;
  try {
    isMatch = await doctor.comparePassword(password.trim());
  } catch (compareErr: any) {
    console.error('Error during password comparison:', compareErr?.message || compareErr);
    throw new AppError('Server error during authentication. Please try again.', 503, 'AUTH_ERROR');
  }

  if (!isMatch) {
    throw new AppError('Incorrect doctor password. Please enter the valid password for Dr. ' + doctor.fullName, 401, 'INVALID_PASSWORD');
  }

  session.isPasswordVerified = true;
  await session.save();

  res.json({
    success: true,
    message: 'Doctor authenticated successfully. Camera unlocked for clinical capture.',
    data: {
      verified: true,
      doctorName: doctor.fullName,
    },
  });
});

// ==================== UPLOAD VIA MOBILE TOKEN (Token-authenticated) ====================

router.post(
  '/:token/upload',
  uploadLimiter,
  uploadScalp.single('image'),
  sanitizeUploadedImage,
  async (req: Request, res: Response) => {
    const { token } = req.params;

    if (!req.file) {
      throw new AppError('No photo provided for upload', 400, 'NO_IMAGE');
    }

    const session = await CaptureSession.findOne({
      token,
      status: 'active',
      expiresAt: { $gt: new Date() },
    });

    if (!session) {
      // Remove the uploaded file
      const uploadedPath = req.file.path || path.join(process.cwd(), 'uploads', 'scalp', req.file.filename);
      if (fs.existsSync(uploadedPath)) {
        try { fs.unlinkSync(uploadedPath); } catch {}
      }
      throw new AppError('Capture session has expired or is invalid', 403, 'SESSION_EXPIRED');
    }

    if (!session.isPasswordVerified) {
      const uploadedPath = req.file.path || path.join(process.cwd(), 'uploads', 'scalp', req.file.filename);
      if (fs.existsSync(uploadedPath)) {
        try { fs.unlinkSync(uploadedPath); } catch {}
      }
      throw new AppError('Doctor authentication required before uploading photos', 403, 'PASSWORD_REQUIRED');
    }

    const visit = await Visit.findById(session.visitId)
      .populate('patientId', 'name patientId')
      .populate('hospitalId', 'name');
    if (!visit) {
      throw new AppError('Visit record not found', 404, 'VISIT_NOT_FOUND');
    }

    if (visit.scalpImages && visit.scalpImages.length >= 5) {
      const uploadedPath = req.file.path || (req.file.filename ? path.join(process.cwd(), 'uploads', req.file.filename) : null);
      if (uploadedPath && fs.existsSync(uploadedPath)) {
        try { fs.unlinkSync(uploadedPath); } catch {}
      }
      throw new AppError('Maximum limit of 5 scalp images already reached for this visit', 400, 'MAX_IMAGES_REACHED');
    }

    const patient = visit.patientId as any;
    const hosp = visit.hospitalId as any;
    const storedRef = await storeScalpImage(req.file, hosp?.name, patient?.patientId, patient?.name);

    visit.scalpImages.push(storedRef);
    await visit.save();

    // If reached 5 images, we can mark session completed
    if (visit.scalpImages.length >= 5) {
      session.status = 'completed';
      await session.save();
    }

    const imageUrl = storedRef.startsWith('http') ? storedRef : `/api/uploads/${storedRef}`;

    try {
      emitToUser(session.doctorId.toString(), 'pairing:photo-captured', {
        visitId: visit._id,
        imageUrl,
        filename: storedRef,
        scalpImages: visit.scalpImages,
        count: visit.scalpImages.length,
      });
    } catch (err) {
      console.error('Failed to emit photo-captured socket event:', err);
    }

    res.json({
      success: true,
      message: 'Scalp photo captured and uploaded successfully',
      data: {
        filename: storedRef,
        imageUrl,
        scalpImages: visit.scalpImages,
        count: visit.scalpImages.length,
        maxImages: 5,
      },
    });
  }
);

// Finish & wind up mobile capture session early (e.g. after 2 photos)
router.post('/:token/finish', async (req: Request, res: Response) => {
  const { token } = req.params;

  const session = await CaptureSession.findOne({ token });
  if (!session) {
    throw new AppError('Capture session not found or invalid token', 404, 'SESSION_NOT_FOUND');
  }

  const visit = await Visit.findById(session.visitId);
  if (!visit) {
    throw new AppError('Associated clinical visit record not found', 404, 'VISIT_NOT_FOUND');
  }

  session.status = 'completed';
  await session.save();

  // Notify doctor workbench that session has completed
  try {
    emitToUser(session.doctorId.toString(), 'pairing:session-completed', {
      visitId: visit._id,
      count: visit.scalpImages?.length || 0,
      scalpImages: visit.scalpImages || [],
      message: 'Mobile scalp photo capture session finished by doctor',
    });
  } catch (err) {
    console.error('Failed to emit pairing:session-completed:', err);
  }

  res.json({
    success: true,
    message: 'Capture session completed successfully',
    data: {
      count: visit.scalpImages?.length || 0,
      scalpImages: visit.scalpImages || [],
    },
  });
});

// Delete an unwanted photo directly from mobile capture session before winding up
router.delete('/:token/images/:filename', async (req: Request, res: Response) => {
  const { token } = req.params;
  const rawFilename = String(req.params.filename || '');

  const session = await CaptureSession.findOne({ token });
  if (!session) {
    throw new AppError('Capture session not found or invalid token', 404, 'SESSION_NOT_FOUND');
  }

  const visit = await Visit.findById(session.visitId);
  if (!visit) {
    throw new AppError('Associated clinical visit record not found', 404, 'VISIT_NOT_FOUND');
  }

  const targetBase = path.basename(decodeURIComponent(rawFilename));
  const matchedImg = visit.scalpImages?.find(
    (img) => path.basename(img) === targetBase || img === rawFilename
  );

  if (!matchedImg) {
    throw new AppError('Image not found in this visit record', 404, 'IMAGE_NOT_FOUND');
  }

  visit.scalpImages = visit.scalpImages.filter(
    (img) => img !== matchedImg && path.basename(img) !== targetBase
  );
  await visit.save();

  // Delete from Cloudinary if it's a cloud URL, otherwise delete from disk
  if (matchedImg.startsWith('http') && cloudinaryService.isCloudinaryUrl(matchedImg)) {
    const publicId = cloudinaryService.extractPublicId(matchedImg);
    if (publicId) {
      await cloudinaryService.deleteImage(publicId);
    }
  } else {
    const resolvedPath = resolveUploadPath(targetBase);
    if (resolvedPath && fs.existsSync(resolvedPath)) {
      try {
        fs.unlinkSync(resolvedPath);
      } catch (err) {
        console.error(`Failed to delete scalp image file from disk: ${targetBase}`, err);
      }
    }
  }

  // Notify doctor workbench via socket
  try {
    emitToUser(session.doctorId.toString(), 'visit:image-deleted', {
      visitId: visit._id,
      filename: targetBase,
      scalpImages: visit.scalpImages,
    });
  } catch (err) {
    console.error('Failed to emit visit:image-deleted socket event:', err);
  }

  res.json({
    success: true,
    message: 'Scalp photo deleted successfully',
    data: {
      filename: targetBase,
      count: visit.scalpImages.length,
      scalpImages: visit.scalpImages,
    },
  });
});

export default router;
