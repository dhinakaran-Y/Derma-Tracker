import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { DevicePairing } from '../models/DevicePairing';
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
import { tunnelManager } from '../config/tunnelManager';

import { resolveDeviceName } from '../utils/deviceModelResolver';

const router = Router();

// ==================== HELPERS ====================

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
  // Priority 1: Explicit custom base URL (from frontend or env)
  if (customBaseUrl && typeof customBaseUrl === 'string' && customBaseUrl.trim().startsWith('http')) {
    return customBaseUrl.trim().replace(/\/+$/, '');
  }

  // Priority 2: Active Cloudflare tunnel (auto cross-network support)
  const tunnelUrl = tunnelManager.getTunnelUrl();
  if (tunnelUrl) {
    return tunnelUrl;
  }

  // Priority 3: Configured public app URL
  if (process.env.PUBLIC_APP_URL) {
    return process.env.PUBLIC_APP_URL.replace(/\/+$/, '');
  }

  // Priority 4: LAN IP (same-network only)
  const clientPort = process.env.CLIENT_PORT || '3000';
  const ip = getLocalIp();
  return `http://${ip}:${clientPort}`;
}

function parseDeviceName(userAgent?: string, clientModel?: string): string {
  return resolveDeviceName(userAgent, clientModel);
}

function hashDeviceSecret(secret: string): string {
  return crypto.createHash('sha256').update(secret.trim()).digest('hex');
}

function extractDeviceSecret(req: Request): string | null {
  const headerSecret = req.headers['x-device-secret'];
  if (typeof headerSecret === 'string' && headerSecret.trim()) {
    return headerSecret.trim();
  }
  const cookieSecret = req.cookies?.derma_device_secret;
  if (typeof cookieSecret === 'string' && cookieSecret.trim()) {
    return cookieSecret.trim();
  }
  return null;
}

// Middleware to check pairing is valid and password-verified on THIS specific device
async function requireVerifiedPairing(req: Request, _res: Response, next: any) {
  try {
    const { token } = req.params;
    const pairing = await DevicePairing.findOne({
      token,
      status: 'active',
      expiresAt: { $gt: new Date() },
    });

    if (!pairing) {
      throw new AppError('Device pairing is invalid, expired, or revoked. Please scan a new QR code from the doctor workbench.', 404, 'PAIRING_INVALID');
    }

    if (!pairing.isPasswordVerified || !pairing.deviceSecretHash) {
      throw new AppError('Doctor authentication required. Please enter your password on this device first.', 403, 'PASSWORD_REQUIRED');
    }

    // Verify the presented device trust secret
    const presentedSecret = extractDeviceSecret(req);
    if (!presentedSecret || hashDeviceSecret(presentedSecret) !== pairing.deviceSecretHash) {
      throw new AppError('Device authentication required. Please enter the doctor password on this mobile phone.', 403, 'PASSWORD_REQUIRED');
    }

    // Update lastActiveAt
    pairing.lastActiveAt = new Date();
    await pairing.save().catch(() => {});

    (req as any).pairing = pairing;
    next();
  } catch (err) {
    next(err);
  }
}

// ==================== CREATE DEVICE PAIRING (Doctor authenticated) ====================

router.post('/', authMiddleware, doctorOnly, async (req: AuthRequest, res: Response) => {
  const { customBaseUrl } = req.body;
  const token = crypto.randomBytes(16).toString('hex');
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  const pairing = await DevicePairing.create({
    token,
    doctorId: req.user!.id,
    expiresAt,
    status: 'active',
    isPasswordVerified: false,
    lastActiveAt: new Date(),
  });

  const baseUrl = getBaseClientUrl(customBaseUrl);
  const mobileUrl = `${baseUrl}/mobile/${token}`;
  const clientPort = process.env.CLIENT_PORT || '3000';
  const ip = getLocalIp();
  const lanUrl = `http://${ip}:${clientPort}/mobile/${token}`;
  const rawTunnel = tunnelManager.getTunnelUrl();
  const tunnelUrl = rawTunnel ? `${rawTunnel}/mobile/${token}` : null;
  const isTunnelActive = !!rawTunnel;

  res.json({
    success: true,
    data: {
      token: pairing.token,
      mobileUrl,
      lanUrl,
      tunnelUrl,
      expiresAt: pairing.expiresAt,
      isTunnelActive,
    },
  });
});

// ==================== LIST MY DEVICES (Doctor authenticated) ====================

router.get('/my-devices', authMiddleware, doctorOnly, async (req: AuthRequest, res: Response) => {
  const devices = await DevicePairing.find({
    doctorId: req.user!.id,
    status: 'active',
    expiresAt: { $gt: new Date() },
  }).sort({ createdAt: -1 });

  const baseUrl = getBaseClientUrl();
  const rawTunnel = tunnelManager.getTunnelUrl();
  const isTunnelActive = !!rawTunnel;
  const clientPort = process.env.CLIENT_PORT || '3000';
  const ip = getLocalIp();

  const now = Date.now();
  const enrichedDevices = devices.map((d) => {
    const lastActive = d.lastActiveAt ? d.lastActiveAt.getTime() : 0;
    const diffSec = (now - lastActive) / 1000;
    let connectionStatus: 'active' | 'idle' | 'offline' = 'offline';
    if (diffSec < 30) connectionStatus = 'active';
    else if (diffSec < 120) connectionStatus = 'idle';

    return {
      _id: d._id,
      token: d.token,
      deviceName: d.deviceName,
      isCustomName: !!d.isCustomName,
      isPasswordVerified: d.isPasswordVerified,
      connectionStatus,
      lastActiveAt: d.lastActiveAt,
      createdAt: d.createdAt,
      expiresAt: d.expiresAt,
      mobileUrl: `${baseUrl}/mobile/${d.token}`,
      lanUrl: `http://${ip}:${clientPort}/mobile/${d.token}`,
      tunnelUrl: rawTunnel ? `${rawTunnel}/mobile/${d.token}` : null,
      isTunnelActive,
    };
  });

  res.json({ success: true, data: enrichedDevices });
});

// ==================== RENAME PAIRED DEVICE (Doctor authenticated) ====================

router.patch('/:token/rename', authMiddleware, doctorOnly, async (req: AuthRequest, res: Response) => {
  const { token } = req.params;
  const { deviceName } = req.body;

  if (!deviceName || typeof deviceName !== 'string' || !deviceName.trim()) {
    throw new AppError('Device name cannot be empty', 400, 'BAD_REQUEST');
  }

  const trimmedName = deviceName.trim().slice(0, 50);

  const pairing = await DevicePairing.findOne({
    token,
    doctorId: req.user!.id,
    status: 'active',
  });

  if (!pairing) {
    throw new AppError('Device pairing not found', 404, 'PAIRING_NOT_FOUND');
  }

  pairing.deviceName = trimmedName;
  pairing.isCustomName = true;
  await pairing.save();

  try {
    emitToUser(req.user!.id, 'device:renamed', { token, deviceName: trimmedName });
  } catch {}

  res.json({
    success: true,
    message: `Device successfully renamed to "${trimmedName}"`,
    data: {
      token: pairing.token,
      deviceName: pairing.deviceName,
      isCustomName: pairing.isCustomName,
    },
  });
});

// ==================== VALIDATE PAIRING (Public for mobile) ====================

router.get('/:token', async (req: Request, res: Response) => {
  const { token } = req.params;
  const clientDeviceName = (req.query.deviceName as string) || (req.headers['x-device-name'] as string);

  const pairing = await DevicePairing.findOne({
    token,
    status: 'active',
    expiresAt: { $gt: new Date() },
  });

  if (!pairing) {
    throw new AppError('Device pairing is invalid, expired, or revoked. Please scan a new QR code from the doctor workbench.', 404, 'PAIRING_INVALID');
  }

  // Auto-detect and upgrade generic device name if doctor hasn't set a custom name
  if (!pairing.isCustomName && (pairing.deviceName === 'Unknown Device' || pairing.deviceName === 'Pending Mobile Connection' || /^Android Device/i.test(pairing.deviceName))) {
    const resolved = parseDeviceName(req.headers['user-agent'], clientDeviceName);
    if (resolved && resolved !== 'Mobile Device' && resolved !== 'Android Phone') {
      pairing.deviceName = resolved;
    }
  }

  // Update lastActiveAt on revisit
  pairing.lastActiveAt = new Date();
  await pairing.save().catch(() => {});

  const doctor = await User.findById(pairing.doctorId).select('fullName username');

  // Check if THIS specific client device possesses the valid deviceSecret
  const presentedSecret = extractDeviceSecret(req);
  let isDeviceVerified = false;

  if (pairing.deviceSecretHash && presentedSecret) {
    if (hashDeviceSecret(presentedSecret) === pairing.deviceSecretHash) {
      isDeviceVerified = true;
    }
  }

  res.json({
    success: true,
    data: {
      valid: true,
      token,
      deviceName: pairing.deviceName,
      isCustomName: !!pairing.isCustomName,
      doctorName: doctor?.fullName || 'Consulting Dermatologist',
      doctorUsername: doctor?.username || '',
      isPasswordVerified: isDeviceVerified,
      expiresAt: pairing.expiresAt,
    },
  });
});

// ==================== VERIFY DOCTOR PASSWORD ====================

router.post('/:token/verify-password', async (req: Request, res: Response) => {
  const { token } = req.params;
  const { password, deviceName: clientProvidedName } = req.body;

  if (!password || typeof password !== 'string') {
    throw new AppError('Doctor password is required', 400, 'BAD_REQUEST');
  }

  const pairing = await DevicePairing.findOne({
    token,
    status: 'active',
    expiresAt: { $gt: new Date() },
  });

  if (!pairing) {
    throw new AppError('Device pairing is invalid or expired. Please scan a new QR code.', 404, 'PAIRING_INVALID');
  }

  let doctor;
  try {
    doctor = await User.findById(pairing.doctorId);
  } catch (dbErr: any) {
    console.error('MongoDB error during doctor lookup in device-pairing verify-password:', dbErr?.message || dbErr);
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

  // Parse device name from client or User-Agent (preserve doctor custom name if set)
  let deviceName = pairing.isCustomName
    ? pairing.deviceName
    : (clientProvidedName && typeof clientProvidedName === 'string' && clientProvidedName.trim())
      ? clientProvidedName.trim().slice(0, 50)
      : parseDeviceName(req.headers['user-agent'], req.headers['x-device-name'] as string);

  const presentedSecret = extractDeviceSecret(req);

  let targetPairing = pairing;

  // If this token was ALREADY claimed by another phone with a different secret:
  // Automatically provision a dedicated paired device record for this second mobile!
  if (pairing.deviceSecretHash && (!presentedSecret || hashDeviceSecret(presentedSecret) !== pairing.deviceSecretHash)) {
    const newToken = crypto.randomBytes(16).toString('hex');
    const newExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    targetPairing = await DevicePairing.create({
      token: newToken,
      doctorId: pairing.doctorId,
      deviceName,
      isCustomName: false,
      isPasswordVerified: true,
      expiresAt: newExpiresAt,
      status: 'active',
      lastActiveAt: new Date(),
      claimedAt: new Date(),
    });
  }

  // Generate a brand new cryptographic device secret for this phone
  const newDeviceSecret = crypto.randomBytes(32).toString('hex');
  targetPairing.deviceSecretHash = hashDeviceSecret(newDeviceSecret);
  targetPairing.isPasswordVerified = true;
  targetPairing.deviceName = deviceName;
  targetPairing.lastActiveAt = new Date();
  if (!targetPairing.claimedAt) {
    targetPairing.claimedAt = new Date();
  }
  await targetPairing.save();

  // Set 30-day cookie
  res.cookie('derma_device_secret', newDeviceSecret, {
    maxAge: 30 * 24 * 60 * 60 * 1000,
    httpOnly: false, // accessible to client js for localStorage sync and headers
    sameSite: 'lax',
    path: '/',
  });

  res.json({
    success: true,
    message: 'Device authenticated successfully. You can now capture scalp photos.',
    data: {
      verified: true,
      doctorName: doctor.fullName,
      token: targetPairing.token,
      deviceName: targetPairing.deviceName,
      deviceSecret: newDeviceSecret,
      expiresAt: targetPairing.expiresAt,
    },
  });
});

// ==================== GET ACTIVE PATIENT (Core auto-monitoring endpoint) ====================

router.get('/:token/active-patient', requireVerifiedPairing, async (req: Request, res: Response) => {
  const pairing = (req as any).pairing;

  // Find the current active visit for this doctor (InProgress first, or current Waiting patient in queue)
  let activeVisit = await Visit.findOne({
    doctorId: pairing.doctorId,
    status: 'InProgress',
  })
    .populate('patientId', 'name phone patientId dateOfBirth gender')
    .sort({ updatedAt: -1 });

  if (!activeVisit) {
    activeVisit = await Visit.findOne({
      doctorId: pairing.doctorId,
      status: 'Waiting',
    })
      .populate('patientId', 'name phone patientId dateOfBirth gender')
      .sort({ queueNumber: 1, createdAt: 1, updatedAt: -1 });
  }

  if (!activeVisit) {
    res.json({
      success: true,
      data: {
        hasActivePatient: false,
        patient: null,
        visit: null,
      },
    });
    return;
  }

  const patient = activeVisit.patientId as any;

  res.json({
    success: true,
    data: {
      hasActivePatient: true,
      patient: {
        _id: patient._id,
        name: patient.name,
        patientId: patient.patientId,
        phone: patient.phone,
        gender: patient.gender,
        dateOfBirth: patient.dateOfBirth,
      },
      visit: {
        _id: activeVisit._id,
        visitDate: activeVisit.visitDate,
        visitType: activeVisit.visitType,
        status: activeVisit.status,
        scalpImages: activeVisit.scalpImages || [],
        count: activeVisit.scalpImages?.length || 0,
        maxImages: 5,
      },
    },
  });
});

// ==================== UPLOAD PHOTO FOR ACTIVE PATIENT ====================

router.post(
  '/:token/upload',
  uploadLimiter,
  uploadScalp.single('image'),
  sanitizeUploadedImage,
  requireVerifiedPairing,
  async (req: Request, res: Response) => {
    const pairing = (req as any).pairing;

    if (!req.file) {
      throw new AppError('No photo provided for upload', 400, 'NO_IMAGE');
    }

    // Find active InProgress or current Waiting visit for this doctor
    let activeVisit = await Visit.findOne({
      doctorId: pairing.doctorId,
      status: 'InProgress',
    }).sort({ updatedAt: -1 });

    if (!activeVisit) {
      activeVisit = await Visit.findOne({
        doctorId: pairing.doctorId,
        status: 'Waiting',
      }).sort({ queueNumber: 1, createdAt: 1, updatedAt: -1 });
    }

    if (!activeVisit) {
      // Remove the uploaded file since no active visit
      const uploadedPath = req.file.path || path.join(process.cwd(), 'uploads', 'scalp', req.file.filename);
      if (fs.existsSync(uploadedPath)) {
        try { fs.unlinkSync(uploadedPath); } catch {}
      }
      throw new AppError('No active patient consultation found. Please wait for the doctor to start a consultation.', 404, 'NO_ACTIVE_VISIT');
    }

    // If visit was Waiting, auto-promote to InProgress since examination/capture has started
    if (activeVisit.status === 'Waiting') {
      activeVisit.status = 'InProgress';
    }

    if (activeVisit.scalpImages && activeVisit.scalpImages.length >= 5) {
      const uploadedPath = req.file.path || (req.file.filename ? path.join(process.cwd(), 'uploads', req.file.filename) : null);
      if (uploadedPath && fs.existsSync(uploadedPath)) {
        try { fs.unlinkSync(uploadedPath); } catch {}
      }
      throw new AppError('Maximum limit of 5 scalp images already reached for this visit', 400, 'MAX_IMAGES_REACHED');
    }

    await activeVisit.populate([
      { path: 'patientId', select: 'name patientId' },
      { path: 'hospitalId', select: 'name' },
    ]);
    const patient = activeVisit.patientId as any;
    const hosp = activeVisit.hospitalId as any;
    const storedRef = await storeScalpImage(req.file, hosp?.name, patient?.patientId, patient?.name);

    activeVisit.scalpImages.push(storedRef);
    await activeVisit.save();

    const imageUrl = storedRef.startsWith('http') ? storedRef : `/api/uploads/${storedRef}`;

    // Notify doctor workbench via socket
    try {
      emitToUser(pairing.doctorId.toString(), 'pairing:photo-captured', {
        visitId: activeVisit._id,
        imageUrl,
        filename: storedRef,
        scalpImages: activeVisit.scalpImages,
        count: activeVisit.scalpImages.length,
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
        scalpImages: activeVisit.scalpImages,
        count: activeVisit.scalpImages.length,
        maxImages: 5,
      },
    });
  }
);

// ==================== DELETE PHOTO FROM ACTIVE VISIT ====================

router.delete('/:token/active-patient/images/:filename', requireVerifiedPairing, async (req: Request, res: Response) => {
  const pairing = (req as any).pairing;
  const rawFilename = String(req.params.filename || '');

  // Find active visit (InProgress or Waiting)
  let activeVisit = await Visit.findOne({
    doctorId: pairing.doctorId,
    status: 'InProgress',
  }).sort({ updatedAt: -1 });

  if (!activeVisit) {
    activeVisit = await Visit.findOne({
      doctorId: pairing.doctorId,
      status: 'Waiting',
    }).sort({ queueNumber: 1, createdAt: 1, updatedAt: -1 });
  }

  if (!activeVisit) {
    throw new AppError('No active patient consultation found.', 404, 'NO_ACTIVE_VISIT');
  }

  const targetBase = path.basename(decodeURIComponent(rawFilename));
  const matchedImg = activeVisit.scalpImages?.find(
    (img) => path.basename(img) === targetBase || img === rawFilename || img.includes(targetBase)
  );

  if (!matchedImg) {
    throw new AppError('Image not found in this visit record', 404, 'IMAGE_NOT_FOUND');
  }

  activeVisit.scalpImages = activeVisit.scalpImages.filter(
    (img) => img !== matchedImg && path.basename(img) !== targetBase && !img.includes(targetBase)
  );
  await activeVisit.save();

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
    emitToUser(pairing.doctorId.toString(), 'visit:image-deleted', {
      visitId: activeVisit._id,
      filename: targetBase,
      scalpImages: activeVisit.scalpImages,
    });
  } catch (err) {
    console.error('Failed to emit visit:image-deleted socket event:', err);
  }

  res.json({
    success: true,
    message: 'Scalp photo deleted successfully',
    data: {
      filename: targetBase,
      count: activeVisit.scalpImages.length,
      scalpImages: activeVisit.scalpImages,
    },
  });
});

// ==================== REVOKE/REMOVE DEVICE (Doctor authenticated) ====================

router.delete('/:token', authMiddleware, doctorOnly, async (req: AuthRequest, res: Response) => {
  const { token } = req.params;

  const pairing = await DevicePairing.findOne({
    token,
    doctorId: req.user!.id,
  });

  if (!pairing) {
    throw new AppError('Device pairing not found', 404, 'NOT_FOUND');
  }

  pairing.status = 'revoked';
  await pairing.save();

  res.json({
    success: true,
    message: 'Device pairing revoked successfully',
  });
});

export default router;
