import { Router, Response } from 'express';
import { z } from 'zod';
import { Patient } from '../models/Patient';
import { Visit } from '../models/Visit';
import { User } from '../models/User';
import { Appointment } from '../models/Appointment';
import { Invoice } from '../models/Invoice';
import { getNextSequence } from '../models/Counter';
import { getClinicSettings } from '../models/ClinicSettings';
import { AuthRequest, authMiddleware } from '../middleware/authMiddleware';
import { receptionistOrAdmin } from '../middleware/roleMiddleware';
import { validate } from '../middleware/validateMiddleware';
import { auditMiddleware } from '../middleware/auditMiddleware';
import { AppError } from '../middleware/errorMiddleware';
import { emitToRole } from '../config/socket';

const router = Router();
router.use(authMiddleware, receptionistOrAdmin, auditMiddleware('receptionist'));

// ==================== PATIENTS ====================

const createPatientSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(10).max(15),
  email: z.string().email().optional().or(z.literal('')),
  location: z.string().optional(),
  dateOfBirth: z.string().optional(),
  gender: z.enum(['Male', 'Female', 'Other']).optional(),
  bloodGroup: z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown']).optional(),
  maritalStatus: z.enum(['Single', 'Married', 'Divorced', 'Widowed']).optional().or(z.literal('')),
  heightCm: z.union([z.number(), z.string().regex(/^\d+(\.\d+)?$/).transform(Number)]).optional(),
  allergies: z.string().optional(), // comma-separated string from UI, converted to array on server
  medicalHistoryNotes: z.string().max(1000).optional(),
});


router.post('/patients', validate(createPatientSchema), async (req: AuthRequest, res: Response) => {
  const cleanPhone = req.body.phone.trim();
  const existing = await Patient.findOne({ phone: cleanPhone });
  if (existing) {
    throw new AppError('This phone number is already registered with another patient', 409, 'DUPLICATE_PHONE');
  }

  const seq = await getNextSequence('patient');
  const patientId = `PAT-${seq.toString().padStart(6, '0')}`;

  const patientData: any = {
    ...req.body,
    phone: cleanPhone,
    patientId,
    hospitalId: req.user?.hospitalId,
    dateOfBirth: req.body.dateOfBirth ? new Date(req.body.dateOfBirth) : undefined,
    // Convert comma-separated allergies string to a clean array
    allergies: req.body.allergies
      ? req.body.allergies
          .split(',')
          .map((a: string) => a.trim())
          .filter(Boolean)
      : [],
  };
  if (!patientData.email) delete patientData.email;
  if (!patientData.location) delete patientData.location;
  if (!patientData.bloodGroup) delete patientData.bloodGroup;
  if (!patientData.maritalStatus) delete patientData.maritalStatus;
  if (!patientData.heightCm) delete patientData.heightCm;
  if (!patientData.medicalHistoryNotes) delete patientData.medicalHistoryNotes;

  const patient = await Patient.create(patientData);

  res.locals.auditDescription = `Registered new patient: ${patient.name} (${patient.patientId})`;
  res.locals.auditDetails = { name: patient.name, phone: patient.phone, patientId: patient.patientId };

  res.status(201).json({ success: true, data: patient });
});

router.get('/patients', async (req: AuthRequest, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const skip = (page - 1) * limit;
  const search = req.query.search as string;

  const filter: any = { isActive: true };
  if (req.user?.hospitalId) {
    filter.hospitalId = req.user.hospitalId;
  }
  if (search) {
    filter.$and = [
      ...(filter.hospitalId ? [{ hospitalId: filter.hospitalId }] : []),
      {
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { phone: { $regex: search, $options: 'i' } },
          { patientId: { $regex: search, $options: 'i' } },
        ],
      },
    ];
    delete filter.hospitalId;
  }

  const [patients, total] = await Promise.all([
    Patient.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Patient.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: patients,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

router.get('/patients/:id', async (req: AuthRequest, res: Response) => {
  const filter: any = { _id: req.params.id };
  if (req.user?.hospitalId) {
    filter.hospitalId = req.user.hospitalId;
  }
  const patient = await Patient.findOne(filter);
  if (!patient) throw new AppError('Patient not found', 404, 'NOT_FOUND');

  // Find the most recent visit with heightCm recorded
  const lastVisitWithHeight = await Visit.findOne({
    patientId: patient._id,
    heightCm: { $exists: true, $ne: null },
  }).sort({ visitDate: -1, createdAt: -1 });

  const lastHeightCm = lastVisitWithHeight?.heightCm ?? patient.heightCm ?? null;

  res.json({
    success: true,
    data: {
      ...patient.toObject(),
      lastHeightCm,
    },
  });
});

router.patch('/patients/:id', async (req: AuthRequest, res: Response) => {
  const filter: any = { _id: req.params.id };
  if (req.user?.hospitalId) {
    filter.hospitalId = req.user.hospitalId;
  }
  const patient = await Patient.findOneAndUpdate(filter, req.body, { new: true, runValidators: true });
  if (!patient) throw new AppError('Patient not found', 404, 'NOT_FOUND');
  res.locals.auditDescription = `Updated patient profile: ${patient.name} (${patient.patientId})`;
  res.json({ success: true, data: patient });
});

// ==================== CHECK-IN ====================

router.post('/check-in', async (req: AuthRequest, res: Response) => {
  const { patientId, doctorId } = req.body;

  const patientFilter: any = { _id: patientId };
  if (req.user?.hospitalId) patientFilter.hospitalId = req.user.hospitalId;
  const patient = await Patient.findOne(patientFilter);
  if (!patient) throw new AppError('Patient not found', 404, 'NOT_FOUND');

  const doctorFilter: any = { _id: doctorId, role: 'Doctor', status: 'Active' };
  if (req.user?.hospitalId) doctorFilter.hospitalId = req.user.hospitalId;
  const doctor = await User.findOne(doctorFilter);
  if (!doctor) throw new AppError('Doctor not found', 404, 'NOT_FOUND');

  // Prevent duplicate check-in if patient is already in today's active queue
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Automatically clean up any lingering cancelled visits or stale uncompleted visits from past days
  await Visit.deleteMany({
    $or: [
      { status: 'Cancelled' },
      { visitDate: { $lt: today }, status: { $in: ['Waiting', 'InProgress'] } },
    ],
  });

  const existingActiveVisit = await Visit.findOne({
    patientId,
    visitDate: { $gte: today },
    status: { $in: ['Waiting', 'InProgress'] },
    ...(req.user?.hospitalId ? { hospitalId: req.user.hospitalId } : {}),
  }).populate('doctorId', 'fullName');

  if (existingActiveVisit) {
    const docName = (existingActiveVisit.doctorId as any)?.fullName || 'the doctor';
    throw new AppError(
      `Patient is already in the active queue (Queue #${existingActiveVisit.queueNumber}) for Dr. ${docName}.`,
      400,
      'PATIENT_ALREADY_IN_QUEUE'
    );
  }

  // Determine visit type: first visit if no previous visits with this doctor
  const previousVisits = await Visit.countDocuments({ patientId, doctorId });
  const visitType = previousVisits === 0 ? 'FirstVisit' : 'FollowUp';

  // Get hospital registration & history book log fee
  const settings = await getClinicSettings();
  let hospitalRegistrationFee = settings.registrationFee ?? 0;
  if (req.user?.hospitalId) {
    const { Hospital } = await import('../models/Hospital');
    const hospital = await Hospital.findById(req.user.hospitalId);
    if (hospital?.registrationFee !== undefined) {
      hospitalRegistrationFee = hospital.registrationFee;
    }
  }

  // Doctor consultation fee is uniform for all visits
  const consultFee = doctor.consultFee || 500;
  const registrationFee = visitType === 'FirstVisit' ? hospitalRegistrationFee : 0;
  const totalFee = consultFee + registrationFee;

  // Get today's queue count
  const queueCount = await Visit.countDocuments({
    doctorId,
    visitDate: { $gte: today },
    status: { $in: ['Waiting', 'InProgress'] },
  });

  const feeStatus = req.body.feeStatus === 'Paid' ? 'Paid' : 'Pending';
  const paymentMode = ['Cash', 'UPI', 'Card'].includes(req.body.paymentMode) ? req.body.paymentMode : 'Cash';

  const weightKg =
    req.body.weightKg !== undefined && req.body.weightKg !== null && req.body.weightKg !== ''
      ? Number(req.body.weightKg)
      : undefined;
  const heightCm =
    req.body.heightCm !== undefined && req.body.heightCm !== null && req.body.heightCm !== ''
      ? Number(req.body.heightCm)
      : undefined;

  const visit = await Visit.create({
    hospitalId: req.user?.hospitalId,
    patientId,
    doctorId,
    visitType,
    consultFee,
    registrationFee,
    queueNumber: queueCount + 1,
    status: 'Waiting',
    feeStatus,
    weightKg,
    heightCm,
  });

  // If height was supplied/updated, sync it to patient baseline
  if (heightCm) {
    await Patient.findByIdAndUpdate(patientId, { heightCm });
  }

  let createdInvoice = null;
  if (feeStatus === 'Paid') {
    const year = new Date().getFullYear();
    const fy = `${year}-${(year + 1).toString().slice(-2)}`;
    const seq = await getNextSequence('invoice', fy);
    const invoiceNumber = `INV-${year}-${seq.toString().padStart(4, '0')}`;

    const lineItems: any[] = [
      {
        itemType: 'Consultation' as const,
        description: `Doctor Consultation — ${doctor.fullName}`,
        quantity: 1,
        unitPrice: consultFee,
        gstRate: 0,
        gstAmount: 0,
        total: consultFee,
      },
    ];

    if (visitType === 'FirstVisit' && registrationFee > 0) {
      lineItems.push({
        itemType: 'Procedure' as const,
        description: 'Hospital Registration & Patient History Book Log Fee',
        quantity: 1,
        unitPrice: registrationFee,
        gstRate: 0,
        gstAmount: 0,
        total: registrationFee,
      });
    }

    createdInvoice = await Invoice.create({
      hospitalId: req.user?.hospitalId,
      invoiceNumber,
      patientId,
      visitId: visit._id,
      lineItems,
      subtotal: totalFee,
      totalGst: 0,
      grandTotal: totalFee,
      amountPaid: totalFee,
      status: 'Paid',
      payments: [
        {
          amount: totalFee,
          mode: paymentMode,
          paidAt: new Date(),
          recordedBy: req.user!.id as any,
        },
      ],
      createdBy: req.user!.id,
    });
    await createdInvoice.populate('patientId', 'name phone patientId age gender location email');
  }

  // Emit real-time queue update & billing update
  try {
    emitToRole('Receptionist', 'queue:updated', { action: 'check-in', visit });
    emitToRole('Doctor', 'queue:updated', { action: 'check-in', visit });
    if (createdInvoice) {
      emitToRole('Receptionist', 'billing:updated', { action: 'invoice-created', invoice: createdInvoice });
    }
  } catch {}

  res.locals.auditDescription = `Checked in patient ${patient.name} for consultation with Dr. ${doctor.fullName} (Fees: ${feeStatus})`;
  res.locals.auditDetails = {
    patientName: patient.name,
    patientId: patient.patientId,
    doctorName: doctor.fullName,
    doctorId: doctor._id,
    queueNumber: queueCount + 1,
    feeStatus,
    paymentMode: feeStatus === 'Paid' ? paymentMode : null,
  };

  res.status(201).json({
    success: true,
    data: {
      visit,
      visitType,
      consultFee,
      registrationFee,
      totalInitialFee: totalFee,
      invoice: createdInvoice,
    },
  });
});

// ==================== QUEUE ====================

router.get('/queue', async (req: AuthRequest, res: Response) => {
  const doctorId = req.query.doctorId as string;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Automatically clean up any cancelled visits or stale abandoned visits from past days
  await Visit.deleteMany({
    $or: [
      { status: 'Cancelled' },
      { visitDate: { $lt: today }, status: { $in: ['Waiting', 'InProgress'] } },
    ],
  });

  const filter: any = {
    visitDate: { $gte: today },
    status: { $in: ['Waiting', 'InProgress'] },
  };
  if (req.user?.hospitalId) {
    filter.hospitalId = req.user.hospitalId;
  }
  if (doctorId) filter.doctorId = doctorId;

  const queue = await Visit.find(filter)
    .populate('patientId', 'name phone patientId dateOfBirth gender')
    .populate('doctorId', 'fullName specialization')
    .sort({ queueNumber: 1 });

  // Compute total visit count for each patient
  const queueWithCounts = await Promise.all(
    queue.map(async (visit) => {
      const pId = (visit.patientId as any)?._id || visit.patientId;
      const totalVisits = await Visit.countDocuments({
        patientId: pId,
        createdAt: { $lte: visit.createdAt },
      });
      const vObj = visit.toObject();
      vObj.visitCount = totalVisits || 1;
      return vObj;
    })
  );

  res.json({ success: true, data: queueWithCounts });
});

router.patch('/queue/:visitId/fee-status', async (req: AuthRequest, res: Response) => {
  const filter: any = { _id: req.params.visitId };
  if (req.user?.hospitalId) filter.hospitalId = req.user.hospitalId;

  const visit = await Visit.findOne(filter)
    .populate('patientId', 'name phone patientId')
    .populate('doctorId', 'fullName specialization');
  if (!visit) throw new AppError('Visit not found', 404, 'NOT_FOUND');

  const newStatus = req.body.feeStatus || (visit.feeStatus === 'Paid' ? 'Pending' : 'Paid');
  const paymentMode = ['Cash', 'UPI', 'Card', 'BankTransfer', 'Razorpay'].includes(req.body.paymentMode) ? req.body.paymentMode : 'Cash';
  visit.feeStatus = newStatus;
  await visit.save();

  const totalFee = (visit.consultFee || 500) + (visit.visitType === 'FirstVisit' ? (visit.registrationFee || 0) : 0);
  const pName = (visit.patientId as any)?.name || 'Patient';

  // Synchronize with Billing Invoice
  let invoice = await Invoice.findOne({ visitId: visit._id });
  let invoiceAction: 'invoice-settled' | 'invoice-deleted' = 'invoice-settled';

  if (!invoice && newStatus === 'Paid') {
    const year = new Date().getFullYear();
    const fy = `${year}-${(year + 1).toString().slice(-2)}`;
    const seq = await getNextSequence('invoice', fy);
    const invoiceNumber = `INV-${year}-${seq.toString().padStart(4, '0')}`;

    const lineItems: any[] = [
      {
        itemType: 'Consultation' as const,
        description: `Doctor Consultation — ${(visit.doctorId as any)?.fullName || 'Doctor'}`,
        quantity: 1,
        unitPrice: visit.consultFee || 500,
        gstRate: 0,
        gstAmount: 0,
        total: visit.consultFee || 500,
      },
    ];

    if (visit.visitType === 'FirstVisit' && (visit.registrationFee || 0) > 0) {
      lineItems.push({
        itemType: 'Procedure' as const,
        description: 'Hospital Registration & Patient History Book Log Fee',
        quantity: 1,
        unitPrice: visit.registrationFee || 0,
        gstRate: 0,
        gstAmount: 0,
        total: visit.registrationFee || 0,
      });
    }

    if (visit.labTests && visit.labTests.length > 0) {
      visit.labTests.forEach((t: any) => {
        if ((t.fee || 0) > 0) {
          lineItems.push({
            itemType: 'Lab Test' as const,
            description: `Lab Test: ${t.testName}`,
            quantity: 1,
            unitPrice: t.fee || 0,
            gstRate: 0,
            gstAmount: 0,
            total: t.fee || 0,
          });
        }
      });
    }

    invoice = await Invoice.create({
      hospitalId: req.user?.hospitalId,
      invoiceNumber,
      patientId: (visit.patientId as any)?._id || visit.patientId,
      visitId: visit._id,
      lineItems,
      subtotal: totalFee,
      totalGst: 0,
      grandTotal: totalFee,
      amountPaid: totalFee,
      status: 'Paid',
      payments: [
        {
          amount: totalFee,
          mode: paymentMode,
          paidAt: new Date(),
          recordedBy: req.user!.id as any,
        },
      ],
      createdBy: req.user!.id,
    });
    await invoice.populate('patientId', 'name phone patientId age gender location email');
    invoiceAction = 'invoice-settled';
  } else if (invoice) {
    if (newStatus === 'Paid') {
      invoice.amountPaid = invoice.grandTotal;
      invoice.status = 'Paid';
      invoice.payments = [
        {
          amount: invoice.grandTotal,
          mode: paymentMode,
          paidAt: new Date(),
          recordedBy: req.user!.id as any,
        },
      ];
      await invoice.save();
      await invoice.populate('patientId', 'name phone patientId age gender location email');
      invoiceAction = 'invoice-settled';
    } else {
      // Reverted back to pending / amount returned => delete invoice
      await Invoice.findByIdAndDelete(invoice._id);
      invoice = null;
      invoiceAction = 'invoice-deleted';
    }
  }

  res.locals.auditDescription =
    newStatus === 'Paid'
      ? `Collected consultation fee of ₹${totalFee} via ${paymentMode} from ${pName}`
      : `Marked consultation fee as Pending for ${pName}`;
  res.locals.auditDetails = {
    patientName: pName,
    totalFee,
    feeStatus: newStatus,
    paymentMode: newStatus === 'Paid' ? paymentMode : null,
  };

  try {
    emitToRole('Receptionist', 'queue:updated', { action: 'fee-status-changed', visit });
    emitToRole('Receptionist', 'billing:updated', { action: invoiceAction, invoice });
  } catch {}

  res.json({ success: true, data: { visit, invoice } });
});

// ==================== CANCEL QUEUE VISIT ====================

router.post('/queue/:visitId/cancel', async (req: AuthRequest, res: Response) => {
  const filter: any = { _id: req.params.visitId };
  if (req.user?.hospitalId) filter.hospitalId = req.user.hospitalId;

  const visit = await Visit.findOne(filter)
    .populate('patientId', 'name phone patientId')
    .populate('doctorId', 'fullName specialization');
  if (!visit) throw new AppError('Visit not found', 404, 'NOT_FOUND');

  const pName = (visit.patientId as any)?.name || 'Patient';
  const pId = (visit.patientId as any)?._id || visit.patientId;
  const dId = (visit.doctorId as any)?._id || visit.doctorId;

  // 1. If an invoice exists for this visit, delete it and note refunded amount
  let deletedInvoice = await Invoice.findOneAndDelete({ visitId: visit._id });
  if (!deletedInvoice) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    deletedInvoice = await Invoice.findOneAndDelete({
      patientId: pId,
      createdAt: { $gte: today },
    });
  }

  let refundedAmount = 0;
  if (deletedInvoice) {
    refundedAmount = deletedInvoice.amountPaid || deletedInvoice.grandTotal || 0;
  }

  // 2. Fallback / Retrieve: If this visit was checked in from a scheduled appointment, restore it back to 'Scheduled'
  const restoredAppt = await Appointment.findOneAndUpdate(
    {
      patientId: pId,
      doctorId: dId,
      status: 'Waiting',
    },
    { status: 'Scheduled' },
    { new: true }
  );

  // 3. Delete visit completely from database so it is cleared
  await Visit.findByIdAndDelete(visit._id);

  // Clean up any other lingering cancelled visits
  await Visit.deleteMany({ status: 'Cancelled' });

  // 4. Re-sequence queue numbers for remaining visits today for this doctor
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const remainingTodayVisits = await Visit.find({
    doctorId: dId,
    visitDate: { $gte: today },
    status: { $in: ['Waiting', 'InProgress'] },
  }).sort({ queueNumber: 1 });

  if (remainingTodayVisits.length > 0) {
    const resequenceOps = remainingTodayVisits.map((v, idx) => ({
      updateOne: {
        filter: { _id: v._id },
        update: { $set: { queueNumber: idx + 1 } },
      },
    }));
    await Visit.bulkWrite(resequenceOps);
  }

  // 5. Emit real-time updates
  try {
    emitToRole('Receptionist', 'queue:updated', { action: 'visit-cancelled', visitId: visit._id });
    emitToRole('Doctor', 'queue:updated', { action: 'visit-cancelled', visitId: visit._id });
    if (deletedInvoice) {
      emitToRole('Receptionist', 'billing:updated', { action: 'invoice-deleted', invoiceId: deletedInvoice._id });
    }
  } catch {}

  res.locals.auditDescription = `Cancelled and cleared queue visit for ${pName}${refundedAmount > 0 ? ` and returned payment of ₹${refundedAmount}` : ''}`;
  res.locals.auditDetails = {
    patientName: pName,
    visitId: visit._id,
    refundedAmount,
    restoredAppointmentId: restoredAppt?._id || null,
  };

  res.json({
    success: true,
    message: `Visit cancelled and removed from queue${refundedAmount > 0 ? `, payment of ₹${refundedAmount} returned and removed from billing.` : '.'}`,
    data: {
      visitId: visit._id,
      refundedAmount,
      restoredAppointment: restoredAppt,
    },
  });
});

// ==================== BULK REORDER QUEUE ====================

router.patch('/queue/reorder', async (req: AuthRequest, res: Response) => {
  const { orderedIds } = req.body;
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    throw new AppError('orderedIds array is required', 400, 'INVALID_INPUT');
  }

  const bulkOps = orderedIds.map((id: string, index: number) => ({
    updateOne: {
      filter: {
        _id: id,
        ...(req.user?.hospitalId ? { hospitalId: req.user.hospitalId } : {}),
      },
      update: { $set: { queueNumber: index + 1 } },
    },
  }));

  await Visit.bulkWrite(bulkOps);

  try {
    emitToRole('Receptionist', 'queue:updated', { action: 'queue-reordered' });
    emitToRole('Doctor', 'queue:updated', { action: 'queue-reordered' });
  } catch {}

  res.locals.auditDescription = `Reordered active queue sequence (${orderedIds.length} visits)`;
  res.json({ success: true, message: 'Queue reordered successfully' });
});

// ==================== EDIT QUEUE VISIT (DOCTOR & QUEUE NUMBER) ====================

router.patch('/queue/:visitId', async (req: AuthRequest, res: Response) => {
  const { doctorId, queueNumber } = req.body;
  const filter: any = { _id: req.params.visitId };
  if (req.user?.hospitalId) filter.hospitalId = req.user.hospitalId;

  const visit = await Visit.findOne(filter);
  if (!visit) throw new AppError('Visit not found', 404, 'NOT_FOUND');

  // Change doctor if specified
  if (doctorId && doctorId !== String(visit.doctorId)) {
    const doctor = await User.findOne({ _id: doctorId, role: 'Doctor', status: 'Active' });
    if (!doctor) throw new AppError('Doctor not found', 404, 'NOT_FOUND');
    visit.doctorId = doctorId;
    if (visit.feeStatus !== 'Paid') {
      visit.consultFee = doctor.consultFee || 500;
    }
  }

  // Change queue number if specified
  if (typeof queueNumber === 'number' && queueNumber > 0 && queueNumber !== visit.queueNumber) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const activeVisits = await Visit.find({
      visitDate: { $gte: today },
      status: { $in: ['Waiting', 'InProgress'] },
      ...(req.user?.hospitalId ? { hospitalId: req.user.hospitalId } : {}),
      _id: { $ne: visit._id },
    }).sort({ queueNumber: 1 });

    const targetIndex = Math.min(queueNumber - 1, activeVisits.length);
    activeVisits.splice(targetIndex, 0, visit);

    for (let i = 0; i < activeVisits.length; i++) {
      const item = activeVisits[i];
      if (item) {
        item.queueNumber = i + 1;
        await item.save();
      }
    }
  } else {
    await visit.save();
  }

  const updatedVisit = await Visit.findById(visit._id)
    .populate('patientId', 'name phone patientId dateOfBirth gender')
    .populate('doctorId', 'fullName specialization');

  try {
    emitToRole('Receptionist', 'queue:updated', { action: 'visit-updated', visit: updatedVisit });
    emitToRole('Doctor', 'queue:updated', { action: 'visit-updated', visit: updatedVisit });
  } catch {}

  res.locals.auditDescription = `Updated queue visit #${visit.queueNumber} for ${(updatedVisit?.patientId as any)?.name || 'Patient'}`;
  res.json({ success: true, data: updatedVisit });
});

// ==================== FEE DETECTION ====================

router.get('/fee-detection/:patientId/:doctorId', async (req: AuthRequest, res: Response) => {
  const { patientId, doctorId } = req.params;

  const doctor = await User.findById(doctorId);
  if (!doctor) throw new AppError('Doctor not found', 404, 'NOT_FOUND');

  const previousVisits = await Visit.countDocuments({ patientId, doctorId });
  const isFirstVisit = previousVisits === 0;

  const settings = await getClinicSettings();
  let hospitalRegistrationFee = settings.registrationFee ?? 0;
  if (req.user?.hospitalId) {
    const { Hospital } = await import('../models/Hospital');
    const hospital = await Hospital.findById(req.user.hospitalId);
    if (hospital?.registrationFee !== undefined) {
      hospitalRegistrationFee = hospital.registrationFee;
    }
  }

  const consultGst = settings.gstRules.find((r) => r.itemType === 'Consultation')?.gstRate || 18;

  // Doctor consultation fee is uniform for every visit
  const doctorConsultFee = doctor.consultFee || 500;
  // Hospital registration & history book log fee charged on 1st visit
  const registrationFee = isFirstVisit ? hospitalRegistrationFee : 0;
  const subtotal = doctorConsultFee + registrationFee;
  const gstAmount = Math.round(subtotal * (consultGst / 100) * 100) / 100;
  const total = Math.round((subtotal + gstAmount) * 100) / 100;

  res.json({
    success: true,
    data: {
      isFirstVisit,
      doctorConsultFee,
      registrationFee,
      fee: subtotal,
      gstRate: consultGst,
      gstAmount,
      total,
      breakdown: [
        { label: 'Doctor Consultation Fee', amount: doctorConsultFee },
        ...(isFirstVisit && registrationFee > 0
          ? [{ label: 'Hospital Patient History Book Log & Registration Fee', amount: registrationFee }]
          : []),
      ],
    },
  });
});

// ==================== DOCTORS (for receptionist) ====================

router.get('/doctors', async (req: AuthRequest, res: Response) => {
  const filter: any = { role: 'Doctor', status: 'Active' };
  if (req.user?.hospitalId) {
    filter.hospitalId = req.user.hospitalId;
  }
  const doctors = await User.find(filter)
    .select('fullName specialization isOnDuty isAvailable consultFee');
  res.json({ success: true, data: doctors });
});

export default router;
