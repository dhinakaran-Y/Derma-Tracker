import mongoose from 'mongoose';
import { env } from '../config/env';
import { User } from '../models/User';
import { Patient } from '../models/Patient';
import { Medicine } from '../models/Medicine';
import { ClinicSettings } from '../models/ClinicSettings';
import { Visit } from '../models/Visit';
import { Appointment } from '../models/Appointment';
import { Counter } from '../models/Counter';
import { Hospital } from '../models/Hospital';

async function seed() {
  console.log('🌱 Connecting to MongoDB to seed initial demo data...');
  await mongoose.connect(env.MONGODB_URI);

  // Clear existing collections
  await Promise.all([
    Hospital.deleteMany({}),
    User.deleteMany({}),
    Patient.deleteMany({}),
    Medicine.deleteMany({}),
    ClinicSettings.deleteMany({}),
    Visit.deleteMany({}),
    Appointment.deleteMany({}),
    Counter.deleteMany({}),
  ]);

  console.log('🧹 Cleared existing database records.');

  // 0. Flagship Hospital
  const flagshipHospital = await Hospital.create({
    name: 'DermaTrack Trichology & Scalp Dermatology Hospital',
    shortName: 'DermaTrack',
    type: 'Hospital',
    email: 'info@dermatrack.clinic',
    websiteUrl: 'https://dermatrack.clinic',
    phone: '+91 98765 43210',
    address: '42 Trichology Avenue, Healthcare City, Chennai, TN',
    gstNumber: '33AAAAA0000A1Z5',
    status: 'Active',
  });

  // 1. Clinic Settings
  await ClinicSettings.create({
    _id: 'clinic_settings',
    clinicName: 'DermaTrack Trichology & Dermatology Clinic',
    address: '42 Trichology Avenue, Healthcare City, Chennai, TN',
    phone: '+91 98765 43210',
    email: 'info@dermatrack.clinic',
    gstNumber: '33AAAAA0000A1Z5',
    gstRules: [
      { itemType: 'Consultation', gstRate: 18, updatedAt: new Date() },
      { itemType: 'Procedure', gstRate: 18, updatedAt: new Date() },
      { itemType: 'Medicine', gstRate: 5, updatedAt: new Date() },
      { itemType: 'Lab Test', gstRate: 12, updatedAt: new Date() },
    ],
    workingHours: { start: '09:00', end: '19:00' },
    appointmentDuration: 30,
  });

  // 2. Staff Users for all roles
  // Passwords will be hashed by User pre-save hook
  const admin = await User.create({
    username: 'admin',
    passwordHash: 'admin123',
    fullName: 'Dr. Priya Menon (Admin)',
    email: 'priya.admin@dermatrack.clinic',
    role: 'Admin',
    status: 'Active',
    hospitalId: flagshipHospital._id,
  });

  const doctor1 = await User.create({
    username: 'dr.ananya',
    passwordHash: 'doctor123',
    fullName: 'Dr. Ananya Sharma',
    email: 'ananya.sharma@dermatrack.clinic',
    role: 'Doctor',
    status: 'Active',
    specialization: 'Dermatology & Trichology',
    consultFee: 500,
    firstVisitFee: 800,
    isAvailable: true,
    isOnDuty: true,
  });

  const doctor2 = await User.create({
    username: 'dr.rajesh',
    passwordHash: 'doctor123',
    fullName: 'Dr. Rajesh Varma',
    email: 'rajesh.varma@dermatrack.clinic',
    role: 'Doctor',
    status: 'Active',
    specialization: 'Dermato-Surgery & Hair Restoration',
    consultFee: 700,
    firstVisitFee: 1000,
    isAvailable: true,
    isOnDuty: true,
  });

  const receptionist = await User.create({
    username: 'receptionist',
    passwordHash: 'staff123',
    fullName: 'Kavitha Ram',
    email: 'kavitha.reception@dermatrack.clinic',
    role: 'Receptionist',
    status: 'Active',
  });

  const medGiver = await User.create({
    username: 'medgiver',
    passwordHash: 'staff123',
    fullName: 'Suresh Kumar (Pharm)',
    email: 'suresh.pharma@dermatrack.clinic',
    role: 'MedicationGiver',
    status: 'Active',
  });

  const stockManager = await User.create({
    username: 'stockmanager',
    passwordHash: 'staff123',
    fullName: 'Ramesh Patel (Inventory)',
    email: 'ramesh.inventory@dermatrack.clinic',
    role: 'StockManager',
    status: 'Active',
  });

  console.log('👤 Created Staff accounts: admin, dr.ananya, dr.rajesh, receptionist, medgiver, stockmanager');

  // 3. Patients
  const patient1 = await Patient.create({
    patientId: 'PAT-000001',
    name: 'Aarav Mehta',
    phone: '9876543210',
    email: 'aarav.mehta@gmail.com',
    location: 'Chennai Central',
    dateOfBirth: new Date('1990-04-12'),
    gender: 'Male',
    isActive: true,
  });

  const patient2 = await Patient.create({
    patientId: 'PAT-000002',
    name: 'Sneha Reddy',
    phone: '9876543211',
    email: 'sneha.reddy@gmail.com',
    location: 'Anna Nagar',
    dateOfBirth: new Date('1995-08-23'),
    gender: 'Female',
    isActive: true,
  });

  const patient3 = await Patient.create({
    patientId: 'PAT-000003',
    name: 'Vikram Sundaram',
    phone: '9876543212',
    email: 'vikram.sundaram@gmail.com',
    location: 'T. Nagar',
    dateOfBirth: new Date('1988-11-05'),
    gender: 'Male',
    isActive: true,
  });

  console.log('🧑‍🤝‍🧑 Created Demo Patients: Aarav Mehta (9876543210), Sneha Reddy (9876543211), Vikram (9876543212)');

  // 4. Medicines & Batches — Real clinic medicines from asset images (serum-img/, tablet-img/, Shampoo-img/)

  // -- SERUMS (from serum-img/) --
  const keraFm = await Medicine.create({
    name: 'Kera-FM 5%',
    genericName: 'Minoxidil & Finasteride Topical Solution',
    category: 'Serum',
    manufacturer: 'Ipca Laboratories',
    sellingPrice: 850,
    costPrice: 520,
    reorderLevel: 10,
    unit: 'Bottle (60ml)',
    batches: [{ batchNumber: 'KFM-2025-A1', quantity: 30, expiryDate: new Date('2027-08-31'), purchasePrice: 520, addedAt: new Date() }],
    isActive: true,
  });

  const androanagen = await Medicine.create({
    name: 'Androanagen Solution 5%',
    genericName: 'Minoxidil Topical Solution USP 5.0% w/v',
    category: 'Serum',
    manufacturer: 'Torrent Pharmaceuticals',
    sellingPrice: 780,
    costPrice: 480,
    reorderLevel: 12,
    unit: 'Bottle (100ml)',
    batches: [{ batchNumber: 'ANG-2025-B2', quantity: 25, expiryDate: new Date('2027-06-30'), purchasePrice: 480, addedAt: new Date() }],
    isActive: true,
  });

  const inbiltF = await Medicine.create({
    name: 'Inbilt-F',
    genericName: 'Minoxidil & Finasteride Lipid Solution (Cetosomes)',
    category: 'Serum',
    manufacturer: 'Glenmark Pharmaceuticals',
    sellingPrice: 920,
    costPrice: 580,
    reorderLevel: 10,
    unit: 'Bottle (60ml)',
    batches: [{ batchNumber: 'INB-2025-C3', quantity: 20, expiryDate: new Date('2027-09-30'), purchasePrice: 580, addedAt: new Date() }],
    isActive: true,
  });

  const strandz5 = await Medicine.create({
    name: 'Strandz 5% Liposomal',
    genericName: 'Minoxidil 5% Liposomal Topical Solution',
    category: 'Serum',
    manufacturer: 'Eris Oaknet (Eris Lifesciences)',
    sellingPrice: 890,
    costPrice: 540,
    reorderLevel: 10,
    unit: 'Bottle (60ml)',
    batches: [{ batchNumber: 'STZ-2025-D4', quantity: 18, expiryDate: new Date('2027-07-31'), purchasePrice: 540, addedAt: new Date() }],
    isActive: true,
  });

  const strandzF = await Medicine.create({
    name: 'Strandz F (Minoxidil 5% + Finasteride 0.1%)',
    genericName: 'Minoxidil 5% & Finasteride 0.1% Lipid Solution + Procapil + Redensyl + Anagain + Caffeine',
    category: 'Serum',
    manufacturer: 'Eris Oaknet (Eris Lifesciences)',
    sellingPrice: 1050,
    costPrice: 680,
    reorderLevel: 8,
    unit: 'Bottle (60ml)',
    batches: [{ batchNumber: 'SZF-2025-E5', quantity: 15, expiryDate: new Date('2027-10-31'), purchasePrice: 680, addedAt: new Date() }],
    isActive: true,
  });

  // -- SHAMPOOS (from Shampoo-img/) --
  const cosmoQ = await Medicine.create({
    name: 'CosmoQ Shampoo',
    genericName: 'Hydrating Anti-Frizz Dermatology Shampoo',
    category: 'Shampoo',
    manufacturer: 'Aesthetic Science',
    sellingPrice: 550,
    costPrice: 340,
    reorderLevel: 15,
    unit: 'Bottle (200ml)',
    batches: [{ batchNumber: 'CSQ-2025-F1', quantity: 35, expiryDate: new Date('2027-12-31'), purchasePrice: 340, addedAt: new Date() }],
    isActive: true,
  });

  const ketoShampoo = await Medicine.create({
    name: 'Ketoconazole Shampoo 2%',
    genericName: 'Ketoconazole 2% w/v Medicated Shampoo',
    category: 'Shampoo',
    manufacturer: 'Cipla Ltd.',
    sellingPrice: 350,
    costPrice: 210,
    reorderLevel: 15,
    unit: 'Bottle (100ml)',
    batches: [{ batchNumber: 'KTZ-2025-I1', quantity: 40, expiryDate: new Date('2027-06-30'), purchasePrice: 210, addedAt: new Date() }],
    isActive: true,
  });

  // -- TABLETS / CAPSULES (from tablet-img/) --
  const duman = await Medicine.create({
    name: 'Duman 0.5mg',
    genericName: 'Dutasteride Tablets IP 0.5mg',
    category: 'Tablet',
    manufacturer: 'Intas Pharmaceuticals Ltd.',
    sellingPrice: 208,
    costPrice: 130,
    reorderLevel: 20,
    unit: 'Strip (10 tabs)',
    batches: [{ batchNumber: 'DMN-N2403390', quantity: 50, expiryDate: new Date('2027-11-30'), purchasePrice: 130, addedAt: new Date() }],
    isActive: true,
  });

  const duttos = await Medicine.create({
    name: 'Duttos 0.5mg',
    genericName: 'Dutasteride Soft Gelatin Capsules IP 0.5mg',
    category: 'Capsule',
    manufacturer: "Dr. Reddy's Laboratories",
    sellingPrice: 240,
    costPrice: 155,
    reorderLevel: 20,
    unit: 'Strip (10 capsules)',
    batches: [{ batchNumber: 'DTS-2025-G2', quantity: 40, expiryDate: new Date('2027-09-30'), purchasePrice: 155, addedAt: new Date() }],
    isActive: true,
  });

  // -- ADDITIONAL STANDARD DERMA-TRICHOLOGY MEDICINES --
  const finasteride = await Medicine.create({
    name: 'Finasteride 1mg',
    genericName: 'Finasteride Tablets IP 1mg',
    category: 'Tablet',
    manufacturer: 'Cipla Ltd.',
    sellingPrice: 320,
    costPrice: 190,
    reorderLevel: 25,
    unit: 'Strip (30 tabs)',
    batches: [{ batchNumber: 'FIN-2025-J1', quantity: 60, expiryDate: new Date('2027-12-31'), purchasePrice: 190, addedAt: new Date() }],
    isActive: true,
  });

  const biotin = await Medicine.create({
    name: 'Biotin 10000mcg',
    genericName: 'Biotin (Vitamin B7) Tablets',
    category: 'Tablet',
    manufacturer: 'HealthKart / Abbott',
    sellingPrice: 450,
    costPrice: 280,
    reorderLevel: 25,
    unit: 'Bottle (60 tabs)',
    batches: [{ batchNumber: 'BIO-2025-H1', quantity: 35, expiryDate: new Date('2028-03-31'), purchasePrice: 280, addedAt: new Date() }],
    isActive: true,
  });

  await Medicine.create({
    name: 'Iron & Folic Acid',
    genericName: 'Ferrous Fumarate 152mg + Folic Acid 1.5mg',
    category: 'Tablet',
    manufacturer: 'Sun Pharmaceutical',
    sellingPrice: 85,
    costPrice: 45,
    reorderLevel: 30,
    unit: 'Strip (30 tabs)',
    batches: [{ batchNumber: 'IFA-2025-K1', quantity: 100, expiryDate: new Date('2028-06-30'), purchasePrice: 45, addedAt: new Date() }],
    isActive: true,
  });

  await Medicine.create({
    name: 'Calcitriol + Calcium + Zinc',
    genericName: 'Calcitriol 0.25mcg + Calcium Carbonate 500mg + Zinc 7.5mg',
    category: 'Capsule',
    manufacturer: 'Macleods Pharmaceuticals',
    sellingPrice: 180,
    costPrice: 100,
    reorderLevel: 20,
    unit: 'Strip (15 capsules)',
    batches: [{ batchNumber: 'CCZ-2025-L1', quantity: 45, expiryDate: new Date('2027-11-30'), purchasePrice: 100, addedAt: new Date() }],
    isActive: true,
  });

  await Medicine.create({
    name: 'Clobetasol Propionate 0.05% Lotion',
    genericName: 'Clobetasol Propionate Topical Lotion USP',
    category: 'Lotion',
    manufacturer: 'Glenmark Pharmaceuticals',
    sellingPrice: 290,
    costPrice: 170,
    reorderLevel: 10,
    unit: 'Bottle (30ml)',
    batches: [{ batchNumber: 'CLB-2025-M1', quantity: 20, expiryDate: new Date('2027-05-31'), purchasePrice: 170, addedAt: new Date() }],
    isActive: true,
  });

  await Medicine.create({
    name: 'Tacrolimus Ointment 0.1%',
    genericName: 'Tacrolimus Monohydrate 0.1% Ointment',
    category: 'Ointment',
    manufacturer: 'Sun Dermatics',
    sellingPrice: 490,
    costPrice: 310,
    reorderLevel: 10,
    unit: 'Tube (20g)',
    batches: [{ batchNumber: 'TAC-2025-N1', quantity: 15, expiryDate: new Date('2027-08-31'), purchasePrice: 310, addedAt: new Date() }],
    isActive: true,
  });

  await Medicine.create({
    name: 'Zinc Pyrithione Shampoo 1%',
    genericName: 'Zinc Pyrithione 1% w/v Anti-Dandruff Shampoo',
    category: 'Shampoo',
    manufacturer: 'Johnson & Johnson',
    sellingPrice: 280,
    costPrice: 160,
    reorderLevel: 15,
    unit: 'Bottle (100ml)',
    batches: [{ batchNumber: 'ZPT-2025-O1', quantity: 30, expiryDate: new Date('2028-01-31'), purchasePrice: 160, addedAt: new Date() }],
    isActive: true,
  });

  await Medicine.create({
    name: 'Prednisolone 5mg',
    genericName: 'Prednisolone Tablets IP 5mg',
    category: 'Tablet',
    manufacturer: 'Cadila Healthcare (Zydus)',
    sellingPrice: 35,
    costPrice: 18,
    reorderLevel: 30,
    unit: 'Strip (10 tabs)',
    batches: [{ batchNumber: 'PRD-2025-P1', quantity: 80, expiryDate: new Date('2027-10-31'), purchasePrice: 18, addedAt: new Date() }],
    isActive: true,
  });

  await Medicine.create({
    name: 'Minoxidil 2% Solution (Women)',
    genericName: 'Minoxidil Topical Solution USP 2% w/v',
    category: 'Solution',
    manufacturer: 'Torrent Pharmaceuticals',
    sellingPrice: 620,
    costPrice: 380,
    reorderLevel: 10,
    unit: 'Bottle (60ml)',
    batches: [{ batchNumber: 'MNX2-2025-Q1', quantity: 20, expiryDate: new Date('2027-07-31'), purchasePrice: 380, addedAt: new Date() }],
    isActive: true,
  });

  console.log('💊 Created 19 Real Clinic Medicines (Serums, Shampoos, Tablets, Capsules, Lotion, Ointment, Solution) with Batches');

  // 5. Visits
  const visit1 = await Visit.create({
    patientId: patient1._id,
    doctorId: doctor1._id,
    visitDate: new Date(),
    visitType: 'FirstVisit',
    queueNumber: 1,
    status: 'InProgress',
    chiefComplaint: 'Diffuse crown thinning and receding hairline for 8 months.',
    diagnosis: 'Androgenetic Alopecia (Norwood Scale Grade 3)',
    clinicalNotes: 'Scalp dermatoscopy shows miniaturization in frontal-vertex zones. Initiating topical Minoxidil + oral Finasteride regimen. PRP recommended.',
    hairDensity: 64,
    consultFee: 800,
    prescriptions: [
      {
        medicineId: androanagen._id,
        medicineName: androanagen.name,
        dosage: '1ml twice daily',
        frequency: 'Morning & Night',
        duration: '90 days',
        quantity: 3,
        isDispensed: false,
      },
      {
        medicineId: finasteride._id,
        medicineName: finasteride.name,
        dosage: '1 tablet once daily',
        frequency: 'Night after dinner',
        duration: '90 days',
        quantity: 3,
        isDispensed: false,
      },
    ],
    procedures: [
      {
        name: 'Scalp Dermoscopy Analysis',
        notes: 'High-magnification folli-count map recorded',
        fee: 500,
      },
    ],
  });

  await Visit.create({
    patientId: patient2._id,
    doctorId: doctor1._id,
    visitDate: new Date(),
    visitType: 'FollowUp',
    queueNumber: 2,
    status: 'Waiting',
    chiefComplaint: 'Follow-up on patchy alopecia areata spot treatment.',
    consultFee: 500,
  });

  // 6. Appointments
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(10, 30, 0, 0);

  await Appointment.create({
    patientId: patient3._id,
    doctorId: doctor1._id,
    scheduledAt: tomorrow,
    mode: 'Offline',
    type: 'Consult',
    status: 'Scheduled',
    bookedBy: receptionist._id,
    bookedByRole: 'Staff',
    notes: 'Initial trichology consultation',
  });

  // 7. Counter
  await Counter.create({ name: 'patient', seq: 3 });
  await Counter.create({ name: 'invoice', financialYear: '2026-27', seq: 1 });

  console.log('✅ Database seeded successfully with demo data!');
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});
