import { Router, Response } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { env } from '../config/env';
import { Hospital } from '../models/Hospital';
import { User } from '../models/User';
import { upload, uploadHospital, sanitizeUploadedImage, storeHospitalMedia } from '../middleware/uploadMiddleware';
import { AuthRequest, authMiddleware } from '../middleware/authMiddleware';
import { validate } from '../middleware/validateMiddleware';
import { AppError } from '../middleware/errorMiddleware';

const router = Router();

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: (env.NODE_ENV === 'production' ? 'none' : 'lax') as 'none' | 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/',
};

// ==================== MEDIA UPLOAD FOR REGISTRATION ====================

router.post(
  '/upload-media',
  uploadHospital.fields([
    { name: 'logo', maxCount: 1 },
    { name: 'image', maxCount: 1 },
  ]),
  sanitizeUploadedImage,
  async (req: any, res: Response) => {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    const result: { logoUrl?: string; imageUrl?: string } = {};
    const hospName = req.body.name || req.body.shortName || 'Registered_Hospitals';

    if (files?.logo?.[0]) {
      const logoRef = await storeHospitalMedia(files.logo[0], hospName, 'logo');
      result.logoUrl = logoRef.startsWith('http') ? logoRef : `/api/uploads/hospitals/${hospName}/${files.logo[0].filename}`;
    }
    if (files?.image?.[0]) {
      const bannerRef = await storeHospitalMedia(files.image[0], hospName, 'banner');
      result.imageUrl = bannerRef.startsWith('http') ? bannerRef : `/api/uploads/hospitals/${hospName}/${files.image[0].filename}`;
    }

    res.json({ success: true, data: result });
  }
);

// ==================== REAL-TIME UNIQUENESS VALIDATION ====================

const uniquenessSchema = z.object({
  name: z.string().optional(),
  shortName: z.string().optional(),
  email: z.string().optional(),
  websiteUrl: z.string().optional(),
});

router.post('/validate-uniqueness', validate(uniquenessSchema), async (req: any, res: Response) => {
  const { name, shortName, email, websiteUrl } = req.body;
  const conflicts: { [key: string]: string } = {};

  if (name?.trim()) {
    const existing = await Hospital.findOne({ name: { $regex: `^${name.trim()}$`, $options: 'i' } });
    if (existing) conflicts.name = 'A hospital or clinic with this full name is already registered';
  }

  if (shortName?.trim()) {
    const existing = await Hospital.findOne({ shortName: { $regex: `^${shortName.trim()}$`, $options: 'i' } });
    if (existing) conflicts.shortName = 'A hospital or clinic with this short name is already registered';
  }

  if (email?.trim()) {
    const [hospWithEmail, userWithEmail] = await Promise.all([
      Hospital.findOne({ email: email.trim().toLowerCase() }),
      User.findOne({ email: email.trim().toLowerCase() }),
    ]);
    if (hospWithEmail || userWithEmail) {
      conflicts.email = 'This email address is already associated with an account';
    }
  }

  if (websiteUrl?.trim()) {
    const existing = await Hospital.findOne({ websiteUrl: websiteUrl.trim().toLowerCase() });
    if (existing) conflicts.websiteUrl = 'This website link is already registered';
  }

  const isUnique = Object.keys(conflicts).length === 0;
  res.json({
    success: true,
    isUnique,
    conflicts,
  });
});

// ==================== HOSPITAL REGISTRATION ====================

const registerHospitalSchema = z.object({
  type: z.enum(['BigHospital', 'Hospital', 'Clinic']),
  name: z.string().min(2, 'Full hospital name must be at least 2 characters'),
  shortName: z.string().min(2, 'Short name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string().min(6),
  websiteUrl: z.string().optional().or(z.literal('')),
  logoUrl: z.string().optional().or(z.literal('')),
  imageUrl: z.string().optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
  address: z.string().optional().or(z.literal('')),
  gstNumber: z.string().optional().or(z.literal('')),
});

router.post('/register', validate(registerHospitalSchema), async (req: any, res: Response) => {
  const {
    type,
    name,
    shortName,
    email,
    password,
    confirmPassword,
    websiteUrl,
    logoUrl,
    imageUrl,
    phone,
    address,
    gstNumber,
  } = req.body;

  if (password !== confirmPassword) {
    throw new AppError('Passwords do not match', 400, 'PASSWORD_MISMATCH');
  }

  // Check uniqueness
  const cleanEmail = email.trim().toLowerCase();
  const cleanName = name.trim();
  const cleanShortName = shortName.trim();

  const [existingName, existingShortName, existingEmail, existingUserEmail] = await Promise.all([
    Hospital.findOne({ name: { $regex: `^${cleanName}$`, $options: 'i' } }),
    Hospital.findOne({ shortName: { $regex: `^${cleanShortName}$`, $options: 'i' } }),
    Hospital.findOne({ email: cleanEmail }),
    User.findOne({ email: cleanEmail }),
  ]);

  if (existingName) throw new AppError('Hospital full name already exists', 409, 'DUPLICATE_NAME');
  if (existingShortName) throw new AppError('Hospital short name already exists', 409, 'DUPLICATE_SHORT_NAME');
  if (existingEmail || existingUserEmail) throw new AppError('Email address already registered', 409, 'DUPLICATE_EMAIL');

  if (websiteUrl?.trim()) {
    const existingWeb = await Hospital.findOne({ websiteUrl: websiteUrl.trim().toLowerCase() });
    if (existingWeb) throw new AppError('Website link is already registered', 409, 'DUPLICATE_WEBSITE');
  }

  // Create Hospital
  const hospital = await Hospital.create({
    type,
    name: cleanName,
    shortName: cleanShortName,
    email: cleanEmail,
    websiteUrl: websiteUrl?.trim() || undefined,
    logoUrl: logoUrl?.trim() || undefined,
    imageUrl: imageUrl?.trim() || undefined,
    phone: phone?.trim() || undefined,
    address: address?.trim() || undefined,
    gstNumber: gstNumber?.trim() || undefined,
    status: 'Active',
  });

  // Create Admin User for this Hospital
  let baseUsername = cleanEmail.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '');
  let finalUsername = baseUsername;
  let count = 1;
  while (await User.findOne({ username: finalUsername })) {
    finalUsername = `${baseUsername}${count++}`;
  }

  const adminUser = await User.create({
    username: finalUsername,
    passwordHash: password, // Pre-save hook hashes it
    fullName: `${cleanShortName} Admin`,
    email: cleanEmail,
    role: 'Admin',
    status: 'Active',
    hospitalId: hospital._id,
  });

  // Generate JWT Token
  const token = jwt.sign(
    {
      id: adminUser._id,
      role: adminUser.role,
      type: 'staff',
      hospitalId: hospital._id,
    },
    env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.cookie('token', token, COOKIE_OPTIONS);
  res.status(201).json({
    success: true,
    message: `${cleanShortName} registered successfully!`,
    data: {
      hospital,
      user: adminUser.toJSON(),
      token,
    },
  });
});

// ==================== PUBLIC HOSPITAL BRANDING ====================

router.get('/public/:id', async (req: any, res: Response) => {
  const hospital = await Hospital.findById(req.params.id).select(
    'name shortName type logoUrl imageUrl websiteUrl'
  );
  if (!hospital) throw new AppError('Hospital not found', 404, 'NOT_FOUND');
  res.json({ success: true, data: hospital });
});

// ==================== CURRENT USER HOSPITAL ====================

router.get('/current', authMiddleware, async (req: AuthRequest, res: Response) => {
  let hospital = null;
  if (req.user?.type === 'staff') {
    const user = await User.findById(req.user.id);
    if (user?.hospitalId) {
      hospital = await Hospital.findById(user.hospitalId);
    }
  }

  // Fallback to first active hospital or default branding
  if (!hospital) {
    hospital = await Hospital.findOne({ status: 'Active' });
  }

  res.json({ success: true, data: hospital });
});

export default router;
