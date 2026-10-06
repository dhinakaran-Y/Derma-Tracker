import { Router, Response } from 'express';
import { z } from 'zod';
import { Appointment } from '../models/Appointment';
import { User } from '../models/User';
import { getClinicSettings } from '../models/ClinicSettings';
import { AuthRequest, authMiddleware } from '../middleware/authMiddleware';
import { validate } from '../middleware/validateMiddleware';
import { auditMiddleware } from '../middleware/auditMiddleware';
import { AppError } from '../middleware/errorMiddleware';
import { emitToUser, emitToRole } from '../config/socket';

const router = Router();
router.use(authMiddleware, auditMiddleware('appointments'));

// Helper to check 24-hour lockdown rule
async function enforce24HourLock(scheduledAt: Date, userRole: string, userType?: string) {
  // Staff with role Receptionist or Admin have full authority to modify within 24 hours
  if (userType === 'staff' && (userRole === 'Receptionist' || userRole === 'Admin')) {
    return;
  }

  // For Doctor and Patient: locked if scheduledAt is less than or equal to 24 hours from now
  const diffMs = new Date(scheduledAt).getTime() - Date.now();
  if (diffMs <= 24 * 60 * 60 * 1000) {
    const settings = await getClinicSettings();
    const phone = settings?.phone || '+91 98765 43210';
    throw new AppError(
      `This appointment is locked because it is within the 24-hour window. Online cancellations and modifications are locked to prevent scheduling conflicts and technical glitches. If you need immediate cancellation or rescheduling, please contact the hospital directly at ${phone}.`,
      403,
      'APPOINTMENT_LOCKED_24H'
    );
  }
}

// ==================== CREATE APPOINTMENT ====================

const createAppointmentSchema = z.object({
  patientId: z.string().min(1),
  doctorId: z.string().min(1),
  scheduledAt: z.string().min(1),
  mode: z.enum(['Offline', 'Online']).default('Offline'),
  type: z.enum(['Consult', 'Surgery']).default('Consult'),
  notes: z.string().optional(),
});

router.post('/', validate(createAppointmentSchema), async (req: AuthRequest, res: Response) => {
  const { patientId, doctorId, scheduledAt, mode, type, notes } = req.body;

  // Verify doctor exists and is active
  const doctor = await User.findOne({ _id: doctorId, role: 'Doctor', status: 'Active' });
  if (!doctor) throw new AppError('Doctor not found', 404, 'NOT_FOUND');

  try {
    const appointment = await Appointment.create({
      hospitalId: req.user?.hospitalId,
      patientId,
      doctorId,
      scheduledAt: new Date(scheduledAt),
      mode,
      type,
      notes,
      bookedBy: req.user!.id,
      bookedByRole: req.user!.type === 'patient' ? 'Patient' : 'Staff',
    });

    res.status(201).json({ success: true, data: appointment });
  } catch (err: any) {
    if (err.code === 11000) {
      throw new AppError('Time slot already booked for this doctor', 409, 'SLOT_CONFLICT');
    }
    throw err;
  }
});

// ==================== LIST APPOINTMENTS ====================

router.get('/', async (req: AuthRequest, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const skip = (page - 1) * limit;
  const { doctorId, status, date } = req.query;

  const filter: any = {};
  if (req.user?.hospitalId) {
    filter.hospitalId = req.user.hospitalId;
  }
  if (doctorId) filter.doctorId = doctorId;
  if (status) filter.status = status;
  if (date) {
    const d = new Date(date as string);
    const nextDay = new Date(d);
    nextDay.setDate(nextDay.getDate() + 1);
    filter.scheduledAt = { $gte: d, $lt: nextDay };
  }

  // If patient, only show their own
  if (req.user!.type === 'patient') {
    filter.patientId = req.user!.id;
  }

  const [appointments, total] = await Promise.all([
    Appointment.find(filter)
      .populate('patientId', 'name phone patientId')
      .populate('doctorId', 'fullName specialization')
      .sort({ scheduledAt: -1 })
      .skip(skip)
      .limit(limit),
    Appointment.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: appointments,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

// ==================== UPDATE STATUS ====================

router.patch('/:id/status', async (req: AuthRequest, res: Response) => {
  const { status, cancellationReason, postponedReason, postponedWithoutDate } = req.body;
  const validStatuses = ['Scheduled', 'Waiting', 'InProgress', 'Completed', 'Cancelled', 'NoShow', 'Postponed'];
  if (!validStatuses.includes(status)) throw new AppError('Invalid status', 400, 'INVALID_STATUS');

  const existingAppt = await Appointment.findById(req.params.id);
  if (!existingAppt) throw new AppError('Appointment not found', 404, 'NOT_FOUND');

  // Permission check
  if (req.user?.type === 'patient') {
    if (existingAppt.patientId.toString() !== req.user.id) {
      throw new AppError('Forbidden: Not your appointment', 403, 'FORBIDDEN');
    }
    if (status !== 'Cancelled') {
      throw new AppError('Patients can only cancel upcoming appointments', 403, 'FORBIDDEN');
    }
  } else if (req.user?.role === 'Doctor') {
    if (existingAppt.doctorId.toString() !== req.user.id) {
      throw new AppError('Forbidden: Not your appointment', 403, 'FORBIDDEN');
    }
  }

  // 24-hour lockdown check for Cancelled and Postponed
  if (['Cancelled', 'Postponed'].includes(status)) {
    await enforce24HourLock(existingAppt.scheduledAt, req.user!.role, req.user?.type);
  }

  const updateData: any = { status };
  const userRole = req.user?.type === 'patient' ? 'Patient' : req.user?.role === 'Doctor' ? 'Doctor' : 'Staff';
  updateData.lastModifiedByRole = userRole;
  updateData.lastModifiedBy = req.user?.id;

  if (cancellationReason !== undefined) updateData.cancellationReason = cancellationReason;
  if (postponedReason !== undefined) updateData.postponedReason = postponedReason;
  if (postponedWithoutDate !== undefined) updateData.postponedWithoutDate = !!postponedWithoutDate;

  const appointment = await Appointment.findByIdAndUpdate(
    req.params.id,
    updateData,
    { new: true }
  )
    .populate('patientId', 'name phone patientId')
    .populate('doctorId', 'fullName specialization');

  if (!appointment) throw new AppError('Appointment not found', 404, 'NOT_FOUND');

  // Emit real-time notification to patient, doctor, and receptionists
  try {
    const pId = (appointment.patientId as any)?._id?.toString() || appointment.patientId?.toString();
    const dId = (appointment.doctorId as any)?._id?.toString() || appointment.doctorId?.toString();
    if (pId) emitToUser(pId, 'appointment:updated', appointment);
    if (dId) emitToUser(dId, 'appointment:updated', appointment);
    emitToRole('Receptionist', 'appointment:updated', appointment);
  } catch (socketErr) {
    console.error('Failed to emit appointment socket update:', socketErr);
  }

  res.json({ success: true, data: appointment });
});

// ==================== UPDATE APPOINTMENT ====================

const updateAppointmentSchema = z.object({
  doctorId: z.string().min(1).optional(),
  scheduledAt: z.string().min(1).optional(),
  mode: z.enum(['Offline', 'Online']).optional(),
  type: z.enum(['Consult', 'Surgery']).optional(),
  notes: z.string().optional(),
  rescheduleReason: z.string().optional(),
  postponedReason: z.string().optional(),
  postponedWithoutDate: z.boolean().optional(),
  status: z.enum(['Scheduled', 'Postponed', 'Cancelled']).optional(),
});

router.patch('/:id', validate(updateAppointmentSchema), async (req: AuthRequest, res: Response) => {
  const { doctorId, scheduledAt, mode, type, notes, rescheduleReason, postponedReason, postponedWithoutDate, status } = req.body;

  const existingAppt = await Appointment.findById(req.params.id);
  if (!existingAppt) throw new AppError('Appointment not found', 404, 'NOT_FOUND');

  // Permission check
  if (req.user?.type === 'patient') {
    if (existingAppt.patientId.toString() !== req.user.id) {
      throw new AppError('Forbidden: Not your appointment', 403, 'FORBIDDEN');
    }
  } else if (req.user?.role === 'Doctor') {
    if (existingAppt.doctorId.toString() !== req.user.id) {
      throw new AppError('Forbidden: Not your appointment', 403, 'FORBIDDEN');
    }
  }

  // 24-hour lockdown check for Doctor and Patient
  // If the appointment was already Postponed (e.g. postponed without date),
  // they are setting a new date and are not locked by the old date.
  if (existingAppt.status !== 'Postponed') {
    await enforce24HourLock(existingAppt.scheduledAt, req.user!.role, req.user?.type);
  }

  // Verify doctor exists if doctorId is provided
  if (doctorId) {
    const doctor = await User.findOne({ _id: doctorId, role: 'Doctor', status: 'Active' });
    if (!doctor) throw new AppError('Doctor not found', 404, 'NOT_FOUND');
  }

  const updateData: any = {};
  if (doctorId) updateData.doctorId = doctorId;
  if (scheduledAt) {
    const newDate = new Date(scheduledAt);
    if (isNaN(newDate.getTime())) throw new AppError('Invalid scheduled date/time', 400, 'BAD_REQUEST');
    updateData.scheduledAt = newDate;
    // Rescheduling to a specific slot restores Scheduled status
    updateData.status = 'Scheduled';
    updateData.postponedWithoutDate = false;
  } else if (status) {
    updateData.status = status;
  }
  if (mode) updateData.mode = mode;
  if (type) updateData.type = type;
  if (notes !== undefined) updateData.notes = notes;
  if (rescheduleReason !== undefined) updateData.rescheduleReason = rescheduleReason;
  if (postponedReason !== undefined) updateData.postponedReason = postponedReason;
  if (postponedWithoutDate !== undefined) updateData.postponedWithoutDate = !!postponedWithoutDate;

  const userRole = req.user?.type === 'patient' ? 'Patient' : req.user?.role === 'Doctor' ? 'Doctor' : 'Staff';
  updateData.lastModifiedByRole = userRole;
  updateData.lastModifiedBy = req.user?.id;

  try {
    const appointment = await Appointment.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    )
      .populate('patientId', 'name phone patientId')
      .populate('doctorId', 'fullName specialization');

    if (!appointment) throw new AppError('Appointment not found', 404, 'NOT_FOUND');

    // Emit real-time notification to patient, doctor, and receptionists
    try {
      const pId = (appointment.patientId as any)?._id?.toString() || appointment.patientId?.toString();
      const dId = (appointment.doctorId as any)?._id?.toString() || appointment.doctorId?.toString();
      if (pId) emitToUser(pId, 'appointment:updated', appointment);
      if (dId) emitToUser(dId, 'appointment:updated', appointment);
      emitToRole('Receptionist', 'appointment:updated', appointment);
    } catch (socketErr) {
      console.error('Failed to emit appointment socket update:', socketErr);
    }

    res.json({ success: true, data: appointment });
  } catch (err: any) {
    if (err.code === 11000) {
      throw new AppError('Time slot already booked for this doctor', 409, 'SLOT_CONFLICT');
    }
    throw err;
  }
});

// ==================== AVAILABLE SLOTS ====================

router.get('/slots/:doctorId/:date', async (req: AuthRequest, res: Response) => {
  const doctorId = req.params.doctorId as string;
  const dateStr = req.params.date as string;
  const excludeApptId = req.query.excludeApptId as string | undefined;
  const dateOnly = dateStr.split('T')[0];
  const dayStart = new Date(`${dateOnly}T00:00:00.000Z`);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

  const filter: any = {
    doctorId,
    scheduledAt: { $gte: dayStart, $lt: dayEnd },
    status: { $nin: ['Cancelled', 'NoShow', 'Postponed'] },
  };

  if (excludeApptId) {
    filter._id = { $ne: excludeApptId };
  }

  const booked = await Appointment.find(filter).select('scheduledAt');

  const bookedTimes = booked.map((a) => a.scheduledAt.toISOString());

  res.json({ success: true, data: { date: dateStr, doctorId, bookedSlots: bookedTimes } });
});

export default router;
