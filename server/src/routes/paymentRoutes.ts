import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { AuthRequest, authMiddleware } from '../middleware/authMiddleware';
import { receptionistOrAdmin } from '../middleware/roleMiddleware';
import { validate } from '../middleware/validateMiddleware';
import { auditMiddleware } from '../middleware/auditMiddleware';
import { AppError } from '../middleware/errorMiddleware';
import { getClinicSettings } from '../models/ClinicSettings';
import { PharmacyPayment } from '../models/PharmacyPayment';
import { Visit } from '../models/Visit';
import { razorpay, isTestMode } from '../config/razorpay';
import { emitToRole } from '../config/socket';
import { env } from '../config/env';

const router = Router();

// ─────────────────────────────────────────────────────────────────────────────
// RAZORPAY WEBHOOK  (public — no auth, verified by HMAC-SHA256 signature)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    const signature = req.headers['x-razorpay-signature'] as string;
    // Use the raw body stashed by express.json verify callback
    const rawBody = (req as any).rawBody || JSON.stringify(req.body);

    // Verify webhook signature (always — not just production)
    if (signature && env.RAZORPAY_WEBHOOK_SECRET) {
      const expected = crypto
        .createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET)
        .update(rawBody)
        .digest('hex');

      if (expected !== signature) {
        console.warn('[Payment Webhook] Signature mismatch — rejecting');
        return res.status(400).json({ error: 'Invalid webhook signature' });
      }
    }

    const event = req.body?.event;
    const payment = req.body?.payload?.payment?.entity;

    // ── payment.captured → mark paid ──
    if (event === 'payment.captured' && payment) {
      const orderId   = payment.order_id;
      const paymentId = payment.id;
      const amount    = payment.amount ? payment.amount / 100 : 0; // paise → rupees

      // Find the pending PharmacyPayment tied to this Razorpay order
      const record = await PharmacyPayment.findOne({
        razorpayOrderId: orderId,
        status: 'pending',
      });

      if (record) {
        // Guard: skip if this paymentId was already recorded (idempotency)
        const alreadyRecorded = await PharmacyPayment.findOne({ razorpayPaymentId: paymentId });
        if (!alreadyRecorded) {
          record.razorpayPaymentId = paymentId;
          record.status = 'paid';
          record.paidAt = new Date();
          record.amount = amount || record.amount;
          await record.save();

          // Sync visit feeStatus if visitId was attached
          if (record.visitId) {
            try {
              const visit = await Visit.findById(record.visitId);
              if (visit && visit.feeStatus !== 'Paid') {
                visit.feeStatus = 'Paid';
                await visit.save();
                emitToRole('Receptionist', 'queue:updated', { action: 'fee-status-changed', visit });
              }
            } catch (vErr) {
              console.error('[Payment Webhook] Visit sync error:', vErr);
            }
          }

          // Broadcast to Med-Giver and Receptionist so modals update in real-time
          const socketPayload = {
            orderId,
            paymentId,
            amount: record.amount,
            patientName: record.patientName,
            recordId: record._id,
            visitId: record.visitId,
          };
          emitToRole('MedicationGiver', 'payment:confirmed', socketPayload);
          emitToRole('Receptionist',   'payment:confirmed', socketPayload);

          if (isTestMode) {
            console.log(`✅ [Razorpay TEST] Payment confirmed: ₹${record.amount} for ${record.patientName}`);
          }
        }
      }
    }

    // ── payment.failed → mark failed ──
    if (event === 'payment.failed' && payment) {
      const orderId = payment.order_id;
      const record = await PharmacyPayment.findOne({
        razorpayOrderId: orderId,
        status: 'pending',
      });
      if (record) {
        record.status = 'failed';
        await record.save();
        emitToRole('MedicationGiver', 'payment:failed', { orderId, recordId: record._id });

        if (isTestMode) {
          console.log(`❌ [Razorpay TEST] Payment failed for order: ${orderId}`);
        }
      }
    }

    res.status(200).json({ status: 'ok' });
  } catch (err) {
    console.error('[Payment Webhook] Error:', err);
    res.status(200).json({ status: 'error_logged' }); // always 200 to Razorpay
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// All routes below require authentication
// ─────────────────────────────────────────────────────────────────────────────
router.use(authMiddleware, auditMiddleware('payment'));

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/payment/settings
// Returns current pharmacy payment config (both toggle states + static QR info)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/settings', async (req: AuthRequest, res: Response) => {
  const settings = await getClinicSettings();
  res.json({
    success: true,
    data: {
      ...settings.pharmacyPayment,
      razorpayKeyId: env.RAZORPAY_KEY_ID, // public key only — safe to send to frontend
      isTestMode,
    },
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/payment/settings
// Update any combination of the 4 config fields
// ─────────────────────────────────────────────────────────────────────────────
const updateSettingsSchema = z.object({
  staticQrEnabled:     z.boolean().optional(),
  staticQrVpa:         z.string().optional(),
  staticQrDisplayName: z.string().optional(),
  dynamicQrEnabled:    z.boolean().optional(),
});

router.put(
  '/settings',
  receptionistOrAdmin,
  validate(updateSettingsSchema),
  async (req: AuthRequest, res: Response) => {
    const settings = await getClinicSettings();

    // Merge only the provided fields
    if (req.body.staticQrEnabled     !== undefined) settings.pharmacyPayment.staticQrEnabled     = req.body.staticQrEnabled;
    if (req.body.staticQrVpa         !== undefined) settings.pharmacyPayment.staticQrVpa         = req.body.staticQrVpa;
    if (req.body.staticQrDisplayName !== undefined) settings.pharmacyPayment.staticQrDisplayName = req.body.staticQrDisplayName;
    if (req.body.dynamicQrEnabled    !== undefined) settings.pharmacyPayment.dynamicQrEnabled    = req.body.dynamicQrEnabled;

    settings.markModified('pharmacyPayment');
    await settings.save();

    // Broadcast updated settings so all open clients update their UI instantly
    emitToRole('MedicationGiver', 'settings:payment-updated', settings.pharmacyPayment);
    emitToRole('Receptionist',   'settings:payment-updated', settings.pharmacyPayment);

    res.json({ success: true, data: settings.pharmacyPayment });
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/payment/dynamic-order
// Creates a Razorpay order and returns the short_url for QR generation
// ─────────────────────────────────────────────────────────────────────────────
const dynamicOrderSchema = z.object({
  amount:      z.number().min(1, 'Amount must be at least ₹1'),
  visitId:     z.string().optional(),
  patientName: z.string().optional(),
  notes:       z.string().optional(),
  source:      z.string().optional(),
  callbackUrl: z.string().optional(),
});

router.post(
  '/dynamic-order',
  validate(dynamicOrderSchema),
  async (req: AuthRequest, res: Response) => {
    const settings = await getClinicSettings();

    if (!settings.pharmacyPayment.dynamicQrEnabled) {
      throw new AppError('Dynamic QR payment is disabled', 402, 'PAYMENT_DISABLED');
    }

    const { amount, visitId, patientName, notes, source, callbackUrl } = req.body;
    const amountPaise = Math.round(amount * 100); // Razorpay uses paise

    const orderDescription = notes
      ? `${notes} — ${patientName || 'Patient'}`
      : `Clinic Payment — ${patientName || 'Patient'}`;

    // Create Razorpay Payment Link — returns a short_url that works as QR value
    const link = await razorpay.paymentLink.create({
      amount: amountPaise,
      currency: 'INR',
      description: orderDescription.slice(0, 255),
      customer: {
        name: patientName || 'Patient',
        contact: '',
        email: '',
      },
      notify: { sms: false, email: false },
      notes: {
        patientName: patientName || 'Patient',
        visitId: visitId || '',
        source: source || (notes?.toLowerCase().includes('consult') ? 'DermaTrack Reception' : 'DermaTrack Pharmacy'),
      },
      callback_url: callbackUrl || (source === 'Reception' ? `${env.CLIENT_URL}/receptionist` : `${env.CLIENT_URL}/medication-giver`),
      callback_method: 'get' as any,
    });

    // The link response contains id and short_url
    const linkId   = link.id;
    const shortUrl = link.short_url;

    // Save a pending PharmacyPayment record
    const record = await PharmacyPayment.create({
      hospitalId:       (req.user as any)?.hospitalId,
      visitId:          visitId || undefined,
      patientName:      patientName,
      amount,
      mode:             'dynamic_qr',
      razorpayOrderId:  linkId,
      status:           'pending',
      notes,
      recordedBy:       req.user!.id,
    });

    if (isTestMode) {
      console.log(`🧪 [Razorpay TEST] Payment Link created: ${shortUrl} for ₹${amount}`);
    }

    res.json({
      success: true,
      data: {
        recordId:    record._id,
        orderId:     linkId,
        amount,
        currency:    'INR',
        keyId:       env.RAZORPAY_KEY_ID,
        isTestMode,
        // short_url is scannable by UPI apps AND works as a web payment page
        qrValue:     shortUrl,
      },
    });
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/payment/manual-confirm
// Staff manually confirms a static QR payment was received (cash-like flow)
// ─────────────────────────────────────────────────────────────────────────────
const manualConfirmSchema = z.object({
  amount:      z.number().min(1),
  visitId:     z.string().optional(),
  patientName: z.string().optional(),
  notes:       z.string().optional(),
});

router.post(
  '/manual-confirm',
  validate(manualConfirmSchema),
  async (req: AuthRequest, res: Response) => {
    const settings = await getClinicSettings();

    if (!settings.pharmacyPayment.staticQrEnabled) {
      throw new AppError('Static QR payment is disabled', 402, 'PAYMENT_DISABLED');
    }

    const { amount, visitId, patientName, notes } = req.body;

    const record = await PharmacyPayment.create({
      hospitalId:  (req.user as any)?.hospitalId,
      visitId:     visitId || undefined,
      patientName,
      amount,
      mode:        'static_qr',
      status:      'paid',
      notes,
      recordedBy:  req.user!.id,
      paidAt:      new Date(),
    });

    // Sync visit feeStatus if visitId was attached
    if (visitId) {
      try {
        const visit = await Visit.findById(visitId);
        if (visit && visit.feeStatus !== 'Paid') {
          visit.feeStatus = 'Paid';
          await visit.save();
          emitToRole('Receptionist', 'queue:updated', { action: 'fee-status-changed', visit });
        }
      } catch (vErr) {
        console.error('[Manual Confirm] Visit sync error:', vErr);
      }
    }

    // Notify other clients (e.g. receptionist screen) that a payment was recorded
    emitToRole('Receptionist', 'payment:confirmed', {
      recordId:    record._id,
      amount,
      patientName,
      mode:        'static_qr',
      visitId,
    });

    res.json({ success: true, data: record });
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/payment/history
// Paginated list of all PharmacyPayment records with optional filters
// ?mode=static_qr|dynamic_qr  &status=pending|paid|failed  &page=1  &limit=20
// ─────────────────────────────────────────────────────────────────────────────
router.get('/history', async (req: AuthRequest, res: Response) => {
  const page   = Math.max(1, parseInt(req.query.page  as string) || 1);
  const limit  = Math.min(100, parseInt(req.query.limit as string) || 20);
  const skip   = (page - 1) * limit;

  const filter: Record<string, any> = {};
  if ((req.user as any)?.hospitalId) filter.hospitalId = (req.user as any).hospitalId;
  if (req.query.mode)   filter.mode   = req.query.mode;
  if (req.query.status) filter.status = req.query.status;

  const [records, total] = await Promise.all([
    PharmacyPayment.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('recordedBy', 'name role'),
    PharmacyPayment.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: { records, total, page, pages: Math.ceil(total / limit) },
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/payment/stats
// KPI stats broken down by mode (for the Payments tab KPI cards)
// ?period=today|week|month
// ─────────────────────────────────────────────────────────────────────────────
router.get('/stats', async (req: AuthRequest, res: Response) => {
  const period = req.query.period || 'today';
  const now    = new Date();
  let   start  = new Date();

  if (period === 'today') {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  } else if (period === 'week') {
    start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  } else if (period === 'month') {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  const matchBase: Record<string, any> = { status: 'paid', createdAt: { $gte: start } };
  if ((req.user as any)?.hospitalId) matchBase.hospitalId = (req.user as any).hospitalId;

  const stats = await PharmacyPayment.aggregate([
    { $match: matchBase },
    {
      $group: {
        _id:          '$mode',
        totalRevenue: { $sum: '$amount' },
        count:        { $sum: 1 },
      },
    },
  ]);

  const result = {
    totalRevenue:        0,
    totalCount:          0,
    staticQrRevenue:     0,
    staticQrCount:       0,
    dynamicQrRevenue:    0,
    dynamicQrCount:      0,
  };

  for (const s of stats) {
    result.totalRevenue += s.totalRevenue;
    result.totalCount   += s.count;
    if (s._id === 'static_qr') {
      result.staticQrRevenue = s.totalRevenue;
      result.staticQrCount   = s.count;
    } else if (s._id === 'dynamic_qr') {
      result.dynamicQrRevenue = s.totalRevenue;
      result.dynamicQrCount   = s.count;
    }
  }

  res.json({ success: true, data: result });
});

export default router;
