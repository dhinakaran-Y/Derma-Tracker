'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AppShell } from '../../components/AppShell';
import { KpiCard } from '../../components/KpiCard';
import { Panel } from '../../components/Panel';
import { Badge } from '../../components/Badge';
import { DataTable, Column } from '../../components/DataTable';
import { RockerToggle } from '../../components/RockerToggle';
import { api } from '../../lib/api';
import { getSocket } from '../../lib/socket';
import { Visit, Patient, User, Appointment, Medicine, Invoice } from '../../types';
import { toast } from 'sonner';
import {
  LayoutDashboard,
  UserCheck,
  Calendar,
  CreditCard,
  Pill,
  Search,
  Plus,
  ArrowRight,
  Clock,
  CheckCircle,
  Receipt,
  UserPlus,
  Loader2,
  Filter,
  ArrowUpDown,
  X,
  Video,
  Edit2,
  AlertTriangle,
  GripVertical,
  FileText,
  QrCode,
  Zap,
  Settings2,
  Save,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import InvoicePDFModal from '../../components/InvoicePDFModal';
import { StaticQRModal } from '../../components/StaticQRModal';
import { DynamicQRModal } from '../../components/DynamicQRModal';
import { CounterQRModal } from '../../components/CounterQRModal';
import QRCode from 'react-qr-code';

interface PaymentSettingsState {
  staticQrEnabled: boolean;
  staticQrVpa: string;
  staticQrDisplayName: string;
  dynamicQrEnabled: boolean;
}

export default function ReceptionistPage() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [queue, setQueue] = useState<Visit[]>([]);
  const [doctors, setDoctors] = useState<User[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  // Payment Settings State
  const [paymentCfg, setPaymentCfg] = useState<PaymentSettingsState>({
    staticQrEnabled: false,
    staticQrVpa: '',
    staticQrDisplayName: 'DermaTrack Clinic',
    dynamicQrEnabled: false,
  });
  const [isSavingPayment, setIsSavingPayment] = useState(false);
  const [isTestMode, setIsTestMode] = useState(true);

  // Check-in State
  const [checkinType, setCheckinType] = useState<'returning' | 'new'>('returning');
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [patientSearch, setPatientSearch] = useState('');
  const [feeDetection, setFeeDetection] = useState<any>(null);

  // Returning Patient Check-in Vitals State
  const [checkinWeight, setCheckinWeight] = useState('');
  const [checkinHeight, setCheckinHeight] = useState('');
  const [checkinLastHeight, setCheckinLastHeight] = useState('');

  // New Patient Form State
  const [newPatient, setNewPatient] = useState({
    name: '',
    phone: '',
    email: '',
    location: '',
    dateOfBirth: '',
    gender: 'Male' as 'Male' | 'Female' | 'Other',
    maritalStatus: '' as '' | 'Single' | 'Married' | 'Divorced' | 'Widowed',
    weightKg: '',
    heightCm: '',
    bloodGroup: '' as '' | 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-' | 'Unknown',
    allergies: '',
    medicalHistoryNotes: '',
  });
  const [isRegistering, setIsRegistering] = useState(false);
  const [patientPhoneError, setPatientPhoneError] = useState<string | null>(null);
  const [apptPhoneError, setApptPhoneError] = useState<string | null>(null);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [togglingVisitId, setTogglingVisitId] = useState<string | null>(null);
  const [confirmFeeVisit, setConfirmFeeVisit] = useState<Visit | null>(null);

  // Check-in & Fee Modal Payment Options State
  const [checkinFeeStatus, setCheckinFeeStatus] = useState<'Pending' | 'Paid'>('Pending');
  const [checkinPaymentMode, setCheckinPaymentMode] = useState<'Cash' | 'UPI' | 'Card'>('Cash');
  const [newPatientFeeStatus, setNewPatientFeeStatus] = useState<'Pending' | 'Paid'>('Pending');
  const [newPatientPaymentMode, setNewPatientPaymentMode] = useState<'Cash' | 'UPI' | 'Card'>('Cash');
  const [modalPaymentMode, setModalPaymentMode] = useState<'Cash' | 'UPI' | 'Static QR' | 'Dynamic QR' | 'Card'>('Cash');

  // Dedicated Static & Dynamic QR Modals State
  const [staticQRVisit, setStaticQRVisit] = useState<Visit | null>(null);
  const [staticQRAmount, setStaticQRAmount] = useState<number>(500);
  const [isConfirmingStatic, setIsConfirmingStatic] = useState(false);

  const [dynamicQRVisit, setDynamicQRVisit] = useState<Visit | null>(null);
  const [dynamicOrderData, setDynamicOrderData] = useState<{
    recordId: string;
    orderId: string;
    amount: number;
    qrValue: string;
    keyId: string;
    isTestMode: boolean;
  } | null>(null);
  const [isCreatingDynamicOrder, setIsCreatingDynamicOrder] = useState(false);

  // In-modal fee payment helper state for confirmFeeVisit
  const [feeModalStaticNotes, setFeeModalStaticNotes] = useState('');
  const [feeModalDynamicOrder, setFeeModalDynamicOrder] = useState<{
    recordId: string;
    orderId: string;
    amount: number;
    qrValue: string;
    keyId: string;
    isTestMode: boolean;
  } | null>(null);
  const [isCreatingFeeModalDynamicOrder, setIsCreatingFeeModalDynamicOrder] = useState(false);
  const [feeModalDynamicStatus, setFeeModalDynamicStatus] = useState<'waiting' | 'confirmed' | 'failed'>('waiting');

  // Clinic Counter Static QR Standee Modal
  const [isCounterStaticQrOpen, setIsCounterStaticQrOpen] = useState(false);
  // Register New Patient UPI Static QR Popup Modal
  const [showRegPatientUpiModal, setShowRegPatientUpiModal] = useState(false);
  const [showCheckinUpiModal, setShowCheckinUpiModal] = useState(false);
  const [showBillingUpiModal, setShowBillingUpiModal] = useState(false);

  // Billing Filter & Sort State
  const [invoiceSort, setInvoiceSort] = useState<'recent' | 'oldest'>('recent');
  const [invoiceFilter, setInvoiceFilter] = useState<
    'all' | 'today' | 'yesterday' | 'last_week' | 'last_month' | 'specific_date' | 'custom_duration'
  >('all');
  const [specificDate, setSpecificDate] = useState<string>(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });
  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });
  const [customEndDate, setCustomEndDate] = useState<string>(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });

  // Payment Modal State
  const [activePaymentInvoice, setActivePaymentInvoice] = useState<Invoice | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMode, setPaymentMode] = useState<'Cash' | 'UPI' | 'Card' | 'BankTransfer' | 'Razorpay'>('Cash');
  const [paymentRef, setPaymentRef] = useState('');

  // Invoice PDF & Generation State
  const [pdfInvoice, setPdfInvoice] = useState<Invoice | null>(null);
  const [isCreateInvoiceOpen, setIsCreateInvoiceOpen] = useState(false);
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState<'all' | 'Paid' | 'Unpaid' | 'Partially Paid'>('all');
  const [newInvPatientId, setNewInvPatientId] = useState('');
  const [newInvPatientSearch, setNewInvPatientSearch] = useState('');
  const [newInvItems, setNewInvItems] = useState<
    Array<{
      itemType: 'Consultation' | 'Procedure' | 'Medicine' | 'Lab Test';
      description: string;
      quantity: number;
      unitPrice: number;
      gstRate: number;
    }>
  >([
    { itemType: 'Consultation', description: 'Specialist Dermatology Consultation', quantity: 1, unitPrice: 500, gstRate: 18 },
  ]);
  const [newInvPayNow, setNewInvPayNow] = useState(false);
  const [newInvPayMode, setNewInvPayMode] = useState<'Cash' | 'UPI' | 'Card' | 'BankTransfer' | 'Razorpay'>('Cash');
  const [newInvPayRef, setNewInvPayRef] = useState('');
  const [isSubmittingInvoice, setIsSubmittingInvoice] = useState(false);
  const [newInvPatientsList, setNewInvPatientsList] = useState<Patient[]>([]);
  const [newInvSelectedPatient, setNewInvSelectedPatient] = useState<Patient | null>(null);

  // Advance Appointment Booking Modal State
  const [showBookApptModal, setShowBookApptModal] = useState(false);
  const [apptPatientMode, setApptPatientMode] = useState<'existing' | 'new'>('existing');
  const [apptPatientSearch, setApptPatientSearch] = useState('');
  const [apptPatientsList, setApptPatientsList] = useState<Patient[]>([]);
  const [apptSelectedPatient, setApptSelectedPatient] = useState<Patient | null>(null);
  const [apptNewName, setApptNewName] = useState('');
  const [apptNewPhone, setApptNewPhone] = useState('');
  const [apptNewGender, setApptNewGender] = useState<'Male' | 'Female' | 'Other'>('Male');
  const [apptNewEmail, setApptNewEmail] = useState('');
  const [apptDoctorId, setApptDoctorId] = useState('');
  const [apptDate, setApptDate] = useState<string>(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });
  const [apptSlot, setApptSlot] = useState('10:00');
  const [apptBookedSlots, setApptBookedSlots] = useState<string[]>([]);
  const [apptAvailableSlots, setApptAvailableSlots] = useState<string[]>([]);
  const [apptMode, setApptMode] = useState<'Offline' | 'Online'>('Offline');
  const [apptType, setApptType] = useState<'Consult' | 'Surgery'>('Consult');
  const [apptNotes, setApptNotes] = useState('');
  const [isSubmittingAppt, setIsSubmittingAppt] = useState(false);
  const [checkingInApptId, setCheckingInApptId] = useState<string | null>(null);
  const [cancellingApptId, setCancellingApptId] = useState<string | null>(null);
  const [cancelQueueVisit, setCancelQueueVisit] = useState<Visit | null>(null);
  const [isCancellingQueueVisit, setIsCancellingQueueVisit] = useState(false);

  // Edit Appointment Modal State
  const [editingAppt, setEditingAppt] = useState<Appointment | null>(null);
  const [editDoctorId, setEditDoctorId] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editSlot, setEditSlot] = useState('');
  const [editBookedSlots, setEditBookedSlots] = useState<string[]>([]);
  const [editAvailableSlots, setEditAvailableSlots] = useState<string[]>([]);
  const [editMode, setEditMode] = useState<'Offline' | 'Online'>('Offline');
  const [editType, setEditType] = useState<'Consult' | 'Surgery'>('Consult');
  const [editNotes, setEditNotes] = useState('');
  const [isUpdatingAppt, setIsUpdatingAppt] = useState(false);

  // Edit Queue Visit State
  const [editingQueueVisit, setEditingQueueVisit] = useState<Visit | null>(null);
  const [editQueueDoctorId, setEditQueueDoctorId] = useState('');
  const [editQueueNumber, setEditQueueNumber] = useState<number>(1);
  const [isUpdatingQueueVisit, setIsUpdatingQueueVisit] = useState(false);

  // Fetch initial data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [qRes, docRes, apptRes, invRes, payRes] = await Promise.all([
        api.get('/receptionist/queue'),
        api.get('/receptionist/doctors'),
        api.get('/appointments?limit=100'),
        api.get('/billing/invoices?limit=100'),
        api.get('/payment/settings'),
      ]);
      setQueue(qRes.data.data || []);
      setDoctors(docRes.data.data || []);
      setAppointments(apptRes.data.data || []);
      setInvoices(invRes.data.data || []);
      if (payRes.data.data) {
        setPaymentCfg({
          staticQrEnabled: payRes.data.data.staticQrEnabled ?? false,
          staticQrVpa: payRes.data.data.staticQrVpa ?? '',
          staticQrDisplayName: payRes.data.data.staticQrDisplayName ?? 'DermaTrack Clinic',
          dynamicQrEnabled: payRes.data.data.dynamicQrEnabled ?? false,
        });
        setIsTestMode(payRes.data.data.isTestMode ?? true);
      }

      if (docRes.data.data?.length > 0 && !selectedDoctorId) {
        setSelectedDoctorId(docRes.data.data[0]._id);
      }
    } catch (err: any) {
      toast.error('Failed to load clinic data');
    } finally {
      setLoading(false);
    }
  }, [selectedDoctorId]);

  useEffect(() => {
    fetchData();

    // Socket real-time queue & payment subscription
    const socket = getSocket();
    socket.on('queue:updated', () => {
      fetchData();
    });
    socket.on('billing:updated', () => {
      fetchData();
    });
    socket.on('doctor:duty-changed', () => {
      api.get('/receptionist/doctors').then((res) => setDoctors(res.data.data || []));
    });

    const handlePaymentConfirmed = (payload: any) => {
      fetchData();
      if (feeModalDynamicOrder && payload?.orderId === feeModalDynamicOrder.orderId) {
        setFeeModalDynamicStatus('confirmed');
        toast.success(`Dynamic QR payment verified via Razorpay!`);
        setTimeout(() => {
          setConfirmFeeVisit(null);
          setFeeModalDynamicOrder(null);
          setFeeModalDynamicStatus('waiting');
          fetchData();
        }, 1500);
      }
    };
    socket.on('payment:confirmed', handlePaymentConfirmed);

    return () => {
      socket.off('queue:updated');
      socket.off('billing:updated');
      socket.off('doctor:duty-changed');
      socket.off('payment:confirmed', handlePaymentConfirmed);
    };
  }, [fetchData, feeModalDynamicOrder]);

  // Handle Search for Patients in Check-In
  const handleSearchPatients = async (query: string) => {
    setPatientSearch(query);
    if (query.length >= 2) {
      try {
        const res = await api.get(`/receptionist/patients?search=${encodeURIComponent(query)}`);
        setPatients(res.data.data || []);
      } catch {}
    } else {
      setPatients([]);
    }
  };

  // Handle Search for Patients in Appointment Booking Modal
  const handleSearchApptPatients = async (query: string) => {
    setApptPatientSearch(query);
    if (query.trim().length >= 2) {
      try {
        const res = await api.get(`/receptionist/patients?search=${encodeURIComponent(query.trim())}`);
        setApptPatientsList(res.data.data || []);
      } catch {
        setApptPatientsList([]);
      }
    } else {
      setApptPatientsList([]);
    }
  };

  // Handle Search for Patients in New Custom Invoice Modal
  const handleSearchNewInvPatients = async (query: string) => {
    setNewInvPatientSearch(query);
    if (query.trim().length >= 2) {
      try {
        const res = await api.get(`/receptionist/patients?search=${encodeURIComponent(query.trim())}`);
        setNewInvPatientsList(res.data.data || []);
      } catch {
        setNewInvPatientsList([]);
      }
    } else {
      setNewInvPatientsList([]);
    }
  };

  // Fetch available slots when booking modal is open and doctor/date change
  useEffect(() => {
    if (showBookApptModal && apptDoctorId && apptDate) {
      api
        .get(`/appointments/slots/${apptDoctorId}/${apptDate}`)
        .then((res) => {
          const booked = (res.data.data?.bookedSlots || []).map((s: string) => {
            const dt = new Date(s);
            const hh = String(dt.getHours()).padStart(2, '0');
            const mm = String(dt.getMinutes()).padStart(2, '0');
            return `${hh}:${mm}`;
          });
          setApptBookedSlots(booked);

          const standardSlots = [
            '09:30', '10:00', '10:30', '11:00', '11:30', '12:00',
            '12:30', '14:00', '14:30', '15:00', '15:30', '16:00',
            '16:30', '17:00',
          ];
          const open = standardSlots.filter((slot) => !booked.includes(slot));
          setApptAvailableSlots(open);
          if (open.length > 0 && (!apptSlot || booked.includes(apptSlot))) {
            setApptSlot(open[0]);
          }
        })
        .catch(() => {
          setApptBookedSlots([]);
          setApptAvailableSlots([]);
        });
    }
  }, [showBookApptModal, apptDoctorId, apptDate, apptSlot]);

  // Fetch available slots when editing modal is open and doctor/date change
  useEffect(() => {
    if (editingAppt && editDoctorId && editDate) {
      api
        .get(`/appointments/slots/${editDoctorId}/${editDate}?excludeApptId=${editingAppt._id}`)
        .then((res) => {
          const booked = (res.data.data?.bookedSlots || []).map((s: string) => {
            const dt = new Date(s);
            const hh = String(dt.getHours()).padStart(2, '0');
            const mm = String(dt.getMinutes()).padStart(2, '0');
            return `${hh}:${mm}`;
          });
          setEditBookedSlots(booked);

          const standardSlots = [
            '09:30', '10:00', '10:30', '11:00', '11:30', '12:00',
            '12:30', '14:00', '14:30', '15:00', '15:30', '16:00',
            '16:30', '17:00',
          ];
          const open = standardSlots.filter((slot) => !booked.includes(slot));
          setEditAvailableSlots(open);
        })
        .catch(() => {
          setEditBookedSlots([]);
          setEditAvailableSlots([]);
        });
    }
  }, [editingAppt, editDoctorId, editDate]);

  // Trigger fee detection when patient & doctor selected
  useEffect(() => {
    if (selectedPatientId && selectedDoctorId) {
      api
        .get(`/receptionist/fee-detection/${selectedPatientId}/${selectedDoctorId}`)
        .then((res) => setFeeDetection(res.data.data))
        .catch(() => setFeeDetection(null));
    } else {
      setFeeDetection(null);
    }
  }, [selectedPatientId, selectedDoctorId]);

  // Check if selected patient is already in active queue
  const activeQueueVisitForSelected = useMemo(() => {
    if (!selectedPatientId) return null;
    return queue.find(
      (v) =>
        (((v.patientId as Patient)?._id || v.patientId) === selectedPatientId) &&
        ['Waiting', 'InProgress'].includes(v.status)
    );
  }, [selectedPatientId, queue]);

  // Check-in submission
  const handleCheckin = async () => {
    if (!selectedPatientId || !selectedDoctorId) {
      toast.error('Please select both patient and doctor');
      return;
    }
    if (!checkinWeight || isNaN(Number(checkinWeight)) || Number(checkinWeight) <= 0) {
      toast.error('Please enter the patient’s weight for this visit');
      return;
    }
    if (activeQueueVisitForSelected) {
      toast.error(
        `Patient is already in the active queue (Queue #${activeQueueVisitForSelected.queueNumber})!`
      );
      return;
    }
    setIsCheckingIn(true);
    try {
      await api.post('/receptionist/check-in', {
        patientId: selectedPatientId,
        doctorId: selectedDoctorId,
        feeStatus: checkinFeeStatus,
        paymentMode: checkinFeeStatus === 'Paid' ? checkinPaymentMode : undefined,
        weightKg: Number(checkinWeight),
        heightCm: checkinHeight ? Number(checkinHeight) : undefined,
      });
      toast.success(
        checkinFeeStatus === 'Paid'
          ? `Patient checked in to queue (Fee Paid via ${checkinPaymentMode})`
          : 'Patient checked in to queue (Fee Pending)'
      );
      setSelectedPatientId('');
      setPatientSearch('');
      setCheckinWeight('');
      setCheckinHeight('');
      setCheckinLastHeight('');
      setFeeDetection(null);
      setCheckinFeeStatus('Pending');
      setCheckinPaymentMode('Cash');
      fetchData();
      setActiveTab('dashboard');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Check-in failed');
    } finally {
      setIsCheckingIn(false);
    }
  };

  // Register New Patient and Check-in
  const handleRegisterAndCheckin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPatient.name || !newPatient.phone || !selectedDoctorId) {
      toast.error('Please fill name, phone, and select doctor');
      return;
    }
    if (!newPatient.weightKg || isNaN(Number(newPatient.weightKg)) || Number(newPatient.weightKg) <= 0) {
      toast.error('Please enter patient weight (kg)');
      return;
    }
    if (!newPatient.heightCm || isNaN(Number(newPatient.heightCm)) || Number(newPatient.heightCm) <= 0) {
      toast.error('Please enter patient height (cm)');
      return;
    }
    setPatientPhoneError(null);
    if (newPatient.phone.trim().length < 10) {
      setPatientPhoneError('Phone number must be at least 10 digits');
      toast.error('Phone number must be at least 10 digits');
      return;
    }
    setIsRegistering(true);
    try {
      const payload: any = {
        name: newPatient.name.trim(),
        phone: newPatient.phone.trim(),
        gender: newPatient.gender,
      };
      if (newPatient.email?.trim()) payload.email = newPatient.email.trim();
      if (newPatient.location?.trim()) payload.location = newPatient.location.trim();
      if (newPatient.dateOfBirth) payload.dateOfBirth = newPatient.dateOfBirth;
      if (newPatient.maritalStatus) payload.maritalStatus = newPatient.maritalStatus;
      if (newPatient.heightCm) payload.heightCm = Number(newPatient.heightCm);
      if (newPatient.bloodGroup) payload.bloodGroup = newPatient.bloodGroup;
      if (newPatient.allergies?.trim()) payload.allergies = newPatient.allergies.trim();
      if (newPatient.medicalHistoryNotes?.trim()) payload.medicalHistoryNotes = newPatient.medicalHistoryNotes.trim();

      const pRes = await api.post('/receptionist/patients', payload);
      const createdPatient = pRes.data.data;

      await api.post('/receptionist/check-in', {
        patientId: createdPatient._id,
        doctorId: selectedDoctorId,
        feeStatus: newPatientFeeStatus,
        paymentMode: newPatientFeeStatus === 'Paid' ? newPatientPaymentMode : undefined,
        weightKg: Number(newPatient.weightKg),
        heightCm: Number(newPatient.heightCm),
      });

      toast.success(
        newPatientFeeStatus === 'Paid'
          ? `Patient ${createdPatient.name} registered & checked in (Fee Paid via ${newPatientPaymentMode})!`
          : `Patient ${createdPatient.name} registered & checked in (Fee Pending)!`
      );
      setNewPatient({
        name: '',
        phone: '',
        email: '',
        location: '',
        dateOfBirth: '',
        gender: 'Male',
        maritalStatus: '',
        weightKg: '',
        heightCm: '',
        bloodGroup: '',
        allergies: '',
        medicalHistoryNotes: '',
      });
      setPatientPhoneError(null);

      setNewPatientFeeStatus('Pending');
      setNewPatientPaymentMode('Cash');
      fetchData();
      setActiveTab('dashboard');
    } catch (err: any) {
      const isDuplicatePhone =
        err.response?.status === 409 ||
        err.response?.data?.code === 'DUPLICATE_PHONE' ||
        err.response?.data?.field === 'phone' ||
        err.response?.data?.error?.toLowerCase().includes('phone');

      const errMsg = isDuplicatePhone
        ? (err.response?.data?.error || 'A patient with this phone number is already registered')
        : (err.response?.data?.details?.[0]?.message || err.response?.data?.error || 'Registration failed');

      if (isDuplicatePhone) {
        setPatientPhoneError(errMsg);
      }
      toast.error(errMsg);
    } finally {
      setIsRegistering(false);
    }
  };

  // Process In-Clinic Payment
  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePaymentInvoice || paymentAmount <= 0) {
      toast.error('Invalid payment amount');
      return;
    }
    try {
      if (paymentMode === 'Razorpay') {
        const orderRes = await api.post(`/billing/invoices/${activePaymentInvoice._id}/razorpay/order`);
        const { orderId, amount, currency, keyId, clinicName } = orderRes.data.data;

        if (typeof window !== 'undefined' && (window as any).Razorpay) {
          const options = {
            key: keyId,
            amount,
            currency,
            name: clinicName || 'DermaTrack Clinic',
            description: `Invoice Settle #${activePaymentInvoice.invoiceNumber}`,
            order_id: orderId,
            theme: { color: '#c98a4b' },
            handler: async (response: any) => {
              await api.post(`/billing/invoices/${activePaymentInvoice._id}/razorpay/verify`, {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                amount: paymentAmount,
              });
              toast.success('Razorpay payment verified & captured!');
              setActivePaymentInvoice(null);
              fetchData();
            },
          };
          const rzp = new (window as any).Razorpay(options);
          rzp.open();
          return;
        } else {
          // Sandbox fallback
          const mockPaymentId = `pay_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
          await api.post(`/billing/invoices/${activePaymentInvoice._id}/razorpay/verify`, {
            razorpay_order_id: orderId,
            razorpay_payment_id: mockPaymentId,
            razorpay_signature: 'sandbox_verified_signature',
            amount: paymentAmount,
          });
          toast.success(`Razorpay Payment Captured successfully! (Ref: ${mockPaymentId})`);
          setActivePaymentInvoice(null);
          fetchData();
          return;
        }
      }

      await api.post(`/billing/invoices/${activePaymentInvoice._id}/payments`, {
        amount: paymentAmount,
        mode: paymentMode,
        reference: paymentRef,
      });
      toast.success('Payment recorded successfully');
      setActivePaymentInvoice(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.response?.data?.message || 'Failed to record payment');
    }
  };

  // Generate Custom Invoice
  const handleCreateCustomInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInvPatientId) {
      toast.error('Please select a patient for this invoice');
      return;
    }
    if (newInvItems.length === 0) {
      toast.error('Please add at least one line item');
      return;
    }

    setIsSubmittingInvoice(true);
    try {
      const subtotal = newInvItems.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
      const totalGst = newInvItems.reduce((s, i) => s + (i.quantity * i.unitPrice * (i.gstRate / 100)), 0);
      const grandTotal = Math.round((subtotal + totalGst) * 100) / 100;

      const payload: any = {
        patientId: newInvPatientId,
        lineItems: newInvItems,
      };

      if (newInvPayNow) {
        payload.initialPayment = {
          amount: grandTotal,
          mode: newInvPayMode,
          reference: newInvPayRef || undefined,
        };
      }

      const res = await api.post('/billing/invoices', payload);
      toast.success(`Invoice #${res.data.data.invoiceNumber} created successfully!`);
      setIsCreateInvoiceOpen(false);
      setNewInvPatientId('');
      setNewInvItems([
        { itemType: 'Consultation', description: 'Specialist Dermatology Consultation', quantity: 1, unitPrice: 500, gstRate: 18 }
      ]);
      fetchData();
      setPdfInvoice(res.data.data);
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.response?.data?.message || 'Failed to create invoice');
    } finally {
      setIsSubmittingInvoice(false);
    }
  };

  // Book Advance Calendar Appointment
  const handleBookAdvanceAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apptDoctorId || !apptDate || !apptSlot) {
      toast.error('Please select doctor, date and time slot');
      return;
    }

    let targetPatientId = '';
    let targetPatientName = '';

    if (apptPatientMode === 'existing') {
      if (!apptSelectedPatient) {
        toast.error('Please search and select an existing patient');
        return;
      }
      targetPatientId = apptSelectedPatient._id;
      targetPatientName = apptSelectedPatient.name;
    } else {
      if (!apptNewName.trim() || !apptNewPhone.trim()) {
        toast.error('Please enter patient name and phone number');
        return;
      }
      setApptPhoneError(null);
      if (apptNewPhone.trim().length < 10) {
        setApptPhoneError('Phone number must be at least 10 digits');
        toast.error('Phone number must be at least 10 digits');
        return;
      }
      setIsSubmittingAppt(true);
      try {
        const pRes = await api.post('/receptionist/patients', {
          name: apptNewName.trim(),
          phone: apptNewPhone.trim(),
          gender: apptNewGender,
          email: apptNewEmail.trim() || undefined,
        });
        targetPatientId = pRes.data.data._id;
        targetPatientName = pRes.data.data.name;
        setApptPhoneError(null);
      } catch (err: any) {
        setIsSubmittingAppt(false);
        const isDuplicatePhone =
          err.response?.status === 409 ||
          err.response?.data?.code === 'DUPLICATE_PHONE' ||
          err.response?.data?.field === 'phone' ||
          err.response?.data?.error?.toLowerCase().includes('phone');

        const msg = isDuplicatePhone
          ? (err.response?.data?.error || 'A patient with this phone number is already registered')
          : (err.response?.data?.details?.[0]?.message || err.response?.data?.error || 'Failed to register patient');

        if (isDuplicatePhone) {
          setApptPhoneError(msg);
        }
        toast.error(msg);
        return;
      }
    }

    setIsSubmittingAppt(true);
    try {
      const [hours, minutes] = apptSlot.split(':');
      const [y, m, d] = apptDate.split('-').map(Number);
      const scheduledDate = new Date(y, m - 1, d, parseInt(hours, 10), parseInt(minutes, 10), 0, 0);

      await api.post('/appointments', {
        patientId: targetPatientId,
        doctorId: apptDoctorId,
        scheduledAt: scheduledDate.toISOString(),
        mode: apptMode,
        type: apptType,
        notes: apptNotes.trim() || undefined,
      });

      toast.success(`Appointment scheduled for ${targetPatientName}!`);
      setShowBookApptModal(false);
      setApptSelectedPatient(null);
      setApptPatientSearch('');
      setApptPatientsList([]);
      setApptNewName('');
      setApptNewPhone('');
      setApptNewEmail('');
      setApptNotes('');
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to schedule appointment');
    } finally {
      setIsSubmittingAppt(false);
    }
  };

  // Appointment Check-in to Live Queue
  const handleCheckinAppointment = async (appt: Appointment) => {
    setCheckingInApptId(appt._id);
    try {
      const pId = typeof appt.patientId === 'string' ? appt.patientId : appt.patientId._id;
      const dId = typeof appt.doctorId === 'string' ? appt.doctorId : appt.doctorId._id;
      const pName = (appt.patientId as Patient)?.name || 'Patient';

      await api.post('/receptionist/check-in', {
        patientId: pId,
        doctorId: dId,
      });
      await api.patch(`/appointments/${appt._id}/status`, { status: 'Waiting' });
      toast.success(`${pName} checked into live queue!`);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Check-in failed');
    } finally {
      setCheckingInApptId(null);
    }
  };

  // Cancel Appointment
  const handleCancelAppointment = async (apptId: string) => {
    if (!confirm('Are you sure you want to cancel this scheduled appointment?')) return;
    setCancellingApptId(apptId);
    try {
      await api.patch(`/appointments/${apptId}/status`, { status: 'Cancelled' });
      toast.success('Appointment cancelled successfully');
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to cancel appointment');
    } finally {
      setCancellingApptId(null);
    }
  };

  // Open Edit Appointment Modal
  const handleOpenEditApptModal = (appt: Appointment) => {
    setEditingAppt(appt);
    const dId = typeof appt.doctorId === 'string' ? appt.doctorId : (appt.doctorId as User)?._id;
    setEditDoctorId(dId || (doctors[0]?._id || ''));

    const dt = new Date(appt.scheduledAt);
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const d = String(dt.getDate()).padStart(2, '0');
    setEditDate(`${y}-${m}-${d}`);

    const hh = String(dt.getHours()).padStart(2, '0');
    const mm = String(dt.getMinutes()).padStart(2, '0');
    setEditSlot(`${hh}:${mm}`);

    setEditMode(appt.mode || 'Offline');
    setEditType(appt.type || 'Consult');
    setEditNotes(appt.notes || '');
  };

  // Submit Updated Appointment
  const handleUpdateAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAppt || !editDoctorId || !editDate || !editSlot) {
      toast.error('Please select doctor, date and time slot');
      return;
    }

    setIsUpdatingAppt(true);
    try {
      const [hours, minutes] = editSlot.split(':');
      const [y, m, d] = editDate.split('-').map(Number);
      const scheduledDate = new Date(y, m - 1, d, parseInt(hours, 10), parseInt(minutes, 10), 0, 0);

      await api.patch(`/appointments/${editingAppt._id}`, {
        doctorId: editDoctorId,
        scheduledAt: scheduledDate.toISOString(),
        mode: editMode,
        type: editType,
        notes: editNotes.trim() || undefined,
      });

      const pName = (editingAppt.patientId as Patient)?.name || 'Patient';
      toast.success(`Appointment updated successfully for ${pName}!`);
      setEditingAppt(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to update appointment');
    } finally {
      setIsUpdatingAppt(false);
    }
  };

  // Open Edit Queue Visit Modal
  const handleOpenEditQueueModal = (v: Visit) => {
    setEditingQueueVisit(v);
    const dId = typeof v.doctorId === 'string' ? v.doctorId : (v.doctorId as User)?._id;
    setEditQueueDoctorId(dId || (doctors[0]?._id || ''));
    setEditQueueNumber(v.queueNumber || 1);
  };

  // Update Queue Visit (Doctor & Queue Number)
  const handleUpdateQueueVisit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingQueueVisit) return;

    setIsUpdatingQueueVisit(true);
    try {
      await api.patch(`/receptionist/queue/${editingQueueVisit._id}`, {
        doctorId: editQueueDoctorId,
        queueNumber: Number(editQueueNumber),
      });

      const pName = (editingQueueVisit.patientId as Patient)?.name || 'Patient';
      toast.success(`Queue visit updated for ${pName}!`);
      setEditingQueueVisit(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to update queue visit');
    } finally {
      setIsUpdatingQueueVisit(false);
    }
  };

  // Drag and Drop Queue Reorder Handler
  const handleReorderQueue = async (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return;

    const updated = [...queue];
    const [moved] = updated.splice(fromIndex, 1);
    if (!moved) return;
    updated.splice(toIndex, 0, moved);

    // Optimistically update queue numbers
    const reordered = updated.map((v, idx) => ({
      ...v,
      queueNumber: idx + 1,
    }));
    setQueue(reordered);

    try {
      const orderedIds = reordered.map((v) => v._id);
      await api.patch('/receptionist/queue/reorder', { orderedIds });
      const pName = (moved.patientId as Patient)?.name || 'Patient';
      toast.success(`Queue reordered: ${pName} moved to #${toIndex + 1}`);
    } catch (err: any) {
      toast.error('Failed to save queue reorder');
      fetchData();
    }
  };

  // Cancel Queue Visit & Return Fee
  const handleConfirmCancelQueueVisit = async () => {
    if (!cancelQueueVisit) return;
    setIsCancellingQueueVisit(true);
    try {
      const res = await api.post(`/receptionist/queue/${cancelQueueVisit._id}/cancel`);
      const refunded = res.data?.data?.refundedAmount || 0;
      const pName = (cancelQueueVisit.patientId as Patient)?.name || 'Patient';

      if (refunded > 0) {
        toast.success(`Visit cancelled for ${pName}. ₹${refunded} returned & invoice removed from billing.`);
      } else {
        toast.success(`Visit cancelled for ${pName} and removed from queue.`);
      }

      setCancelQueueVisit(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to cancel queue visit');
    } finally {
      setIsCancellingQueueVisit(false);
    }
  };

  // Toggle Visit Fee Status
  const handleToggleFeeStatus = async (
    visit: Visit,
    paymentMode: 'Cash' | 'UPI' | 'Card' | 'Static QR' | 'Dynamic QR' = 'Cash',
    notes?: string
  ) => {
    setTogglingVisitId(visit._id);
    const targetStatus = visit.feeStatus === 'Paid' ? 'Pending' : 'Paid';
    const mappedMode = paymentMode === 'Static QR' ? 'UPI' : paymentMode === 'Dynamic QR' ? 'UPI' : paymentMode;

    try {
      if (targetStatus === 'Paid' && (paymentMode === 'Static QR' || paymentMode === 'UPI')) {
        try {
          const totalFee =
            (visit.consultFee || 500) +
            (visit.visitType === 'FirstVisit' ? visit.registrationFee || 0 : 0);
          await api.post('/payment/manual-confirm', {
            amount: totalFee,
            visitId: visit._id,
            patientName: (visit.patientId as Patient)?.name,
            notes: notes || feeModalStaticNotes || 'Consultation fee via Static QR',
          });
        } catch {}
      }

      await api.patch(`/receptionist/queue/${visit._id}/fee-status`, {
        feeStatus: targetStatus,
        paymentMode: targetStatus === 'Paid' ? mappedMode : undefined,
      });
      const pName = (visit.patientId as Patient)?.name || 'Patient';
      toast.success(
        targetStatus === 'Paid'
          ? `Fee marked as Paid via ${paymentMode} for ${pName}!`
          : `Fee reverted to Pending for ${pName} (Invoice removed from billing)`
      );
      setConfirmFeeVisit(null);
      setModalPaymentMode('Cash');
      setFeeModalDynamicOrder(null);
      setFeeModalDynamicStatus('waiting');
      setFeeModalStaticNotes('');
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to update fee status');
    } finally {
      setTogglingVisitId(null);
    }
  };

  // ── Open Dedicated Static QR Modal ──
  const handleOpenStaticQR = (visit: Visit) => {
    const totalFee =
      (visit.consultFee || 500) +
      (visit.visitType === 'FirstVisit' ? visit.registrationFee || 0 : 0);
    setStaticQRAmount(totalFee > 0 ? totalFee : 500);
    setStaticQRVisit(visit);
  };

  const handleConfirmStaticQR = async (notes?: string) => {
    if (!staticQRVisit) return;
    try {
      setIsConfirmingStatic(true);
      await api.post('/payment/manual-confirm', {
        amount: staticQRAmount,
        visitId: staticQRVisit._id,
        patientName: (staticQRVisit.patientId as Patient)?.name,
        notes: notes || 'Doctor Consultation Fee via Static QR',
      });
      await api.patch(`/receptionist/queue/${staticQRVisit._id}/fee-status`, {
        feeStatus: 'Paid',
        paymentMode: 'UPI',
      });
      const pName = (staticQRVisit.patientId as Patient)?.name || 'Patient';
      toast.success(`₹${staticQRAmount} consultation fee marked as Paid via Static QR for ${pName}!`);
      setStaticQRVisit(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to record Static QR payment');
    } finally {
      setIsConfirmingStatic(false);
    }
  };

  // ── Open Dedicated Dynamic QR Modal ──
  const handleOpenDynamicQR = async (visit: Visit) => {
    const totalFee =
      (visit.consultFee || 500) +
      (visit.visitType === 'FirstVisit' ? visit.registrationFee || 0 : 0);
    const amount = totalFee > 0 ? totalFee : 500;
    try {
      setIsCreatingDynamicOrder(true);
      setDynamicQRVisit(visit);
      const res = await api.post('/payment/dynamic-order', {
        amount,
        visitId: visit._id,
        patientName: (visit.patientId as Patient)?.name,
        notes: 'Doctor Consultation Fee',
        source: 'Reception',
      });
      setDynamicOrderData(res.data.data);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to create Razorpay Dynamic QR');
      setDynamicQRVisit(null);
    } finally {
      setIsCreatingDynamicOrder(false);
    }
  };

  // ── In-modal Dynamic QR generator for confirmFeeVisit ──
  const handleGenerateFeeModalDynamicOrder = async (visit: Visit, amount: number) => {
    try {
      setIsCreatingFeeModalDynamicOrder(true);
      setFeeModalDynamicStatus('waiting');
      const res = await api.post('/payment/dynamic-order', {
        amount,
        visitId: visit._id,
        patientName: (visit.patientId as Patient)?.name,
        notes: 'Doctor Consultation Fee',
        source: 'Reception',
      });
      setFeeModalDynamicOrder(res.data.data);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to create Razorpay QR order');
      setFeeModalDynamicOrder(null);
    } finally {
      setIsCreatingFeeModalDynamicOrder(false);
    }
  };

  const navGroups = [
    {
      title: 'Reception',
      items: [
        { id: 'dashboard', label: 'Overview Queue', icon: LayoutDashboard, badge: queue.length },
        { id: 'checkin', label: 'Patient Check-In', icon: UserCheck },
        { id: 'appointments', label: 'Appointments', icon: Calendar, badge: appointments.length },
        { id: 'billing', label: 'Fee Collection', icon: CreditCard },
        { id: 'payment-settings', label: 'Payment Settings', icon: Settings2 },
      ],
    },
  ];

  // Table Columns
  const queueColumns: Column<Visit>[] = [
    {
      header: 'QUEUE #',
      accessor: (v) => (
        <div className="flex items-center gap-1.5 font-mono text-sm font-bold text-[var(--brass)]" title="Drag row or double-click to edit queue position">
          <GripVertical className="w-3.5 h-3.5 text-[var(--text-dim)]/50 hover:text-[var(--brass)] cursor-grab" />
          <span>#{v.queueNumber || '-'}</span>
        </div>
      ),
    },
    {
      header: 'PATIENT',
      accessor: (v) => {
        const p = v.patientId as Patient;
        return (
          <div>
            <span className="font-semibold block text-[var(--text)]">{p?.name || 'Unknown'}</span>
            <span className="font-mono text-xs text-[var(--text-dim)]">{p?.patientId || '-'} • {p?.phone || '-'}</span>
          </div>
        );
      },
    },
    {
      header: 'ASSIGNED DOCTOR',
      accessor: (v) => {
        const d = v.doctorId as User;
        return (
          <span className="text-xs font-medium text-[var(--text)]">
            {d?.fullName || 'Doctor'}
          </span>
        );
      },
    },
    {
      header: 'VISITED COUNT',
      accessor: (v) => (
        <Badge variant={(v.visitCount || (v.visitType === 'FirstVisit' ? 1 : 2)) === 1 ? 'brass' : 'neutral'}>
          {v.visitCount || (v.visitType === 'FirstVisit' ? 1 : 2)}
        </Badge>
      ),
    },
    {
      header: 'STATUS',
      accessor: (v) => (
        <Badge variant={v.status === 'InProgress' ? 'warn' : 'neutral'}>
          {v.status === 'InProgress' ? 'In Doctor Room' : 'Waiting in Lobby'}
        </Badge>
      ),
    },
    {
      header: 'FEES STATUS',
      accessor: (v) => {
        const totalFee = (v.consultFee || 500) + (v.visitType === 'FirstVisit' ? (v.registrationFee || 0) : 0);
        const isPaid = v.feeStatus === 'Paid';
        const isToggling = togglingVisitId === v._id;

        return (
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => {
                setFeeModalDynamicOrder(null);
                setFeeModalDynamicStatus('waiting');
                setFeeModalStaticNotes('');
                setModalPaymentMode('Cash');
                setConfirmFeeVisit(v);
              }}
              disabled={isToggling}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded text-xs font-mono font-medium transition-all border ${
                isPaid
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                  : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/20'
              } disabled:opacity-60 disabled:cursor-not-allowed`}
              title={`Click to change fee status (Currently: ${isPaid ? 'Paid' : 'Pending'})`}
            >
              {isToggling ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Updating...</span>
                </>
              ) : isPaid ? (
                <>
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Paid (₹{totalFee})</span>
                </>
              ) : (
                <>
                  <Clock className="w-3.5 h-3.5 text-amber-500" />
                  <span>Pending (₹{totalFee})</span>
                </>
              )}
            </button>

            {!isPaid && paymentCfg.dynamicQrEnabled && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenDynamicQR(v);
                }}
                disabled={isCreatingDynamicOrder}
                className="px-2 py-1 rounded text-xs font-mono font-bold flex items-center gap-1 bg-violet-600 hover:bg-violet-500 text-white shadow-xs transition-all cursor-pointer disabled:opacity-50"
                title="Generate Dynamic QR"
              >
                {isCreatingDynamicOrder && dynamicQRVisit?._id === v._id ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Zap className="w-3 h-3" />
                )}
                <span className="hidden sm:inline">Dyn QR</span>
              </button>
            )}
          </div>
        );
      },
    },
    {
      header: 'ACTION',
      accessor: (v) => {
        if (v.status === 'Waiting') {
          return (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleOpenEditQueueModal(v)}
                className="px-2 py-1 text-xs font-mono rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 transition-colors flex items-center gap-1"
                title="Edit assigned doctor or queue position"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Edit</span>
              </button>
              <button
                type="button"
                onClick={() => setCancelQueueVisit(v)}
                className="px-2 py-1 text-xs font-mono rounded text-rose-500 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-colors flex items-center gap-1"
                title="Cancel visit from active queue"
              >
                <X className="w-3.5 h-3.5" />
                <span>Cancel</span>
              </button>
            </div>
          );
        }
        return <span className="text-xs font-mono text-[var(--text-dim)]">—</span>;
      },
    },
  ];

  const appointmentColumns: Column<Appointment>[] = [
    {
      header: 'SCHEDULED TIME',
      accessor: (a) => {
        if (a.status === 'Postponed' && a.postponedWithoutDate) {
          return (
            <span className="font-mono text-xs text-amber-500 dark:text-amber-400 italic">
              Time to be scheduled
            </span>
          );
        }
        const isOutdated = a.status === 'Scheduled' && new Date(a.scheduledAt).getTime() < Date.now();
        return (
          <span className={`font-mono text-xs ${isOutdated ? 'text-rose-600 dark:text-rose-400 font-semibold' : 'text-[var(--text)]'}`}>
            {new Date(a.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} •{' '}
            {new Date(a.scheduledAt).toLocaleDateString()}
          </span>
        );
      },
    },
    {
      header: 'PATIENT',
      accessor: (a) => {
        const p = a.patientId as Patient;
        return (
          <div>
            <span className="font-semibold block text-xs">{p?.name || 'Patient'}</span>
            <span className="font-mono text-[11px] text-[var(--text-dim)]">{p?.phone || '-'}</span>
          </div>
        );
      },
    },
    {
      header: 'DOCTOR',
      accessor: (a) => (a.doctorId as User)?.fullName || 'Doctor',
    },
    {
      header: 'MODE',
      accessor: (a) => (
        <Badge variant={a.mode === 'Online' ? 'brass' : 'neutral'}>
          {a.mode === 'Online' ? 'Online Video' : 'In-Clinic'}
        </Badge>
      ),
    },
    {
      header: 'STATUS',
      accessor: (a) => {
        if (a.status === 'Postponed') {
          return (
            <div className="flex flex-col gap-0.5">
              <Badge variant="warn">Postponed</Badge>
              {a.postponedReason && (
                <span className="text-[10px] text-amber-500/90 italic max-w-[140px] truncate" title={a.postponedReason}>
                  &quot;{a.postponedReason}&quot;
                </span>
              )}
            </div>
          );
        }
        if (a.status === 'Cancelled') {
          return (
            <div className="flex flex-col gap-0.5">
              <Badge variant="error">Cancelled</Badge>
              {a.cancellationReason && (
                <span className="text-[10px] text-rose-500/90 italic max-w-[140px] truncate" title={a.cancellationReason}>
                  &quot;{a.cancellationReason}&quot;
                </span>
              )}
            </div>
          );
        }
        const isOutdated = a.status === 'Scheduled' && new Date(a.scheduledAt).getTime() < Date.now();
        if (isOutdated) {
          return (
            <Badge variant="error" className="bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 font-semibold">
              Outdated
            </Badge>
          );
        }
        const variant =
          a.status === 'Scheduled'
            ? 'warn'
            : a.status === 'Completed'
            ? 'success'
            : 'neutral';
        return <Badge variant={variant}>{a.status}</Badge>;
      },
    },
    {
      header: 'ACTIONS',
      accessor: (a) => {
        if (a.status === 'Scheduled' || a.status === 'Postponed') {
          return (
            <div className="flex items-center gap-1.5">
              {a.status === 'Scheduled' && (
                <button
                  type="button"
                  onClick={() => handleCheckinAppointment(a)}
                  disabled={checkingInApptId === a._id}
                  className="px-2.5 py-1 text-xs font-mono rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 transition-colors flex items-center gap-1"
                  title="Patient arrived — check in directly to doctor queue"
                >
                  {checkingInApptId === a._id ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <CheckCircle className="w-3 h-3" />
                  )}
                  <span>Check In</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => handleOpenEditApptModal(a)}
                className="px-2.5 py-1 text-xs font-mono rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 transition-colors flex items-center gap-1"
                title="Edit / Reschedule scheduled appointment"
              >
                <Edit2 className="w-3 h-3" />
                <span>{a.status === 'Postponed' ? 'Schedule Slot' : 'Edit'}</span>
              </button>
              <button
                type="button"
                onClick={() => handleCancelAppointment(a._id)}
                disabled={cancellingApptId === a._id}
                className="px-2 py-1 text-xs font-mono rounded text-rose-500 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-colors"
                title="Cancel Appointment"
              >
                {cancellingApptId === a._id ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <span>Cancel</span>
                )}
              </button>
            </div>
          );
        }
        return <span className="text-xs font-mono text-[var(--text-dim)]">—</span>;
      },
    },
  ];

  const invoiceColumns: Column<Invoice>[] = [
    {
      header: 'INVOICE #',
      accessor: (i) => <span className="font-mono text-xs font-bold text-[var(--brass)]">{i.invoiceNumber}</span>,
    },
    {
      header: 'DATE',
      accessor: (i) => {
        if (!i.createdAt) return '-';
        const d = new Date(i.createdAt);
        return (
          <div className="font-mono text-xs">
            <span className="text-[var(--text)]">{d.toLocaleDateString()}</span>
            <span className="text-[10px] text-[var(--text-dim)] ml-1.5">{d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        );
      },
    },
    {
      header: 'PATIENT',
      accessor: (i) => (i.patientId as Patient)?.name || 'Patient',
    },
    {
      header: 'GRAND TOTAL',
      accessor: (i) => <span className="font-mono font-semibold">₹{i.grandTotal}</span>,
    },
    {
      header: 'PAID',
      accessor: (i) => <span className="font-mono text-[var(--success)]">₹{i.amountPaid}</span>,
    },
    {
      header: 'PAYMENT MODE',
      accessor: (i) => {
        const modes =
          i.payments && i.payments.length > 0
            ? Array.from(new Set(i.payments.map((p) => p.mode))).join(', ')
            : i.status === 'Paid'
            ? 'Cash'
            : '-';
        return (
          <Badge variant={modes === '-' ? 'neutral' : 'brass'}>
            {modes}
          </Badge>
        );
      },
    },
    {
      header: 'STATUS',
      accessor: (i) => (
        <Badge
          variant={
            i.status === 'Paid'
              ? 'success'
              : i.status === 'Partially Paid'
              ? 'warn'
              : 'error'
          }
        >
          {i.status}
        </Badge>
      ),
    },
    {
      header: 'ACTIONS',
      accessor: (i) => {
        const balance = Math.max(0, i.grandTotal - (i.amountPaid || 0));
        return (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setPdfInvoice(i)}
              className="btn-surface px-2 py-1 rounded text-xs font-mono flex items-center gap-1 text-[var(--brass)] hover:text-white"
              title="View & Download GST Tax PDF"
            >
              <FileText className="w-3 h-3" />
              PDF
            </button>
            {balance > 0 && (
              <button
                type="button"
                onClick={() => {
                  setActivePaymentInvoice(i);
                  setPaymentAmount(balance);
                  setPaymentMode('Cash');
                  setPaymentRef('');
                }}
                className="btn-brass px-2 py-1 rounded text-xs font-mono font-bold flex items-center gap-1 shadow-sm"
                title="Settle Dues"
              >
                <CreditCard className="w-3 h-3" />
                Pay
              </button>
            )}
          </div>
        );
      },
    },
  ];

  // Filtered & Sorted Invoices
  const filteredAndSortedInvoices = useMemo(() => {
    let list = [...invoices];

    if (invoiceStatusFilter !== 'all') {
      list = list.filter((inv) => inv.status === invoiceStatusFilter);
    }

    if (invoiceFilter !== 'all') {
      const now = new Date();

      if (invoiceFilter === 'today') {
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
        const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();
        list = list.filter((inv) => {
          const t = new Date(inv.createdAt).getTime();
          return t >= start && t <= end;
        });
      } else if (invoiceFilter === 'yesterday') {
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0, 0).getTime();
        const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999).getTime();
        list = list.filter((inv) => {
          const t = new Date(inv.createdAt).getTime();
          return t >= start && t <= end;
        });
      } else if (invoiceFilter === 'last_week') {
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7, 0, 0, 0, 0).getTime();
        const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();
        list = list.filter((inv) => {
          const t = new Date(inv.createdAt).getTime();
          return t >= start && t <= end;
        });
      } else if (invoiceFilter === 'last_month') {
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30, 0, 0, 0, 0).getTime();
        const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();
        list = list.filter((inv) => {
          const t = new Date(inv.createdAt).getTime();
          return t >= start && t <= end;
        });
      } else if (invoiceFilter === 'specific_date' && specificDate) {
        const [y, m, d] = specificDate.split('-').map(Number);
        const start = new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
        const end = new Date(y, m - 1, d, 23, 59, 59, 999).getTime();
        list = list.filter((inv) => {
          const t = new Date(inv.createdAt).getTime();
          return t >= start && t <= end;
        });
      } else if (invoiceFilter === 'custom_duration') {
        let start = -Infinity;
        let end = Infinity;
        if (customStartDate) {
          const [sy, sm, sd] = customStartDate.split('-').map(Number);
          start = new Date(sy, sm - 1, sd, 0, 0, 0, 0).getTime();
        }
        if (customEndDate) {
          const [ey, em, ed] = customEndDate.split('-').map(Number);
          end = new Date(ey, em - 1, ed, 23, 59, 59, 999).getTime();
        }
        list = list.filter((inv) => {
          const t = new Date(inv.createdAt).getTime();
          return t >= start && t <= end;
        });
      }
    }

    list.sort((a, b) => {
      const timeA = new Date(a.createdAt).getTime();
      const timeB = new Date(b.createdAt).getTime();
      return invoiceSort === 'recent' ? timeB - timeA : timeA - timeB;
    });

    return list;
  }, [invoices, invoiceSort, invoiceFilter, invoiceStatusFilter, specificDate, customStartDate, customEndDate]);

  return (
    <AppShell
      navGroups={navGroups}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      pageTitle="Reception & Front Desk Station"
      topbarActions={
        <button
          onClick={() => setActiveTab('checkin')}
          className="btn-brass px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5"
        >
          <UserPlus className="w-3.5 h-3.5" />
          <span>New Check-In</span>
        </button>
      }
    >
      {/* ================= DASHBOARD TAB ================= */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* KPI Cards Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              label="Patients in Queue"
              value={queue.length}
              delta={`${queue.filter((v) => v.status === 'Waiting').length} waiting`}
              deltaType="neutral"
              icon={<UserCheck className="w-5 h-5" />}
            />
            <KpiCard
              label="Today's Appointments"
              value={appointments.length}
              delta="Scheduled"
              deltaType="positive"
              icon={<Calendar className="w-5 h-5" />}
            />
            <KpiCard
              label="Active On-Duty Doctors"
              value={doctors.filter((d) => d.isOnDuty).length}
              subtext={`${doctors.length} Total Registered`}
              icon={<UserCheck className="w-5 h-5" />}
            />
            <KpiCard
              label="Pending Invoices"
              value={invoices.filter((i) => i.status !== 'Paid').length}
              delta="Awaiting Pay"
              deltaType="negative"
              icon={<CreditCard className="w-5 h-5" />}
            />
          </div>

          {/* Live Queue Table */}
          <Panel
            title="Active Patient Queue (Live Sync)"
            subtitle="Real-time consultation flow • Drag rows or double-click to reorder sequence"
            action={
              <div className="flex items-center gap-2.5">
                {paymentCfg.staticQrEnabled && (
                  <button
                    type="button"
                    onClick={() => setIsCounterStaticQrOpen(true)}
                    className="px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white shadow-xs transition-all cursor-pointer"
                    title="View, download (JPG/PDF), or print counter Static QR Code"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    <span>Static QR Code</span>
                  </button>
                )}
                <span className="font-mono text-xs text-[var(--brass)] animate-pulse flex items-center gap-1">
                  ● Live Updates Active
                </span>
              </div>
            }
          >
            <DataTable
              columns={queueColumns}
              data={queue}
              keyExtractor={(v) => v._id}
              emptyMessage="No patients currently waiting in the clinic queue."
              reorderable={true}
              onReorder={handleReorderQueue}
              onRowDoubleClick={(v) => handleOpenEditQueueModal(v)}
            />
          </Panel>
        </div>
      )}

      {/* ================= CHECK-IN TAB ================= */}
      {activeTab === 'checkin' && (
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="flex justify-center">
            <RockerToggle
              options={[
                { label: 'RETURNING PATIENT', value: 'returning' },
                { label: 'NEW PATIENT REGISTRATION', value: 'new' },
              ]}
              value={checkinType}
              onChange={(v) => setCheckinType(v as 'returning' | 'new')}
            />
          </div>

          {checkinType === 'returning' ? (
            <Panel title="Patient Search & Check-in" subtitle="Search existing patient record by Phone, Name, or Patient ID">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider mb-1.5">
                    Search Patient
                  </label>
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-dim)]" />
                    <input
                      type="text"
                      placeholder="Type phone or name (e.g. 9876543210, Aarav)..."
                      value={patientSearch}
                      onChange={(e) => handleSearchPatients(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-sm bg-[var(--surface)] border border-[var(--border)] rounded-md text-[var(--text)] focus:outline-none focus:border-[var(--brass)] font-mono"
                    />
                  </div>
                </div>

                {/* Patient Search Results */}
                {patients.length > 0 && (
                  <div className="border border-[var(--border)] rounded-md overflow-hidden bg-[var(--surface)]">
                    {patients.map((p) => (
                      <div
                        key={p._id}
                        onClick={async () => {
                          setSelectedPatientId(p._id);
                          setPatientSearch(`${p.name} (${p.phone})`);
                          setPatients([]);
                          try {
                            const res = await api.get(`/receptionist/patients/${p._id}`);
                            const h = res.data.data.lastHeightCm ?? res.data.data.heightCm ?? '';
                            setCheckinHeight(h ? String(h) : '');
                            setCheckinLastHeight(h ? String(h) : '');
                          } catch {
                            const h = p.lastHeightCm ?? p.heightCm ?? '';
                            setCheckinHeight(h ? String(h) : '');
                            setCheckinLastHeight(h ? String(h) : '');
                          }
                        }}
                        className="p-3 hover:bg-[var(--surface-2)] cursor-pointer border-b border-[var(--border)] last:border-b-0 flex justify-between items-center"
                      >
                        <div>
                          <span className="font-semibold text-sm block">{p.name}</span>
                          <span className="font-mono text-xs text-[var(--text-dim)]">{p.patientId} • {p.phone}</span>
                        </div>
                        <Badge variant="brass">{p.gender || 'Patient'}</Badge>
                      </div>
                    ))}
                  </div>
                )}

                {/* Select Doctor */}
                <div>
                  <label className="block text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider mb-1.5">
                    Assign Consulting Doctor
                  </label>
                  <select
                    value={selectedDoctorId}
                    onChange={(e) => setSelectedDoctorId(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-[var(--surface)] border border-[var(--border)] rounded-md text-[var(--text)] focus:outline-none focus:border-[var(--brass)]"
                  >
                    {doctors.map((d) => (
                      <option key={d._id} value={d._id}>
                        {d.fullName} — {d.specialization || 'Dermatologist'} (Consultation: ₹{d.consultFee || 500}) • {d.isOnDuty ? 'On Duty' : 'Off Duty'}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Patient Vitals for This Visit */}
                {selectedPatientId && (
                  <div className="p-3.5 bg-[var(--surface-2)] border border-[var(--border)] rounded-md space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider">
                        Patient Vitals (Current Visit)
                      </label>
                      <span className="text-[11px] font-mono text-[var(--brass)]">Weight required on every visit</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider mb-1">
                          Weight (kg) *
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          placeholder="e.g. 68.5"
                          value={checkinWeight}
                          onChange={(e) => setCheckinWeight(e.target.value)}
                          className="w-full px-3 py-2 text-sm bg-[var(--surface)] border border-[var(--border)] rounded-md text-[var(--text)] focus:outline-none focus:border-[var(--brass)] font-mono"
                        />
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider">
                            Height (cm) <span className="text-[10px] text-[var(--text-dim)] font-normal">(Optional)</span>
                          </label>
                          {checkinLastHeight && (
                            <span className="text-[10px] font-mono text-[var(--text-dim)]">Last: {checkinLastHeight} cm</span>
                          )}
                        </div>
                        <input
                          type="number"
                          step="0.1"
                          placeholder="e.g. 172"
                          value={checkinHeight}
                          onChange={(e) => setCheckinHeight(e.target.value)}
                          className="w-full px-3 py-2 text-sm bg-[var(--surface)] border border-[var(--border)] rounded-md text-[var(--text)] focus:outline-none focus:border-[var(--brass)] font-mono"
                        />
                        <p className="text-[11px] text-[var(--text-dim)] mt-1">Pre-filled with last recorded height. Edit if changed.</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Real-time Fee Detection Box */}
                {feeDetection && (
                  <div className="p-4 bg-[var(--brass-glow)] border border-[var(--brass)]/30 rounded-md space-y-2">
                    <div className="flex justify-between items-center text-xs font-mono">
                      <span className="text-[var(--text-dim)]">Visit Type Detected:</span>
                      <strong className="text-[var(--brass)] font-semibold">
                        {feeDetection.isFirstVisit ? 'First Consultation (Initial Visit)' : 'Follow-up Consultation'}
                      </strong>
                    </div>

                    <div className="pt-2 border-t border-[var(--border)] text-xs font-mono space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="text-[var(--text-dim)]">Doctor Consultation Fee:</span>
                        <span className="font-semibold text-[var(--text)]">₹{feeDetection.doctorConsultFee ?? feeDetection.fee}</span>
                      </div>

                      {feeDetection.isFirstVisit && (feeDetection.registrationFee ?? 0) > 0 && (
                        <div className="flex justify-between items-center text-[var(--brass)]">
                          <span>+ Hospital Patient History Book Log &amp; Registration:</span>
                          <span className="font-semibold">₹{feeDetection.registrationFee}</span>
                        </div>
                      )}

                      <div className="flex justify-between items-center text-[var(--text-dim)]">
                        <span>GST ({feeDetection.gstRate}%):</span>
                        <span>₹{feeDetection.gstAmount}</span>
                      </div>
                    </div>

                    <div className="flex justify-between items-center font-display font-bold text-sm text-[var(--text)] pt-2 border-t border-[var(--brass)]/30">
                      <span>Total Amount Payable:</span>
                      <span className="text-[var(--brass)] font-mono text-base">₹{feeDetection.total}</span>
                    </div>
                  </div>
                )}

                {/* Consultation Fee Payment Status Option */}
                <div className="space-y-2 pt-2 border-t border-[var(--border)]">
                  <label className="block text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider">
                    Consultation Fee Payment
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setCheckinFeeStatus('Pending')}
                      className={`py-2 px-3 text-xs font-mono rounded-md border transition-all flex items-center justify-center gap-1.5 ${
                        checkinFeeStatus === 'Pending'
                          ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/40 font-semibold shadow-sm'
                          : 'bg-[var(--surface-2)] text-[var(--text-dim)] border-[var(--border)] hover:text-[var(--text)]'
                      }`}
                    >
                      <Clock className="w-3.5 h-3.5" />
                      <span>Pending (Pay Later)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCheckinFeeStatus('Paid')}
                      className={`py-2 px-3 text-xs font-mono rounded-md border transition-all flex items-center justify-center gap-1.5 ${
                        checkinFeeStatus === 'Paid'
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/40 font-semibold shadow-sm'
                          : 'bg-[var(--surface-2)] text-[var(--text-dim)] border-[var(--border)] hover:text-[var(--text)]'
                      }`}
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>Paid Now</span>
                    </button>
                  </div>

                  {checkinFeeStatus === 'Paid' && (
                    <div className="p-3 bg-[var(--surface-2)] border border-[var(--border)] rounded-md space-y-2 mt-2">
                      <label className="block text-[11px] font-mono text-[var(--text-dim)] uppercase tracking-wider">
                        Select Payment Method:
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {(['Cash', 'UPI', 'Card'] as const).map((mode) => (
                          <button
                            key={mode}
                            type="button"
                            onClick={() => setCheckinPaymentMode(mode)}
                            className={`py-1.5 text-xs font-mono rounded border transition-all ${
                              checkinPaymentMode === mode
                                ? 'bg-[var(--brass)] text-white border-[var(--brass)] font-bold shadow-sm'
                                : 'bg-[var(--surface-card)] text-[var(--text-dim)] border-[var(--border)] hover:text-[var(--text)]'
                            }`}
                          >
                            {mode === 'Card' ? 'Card (POS)' : mode}
                          </button>
                        ))}
                      </div>

                      {checkinPaymentMode === 'UPI' && paymentCfg.staticQrEnabled && paymentCfg.staticQrVpa && (
                        <>
                          <div className="p-3 bg-[var(--surface-card)] border border-[var(--border)] rounded-md flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-lg bg-[var(--surface-3)] border border-[var(--border)] flex items-center justify-center text-[var(--brass)] shrink-0">
                                <QrCode className="w-5 h-5" />
                              </div>
                              <div>
                                <p className="font-mono text-xs font-bold text-[var(--text)]">UPI Static QR Code</p>
                                <p className="font-mono text-[11px] text-[var(--brass)]">{paymentCfg.staticQrVpa}</p>
                                <p className="font-mono text-[10px] text-[var(--text-dim)]">Total Payable: ₹{feeDetection.total}</p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setShowCheckinUpiModal(true)}
                              className="btn-brass px-3 py-1.5 rounded text-xs font-mono font-semibold flex items-center gap-1.5 shrink-0"
                            >
                              <QrCode className="w-3.5 h-3.5" />
                              <span>Show QR Code</span>
                            </button>
                          </div>

                          {/* UPI Static QR Popup Modal Container */}
                          {showCheckinUpiModal && (
                            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
                              <div className="surface-card border border-[var(--border)] rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl relative">
                                <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
                                  <div>
                                    <h3 className="font-display font-bold text-base text-[var(--text)] flex items-center gap-2">
                                      <QrCode className="w-4 h-4 text-[var(--brass)]" />
                                      Scan to Pay via UPI
                                    </h3>
                                    <p className="text-xs text-[var(--text-dim)]">Ask patient to scan using GPay, PhonePe, or Paytm</p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => setShowCheckinUpiModal(false)}
                                    className="p-1 rounded-lg text-[var(--text-dim)] hover:text-[var(--text)] hover:bg-[var(--surface-3)] transition-colors"
                                  >
                                    <X className="w-5 h-5" />
                                  </button>
                                </div>

                                <div className="flex flex-col items-center justify-center p-4 bg-white rounded-xl shadow-inner border border-slate-200">
                                  <QRCode
                                    value={`upi://pay?pa=${encodeURIComponent(paymentCfg.staticQrVpa)}&pn=${encodeURIComponent(
                                      paymentCfg.staticQrDisplayName || 'Clinic'
                                    )}&am=${feeDetection.total}&cu=INR&tn=${encodeURIComponent('Consultation Fee')}`}
                                    size={220}
                                    level="H"
                                  />
                                  <p className="font-mono text-sm font-bold text-slate-800 mt-3">
                                    Amount: ₹{feeDetection.total}
                                  </p>
                                  <p className="font-mono text-xs text-slate-600 mt-0.5">
                                    UPI ID: {paymentCfg.staticQrVpa}
                                  </p>
                                </div>

                                <div className="flex items-center justify-between text-xs font-mono text-[var(--text-dim)] pt-1">
                                  <span>{paymentCfg.staticQrDisplayName || 'Clinic Counter'}</span>
                                  <button
                                    type="button"
                                    onClick={() => setShowCheckinUpiModal(false)}
                                    className="px-4 py-1.5 rounded-lg bg-[var(--surface-3)] hover:bg-[var(--surface-2)] text-[var(--text)] border border-[var(--border)] transition-colors"
                                  >
                                    Done / Close
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Patient Already In Queue Alert */}
                {activeQueueVisitForSelected && (
                  <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-md text-xs text-rose-600 dark:text-rose-400 flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <strong className="block font-semibold">Patient Already in Active Queue</strong>
                      <p className="leading-relaxed">
                        This patient is currently waiting in the live queue as <strong>Queue #{activeQueueVisitForSelected.queueNumber}</strong> (Status: {activeQueueVisitForSelected.status === 'InProgress' ? 'In Doctor Room' : 'Waiting in Lobby'}) for {(activeQueueVisitForSelected.doctorId as User)?.fullName || 'Assigned Doctor'}. Duplicate check-in is not permitted.
                      </p>
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleCheckin}
                  disabled={!selectedPatientId || !selectedDoctorId || isCheckingIn || !!activeQueueVisitForSelected}
                  className="w-full btn-brass py-2.5 rounded-md text-sm font-medium flex items-center justify-center gap-2 mt-4 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                >
                  {isCheckingIn ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Checking In to Queue...</span>
                    </>
                  ) : (
                    <>
                      <span>Confirm Check-In to Queue</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </Panel>
          ) : (
            <Panel title="Register New Patient" subtitle="Create new digital record and check-in directly">
              <form onSubmit={handleRegisterAndCheckin} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider mb-1.5">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Ramesh Chandra"
                      value={newPatient.name}
                      onChange={(e) => setNewPatient({ ...newPatient, name: e.target.value })}
                      className="w-full px-3 py-2 text-sm bg-[var(--surface)] border border-[var(--border)] rounded-md text-[var(--text)] focus:outline-none focus:border-[var(--brass)]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider mb-1.5">
                      Mobile Number (10 digits) *
                    </label>
                    <input
                      type="tel"
                      required
                      maxLength={10}
                      placeholder="9876543210"
                      value={newPatient.phone}
                      onChange={(e) => {
                        const digits = e.target.value.replace(/\D/g, '');
                        setNewPatient({ ...newPatient, phone: digits });
                        if (patientPhoneError) setPatientPhoneError(null);
                      }}
                      className={`w-full px-3 py-2 text-sm bg-[var(--surface)] border rounded-md text-[var(--text)] focus:outline-none font-mono transition-colors ${
                        patientPhoneError
                          ? 'border-red-500 focus:border-red-500 bg-red-500/5'
                          : 'border-[var(--border)] focus:border-[var(--brass)]'
                      }`}
                    />
                    {patientPhoneError && (
                      <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1 font-mono">
                        <span className="text-red-500">⚠️</span> {patientPhoneError}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider mb-1.5">
                      Gender
                    </label>
                    <select
                      value={newPatient.gender}
                      onChange={(e) => setNewPatient({ ...newPatient, gender: e.target.value as any })}
                      className="w-full px-3 py-2 text-sm bg-[var(--surface)] border border-[var(--border)] rounded-md text-[var(--text)] focus:outline-none focus:border-[var(--brass)]"
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider mb-1.5">
                      Date of Birth
                    </label>
                    <input
                      type="date"
                      value={newPatient.dateOfBirth}
                      onChange={(e) => setNewPatient({ ...newPatient, dateOfBirth: e.target.value })}
                      className="w-full px-3 py-2 text-sm bg-[var(--surface)] border border-[var(--border)] rounded-md text-[var(--text)] focus:outline-none focus:border-[var(--brass)] font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider mb-1.5">
                      Location / City
                    </label>
                    <input
                      type="text"
                      placeholder="Chennai"
                      value={newPatient.location}
                      onChange={(e) => setNewPatient({ ...newPatient, location: e.target.value })}
                      className="w-full px-3 py-2 text-sm bg-[var(--surface)] border border-[var(--border)] rounded-md text-[var(--text)] focus:outline-none focus:border-[var(--brass)]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider mb-1.5">
                    Email Address (Optional)
                  </label>
                  <input
                    type="email"
                    placeholder="patient@example.com"
                    value={newPatient.email}
                    onChange={(e) => setNewPatient({ ...newPatient, email: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-[var(--surface)] border border-[var(--border)] rounded-md text-[var(--text)] focus:outline-none focus:border-[var(--brass)] font-mono"
                  />
                </div>

                {/* Physical Vitals & Marital Status */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider mb-1.5">
                      Weight (kg) *
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      required
                      placeholder="e.g. 70"
                      value={newPatient.weightKg}
                      onChange={(e) => setNewPatient({ ...newPatient, weightKg: e.target.value })}
                      className="w-full px-3 py-2 text-sm bg-[var(--surface)] border border-[var(--border)] rounded-md text-[var(--text)] focus:outline-none focus:border-[var(--brass)] font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider mb-1.5">
                      Height (cm) *
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      required
                      placeholder="e.g. 175"
                      value={newPatient.heightCm}
                      onChange={(e) => setNewPatient({ ...newPatient, heightCm: e.target.value })}
                      className="w-full px-3 py-2 text-sm bg-[var(--surface)] border border-[var(--border)] rounded-md text-[var(--text)] focus:outline-none focus:border-[var(--brass)] font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider mb-1.5">
                      Marital Status
                    </label>
                    <select
                      value={newPatient.maritalStatus}
                      onChange={(e) => setNewPatient({ ...newPatient, maritalStatus: e.target.value as any })}
                      className="w-full px-3 py-2 text-sm bg-[var(--surface)] border border-[var(--border)] rounded-md text-[var(--text)] focus:outline-none focus:border-[var(--brass)]"
                    >
                      <option value="">— Select —</option>
                      <option value="Single">Single</option>
                      <option value="Married">Married</option>
                      <option value="Divorced">Divorced</option>
                      <option value="Widowed">Widowed</option>
                    </select>
                  </div>
                </div>

                {/* Blood Group & Allergies */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider mb-1.5">
                      Blood Group
                    </label>
                    <select
                      value={newPatient.bloodGroup}
                      onChange={(e) => setNewPatient({ ...newPatient, bloodGroup: e.target.value as any })}
                      className="w-full px-3 py-2 text-sm bg-[var(--surface)] border border-[var(--border)] rounded-md text-[var(--text)] focus:outline-none focus:border-[var(--brass)]"
                    >
                      <option value="">— Select —</option>
                      {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown'].map((bg) => (
                        <option key={bg} value={bg}>{bg}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider mb-1.5">
                      Known Allergies
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Penicillin, Sulfa drugs"
                      value={newPatient.allergies}
                      onChange={(e) => setNewPatient({ ...newPatient, allergies: e.target.value })}
                      className="w-full px-3 py-2 text-sm bg-[var(--surface)] border border-[var(--border)] rounded-md text-[var(--text)] focus:outline-none focus:border-[var(--brass)]"
                    />
                    <p className="text-[11px] text-[var(--text-dim)] mt-1">Separate multiple allergies with commas</p>
                  </div>
                </div>

                {/* Medical History Notes */}
                <div>
                  <label className="block text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider mb-1.5">
                    Medical History Notes (Optional)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Type 2 Diabetes, Hypothyroidism, PCOS, Hypertension..."
                    value={newPatient.medicalHistoryNotes}
                    onChange={(e) => setNewPatient({ ...newPatient, medicalHistoryNotes: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-[var(--surface)] border border-[var(--border)] rounded-md text-[var(--text)] focus:outline-none focus:border-[var(--brass)] resize-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider mb-1.5">
                    Assign Doctor *
                  </label>
                  <select
                    value={selectedDoctorId}
                    onChange={(e) => setSelectedDoctorId(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-[var(--surface)] border border-[var(--border)] rounded-md text-[var(--text)] focus:outline-none focus:border-[var(--brass)]"
                  >
                    {doctors.map((d) => (
                      <option key={d._id} value={d._id}>
                        {d.fullName} — {d.specialization || 'Dermatologist'} (Consultation: ₹{d.consultFee || 500})
                      </option>
                    ))}
                  </select>
                </div>

                {/* New Patient Consultation Fee Payment Option */}
                <div className="space-y-2 pt-2 border-t border-[var(--border)]">
                  <label className="block text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider">
                    Consultation Fee Payment
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setNewPatientFeeStatus('Pending')}
                      className={`py-2 px-3 text-xs font-mono rounded-md border transition-all flex items-center justify-center gap-1.5 ${
                        newPatientFeeStatus === 'Pending'
                          ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/40 font-semibold shadow-sm'
                          : 'bg-[var(--surface-2)] text-[var(--text-dim)] border-[var(--border)] hover:text-[var(--text)]'
                      }`}
                    >
                      <Clock className="w-3.5 h-3.5" />
                      <span>Pending (Pay Later)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewPatientFeeStatus('Paid')}
                      className={`py-2 px-3 text-xs font-mono rounded-md border transition-all flex items-center justify-center gap-1.5 ${
                        newPatientFeeStatus === 'Paid'
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/40 font-semibold shadow-sm'
                          : 'bg-[var(--surface-2)] text-[var(--text-dim)] border-[var(--border)] hover:text-[var(--text)]'
                      }`}
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>Paid Now</span>
                    </button>
                  </div>

                  {newPatientFeeStatus === 'Paid' && (
                    <div className="p-3 bg-[var(--surface-2)] border border-[var(--border)] rounded-md space-y-2 mt-2">
                      <label className="block text-[11px] font-mono text-[var(--text-dim)] uppercase tracking-wider">
                        Select Payment Method:
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {(['Cash', 'UPI', 'Card'] as const).map((mode) => (
                          <button
                            key={mode}
                            type="button"
                            onClick={() => setNewPatientPaymentMode(mode)}
                            className={`py-1.5 text-xs font-mono rounded border transition-all ${
                              newPatientPaymentMode === mode
                                ? 'bg-[var(--brass)] text-white border-[var(--brass)] font-bold shadow-sm'
                                : 'bg-[var(--surface-card)] text-[var(--text-dim)] border-[var(--border)] hover:text-[var(--text)]'
                            }`}
                          >
                            {mode === 'Card' ? 'Card (POS)' : mode}
                          </button>
                        ))}
                      </div>

                      {newPatientPaymentMode === 'UPI' && paymentCfg.staticQrEnabled && paymentCfg.staticQrVpa && (
                        <>
                          <div className="p-3 bg-[var(--surface-card)] border border-[var(--border)] rounded-md flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-lg bg-[var(--surface-3)] border border-[var(--border)] flex items-center justify-center text-[var(--brass)] shrink-0">
                                <QrCode className="w-5 h-5" />
                              </div>
                              <div>
                                <p className="font-mono text-xs font-bold text-[var(--text)]">UPI Static QR Code</p>
                                <p className="font-mono text-[11px] text-[var(--brass)]">{paymentCfg.staticQrVpa}</p>
                                <p className="font-mono text-[10px] text-[var(--text-dim)]">Total Payable: ₹{(doctors.find((d) => d._id === selectedDoctorId)?.consultFee || 500) + 100}</p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setShowRegPatientUpiModal(true)}
                              className="btn-brass px-3 py-1.5 rounded text-xs font-mono font-semibold flex items-center gap-1.5 shrink-0"
                            >
                              <QrCode className="w-3.5 h-3.5" />
                              <span>Show QR Code</span>
                            </button>
                          </div>

                          {/* UPI Static QR Popup Modal Container */}
                          {showRegPatientUpiModal && (
                            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
                              <div className="surface-card border border-[var(--border)] rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl relative">
                                <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
                                  <div>
                                    <h3 className="font-display font-bold text-base text-[var(--text)] flex items-center gap-2">
                                      <QrCode className="w-4 h-4 text-[var(--brass)]" />
                                      Scan to Pay via UPI
                                    </h3>
                                    <p className="text-xs text-[var(--text-dim)]">Ask patient to scan using GPay, PhonePe, or Paytm</p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => setShowRegPatientUpiModal(false)}
                                    className="p-1 rounded-lg text-[var(--text-dim)] hover:text-[var(--text)] hover:bg-[var(--surface-3)] transition-colors"
                                  >
                                    <X className="w-5 h-5" />
                                  </button>
                                </div>

                                <div className="flex flex-col items-center justify-center p-4 bg-white rounded-xl shadow-inner border border-slate-200">
                                  <QRCode
                                    value={`upi://pay?pa=${encodeURIComponent(paymentCfg.staticQrVpa)}&pn=${encodeURIComponent(
                                      paymentCfg.staticQrDisplayName || 'Clinic'
                                    )}&am=${(doctors.find((d) => d._id === selectedDoctorId)?.consultFee || 500) + 100}&cu=INR&tn=${encodeURIComponent('Consultation Fee')}`}
                                    size={220}
                                    level="H"
                                  />
                                  <p className="font-mono text-sm font-bold text-slate-800 mt-3">
                                    Amount: ₹{(doctors.find((d) => d._id === selectedDoctorId)?.consultFee || 500) + 100}
                                  </p>
                                  <p className="font-mono text-xs text-slate-600 mt-0.5">
                                    UPI ID: {paymentCfg.staticQrVpa}
                                  </p>
                                </div>

                                <div className="flex items-center justify-between text-xs font-mono text-[var(--text-dim)] pt-1">
                                  <span>{paymentCfg.staticQrDisplayName || 'Clinic Counter'}</span>
                                  <button
                                    type="button"
                                    onClick={() => setShowRegPatientUpiModal(false)}
                                    className="px-4 py-1.5 rounded-lg bg-[var(--surface-3)] hover:bg-[var(--surface-2)] text-[var(--text)] border border-[var(--border)] transition-colors"
                                  >
                                    Done / Close
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isRegistering}
                  className="w-full btn-brass py-2.5 rounded-md text-sm font-medium flex items-center justify-center gap-2 mt-4 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                >
                  {isRegistering ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Registering &amp; Adding to Queue...</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" />
                      <span>Register &amp; Add to Queue</span>
                    </>
                  )}
                </button>
              </form>
            </Panel>
          )}
        </div>
      )}

      {/* ================= APPOINTMENTS TAB ================= */}
      {activeTab === 'appointments' && (
        <Panel
          title="Scheduled Appointments"
          subtitle="All doctor appointments booked through portal or front desk"
          action={
            <button
              type="button"
              onClick={() => {
                if (doctors.length > 0 && !apptDoctorId) {
                  setApptDoctorId(doctors[0]._id);
                }
                setShowBookApptModal(true);
              }}
              className="btn-brass px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Book Appointment</span>
            </button>
          }
        >
          <DataTable
            columns={appointmentColumns}
            data={appointments}
            keyExtractor={(a) => a._id}
            emptyMessage="No scheduled appointments found."
          />
        </Panel>
      )}

      {/* ================= BILLING TAB ================= */}
      {activeTab === 'billing' && (
        <Panel
          title="Billing & Fee Collection"
          subtitle="Generate and settle consultation, procedure, and medicine invoices"
        >
          {/* Controls Bar: Filter & Sort */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-3.5 mb-5 rounded-lg border border-[var(--border)] bg-[var(--surface-2)]">
            {/* Filter Controls */}
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider flex items-center gap-1.5 font-medium">
                  <Filter className="w-3.5 h-3.5 text-[var(--brass)]" />
                  Filter:
                </span>
                <select
                  value={invoiceFilter}
                  onChange={(e) => setInvoiceFilter(e.target.value as any)}
                  className="bg-[var(--surface-card)] border border-[var(--border)] text-[var(--text)] text-xs font-mono rounded px-2.5 py-1.5 focus:border-[var(--brass)] focus:outline-none transition-colors cursor-pointer"
                >
                  <option value="all">All Dates</option>
                  <option value="today">Today</option>
                  <option value="yesterday">Yesterday</option>
                  <option value="last_week">Last Week</option>
                  <option value="last_month">Last Month</option>
                  <option value="specific_date">Single Specific Date</option>
                  <option value="custom_duration">Custom Duration (Between Dates)</option>
                </select>
              </div>

              {/* Single Specific Date Input */}
              {invoiceFilter === 'specific_date' && (
                <div className="flex items-center gap-1.5 bg-[var(--surface-card)] px-2.5 py-1 rounded border border-[var(--border)]">
                  <label className="text-[11px] font-mono text-[var(--text-dim)] uppercase">Date:</label>
                  <input
                    type="date"
                    value={specificDate}
                    onChange={(e) => setSpecificDate(e.target.value)}
                    className="bg-transparent border-none text-[var(--text)] text-xs font-mono focus:outline-none cursor-pointer"
                  />
                </div>
              )}

              {/* Custom Duration Inputs */}
              {invoiceFilter === 'custom_duration' && (
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1.5 bg-[var(--surface-card)] px-2.5 py-1 rounded border border-[var(--border)]">
                    <label className="text-[11px] font-mono text-[var(--text-dim)] uppercase">Start:</label>
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="bg-transparent border-none text-[var(--text)] text-xs font-mono focus:outline-none cursor-pointer"
                    />
                  </div>
                  <span className="text-xs text-[var(--text-dim)] font-mono">to</span>
                  <div className="flex items-center gap-1.5 bg-[var(--surface-card)] px-2.5 py-1 rounded border border-[var(--border)]">
                    <label className="text-[11px] font-mono text-[var(--text-dim)] uppercase">End:</label>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="bg-transparent border-none text-[var(--text)] text-xs font-mono focus:outline-none cursor-pointer"
                    />
                  </div>
                </div>
              )}

              {/* Reset link */}
              {invoiceFilter !== 'all' && (
                <button
                  type="button"
                  onClick={() => setInvoiceFilter('all')}
                  className="text-xs font-mono text-[var(--brass)] hover:underline ml-1"
                >
                  Clear Filter
                </button>
              )}
            </div>

            {/* Status, Sort Controls & Count */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider font-medium">
                  Status:
                </span>
                <select
                  value={invoiceStatusFilter}
                  onChange={(e) => setInvoiceStatusFilter(e.target.value as any)}
                  className="bg-[var(--surface-card)] border border-[var(--border)] text-[var(--text)] text-xs font-mono rounded px-2.5 py-1.5 focus:border-[var(--brass)] focus:outline-none transition-colors cursor-pointer"
                >
                  <option value="all">All Statuses</option>
                  <option value="Paid">Paid</option>
                  <option value="Partially Paid">Partially Paid</option>
                  <option value="Unpaid">Unpaid / Due</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider flex items-center gap-1.5 font-medium">
                  <ArrowUpDown className="w-3.5 h-3.5 text-[var(--brass)]" />
                  Sort:
                </span>
                <select
                  value={invoiceSort}
                  onChange={(e) => setInvoiceSort(e.target.value as any)}
                  className="bg-[var(--surface-card)] border border-[var(--border)] text-[var(--text)] text-xs font-mono rounded px-2.5 py-1.5 focus:border-[var(--brass)] focus:outline-none transition-colors cursor-pointer"
                >
                  <option value="recent">Most Recent</option>
                  <option value="oldest">Old First</option>
                </select>
              </div>

              <button
                type="button"
                onClick={() => setIsCreateInvoiceOpen(true)}
                className="btn-brass px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 shadow-sm hover:brightness-110 active:scale-95 transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                New Invoice
              </button>

              <div className="text-xs font-mono px-2.5 py-1 rounded bg-[var(--surface-card)] border border-[var(--border)] text-[var(--text-dim)]">
                <span className="text-[var(--text)] font-semibold">{filteredAndSortedInvoices.length}</span> / {invoices.length} records
              </div>
            </div>
          </div>

          <DataTable
            columns={invoiceColumns}
            data={filteredAndSortedInvoices}
            keyExtractor={(i) => i._id}
            emptyMessage={
              invoiceFilter !== 'all' || invoiceStatusFilter !== 'all'
                ? "No invoices match the selected filter."
                : "No invoices generated yet."
            }
          />
        </Panel>
      )}

      {/* ================= PAYMENT MODAL ================= */}
      {activePaymentInvoice && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md surface-card p-6 border border-[var(--border-light)] shadow-2xl">
            <div className="flex justify-between items-center pb-3 border-b border-[var(--border)] mb-4">
              <h3 className="font-display font-bold text-base text-[var(--text)]">
                Collect Payment — {activePaymentInvoice.invoiceNumber}
              </h3>
              <button
                onClick={() => setActivePaymentInvoice(null)}
                className="text-[var(--text-dim)] hover:text-[var(--text)] font-mono text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRecordPayment} className="space-y-4">
              <div className="p-3 bg-[var(--surface-2)] rounded font-mono text-xs space-y-1">
                <div className="flex justify-between">
                  <span>Patient:</span>
                  <strong>{(activePaymentInvoice.patientId as Patient)?.name}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Invoice Total:</span>
                  <span>₹{activePaymentInvoice.grandTotal}</span>
                </div>
                <div className="flex justify-between text-[var(--error)]">
                  <span>Balance Due:</span>
                  <strong>₹{activePaymentInvoice.grandTotal - activePaymentInvoice.amountPaid}</strong>
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider mb-1.5">
                  Payment Mode
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['Cash', 'UPI', 'Card', 'BankTransfer', 'Razorpay'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setPaymentMode(mode)}
                      className={`py-2 text-xs font-mono rounded border transition-all ${
                        paymentMode === mode
                          ? 'bg-[var(--brass)] text-white border-[var(--brass)] font-bold'
                          : 'bg-[var(--surface-2)] text-[var(--text-dim)] border-[var(--border)] hover:text-[var(--text)]'
                      }`}
                    >
                      {mode === 'Card' ? 'Card (POS)' : mode}
                    </button>
                  ))}
                </div>

                {paymentMode === 'UPI' && paymentCfg.staticQrEnabled && paymentCfg.staticQrVpa && (
                  <>
                    <div className="p-3 bg-[var(--surface-2)] border border-[var(--border)] rounded-md flex items-center justify-between gap-3 mt-2">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-[var(--surface-3)] border border-[var(--border)] flex items-center justify-center text-[var(--brass)] shrink-0">
                          <QrCode className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-mono text-xs font-bold text-[var(--text)]">UPI Static QR (₹{paymentAmount})</p>
                          <p className="font-mono text-[11px] text-[var(--brass)]">{paymentCfg.staticQrVpa}</p>
                          <p className="font-mono text-[10px] text-[var(--text-dim)]">Scan with GPay / PhonePe / Paytm</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowBillingUpiModal(true)}
                        className="btn-brass px-3 py-1.5 rounded text-xs font-mono font-semibold flex items-center gap-1.5 shrink-0"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                        <span>Show QR Code</span>
                      </button>
                    </div>

                    {showBillingUpiModal && (
                      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="surface-card border border-[var(--border)] rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl relative">
                          <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
                            <div>
                              <h3 className="font-display font-bold text-base text-[var(--text)] flex items-center gap-2">
                                <QrCode className="w-4 h-4 text-[var(--brass)]" />
                                Invoice Payment via UPI
                              </h3>
                              <p className="text-xs text-[var(--text-dim)]">Invoice #{activePaymentInvoice.invoiceNumber}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setShowBillingUpiModal(false)}
                              className="p-1 rounded-lg text-[var(--text-dim)] hover:text-[var(--text)] hover:bg-[var(--surface-3)] transition-colors"
                            >
                              <X className="w-5 h-5" />
                            </button>
                          </div>

                          <div className="flex flex-col items-center justify-center p-4 bg-white rounded-xl shadow-inner border border-slate-200">
                            <QRCode
                              value={`upi://pay?pa=${encodeURIComponent(paymentCfg.staticQrVpa)}&pn=${encodeURIComponent(
                                paymentCfg.staticQrDisplayName || 'Clinic'
                              )}&am=${paymentAmount}&cu=INR&tn=${encodeURIComponent(`Invoice ${activePaymentInvoice.invoiceNumber}`)}`}
                              size={220}
                              level="H"
                            />
                            <p className="font-mono text-sm font-bold text-slate-800 mt-3">
                              Amount: ₹{paymentAmount}
                            </p>
                            <p className="font-mono text-xs text-slate-600 mt-0.5">
                              UPI ID: {paymentCfg.staticQrVpa}
                            </p>
                          </div>

                          <div className="flex items-center justify-between text-xs font-mono text-[var(--text-dim)] pt-1">
                            <span>{paymentCfg.staticQrDisplayName || 'Clinic Counter'}</span>
                            <button
                              type="button"
                              onClick={() => setShowBillingUpiModal(false)}
                              className="px-4 py-1.5 rounded-lg bg-[var(--surface-3)] hover:bg-[var(--surface-2)] text-[var(--text)] border border-[var(--border)] transition-colors"
                            >
                              Done / Close
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              <div>
                <label className="block text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider mb-1.5">
                  Amount Paying (₹)
                </label>
                <input
                  type="number"
                  min={1}
                  max={activePaymentInvoice.grandTotal - activePaymentInvoice.amountPaid}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-sm bg-[var(--surface-2)] border border-[var(--border)] rounded-md text-[var(--text)] font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider mb-1.5">
                  Transaction / UPI Ref (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. UPI-92837482, POS Slip #..."
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-[var(--surface-2)] border border-[var(--border)] rounded-md text-[var(--text)] font-mono"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActivePaymentInvoice(null)}
                  className="flex-1 btn-surface py-2 rounded text-xs font-mono"
                >
                  Cancel
                </button>
                <button type="submit" className="flex-1 btn-brass py-2 rounded text-xs font-mono font-bold">
                  Confirm Receipt
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ================= FEE STATUS CONFIRMATION MODAL ================= */}
      {confirmFeeVisit && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md surface-card p-6 border border-[var(--border-light)] shadow-2xl space-y-4 rounded-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  confirmFeeVisit.feeStatus === 'Paid'
                    ? 'bg-amber-500/10 text-amber-500'
                    : 'bg-emerald-500/10 text-emerald-500'
                }`}
              >
                {confirmFeeVisit.feeStatus === 'Paid' ? (
                  <Clock className="w-5 h-5" />
                ) : (
                  <CheckCircle className="w-5 h-5" />
                )}
              </div>
              <div>
                <h3 className="font-display font-bold text-base text-[var(--text)]">
                  {confirmFeeVisit.feeStatus === 'Paid' ? 'Mark Fee as Pending?' : 'Mark Fee as Paid?'}
                </h3>
                <p className="text-xs text-[var(--text-dim)]">
                  Patient: {(confirmFeeVisit.patientId as Patient)?.name || 'Patient'}
                </p>
              </div>
            </div>

            <div className="p-3 bg-[var(--surface-2)] border border-[var(--border)] rounded-md space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-[var(--text-dim)]">Doctor Consultation Fee:</span>
                <span className="font-mono text-[var(--text)]">₹{confirmFeeVisit.consultFee || 500}</span>
              </div>
              {confirmFeeVisit.visitType === 'FirstVisit' && (confirmFeeVisit.registrationFee || 0) > 0 && (
                <div className="flex justify-between text-[var(--brass)]">
                  <span>Hospital 1st Visit Fee:</span>
                  <span className="font-mono">₹{confirmFeeVisit.registrationFee}</span>
                </div>
              )}
              <div className="flex justify-between pt-1.5 border-t border-[var(--border)] font-semibold">
                <span>Total Consultation Fee:</span>
                <span className="font-mono text-sm text-[var(--text)]">
                  ₹
                  {(confirmFeeVisit.consultFee || 500) +
                    (confirmFeeVisit.visitType === 'FirstVisit' ? confirmFeeVisit.registrationFee || 0 : 0)}
                </span>
              </div>
            </div>

            <p className="text-xs text-[var(--text-dim)] leading-relaxed">
              {confirmFeeVisit.feeStatus === 'Paid'
                ? 'Are you sure you want to revert this patient consultation fee status back to Pending? This will return the payment and remove the invoice from billing.'
                : 'Are you sure you want to confirm that this patient has paid the consultation fee?'}
            </p>

            {confirmFeeVisit.feeStatus !== 'Paid' && (
              <div className="space-y-3 pt-1">
                <label className="block text-[11px] font-mono text-[var(--text-dim)] uppercase tracking-wider">
                  Select Payment Method:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(
                    [
                      { id: 'Cash', label: 'Cash', icon: Receipt },
                      ...(paymentCfg.staticQrEnabled
                        ? [{ id: 'Static QR', label: 'Static QR', icon: QrCode }]
                        : [{ id: 'UPI', label: 'UPI', icon: QrCode }]),
                      ...(paymentCfg.dynamicQrEnabled
                        ? [{ id: 'Dynamic QR', label: '⚡ Dyn QR', icon: Zap }]
                        : []),
                      { id: 'Card', label: 'Card (POS)', icon: CreditCard },
                    ] as const
                  ).map((item) => {
                    const Icon = item.icon;
                    const isSelected = modalPaymentMode === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setModalPaymentMode(item.id as any);
                          if (item.id !== 'Dynamic QR') {
                            setFeeModalDynamicOrder(null);
                            setFeeModalDynamicStatus('waiting');
                          }
                        }}
                        className={`py-2 px-2 text-xs font-mono rounded-lg border flex flex-col items-center justify-center gap-1 transition-all ${
                          isSelected
                            ? 'bg-[var(--brass)] text-white border-[var(--brass)] font-bold shadow-sm'
                            : 'bg-[var(--surface-2)] text-[var(--text-dim)] border-[var(--border)] hover:text-[var(--text)]'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Static QR In-Modal Preview */}
                {(modalPaymentMode === 'Static QR' || (modalPaymentMode === 'UPI' && paymentCfg.staticQrEnabled)) && (
                  <div className="p-3 bg-[var(--surface-2)] border border-[var(--border)] rounded-xl space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-[var(--text)] flex items-center gap-1.5">
                        <QrCode className="w-3.5 h-3.5 text-blue-500" />
                        UPI Static QR Code
                      </span>
                      <span className="font-mono text-xs font-bold text-blue-500">
                        ₹
                        {(confirmFeeVisit.consultFee || 500) +
                          (confirmFeeVisit.visitType === 'FirstVisit' ? confirmFeeVisit.registrationFee || 0 : 0)}
                      </span>
                    </div>

                    {paymentCfg.staticQrVpa ? (
                      <div className="flex flex-col items-center gap-2">
                        <div className="p-2.5 bg-white rounded-xl shadow-xs border border-[var(--border)]">
                          <QRCode
                            value={`upi://pay?pa=${encodeURIComponent(paymentCfg.staticQrVpa)}&pn=${encodeURIComponent(
                              paymentCfg.staticQrDisplayName || 'Clinic'
                            )}&am=${
                              (confirmFeeVisit.consultFee || 500) +
                              (confirmFeeVisit.visitType === 'FirstVisit' ? confirmFeeVisit.registrationFee || 0 : 0)
                            }&cu=INR&tn=${encodeURIComponent('Consultation Fee')}`}
                            size={140}
                            level="M"
                          />
                        </div>
                        <div className="text-center">
                          <p className="text-xs font-mono font-semibold text-[var(--text)]">
                            {paymentCfg.staticQrDisplayName || 'Clinic'}
                          </p>
                          <p className="text-[11px] font-mono text-[var(--brass)]">{paymentCfg.staticQrVpa}</p>
                          <p className="text-[10px] font-mono text-[var(--text-dim)]">
                            Scan with GPay · PhonePe · Paytm · BHIM
                          </p>
                        </div>
                        <div className="w-full pt-1">
                          <input
                            type="text"
                            placeholder="UPI Ref / Transaction Note (Optional)"
                            value={feeModalStaticNotes}
                            onChange={(e) => setFeeModalStaticNotes(e.target.value)}
                            className="w-full px-2.5 py-1.5 text-xs bg-[var(--surface-card)] border border-[var(--border)] rounded text-[var(--text)] font-mono"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="p-2.5 text-center text-xs text-amber-500 font-mono bg-amber-500/10 rounded">
                        UPI VPA not set. Configure in Payment Settings tab.
                      </div>
                    )}
                  </div>
                )}

                {/* Dynamic QR In-Modal Preview */}
                {modalPaymentMode === 'Dynamic QR' && (
                  <div className="p-3 bg-[var(--surface-2)] border border-[var(--border)] rounded-xl space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-[var(--text)] flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-violet-500" />
                        Razorpay Dynamic QR
                      </span>
                      <span className="font-mono text-xs font-bold text-violet-500">
                        ₹
                        {(confirmFeeVisit.consultFee || 500) +
                          (confirmFeeVisit.visitType === 'FirstVisit' ? confirmFeeVisit.registrationFee || 0 : 0)}
                      </span>
                    </div>

                    {!feeModalDynamicOrder ? (
                      <div className="text-center py-2 space-y-2">
                        <p className="text-xs text-[var(--text-dim)] font-mono">
                          Generate an instant Razorpay dynamic QR code for ₹
                          {(confirmFeeVisit.consultFee || 500) +
                            (confirmFeeVisit.visitType === 'FirstVisit' ? confirmFeeVisit.registrationFee || 0 : 0)}
                          . Auto-verifies on payment.
                        </p>
                        <button
                          type="button"
                          onClick={() =>
                            handleGenerateFeeModalDynamicOrder(
                              confirmFeeVisit,
                              (confirmFeeVisit.consultFee || 500) +
                                (confirmFeeVisit.visitType === 'FirstVisit' ? confirmFeeVisit.registrationFee || 0 : 0)
                            )
                          }
                          disabled={isCreatingFeeModalDynamicOrder}
                          className="w-full py-2 px-3 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-mono text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                        >
                          {isCreatingFeeModalDynamicOrder ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>Generating Razorpay QR...</span>
                            </>
                          ) : (
                            <>
                              <Zap className="w-3.5 h-3.5" />
                              <span>
                                Generate Razorpay QR (₹
                                {(confirmFeeVisit.consultFee || 500) +
                                  (confirmFeeVisit.visitType === 'FirstVisit'
                                    ? confirmFeeVisit.registrationFee || 0
                                    : 0)}
                                )
                              </span>
                            </>
                          )}
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        {feeModalDynamicStatus === 'confirmed' ? (
                          <div className="py-4 text-center space-y-1.5">
                            <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center mx-auto text-xl font-bold">
                              ✓
                            </div>
                            <p className="text-xs font-bold text-emerald-500 font-mono">Payment Received & Verified!</p>
                            <p className="text-[10px] text-[var(--text-dim)] font-mono">Updating fee status...</p>
                          </div>
                        ) : (
                          <>
                            <div className="p-2.5 bg-white rounded-xl shadow-xs border border-[var(--border)]">
                              <QRCode value={feeModalDynamicOrder.qrValue} size={140} level="M" />
                            </div>
                            <div className="text-center space-y-0.5">
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-violet-500/15 text-violet-500 animate-pulse border border-violet-500/30">
                                <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-ping" />
                                Waiting for payment...
                              </span>
                              <p className="text-[10px] font-mono text-[var(--text-dim)]">
                                Auto-confirms immediately when paid
                              </p>
                              {feeModalDynamicOrder.isTestMode && (
                                <p className="text-[10px] font-mono text-amber-500">🧪 Test: success@razorpay</p>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setConfirmFeeVisit(null);
                  setFeeModalDynamicOrder(null);
                  setFeeModalDynamicStatus('waiting');
                  setFeeModalStaticNotes('');
                }}
                disabled={togglingVisitId === confirmFeeVisit._id}
                className="flex-1 py-2 text-xs border border-[var(--border)] rounded text-[var(--text-dim)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (modalPaymentMode === 'Dynamic QR' && !feeModalDynamicOrder) {
                    handleGenerateFeeModalDynamicOrder(
                      confirmFeeVisit,
                      (confirmFeeVisit.consultFee || 500) +
                        (confirmFeeVisit.visitType === 'FirstVisit' ? confirmFeeVisit.registrationFee || 0 : 0)
                    );
                    return;
                  }
                  handleToggleFeeStatus(confirmFeeVisit, modalPaymentMode as any);
                }}
                disabled={
                  togglingVisitId === confirmFeeVisit._id ||
                  (modalPaymentMode === 'Dynamic QR' && feeModalDynamicStatus === 'confirmed')
                }
                className={`flex-1 py-2 text-xs rounded font-medium flex items-center justify-center gap-1.5 transition-all text-white ${
                  confirmFeeVisit.feeStatus === 'Paid'
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : modalPaymentMode === 'Dynamic QR'
                    ? 'bg-violet-600 hover:bg-violet-700'
                    : modalPaymentMode === 'Static QR'
                    ? 'bg-blue-600 hover:bg-blue-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {togglingVisitId === confirmFeeVisit._id ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Updating...</span>
                  </>
                ) : (
                  <span>
                    {confirmFeeVisit.feeStatus === 'Paid'
                      ? 'Yes, Mark Pending'
                      : modalPaymentMode === 'Dynamic QR'
                      ? feeModalDynamicOrder
                        ? 'Confirm Paid Manually'
                        : 'Generate Dynamic QR'
                      : modalPaymentMode === 'Static QR'
                      ? 'Confirm Paid via Static QR'
                      : 'Yes, Confirm Paid'}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= CANCEL QUEUE VISIT CONFIRMATION MODAL ================= */}
      {cancelQueueVisit && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm surface-card p-6 border border-[var(--border-light)] shadow-2xl space-y-4 rounded-xl">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                cancelQueueVisit.feeStatus === 'Paid'
                  ? 'bg-amber-500/10 text-amber-500'
                  : 'bg-rose-500/10 text-rose-500'
              }`}>
                {cancelQueueVisit.feeStatus === 'Paid' ? (
                  <Receipt className="w-5 h-5" />
                ) : (
                  <X className="w-5 h-5" />
                )}
              </div>
              <div>
                <h3 className="font-display font-bold text-base text-[var(--text)]">
                  {cancelQueueVisit.feeStatus === 'Paid'
                    ? 'Return Fee & Cancel Visit?'
                    : 'Cancel Queue Visit?'}
                </h3>
                <p className="text-xs text-[var(--text-dim)]">
                  Queue #{(cancelQueueVisit as Visit).queueNumber || 1} • {(cancelQueueVisit.patientId as Patient)?.name || 'Patient'}
                </p>
              </div>
            </div>

            {cancelQueueVisit.feeStatus === 'Paid' ? (
              <div className="space-y-2">
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-600 dark:text-amber-400 space-y-1">
                  <div className="font-semibold flex items-center justify-between">
                    <span>Fee Collected:</span>
                    <span>₹{(cancelQueueVisit.consultFee || 500) + (cancelQueueVisit.visitType === 'FirstVisit' ? (cancelQueueVisit.registrationFee || 0) : 0)}</span>
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    Are you returning this payment amount to the patient?
                  </p>
                </div>
                <p className="text-xs text-[var(--text-dim)] leading-relaxed">
                  Confirming will <strong>cancel this visit</strong>, <strong>remove the invoice</strong> from Billing &amp; Fee Collection, and restore any linked scheduled appointment back to <strong>Scheduled</strong>.
                </p>
              </div>
            ) : (
              <p className="text-xs text-[var(--text-dim)] leading-relaxed">
                Are you sure you want to cancel the queue visit for <strong>{(cancelQueueVisit.patientId as Patient)?.name || 'this patient'}</strong>? This will remove them from the active doctor queue and restore any linked scheduled appointment.
              </p>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setCancelQueueVisit(null)}
                disabled={isCancellingQueueVisit}
                className="flex-1 py-2 text-xs border border-[var(--border)] rounded text-[var(--text-dim)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors"
              >
                Keep Visit
              </button>
              <button
                type="button"
                onClick={handleConfirmCancelQueueVisit}
                disabled={isCancellingQueueVisit}
                className={`flex-1 py-2 text-xs rounded font-medium flex items-center justify-center gap-1.5 transition-all text-white ${
                  cancelQueueVisit.feeStatus === 'Paid'
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-rose-600 hover:bg-rose-700'
                } disabled:opacity-50`}
              >
                {isCancellingQueueVisit ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Cancelling...</span>
                  </>
                ) : (
                  <span>
                    {cancelQueueVisit.feeStatus === 'Paid' ? 'Yes, Return & Cancel' : 'Yes, Cancel Visit'}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ================= BOOK ADVANCE APPOINTMENT MODAL ================= */}
      {showBookApptModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg surface-card p-6 border border-[var(--border-light)] shadow-2xl rounded-xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-3 border-b border-[var(--border)] mb-4">
              <div>
                <h3 className="font-display font-bold text-base text-[var(--text)]">
                  Book Advance Appointment
                </h3>
                <p className="text-xs text-[var(--text-dim)] mt-0.5">
                  Schedule an upcoming doctor consultation or procedure
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowBookApptModal(false)}
                className="text-[var(--text-dim)] hover:text-[var(--text)] font-mono text-sm p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleBookAdvanceAppointment} className="space-y-4">
              {/* Patient Selection Toggle */}
              <div>
                <label className="block text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider mb-2">
                  Patient Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setApptPatientMode('existing')}
                    className={`py-1.5 text-xs font-mono rounded border transition-all ${
                      apptPatientMode === 'existing'
                        ? 'bg-[var(--brass)] text-white border-[var(--brass)] font-semibold'
                        : 'bg-[var(--surface-2)] text-[var(--text-dim)] border-[var(--border)] hover:text-[var(--text)]'
                    }`}
                  >
                    Existing Patient
                  </button>
                  <button
                    type="button"
                    onClick={() => setApptPatientMode('new')}
                    className={`py-1.5 text-xs font-mono rounded border transition-all ${
                      apptPatientMode === 'new'
                        ? 'bg-[var(--brass)] text-white border-[var(--brass)] font-semibold'
                        : 'bg-[var(--surface-2)] text-[var(--text-dim)] border-[var(--border)] hover:text-[var(--text)]'
                    }`}
                  >
                    + New Patient
                  </button>
                </div>
              </div>

              {/* Existing Patient Search */}
              {apptPatientMode === 'existing' ? (
                <div>
                  <label className="block text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider mb-1">
                    Select Patient *
                  </label>
                  {apptSelectedPatient ? (
                    <div className="p-3 bg-[var(--surface-2)] rounded-lg border border-[var(--border)] flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold text-[var(--text)]">{apptSelectedPatient.name}</div>
                        <div className="text-xs font-mono text-[var(--text-dim)] flex items-center gap-3 mt-0.5">
                          <span>📞 {apptSelectedPatient.phone}</span>
                          <span>ID: {apptSelectedPatient.patientId}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setApptSelectedPatient(null)}
                        className="text-xs font-mono text-[var(--brass)] hover:underline"
                      >
                        Change
                      </button>
                    </div>
                  ) : (
                    <div className="relative">
                      <div className="relative">
                        <Search className="w-4 h-4 text-[var(--text-dim)] absolute left-3 top-2.5" />
                        <input
                          type="text"
                          value={apptPatientSearch}
                          onChange={(e) => handleSearchApptPatients(e.target.value)}
                          placeholder="Search patient by name or phone..."
                          className="w-full pl-9 pr-3 py-2 text-xs font-mono bg-[var(--surface-2)] border border-[var(--border)] rounded focus:border-[var(--brass)] focus:outline-none"
                        />
                      </div>
                      {apptPatientsList.length > 0 && (
                        <div className="absolute z-50 w-full mt-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg shadow-2xl max-h-48 overflow-y-auto divide-y divide-[var(--border-light)]">
                          {apptPatientsList.map((p) => (
                            <button
                              key={p._id}
                              type="button"
                              onClick={() => {
                                setApptSelectedPatient(p);
                                setApptPatientSearch('');
                                setApptPatientsList([]);
                              }}
                              className="w-full text-left p-2.5 bg-[var(--surface)] hover:bg-[var(--surface-2)] flex items-center justify-between transition-colors cursor-pointer"
                            >
                              <div>
                                <span className="font-semibold text-xs text-[var(--text)] block">{p.name}</span>
                                <span className="text-[11px] font-mono text-[var(--text-dim)]">{p.phone}</span>
                              </div>
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--surface-2)] text-[var(--text-dim)] border border-[var(--border)]">
                                {p.patientId}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                      {apptPatientSearch.trim().length >= 2 && apptPatientsList.length === 0 && (
                        <p className="text-[11px] text-[var(--text-dim)] mt-1.5">No patients found matching &quot;{apptPatientSearch}&quot;</p>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                /* New Patient Inline Form */
                <div className="p-3 bg-[var(--surface-2)] rounded-lg border border-[var(--border)] space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-mono text-[var(--text-dim)] uppercase mb-1">Full Name *</label>
                      <input
                        type="text"
                        required
                        value={apptNewName}
                        onChange={(e) => setApptNewName(e.target.value)}
                        placeholder="e.g. John Doe"
                        className="w-full px-2.5 py-1.5 text-xs bg-[var(--surface-card)] border border-[var(--border)] rounded focus:border-[var(--brass)] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-mono text-[var(--text-dim)] uppercase mb-1">Phone Number *</label>
                      <input
                        type="tel"
                        required
                        maxLength={10}
                        value={apptNewPhone}
                        onChange={(e) => {
                          const digits = e.target.value.replace(/\D/g, '');
                          setApptNewPhone(digits);
                          if (apptPhoneError) setApptPhoneError(null);
                        }}
                        placeholder="e.g. 9876543210"
                        className={`w-full px-2.5 py-1.5 text-xs bg-[var(--surface-card)] border rounded focus:outline-none font-mono transition-colors ${
                          apptPhoneError
                            ? 'border-red-500 focus:border-red-500 bg-red-500/5'
                            : 'border-[var(--border)] focus:border-[var(--brass)]'
                        }`}
                      />
                      {apptPhoneError && (
                        <p className="mt-1 text-[11px] text-red-500 flex items-center gap-1 font-mono">
                          <span>⚠️</span> {apptPhoneError}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-mono text-[var(--text-dim)] uppercase mb-1">Gender</label>
                      <select
                        value={apptNewGender}
                        onChange={(e) => setApptNewGender(e.target.value as any)}
                        className="w-full px-2.5 py-1.5 text-xs bg-[var(--surface-card)] border border-[var(--border)] rounded focus:border-[var(--brass)] focus:outline-none cursor-pointer"
                      >
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-mono text-[var(--text-dim)] uppercase mb-1">Email (Optional)</label>
                      <input
                        type="email"
                        value={apptNewEmail}
                        onChange={(e) => setApptNewEmail(e.target.value)}
                        placeholder="patient@example.com"
                        className="w-full px-2.5 py-1.5 text-xs bg-[var(--surface-card)] border border-[var(--border)] rounded focus:border-[var(--brass)] focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Doctor & Date Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider mb-1">
                    Select Doctor *
                  </label>
                  <select
                    value={apptDoctorId}
                    onChange={(e) => setApptDoctorId(e.target.value)}
                    required
                    className="w-full px-2.5 py-2 text-xs font-mono bg-[var(--surface-2)] border border-[var(--border)] rounded focus:border-[var(--brass)] focus:outline-none cursor-pointer"
                  >
                    {doctors.map((d) => (
                      <option key={d._id} value={d._id}>
                        {d.fullName} ({d.specialization || 'Dermatology'})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider mb-1">
                    Date *
                  </label>
                  <input
                    type="date"
                    required
                    min={new Date().toISOString().split('T')[0]}
                    value={apptDate}
                    onChange={(e) => setApptDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs font-mono bg-[var(--surface-2)] border border-[var(--border)] rounded focus:border-[var(--brass)] focus:outline-none cursor-pointer"
                  />
                </div>
              </div>

              {/* Available Time Slots */}
              <div>
                <label className="block text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>Available Time Slot *</span>
                  <span className="text-[10px] text-[var(--text-dim)] lowercase">
                    {apptAvailableSlots.length} slots open
                  </span>
                </label>
                <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
                  {[
                    '09:30', '10:00', '10:30', '11:00', '11:30', '12:00',
                    '12:30', '14:00', '14:30', '15:00', '15:30', '16:00',
                    '16:30', '17:00',
                  ].map((slot) => {
                    const isBooked = apptBookedSlots.includes(slot);
                    const isSelected = apptSlot === slot;
                    return (
                      <button
                        key={slot}
                        type="button"
                        disabled={isBooked}
                        onClick={() => setApptSlot(slot)}
                        className={`py-1.5 text-[11px] font-mono rounded border transition-all text-center ${
                          isBooked
                            ? 'bg-[var(--surface-2)] text-[var(--text-dim)] border-transparent opacity-40 cursor-not-allowed line-through'
                            : isSelected
                            ? 'bg-[var(--brass)] text-white border-[var(--brass)] font-bold shadow-sm'
                            : 'bg-[var(--surface-card)] text-[var(--text)] border-[var(--border)] hover:border-[var(--brass)]'
                        }`}
                        title={isBooked ? 'Slot already booked' : `Book for ${slot}`}
                      >
                        {slot}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Consultation Mode */}
              <div>
                <label className="block text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider mb-1">
                  Consultation Mode
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(['Offline', 'Online'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setApptMode(mode)}
                      className={`py-1.5 text-xs font-mono rounded border transition-all ${
                        apptMode === mode
                          ? 'bg-[var(--brass)] text-white border-[var(--brass)] font-semibold shadow-sm'
                          : 'bg-[var(--surface-2)] text-[var(--text-dim)] border-[var(--border)] hover:text-[var(--text)]'
                      }`}
                    >
                      {mode === 'Offline' ? 'In-Clinic' : 'Video Call'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider mb-1">
                  Reason / Symptoms (Optional)
                </label>
                <input
                  type="text"
                  value={apptNotes}
                  onChange={(e) => setApptNotes(e.target.value)}
                  placeholder="e.g. Skin rash follow-up, Laser patch test..."
                  className="w-full px-2.5 py-1.5 text-xs bg-[var(--surface-2)] border border-[var(--border)] rounded focus:border-[var(--brass)] focus:outline-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-3 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => setShowBookApptModal(false)}
                  disabled={isSubmittingAppt}
                  className="px-4 py-2 text-xs border border-[var(--border)] rounded text-[var(--text-dim)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAppt}
                  className="btn-brass px-4 py-2 text-xs rounded font-medium flex items-center gap-1.5 transition-all disabled:opacity-50"
                >
                  {isSubmittingAppt ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Scheduling...</span>
                    </>
                  ) : (
                    <span>Confirm Appointment</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ================= EDIT SCHEDULED APPOINTMENT MODAL ================= */}
      {editingAppt && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg surface-card p-6 border border-[var(--border-light)] shadow-2xl rounded-xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-3 border-b border-[var(--border)] mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[var(--brass)]/10 text-[var(--brass)] flex items-center justify-center">
                  <Edit2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-base text-[var(--text)]">
                    Edit Scheduled Appointment
                  </h3>
                  <p className="text-xs text-[var(--text-dim)]">
                    Update scheduled date, time slot, doctor or consultation info
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingAppt(null)}
                className="text-[var(--text-dim)] hover:text-[var(--text)] font-mono text-sm p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateAppointment} className="space-y-4">
              {/* Patient Banner */}
              <div className="p-3 bg-[var(--surface-2)] rounded-lg border border-[var(--border)] flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-dim)] block">Patient</span>
                  <div className="text-sm font-semibold text-[var(--text)]">
                    {(editingAppt.patientId as Patient)?.name || 'Patient'}
                  </div>
                  <div className="text-xs font-mono text-[var(--text-dim)] flex items-center gap-3 mt-0.5">
                    <span>📞 {(editingAppt.patientId as Patient)?.phone || '-'}</span>
                    <span>ID: {(editingAppt.patientId as Patient)?.patientId || '-'}</span>
                  </div>
                </div>
                <Badge variant={editingAppt.mode === 'Online' ? 'brass' : 'neutral'}>
                  {editingAppt.mode === 'Online' ? 'Online Video' : 'In-Clinic'}
                </Badge>
              </div>

              {/* Outdated Warning Notice if past */}
              {new Date(editingAppt.scheduledAt).getTime() < Date.now() && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-xs text-rose-600 dark:text-rose-400 flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <strong className="block font-semibold">Scheduled time is outdated</strong>
                    <p className="text-[11px] leading-relaxed">
                      This appointment was scheduled for{' '}
                      {new Date(editingAppt.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}{' '}
                      on {new Date(editingAppt.scheduledAt).toLocaleDateString()}, which has already passed. Please select a future date and available slot to reschedule.
                    </p>
                  </div>
                </div>
              )}

              {/* Doctor & Date Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider mb-1">
                    Assigned Doctor *
                  </label>
                  <select
                    value={editDoctorId}
                    onChange={(e) => setEditDoctorId(e.target.value)}
                    required
                    className="w-full px-2.5 py-2 text-xs font-mono bg-[var(--surface-2)] border border-[var(--border)] rounded focus:border-[var(--brass)] focus:outline-none cursor-pointer"
                  >
                    {doctors.map((d) => (
                      <option key={d._id} value={d._id}>
                        {d.fullName} ({d.specialization || 'Dermatology'})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider">
                      Appointment Date *
                    </label>
                    {new Date(editDate).getTime() < new Date().setHours(0, 0, 0, 0) && (
                      <button
                        type="button"
                        onClick={() => {
                          const today = new Date().toISOString().split('T')[0];
                          setEditDate(today);
                        }}
                        className="text-[10px] font-mono text-[var(--brass)] hover:underline"
                      >
                        Set to Today
                      </button>
                    )}
                  </div>
                  <input
                    type="date"
                    required
                    min={new Date().toISOString().split('T')[0]}
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs font-mono bg-[var(--surface-2)] border border-[var(--border)] rounded focus:border-[var(--brass)] focus:outline-none cursor-pointer"
                  />
                </div>
              </div>

              {/* Available Time Slots */}
              <div>
                <label className="block text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>Available Time Slot *</span>
                  <span className="text-[10px] text-[var(--text-dim)] lowercase">
                    {editAvailableSlots.length} slots open
                  </span>
                </label>
                <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
                  {[
                    '09:30', '10:00', '10:30', '11:00', '11:30', '12:00',
                    '12:30', '14:00', '14:30', '15:00', '15:30', '16:00',
                    '16:30', '17:00',
                  ].map((slot) => {
                    const isBooked = editBookedSlots.includes(slot);
                    const isSelected = editSlot === slot;
                    return (
                      <button
                        key={slot}
                        type="button"
                        disabled={isBooked}
                        onClick={() => setEditSlot(slot)}
                        className={`py-1.5 text-[11px] font-mono rounded border transition-all text-center ${
                          isBooked
                            ? 'bg-[var(--surface-2)] text-[var(--text-dim)] border-transparent opacity-40 cursor-not-allowed line-through'
                            : isSelected
                            ? 'bg-[var(--brass)] text-white border-[var(--brass)] font-bold shadow-sm'
                            : 'bg-[var(--surface-card)] text-[var(--text)] border-[var(--border)] hover:border-[var(--brass)]'
                        }`}
                        title={isBooked ? 'Slot already booked' : `Select ${slot}`}
                      >
                        {slot}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Consultation Mode */}
              <div>
                <label className="block text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider mb-1">
                  Consultation Mode
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(['Offline', 'Online'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setEditMode(mode)}
                      className={`py-1.5 text-xs font-mono rounded border transition-all ${
                        editMode === mode
                          ? 'bg-[var(--brass)] text-white border-[var(--brass)] font-semibold shadow-sm'
                          : 'bg-[var(--surface-2)] text-[var(--text-dim)] border-[var(--border)] hover:text-[var(--text)]'
                      }`}
                    >
                      {mode === 'Offline' ? 'In-Clinic' : 'Video Call'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Consultation Type */}
              <div>
                <label className="block text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider mb-1">
                  Appointment Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(['Consult', 'Surgery'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setEditType(t)}
                      className={`py-1.5 text-xs font-mono rounded border transition-all ${
                        editType === t
                          ? 'bg-[var(--brass)] text-white border-[var(--brass)] font-semibold shadow-sm'
                          : 'bg-[var(--surface-2)] text-[var(--text-dim)] border-[var(--border)] hover:text-[var(--text)]'
                      }`}
                    >
                      {t === 'Consult' ? 'General Consultation' : 'Clinical Procedure / Surgery'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider mb-1">
                  Reason / Symptoms (Optional)
                </label>
                <input
                  type="text"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="e.g. Skin rash follow-up, Laser patch test..."
                  className="w-full px-2.5 py-1.5 text-xs bg-[var(--surface-2)] border border-[var(--border)] rounded focus:border-[var(--brass)] focus:outline-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-3 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => setEditingAppt(null)}
                  disabled={isUpdatingAppt}
                  className="px-4 py-2 text-xs border border-[var(--border)] rounded text-[var(--text-dim)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingAppt}
                  className="btn-brass px-4 py-2 text-xs rounded font-medium flex items-center gap-1.5 transition-all disabled:opacity-50"
                >
                  {isUpdatingAppt ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving Changes...</span>
                    </>
                  ) : (
                    <span>Save Changes</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ================= EDIT QUEUE VISIT MODAL ================= */}
      {editingQueueVisit && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md surface-card p-6 border border-[var(--border-light)] shadow-2xl rounded-xl">
            <div className="flex justify-between items-center pb-3 border-b border-[var(--border)] mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[var(--brass)]/10 text-[var(--brass)] flex items-center justify-center">
                  <Edit2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-base text-[var(--text)]">
                    Edit Queue Position &amp; Doctor
                  </h3>
                  <p className="text-xs text-[var(--text-dim)]">
                    Reassign doctor or move queue position
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingQueueVisit(null)}
                className="text-[var(--text-dim)] hover:text-[var(--text)] font-mono text-sm p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateQueueVisit} className="space-y-4">
              {/* Patient Banner */}
              <div className="p-3 bg-[var(--surface-2)] rounded-lg border border-[var(--border)] flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-dim)] block">Patient</span>
                  <div className="text-sm font-semibold text-[var(--text)]">
                    {(editingQueueVisit.patientId as Patient)?.name || 'Patient'}
                  </div>
                  <div className="text-xs font-mono text-[var(--text-dim)] mt-0.5">
                    {(editingQueueVisit.patientId as Patient)?.patientId || '-'} • {(editingQueueVisit.patientId as Patient)?.phone || '-'}
                  </div>
                </div>
                <Badge variant="brass">
                  Current #{editingQueueVisit.queueNumber}
                </Badge>
              </div>

              {/* Assign Doctor */}
              <div>
                <label className="block text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider mb-1.5">
                  Assigned Consulting Doctor
                </label>
                <select
                  value={editQueueDoctorId}
                  onChange={(e) => setEditQueueDoctorId(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono bg-[var(--surface-2)] border border-[var(--border)] rounded focus:border-[var(--brass)] focus:outline-none cursor-pointer"
                >
                  {doctors.map((d) => (
                    <option key={d._id} value={d._id}>
                      {d.fullName} — {d.specialization || 'Dermatologist'} (₹{d.consultFee || 500})
                    </option>
                  ))}
                </select>
              </div>

              {/* Queue Number */}
              <div>
                <label className="block text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>Queue Position Number</span>
                  <span className="text-[11px] text-[var(--text-dim)]">Total in queue: {queue.length}</span>
                </label>
                <input
                  type="number"
                  min={1}
                  max={Math.max(queue.length, 1)}
                  value={editQueueNumber}
                  onChange={(e) => setEditQueueNumber(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-full px-3 py-2 text-sm font-mono font-bold bg-[var(--surface-2)] border border-[var(--border)] rounded focus:border-[var(--brass)] focus:outline-none"
                />
                <p className="text-[11px] text-[var(--text-dim)] mt-1">
                  Moving this patient to #{editQueueNumber} will automatically shift other queue items sequentially.
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => setEditingQueueVisit(null)}
                  disabled={isUpdatingQueueVisit}
                  className="px-4 py-2 text-xs border border-[var(--border)] rounded text-[var(--text-dim)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingQueueVisit}
                  className="btn-brass px-4 py-2 text-xs rounded font-medium flex items-center gap-1.5 transition-all disabled:opacity-50"
                >
                  {isUpdatingQueueVisit ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving Changes...</span>
                    </>
                  ) : (
                    <span>Save Changes</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= GENERATE CUSTOM INVOICE MODAL ================= */}
      {isCreateInvoiceOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="w-full max-w-3xl surface-card p-6 border border-[var(--border-light)] shadow-2xl rounded-2xl my-auto animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center pb-3 border-b border-[var(--border)] mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[var(--brass)]/15 flex items-center justify-center text-[var(--brass)]">
                  <Receipt className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-base text-[var(--text)]">
                    Create Custom GST Invoice
                  </h3>
                  <p className="text-xs text-[var(--text-dim)] font-mono">
                    Bill consultation, minor procedures, medicated serums, or lab investigations
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateInvoiceOpen(false)}
                className="text-[var(--text-dim)] hover:text-[var(--text)] font-mono text-base p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateCustomInvoice} className="space-y-4">
              {/* Patient Selection */}
              <div>
                <label className="block text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider mb-1.5">
                  Select Patient *
                </label>
                {newInvSelectedPatient ? (
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-[var(--surface-2)] border border-[var(--border)]">
                    <div className="font-mono text-xs">
                      <span className="font-bold text-[var(--text)]">{newInvSelectedPatient.name}</span>
                      <span className="text-[var(--brass)] ml-2">({newInvSelectedPatient.patientId})</span>
                      <span className="text-[var(--text-dim)] ml-2">+91 {newInvSelectedPatient.phone}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setNewInvSelectedPatient(null);
                        setNewInvPatientId('');
                        setNewInvPatientSearch('');
                      }}
                      className="text-xs text-[var(--brass)] hover:underline font-mono"
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <div className="relative">
                      <Search className="w-4 h-4 text-[var(--text-dim)] absolute left-3 top-2.5" />
                      <input
                        type="text"
                        placeholder="Search patient by name or phone (min 2 chars)..."
                        value={newInvPatientSearch}
                        onChange={(e) => handleSearchNewInvPatients(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-xs bg-[var(--surface-2)] border border-[var(--border)] rounded-md text-[var(--text)] font-mono"
                      />
                    </div>
                    {newInvPatientsList.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-[var(--surface-card)] border border-[var(--border)] rounded-md shadow-xl z-20">
                        {newInvPatientsList.map((p) => (
                          <div
                            key={p._id}
                            onClick={() => {
                              setNewInvSelectedPatient(p);
                              setNewInvPatientId(p._id);
                              setNewInvPatientsList([]);
                            }}
                            className="p-2.5 text-xs font-mono hover:bg-[var(--surface-2)] cursor-pointer border-b border-[var(--border)] last:border-b-0 flex justify-between items-center"
                          >
                            <span className="font-bold text-[var(--text)]">{p.name}</span>
                            <div className="text-[var(--text-dim)]">
                              <span className="text-[var(--brass)] mr-2">{p.patientId}</span>
                              <span>+91 {p.phone}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Line Items Builder */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider">
                    Invoice Line Items & GST
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setNewInvItems([
                        ...newInvItems,
                        { itemType: 'Procedure', description: '', quantity: 1, unitPrice: 0, gstRate: 18 },
                      ])
                    }
                    className="text-xs font-mono text-[var(--brass)] hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Item
                  </button>
                </div>

                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {newInvItems.map((item, idx) => {
                    const subtotal = item.quantity * item.unitPrice;
                    const tax = Math.round(subtotal * (item.gstRate / 100) * 100) / 100;
                    const rowTotal = Math.round((subtotal + tax) * 100) / 100;

                    return (
                      <div
                        key={idx}
                        className="p-2.5 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] grid grid-cols-12 gap-2 items-center text-xs font-mono"
                      >
                        <div className="col-span-3">
                          <select
                            value={item.itemType}
                            onChange={(e) => {
                              const val = e.target.value as any;
                              const updated = [...newInvItems];
                              updated[idx].itemType = val;
                              updated[idx].gstRate = val === 'Medicine' ? 5 : val === 'Lab Test' ? 12 : 18;
                              setNewInvItems(updated);
                            }}
                            className="w-full bg-[var(--surface-card)] border border-[var(--border)] rounded px-2 py-1.5 text-[var(--text)] text-xs font-mono"
                          >
                            <option value="Consultation">Consultation</option>
                            <option value="Procedure">Procedure</option>
                            <option value="Medicine">Medicine</option>
                            <option value="Lab Test">Lab Test</option>
                          </select>
                        </div>

                        <div className="col-span-4">
                          <input
                            type="text"
                            placeholder="Description..."
                            value={item.description}
                            onChange={(e) => {
                              const updated = [...newInvItems];
                              updated[idx].description = e.target.value;
                              setNewInvItems(updated);
                            }}
                            className="w-full bg-[var(--surface-card)] border border-[var(--border)] rounded px-2 py-1.5 text-[var(--text)] text-xs font-mono"
                          />
                        </div>

                        <div className="col-span-1">
                          <input
                            type="number"
                            min={1}
                            placeholder="Qty"
                            value={item.quantity}
                            onChange={(e) => {
                              const updated = [...newInvItems];
                              updated[idx].quantity = Math.max(1, parseInt(e.target.value) || 1);
                              setNewInvItems(updated);
                            }}
                            className="w-full bg-[var(--surface-card)] border border-[var(--border)] rounded px-1.5 py-1.5 text-[var(--text)] text-xs text-center font-mono"
                          />
                        </div>

                        <div className="col-span-2">
                          <div className="relative">
                            <span className="absolute left-2 top-1.5 text-[var(--text-dim)] text-[10px]">₹</span>
                            <input
                              type="number"
                              min={0}
                              placeholder="Price"
                              value={item.unitPrice}
                              onChange={(e) => {
                                const updated = [...newInvItems];
                                updated[idx].unitPrice = parseFloat(e.target.value) || 0;
                                setNewInvItems(updated);
                              }}
                              className="w-full bg-[var(--surface-card)] border border-[var(--border)] rounded pl-5 pr-2 py-1.5 text-[var(--text)] text-xs font-mono"
                            />
                          </div>
                        </div>

                        <div className="col-span-1 text-right font-bold text-[var(--brass)]">
                          ₹{rowTotal}
                        </div>

                        <div className="col-span-1 text-right">
                          {newInvItems.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setNewInvItems(newInvItems.filter((_, i) => i !== idx))}
                              className="text-rose-400 hover:text-rose-500 font-bold p-1"
                              title="Remove item"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Invoice Calculations Summary */}
              {(() => {
                const sub = newInvItems.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
                const gst = newInvItems.reduce((s, i) => s + i.quantity * i.unitPrice * (i.gstRate / 100), 0);
                const grand = Math.round((sub + gst) * 100) / 100;

                return (
                  <div className="p-3.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] font-mono text-xs space-y-1.5">
                    <div className="flex justify-between text-[var(--text-dim)]">
                      <span>Subtotal (Taxable Value):</span>
                      <span>₹{Math.round(sub * 100) / 100}</span>
                    </div>
                    <div className="flex justify-between text-[var(--text-dim)]">
                      <span>Total GST (CGST + SGST):</span>
                      <span>₹{Math.round(gst * 100) / 100}</span>
                    </div>
                    <div className="flex justify-between text-sm font-bold text-[var(--brass)] pt-1 border-t border-[var(--border)]">
                      <span>Grand Total:</span>
                      <span>₹{grand}</span>
                    </div>
                  </div>
                );
              })()}

              {/* Immediate Settlement Toggle */}
              <div className="p-3.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] space-y-3 font-mono text-xs">
                <label className="flex items-center gap-2 cursor-pointer text-[var(--text)] font-semibold">
                  <input
                    type="checkbox"
                    checked={newInvPayNow}
                    onChange={(e) => setNewInvPayNow(e.target.checked)}
                    className="accent-[var(--brass)] w-4 h-4 rounded"
                  />
                  <span>Collect payment immediately and mark as Paid</span>
                </label>

                {newInvPayNow && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[var(--border)]">
                    <div>
                      <label className="block text-[11px] text-[var(--text-dim)] uppercase mb-1">Payment Mode</label>
                      <select
                        value={newInvPayMode}
                        onChange={(e) => setNewInvPayMode(e.target.value as any)}
                        className="w-full bg-[var(--surface-card)] border border-[var(--border)] rounded px-2.5 py-1.5 text-xs text-[var(--text)]"
                      >
                        <option value="Cash">Cash</option>
                        <option value="UPI">UPI</option>
                        <option value="Card">Card (POS)</option>
                        <option value="BankTransfer">Bank Transfer</option>
                        <option value="Razorpay">Razorpay</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] text-[var(--text-dim)] uppercase mb-1">Payment Reference</label>
                      <input
                        type="text"
                        placeholder="Optional UPI ID, Ref #..."
                        value={newInvPayRef}
                        onChange={(e) => setNewInvPayRef(e.target.value)}
                        className="w-full bg-[var(--surface-card)] border border-[var(--border)] rounded px-2.5 py-1.5 text-xs text-[var(--text)]"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Actions */}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateInvoiceOpen(false)}
                  className="flex-1 btn-surface py-2.5 rounded-lg text-xs font-mono"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingInvoice || !newInvPatientId}
                  className="flex-1 btn-brass py-2.5 rounded-lg text-xs font-mono font-bold flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {isSubmittingInvoice ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Generating Invoice...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>Create & Generate Tax Invoice</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= PAYMENT SETTINGS TAB ================= */}
      {activeTab === 'payment-settings' && (
        <div className="max-w-2xl space-y-6">
          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--brass-dim)] border border-[var(--brass)]/30 flex items-center justify-center">
              <Settings2 className="w-5 h-5 text-[var(--brass)]" />
            </div>
            <div>
              <h2 className="font-display font-bold text-lg text-[var(--text)]">Payment Settings</h2>
              <p className="text-xs text-[var(--text-dim)] font-mono">Configure QR payment methods for the Dispensary</p>
            </div>
            {isTestMode && (
              <span className="ml-auto px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-amber-500/15 text-amber-500 border border-amber-500/30">
                🧪 Razorpay Test Mode
              </span>
            )}
          </div>

          {/* Static QR Toggle Card */}
          <div className="surface-card p-5 space-y-4 border border-[var(--border)] rounded-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-500/12 border border-blue-500/25 flex items-center justify-center">
                  <QrCode className="w-4.5 h-4.5 text-blue-500" />
                </div>
                <div>
                  <h3 className="font-display font-semibold text-sm text-[var(--text)]">📷 Static QR Code</h3>
                  <p className="text-xs text-[var(--text-dim)] font-mono mt-0.5">
                    One fixed QR label on the counter. Staff manually confirms payment.
                  </p>
                </div>
              </div>
              {/* Toggle switch */}
              <button
                type="button"
                onClick={() => setPaymentCfg((p) => ({ ...p, staticQrEnabled: !p.staticQrEnabled }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                  paymentCfg.staticQrEnabled ? 'bg-blue-600' : 'bg-[var(--surface-3)]'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    paymentCfg.staticQrEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Static QR config — only when enabled */}
            {paymentCfg.staticQrEnabled && (
              <div className="pt-3 border-t border-[var(--border)] space-y-3">
                <div>
                  <label className="text-xs font-mono text-[var(--text-dim)] block mb-1">
                    UPI VPA (Virtual Payment Address)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. clinic@upi or yourname@okicici"
                    value={paymentCfg.staticQrVpa}
                    onChange={(e) => setPaymentCfg((p) => ({ ...p, staticQrVpa: e.target.value }))}
                    className="w-full px-3 py-2 text-xs bg-[var(--surface-2)] border border-[var(--border)] rounded-lg text-[var(--text)] focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-mono text-[var(--text-dim)] block mb-1">
                    Display Name (shown on QR screen)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. DermaTrack Clinic"
                    value={paymentCfg.staticQrDisplayName}
                    onChange={(e) => setPaymentCfg((p) => ({ ...p, staticQrDisplayName: e.target.value }))}
                    className="w-full px-3 py-2 text-xs bg-[var(--surface-2)] border border-[var(--border)] rounded-lg text-[var(--text)] focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
                <p className="text-[11px] font-mono text-[var(--text-dim)] flex items-center gap-1.5">
                  <span>ℹ️</span> QR value: <code className="bg-[var(--surface-3)] px-1.5 py-0.5 rounded text-[10px]">upi://pay?pa={paymentCfg.staticQrVpa || 'your@vpa'}&pn={paymentCfg.staticQrDisplayName}&am=AMOUNT&cu=INR</code>
                </p>
              </div>
            )}
          </div>

          {/* Dynamic QR Toggle Card */}
          <div className="surface-card p-5 space-y-4 border border-[var(--border)] rounded-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-violet-500/12 border border-violet-500/25 flex items-center justify-center">
                  <Zap className="w-4.5 h-4.5 text-violet-500" />
                </div>
                <div>
                  <h3 className="font-display font-semibold text-sm text-[var(--text)]">⚡ Dynamic QR Code</h3>
                  <p className="text-xs text-[var(--text-dim)] font-mono mt-0.5">
                    Per-order QR via Razorpay. Amount auto-filled. Confirmed by webhook.
                  </p>
                </div>
              </div>
              {/* Toggle switch */}
              <button
                type="button"
                onClick={() => setPaymentCfg((p) => ({ ...p, dynamicQrEnabled: !p.dynamicQrEnabled }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                  paymentCfg.dynamicQrEnabled ? 'bg-violet-600' : 'bg-[var(--surface-3)]'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    paymentCfg.dynamicQrEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {paymentCfg.dynamicQrEnabled && (
              <div className="pt-3 border-t border-[var(--border)]">
                <p className="text-xs font-mono text-[var(--text-dim)]">
                  Razorpay Test Mode is active. Use <strong className="text-amber-500">success@razorpay</strong> as UPI ID to test payments.
                </p>
              </div>
            )}
          </div>

          {/* Toggle State Info Box */}
          <div className="p-4 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs font-mono">
            <p className="text-[var(--text-dim)] font-semibold mb-2 uppercase tracking-wider text-[10px]">Current State</p>
            <div className="space-y-1.5">
              <div className="flex justify-between">
                <span className="text-[var(--text-dim)]">Static QR:</span>
                <span className={paymentCfg.staticQrEnabled ? 'text-blue-500 font-bold' : 'text-[var(--text-dim)]'}>
                  {paymentCfg.staticQrEnabled ? '✅ Enabled — active in Reception Desk & Dispensary' : '❌ Disabled'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-dim)]">Dynamic QR:</span>
                <span className={paymentCfg.dynamicQrEnabled ? 'text-violet-500 font-bold' : 'text-[var(--text-dim)]'}>
                  {paymentCfg.dynamicQrEnabled ? '✅ Enabled — Razorpay active in Reception Desk & Dispensary' : '❌ Disabled'}
                </span>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <button
            type="button"
            disabled={isSavingPayment}
            onClick={async () => {
              try {
                setIsSavingPayment(true);
                const { api } = await import('../../lib/api');
                const res = await api.put('/payment/settings', paymentCfg);
                // Update local state with server response (includes razorpayKeyId)
                if (res.data?.data?.isTestMode !== undefined) setIsTestMode(res.data.data.isTestMode);
                const { toast } = await import('sonner');
                toast.success('Payment settings saved & broadcast to all clients');
              } catch (err: any) {
                const { toast } = await import('sonner');
                toast.error(err.response?.data?.error || 'Failed to save payment settings');
              } finally {
                setIsSavingPayment(false);
              }
            }}
            className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-mono font-bold text-sm bg-[var(--brass)] hover:bg-[var(--brass-hover)] text-[var(--bg)] transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSavingPayment ? (
              <><Loader2 className="w-4 h-4 animate-spin" /><span>Saving...</span></>
            ) : (
              <><Save className="w-4 h-4" /><span>Save Payment Settings</span></>
            )}
          </button>
        </div>
      )}

      {/* ================= INVOICE PDF MODAL ================= */}
      {pdfInvoice && (
        <InvoicePDFModal
          invoice={pdfInvoice}
          onClose={() => setPdfInvoice(null)}
          onPaymentSuccess={fetchData}
        />
      )}

      {/* ================= DEDICATED STATIC QR MODAL ================= */}
      <StaticQRModal
        isOpen={!!staticQRVisit}
        onClose={() => setStaticQRVisit(null)}
        onConfirm={handleConfirmStaticQR}
        amount={staticQRAmount}
        patientName={(staticQRVisit?.patientId as Patient)?.name || 'Patient'}
        vpa={paymentCfg.staticQrVpa}
        displayName={paymentCfg.staticQrDisplayName || 'DermaTrack Clinic'}
        isSubmitting={isConfirmingStatic}
        title="Consultation Fee — Static QR"
        transactionNote="Consultation Fee"
      />

      {/* ================= DEDICATED DYNAMIC QR MODAL ================= */}
      <DynamicQRModal
        isOpen={!!dynamicQRVisit && !!dynamicOrderData}
        onClose={() => {
          setDynamicQRVisit(null);
          setDynamicOrderData(null);
        }}
        onSuccess={async () => {
          if (dynamicQRVisit) {
            try {
              await api.patch(`/receptionist/queue/${dynamicQRVisit._id}/fee-status`, {
                feeStatus: 'Paid',
                paymentMode: 'Razorpay',
              });
            } catch {}
          }
          toast.success('Consultation fee verified via Razorpay Dynamic QR!');
          setDynamicQRVisit(null);
          setDynamicOrderData(null);
          fetchData();
        }}
        orderData={dynamicOrderData}
        patientName={(dynamicQRVisit?.patientId as Patient)?.name || 'Patient'}
        title="Consultation Fee — Dynamic QR"
      />

      {/* ================= CLINIC COUNTER STATIC QR MODAL ================= */}
      <CounterQRModal
        isOpen={isCounterStaticQrOpen}
        onClose={() => setIsCounterStaticQrOpen(false)}
        vpa={paymentCfg.staticQrVpa}
        displayName={paymentCfg.staticQrDisplayName || 'DermaTrack Clinic'}
        clinicName="DermaTrack Clinic"
        defaultAmount={500}
      />
    </AppShell>
  );
}
