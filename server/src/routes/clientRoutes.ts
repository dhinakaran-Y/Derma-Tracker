import { Router, Response } from 'express';
import { Patient } from '../models/Patient';
import { Visit } from '../models/Visit';
import { Invoice } from '../models/Invoice';
import { Appointment } from '../models/Appointment';
import { User } from '../models/User';
import { AuthRequest, authMiddleware } from '../middleware/authMiddleware';
import { auditMiddleware } from '../middleware/auditMiddleware';
import { AppError } from '../middleware/errorMiddleware';

const router = Router();

// Patient-only auth check
function patientOnly(req: AuthRequest, res: Response, next: Function) {
  if (!req.user || req.user.type !== 'patient') {
    throw new AppError('Patient access only', 403, 'FORBIDDEN');
  }
  next();
}

router.use(authMiddleware, patientOnly, auditMiddleware('patient-portal'));

// ==================== DASHBOARD ====================

router.get('/dashboard', async (req: AuthRequest, res: Response) => {
  const patientId = req.user!.id;

  const [totalVisits, upcomingAppointments, unpaidInvoices] = await Promise.all([
    Visit.countDocuments({ patientId }),
    Appointment.find({
      patientId,
      scheduledAt: { $gte: new Date() },
      status: { $in: ['Scheduled', 'Waiting'] },
    })
      .populate('doctorId', 'fullName specialization')
      .sort({ scheduledAt: 1 })
      .limit(5),
    Invoice.find({ patientId, status: { $ne: 'Paid' } })
      .sort({ createdAt: -1 })
      .limit(5),
  ]);

  res.json({
    success: true,
    data: { totalVisits, upcomingAppointments, unpaidInvoices },
  });
});

// ==================== MY PROGRESS ====================

router.get('/progress', async (req: AuthRequest, res: Response) => {
  const visits = await Visit.find({ patientId: req.user!.id })
    .select('visitDate hairDensity scalpImages diagnosis visitType weightKg heightCm staging scalpChecklist dlqiScore clinicalNotes')
    .sort({ visitDate: 1 });

  res.json({ success: true, data: visits });
});

// ==================== MY RECORDS ====================

router.get('/records', async (req: AuthRequest, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
  const skip = (page - 1) * limit;

  const [visits, total] = await Promise.all([
    Visit.find({ patientId: req.user!.id })
      .populate('doctorId', 'fullName specialization')
      .sort({ visitDate: -1 })
      .skip(skip)
      .limit(limit),
    Visit.countDocuments({ patientId: req.user!.id }),
  ]);

  res.json({
    success: true,
    data: visits,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

// ==================== MY APPOINTMENTS ====================

router.get('/appointments', async (req: AuthRequest, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const skip = (page - 1) * limit;

  const [appointments, total] = await Promise.all([
    Appointment.find({ patientId: req.user!.id })
      .populate('doctorId', 'fullName specialization consultFee')
      .sort({ scheduledAt: -1 })
      .skip(skip)
      .limit(limit),
    Appointment.countDocuments({ patientId: req.user!.id }),
  ]);

  res.json({
    success: true,
    data: appointments,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

// ==================== AVAILABLE DOCTORS ====================

router.get('/doctors', async (req: AuthRequest, res: Response) => {
  const filter: any = { role: 'Doctor', status: 'Active' };
  if (req.user?.hospitalId) {
    filter.hospitalId = req.user.hospitalId;
  }
  const doctors = await User.find(filter)
    .select('fullName specialization consultFee firstVisitFee isOnDuty isAvailable')
    .sort({ fullName: 1 });
  res.json({ success: true, data: doctors });
});

// ==================== MY BILLS ====================

router.get('/bills', async (req: AuthRequest, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const skip = (page - 1) * limit;

  const [invoices, total] = await Promise.all([
    Invoice.find({ patientId: req.user!.id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Invoice.countDocuments({ patientId: req.user!.id }),
  ]);

  res.json({
    success: true,
    data: invoices,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

router.get('/bills/:id', async (req: AuthRequest, res: Response) => {
  const invoice = await Invoice.findOne({ _id: req.params.id, patientId: req.user!.id })
    .populate('createdBy', 'fullName');
  if (!invoice) throw new AppError('Invoice not found', 404, 'NOT_FOUND');
  res.json({ success: true, data: invoice });
});

// ==================== MY PROFILE ====================

router.get('/profile', async (req: AuthRequest, res: Response) => {
  const patient = await Patient.findById(req.user!.id);
  if (!patient) throw new AppError('Patient not found', 404, 'NOT_FOUND');
  res.json({ success: true, data: patient });
});

router.patch('/my-profile', async (req: AuthRequest, res: Response) => {
  const { name, location, email } = req.body;
  const update: any = {};
  if (name) update.name = name;
  if (location !== undefined) update.location = location;
  if (email !== undefined) update.email = email;

  const patient = await Patient.findByIdAndUpdate(req.user!.id, update, { new: true, runValidators: true });
  if (!patient) throw new AppError('Patient not found', 404, 'NOT_FOUND');
  res.json({ success: true, data: patient });
});

// ==================== CLINIC INFO ====================

router.get('/settings', async (req: AuthRequest, res: Response) => {
  const { ClinicSettings } = await import('../models/ClinicSettings');
  const settings = await ClinicSettings.findById('clinic_settings');
  const clinicData: any = {
    clinicName: settings?.clinicName || 'DermaTrack Clinic',
    address: settings?.address || '12 Trichology Way, Chennai, TN',
    phone: settings?.phone || '+91 98765 43210',
    email: settings?.email || 'care@dermatrack.com',
    gstNumber: settings?.gstNumber || '33AAAAA0000A1Z5',
  };
  if (req.user?.hospitalId) {
    const { Hospital } = await import('../models/Hospital');
    const hospital = await Hospital.findById(req.user.hospitalId);
    if (hospital) {
      if (hospital.name) clinicData.clinicName = hospital.name;
      if (hospital.address) clinicData.address = hospital.address;
      if (hospital.phone) clinicData.phone = hospital.phone;
      if (hospital.email) clinicData.email = hospital.email;
      if (hospital.gstNumber) clinicData.gstNumber = hospital.gstNumber;
    }
  }
  res.json({ success: true, data: clinicData });
});

export default router;
