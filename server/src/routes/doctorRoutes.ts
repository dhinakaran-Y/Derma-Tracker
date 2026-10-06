import { Router, Response } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { Visit } from '../models/Visit';
import { Patient } from '../models/Patient';
import { User } from '../models/User';
import { AuthRequest, authMiddleware } from '../middleware/authMiddleware';
import { doctorOnly } from '../middleware/roleMiddleware';
import { auditMiddleware } from '../middleware/auditMiddleware';
import { upload, uploadScalp, sanitizeUploadedImage, storeScalpImage } from '../middleware/uploadMiddleware';
import * as cloudinaryService from '../services/cloudinaryService';
import { uploadLimiter } from '../middleware/rateLimitMiddleware';
import { AppError } from '../middleware/errorMiddleware';
import { emitToRole, emitToUser } from '../config/socket';
import { resolveUploadPath } from './uploadRoutes';

const router = Router();
router.use(authMiddleware, doctorOnly, auditMiddleware('doctor'));

// ==================== QUEUE ====================

router.get('/queue', async (req: AuthRequest, res: Response) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const queue = await Visit.find({
    doctorId: req.user!.id,
    visitDate: { $gte: today },
    status: { $in: ['Waiting', 'InProgress'] },
  })
    .populate('patientId', 'name phone patientId dateOfBirth gender bloodGroup maritalStatus heightCm allergies medicalHistoryNotes')
    .sort({ queueNumber: 1 });

  // Compute overall visit count for each patient in the queue
  const patientObjectIds = queue
    .map((v) => (v.patientId as any)?._id || v.patientId)
    .filter(Boolean);

  const counts = await Visit.aggregate([
    { $match: { patientId: { $in: patientObjectIds } } },
    { $group: { _id: '$patientId', count: { $sum: 1 } } },
  ]);

  const countMap = new Map<string, number>(
    counts.map((c) => [c._id.toString(), c.count])
  );

  const enrichedQueue = queue.map((v) => {
    const obj = v.toObject();
    const pId = (v.patientId as any)?._id?.toString() || (v.patientId as any)?.toString();
    return {
      ...obj,
      visitCount: pId ? (countMap.get(pId) || 1) : 1,
    };
  });

  res.json({ success: true, data: enrichedQueue });
});

// ==================== TREATMENT PROTOCOLS REFERENCE ====================

router.get('/protocols', async (_req: AuthRequest, res: Response) => {
  const protocols = [
    {
      id: 'aga-male',
      condition: 'Androgenetic Alopecia (Male)',
      classificationSystem: 'Norwood-Hamilton (Stage I - VII)',
      suggestedDiagnosis: 'Male Pattern Androgenetic Alopecia',
      firstLineTherapy: 'Topical Minoxidil 5% Solution / Strandz F + Oral Finasteride 1mg / Dutasteride 0.5mg',
      adjunctiveTherapy: 'Ketoconazole 2% Shampoo (CosmoQ), Biotin Supplements, Scalp Dermarolling / PRP',
      commonLabTests: ['Serum Ferritin', 'TSH', 'Vitamin D3', 'Total Testosterone'],
      recommendedFollowUpWeeks: 8,
      suggestedNotes: 'Miniaturization evident in frontal and vertex scalp. Norwood staging assigned. Advised continuous therapy minimum 6-12 months for stabilization.',
      recommendedMedicines: ['Androanagen Solution 5%', 'Strandz F', 'Finasteride 1mg', 'Duman 0.5mg', 'CosmoQ Shampoo', 'Biotin 10mg'],
    },
    {
      id: 'aga-female',
      condition: 'Female Pattern Hair Loss (Ludwig)',
      classificationSystem: 'Ludwig Scale (Grade I - III) / Sinclair Scale (1 - 5)',
      suggestedDiagnosis: 'Female Pattern Hair Loss / Androgenetic Alopecia',
      firstLineTherapy: 'Topical Minoxidil 2% or 5% Foam / Strandz 5% Liposomal Serum + Nutritional Correction',
      adjunctiveTherapy: 'Iron+Folic Acid (if Ferritin < 50 ng/mL), Vitamin D3, CosmoQ Shampoo, Low-Level Laser Therapy',
      commonLabTests: ['Serum Ferritin', 'TSH', 'Free & Total Testosterone', 'DHEA-S', 'Vitamin D3', 'Vitamin B12'],
      recommendedFollowUpWeeks: 8,
      suggestedNotes: 'Preservation of frontal hairline with diffuse centrifugal thinning over crown (Christmas tree pattern). Advised on consistent minoxidil application. Strict teratogenic contraindication noted for 5-AR inhibitors.',
      recommendedMedicines: ['Strandz 5% Liposomal', 'Inbilt-F', 'CosmoQ Shampoo', 'Iron + Folic Acid Tablets', 'Biotin 10mg'],
    },
    {
      id: 'telogen-effluvium',
      condition: 'Telogen Effluvium (Acute / Chronic)',
      classificationSystem: 'Pull Test & Trichoscopy',
      suggestedDiagnosis: 'Telogen Effluvium (Stress / Post-febrile / Postpartum)',
      firstLineTherapy: 'Identify & correct underlying trigger + Nutritional repletion + Supportive hair peptide serums',
      adjunctiveTherapy: 'Gentle clarifying shampoo, stress management, hair growth multivitamin',
      commonLabTests: ['Complete Blood Count (CBC)', 'Serum Ferritin', 'TSH', 'Serum Zinc', 'Vitamin D3'],
      recommendedFollowUpWeeks: 6,
      suggestedNotes: 'Positive hair pull test across scalp (>6 telogen club hairs). Abrupt diffuse shedding following systemic stressor. Reassured patient of reversible nature once nutritional reserves normalize.',
      recommendedMedicines: ['Kera-FM 5%', 'Strandz 5% Liposomal', 'Iron + Folic Acid Tablets', 'Biotin 10mg', 'CosmoQ Shampoo'],
    },
    {
      id: 'alopecia-areata',
      condition: 'Alopecia Areata (Patchy)',
      classificationSystem: 'SALT Score (Severity of Alopecia Tool)',
      suggestedDiagnosis: 'Alopecia Areata (Patchy)',
      firstLineTherapy: 'Potent Topical Corticosteroid (Clobetasol 0.05%) / Intralesional Triamcinolone (ILST) + Topical Tacrolimus',
      adjunctiveTherapy: 'Topical Minoxidil 5% during regrowth phase, immune support',
      commonLabTests: ['Anti-Nuclear Antibodies (ANA)', 'Thyroid Peroxidase (TPO) Antibodies', 'Vitamin D3'],
      recommendedFollowUpWeeks: 4,
      suggestedNotes: 'Smooth circumscribed non-scarring alopecic patch. Dermoscopy reveals exclamation mark hairs and black dots at periphery indicating active disease. Advised on treatment response expectations.',
      recommendedMedicines: ['Clobetasol Propionate 0.05% Lotion', 'Tacrolimus 0.1% Ointment', 'Strandz 5% Liposomal'],
    },
    {
      id: 'seborrheic-dermatitis',
      condition: 'Seborrheic Dermatitis & Severe Dandruff',
      classificationSystem: 'Scalp Severity Score',
      suggestedDiagnosis: 'Seborrheic Dermatitis of Scalp',
      firstLineTherapy: 'Antifungal Shampoo (Ketoconazole 2% + Zinc Pyrithione - CosmoQ) 2-3x weekly',
      adjunctiveTherapy: 'Low-potency topical corticosteroid lotion for intense pruritus and erythema',
      commonLabTests: ['Fungal KOH Mount / Culture (if recalcitrant)'],
      recommendedFollowUpWeeks: 4,
      suggestedNotes: 'Greasy yellowish scaling with erythema across vertex and hairline. Advised to leave medicated shampoo lather for 5 minutes before rinsing.',
      recommendedMedicines: ['CosmoQ Shampoo', 'Ketoconazole 2% Shampoo', 'Clobetasol Propionate 0.05% Lotion'],
    },
  ];

  res.json({ success: true, data: protocols });
});

// ==================== VITALS HISTORY ====================

router.get('/patient/:patientId/vitals', async (req: AuthRequest, res: Response) => {
  const patient = await Patient.findById(req.params.patientId);
  if (!patient) throw new AppError('Patient not found', 404, 'NOT_FOUND');

  const visits = await Visit.find({ patientId: req.params.patientId })
    .populate('doctorId', 'fullName specialization')
    .sort({ visitDate: 1, createdAt: 1 });

  res.json({
    success: true,
    data: {
      patient,
      visits,
    },
  });
});

// ==================== MY PATIENTS ====================

router.get('/patients', async (req: AuthRequest, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const skip = (page - 1) * limit;
  const search = req.query.search as string;

  // Find patients who have visited this doctor
  const visitedPatientIds = await Visit.distinct('patientId', { doctorId: req.user!.id });

  const filter: any = { _id: { $in: visitedPatientIds }, isActive: true };
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } },
      { patientId: { $regex: search, $options: 'i' } },
    ];
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

// ==================== VISITS ====================

router.get(['/visits/:patientId', '/patient/:patientId/visits'], async (req: AuthRequest, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const skip = (page - 1) * limit;

  const filter: any = { patientId: req.params.patientId };
  if (req.query.onlyMyVisits === 'true') {
    filter.doctorId = req.user!.id;
  }

  const [visits, total] = await Promise.all([
    Visit.find(filter)
      .populate('doctorId', 'fullName specialization')
      .sort({ visitDate: -1 })
      .skip(skip)
      .limit(limit),
    Visit.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: visits,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

router.patch('/visits/:visitId', async (req: AuthRequest, res: Response) => {
  const visit = await Visit.findOne({ _id: req.params.visitId, doctorId: req.user!.id }).populate('patientId', 'name patientId');
  if (!visit) throw new AppError('Visit not found', 404, 'NOT_FOUND');

  const {
    chiefComplaint,
    diagnosis,
    clinicalNotes,
    hairDensity,
    weightKg,
    heightCm,
    prescriptions,
    procedures,
    labTests,
    alopeciaStage,
    dlqiScore,
    scalpHealth,
    followUpWeeks,
    consultationWorkflow,
    status,
  } = req.body;

  if (consultationWorkflow !== undefined) visit.consultationWorkflow = consultationWorkflow;

  if (chiefComplaint !== undefined) visit.chiefComplaint = chiefComplaint;
  if (diagnosis !== undefined) visit.diagnosis = diagnosis;
  if (clinicalNotes !== undefined) visit.clinicalNotes = clinicalNotes;
  if (hairDensity !== undefined) visit.hairDensity = hairDensity;
  if (alopeciaStage !== undefined) visit.alopeciaStage = alopeciaStage;
  if (dlqiScore !== undefined) visit.dlqiScore = dlqiScore;
  if (scalpHealth !== undefined) visit.scalpHealth = scalpHealth;
  if (followUpWeeks !== undefined) visit.followUpWeeks = followUpWeeks;
  if (weightKg !== undefined) visit.weightKg = weightKg;
  if (heightCm !== undefined) visit.heightCm = heightCm;
  if (prescriptions !== undefined) visit.prescriptions = prescriptions;
  if (procedures !== undefined) visit.procedures = procedures;
  if (labTests !== undefined) {
    visit.labTests = Array.isArray(labTests)
      ? labTests.map((t: any) =>
          typeof t === 'string'
            ? { testName: t, status: 'Ordered', fee: 0 }
            : {
                testName: t.testName || t.name || 'Lab Test',
                notes: t.notes || '',
                fee: typeof t.fee === 'number' ? t.fee : 0,
                status: t.status || 'Ordered',
              }
        )
      : [];
  }
  if (status !== undefined) visit.status = status;

  await visit.save();

  const pName = (visit.patientId as any)?.name || 'Patient';
  if (status === 'Completed') {
    res.locals.auditDescription = `Consultation completed for patient: ${pName}`;
  } else if (labTests && labTests.length > 0) {
    res.locals.auditDescription = `Ordered ${labTests.length} lab test(s) for patient: ${pName}`;
  } else if (prescriptions && prescriptions.length > 0) {
    res.locals.auditDescription = `Prescribed ${prescriptions.length} medication(s) for patient: ${pName}`;
  } else {
    res.locals.auditDescription = `Updated clinical consultation notes for patient: ${pName}`;
  }
  res.locals.auditDetails = { patientName: pName, status: visit.status };

  // If visit completed, emit queue update to Receptionist and MedicationGiver
  if (status === 'Completed') {
    try {
      emitToRole('Receptionist', 'queue:updated', { action: 'completed', visit });
      emitToRole('MedicationGiver', 'queue:updated', { action: 'completed', visit });
      // Notify paired mobile devices that consultation completed (no active patient)
      emitToUser(req.user!.id, 'consultation:patient-changed', { visit: null });
    } catch {}
  }

  res.json({ success: true, data: visit });
});

router.patch('/visits/:visitId/start', async (req: AuthRequest, res: Response) => {
  const visit = await Visit.findOneAndUpdate(
    { _id: req.params.visitId, doctorId: req.user!.id, status: 'Waiting' },
    { status: 'InProgress' },
    { new: true }
  ).populate('patientId', 'name patientId');
  if (!visit) throw new AppError('Visit not found or already started', 404, 'NOT_FOUND');

  const pName = (visit.patientId as any)?.name || 'Patient';
  res.locals.auditDescription = `Consultation ongoing with patient: ${pName}`;
  res.locals.auditDetails = { patientName: pName, status: 'InProgress' };

  try {
    emitToRole('Receptionist', 'queue:updated', { action: 'started', visit });
    emitToRole('MedicationGiver', 'queue:updated', { action: 'started', visit });
    // Notify paired mobile devices about active patient change
    emitToUser(req.user!.id, 'consultation:patient-changed', { visit });
  } catch {}

  res.json({ success: true, data: visit });
});

// ==================== SCALP IMAGE MANAGEMENT ====================

router.post(
  '/visits/:visitId/images',
  uploadLimiter,
  uploadScalp.single('image'),
  sanitizeUploadedImage,
  async (req: AuthRequest, res: Response) => {
    if (!req.file) throw new AppError('No image uploaded', 400, 'NO_IMAGE');

    const visit = await Visit.findOne({ _id: req.params.visitId, doctorId: req.user!.id })
      .populate('patientId', 'name patientId')
      .populate('hospitalId', 'name');
    if (!visit) throw new AppError('Visit not found', 404, 'NOT_FOUND');

    if (visit.scalpImages && visit.scalpImages.length >= 5) {
      // Remove the uploaded file since max limit is reached
      const uploadedFilePath = req.file.path || (req.file.filename ? path.join(process.cwd(), 'uploads', req.file.filename) : null);
      if (uploadedFilePath && fs.existsSync(uploadedFilePath)) {
        try { fs.unlinkSync(uploadedFilePath); } catch {}
      }
      throw new AppError('Maximum limit of 5 scalp images reached for this visit. Please delete an existing image to upload a new one.', 400, 'MAX_IMAGES_REACHED');
    }

    const patient = visit.patientId as any;
    const hosp = visit.hospitalId as any;
    const storedRef = await storeScalpImage(req.file, hosp?.name, patient?.patientId, patient?.name);

    visit.scalpImages.push(storedRef);
    await visit.save();

    res.locals.auditDescription = 'Uploaded scalp clinical examination image';

    const imageUrl = storedRef.startsWith('http') ? storedRef : `/api/uploads/${storedRef}`;
    try {
      emitToUser(req.user!.id, 'pairing:photo-captured', {
        visitId: visit._id,
        imageUrl,
        filename: storedRef,
        scalpImages: visit.scalpImages,
      });
    } catch {}

    res.json({ success: true, data: { filename: storedRef, scalpImages: visit.scalpImages } });
  }
);

router.delete(
  '/visits/:visitId/images/:filename',
  async (req: AuthRequest, res: Response) => {
    const { visitId } = req.params;
    const rawFilename = String(req.params.filename || '');

    if (!rawFilename) throw new AppError('Filename is required', 400, 'BAD_REQUEST');

    // Find visit by ID
    const visit = await Visit.findById(visitId);
    if (!visit) throw new AppError('Visit not found', 404, 'NOT_FOUND');

    const targetBase = path.basename(decodeURIComponent(rawFilename));
    const matchedImg = visit.scalpImages?.find(
      (img) => path.basename(img) === targetBase || img === rawFilename
    );

    if (!matchedImg) {
      throw new AppError('Image not found in this visit record', 404, 'IMAGE_NOT_FOUND');
    }

    visit.scalpImages = visit.scalpImages.filter(
      (img) => img !== matchedImg && path.basename(img) !== targetBase
    );
    await visit.save();

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

    try {
      emitToUser(req.user!.id, 'visit:image-deleted', {
        visitId: visit._id,
        filename: targetBase,
        scalpImages: visit.scalpImages,
      });
    } catch {}

    res.locals.auditDescription = `Deleted scalp photo: ${targetBase}`;

    res.json({
      success: true,
      message: 'Scalp image deleted successfully',
      data: { filename: targetBase, scalpImages: visit.scalpImages },
    });
  }
);

router.get(
  '/patients/:patientId/scalp-gallery',
  async (req: AuthRequest, res: Response) => {
    const { patientId } = req.params;

    const patient = await Patient.findById(patientId).select('name phone patientId dateOfBirth gender bloodGroup');
    if (!patient) throw new AppError('Patient not found', 404, 'NOT_FOUND');

    // Retrieve all visits for this patient with at least 1 scalp image, ordered by visitDate descending
    const visits = await Visit.find({
      patientId,
      'scalpImages.0': { $exists: true },
    })
      .select('_id visitDate status chiefComplaints diagnosis visitType scalpImages scalpHealth createdAt')
      .sort({ visitDate: -1, createdAt: -1 });

    res.json({
      success: true,
      data: {
        patient,
        visits,
      },
    });
  }
);

// ==================== DUTY TOGGLE ====================

router.patch('/duty-status', async (req: AuthRequest, res: Response) => {
  const { isOnDuty } = req.body;
  const doctor = await User.findByIdAndUpdate(req.user!.id, { isOnDuty }, { new: true });
  if (!doctor) throw new AppError('Doctor not found', 404, 'NOT_FOUND');

  try {
    emitToRole('Receptionist', 'doctor:duty-changed', {
      doctorId: doctor._id,
      fullName: doctor.fullName,
      isOnDuty: doctor.isOnDuty,
    });
  } catch {}

  res.locals.auditDescription = doctor.isOnDuty ? 'Doctor clocked in on-duty for consultations' : 'Doctor clocked off-duty';

  res.json({ success: true, data: { isOnDuty: doctor.isOnDuty } });
});

// ==================== WORKFLOW SETTINGS ====================

router.get('/settings', async (req: AuthRequest, res: Response) => {
  const doctor = await User.findById(req.user!.id);
  if (!doctor) throw new AppError('Doctor not found', 404, 'NOT_FOUND');

  res.json({
    success: true,
    data: {
      consultationWorkflow: doctor.consultationWorkflow || 'fully_app',
    },
  });
});

router.patch('/settings', async (req: AuthRequest, res: Response) => {
  const { consultationWorkflow } = req.body;
  if (!['fully_app', 'prescription_booklet'].includes(consultationWorkflow)) {
    throw new AppError('Invalid consultation workflow mode', 400, 'INVALID_WORKFLOW');
  }

  const doctor = await User.findByIdAndUpdate(
    req.user!.id,
    { consultationWorkflow },
    { new: true }
  );
  if (!doctor) throw new AppError('Doctor not found', 404, 'NOT_FOUND');

  res.locals.auditDescription = `Doctor switched consultation workflow to: ${
    consultationWorkflow === 'prescription_booklet' ? 'Patient Prescription Booklet' : 'Fully App Workflow'
  }`;

  res.json({
    success: true,
    data: {
      consultationWorkflow: doctor.consultationWorkflow,
    },
  });
});

// ==================== DEVICE PAIRING ====================

router.post('/pairing/generate', async (req: AuthRequest, res: Response) => {
  const pairingToken = crypto.randomBytes(16).toString('hex');
  // Token expires in 10 minutes
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  res.json({
    success: true,
    data: {
      pairingToken,
      expiresAt,
      qrData: JSON.stringify({
        type: 'dermatrack-pairing',
        token: pairingToken,
        doctorId: req.user!.id,
      }),
    },
  });
});

export default router;
