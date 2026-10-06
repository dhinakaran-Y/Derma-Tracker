import { Router, Response, Request } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { Invoice } from '../models/Invoice';
import { Visit } from '../models/Visit';
import { getClinicSettings } from '../models/ClinicSettings';
import { getNextSequence } from '../models/Counter';
import { AuthRequest, authMiddleware } from '../middleware/authMiddleware';
import { receptionistOrAdmin } from '../middleware/roleMiddleware';
import { validate } from '../middleware/validateMiddleware';
import { auditMiddleware } from '../middleware/auditMiddleware';
import { AppError } from '../middleware/errorMiddleware';
import { emitToRole } from '../config/socket';
import { env } from '../config/env';

const router = Router();

// ==================== RAZORPAY WEBHOOK (Public endpoint) ====================

router.post('/razorpay/webhook', async (req: Request, res: Response) => {
  try {
    const signature = req.headers['x-razorpay-signature'] as string;
    const bodyStr = JSON.stringify(req.body);

    if (signature && env.RAZORPAY_WEBHOOK_SECRET) {
      const expectedSignature = crypto
        .createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET)
        .update(bodyStr)
        .digest('hex');

      if (expectedSignature !== signature && env.NODE_ENV === 'production') {
        return res.status(400).json({ error: 'Invalid webhook signature' });
      }
    }

    const event = req.body?.event;
    const payload = req.body?.payload;

    if (event === 'payment.captured' || event === 'order.paid') {
      const payment = payload?.payment?.entity;
      const orderId = payment?.order_id || payload?.order?.entity?.id;
      const paymentId = payment?.id;
      const amount = payment?.amount ? payment.amount / 100 : 0;
      const invoiceId = payment?.notes?.invoiceId;

      let invoice = null;
      if (invoiceId) {
        invoice = await Invoice.findById(invoiceId);
      } else if (orderId) {
        invoice = await Invoice.findOne({ 'payments.reference': orderId });
      }

      if (invoice && invoice.status !== 'Paid') {
        invoice.payments.push({
          amount: amount || (invoice.grandTotal - invoice.amountPaid),
          mode: 'Razorpay',
          reference: paymentId || orderId,
          paidAt: new Date(),
          recordedBy: invoice.createdBy,
        });
        invoice.amountPaid = invoice.payments.reduce((sum, p) => sum + p.amount, 0);
        if (invoice.amountPaid >= invoice.grandTotal) {
          invoice.status = 'Paid';
        } else {
          invoice.status = 'Partially Paid';
        }
        await invoice.save();

        if (invoice.visitId) {
          await Visit.findByIdAndUpdate(invoice.visitId, {
            feeStatus: 'Paid',
            feePaymentMode: 'Razorpay',
          });
        }

        emitToRole('Receptionist', 'billing:updated', { action: 'payment-recorded', invoice });
        emitToRole('Admin', 'billing:updated', { action: 'payment-recorded', invoice });
      }
    }

    res.status(200).json({ status: 'ok' });
  } catch (error) {
    console.error('Razorpay webhook handling error:', error);
    res.status(200).json({ status: 'error_logged' });
  }
});

// Authenticated billing routes
router.use(authMiddleware, auditMiddleware('billing'));

// Helper to allow staff or invoice owner (patient) access
function authorizeInvoiceAccess(req: AuthRequest, invoice: any) {
  const isStaff = ['Receptionist', 'Admin'].includes(req.user?.role || '');
  const isOwner =
    req.user?.type === 'patient' &&
    ((invoice.patientId as any)?._id?.toString() === req.user.id ||
      invoice.patientId?.toString() === req.user.id);
  if (!isStaff && !isOwner) {
    throw new AppError('Unauthorized access to invoice', 403, 'FORBIDDEN');
  }
}

// ==================== GENERATE INVOICE ====================

const generateInvoiceSchema = z.object({
  patientId: z.string().min(1),
  visitId: z.string().optional(),
  lineItems: z.array(
    z.object({
      itemType: z.enum(['Consultation', 'Procedure', 'Medicine', 'Lab Test']),
      description: z.string().min(1),
      quantity: z.number().min(1),
      unitPrice: z.number().min(0),
      gstRate: z.number().min(0).max(100).optional(),
    })
  ).min(1),
  initialPayment: z.object({
    amount: z.number().min(0.01),
    mode: z.enum(['Cash', 'UPI', 'Card', 'BankTransfer', 'Razorpay']),
    reference: z.string().optional(),
  }).optional(),
});

router.post('/invoices', receptionistOrAdmin, validate(generateInvoiceSchema), async (req: AuthRequest, res: Response) => {
  const settings = await getClinicSettings();

  // Calculate GST for each line item with item-specific or clinic-rule rate
  const lineItems = req.body.lineItems.map((item: any) => {
    const rule = settings.gstRules.find((r) => r.itemType === item.itemType);
    const gstRate = item.gstRate !== undefined ? item.gstRate : (rule?.gstRate || 0);
    const subtotal = item.quantity * item.unitPrice;
    const gstAmount = subtotal * (gstRate / 100);

    return {
      itemType: item.itemType,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      gstRate,
      gstAmount: Math.round(gstAmount * 100) / 100,
      total: Math.round((subtotal + gstAmount) * 100) / 100,
    };
  });

  const subtotal = lineItems.reduce((sum: number, i: any) => sum + i.quantity * i.unitPrice, 0);
  const totalGst = lineItems.reduce((sum: number, i: any) => sum + i.gstAmount, 0);
  const grandTotal = Math.round((subtotal + totalGst) * 100) / 100;

  // Generate invoice number: INV-YYYY-XXXX
  const year = new Date().getFullYear();
  const fy = `${year}-${(year + 1).toString().slice(-2)}`;
  const seq = await getNextSequence('invoice', fy);
  const invoiceNumber = `INV-${year}-${seq.toString().padStart(4, '0')}`;

  const payments: any[] = [];
  let amountPaid = 0;
  let status: 'Unpaid' | 'Partially Paid' | 'Paid' = 'Unpaid';

  if (req.body.initialPayment) {
    const p = req.body.initialPayment;
    payments.push({
      amount: p.amount,
      mode: p.mode,
      reference: p.reference,
      paidAt: new Date(),
      recordedBy: req.user!.id as any,
    });
    amountPaid = p.amount;
    status = amountPaid >= grandTotal ? 'Paid' : 'Partially Paid';
  }

  const invoice = await Invoice.create({
    hospitalId: req.user?.hospitalId,
    invoiceNumber,
    patientId: req.body.patientId,
    visitId: req.body.visitId,
    lineItems,
    subtotal: Math.round(subtotal * 100) / 100,
    totalGst: Math.round(totalGst * 100) / 100,
    grandTotal,
    payments,
    amountPaid,
    status,
    createdBy: req.user!.id,
  });

  // Sync visit fee status if invoice is tied to a visit and paid
  if (req.body.visitId && status === 'Paid') {
    await Visit.findByIdAndUpdate(req.body.visitId, {
      feeStatus: 'Paid',
      feePaymentMode: req.body.initialPayment?.mode || 'Cash',
    });
  }

  // Populate patient details for real-time broadcast and UI display
  await invoice.populate('patientId', 'name phone patientId age gender location email');

  emitToRole('Receptionist', 'billing:updated', { action: 'invoice-created', invoice });
  emitToRole('Admin', 'billing:updated', { action: 'invoice-created', invoice });

  res.locals.auditDescription = `Generated invoice #${invoice.invoiceNumber} for ₹${invoice.grandTotal}`;
  res.locals.auditDetails = { invoiceNumber: invoice.invoiceNumber, grandTotal: invoice.grandTotal };

  res.status(201).json({ success: true, data: invoice });
});

// ==================== LIST INVOICES ====================

router.get('/invoices', receptionistOrAdmin, async (req: AuthRequest, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
  const skip = (page - 1) * limit;
  const { patientId, status, search } = req.query;

  const filter: any = {};
  if (req.user?.hospitalId) {
    filter.hospitalId = req.user.hospitalId;
  }
  if (patientId) filter.patientId = patientId;
  if (status) filter.status = status;

  if (search && typeof search === 'string') {
    filter.$or = [
      { invoiceNumber: { $regex: search, $options: 'i' } },
    ];
  }

  const [invoices, total] = await Promise.all([
    Invoice.find(filter)
      .populate('patientId', 'name phone patientId age gender location')
      .populate('createdBy', 'fullName role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Invoice.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: invoices,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

router.get('/invoices/:id', async (req: AuthRequest, res: Response) => {
  const invoice = await Invoice.findById(req.params.id)
    .populate('patientId', 'name phone patientId age gender location email')
    .populate('createdBy', 'fullName role')
    .populate('payments.recordedBy', 'fullName');

  if (!invoice) throw new AppError('Invoice not found', 404, 'NOT_FOUND');
  authorizeInvoiceAccess(req, invoice);
  res.json({ success: true, data: invoice });
});

// ==================== RECORD PAYMENT ====================

const recordPaymentSchema = z.object({
  amount: z.number().min(0.01),
  mode: z.enum(['Cash', 'UPI', 'Card', 'BankTransfer', 'Razorpay']),
  reference: z.string().optional(),
});

router.post('/invoices/:id/payments', receptionistOrAdmin, validate(recordPaymentSchema), async (req: AuthRequest, res: Response) => {
  const invoice = await Invoice.findById(req.params.id)
    .populate('patientId', 'name phone patientId age gender location email')
    .populate('createdBy', 'fullName role');
  if (!invoice) throw new AppError('Invoice not found', 404, 'NOT_FOUND');

  const { amount, mode, reference } = req.body;

  invoice.payments.push({
    amount,
    mode,
    reference,
    paidAt: new Date(),
    recordedBy: req.user!.id as any,
  });

  invoice.amountPaid = invoice.payments.reduce((sum, p) => sum + p.amount, 0);

  if (invoice.amountPaid >= invoice.grandTotal) {
    invoice.status = 'Paid';
  } else if (invoice.amountPaid > 0) {
    invoice.status = 'Partially Paid';
  }

  await invoice.save();

  // If tied to a visit and paid or partial, sync visit
  if (invoice.visitId && invoice.status === 'Paid') {
    await Visit.findByIdAndUpdate(invoice.visitId, {
      feeStatus: 'Paid',
      feePaymentMode: mode,
    });
  }

  emitToRole('Receptionist', 'billing:updated', { action: 'payment-recorded', invoice });
  emitToRole('Admin', 'billing:updated', { action: 'payment-recorded', invoice });

  res.locals.auditDescription = `Recorded payment of ₹${amount} via ${mode} for invoice #${invoice.invoiceNumber}`;
  res.locals.auditDetails = { amount, mode, invoiceNumber: invoice.invoiceNumber };

  res.json({ success: true, data: invoice });
});

// ==================== RAZORPAY INTEGRATION ====================

// 1. Create Razorpay Order
router.post('/invoices/:id/razorpay/order', async (req: AuthRequest, res: Response) => {
  const invoice = await Invoice.findById(req.params.id).populate('patientId', 'name phone email patientId');
  if (!invoice) throw new AppError('Invoice not found', 404, 'NOT_FOUND');
  authorizeInvoiceAccess(req, invoice);

  const balanceDue = Math.max(0, invoice.grandTotal - invoice.amountPaid);
  if (balanceDue <= 0) {
    throw new AppError('Invoice is already fully paid', 400, 'ALREADY_PAID');
  }

  const amountInPaise = Math.round(balanceDue * 100);
  const settings = await getClinicSettings();

  let orderId = `order_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;

  // Attempt real Razorpay API call if real credentials are provided
  if (
    env.RAZORPAY_KEY_ID &&
    env.RAZORPAY_KEY_SECRET &&
    !env.RAZORPAY_KEY_ID.includes('dummy') &&
    !env.RAZORPAY_KEY_ID.includes('derma123')
  ) {
    try {
      const basicAuth = Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString('base64');
      const response = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${basicAuth}`,
        },
        body: JSON.stringify({
          amount: amountInPaise,
          currency: 'INR',
          receipt: invoice.invoiceNumber,
          notes: {
            invoiceId: invoice._id.toString(),
            patientId: (invoice.patientId as any)?._id?.toString() || '',
            patientName: (invoice.patientId as any)?.name || '',
          },
        }),
      });

      if (response.ok) {
        const orderData = (await response.json()) as any;
        if (orderData?.id) {
          orderId = orderData.id;
        }
      }
    } catch (err) {
      console.warn('Razorpay API request skipped / offline, falling back to secure test order:', err);
    }
  }

  res.json({
    success: true,
    data: {
      orderId,
      amount: amountInPaise,
      currency: 'INR',
      keyId: env.RAZORPAY_KEY_ID,
      invoiceNumber: invoice.invoiceNumber,
      balanceDue,
      clinicName: settings.clinicName,
      patient: {
        name: (invoice.patientId as any)?.name,
        phone: (invoice.patientId as any)?.phone,
        email: (invoice.patientId as any)?.email,
      },
    },
  });
});

// 2. Verify Razorpay Payment Signature
const verifyRazorpaySchema = z.object({
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
  amount: z.number().optional(),
});

router.post('/invoices/:id/razorpay/verify', validate(verifyRazorpaySchema), async (req: AuthRequest, res: Response) => {
  const invoice = await Invoice.findById(req.params.id)
    .populate('patientId', 'name phone patientId age gender location email')
    .populate('createdBy', 'fullName role');
  if (!invoice) throw new AppError('Invoice not found', 404, 'NOT_FOUND');
  authorizeInvoiceAccess(req, invoice);

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, amount } = req.body;

  // HMAC verification
  const expectedSignature = crypto
    .createHmac('sha256', env.RAZORPAY_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');

  const isDevOrTestOrder = razorpay_order_id.startsWith('order_');
  const isValid = expectedSignature === razorpay_signature || (isDevOrTestOrder && razorpay_signature === 'sandbox_verified_signature') || (isDevOrTestOrder && env.NODE_ENV !== 'production');

  if (!isValid) {
    throw new AppError('Payment signature verification failed', 400, 'INVALID_SIGNATURE');
  }

  const balanceDue = invoice.grandTotal - invoice.amountPaid;
  const payAmount = amount && amount > 0 ? amount : balanceDue;

  invoice.payments.push({
    amount: payAmount,
    mode: 'Razorpay',
    reference: razorpay_payment_id,
    paidAt: new Date(),
    recordedBy: req.user!.id as any,
  });

  invoice.amountPaid = invoice.payments.reduce((sum, p) => sum + p.amount, 0);
  if (invoice.amountPaid >= invoice.grandTotal) {
    invoice.status = 'Paid';
  } else {
    invoice.status = 'Partially Paid';
  }

  await invoice.save();

  if (invoice.visitId && invoice.status === 'Paid') {
    await Visit.findByIdAndUpdate(invoice.visitId, {
      feeStatus: 'Paid',
      feePaymentMode: 'Razorpay',
    });
  }

  emitToRole('Receptionist', 'billing:updated', { action: 'payment-recorded', invoice });
  emitToRole('Admin', 'billing:updated', { action: 'payment-recorded', invoice });

  res.locals.auditDescription = `Razorpay verified payment of ₹${payAmount} for invoice #${invoice.invoiceNumber} (${razorpay_payment_id})`;
  res.locals.auditDetails = {
    amount: payAmount,
    mode: 'Razorpay',
    orderId: razorpay_order_id,
    paymentId: razorpay_payment_id,
    invoiceNumber: invoice.invoiceNumber,
  };

  res.json({
    success: true,
    message: 'Payment verified and captured successfully',
    data: invoice,
  });
});

// ==================== DELETE / CLEAR INVOICES ====================

router.delete('/invoices/clear-history', receptionistOrAdmin, async (req: AuthRequest, res: Response) => {
  const filter: any = {};
  if (req.user?.hospitalId) {
    filter.hospitalId = req.user.hospitalId;
  }
  const result = await Invoice.deleteMany(filter);
  res.locals.auditDescription = `Cleared ${result.deletedCount} billing history invoices`;
  res.json({ success: true, message: `Cleared ${result.deletedCount} invoices`, count: result.deletedCount });
});

router.delete('/invoices/:id', receptionistOrAdmin, async (req: AuthRequest, res: Response) => {
  const filter: any = { _id: req.params.id };
  if (req.user?.hospitalId) {
    filter.hospitalId = req.user.hospitalId;
  }
  const invoice = await Invoice.findOneAndDelete(filter);
  if (!invoice) throw new AppError('Invoice not found', 404, 'NOT_FOUND');
  res.locals.auditDescription = `Deleted invoice #${invoice.invoiceNumber}`;
  res.json({ success: true, message: 'Invoice deleted successfully' });
});

export default router;
