'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '../../components/AppShell';
import { KpiCard } from '../../components/KpiCard';
import { Panel } from '../../components/Panel';
import { Badge } from '../../components/Badge';
import { DataTable, Column } from '../../components/DataTable';
import { CompareSlider } from '../../components/CompareSlider';
import { MedicineSearchDropdown } from '../../components/MedicineSearchDropdown';
import { QrBox } from '../../components/QrBox';
import { ScalpCameraModal } from '../../components/ScalpCameraModal';
import { ImageLightboxModal } from '../../components/ImageLightboxModal';
import { api, getMediaUrl } from '../../lib/api';
import { getSocket } from '../../lib/socket';
import { AppointmentLockModal } from '../../components/AppointmentLockModal';
import { AppointmentActionModal } from '../../components/AppointmentActionModal';
import { Visit, Patient, Medicine, Appointment, LabTestItem } from '../../types';
import { toast } from 'sonner';
import {
  Stethoscope,
  Users,
  Calendar,
  CalendarClock,
  Lock,
  Ban,
  QrCode,
  CheckCircle,
  Play,
  Save,
  Plus,
  Trash2,
  TrendingUp,
  Activity,
  Image as ImageIcon,
  FlaskConical,
  AlertTriangle,
  BookOpen,
  Clock,
  Sparkles,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  X,
  ShieldAlert,
  HeartPulse,
  Camera,
  Smartphone,
  SlidersHorizontal,
  ZoomIn,
  RefreshCw,
  Settings,
  FileText,
  CheckCircle2,
  Laptop,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';

const NORWOOD_STAGES = [
  { stage: 'Norwood I', desc: 'Minimal or no hairline recession' },
  { stage: 'Norwood II', desc: 'Triangular frontotemporal recession' },
  { stage: 'Norwood III', desc: 'Deep symmetrical temple recession' },
  { stage: 'Norwood III-Vertex', desc: 'Temple recession with vertex thinning' },
  { stage: 'Norwood IV', desc: 'Severe frontotemporal & vertex recession with solid bridge' },
  { stage: 'Norwood V', desc: 'Narrowing bridge between frontal & crown loss' },
  { stage: 'Norwood VI', desc: 'Bridge gone; horseshoe fringe remaining' },
  { stage: 'Norwood VII', desc: 'Extensive loss; narrow horseshoe band remains' },
];

const LUDWIG_STAGES = [
  { stage: 'Ludwig Grade I', desc: 'Perceptible thinning on crown, intact frontal margin' },
  { stage: 'Ludwig Grade II', desc: 'Pronounced rarefaction of hair on crown/vertex' },
  { stage: 'Ludwig Grade III', desc: 'Complete denudation of crown with intact hairline' },
  { stage: 'Sinclair Grade 1', desc: 'Normal healthy density' },
  { stage: 'Sinclair Grade 2', desc: 'Widening of central parting line' },
  { stage: 'Sinclair Grade 3', desc: 'Widening parting with diffuse vertex thinning' },
  { stage: 'Sinclair Grade 4', desc: 'Prominent diffuse hair loss over vertex' },
  { stage: 'Sinclair Grade 5', desc: 'Advanced female androgenetic alopecia' },
];

type FollowUpPreset = '1w' | '2w' | '1m' | '2m' | '3m' | '6m' | 'custom';
type FollowUpUnit = 'd' | 'w' | 'm';

export default function DoctorPage() {
  const [activeTab, setActiveTab] = useState('workbench');
  const [queue, setQueue] = useState<Visit[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [isOnDuty, setIsOnDuty] = useState(true);

  // Appointment Actions & 24-Hour Lockdown
  const [selectedApptForAction, setSelectedApptForAction] = useState<Appointment | null>(null);
  const [actionModalType, setActionModalType] = useState<'cancel' | 'reschedule'>('cancel');
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [selectedApptForLock, setSelectedApptForLock] = useState<Appointment | null>(null);
  const [isLockModalOpen, setIsLockModalOpen] = useState(false);

  // Doctor Consultation Workflow Preference ('fully_app' | 'prescription_booklet')
  const [consultationWorkflow, setConsultationWorkflow] = useState<'fully_app' | 'prescription_booklet'>('fully_app');
  const [savingWorkflow, setSavingWorkflow] = useState(false);

  const handleAppointmentAction = (appt: Appointment, type: 'cancel' | 'reschedule') => {
    // If appointment is already Postponed (e.g. postponed without date), doctor is setting a new slot
    if (appt.status === 'Postponed') {
      setSelectedApptForAction(appt);
      setActionModalType('reschedule');
      setIsActionModalOpen(true);
      return;
    }

    // 24-hour lockdown check: if scheduledAt is within 24 hours (or past)
    const diffMs = new Date(appt.scheduledAt).getTime() - Date.now();
    if (diffMs <= 24 * 60 * 60 * 1000) {
      setSelectedApptForLock(appt);
      setIsLockModalOpen(true);
      return;
    }

    setSelectedApptForAction(appt);
    setActionModalType(type);
    setIsActionModalOpen(true);
  };

  // Active Consultation State
  const [activeVisit, setActiveVisit] = useState<Visit | null>(null);
  const [visitHistory, setVisitHistory] = useState<Visit[]>([]);
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [hairDensity, setHairDensity] = useState<number>(60);
  const [alopeciaStage, setAlopeciaStage] = useState<string>('');
  const [dlqiScore, setDlqiScore] = useState<number | null>(null);
  const [scalpHealth, setScalpHealth] = useState<{
    dandruff?: string;
    erythema?: string;
    pullTest?: string;
    sebum?: string;
  }>({});
  const [followUpWeeks, setFollowUpWeeks] = useState<number>(4);
  const [followUpPreset, setFollowUpPreset] = useState<FollowUpPreset>('1m');
  const [customIntervalValue, setCustomIntervalValue] = useState<number>(10);
  const [customIntervalUnit, setCustomIntervalUnit] = useState<FollowUpUnit>('d');
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [procedures, setProcedures] = useState<any[]>([]);
  const [labTests, setLabTests] = useState<LabTestItem[]>([]);

  // Lab Test Ordering Form State
  const [customTestName, setCustomTestName] = useState('');
  const [customTestNotes, setCustomTestNotes] = useState('');
  const [customTestFee, setCustomTestFee] = useState<number>(0);

  // Common Dermatology & Trichology Lab Tests (Observed clinical panel)
  const COMMON_DERMA_LAB_TESTS = [
    { name: 'Trichogram & Hair Pull Test', category: 'Scalp & Follicle', hint: 'Anagen/telogen ratio & bulb microscopy' },
    { name: 'Scalp Dermoscopy / Trichoscopy', category: 'Scalp & Follicle', hint: 'Yellow dots, peripilar signs, vascular patterns' },
    { name: 'Fungal KOH Mount & Culture', category: 'Infection', hint: 'Rule out Tinea Capitis / Dermatophyte infection' },
    { name: 'Liver Function Test (LFT)', category: 'Metabolic & Safety', hint: 'Pre-treatment screen for oral antifungals / isotretinoin' },
    { name: 'Blood Glucose (Fasting & HbA1c)', category: 'Metabolic & Safety', hint: 'Screen for insulin resistance & metabolic syndrome' },
    { name: 'Serum Ferritin & Iron Panel', category: 'Nutritional / Hair Loss', hint: 'Evaluate telogen effluvium & iron deficiency' },
    { name: 'Thyroid Profile (T3, T4, TSH)', category: 'Endocrine', hint: 'Rule out hypo/hyperthyroidism induced alopecia' },
    { name: 'Serum Vitamin D3 & B12', category: 'Nutritional / Hair Loss', hint: 'Critical micronutrient biomarkers for hair density' },
    { name: 'Antinuclear Antibodies (ANA)', category: 'Autoimmune', hint: 'Screen for Alopecia Areata / Lupus Erythematosus' },
    { name: 'Skin Patch Allergy Test', category: 'Allergy / Contact Dermatitis', hint: 'Identify contact allergens, dyes, minoxidil sensitivity' },
  ];

  // Prescription Form State
  const [selectedMedId, setSelectedMedId] = useState('');
  const [dosage, setDosage] = useState('1 tablet');
  const [frequency, setFrequency] = useState('Once daily at night');
  const [duration, setDuration] = useState('30 days');
  const [quantity, setQuantity] = useState(1);

  // Device Pairing State
  const [pairedDeviceCount, setPairedDeviceCount] = useState<number>(0);

  const router = useRouter();

  const [systemCameraOpen, setSystemCameraOpen] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [activeScalpCarouselIdx, setActiveScalpCarouselIdx] = useState(0);
  const [deletingImageFilename, setDeletingImageFilename] = useState<string | null>(null);



  const fetchDoctorData = useCallback(async () => {
    try {
      const [qRes, pRes, aRes, mRes, dRes, sRes] = await Promise.all([
        api.get('/doctor/queue'),
        api.get('/doctor/patients'),
        api.get('/appointments'),
        api.get('/pharmacy/catalogue'),
        api.get('/device-pairing/my-devices').catch(() => ({ data: { data: [] } })),
        api.get('/doctor/settings').catch(() => ({ data: { data: { consultationWorkflow: 'fully_app' } } })),
      ]);
      const queueData = qRes.data.data || [];
      setQueue(queueData);
      setPatients(pRes.data.data || []);
      setAppointments(aRes.data.data || []);
      setMedicines(mRes.data.data || []);
      setPairedDeviceCount((dRes.data.data || []).length);
      if (sRes?.data?.data?.consultationWorkflow) {
        setConsultationWorkflow(sRes.data.data.consultationWorkflow);
      }

      // If active visit not set, auto-select first in progress or waiting
      if (!activeVisit && queueData.length > 0) {
        const inProg = queueData.find((v: Visit) => v.status === 'InProgress') || queueData[0];
        loadVisitIntoWorkbench(inProg);
      }
    } catch {
      toast.error('Failed to load doctor clinical data');
    }
  }, [activeVisit]);

  const handleUpdateWorkflow = async (workflow: 'fully_app' | 'prescription_booklet') => {
    try {
      setSavingWorkflow(true);
      await api.patch('/doctor/settings', { consultationWorkflow: workflow });
      setConsultationWorkflow(workflow);
      toast.success(
        workflow === 'prescription_booklet'
          ? 'Switched to Patient Prescription Booklet Workflow'
          : 'Switched to Fully App Digital Workflow'
      );
    } catch {
      toast.error('Failed to update consultation workflow setting');
    } finally {
      setSavingWorkflow(false);
    }
  };

  useEffect(() => {
    fetchDoctorData();

    const socket = getSocket();
    socket.on('queue:updated', () => fetchDoctorData());
    socket.on('appointment:updated', () => fetchDoctorData());
    socket.on('pairing:photo-captured', (data: any) => {
      toast.success('Scalp photo captured & synchronized!');
      setActiveVisit((prev) => {
        if (!prev) return null;
        if (data.visitId && String(prev._id) !== String(data.visitId)) return prev;
        const updated = data.scalpImages || [...prev.scalpImages, data.filename || data.imageUrl];
        return { ...prev, scalpImages: updated };
      });
    });

    socket.on('visit:image-deleted', (data: any) => {
      setActiveVisit((prev) => {
        if (!prev) return null;
        if (data.visitId && String(prev._id) !== String(data.visitId)) return prev;
        return { ...prev, scalpImages: data.scalpImages };
      });
    });

    return () => {
      socket.off('queue:updated');
      socket.off('appointment:updated');
      socket.off('pairing:photo-captured');
      socket.off('visit:image-deleted');
    };
  }, [fetchDoctorData, activeVisit]);

  const handleOpenMobileCamera = () => {
    if (pairedDeviceCount > 0) {
      toast.info('📱 Your paired mobile device will auto-detect this patient. Check Device Pairing page for status.');
    } else {
      toast.info('📱 No mobile device paired yet. You can manually visit the Device Pairing page from the navigation when ready to pair a phone.');
    }
  };

  const handleDeleteScalpImage = async (filename: string) => {
    if (!activeVisit) return;
    try {
      setDeletingImageFilename(filename);
      const cleanTarget = filename.split('/').pop() || filename;
      const safeFilename = encodeURIComponent(cleanTarget);
      const res = await api.delete(`/doctor/visits/${activeVisit._id}/images/${safeFilename}`);
      if (res.data?.success && res.data.data) {
        setActiveVisit((prev) =>
          prev ? { ...prev, scalpImages: res.data.data.scalpImages } : null
        );
        toast.success('Scalp photo deleted successfully');
      }
    } catch (err) {
      toast.error('Failed to delete scalp photo');
    } finally {
      setDeletingImageFilename(null);
    }
  };

  const loadVisitIntoWorkbench = async (visit: Visit) => {
    setActiveVisit(visit);

    // If visit is in Waiting status, promote it to InProgress in DB so mobile device detects it
    if (visit.status === 'Waiting') {
      api.patch(`/doctor/visits/${visit._id}/start`).then((res) => {
        if (res.data?.data) {
          setActiveVisit(res.data.data);
        }
      }).catch(() => {});
    }

    setChiefComplaint(visit.chiefComplaint || '');
    setDiagnosis(visit.diagnosis || '');
    setClinicalNotes(visit.clinicalNotes || '');
    setHairDensity(visit.hairDensity || 60);
    setAlopeciaStage(visit.alopeciaStage || '');
    setDlqiScore(visit.dlqiScore !== undefined ? visit.dlqiScore : null);
    setScalpHealth(visit.scalpHealth || {});
    const weeks = visit.followUpWeeks || 4;
    setFollowUpWeeks(weeks);
    if (weeks === 1) setFollowUpPreset('1w');
    else if (weeks === 2) setFollowUpPreset('2w');
    else if (weeks === 4) setFollowUpPreset('1m');
    else if (weeks === 8) setFollowUpPreset('2m');
    else if (weeks === 12) setFollowUpPreset('3m');
    else if (weeks === 24) setFollowUpPreset('6m');
    else {
      setFollowUpPreset('custom');
      setCustomIntervalValue(weeks);
      setCustomIntervalUnit('w');
    }
    setPrescriptions(visit.prescriptions || []);
    setProcedures(visit.procedures || []);
    setLabTests(visit.labTests || []);

    const pId = typeof visit.patientId === 'object' ? visit.patientId._id : visit.patientId;
    try {
      const hRes = await api.get(`/doctor/visits/${pId}`);
      setVisitHistory(hRes.data.data || []);
    } catch {}
  };

  const handleStartConsultation = async (visitId: string) => {
    try {
      const res = await api.patch(`/doctor/visits/${visitId}/start`);
      toast.success('Consultation started');
      loadVisitIntoWorkbench(res.data.data);
      setActiveTab('workbench');
      fetchDoctorData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to start consultation');
    }
  };

  const handleSaveConsultation = async (markComplete: boolean = false) => {
    if (!activeVisit) return;
    try {
      const payload: any = {
        chiefComplaint,
        diagnosis,
        clinicalNotes,
        hairDensity,
        alopeciaStage,
        dlqiScore,
        scalpHealth,
        followUpWeeks,
        prescriptions,
        procedures,
        labTests,
        consultationWorkflow,
      };
      if (markComplete) payload.status = 'Completed';

      await api.patch(`/doctor/visits/${activeVisit._id}`, payload);
      toast.success(markComplete ? 'Consultation completed & archived' : 'Clinical notes saved');
      fetchDoctorData();
      if (markComplete) {
        setActiveVisit(null);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to save visit');
    }
  };

  const getDlqiInterpretation = (score: number | null) => {
    if (score === null || score === undefined) return null;
    if (score <= 1) return { label: 'No effect on patient life', badgeVariant: 'success' as const };
    if (score <= 5) return { label: 'Small effect', badgeVariant: 'info' as const };
    if (score <= 10) return { label: 'Moderate effect', badgeVariant: 'warn' as const };
    if (score <= 20) return { label: 'Very large effect', badgeVariant: 'error' as const };
    return { label: 'Extremely large effect', badgeVariant: 'error' as const };
  };

  const getNextVisitDate = (weeks: number) => {
    const d = new Date();
    d.setDate(d.getDate() + weeks * 7);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const getFollowUpLabel = () => {
    if (followUpPreset === '1w') return '1 Week';
    if (followUpPreset === '2w') return '2 Weeks';
    if (followUpPreset === '1m') return '1 Month';
    if (followUpPreset === '2m') return '2 Months';
    if (followUpPreset === '3m') return '3 Months';
    if (followUpPreset === '6m') return '6 Months';
    if (followUpPreset === 'custom') {
      const unitStr = customIntervalUnit === 'd' ? 'Day' : customIntervalUnit === 'w' ? 'Week' : 'Month';
      return `${customIntervalValue} ${unitStr}${customIntervalValue !== 1 ? 's' : ''}`;
    }
    return `${followUpWeeks} Weeks`;
  };

  const getSuggestedReturnDate = () => {
    const d = new Date();
    if (followUpPreset === '1w') d.setDate(d.getDate() + 7);
    else if (followUpPreset === '2w') d.setDate(d.getDate() + 14);
    else if (followUpPreset === '1m') d.setMonth(d.getMonth() + 1);
    else if (followUpPreset === '2m') d.setMonth(d.getMonth() + 2);
    else if (followUpPreset === '3m') d.setMonth(d.getMonth() + 3);
    else if (followUpPreset === '6m') d.setMonth(d.getMonth() + 6);
    else if (followUpPreset === 'custom') {
      const val = Number(customIntervalValue) || 1;
      if (customIntervalUnit === 'd') d.setDate(d.getDate() + val);
      else if (customIntervalUnit === 'w') d.setDate(d.getDate() + val * 7);
      else if (customIntervalUnit === 'm') d.setMonth(d.getMonth() + val);
    }
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const updateCustomWeeks = (val: number, unit: FollowUpUnit) => {
    if (unit === 'd') {
      setFollowUpWeeks(Math.max(1, Math.round(val / 7)));
    } else if (unit === 'w') {
      setFollowUpWeeks(val);
    } else if (unit === 'm') {
      setFollowUpWeeks(val * 4);
    }
  };

  const handleAddPrescription = () => {
    if (!selectedMedId) {
      toast.error('Select a medicine first');
      return;
    }
    const med = medicines.find((m) => m._id === selectedMedId);
    if (!med) return;

    setPrescriptions([
      ...prescriptions,
      {
        medicineId: med._id,
        medicineName: med.name,
        dosage,
        frequency,
        duration,
        quantity,
        isDispensed: false,
      },
    ]);
    setSelectedMedId('');
    toast.success(`Added ${med.name}`);
  };

  const handleRemovePrescription = (index: number) => {
    setPrescriptions(prescriptions.filter((_, idx) => idx !== index));
  };

  const handleAddLabTest = (name: string, notes?: string, fee?: number) => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error('Enter or select a lab test name');
      return;
    }
    const alreadyAdded = labTests.some(
      (t) => t.testName.toLowerCase() === trimmed.toLowerCase()
    );
    if (alreadyAdded) {
      toast.warning(`${trimmed} is already in the orders list`);
      return;
    }
    const newTest: LabTestItem = {
      testName: trimmed,
      notes: notes || '',
      fee: fee || 0,
      status: 'Ordered',
    };
    setLabTests([...labTests, newTest]);
    setCustomTestName('');
    setCustomTestNotes('');
    setCustomTestFee(0);
    toast.success(`Lab Test ordered: ${trimmed}`);
  };

  const handleRemoveLabTest = (index: number) => {
    const test = labTests[index];
    setLabTests(labTests.filter((_, idx) => idx !== index));
    toast.info(`Removed ${test?.testName || 'test'}`);
  };

  const handleToggleDuty = async () => {
    try {
      const next = !isOnDuty;
      await api.patch('/doctor/duty-status', { isOnDuty: next });
      setIsOnDuty(next);
      toast.info(`Status updated: ${next ? 'On Duty' : 'Off Duty'}`);
    } catch {
      toast.error('Failed to toggle duty');
    }
  };

  const handleGeneratePairing = () => {
    router.push('/doctor/device-pair');
  };

  const navGroups = [
    {
      title: 'Clinical Suite',
      items: [
        { id: 'workbench', label: 'Consultation Workbench', icon: Stethoscope },
        { id: 'queue', label: 'Patient Queue', icon: Users, badge: queue.length },
        { id: 'patients', label: 'My Patients', icon: Users },
        { id: 'appointments', label: 'Appointments', icon: Calendar, badge: appointments.length },
        { id: 'pairing', label: 'Device Pairing', icon: QrCode, badge: pairedDeviceCount > 0 ? pairedDeviceCount : undefined },
        { id: 'settings', label: 'Settings', icon: Settings },
      ],
    },
  ];

  // Chart data for hair density progression
  const densityChartData =
    visitHistory.length > 0
      ? [...visitHistory]
          .filter((v) => v.hairDensity)
          .sort((a, b) => new Date(a.visitDate).getTime() - new Date(b.visitDate).getTime())
          .map((v) => ({
            date: new Date(v.visitDate).toLocaleDateString([], { month: 'short', day: 'numeric' }),
            density: v.hairDensity,
          }))
      : [
          { date: 'Month 0', density: 48 },
          { date: 'Month 2', density: 54 },
          { date: 'Month 4', density: 60 },
          { date: 'Month 6', density: 68 },
        ];

  const activePatient = activeVisit?.patientId as Patient | undefined;

  const renderScalpPhototrichogramPanel = () => {
    interface ScalpPhotoMeta {
      filename: string;
      visitId: string;
      visitDate: string | Date;
      visitType?: string;
      isCurrentVisit: boolean;
      diagnosis?: string;
      photoIndex: number;
    }

    const currentVisitPhotos = activeVisit?.scalpImages || [];
    const currentItems: ScalpPhotoMeta[] = currentVisitPhotos.map((img, idx) => ({
      filename: img,
      visitId: activeVisit?._id || '',
      visitDate: activeVisit?.visitDate || new Date(),
      visitType: activeVisit?.visitType || 'Active Consultation',
      isCurrentVisit: true,
      diagnosis: activeVisit?.diagnosis,
      photoIndex: idx + 1,
    })).reverse(); // Newest first

    const pastVisits = (visitHistory || []).filter((v) => v._id !== activeVisit?._id);
    const pastItems: ScalpPhotoMeta[] = pastVisits.flatMap((v) =>
      (v.scalpImages || []).map((img, idx) => ({
        filename: img,
        visitId: v._id,
        visitDate: v.visitDate,
        visitType: v.visitType || 'Past Visit',
        isCurrentVisit: false,
        diagnosis: v.diagnosis,
        photoIndex: idx + 1,
      })).reverse()
    );

    const allCarouselPhotos = [...currentItems, ...pastItems];
    const hasImages = allCarouselPhotos.length > 0;
    const isMaxReached = currentVisitPhotos.length >= 5;

    // Ensure safe index bounds (0 is always the last taken scalp image)
    const safeIndex = Math.min(
      Math.max(0, activeScalpCarouselIdx),
      Math.max(0, allCarouselPhotos.length - 1)
    );
    const currentPhoto = allCarouselPhotos[safeIndex];

    return (
      <Panel
        title="Scalp Phototrichogram Examination"
        subtitle={
          hasImages
            ? `${allCarouselPhotos.length} total patient scalp photos • Showing latest taken image by default`
            : 'No scalp photos added yet for this patient'
        }
        action={
          activePatient ? (
            <button
              type="button"
              onClick={() =>
                router.push(
                  `/doctor/gallery?patientId=${activePatient._id}&visitId=${activeVisit?._id || ''}`
                )
              }
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-teal-500/10 hover:bg-teal-500/20 text-teal-600 dark:text-teal-400 border border-teal-500/20 transition-colors cursor-pointer"
              title="Open Date-wise Gallery and 2-Image Comparison"
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span>View Gallery &amp; Compare</span>
            </button>
          ) : null
        }
      >
        {!hasImages ? (
          /* Empty State */
          <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-[var(--border)] rounded-xl bg-[var(--surface-2)]/40 text-center">
            <div className="w-14 h-14 rounded-2xl bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20 flex items-center justify-center mb-3">
              <ImageIcon className="w-7 h-7" />
            </div>
            <h4 className="text-sm font-bold text-[var(--text)]">No Images Added Yet</h4>
            <p className="text-xs text-[var(--text-dim)] max-w-xs mt-1 mb-5">
              Capture scalp photos to begin clinical phototrichogram comparison tracking. Maximum 5 photos per visit.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-sm">
              <button
                type="button"
                onClick={() => setSystemCameraOpen(true)}
                disabled={isMaxReached}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-semibold text-xs transition-colors shadow-md disabled:opacity-50 cursor-pointer"
              >
                <Camera className="w-4 h-4" />
                <span>System Camera</span>
              </button>

              <button
                type="button"
                onClick={handleOpenMobileCamera}
                disabled={isMaxReached}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-[var(--text)] border border-[var(--border)] font-semibold text-xs transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
              >
                <Smartphone className="w-4 h-4" />
                <span>Mobile Camera</span>
              </button>
            </div>
          </div>
        ) : (
          /* Carousel View */
          <div className="space-y-4">
            {/* Main Stage Image */}
            <div className="relative aspect-4/3 rounded-xl overflow-hidden bg-black border border-[var(--border)] shadow-inner group">
              <img
                src={getMediaUrl(currentPhoto.filename)}
                alt="Scalp Examination"
                className="w-full h-full object-cover cursor-pointer"
                onClick={() => {
                  setLightboxIndex(safeIndex);
                  setLightboxImages(allCarouselPhotos.map((p) => p.filename));
                  setLightboxOpen(true);
                }}
              />

              {/* Tag: Newest Scalp Image / Date / Visit type */}
              <div className="absolute top-2.5 left-2.5 flex flex-wrap gap-1.5 z-10 pointer-events-none">
                {safeIndex === 0 && (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold font-mono tracking-wider bg-teal-500 text-black shadow-md flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    LAST TAKEN SCALP IMAGE
                  </span>
                )}
                <span className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-black/60 backdrop-blur-xs text-white border border-white/20">
                  {new Date(currentPhoto.visitDate).toLocaleDateString([], {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-black/60 backdrop-blur-xs text-white border border-white/20">
                  {currentPhoto.visitType}
                </span>
              </div>

              {/* Index counter top right */}
              <div className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-md text-[10px] font-mono bg-black/60 backdrop-blur-xs text-white border border-white/20 z-10 pointer-events-none">
                {safeIndex + 1} / {allCarouselPhotos.length}
              </div>

              {/* Navigation Arrows */}
              {allCarouselPhotos.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveScalpCarouselIdx((prev) => Math.max(0, prev - 1));
                    }}
                    disabled={safeIndex === 0}
                    className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center transition-all disabled:opacity-20 disabled:pointer-events-none shadow-md cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveScalpCarouselIdx((prev) =>
                        Math.min(allCarouselPhotos.length - 1, prev + 1)
                      );
                    }}
                    disabled={safeIndex === allCarouselPhotos.length - 1}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center transition-all disabled:opacity-20 disabled:pointer-events-none shadow-md cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </>
              )}

              {/* Hover Overlay Controls */}
              <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1.5 opacity-90 group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  onClick={() => {
                    setLightboxIndex(safeIndex);
                    setLightboxImages(allCarouselPhotos.map((p) => p.filename));
                    setLightboxOpen(true);
                  }}
                  className="p-1.5 rounded-lg bg-black/60 hover:bg-black/90 text-white border border-white/20 shadow-md cursor-pointer"
                  title="Enlarge Photo"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Carousel Thumbnails Bar */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
              {allCarouselPhotos.map((p, idx) => {
                const isSelected = idx === safeIndex;
                return (
                  <button
                    key={`${p.filename}-${idx}`}
                    type="button"
                    onClick={() => setActiveScalpCarouselIdx(idx)}
                    className={`relative shrink-0 w-12 h-12 rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${
                      isSelected
                        ? 'border-teal-500 ring-2 ring-teal-500/30 shadow-md'
                        : 'border-[var(--border)] opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img
                      src={getMediaUrl(p.filename)}
                      alt="Thumbnail"
                      className="w-full h-full object-cover"
                    />
                    {idx === 0 && (
                      <span className="absolute bottom-0 inset-x-0 bg-teal-600 text-[8px] font-bold text-black text-center py-0.2">
                        NEW
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Quick Capture Bar inside Panel */}
            <div className="p-3 bg-[var(--surface-2)] border border-[var(--border)] rounded-xl flex items-center justify-between gap-3">
              <span className="text-xs font-mono text-[var(--text-dim)]">
                Active Visit: <strong className="text-[var(--text)]">{currentVisitPhotos.length} / 5</strong>
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSystemCameraOpen(true)}
                  disabled={isMaxReached}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>System Camera</span>
                </button>

                <button
                  type="button"
                  onClick={handleOpenMobileCamera}
                  title={
                    pairedDeviceCount > 0
                      ? `${pairedDeviceCount} device(s) paired — auto-captures for active patient`
                      : 'Pair a mobile device for photo capture'
                  }
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg ${
                    pairedDeviceCount > 0
                      ? 'bg-emerald-600/15 border-emerald-500/30 text-emerald-500'
                      : 'bg-[var(--surface-2)] hover:bg-[var(--surface-3)] border-[var(--border)] text-[var(--text)]'
                  } border text-xs font-semibold transition-colors cursor-pointer`}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>{pairedDeviceCount > 0 ? `${pairedDeviceCount} Paired` : 'Pair Mobile'}</span>
                </button>
              </div>
            </div>

            {/* Active Visit Photos Thumbnails with Delete button */}
            {currentVisitPhotos.length > 0 && (
              <div className="pt-2">
                <p className="text-[11px] font-semibold text-[var(--text-dim)] mb-1.5">
                  Current Visit Scalp Photos (Click to Zoom / Delete):
                </p>
                <div className="flex items-center gap-2 overflow-x-auto py-1">
                  {currentVisitPhotos.map((img, idx) => (
                    <div
                      key={img}
                      className="relative group w-14 h-14 rounded-lg overflow-hidden border border-[var(--border)] shrink-0 bg-black"
                    >
                      <img
                        src={getMediaUrl(img)}
                        alt={`Visit photo ${idx + 1}`}
                        className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={() => {
                          setLightboxIndex(idx);
                          setLightboxImages(currentVisitPhotos);
                          setLightboxOpen(true);
                        }}
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteScalpImage(img);
                        }}
                        disabled={deletingImageFilename === img}
                        title="Delete photo"
                        className="absolute top-0.5 right-0.5 z-10 p-1 rounded-md bg-red-600 hover:bg-red-500 text-white shadow-md transition-all opacity-80 hover:opacity-100 cursor-pointer"
                      >
                        {deletingImageFilename === img ? (
                          <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-2.5 h-2.5" />
                        )}
                      </button>
                      <span className="absolute bottom-0.5 left-1 text-[9px] font-bold text-white bg-black/70 px-1 rounded pointer-events-none">
                        #{idx + 1}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Panel>
    );
  };

  return (
    <AppShell
      navGroups={navGroups}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      pageTitle="Doctor Consultation Terminal"
      topbarActions={
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleToggleDuty}
            className={`px-3 py-1 text-xs font-mono rounded border flex items-center gap-1.5 transition-all ${
              isOnDuty
                ? 'bg-[var(--success-bg)] text-[var(--success)] border-[var(--success)]/40'
                : 'bg-[var(--surface-2)] text-[var(--text-dim)] border-[var(--border)]'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${isOnDuty ? 'bg-[var(--success)] animate-pulse' : 'bg-gray-500'}`} />
            {isOnDuty ? 'ON DUTY' : 'OFF DUTY'}
          </button>
        </div>
      }
    >
      {/* ================= WORKBENCH TAB ================= */}
      {activeTab === 'workbench' && (
        <div className="space-y-6">
          {activeVisit && activePatient ? (
            <>
              {/* Patient Banner Bar */}
              <div className="surface-card p-4 flex flex-wrap items-center justify-between gap-4 border-l-4 border-[var(--brass)]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[var(--brass)]/20 border border-[var(--brass)] flex items-center justify-center font-display font-bold text-sm text-[var(--brass)]">
                    {activePatient.name?.charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-display font-bold text-base text-[var(--text)]">
                        {activePatient.name}
                      </h2>
                      {(() => {
                        const age = activePatient.dateOfBirth
                          ? Math.floor((new Date().getTime() - new Date(activePatient.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
                          : null;
                        return (
                          <Badge variant="brass">
                            {activePatient.gender || 'Patient'}{age ? ` • ${age} yrs` : ''}
                          </Badge>
                        );
                      })()}
                      <Badge variant={activeVisit.visitType === 'FirstVisit' ? 'warn' : 'neutral'}>
                        {activeVisit.visitType === 'FirstVisit' ? 'Initial Visit' : 'Follow-up'}
                      </Badge>
                      {activeVisit.visitCount && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20">
                          Visit #{activeVisit.visitCount}
                        </span>
                      )}
                      {activePatient.bloodGroup && (
                        <Badge variant="info">Blood: {activePatient.bloodGroup}</Badge>
                      )}
                    </div>
                    <span className="font-mono text-xs text-[var(--text-dim)]">
                      ID: {activePatient.patientId} • Phone: +91 {activePatient.phone}
                      {activePatient.location ? ` • ${activePatient.location}` : ''}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleSaveConsultation(false)}
                    className="btn-surface px-3 py-1.5 rounded text-xs font-mono flex items-center gap-1"
                  >
                    <Save className="w-3.5 h-3.5" />
                    Save Notes
                  </button>
                  <button
                    onClick={() => handleSaveConsultation(true)}
                    className="btn-brass px-4 py-1.5 rounded text-xs font-mono font-bold flex items-center gap-1.5"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Complete Visit
                  </button>
                </div>
              </div>

              {/* Patient Vitals Strip: Weight, Height, BMI & Link to History Graph */}
              {(() => {
                const weightKg = activeVisit.weightKg;
                const heightCm = activeVisit.heightCm || activePatient.heightCm;
                let bmi: number | null = null;
                let bmiCategory: { label: string; badgeVariant: 'success' | 'warn' | 'error' } | null = null;

                if (weightKg && heightCm && heightCm > 0) {
                  const heightM = heightCm / 100;
                  bmi = Number((weightKg / (heightM * heightM)).toFixed(1));
                  if (bmi < 18.5) {
                    bmiCategory = { label: 'Underweight', badgeVariant: 'warn' };
                  } else if (bmi < 25) {
                    bmiCategory = { label: 'Normal', badgeVariant: 'success' };
                  } else if (bmi < 30) {
                    bmiCategory = { label: 'Overweight', badgeVariant: 'warn' };
                  } else {
                    bmiCategory = { label: 'Obese', badgeVariant: 'error' };
                  }
                }

                return (
                  <div className="surface-card p-3.5 flex flex-wrap items-center justify-between gap-3 border border-[var(--border)] bg-[var(--surface-2)]">
                    <div className="flex flex-wrap items-center gap-6 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider">Weight:</span>
                        <strong className="font-mono text-[var(--text)] font-semibold">
                          {weightKg ? `${weightKg} kg` : <span className="text-[var(--text-dim)] font-normal text-xs">Not recorded</span>}
                        </strong>
                      </div>

                      <div className="h-4 w-px bg-[var(--border)] hidden sm:block" />

                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider">Height:</span>
                        <strong className="font-mono text-[var(--text)] font-semibold">
                          {heightCm ? `${heightCm} cm` : <span className="text-[var(--text-dim)] font-normal text-xs">Not recorded</span>}
                        </strong>
                      </div>

                      <div className="h-4 w-px bg-[var(--border)] hidden sm:block" />

                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider">BMI:</span>
                        {bmi ? (
                          <div className="flex items-center gap-1.5">
                            <strong className="font-mono text-[var(--brass)] font-bold">{bmi} kg/m²</strong>
                            {bmiCategory && <Badge variant={bmiCategory.badgeVariant}>{bmiCategory.label}</Badge>}
                          </div>
                        ) : (
                          <span className="font-mono text-xs text-[var(--text-dim)]">N/A</span>
                        )}
                      </div>

                      {activePatient.maritalStatus && (
                        <>
                          <div className="h-4 w-px bg-[var(--border)] hidden sm:block" />
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider">Marital Status:</span>
                            <span className="font-mono text-xs text-[var(--text)]">{activePatient.maritalStatus}</span>
                          </div>
                        </>
                      )}
                    </div>

                    <a
                      href={`/doctor/vitals/${activePatient._id}`}
                      className="px-3 py-1.5 bg-[var(--surface)] hover:bg-[var(--surface-card)] border border-[var(--brass)]/40 hover:border-[var(--brass)] text-[var(--brass)] text-xs font-mono rounded flex items-center gap-1.5 transition-all shadow-sm"
                    >
                      <Activity className="w-3.5 h-3.5 text-[var(--brass)]" />
                      <span>View Vitals History &amp; Graph →</span>
                    </a>
                  </div>
                );
              })()}

              {consultationWorkflow === 'prescription_booklet' ? (
                /* Patient Prescription Booklet Streamlined Terminal */
                <div className="space-y-6">
                  {/* Booklet Workflow Banner */}
                  <div className="surface-card p-4 border border-[var(--brass)]/40 bg-[var(--brass)]/5 rounded-xl flex flex-wrap items-center justify-between gap-3 shadow-xs">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[var(--brass)]/15 border border-[var(--brass)]/30 flex items-center justify-center text-[var(--brass)] shrink-0 text-xl shadow-xs">
                        📖
                      </div>
                      <div>
                        <h4 className="font-display font-bold text-sm text-[var(--text)] flex items-center gap-2">
                          <span>Patient Prescription Booklet Workflow Active</span>
                          <Badge variant="brass">Hybrid Paper &amp; Digital</Badge>
                        </h4>
                        <p className="text-xs text-[var(--text-dim)] mt-0.5 max-w-2xl">
                          Clinical diagnosis, alopecia stage &amp; checklist, and prescriptions are recorded manually on the physical patient prescription booklet. Use the scalp imaging suite below for trichogram examinations.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab('settings')}
                      className="btn-surface px-3 py-1.5 rounded text-xs font-mono flex items-center gap-1.5 text-[var(--brass)] hover:text-[var(--text)] border border-[var(--brass)]/40 cursor-pointer"
                    >
                      <Settings className="w-3.5 h-3.5" />
                      <span>Change Workflow</span>
                    </button>
                  </div>

                  {/* Scalp Phototrichogram Examination Component */}
                  <div className="max-w-4xl mx-auto w-full space-y-6">
                    {renderScalpPhototrichogramPanel()}
                  </div>
                </div>
              ) : (
                /* Fully App Workflow Layout (Original 2-Column Clinical Terminal) */
                <>
                  {/* Quick Workbench Clinical Toolkit Bar */}
                  <div className="surface-card p-3 flex flex-wrap items-center justify-between gap-3 border border-[var(--border)] bg-[var(--surface-2)]/70">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-xs font-mono uppercase tracking-wider text-[var(--brass)] font-semibold flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[var(--brass)]" />
                    Trichology Staging &amp; Metrics:
                  </span>

                  {/* Alopecia Stage Badge */}
                  <div className="flex items-center gap-1.5 bg-[var(--surface)] px-2.5 py-1 rounded border border-[var(--border)] text-xs font-mono">
                    <span className="text-[var(--text-dim)]">Stage:</span>
                    <strong className="text-[var(--brass)] font-semibold">
                      {alopeciaStage || 'Unstaged'}
                    </strong>
                  </div>

                  {/* DLQI Score Badge */}
                  <div className="flex items-center gap-1.5 bg-[var(--surface)] px-2.5 py-1 rounded border border-[var(--border)] text-xs font-mono">
                    <span className="text-[var(--text-dim)]">DLQI:</span>
                    {dlqiScore !== null ? (
                      <span className="text-[var(--text)] font-semibold flex items-center gap-1">
                        {dlqiScore}/30
                        <Badge variant={getDlqiInterpretation(dlqiScore)?.badgeVariant || 'neutral'}>
                          {getDlqiInterpretation(dlqiScore)?.label}
                        </Badge>
                      </span>
                    ) : (
                      <span className="text-[var(--text-dim)]">Not assessed</span>
                    )}
                  </div>

                  {/* Follow-up Planner Badge */}
                  <div className="flex items-center gap-1.5 bg-[var(--surface)] px-2.5 py-1 rounded border border-[var(--border)] text-xs font-mono">
                    <Clock className="w-3 h-3 text-[var(--text-dim)]" />
                    <span className="text-[var(--text-dim)]">Review:</span>
                    <span className="text-[var(--text)] font-semibold">
                      {getFollowUpLabel()} ({getSuggestedReturnDate()})
                    </span>
                  </div>
                </div>
              </div>

              {/* Grid 2 Columns: Clinical Left, Trichology Right */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left Column: Diagnosis & Rx (7 cols) */}
                <div className="lg:col-span-7 space-y-6">
                  {/* Diagnosis and Notes */}
                  <Panel title="Clinical Assessment & Diagnosis">
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider mb-1">
                          Chief Complaint
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Diffuse vertex thinning, receding hairline..."
                          value={chiefComplaint}
                          onChange={(e) => setChiefComplaint(e.target.value)}
                          className="w-full px-3 py-2 text-sm bg-[var(--surface-2)] border border-[var(--border)] rounded-md text-[var(--text)] focus:outline-none focus:border-[var(--brass)]"
                        />
                      </div>

                      {/* Alopecia Staging Selector */}
                      <div className="p-3 bg-[var(--surface)] border border-[var(--border)] rounded-md space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="block text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider font-semibold">
                            {activePatient.gender === 'Female' ? 'Ludwig / Sinclair Scale (Female Pattern)' : 'Norwood-Hamilton Staging (Male Pattern)'}
                          </label>
                          {alopeciaStage && (
                            <button
                              type="button"
                              onClick={() => setAlopeciaStage('')}
                              className="text-[10px] font-mono text-[var(--text-dim)] hover:text-[var(--text)]"
                            >
                              Clear
                            </button>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {(activePatient.gender === 'Female' ? LUDWIG_STAGES : NORWOOD_STAGES).map((item) => {
                            const isSelected = alopeciaStage === item.stage;
                            return (
                              <button
                                key={item.stage}
                                type="button"
                                onClick={() => {
                                  setAlopeciaStage(item.stage);
                                  if (!diagnosis) {
                                    setDiagnosis(
                                      activePatient.gender === 'Female'
                                        ? `Female Pattern Hair Loss (${item.stage})`
                                        : `Androgenetic Alopecia (${item.stage})`
                                    );
                                  }
                                }}
                                title={item.desc}
                                className={`px-2.5 py-1 text-xs rounded border font-mono transition-all text-left ${
                                  isSelected
                                    ? 'bg-[var(--brass)] text-black border-[var(--brass)] font-bold shadow-xs'
                                    : 'bg-[var(--surface-2)] text-[var(--text)] border-[var(--border)] hover:border-[var(--brass)]/60'
                                }`}
                              >
                                {item.stage}
                              </button>
                            );
                          })}
                        </div>
                        {alopeciaStage && (
                          <p className="text-[11px] font-mono text-[var(--brass)]/80 italic mt-1">
                            • {(activePatient.gender === 'Female' ? LUDWIG_STAGES : NORWOOD_STAGES).find((s) => s.stage === alopeciaStage)?.desc}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider mb-1">
                          Clinical Diagnosis
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Androgenetic Alopecia (Norwood Grade 3)"
                          value={diagnosis}
                          onChange={(e) => setDiagnosis(e.target.value)}
                          className="w-full px-3 py-2 text-sm bg-[var(--surface-2)] border border-[var(--border)] rounded-md text-[var(--text)] focus:outline-none focus:border-[var(--brass)] font-semibold text-[var(--brass)]"
                        />
                      </div>

                      {/* Scalp Health Clinical Signs Checklist */}
                      <div className="p-3 bg-[var(--surface)] border border-[var(--border)] rounded-md space-y-3">
                        <div className="flex items-center justify-between">
                          <label className="block text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider font-semibold">
                            Scalp Health &amp; Trichoscopy Signs Checklist
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              const summary = `Scalp Exam: Dandruff: ${scalpHealth.dandruff || 'Normal'}, Erythema: ${scalpHealth.erythema || 'Absent'}, Pull Test: ${scalpHealth.pullTest || 'Negative'}, Sebum: ${scalpHealth.sebum || 'Normal'}.`;
                              setClinicalNotes((prev) => (prev ? `${prev}\n${summary}` : summary));
                              toast.success('Scalp examination copied to clinical notes');
                            }}
                            className="text-[11px] font-mono text-[var(--brass)] hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <Check className="w-3 h-3" />
                            Sync to Notes
                          </button>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                          {/* Dandruff */}
                          <div className="space-y-1">
                            <span className="text-[11px] font-mono text-[var(--text-dim)] block">Dandruff / Scaling:</span>
                            <select
                              value={scalpHealth.dandruff || 'None'}
                              onChange={(e) => setScalpHealth((prev) => ({ ...prev, dandruff: e.target.value }))}
                              className="w-full px-2 py-1 text-xs bg-[var(--surface-2)] border border-[var(--border)] rounded text-[var(--text)] font-mono"
                            >
                              <option value="None">None</option>
                              <option value="Mild">Mild</option>
                              <option value="Moderate">Moderate</option>
                              <option value="Severe">Severe</option>
                            </select>
                          </div>

                          {/* Erythema */}
                          <div className="space-y-1">
                            <span className="text-[11px] font-mono text-[var(--text-dim)] block">Erythema:</span>
                            <select
                              value={scalpHealth.erythema || 'Absent'}
                              onChange={(e) => setScalpHealth((prev) => ({ ...prev, erythema: e.target.value }))}
                              className="w-full px-2 py-1 text-xs bg-[var(--surface-2)] border border-[var(--border)] rounded text-[var(--text)] font-mono"
                            >
                              <option value="Absent">Absent</option>
                              <option value="Perifollicular">Perifollicular</option>
                              <option value="Diffuse">Diffuse</option>
                            </select>
                          </div>

                          {/* Hair Pull Test */}
                          <div className="space-y-1">
                            <span className="text-[11px] font-mono text-[var(--text-dim)] block">Pull Test:</span>
                            <select
                              value={scalpHealth.pullTest || 'Negative (<6 hairs)'}
                              onChange={(e) => setScalpHealth((prev) => ({ ...prev, pullTest: e.target.value }))}
                              className="w-full px-2 py-1 text-xs bg-[var(--surface-2)] border border-[var(--border)] rounded text-[var(--text)] font-mono"
                            >
                              <option value="Negative (<6 hairs)">Negative (&lt;6)</option>
                              <option value="Positive (≥6 hairs)">Positive (≥6)</option>
                            </select>
                          </div>

                          {/* Sebum */}
                          <div className="space-y-1">
                            <span className="text-[11px] font-mono text-[var(--text-dim)] block">Scalp Sebum:</span>
                            <select
                              value={scalpHealth.sebum || 'Normal'}
                              onChange={(e) => setScalpHealth((prev) => ({ ...prev, sebum: e.target.value }))}
                              className="w-full px-2 py-1 text-xs bg-[var(--surface-2)] border border-[var(--border)] rounded text-[var(--text)] font-mono"
                            >
                              <option value="Dry">Dry</option>
                              <option value="Normal">Normal</option>
                              <option value="Oily">Oily</option>
                            </select>
                          </div>
                        </div>
                      </div>

                      {/* DLQI Quality-of-Life Score & Follow-Up Planner */}
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 p-3 bg-[var(--surface)] border border-[var(--border)] rounded-md">
                        {/* DLQI Slider */}
                        <div className="sm:col-span-6 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <label className="block text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider font-semibold">
                              DLQI Score: {dlqiScore !== null ? `${dlqiScore}/30` : 'Not set'}
                            </label>
                            {dlqiScore !== null && (
                              <Badge variant={getDlqiInterpretation(dlqiScore)?.badgeVariant || 'neutral'}>
                                {getDlqiInterpretation(dlqiScore)?.label}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            <input
                              type="range"
                              min={0}
                              max={30}
                              value={dlqiScore ?? 0}
                              onChange={(e) => setDlqiScore(parseInt(e.target.value))}
                              className="w-full accent-[var(--brass)]"
                            />
                          </div>
                          <span className="text-[10px] font-mono text-[var(--text-dim)] block">
                            0-1: No effect • 2-5: Small • 6-10: Moderate • 11-20: Large • 21-30: Very large
                          </span>
                        </div>

                        {/* Follow-up Planner */}
                        <div className="sm:col-span-6 space-y-1.5">
                          <label className="block text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider font-semibold">
                            Follow-Up Interval: {getFollowUpLabel()}
                          </label>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {(['1w', '2w', '1m', '2m', '3m', '6m', 'custom'] as const).map((opt) => (
                              <button
                                key={opt}
                                type="button"
                                onClick={() => {
                                  setFollowUpPreset(opt);
                                  if (opt === '1w') setFollowUpWeeks(1);
                                  else if (opt === '2w') setFollowUpWeeks(2);
                                  else if (opt === '1m') setFollowUpWeeks(4);
                                  else if (opt === '2m') setFollowUpWeeks(8);
                                  else if (opt === '3m') setFollowUpWeeks(12);
                                  else if (opt === '6m') setFollowUpWeeks(24);
                                  else {
                                    updateCustomWeeks(customIntervalValue, customIntervalUnit);
                                  }
                                }}
                                className={`px-2.5 py-1 text-xs font-mono rounded border transition-all ${
                                  followUpPreset === opt
                                    ? 'bg-[var(--brass)] text-black font-bold border-[var(--brass)] shadow-xs'
                                    : 'bg-[var(--surface-2)] text-[var(--text)] border-[var(--border)] hover:border-[var(--brass)]/60'
                                }`}
                              >
                                {opt === 'custom' ? 'custom' : opt}
                              </button>
                            ))}

                            {/* Custom Input & Unit Dropdown containing d, w, m */}
                            {followUpPreset === 'custom' && (
                              <div className="flex items-center gap-1 ml-1 bg-[var(--surface-2)] p-0.5 rounded border border-[var(--brass)]/50 shadow-xs">
                                <input
                                  type="number"
                                  min="1"
                                  max="365"
                                  value={customIntervalValue}
                                  onChange={(e) => {
                                    const val = Math.max(1, parseInt(e.target.value) || 1);
                                    setCustomIntervalValue(val);
                                    updateCustomWeeks(val, customIntervalUnit);
                                  }}
                                  className="w-14 px-2 py-0.5 text-xs font-mono bg-[var(--surface-3)] border border-[var(--border)] rounded text-[var(--text)] text-center focus:outline-none focus:border-[var(--brass)]"
                                  placeholder="10"
                                />
                                <select
                                  value={customIntervalUnit}
                                  onChange={(e) => {
                                    const unit = e.target.value as FollowUpUnit;
                                    setCustomIntervalUnit(unit);
                                    updateCustomWeeks(customIntervalValue, unit);
                                  }}
                                  className="px-2 py-0.5 text-xs font-mono bg-[var(--surface-3)] border border-[var(--border)] rounded text-[var(--text)] focus:outline-none cursor-pointer font-bold"
                                >
                                  <option value="d">d</option>
                                  <option value="w">w</option>
                                  <option value="m">m</option>
                                </select>
                              </div>
                            )}
                          </div>
                          <span className="text-[11px] font-mono text-[var(--brass)] block">
                            🗓️ Suggested return: {getSuggestedReturnDate()}
                          </span>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider mb-1">
                          Clinical &amp; Trichoscopy Notes
                        </label>
                        <textarea
                          rows={3}
                          placeholder="Dermatoscopic findings, follicle density per cm², miniaturization ratio, treatment response..."
                          value={clinicalNotes}
                          onChange={(e) => setClinicalNotes(e.target.value)}
                          className="w-full px-3 py-2 text-sm bg-[var(--surface-2)] border border-[var(--border)] rounded-md text-[var(--text)] focus:outline-none focus:border-[var(--brass)]"
                        />
                      </div>
                    </div>
                  </Panel>

                  {/* Prescription Builder */}
                  <Panel title="E-Prescription & Pharmacy Dispense Order">
                    <div className="space-y-4">
                      {/* Allergy and Contraindication Safety Warnings */}
                      {(() => {
                        const hasAllergies = activePatient.allergies && activePatient.allergies.length > 0;
                        const hasTeratogenWarning =
                          activePatient.gender === 'Female' &&
                          prescriptions.some((p) => {
                            const n = (p.medicineName || '').toLowerCase();
                            return (
                              n.includes('finasteride') ||
                              n.includes('dutasteride') ||
                              n.includes('duman') ||
                              n.includes('duttos')
                            );
                          });

                        if (!hasAllergies && !hasTeratogenWarning) return null;

                        return (
                          <div className="space-y-2">
                            {hasAllergies && (
                              <div className="p-2.5 bg-red-500/10 border border-red-500/30 rounded flex items-start gap-2.5 text-xs text-red-400">
                                <AlertTriangle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
                                <div>
                                  <strong className="font-semibold block">Patient Allergy Alert:</strong>
                                  <span>Recorded allergies: {activePatient.allergies?.join(', ')}. Please verify cross-reactivity before dispensing.</span>
                                </div>
                              </div>
                            )}

                            {hasTeratogenWarning && (
                              <div className="p-2.5 bg-amber-500/10 border border-amber-500/40 rounded flex items-start gap-2.5 text-xs text-amber-300">
                                <ShieldAlert className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                                <div>
                                  <strong className="font-semibold block">⚠️ Teratogenic Caution (5-AR Inhibitor):</strong>
                                  <span>Finasteride &amp; Dutasteride are category-X teratogens contraindicated in women of childbearing potential due to risk of male fetal genital malformation.</span>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {/* Prescribed List */}
                      {prescriptions.length > 0 ? (
                        <div className="space-y-2">
                          {prescriptions.map((p, idx) => {
                            const med = medicines.find(
                              (m) =>
                                (p.medicineId && m._id === p.medicineId) ||
                                m.name.toLowerCase() === p.medicineName.toLowerCase()
                            );
                            return (
                              <div
                                key={idx}
                                className="p-2.5 bg-[var(--surface-2)] border border-[var(--border)] rounded flex justify-between items-center text-xs gap-3"
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  {med?.imageUrl ? (
                                    <img
                                      src={getMediaUrl(med.imageUrl)}
                                      alt={p.medicineName}
                                      className="w-9 h-9 object-cover rounded border border-[var(--border)] shrink-0 bg-white shadow-xs"
                                    />
                                  ) : (
                                    <div className="w-9 h-9 rounded bg-[var(--surface-3)] border border-[var(--border)] flex items-center justify-center shrink-0 text-sm shadow-xs">
                                      💊
                                    </div>
                                  )}
                                  <div className="min-w-0">
                                    <strong className="font-semibold text-xs text-[var(--text)] block truncate">
                                      {p.medicineName}
                                    </strong>
                                    <span className="font-mono text-[11px] text-[var(--text-dim)] block truncate">
                                      {p.dosage} • {p.frequency} • {p.duration} (Qty: {p.quantity})
                                    </span>
                                  </div>
                                </div>
                                <button
                                  onClick={() => handleRemovePrescription(idx)}
                                  className="text-[var(--error)] hover:bg-[var(--surface-3)] p-1 rounded shrink-0"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="font-mono text-xs text-[var(--text-dim)] text-center py-2">
                          No medicines added yet.
                        </p>
                      )}

                      {/* Add Form */}
                      <div className="p-3 bg-[var(--surface-2)]/60 border border-[var(--border)] rounded space-y-3">
                        <span className="block font-mono text-xs text-[var(--brass)] uppercase font-semibold">
                          + Add Medicine to Prescription
                        </span>
                        <div>
                          <MedicineSearchDropdown
                            medicines={medicines}
                            selectedMedicineId={selectedMedId}
                            onSelectMedicine={(med) => {
                              setSelectedMedId(med._id);
                              if (med.category === 'Tablet' || med.category === 'Capsule') {
                                setDosage('1 tablet');
                                setFrequency('Once daily at night');
                              } else if (med.category === 'Serum' || med.category === 'Solution') {
                                setDosage('Apply 1 ml');
                                setFrequency('Once daily at night on scalp');
                              } else if (med.category === 'Shampoo') {
                                setDosage('Lather and leave 5 mins');
                                setFrequency('2-3 times per week');
                              } else if (med.category === 'Lotion' || med.category === 'Ointment') {
                                setDosage('Apply thin film');
                                setFrequency('Twice daily on affected area');
                              }
                            }}
                            onlyInStock={false}
                          />
                        </div>

                        {/* Selected Medicine Preview Card */}
                        {(() => {
                          const selectedMed = medicines.find((m) => m._id === selectedMedId);
                          if (!selectedMed) return null;
                          return (
                            <div className="flex items-center gap-3 p-2 bg-[var(--surface)] border border-[var(--border)] rounded-md">
                              {selectedMed.imageUrl ? (
                                <img
                                  src={getMediaUrl(selectedMed.imageUrl)}
                                  alt={selectedMed.name}
                                  className="w-12 h-12 object-cover rounded-md border border-[var(--border)] shrink-0 bg-white shadow-xs"
                                />
                              ) : (
                                <div className="w-12 h-12 rounded-md bg-[var(--surface-3)] border border-[var(--border)] flex items-center justify-center shrink-0 text-xl shadow-xs">
                                  💊
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <strong className="text-xs font-semibold text-[var(--text)] truncate">{selectedMed.name}</strong>
                                  <Badge variant="brass" size="sm">{selectedMed.category}</Badge>
                                </div>
                                <span className="text-[11px] font-mono text-[var(--text-dim)] block truncate">
                                  {selectedMed.genericName || 'Standard Formulation'} • ₹{selectedMed.sellingPrice} / {selectedMed.unit}
                                </span>
                                <span className="text-[10px] font-mono text-[var(--brass)] block">
                                  Stock: {selectedMed.totalStock} {selectedMed.unit} available
                                </span>
                              </div>
                            </div>
                          );
                        })()}

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          <div>
                            <input
                              type="text"
                              placeholder="Dosage"
                              value={dosage}
                              onChange={(e) => setDosage(e.target.value)}
                              className="w-full px-2.5 py-1.5 text-xs bg-[var(--surface-2)] border border-[var(--border)] rounded text-[var(--text)]"
                            />
                          </div>
                          <div>
                            <input
                              type="text"
                              placeholder="Frequency"
                              value={frequency}
                              onChange={(e) => setFrequency(e.target.value)}
                              className="w-full px-2.5 py-1.5 text-xs bg-[var(--surface-2)] border border-[var(--border)] rounded text-[var(--text)]"
                            />
                          </div>
                          <div>
                            <input
                              type="text"
                              placeholder="Duration"
                              value={duration}
                              onChange={(e) => setDuration(e.target.value)}
                              className="w-full px-2.5 py-1.5 text-xs bg-[var(--surface-2)] border border-[var(--border)] rounded text-[var(--text)]"
                            />
                          </div>
                          <div>
                            <input
                              type="number"
                              min={1}
                              placeholder="Qty"
                              value={quantity}
                              onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                              className="w-full px-2.5 py-1.5 text-xs bg-[var(--surface-2)] border border-[var(--border)] rounded text-[var(--text)] font-mono"
                            />
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={handleAddPrescription}
                          className="btn-brass px-3 py-1.5 rounded text-xs font-mono flex items-center gap-1"
                        >
                          <Plus className="w-3.5 h-3.5" /> Add to Order
                        </button>
                      </div>
                    </div>
                  </Panel>

                  {/* Dermatology & Trichology Lab Test Orders */}
                  <Panel
                    title={
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-2">
                          <FlaskConical className="w-4 h-4 text-[var(--brass)]" />
                          <span>Dermatology &amp; Scalp Lab Test Orders</span>
                        </div>
                        {labTests.length > 0 && (
                          <Badge variant="brass" size="sm">
                            {labTests.length} Ordered
                          </Badge>
                        )}
                      </div>
                    }
                  >
                    <div className="space-y-4">
                      {/* Ordered Tests List */}
                      {labTests.length > 0 ? (
                        <div className="space-y-2">
                          {labTests.map((t, idx) => (
                            <div
                              key={idx}
                              className="p-2.5 bg-[var(--surface-2)] border border-[var(--border)] rounded flex justify-between items-center text-xs gap-3"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-8 h-8 rounded bg-[var(--surface-3)] border border-[var(--border)] flex items-center justify-center shrink-0 text-[var(--brass)]">
                                  <FlaskConical className="w-4 h-4" />
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <strong className="font-semibold text-xs text-[var(--text)] truncate">
                                      {t.testName}
                                    </strong>
                                    <Badge variant="brass" size="sm">
                                      {t.status || 'Ordered'}
                                    </Badge>
                                    {(t.fee || 0) > 0 && (
                                      <span className="font-mono text-[11px] text-[var(--brass)] font-semibold">
                                        ₹{t.fee}
                                      </span>
                                    )}
                                  </div>
                                  {t.notes && (
                                    <span className="font-mono text-[11px] text-[var(--text-dim)] block truncate">
                                      Indication: {t.notes}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <button
                                onClick={() => handleRemoveLabTest(idx)}
                                className="text-[var(--error)] hover:bg-[var(--surface-3)] p-1 rounded shrink-0 transition-colors"
                                title="Remove test"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-3 bg-[var(--surface-2)]/30 rounded border border-dashed border-[var(--border)]">
                          <FlaskConical className="w-6 h-6 text-[var(--text-dim)] mx-auto mb-1 opacity-50" />
                          <p className="font-mono text-xs text-[var(--text-dim)]">
                            No laboratory tests ordered for this consultation yet.
                          </p>
                        </div>
                      )}

                      {/* Quick-Order Common Tests */}
                      <div className="space-y-2 pt-1">
                        <span className="block font-mono text-[11px] text-[var(--text-dim)] uppercase tracking-wider">
                          Quick-Order Common Tests (Click to Add):
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {COMMON_DERMA_LAB_TESTS.map((test, idx) => {
                            const isAdded = labTests.some(
                              (t) => t.testName.toLowerCase() === test.name.toLowerCase()
                            );
                            return (
                              <button
                                key={idx}
                                type="button"
                                disabled={isAdded}
                                onClick={() => handleAddLabTest(test.name, test.hint)}
                                title={test.hint}
                                className={`px-2.5 py-1 text-xs rounded border transition-all flex items-center gap-1.5 font-mono ${
                                  isAdded
                                    ? 'bg-[var(--brass)]/15 border-[var(--brass)]/40 text-[var(--brass)] cursor-default'
                                    : 'bg-[var(--surface-2)] hover:bg-[var(--surface-3)] border-[var(--border)] text-[var(--text)] hover:border-[var(--brass)]/60 cursor-pointer'
                                }`}
                              >
                                <span>{isAdded ? '✓' : '+'}</span>
                                <span>{test.name}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Custom Lab Test Form */}
                      <div className="p-3 bg-[var(--surface-2)]/60 border border-[var(--border)] rounded space-y-2.5">
                        <span className="block font-mono text-xs text-[var(--brass)] uppercase font-semibold">
                          + Custom Lab Test Order
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                          <div className="sm:col-span-6">
                            <input
                              type="text"
                              placeholder="Test Name (e.g. Scalp Biopsy, Serum Zinc)"
                              value={customTestName}
                              onChange={(e) => setCustomTestName(e.target.value)}
                              className="w-full px-2.5 py-1.5 text-xs bg-[var(--surface-2)] border border-[var(--border)] rounded text-[var(--text)] focus:outline-none focus:border-[var(--brass)]"
                            />
                          </div>
                          <div className="sm:col-span-4">
                            <input
                              type="text"
                              placeholder="Clinical Indication / Instructions"
                              value={customTestNotes}
                              onChange={(e) => setCustomTestNotes(e.target.value)}
                              className="w-full px-2.5 py-1.5 text-xs bg-[var(--surface-2)] border border-[var(--border)] rounded text-[var(--text)] focus:outline-none focus:border-[var(--brass)]"
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <input
                              type="number"
                              min={0}
                              placeholder="Fee (₹)"
                              value={customTestFee || ''}
                              onChange={(e) => setCustomTestFee(parseFloat(e.target.value) || 0)}
                              className="w-full px-2.5 py-1.5 text-xs bg-[var(--surface-2)] border border-[var(--border)] rounded text-[var(--text)] font-mono"
                            />
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleAddLabTest(customTestName, customTestNotes, customTestFee)}
                          className="btn-brass px-3 py-1.5 rounded text-xs font-mono flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" /> Add Test to Orders
                        </button>
                      </div>
                    </div>
                  </Panel>
                </div>

                {/* Right Column: Trichology Data (5 cols) */}
                <div className="lg:col-span-5 space-y-6">
                  {/* Scalp Phototrichogram Carousel & History Tracking */}
                  {renderScalpPhototrichogramPanel()}

                  {/* Hair Density Trend Chart */}
                  <Panel title="Hair Density Progression (Follicles/cm²)">
                    <div className="h-44 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={densityChartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#232D30" />
                          <XAxis dataKey="date" stroke="#7A8B88" fontSize={11} />
                          <YAxis stroke="#7A8B88" fontSize={11} domain={[40, 100]} />
                          <Tooltip
                            contentStyle={{
                              background: '#151C1D',
                              border: '1px solid #2D393C',
                              borderRadius: '6px',
                              fontSize: '12px',
                            }}
                          />
                          <Line
                            type="monotone"
                            dataKey="density"
                            stroke="#C98A4B"
                            strokeWidth={3}
                            dot={{ fill: '#C98A4B', r: 4 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-[var(--border)]">
                      <span className="font-mono text-xs text-[var(--text-dim)]">Record Density:</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min={30}
                          max={100}
                          value={hairDensity}
                          onChange={(e) => setHairDensity(parseInt(e.target.value))}
                          className="w-32 accent-[var(--brass)]"
                        />
                        <span className="font-mono text-xs font-bold text-[var(--brass)]">
                          {hairDensity} /cm²
                        </span>
                      </div>
                    </div>
                  </Panel>
                </div>
              </div>
            </>
          )}
            </>
          ) : (
            <Panel title="No Active Patient Consultation">
              <div className="text-center py-12 space-y-3">
                <p className="font-mono text-sm text-[var(--text-dim)]">
                  Select a patient from the queue to start a consultation workbench session.
                </p>
                <button
                  onClick={() => setActiveTab('queue')}
                  className="btn-brass px-4 py-2 rounded text-xs font-mono font-medium"
                >
                  View Waiting Queue ({queue.length})
                </button>
              </div>
            </Panel>
          )}
        </div>
      )}

      {/* ================= QUEUE TAB ================= */}
      {activeTab === 'queue' && (
        <Panel title="My Consultation Queue" subtitle="Patients checked in and waiting for consultation">
          <DataTable
            columns={[
              {
                header: 'QUEUE #',
                accessor: (v) => (
                  <span className="font-mono text-sm font-bold text-[var(--brass)]">
                    #{v.queueNumber || '-'}
                  </span>
                ),
              },
              {
                header: 'PATIENT',
                accessor: (v) => {
                  const p = v.patientId as Patient;
                  return (
                    <div>
                      <strong className="block text-[var(--text)]">{p?.name}</strong>
                      <span className="font-mono text-xs text-[var(--text-dim)]">{p?.patientId}</span>
                    </div>
                  );
                },
              },
              {
                header: 'VISIT #',
                accessor: (v) => (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    Visit #{v.visitCount || 1}
                  </span>
                ),
              },
              {
                header: 'VISIT TYPE',
                accessor: (v) => (
                  <Badge variant={v.visitType === 'FirstVisit' ? 'brass' : 'neutral'}>
                    {v.visitType === 'FirstVisit' ? 'Initial Visit' : 'Follow-Up'}
                  </Badge>
                ),
              },
              {
                header: 'STATUS',
                accessor: (v) => (
                  <Badge variant={v.status === 'InProgress' ? 'warn' : 'neutral'}>
                    {v.status}
                  </Badge>
                ),
              },
              {
                header: 'ACTION',
                accessor: (v) => (
                  <button
                    onClick={() => handleStartConsultation(v._id)}
                    className="btn-brass px-3 py-1 rounded text-xs font-mono flex items-center gap-1"
                  >
                    <Play className="w-3 h-3" />
                    {v.status === 'InProgress' ? 'Resume' : 'Start Consult'}
                  </button>
                ),
              },
            ]}
            data={queue}
            keyExtractor={(v) => v._id}
            emptyMessage="Queue is currently clear."
          />
        </Panel>
      )}

      {/* ================= PATIENTS TAB ================= */}
      {activeTab === 'patients' && (
        <Panel title="My Patient Registry" subtitle="Patients registered under your clinical care">
          <DataTable
            columns={[
              { header: 'PATIENT ID', accessor: (p) => <span className="font-mono text-xs">{p.patientId}</span> },
              { header: 'NAME', accessor: (p) => <strong className="text-sm">{p.name}</strong> },
              { header: 'PHONE', accessor: (p) => <span className="font-mono text-xs">{p.phone}</span> },
              { header: 'GENDER', accessor: (p) => <Badge variant="neutral">{p.gender || '-'}</Badge> },
              { header: 'CITY', accessor: (p) => p.location || 'Chennai' },
            ]}
            data={patients}
            keyExtractor={(p) => p._id}
            emptyMessage="No patients under care."
          />
        </Panel>
      )}

      {/* ================= APPOINTMENTS TAB ================= */}
      {activeTab === 'appointments' && (
        <Panel title="My Doctor Appointments" subtitle="Scheduled slot bookings">
          <DataTable
            columns={[
              {
                header: 'TIME',
                accessor: (a) => {
                  if (a.status === 'Postponed' && a.postponedWithoutDate) {
                    return (
                      <span className="font-mono text-xs text-amber-400/90 italic flex items-center gap-1">
                        <CalendarClock className="w-3.5 h-3.5 text-amber-400" />
                        Time to be scheduled
                      </span>
                    );
                  }
                  return (
                    <span className="font-mono text-xs">
                      {new Date(a.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} •{' '}
                      {new Date(a.scheduledAt).toLocaleDateString()}
                    </span>
                  );
                },
              },
              { header: 'PATIENT', accessor: (a) => (a.patientId as Patient)?.name || 'Patient' },
              { header: 'TYPE', accessor: (a) => <Badge variant="brass">{a.type}</Badge> },
              { header: 'MODE', accessor: (a) => <Badge variant="neutral">{a.mode}</Badge> },
              {
                header: 'STATUS',
                accessor: (a) => {
                  if (a.status === 'Postponed') {
                    return (
                      <div className="flex flex-col gap-0.5">
                        <Badge variant="warn">Postponed</Badge>
                        {a.postponedReason && (
                          <span className="text-[10.5px] text-amber-300/80 italic max-w-[150px] truncate" title={a.postponedReason}>
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
                          <span className="text-[10.5px] text-red-300/80 italic max-w-[150px] truncate" title={a.cancellationReason}>
                            &quot;{a.cancellationReason}&quot;
                          </span>
                        )}
                      </div>
                    );
                  }
                  const isOutdated = a.status === 'Scheduled' && new Date(a.scheduledAt).getTime() < Date.now();
                  if (isOutdated) {
                    return <Badge variant="error">Outdated</Badge>;
                  }
                  return (
                    <Badge variant={a.status === 'Scheduled' ? 'warn' : a.status === 'Completed' ? 'success' : 'neutral'}>
                      {a.status}
                    </Badge>
                  );
                },
              },
              {
                header: 'ACTIONS',
                accessor: (a) => {
                  const isPostponed = a.status === 'Postponed';
                  const isCancelled = a.status === 'Cancelled';
                  const isCompleted = a.status === 'Completed';
                  const diffMs = new Date(a.scheduledAt).getTime() - Date.now();
                  const isLocked = !isPostponed && diffMs <= 24 * 60 * 60 * 1000;

                  if (isCancelled) {
                    return <span className="text-[11px] font-mono text-[var(--text-dim)]">—</span>;
                  }

                  if (isCompleted) {
                    return <span className="text-[11px] font-mono text-emerald-400">Completed</span>;
                  }

                  if (isPostponed) {
                    return (
                      <button
                        onClick={() => handleAppointmentAction(a, 'reschedule')}
                        className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/40 flex items-center gap-1 transition-colors"
                      >
                        <CalendarClock className="w-3.5 h-3.5" /> Schedule Slot
                      </button>
                    );
                  }

                  return (
                    <div className="flex items-center gap-1.5">
                      {isLocked && (
                        <span
                          className="p-1 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30 cursor-help"
                          title="Locked within 24 hours (Receptionist override required)"
                        >
                          <Lock className="w-3 h-3" />
                        </span>
                      )}
                      <button
                        onClick={() => handleAppointmentAction(a, 'reschedule')}
                        className="px-2 py-1 text-xs rounded-lg bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-[var(--text)] border border-[var(--border)] transition-colors flex items-center gap-1"
                        title={isLocked ? 'Appointment locked within 24h' : 'Reschedule or Postpone'}
                      >
                        <CalendarClock className="w-3 h-3 text-teal-400" /> Reschedule
                      </button>
                      <button
                        onClick={() => handleAppointmentAction(a, 'cancel')}
                        className="px-2 py-1 text-xs rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 transition-colors flex items-center gap-1"
                        title={isLocked ? 'Appointment locked within 24h' : 'Cancel appointment'}
                      >
                        <Ban className="w-3 h-3" /> Cancel
                      </button>
                    </div>
                  );
                },
              },
            ]}
            data={appointments}
            keyExtractor={(a) => a._id}
            emptyMessage="No appointments scheduled."
          />
        </Panel>
      )}

      {/* ================= PAIRING TAB ================= */}
      {activeTab === 'pairing' && (
        <div className="max-w-md mx-auto space-y-6 text-center">
          <Panel
            title="Mobile Device Pairing"
            subtitle="Pair mobile phones for persistent scalp photo capture — devices stay connected for 30 days."
          >
            <div className="flex flex-col items-center p-6 space-y-4">
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${pairedDeviceCount > 0 ? 'bg-emerald-500/10 border-2 border-emerald-500/30 text-emerald-400' : 'bg-[var(--surface-2)] border-2 border-[var(--border)] text-[var(--text-dim)]'}`}>
                <Smartphone className="w-8 h-8" />
              </div>

              {pairedDeviceCount > 0 ? (
                <div className="space-y-2 text-center">
                  <p className="text-sm font-bold text-[var(--text)]">
                    {pairedDeviceCount} Device{pairedDeviceCount !== 1 ? 's' : ''} Paired
                  </p>
                  <p className="text-xs text-[var(--text-dim)]">
                    Paired devices automatically detect the active patient and enable photo capture. No per-visit QR scanning needed.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 text-center">
                  <p className="text-sm font-bold text-[var(--text)]">No Devices Paired</p>
                  <p className="text-xs text-[var(--text-dim)]">
                    Pair a mobile phone once — it stays connected for 30 days and auto-detects patients in consultation.
                  </p>
                </div>
              )}

              <button
                onClick={handleGeneratePairing}
                className="btn-brass px-6 py-2.5 rounded-xl text-xs font-mono font-bold flex items-center gap-2"
              >
                <QrCode className="w-4 h-4" />
                {pairedDeviceCount > 0 ? 'Manage Devices' : 'Pair a Device'}
              </button>
            </div>
          </Panel>
        </div>
      )}

      {/* ================= SETTINGS TAB ================= */}
      {activeTab === 'settings' && (
        <div className="max-w-4xl mx-auto space-y-6">
          <Panel
            title="Doctor Consultation Workflow Settings"
            subtitle="Configure your clinical consultation workflow and prescription documentation mode"
          >
            <div className="space-y-6 pt-2">
              <p className="text-xs text-[var(--text-dim)]">
                DermaTrack provides two modes to conduct patient consultations. You can switch modes at any time based on whether you prefer end-to-end digital documentation in the app or handwriting clinical details on the physical patient prescription booklet.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Mode 1: Fully App Workflow */}
                <div
                  onClick={() => handleUpdateWorkflow('fully_app')}
                  className={`p-5 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                    consultationWorkflow === 'fully_app'
                      ? 'border-[var(--brass)] bg-[var(--brass)]/10 shadow-lg shadow-[var(--brass)]/10 ring-1 ring-[var(--brass)]'
                      : 'border-[var(--border)] bg-[var(--surface-2)] hover:border-[var(--border-light)]'
                  }`}
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div
                        className={`w-11 h-11 rounded-xl flex items-center justify-center border ${
                          consultationWorkflow === 'fully_app'
                            ? 'bg-[var(--brass)] text-[var(--bg)] border-[var(--brass)] font-bold'
                            : 'bg-[var(--surface-3)] text-[var(--text-dim)] border-[var(--border)]'
                        }`}
                      >
                        <Laptop className="w-5 h-5" />
                      </div>
                      <Badge variant={consultationWorkflow === 'fully_app' ? 'brass' : 'neutral'}>
                        {consultationWorkflow === 'fully_app' ? '✓ Active Mode' : 'Digital EMR'}
                      </Badge>
                    </div>

                    <div>
                      <h3 className="font-display font-bold text-base text-[var(--text)] flex items-center gap-2">
                        <span>1. Fully App Workflow</span>
                      </h3>
                      <p className="text-xs text-[var(--text-dim)] mt-1 leading-relaxed">
                        Complete digital documentation. Record chief complaints, diagnosis, alopecia staging, trichoscopy checklists, digital prescriptions, lab orders, and in-clinic procedures directly in the app.
                      </p>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-[var(--border)]/60 text-xs font-mono">
                      <div className="flex items-center gap-2 text-[var(--text)]">
                        <CheckCircle className="w-3.5 h-3.5 text-[var(--brass)] shrink-0" />
                        <span>Digital Clinical Assessment &amp; Diagnosis</span>
                      </div>
                      <div className="flex items-center gap-2 text-[var(--text)]">
                        <CheckCircle className="w-3.5 h-3.5 text-[var(--brass)] shrink-0" />
                        <span>Norwood &amp; Ludwig Alopecia Staging</span>
                      </div>
                      <div className="flex items-center gap-2 text-[var(--text)]">
                        <CheckCircle className="w-3.5 h-3.5 text-[var(--brass)] shrink-0" />
                        <span>Digital Prescription Formulary &amp; Dosages</span>
                      </div>
                      <div className="flex items-center gap-2 text-[var(--text)]">
                        <CheckCircle className="w-3.5 h-3.5 text-[var(--brass)] shrink-0" />
                        <span>Procedures &amp; Lab Tests Ordering</span>
                      </div>
                      <div className="flex items-center gap-2 text-[var(--text)]">
                        <CheckCircle className="w-3.5 h-3.5 text-[var(--brass)] shrink-0" />
                        <span>Scalp Phototrichogram Examination</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-5 mt-4">
                    <button
                      type="button"
                      disabled={savingWorkflow || consultationWorkflow === 'fully_app'}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUpdateWorkflow('fully_app');
                      }}
                      className={`w-full py-2.5 rounded-lg text-xs font-mono font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        consultationWorkflow === 'fully_app'
                          ? 'bg-[var(--brass)] text-[var(--bg)] shadow-sm cursor-default'
                          : 'btn-surface'
                      }`}
                    >
                      {consultationWorkflow === 'fully_app' ? (
                        <>
                          <Check className="w-4 h-4" />
                          <span>Active Workflow</span>
                        </>
                      ) : (
                        <span>Select Fully App Workflow</span>
                      )}
                    </button>
                  </div>
                </div>

                {/* Mode 2: Patient Prescription Booklet Workflow */}
                <div
                  onClick={() => handleUpdateWorkflow('prescription_booklet')}
                  className={`p-5 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                    consultationWorkflow === 'prescription_booklet'
                      ? 'border-[var(--brass)] bg-[var(--brass)]/10 shadow-lg shadow-[var(--brass)]/10 ring-1 ring-[var(--brass)]'
                      : 'border-[var(--border)] bg-[var(--surface-2)] hover:border-[var(--border-light)]'
                  }`}
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div
                        className={`w-11 h-11 rounded-xl flex items-center justify-center border ${
                          consultationWorkflow === 'prescription_booklet'
                            ? 'bg-[var(--brass)] text-[var(--bg)] border-[var(--brass)] font-bold'
                            : 'bg-[var(--surface-3)] text-[var(--text-dim)] border-[var(--border)]'
                        }`}
                      >
                        <BookOpen className="w-5 h-5" />
                      </div>
                      <Badge variant={consultationWorkflow === 'prescription_booklet' ? 'brass' : 'neutral'}>
                        {consultationWorkflow === 'prescription_booklet' ? '✓ Active Mode' : 'Hybrid Booklet'}
                      </Badge>
                    </div>

                    <div>
                      <h3 className="font-display font-bold text-base text-[var(--text)] flex items-center gap-2">
                        <span>2. Patient Prescription Booklet Workflow</span>
                      </h3>
                      <p className="text-xs text-[var(--text-dim)] mt-1 leading-relaxed">
                        The doctor notes the patient medicine history, scalp stage &amp; conditions, and diagnosis on the physical prescription booklet. The consultation terminal is streamlined to show only patient vitals and digital scalp photography.
                      </p>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-[var(--border)]/60 text-xs font-mono">
                      <div className="flex items-center gap-2 text-[var(--text)]">
                        <CheckCircle className="w-3.5 h-3.5 text-[var(--brass)] shrink-0" />
                        <span>Weight, Height &amp; BMI History Component</span>
                      </div>
                      <div className="flex items-center gap-2 text-[var(--text)]">
                        <CheckCircle className="w-3.5 h-3.5 text-[var(--brass)] shrink-0" />
                        <span>Scalp Phototrichogram Examination (Camera &amp; Mobile)</span>
                      </div>
                      <div className="flex items-center gap-2 text-[var(--text)]">
                        <CheckCircle className="w-3.5 h-3.5 text-[var(--brass)] shrink-0" />
                        <span>Handwritten physical prescription booklet notes</span>
                      </div>
                      <div className="flex items-center gap-2 text-[var(--text)]">
                        <CheckCircle className="w-3.5 h-3.5 text-[var(--brass)] shrink-0" />
                        <span>Dispensary indicates booklet workflow in pending table</span>
                      </div>
                      <div className="flex items-center gap-2 text-[var(--text)]">
                        <CheckCircle className="w-3.5 h-3.5 text-[var(--brass)] shrink-0" />
                        <span>Mini Inventory Catalogue for dispensary medicine fulfillment</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-5 mt-4">
                    <button
                      type="button"
                      disabled={savingWorkflow || consultationWorkflow === 'prescription_booklet'}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUpdateWorkflow('prescription_booklet');
                      }}
                      className={`w-full py-2.5 rounded-lg text-xs font-mono font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        consultationWorkflow === 'prescription_booklet'
                          ? 'bg-[var(--brass)] text-[var(--bg)] shadow-sm cursor-default'
                          : 'btn-surface'
                      }`}
                    >
                      {consultationWorkflow === 'prescription_booklet' ? (
                        <>
                          <Check className="w-4 h-4" />
                          <span>Active Workflow</span>
                        </>
                      ) : (
                        <span>Select Prescription Booklet Workflow</span>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Current Mode Summary Callout */}
              <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface-3)]/60 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[var(--brass)]/15 border border-[var(--brass)]/30 flex items-center justify-center text-[var(--brass)]">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-mono text-xs text-[var(--text-dim)] uppercase tracking-wider block">
                      Current Operating Mode
                    </span>
                    <strong className="text-sm text-[var(--text)]">
                      {consultationWorkflow === 'prescription_booklet'
                        ? 'Patient Prescription Booklet Workflow (Streamlined Terminal)'
                        : 'Fully App Digital Workflow (Complete Digital EMR)'}
                    </strong>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('workbench')}
                  className="btn-brass px-3.5 py-1.5 rounded text-xs font-mono font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Go to Workbench →</span>
                </button>
              </div>
            </div>
          </Panel>
        </div>
      )}

      {/* ================= MODALS ================= */}

      {/* System Camera Modal */}
      {activeVisit && (
        <ScalpCameraModal
          isOpen={systemCameraOpen}
          onClose={() => setSystemCameraOpen(false)}
          visitId={activeVisit._id}
          patientName={activePatient?.name}
          initialImages={activeVisit.scalpImages || []}
          onImagesUpdated={(imgs) => {
            setActiveVisit((prev) => (prev ? { ...prev, scalpImages: imgs } : null));
          }}
        />
      )}


      {/* Lightbox Modal */}
      {activeVisit && (
        <ImageLightboxModal
          isOpen={lightboxOpen}
          onClose={() => setLightboxOpen(false)}
          images={lightboxImages.length > 0 ? lightboxImages : activeVisit.scalpImages || []}
          initialIndex={lightboxIndex}
          title={activePatient ? `Patient: ${activePatient.name}` : 'Clinical Scalp Photo'}
          subtitle={`Scalp Examination • Photo ${lightboxIndex + 1} of ${
            (lightboxImages.length > 0 ? lightboxImages : activeVisit.scalpImages || []).length
          }`}
          onDeleteImage={handleDeleteScalpImage}
        />
      )}

      {/* Appointment 24h Policy Lockdown Modal */}
      <AppointmentLockModal
        isOpen={isLockModalOpen}
        onClose={() => {
          setIsLockModalOpen(false);
          setSelectedApptForLock(null);
        }}
        appointmentDate={selectedApptForLock?.scheduledAt}
        patientName={
          selectedApptForLock?.patientId && typeof selectedApptForLock.patientId === 'object'
            ? (selectedApptForLock.patientId as any).name
            : undefined
        }
        doctorName="Doctor"
        role="doctor"
      />

      {/* Appointment Cancel / Reschedule Action Modal */}
      {selectedApptForAction && (
        <AppointmentActionModal
          isOpen={isActionModalOpen}
          onClose={() => {
            setIsActionModalOpen(false);
            setSelectedApptForAction(null);
          }}
          appointment={selectedApptForAction}
          actionType={actionModalType}
          userRole="doctor"
          onSuccess={() => {
            fetchDoctorData();
          }}
          onLockedTrigger={() => {
            setSelectedApptForLock(selectedApptForAction);
            setIsLockModalOpen(true);
          }}
        />
      )}
    </AppShell>
  );
}
