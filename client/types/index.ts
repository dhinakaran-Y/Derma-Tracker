export type UserRole = 'Admin' | 'Receptionist' | 'Doctor' | 'MedicationGiver' | 'StockManager';
export type UserStatus = 'Active' | 'Suspended' | 'Deactivated';

export interface Hospital {
  _id: string;
  name: string;
  shortName: string;
  type: 'BigHospital' | 'Hospital' | 'Clinic';
  email: string;
  websiteUrl?: string;
  logoUrl?: string;
  imageUrl?: string;
  phone?: string;
  address?: string;
  gstNumber?: string;
  status: 'Active' | 'PendingApproval' | 'Suspended';
  createdAt?: string;
}

export interface User {
  _id: string;
  username: string;
  fullName: string;
  email?: string;
  role: UserRole;
  status: UserStatus;
  hospitalId?: string | Hospital;
  specialization?: string;
  consultFee?: number;
  firstVisitFee?: number;
  consultationWorkflow?: 'fully_app' | 'prescription_booklet';
  isAvailable?: boolean;
  isOnDuty?: boolean;
  createdAt: string;
}

export interface Patient {
  _id: string;
  patientId: string;
  name: string;
  phone: string;
  email?: string;
  location?: string;
  age?: number;
  dateOfBirth?: string;
  gender?: 'Male' | 'Female' | 'Other';
  maritalStatus?: 'Single' | 'Married' | 'Divorced' | 'Widowed';
  heightCm?: number;
  lastHeightCm?: number;
  bloodGroup?: 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-' | 'Unknown';
  allergies?: string[];
  medicalHistoryNotes?: string;
  hospitalId?: string | Hospital;
  isActive: boolean;
  createdAt: string;
}

export interface PrescriptionItem {
  _id?: string;
  medicineId: string;
  medicineName: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions?: string;
  quantity: number;
  isDispensed: boolean;
  dispensedAt?: string;
}

export interface Procedure {
  _id?: string;
  name: string;
  notes?: string;
  fee: number;
}

export interface LabTestItem {
  _id?: string;
  testName: string;
  notes?: string;
  fee?: number;
  status?: 'Ordered' | 'Sample Collected' | 'Report Ready' | 'Reviewed';
}

export interface Visit {
  _id: string;
  patientId: Patient | string;
  doctorId: User | string;
  visitDate: string;
  visitType: 'FirstVisit' | 'FollowUp';
  queueNumber?: number;
  status: 'Waiting' | 'InProgress' | 'Completed';
  chiefComplaint?: string;
  diagnosis?: string;
  clinicalNotes?: string;
  hairDensity?: number;
  alopeciaStage?: string;
  staging?: { scale: string; stage: string };
  dlqiScore?: number;
  scalpHealth?: {
    dandruff?: 'None' | 'Mild' | 'Moderate' | 'Severe';
    erythema?: 'Absent' | 'Perifollicular' | 'Diffuse';
    pullTest?: 'Negative (<6 hairs)' | 'Positive (≥6 hairs)';
    sebum?: 'Dry' | 'Normal' | 'Oily';
  };
  scalpChecklist?: {
    pullTest?: string;
    sebum?: string;
    erythema?: string;
  };
  followUpWeeks?: number;
  weightKg?: number;
  heightCm?: number;
  scalpImages: string[];
  prescriptions: PrescriptionItem[];
  procedures: Procedure[];
  labTests?: LabTestItem[];
  consultFee: number;
  registrationFee?: number;
  feeStatus?: 'Pending' | 'Paid';
  consultationWorkflow?: 'fully_app' | 'prescription_booklet';
  bookletDispensed?: boolean;
  visitCount?: number;
  createdAt: string;
}

export interface Appointment {
  _id: string;
  patientId: Patient | string;
  doctorId: User | string;
  scheduledAt: string;
  endTime?: string;
  mode: 'Offline' | 'Online';
  type: 'Consult' | 'Surgery';
  status: 'Scheduled' | 'Waiting' | 'InProgress' | 'Completed' | 'Cancelled' | 'NoShow' | 'Postponed';
  bookedBy: string;
  bookedByRole: 'Staff' | 'Patient';
  notes?: string;
  cancellationReason?: string;
  rescheduleReason?: string;
  postponedReason?: string;
  postponedWithoutDate?: boolean;
  lastModifiedByRole?: string;
  createdAt: string;
}

export interface Batch {
  _id: string;
  batchNumber: string;
  quantity: number;
  expiryDate: string;
  purchasePrice: number;
  addedAt: string;
}

export type MedicineCategory =
  | 'Serum'
  | 'Tablet'
  | 'Capsule'
  | 'Shampoo'
  | 'Lotion'
  | 'Oil'
  | 'Ointment'
  | 'Solution';

export interface Medicine {
  _id: string;
  name: string;
  genericName?: string;
  description?: string;
  category: MedicineCategory;
  manufacturer?: string;
  imageUrl?: string;
  sellingPrice: number;
  costPrice?: number;
  reorderLevel: number;
  unit: string;
  batches: Batch[];
  totalStock: number;
  isActive: boolean;
}

export interface InvoiceLineItem {
  itemType: 'Consultation' | 'Procedure' | 'Medicine' | 'Lab Test';
  description: string;
  quantity: number;
  unitPrice: number;
  gstRate: number;
  gstAmount: number;
  total: number;
}

export interface Payment {
  _id?: string;
  amount: number;
  mode: 'Cash' | 'UPI' | 'Card' | 'BankTransfer' | 'Razorpay';
  reference?: string;
  paidAt: string;
}

export interface Invoice {
  _id: string;
  invoiceNumber: string;
  patientId: Patient | string;
  visitId?: string;
  lineItems: InvoiceLineItem[];
  subtotal: number;
  totalGst: number;
  grandTotal: number;
  payments: Payment[];
  amountPaid: number;
  status: 'Unpaid' | 'Partially Paid' | 'Paid';
  createdBy: User | string;
  createdAt: string;
}

export interface GstRule {
  _id?: string;
  itemType: string;
  gstRate: number;
  updatedAt: string;
}

export interface ClinicSettings {
  clinicName: string;
  address?: string;
  phone?: string;
  email?: string;
  gstNumber?: string;
  registrationFee?: number;
  gstRules: GstRule[];
  workingHours?: { start: string; end: string };
  appointmentDuration: number;
}
