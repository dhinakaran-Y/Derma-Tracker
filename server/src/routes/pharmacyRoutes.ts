import { Router, Response } from 'express';
import { Types } from 'mongoose';
import { Medicine } from '../models/Medicine';
import { Visit } from '../models/Visit';
import { AuditLog } from '../models/AuditLog';
import { AuthRequest, authMiddleware } from '../middleware/authMiddleware';
import { medicationGiverOrAdmin, pharmacyViewers, staffOnly } from '../middleware/roleMiddleware';
import { auditMiddleware } from '../middleware/auditMiddleware';
import { AppError } from '../middleware/errorMiddleware';
import { emitToRole } from '../config/socket';

const router = Router();
router.use(authMiddleware, auditMiddleware('pharmacy'));

// ==================== CATALOGUE (Role-shaped) ====================

router.get('/catalogue', staffOnly, async (req: AuthRequest, res: Response) => {
  const role = req.user!.role;
  const search = req.query.search as string;

  const conditions: any[] = [{ isActive: true }];

  if (req.user?.hospitalId) {
    conditions.push({
      $or: [
        { hospitalId: req.user.hospitalId },
        { hospitalId: null },
        { hospitalId: { $exists: false } },
      ],
    });
  }

  if (search && search.trim()) {
    conditions.push({
      $or: [
        { name: { $regex: search.trim(), $options: 'i' } },
        { genericName: { $regex: search.trim(), $options: 'i' } },
      ],
    });
  }

  const filter = conditions.length === 1 ? conditions[0] : { $and: conditions };

  // Role-shaped projection: hide cost from non-stock roles
  const projection = ['Admin', 'StockManager'].includes(role)
    ? {}
    : { costPrice: 0, 'batches.purchasePrice': 0 };

  const medicines = await Medicine.find(filter, projection).sort({ name: 1 });
  res.json({ success: true, data: medicines });
});

// ==================== DISPENSE ====================

router.post('/dispense', medicationGiverOrAdmin, async (req: AuthRequest, res: Response) => {
  const { visitId, prescriptionId } = req.body;

  const visit = await Visit.findById(visitId);
  if (!visit) throw new AppError('Visit not found', 404, 'NOT_FOUND');

  const prescription = visit.prescriptions.find((p: any) => p._id?.toString() === prescriptionId);
  if (!prescription) throw new AppError('Prescription not found', 404, 'NOT_FOUND');
  if (prescription.isDispensed) throw new AppError('Already dispensed', 400, 'ALREADY_DISPENSED');

  // FIFO: deduct from oldest batch first
  const medicine = await Medicine.findById(prescription.medicineId);
  if (!medicine) throw new AppError('Medicine not found', 404, 'NOT_FOUND');

  let remaining = prescription.quantity;
  const now = Date.now();
  // Sort batches by expiry date (FIFO) 
  const sortedBatches = medicine.batches
    .filter((b) => b.quantity > 0 && new Date(b.expiryDate).getTime() > now)
    .sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());

  for (const batch of sortedBatches) {
    if (remaining <= 0) break;
    const deduct = Math.min(batch.quantity, remaining);
    batch.quantity -= deduct;
    remaining -= deduct;
  }

  if (remaining > 0) {
    throw new AppError(`Insufficient stock. Short by ${remaining} units.`, 400, 'INSUFFICIENT_STOCK');
  }

  medicine.markModified('batches');
  await medicine.save();

  // Mark prescription as dispensed
  prescription.isDispensed = true;
  prescription.dispensedBy = req.user!.id as any;
  prescription.dispensedAt = new Date();
  await visit.save();

  // Configure audit log details (handled automatically by auditMiddleware without duplicates)
  const dispenseDesc = `Dispensed medication: ${prescription.medicineName} (${prescription.quantity} units)`;
  res.locals.auditDescription = dispenseDesc;
  res.locals.resourceId = visitId;
  res.locals.auditDetails = {
    prescriptionId,
    medicineId: prescription.medicineId,
    medicineName: prescription.medicineName,
    quantity: prescription.quantity,
    patientId: visit.patientId,
  };

  res.json({ success: true, data: { visit, medicine } });
});

// ==================== PENDING PRESCRIPTIONS ====================

router.get('/pending', medicationGiverOrAdmin, async (req: AuthRequest, res: Response) => {
  const { date } = req.query; // 'today' | 'all' (defaults to 'all' to show all pending prescriptions)

  const query: any = {
    status: { $ne: 'Cancelled' },
    $or: [
      { 'prescriptions.isDispensed': { $ne: true } },
      {
        consultationWorkflow: 'prescription_booklet',
        bookletDispensed: { $ne: true },
      },
    ],
  };

  if (date === 'today') {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    query.visitDate = { $gte: today };
  }

  if (req.user?.hospitalId) {
    const hospId = req.user.hospitalId;
    query.$and = [
      {
        $or: [
          { hospitalId: hospId },
          { hospitalId: { $exists: false } },
          { hospitalId: null },
        ],
      },
    ];
  }

  const visits = await Visit.find(query)
    .populate('patientId', 'name phone patientId')
    .populate('doctorId', 'fullName')
    .sort({ visitDate: -1, createdAt: -1 });

  // Filter to only visits with undispensed prescriptions or unfulfilled booklet workflow
  const pending = visits.filter((v) => {
    if (v.consultationWorkflow === 'prescription_booklet') {
      return !v.bookletDispensed;
    }
    return Array.isArray(v.prescriptions) && v.prescriptions.some((p) => !p.isDispensed);
  });

  res.json({ success: true, data: pending });
});

// ==================== BOOKLET PRESCRIPTION FULFILLMENT ====================

router.post('/booklet-fulfill', medicationGiverOrAdmin, async (req: AuthRequest, res: Response) => {
  const { visitId, items } = req.body;

  const visit = await Visit.findById(visitId);
  if (!visit) throw new AppError('Visit not found', 404, 'NOT_FOUND');

  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new AppError('Please select at least one medication to dispense', 400, 'NO_MEDICINES_SELECTED');
  }

  const now = Date.now();
  // Phase 1: Pre-validate all items and stock availability before applying deductions
  const preparedItems: Array<{
    medicine: any;
    qty: number;
    dosage?: string;
    frequency?: string;
    duration?: string;
    instructions?: string;
    sortedBatches: any[];
  }> = [];

  for (const item of items) {
    const { medicineId, quantity, dosage, frequency, duration, instructions } = item;
    const qty = parseInt(quantity);
    if (!qty || qty < 1) {
      throw new AppError('Invalid quantity for medication', 400, 'INVALID_QUANTITY');
    }

    const medicine = await Medicine.findById(medicineId);
    if (!medicine) throw new AppError(`Medicine not found: ${medicineId}`, 404, 'NOT_FOUND');

    const sortedBatches = medicine.batches
      .filter((b) => b.quantity > 0 && new Date(b.expiryDate).getTime() > now)
      .sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());

    const availableStock = sortedBatches.reduce((acc, b) => acc + b.quantity, 0);
    if (availableStock < qty) {
      throw new AppError(
        `Insufficient stock for "${medicine.name}". Requested ${qty}, but only ${availableStock} unexpired units available.`,
        400,
        'INSUFFICIENT_STOCK'
      );
    }

    preparedItems.push({
      medicine,
      qty,
      dosage,
      frequency,
      duration,
      instructions,
      sortedBatches,
    });
  }

  // Phase 2: Deduct FIFO and persist
  const dispensedItems: any[] = [];
  const medicineNames: string[] = [];

  for (const prep of preparedItems) {
    const { medicine, qty, dosage, frequency, duration, instructions, sortedBatches } = prep;
    let remaining = qty;

    for (const batch of sortedBatches) {
      if (remaining <= 0) break;
      const deduct = Math.min(batch.quantity, remaining);
      batch.quantity -= deduct;
      remaining -= deduct;
    }

    medicine.markModified('batches');
    await medicine.save();

    const rxItem = {
      medicineId: medicine._id,
      medicineName: medicine.name,
      dosage: dosage?.trim() || 'As directed in booklet',
      frequency: frequency?.trim() || 'As directed in booklet',
      duration: duration?.trim() || '30 days',
      instructions: instructions?.trim() || '',
      quantity: qty,
      isDispensed: true,
      dispensedBy: req.user!.id as any,
      dispensedAt: new Date(),
    };

    visit.prescriptions.push(rxItem as any);
    dispensedItems.push(rxItem);
    medicineNames.push(`${medicine.name} (x${qty})`);

    // Audit log for individual medicine dispense
    await AuditLog.create({
      action: 'dispense_medication',
      resource: 'pharmacy',
      resourceId: visit._id,
      userId: req.user!.id,
      userRole: req.user!.role,
      description: `Dispensed booklet Rx: ${medicine.name} (${qty} units)`,
      details: {
        visitId: visit._id,
        medicineId: medicine._id,
        medicineName: medicine.name,
        quantity: qty,
        patientId: visit.patientId,
        workflow: 'prescription_booklet',
      },
    }).catch(() => {});
  }

  visit.bookletDispensed = true;
  await visit.save();

  try {
    emitToRole('MedicationGiver', 'queue:updated', { action: 'booklet_fulfilled', visitId });
    emitToRole('Receptionist', 'queue:updated', { action: 'booklet_fulfilled', visitId });
  } catch {}

  res.locals.auditDescription = `Fulfilled prescription booklet order for patient: ${medicineNames.join(', ')}`;
  res.locals.resourceId = visitId;
  res.locals.auditDetails = {
    visitId,
    itemCount: items.length,
    medicines: medicineNames,
  };

  res.json({
    success: true,
    message: 'Prescription booklet order successfully fulfilled and stock deducted.',
    data: { visit, dispensedItems },
  });
});

// ==================== DISPENSE LOG ====================

router.get('/dispense-log', pharmacyViewers, async (req: AuthRequest, res: Response) => {
  // Purge any previous duplicate/orphan logs that were generated without medicine details
  await AuditLog.deleteMany({
    action: { $regex: 'dispense', $options: 'i' },
    resource: 'pharmacy',
    $or: [
      { 'details.medicineName': { $exists: false } },
      { 'details.medicineName': null },
      { 'details.medicineName': '' },
    ],
  }).catch(() => {});

  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const skip = (page - 1) * limit;
  const date = req.query.date as string;

  const filter: any = {
    action: { $regex: 'dispense', $options: 'i' },
    resource: 'pharmacy',
    'details.medicineName': { $exists: true, $ne: '' },
  };
  if (date) {
    const d = new Date(date);
    const nextDay = new Date(d);
    nextDay.setDate(nextDay.getDate() + 1);
    filter.createdAt = { $gte: d, $lt: nextDay };
  }

  const [logs, total] = await Promise.all([
    AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    AuditLog.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: logs,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

// ==================== SALES ANALYTICS ====================

function getDateRange(period: string, refDate: Date) {
  const start = new Date(refDate);
  const end = new Date(refDate);

  switch (period) {
    case 'day':
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      break;
    case 'week': {
      const dayOfWeek = start.getDay();
      const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Monday start
      start.setDate(start.getDate() - diff);
      start.setHours(0, 0, 0, 0);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      break;
    }
    case 'month':
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(end.getMonth() + 1, 0);
      end.setHours(23, 59, 59, 999);
      break;
    case 'year':
      start.setMonth(0, 1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(11, 31);
      end.setHours(23, 59, 59, 999);
      break;
    case 'all':
      start.setTime(0); // Epoch start
      end.setFullYear(2099);
      break;
    default:
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      break;
  }

  return { startDate: start, endDate: end };
}

router.get('/sales-analytics', pharmacyViewers, async (req: AuthRequest, res: Response) => {
  const period = (req.query.period as string) || 'day';
  const refDate = req.query.date ? new Date(req.query.date as string) : new Date();

  const { startDate, endDate } = getDateRange(period, refDate);

  // Hospital filter conditions with proper ObjectId casting
  const hospOrConditions: any[] = [
    { hospitalId: null },
    { hospitalId: { $exists: false } },
  ];
  if (req.user?.hospitalId) {
    const hospIdStr = req.user.hospitalId.toString();
    if (Types.ObjectId.isValid(hospIdStr)) {
      hospOrConditions.unshift({ hospitalId: new Types.ObjectId(hospIdStr) });
    }
    hospOrConditions.unshift({ hospitalId: hospIdStr });
  }

  // Map to hold unique fulfilled prescriptions: key -> record
  const itemMap = new Map<string, {
    medicineName: string;
    medicineId?: string;
    quantity: number;
    patientId?: string;
    dispensedAt: Date;
  }>();

  // ── Source A: Clinical Visits (Ground Truth for fulfilled prescriptions) ──
  const visitFilter: any = {
    'prescriptions.isDispensed': true,
  };
  if (req.user?.hospitalId) {
    visitFilter.$or = hospOrConditions;
  }

  const visits = await Visit.find(visitFilter).lean();

  let allTimeCount = 0;
  for (const v of visits) {
    const patientId = v.patientId ? v.patientId.toString() : undefined;
    for (const p of v.prescriptions || []) {
      if (!p.isDispensed) continue;
      allTimeCount++;

      const dispTime = p.dispensedAt
        ? new Date(p.dispensedAt)
        : new Date((v as any).updatedAt || v.visitDate);

      // Check date bounds unless period is 'all'
      if (period !== 'all') {
        if (dispTime < startDate || dispTime > endDate) continue;
      }

      const pId = (p as any)._id;
      const key = pId ? pId.toString() : `${v._id}_${p.medicineName}`;
      itemMap.set(key, {
        medicineName: p.medicineName.trim(),
        medicineId: p.medicineId ? p.medicineId.toString() : undefined,
        quantity: p.quantity || 1,
        patientId,
        dispensedAt: dispTime,
      });
    }
  }

  // ── Source B: AuditLog Records (Captures any dispense log events) ──
  const auditFilter: any = {
    resource: 'pharmacy',
    action: { $regex: 'dispense', $options: 'i' },
    $or: [
      { 'details.medicineName': { $exists: true, $ne: '' } },
      { description: { $regex: 'dispense', $options: 'i' } },
    ],
  };
  if (period !== 'all') {
    auditFilter.createdAt = { $gte: startDate, $lte: endDate };
  }
  if (req.user?.hospitalId) {
    auditFilter.$and = [{ $or: hospOrConditions }];
  }

  const logs = await AuditLog.find(auditFilter).lean();
  for (const l of logs) {
    const medName =
      l.details?.medicineName ||
      l.description?.replace(/^Dispensed medication:\s*/i, '').replace(/\s*\(\d+.*$/, '');

    if (!medName || medName === '-' || medName.trim() === '') continue;

    const key = l.details?.prescriptionId
      ? l.details.prescriptionId.toString()
      : l._id.toString();

    // Only add if not already captured from Visit
    if (!itemMap.has(key)) {
      itemMap.set(key, {
        medicineName: medName.trim(),
        medicineId: l.details?.medicineId ? l.details.medicineId.toString() : undefined,
        quantity: l.details?.quantity || 1,
        patientId: l.details?.patientId ? l.details.patientId.toString() : undefined,
        dispensedAt: new Date(l.createdAt),
      });
    }
  }

  // ── Group by Medicine Name ──
  const groupedMap = new Map<string, {
    medicineName: string;
    medicineId?: string;
    totalQuantity: number;
    dispensationCount: number;
    patients: Set<string>;
  }>();

  for (const item of itemMap.values()) {
    const normName = item.medicineName;
    const existing = groupedMap.get(normName) || {
      medicineName: normName,
      medicineId: item.medicineId,
      totalQuantity: 0,
      dispensationCount: 0,
      patients: new Set<string>(),
    };

    existing.totalQuantity += item.quantity;
    existing.dispensationCount += 1;
    if (item.patientId) existing.patients.add(item.patientId);
    if (!existing.medicineId && item.medicineId) existing.medicineId = item.medicineId;

    groupedMap.set(normName, existing);
  }

  // ── Enrich with Medicine Catalogue Metadata ──
  const names = Array.from(groupedMap.keys());
  const medicines = await Medicine.find(
    { name: { $in: names } },
    { name: 1, sellingPrice: 1, category: 1, unit: 1, imageUrl: 1 }
  ).lean();

  const medMetaMap = new Map(medicines.map((m) => [m.name.toLowerCase(), m]));
  const globalPatientSet = new Set<string>();

  const enrichedList = Array.from(groupedMap.values()).map((g) => {
    g.patients.forEach((pid) => globalPatientSet.add(pid));

    const meta = medMetaMap.get(g.medicineName.toLowerCase());
    const price = meta?.sellingPrice || 0;
    const uniquePatients = Math.max(g.patients.size, 1);

    return {
      medicineName: g.medicineName,
      medicineId: g.medicineId || meta?._id || null,
      category: meta?.category || 'Medicine',
      unit: meta?.unit || 'units',
      imageUrl: meta?.imageUrl || null,
      totalQuantity: g.totalQuantity,
      uniquePatients,
      dispensationCount: g.dispensationCount,
      estimatedRevenue: g.totalQuantity * price,
      avgQuantityPerPatient: Math.round((g.totalQuantity / uniquePatients) * 10) / 10,
    };
  }).sort((a, b) => b.totalQuantity - a.totalQuantity);

  const totalUnitsSold = enrichedList.reduce((sum, m) => sum + m.totalQuantity, 0);
  const totalDispensations = enrichedList.reduce((sum, m) => sum + m.dispensationCount, 0);
  const totalRevenue = enrichedList.reduce((sum, m) => sum + m.estimatedRevenue, 0);
  const totalPatients = globalPatientSet.size > 0
    ? globalPatientSet.size
    : (totalDispensations > 0 ? 1 : 0);

  res.json({
    success: true,
    data: {
      period,
      startDate,
      endDate,
      summary: {
        totalUnitsSold,
        totalPatients,
        totalDispensations,
        totalRevenue,
      },
      allTimeCount,
      medicines: enrichedList,
    },
  });
});

export default router;
