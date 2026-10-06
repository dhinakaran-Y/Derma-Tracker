import { Router, Response } from 'express';
import { z } from 'zod';
import { Medicine } from '../models/Medicine';
import { Hospital } from '../models/Hospital';
import { AuthRequest, authMiddleware } from '../middleware/authMiddleware';
import { stockManagerOrAdmin } from '../middleware/roleMiddleware';
import { validate } from '../middleware/validateMiddleware';
import { auditMiddleware } from '../middleware/auditMiddleware';
import { AppError } from '../middleware/errorMiddleware';
import { upload, uploadMedicine, sanitizeUploadedImage, storeMedicineImage } from '../middleware/uploadMiddleware';

const router = Router();
router.use(authMiddleware, stockManagerOrAdmin, auditMiddleware('stock'));

// ==================== MEDICINE IMAGE UPLOAD ====================

router.post('/upload-image', uploadMedicine.single('image'), sanitizeUploadedImage, async (req: any, res: Response) => {
  if (!req.file) {
    throw new AppError('No image file provided', 400, 'NO_FILE');
  }

  let hospName = 'General_Hospital';
  if (req.user?.hospitalId) {
    const hosp = await Hospital.findById(req.user.hospitalId);
    if (hosp) hospName = hosp.name;
  }

  const storedRef = await storeMedicineImage(req.file, hospName);

  const imageUrl = storedRef.startsWith('http') ? storedRef : `/api/uploads/public/${storedRef}`;
  res.json({ success: true, data: { imageUrl } });
});

// ==================== MEDICINE CRUD ====================

const createMedicineSchema = z.object({
  name: z.string().min(1),
  genericName: z.string().optional(),
  description: z.string().optional(),
  category: z.enum(['Serum', 'Tablet', 'Capsule', 'Shampoo', 'Lotion', 'Oil', 'Ointment', 'Solution']),
  manufacturer: z.string().optional(),
  sellingPrice: z.number().min(0),
  costPrice: z.number().min(0),
  reorderLevel: z.number().min(0).default(10),
  unit: z.string().default('pcs'),
  imageUrl: z.string().optional(),
});

router.post('/medicines', validate(createMedicineSchema), async (req: AuthRequest, res: Response) => {
  const medicine = await Medicine.create({
    ...req.body,
    hospitalId: req.user?.hospitalId,
  });

  res.locals.auditDescription = `Added new pharmacy medicine: ${medicine.name} (${medicine.category})`;
  res.locals.auditDetails = { name: medicine.name, category: medicine.category };

  res.status(201).json({ success: true, data: medicine });
});

router.get('/medicines', async (req: AuthRequest, res: Response) => {
  const search = req.query.search as string;
  const conditions: any[] = [];

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

  const filter = conditions.length === 0 ? {} : conditions.length === 1 ? conditions[0] : { $and: conditions };
  const medicines = await Medicine.find(filter).sort({ name: 1 });
  res.json({ success: true, data: medicines });
});

router.get('/medicines/:id', async (req: AuthRequest, res: Response) => {
  const medicine = await Medicine.findById(req.params.id);
  if (!medicine) throw new AppError('Medicine not found', 404, 'NOT_FOUND');
  res.json({ success: true, data: medicine });
});

router.patch('/medicines/:id', async (req: AuthRequest, res: Response) => {
  const medicine = await Medicine.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!medicine) throw new AppError('Medicine not found', 404, 'NOT_FOUND');

  res.locals.auditDescription = `Updated medicine details for ${medicine.name}`;
  res.locals.auditDetails = { name: medicine.name, category: medicine.category };

  res.json({ success: true, data: medicine });
});

// ==================== BATCH MANAGEMENT ====================

const addBatchSchema = z.object({
  batchNumber: z.string().min(1),
  quantity: z.number().min(1),
  expiryDate: z.string().min(1),
  purchasePrice: z.number().min(0),
});

router.post('/medicines/:id/batches', validate(addBatchSchema), async (req: AuthRequest, res: Response) => {
  const medicine = await Medicine.findById(req.params.id);
  if (!medicine) throw new AppError('Medicine not found', 404, 'NOT_FOUND');

  medicine.batches.push({
    ...req.body,
    expiryDate: new Date(req.body.expiryDate),
    addedAt: new Date(),
  });

  await medicine.save();

  res.locals.auditDescription = `Received new batch stock #${req.body.batchNumber} (${req.body.quantity} units) for ${medicine.name}`;
  res.locals.auditDetails = { name: medicine.name, batchNumber: req.body.batchNumber, quantity: req.body.quantity };

  res.status(201).json({ success: true, data: medicine });
});

router.delete('/medicines/:id/batches/:batchId', async (req: AuthRequest, res: Response) => {
  const medicine = await Medicine.findById(req.params.id);
  if (!medicine) throw new AppError('Medicine not found', 404, 'NOT_FOUND');

  medicine.batches = medicine.batches.filter((b: any) => b._id?.toString() !== req.params.batchId);
  await medicine.save();
  res.json({ success: true, data: medicine });
});

// ==================== REORDER ALERTS ====================
 
router.get('/reorder-alerts', async (req: AuthRequest, res: Response) => {
  const filter: any = { isActive: true };
  if (req.user?.hospitalId) {
    filter.$or = [
      { hospitalId: req.user.hospitalId },
      { hospitalId: null },
      { hospitalId: { $exists: false } },
    ];
  }
  const medicines = await Medicine.find(filter);

  const alerts = medicines
    .map((m) => ({
      _id: m._id,
      name: m.name,
      category: m.category,
      totalStock: m.totalStock,
      reorderLevel: m.reorderLevel,
      deficit: m.reorderLevel - m.totalStock,
    }))
    .filter((m) => m.totalStock <= m.reorderLevel)
    .sort((a, b) => b.deficit - a.deficit);

  res.json({ success: true, data: alerts });
});

// ==================== STOCK REPORTS ====================

router.get('/reports/overview', async (req: AuthRequest, res: Response) => {
  const filter: any = { isActive: true };
  if (req.user?.hospitalId) {
    filter.$or = [
      { hospitalId: req.user.hospitalId },
      { hospitalId: null },
      { hospitalId: { $exists: false } },
    ];
  }
  const medicines = await Medicine.find(filter);

  const totalItems = medicines.length;
  const totalStock = medicines.reduce((sum, m) => sum + m.totalStock, 0);
  const lowStockCount = medicines.filter((m) => m.totalStock <= m.reorderLevel).length;
  const totalValue = medicines.reduce((sum, m) => {
    return sum + m.batches.reduce((bs, b) => bs + b.quantity * b.purchasePrice, 0);
  }, 0);

  const now = new Date();
  const threeMonths = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
  const expiringBatches = medicines.reduce((count, m) => {
    return count + m.batches.filter((b) => b.expiryDate <= threeMonths && b.quantity > 0).length;
  }, 0);

  res.json({
    success: true,
    data: { totalItems, totalStock, lowStockCount, totalValue, expiringBatches },
  });
});

export default router;
