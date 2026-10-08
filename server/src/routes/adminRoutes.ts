import { Router, Response } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { User } from '../models/User';
import { ClinicSettings, getClinicSettings } from '../models/ClinicSettings';
import { AuditLog } from '../models/AuditLog';
import { Invoice } from '../models/Invoice';
import { Medicine } from '../models/Medicine';
import { Visit } from '../models/Visit';
import { AuthRequest } from '../middleware/authMiddleware';
import { authMiddleware } from '../middleware/authMiddleware';
import { adminOnly } from '../middleware/roleMiddleware';
import { validate } from '../middleware/validateMiddleware';
import { auditMiddleware } from '../middleware/auditMiddleware';
import { AppError } from '../middleware/errorMiddleware';

const router = Router();
router.use(authMiddleware, adminOnly, auditMiddleware('admin'));

// ==================== STAFF MANAGEMENT ====================

const checkEmailSchema = z.object({
  email: z.string().optional(),
});

router.get('/check-email', async (req: AuthRequest, res: Response) => {
  const email = (req.query.email as string)?.trim().toLowerCase();
  if (!email) return res.json({ success: true, exists: false });

  const { Hospital } = await import('../models/Hospital');
  const [existingUser, existingHosp] = await Promise.all([
    User.findOne({ email }),
    Hospital.findOne({ email }),
  ]);

  res.json({
    success: true,
    exists: !!(existingUser || existingHosp),
  });
});

const createStaffSchema = z.object({
  username: z.string().optional(),
  password: z.string().min(6),
  fullName: z.string().min(1),
  email: z.string().email('Please enter a valid email address'),
  role: z.enum(['Admin', 'Receptionist', 'Doctor', 'MedicationGiver', 'StockManager']),
  specialization: z.string().optional().or(z.literal('')),
  consultFee: z.number().optional(),
  firstVisitFee: z.number().optional(),
});

router.post('/staff', validate(createStaffSchema), async (req: AuthRequest, res: Response) => {
  const { Hospital } = await import('../models/Hospital');
  const cleanEmail = req.body.email.trim().toLowerCase();

  // Validate unique email across Users and Hospitals
  const [existingUser, existingHosp] = await Promise.all([
    User.findOne({ email: cleanEmail }),
    Hospital.findOne({ email: cleanEmail }),
  ]);

  if (existingUser || existingHosp) {
    throw new AppError('this email id is already exists', 409, 'DUPLICATE_EMAIL');
  }

  // Ensure unique username
  let baseUsername = (req.body.username || cleanEmail.split('@')[0])
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '');

  if (!baseUsername) baseUsername = 'staff';

  let finalUsername = baseUsername;
  let count = 1;
  while (await User.findOne({ username: finalUsername })) {
    finalUsername = `${baseUsername}${count++}`;
  }

  const user = await User.create({
    ...req.body,
    username: finalUsername,
    email: cleanEmail,
    hospitalId: req.user?.hospitalId,
    passwordHash: req.body.password, // pre-save hook hashes it
  });

  res.locals.auditDescription = `Created new staff account: ${user.fullName} (${user.role})`;
  res.locals.auditDetails = { fullName: user.fullName, role: user.role, username: user.username, email: user.email };

  res.status(201).json({ success: true, data: user.toJSON() });
});

router.get('/staff', async (req: AuthRequest, res: Response) => {
  const filter: any = {};
  if (req.user?.hospitalId) {
    filter.hospitalId = req.user.hospitalId;
  }
  const staff = await User.find(filter).sort({ createdAt: -1 });
  res.json({ success: true, data: staff });
});

router.get('/staff/:id', async (req: AuthRequest, res: Response) => {
  const filter: any = { _id: req.params.id };
  if (req.user?.hospitalId) {
    filter.hospitalId = req.user.hospitalId;
  }
  const user = await User.findOne(filter);
  if (!user) throw new AppError('Staff not found', 404, 'NOT_FOUND');
  res.json({ success: true, data: user.toJSON() });
});

const updateStaffSchema = z.object({
  fullName: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  role: z.enum(['Admin', 'Receptionist', 'Doctor', 'MedicationGiver', 'StockManager']).optional(),
  specialization: z.string().optional().or(z.literal('')),
  consultFee: z.number().optional(),
  firstVisitFee: z.number().optional(),
  isAvailable: z.boolean().optional(),
});

router.patch('/staff/:id', validate(updateStaffSchema), async (req: AuthRequest, res: Response) => {
  const filter: any = { _id: req.params.id };
  if (req.user?.hospitalId) {
    filter.hospitalId = req.user.hospitalId;
  }

  if (req.body.email?.trim()) {
    const cleanEmail = req.body.email.trim().toLowerCase();
    const existing = await User.findOne({ email: cleanEmail, _id: { $ne: req.params.id } });
    if (existing) {
      throw new AppError('this email id is already exists', 409, 'DUPLICATE_EMAIL');
    }
  }

  const user = await User.findOneAndUpdate(filter, req.body, { new: true, runValidators: true });
  if (!user) throw new AppError('Staff not found', 404, 'NOT_FOUND');
  res.locals.auditDescription = `Updated staff profile details for ${user.fullName} (${user.role})`;
  res.json({ success: true, data: user.toJSON() });
});

router.patch('/staff/:id/status', async (req: AuthRequest, res: Response) => {
  const { status } = req.body;
  if (!['Active', 'Suspended', 'Deactivated'].includes(status)) {
    throw new AppError('Invalid status', 400, 'INVALID_STATUS');
  }
  const filter: any = { _id: req.params.id };
  if (req.user?.hospitalId) {
    filter.hospitalId = req.user.hospitalId;
  }
  const user = await User.findOneAndUpdate(filter, { status }, { new: true });
  if (!user) throw new AppError('Staff not found', 404, 'NOT_FOUND');
  res.locals.auditDescription = `${status === 'Active' ? 'Activated' : 'Suspended'} staff account: ${user.fullName} (${user.role})`;
  res.json({ success: true, data: user.toJSON() });
});

router.patch('/staff/:id/password', async (req: AuthRequest, res: Response) => {
  const { password } = req.body;
  if (!password || password.length < 6) throw new AppError('Password must be at least 6 characters', 400, 'INVALID_PASSWORD');
  const filter: any = { _id: req.params.id };
  if (req.user?.hospitalId) {
    filter.hospitalId = req.user.hospitalId;
  }
  const user = await User.findOne(filter);
  if (!user) throw new AppError('Staff not found', 404, 'NOT_FOUND');
  user.passwordHash = password;
  await user.save();
  res.locals.auditDescription = `Updated login password for ${user.fullName}`;
  res.json({ success: true, message: 'Password updated' });
});

router.delete('/staff/:id', async (req: AuthRequest, res: Response) => {
  if (req.params.id === req.user?.id) {
    throw new AppError('Cannot remove your own admin account', 400, 'CANNOT_REMOVE_SELF');
  }

  const filter: any = { _id: req.params.id };
  if (req.user?.hospitalId) {
    filter.hospitalId = req.user.hospitalId;
  }

  const user = await User.findOneAndDelete(filter);
  if (!user) throw new AppError('Staff member not found', 404, 'NOT_FOUND');

  res.locals.auditDescription = `Removed staff member account: ${user.fullName} (${user.role})`;
  res.json({ success: true, message: `Staff member ${user.fullName} removed successfully` });
});

// ==================== DOCTORS ====================

router.get('/doctors', async (req: AuthRequest, res: Response) => {
  const filter: any = { role: 'Doctor' };
  if (req.user?.hospitalId) {
    filter.hospitalId = req.user.hospitalId;
  }
  const doctors = await User.find(filter).sort({ fullName: 1 });
  res.json({ success: true, data: doctors });
});

// ==================== CLINIC SETTINGS ====================

router.get('/settings', async (req: AuthRequest, res: Response) => {
  const settings = await getClinicSettings();
  const { Hospital } = await import('../models/Hospital');
  let hospital = null;
  if (req.user?.hospitalId) {
    hospital = await Hospital.findById(req.user.hospitalId);
  }
  if (!hospital) {
    hospital = await Hospital.findOne({ status: 'Active' });
  }
  if (hospital) {
    return res.json({
      success: true,
      data: {
        ...settings.toJSON(),
        clinicName: hospital.name,
        shortName: hospital.shortName,
        address: hospital.address || settings.address,
        phone: hospital.phone || settings.phone,
        email: hospital.email || settings.email,
        gstNumber: hospital.gstNumber || settings.gstNumber,
        registrationFee: hospital.registrationFee !== undefined ? hospital.registrationFee : (settings.registrationFee || 0),
      },
    });
  }
  res.json({ success: true, data: settings });
});

const updateSettingsSchema = z.object({
  clinicName: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  gstNumber: z.string().optional(),
  registrationFee: z.number().min(0).optional(),
  appointmentDuration: z.number().min(5).max(120).optional(),
  workingHours: z.object({
    start: z.string(),
    end: z.string(),
  }).optional(),
});

router.patch('/settings', validate(updateSettingsSchema), async (req: AuthRequest, res: Response) => {
  const settings = await ClinicSettings.findByIdAndUpdate(
    'clinic_settings',
    req.body,
    { new: true, upsert: true, runValidators: true }
  );
  if (req.user?.hospitalId) {
    const { Hospital } = await import('../models/Hospital');
    await Hospital.findByIdAndUpdate(req.user.hospitalId, req.body);
  }
  res.locals.auditDescription = 'Updated clinic configuration & hospitality settings';
  res.json({ success: true, data: settings });
});

// ==================== GST RULES ====================

router.get('/gst-rules', async (_req: AuthRequest, res: Response) => {
  const settings = await getClinicSettings();
  res.json({ success: true, data: settings.gstRules });
});

const gstRuleSchema = z.object({
  itemType: z.string().min(1),
  gstRate: z.number().min(0).max(100),
});

router.post('/gst-rules', validate(gstRuleSchema), async (req: AuthRequest, res: Response) => {
  const settings = await getClinicSettings();
  settings.gstRules.push({ ...req.body, updatedAt: new Date() });
  await settings.save();
  res.locals.auditDescription = `Configured new GST tax rule: ${req.body.itemType} (${req.body.gstRate}%)`;
  res.status(201).json({ success: true, data: settings.gstRules });
});

router.patch('/gst-rules/:ruleId', validate(gstRuleSchema), async (req: AuthRequest, res: Response) => {
  const settings = await getClinicSettings();
  const rule = settings.gstRules.find((r: any) => r._id?.toString() === req.params.ruleId);
  if (!rule) throw new AppError('GST rule not found', 404, 'NOT_FOUND');
  rule.itemType = req.body.itemType;
  rule.gstRate = req.body.gstRate;
  rule.updatedAt = new Date();
  await settings.save();
  res.locals.auditDescription = `Updated GST tax rate for ${rule.itemType} to ${rule.gstRate}%`;
  res.json({ success: true, data: settings.gstRules });
});

router.delete('/gst-rules/:ruleId', async (req: AuthRequest, res: Response) => {
  const settings = await getClinicSettings();
  settings.gstRules = settings.gstRules.filter((r: any) => r._id?.toString() !== req.params.ruleId);
  await settings.save();
  res.locals.auditDescription = 'Removed GST tax rule';
  res.json({ success: true, data: settings.gstRules });
});

// ==================== AUDIT LOG ====================

router.get('/audit-log', async (req: AuthRequest, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
  const skip = (page - 1) * limit;
  const { search, role, from, to } = req.query;

  const filter: any = {};
  if (req.user?.hospitalId) {
    filter.hospitalId = req.user.hospitalId;
  }
  if (role && role !== 'all') {
    filter.userRole = role;
  }
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from as string);
    if (to) filter.createdAt.$lte = new Date(to as string);
  }
  if (search && typeof search === 'string' && search.trim()) {
    const q = search.trim();
    filter.$or = [
      { description: { $regex: q, $options: 'i' } },
      { action: { $regex: q, $options: 'i' } },
      { actorName: { $regex: q, $options: 'i' } },
      { resource: { $regex: q, $options: 'i' } },
      { ipAddress: { $regex: q, $options: 'i' } },
    ];
  }

  const [logs, total] = await Promise.all([
    AuditLog.find(filter)
      .populate('userId', 'fullName username role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    AuditLog.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: logs,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

// ==================== REPORTS ====================

router.get('/reports/summary', async (req: AuthRequest, res: Response) => {
  const hospitalFilter: any = {};
  if (req.user?.hospitalId) {
    hospitalFilter.hospitalId = new mongoose.Types.ObjectId(req.user.hospitalId);
  }

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const ninetyDaysLater = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

  // 1. Collections: Today, Month, and by Mode
  const [todayRes, monthRes, modeRes, pendingRes, gstRes, stockRes] = await Promise.all([
    Invoice.aggregate([
      { $match: hospitalFilter },
      { $unwind: '$payments' },
      { $match: { 'payments.paidAt': { $gte: startOfToday } } },
      {
        $group: {
          _id: null,
          total: { $sum: '$payments.amount' },
          count: { $sum: 1 },
        },
      },
    ]),
    Invoice.aggregate([
      { $match: hospitalFilter },
      { $unwind: '$payments' },
      { $match: { 'payments.paidAt': { $gte: startOfMonth } } },
      {
        $group: {
          _id: null,
          total: { $sum: '$payments.amount' },
          count: { $sum: 1 },
        },
      },
    ]),
    Invoice.aggregate([
      { $match: hospitalFilter },
      { $unwind: '$payments' },
      {
        $group: {
          _id: '$payments.mode',
          total: { $sum: '$payments.amount' },
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          mode: { $ifNull: ['$_id', 'Other'] },
          total: 1,
          count: 1,
        },
      },
    ]),
    // 2. Pending Dues
    Invoice.aggregate([
      { $match: { ...hospitalFilter, status: { $in: ['Unpaid', 'Partially Paid'] } } },
      {
        $group: {
          _id: null,
          totalDue: { $sum: { $subtract: ['$grandTotal', '$amountPaid'] } },
          count: { $sum: 1 },
        },
      },
    ]),
    // 3. GST Summary (Taxable, Total GST)
    Invoice.aggregate([
      { $match: hospitalFilter },
      {
        $group: {
          _id: null,
          taxableSales: { $sum: '$subtotal' },
          totalGst: { $sum: '$totalGst' },
          grandTotal: { $sum: '$grandTotal' },
          totalPaid: { $sum: '$amountPaid' },
          totalInvoices: { $sum: 1 },
        },
      },
    ]),
    // 4. Stock Valuation
    Medicine.aggregate([
      { $match: { ...hospitalFilter, isActive: true } },
      { $unwind: { path: '$batches', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: null,
          totalItems: { $addToSet: '$_id' },
          totalUnits: { $sum: { $ifNull: ['$batches.quantity', 0] } },
          costValue: {
            $sum: {
              $multiply: [
                { $ifNull: ['$batches.quantity', 0] },
                { $ifNull: ['$batches.purchasePrice', '$costPrice', 0] },
              ],
            },
          },
          retailValue: {
            $sum: {
              $multiply: [
                { $ifNull: ['$batches.quantity', 0] },
                { $ifNull: ['$sellingPrice', 0] },
              ],
            },
          },
        },
      },
    ]),
  ]);

  const totalGst = gstRes[0]?.totalGst || 0;
  const halfGst = Math.round((totalGst / 2) * 100) / 100;

  // 5. Expiry Risk & Fast Movers
  const [fastMovers, expiryRisk] = await Promise.all([
    Visit.aggregate([
      { $match: { ...hospitalFilter, visitDate: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } },
      { $unwind: '$prescriptions' },
      { $match: { 'prescriptions.isDispensed': true } },
      {
        $group: {
          _id: '$prescriptions.medicineName',
          totalUnits: { $sum: '$prescriptions.quantity' },
          count: { $sum: 1 },
        },
      },
      { $sort: { totalUnits: -1 } },
      { $limit: 5 },
    ]),
    Medicine.aggregate([
      { $match: { ...hospitalFilter, isActive: true } },
      { $unwind: '$batches' },
      {
        $match: {
          'batches.expiryDate': { $lte: ninetyDaysLater },
          'batches.quantity': { $gt: 0 },
        },
      },
      {
        $project: {
          name: 1,
          batchNumber: '$batches.batchNumber',
          quantity: '$batches.quantity',
          expiryDate: '$batches.expiryDate',
          valueAtRisk: {
            $multiply: ['$batches.quantity', { $ifNull: ['$batches.purchasePrice', '$costPrice', 0] }],
          },
        },
      },
      { $sort: { expiryDate: 1 } },
      { $limit: 8 },
    ]),
  ]);

  res.json({
    success: true,
    data: {
      dailyCollections: {
        todayAmount: todayRes[0]?.total || 0,
        todayCount: todayRes[0]?.count || 0,
        monthAmount: monthRes[0]?.total || 0,
        monthCount: monthRes[0]?.count || 0,
      },
      pendingDues: {
        totalAmount: pendingRes[0]?.totalDue || 0,
        totalInvoices: pendingRes[0]?.count || 0,
      },
      gstSummary: {
        taxableSales: gstRes[0]?.taxableSales || 0,
        cgst: halfGst,
        sgst: halfGst,
        totalGst,
        grandTotal: gstRes[0]?.grandTotal || 0,
        totalPaid: gstRes[0]?.totalPaid || 0,
        totalInvoices: gstRes[0]?.totalInvoices || 0,
      },
      stockValuation: {
        totalItems: stockRes[0]?.totalItems?.length || 0,
        totalUnits: stockRes[0]?.totalUnits || 0,
        costValue: Math.round((stockRes[0]?.costValue || 0) * 100) / 100,
        retailValue: Math.round((stockRes[0]?.retailValue || 0) * 100) / 100,
      },
      byPaymentMode: modeRes || [],
      fastMovers: fastMovers || [],
      expiryRisk: expiryRisk || [],
    },
  });
});

router.get('/reports/fast-movers', async (req: AuthRequest, res: Response) => {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const matchStage: any = { visitDate: { $gte: thirtyDaysAgo } };
  if (req.user?.hospitalId) {
    matchStage.hospitalId = new mongoose.Types.ObjectId(req.user.hospitalId);
  }

  const results = await Visit.aggregate([
    { $match: matchStage },
    { $unwind: '$prescriptions' },
    { $match: { 'prescriptions.isDispensed': true } },
    {
      $group: {
        _id: '$prescriptions.medicineId',
        medicineName: { $first: '$prescriptions.medicineName' },
        totalDispensed: { $sum: '$prescriptions.quantity' },
        dispensedCount: { $sum: 1 },
      },
    },
    { $sort: { totalDispensed: -1 } },
    { $limit: 20 },
  ]);

  res.json({ success: true, data: results });
});

router.get('/reports/expiry-risk', async (req: AuthRequest, res: Response) => {
  const threeMonths = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
  const matchStage: any = { 'batches.expiryDate': { $lte: threeMonths }, 'batches.quantity': { $gt: 0 } };
  if (req.user?.hospitalId) {
    matchStage.hospitalId = new mongoose.Types.ObjectId(req.user.hospitalId);
  }

  const results = await Medicine.aggregate([
    { $unwind: '$batches' },
    { $match: matchStage },
    {
      $project: {
        name: 1,
        batchNumber: '$batches.batchNumber',
        quantity: '$batches.quantity',
        expiryDate: '$batches.expiryDate',
        valueAtRisk: { $multiply: ['$batches.quantity', '$batches.purchasePrice'] },
      },
    },
    { $sort: { expiryDate: 1 } },
  ]);

  res.json({ success: true, data: results });
});

router.get('/reports/collections', async (req: AuthRequest, res: Response) => {
  const from = req.query.from ? new Date(req.query.from as string) : new Date(new Date().setHours(0, 0, 0, 0));
  const to = req.query.to ? new Date(req.query.to as string) : new Date();

  const matchStage: any = { createdAt: { $gte: from, $lte: to } };
  if (req.user?.hospitalId) {
    matchStage.hospitalId = new mongoose.Types.ObjectId(req.user.hospitalId);
  }

  const results = await Invoice.aggregate([
    { $match: matchStage },
    { $unwind: '$payments' },
    {
      $group: {
        _id: '$payments.mode',
        total: { $sum: '$payments.amount' },
        count: { $sum: 1 },
      },
    },
  ]);

  const totalCollected = results.reduce((sum: number, r: any) => sum + r.total, 0);

  res.json({
    success: true,
    data: { byMode: results, totalCollected, from, to },
  });
});

export default router;
