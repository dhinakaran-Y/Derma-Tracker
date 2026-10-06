'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AppShell } from '../../components/AppShell';
import { KpiCard } from '../../components/KpiCard';
import { Panel } from '../../components/Panel';
import { Badge } from '../../components/Badge';
import { DataTable } from '../../components/DataTable';
import { CompareSlider } from '../../components/CompareSlider';
import InvoicePDFModal from '../../components/InvoicePDFModal';
import { AppointmentLockModal } from '../../components/AppointmentLockModal';
import { AppointmentActionModal } from '../../components/AppointmentActionModal';
import { ImageLightboxModal } from '../../components/ImageLightboxModal';
import { ScalpCompareModal, ComparisonImageItem } from '../../components/ScalpCompareModal';
import { PatientScalpGalleryModal } from '../../components/PatientScalpGalleryModal';
import { api, getMediaUrl } from '../../lib/api';
import { getSocket } from '../../lib/socket';
import { useAuth } from '../../hooks/useAuth';
import { Visit, Appointment, Invoice, User, Patient } from '../../types';
import { toast } from 'sonner';
import {
  LayoutDashboard,
  TrendingUp,
  FileText,
  Calendar,
  CalendarClock,
  Lock,
  Ban,
  CreditCard,
  User as UserIcon,
  Download,
  CheckCircle,
  Plus,
  ArrowRight,
  Clock,
  Sparkles,
  Search,
  AlertCircle,
  AlertTriangle,
  X,
  ShieldCheck,
  Activity,
  Check,
  ChevronRight,
  ChevronLeft,
  Eye,
  IndianRupee,
  Video,
  MapPin,
  HeartPulse,
  ZoomIn,
  Image as ImageIcon,
  SlidersHorizontal,
  Columns,
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

export default function PatientPage() {
  const { patient, refreshUser } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [progressVisits, setProgressVisits] = useState<Visit[]>([]);
  const [records, setRecords] = useState<Visit[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [doctors, setDoctors] = useState<User[]>([]);
  const [bills, setBills] = useState<Invoice[]>([]);
  const [clinicSettings, setClinicSettings] = useState<any>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);

  // Booking Wizard State
  const [bookDoctorId, setBookDoctorId] = useState('');
  const [bookDate, setBookDate] = useState('');
  const [bookSlot, setBookSlot] = useState('');
  const [bookMode, setBookMode] = useState<'Offline' | 'Online'>('Offline');
  const [bookType, setBookType] = useState<'Consult' | 'Surgery'>('Consult');
  const [bookNotes, setBookNotes] = useState('');
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);

  // Appointment Actions & 24-Hour Lockdown State
  const [cancellingAppt, setCancellingAppt] = useState<Appointment | null>(null);
  const [selectedApptForAction, setSelectedApptForAction] = useState<Appointment | null>(null);
  const [actionModalType, setActionModalType] = useState<'cancel' | 'reschedule'>('cancel');
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [selectedApptForLock, setSelectedApptForLock] = useState<Appointment | null>(null);
  const [isLockModalOpen, setIsLockModalOpen] = useState(false);

  const handlePatientAppointmentAction = (appt: Appointment, type: 'cancel' | 'reschedule') => {
    // If appointment is already Postponed (e.g. doctor postponed without date), patient can pick a new date/slot
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

  // Records Search Filter State
  const [recordSearch, setRecordSearch] = useState('');

  // Image Preview Modal State
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Scalp Phototrichogram Carousel & Modal States
  const [activeScalpCarouselIdx, setActiveScalpCarouselIdx] = useState(0);
  const [galleryModalOpen, setGalleryModalOpen] = useState(false);
  const [compareModalOpen, setCompareModalOpen] = useState(false);
  const [compareImages, setCompareImages] = useState<{ img1: ComparisonImageItem; img2: ComparisonImageItem } | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxSubtitle, setLightboxSubtitle] = useState('');

  // Appointments Tab View Filter
  const [appointmentsTabFilter, setAppointmentsTabFilter] = useState<'upcoming' | 'past'>('upcoming');

  // Profile Edit State
  const [profileName, setProfileName] = useState('');
  const [profileLocation, setProfileLocation] = useState('');
  const [profileEmail, setProfileEmail] = useState('');

  const fetchPatientData = useCallback(async () => {
    try {
      setLoading(true);
      const [dashRes, progRes, recRes, apptRes, docRes, billRes, profRes, setRes] = await Promise.all([
        api.get('/client/dashboard'),
        api.get('/client/progress'),
        api.get('/client/records'),
        api.get('/client/appointments'),
        api.get('/client/doctors'),
        api.get('/client/bills'),
        api.get('/client/profile'),
        api.get('/client/settings').catch(() => ({ data: { data: null } })),
      ]);

      setDashboardData(dashRes.data.data || null);
      setProgressVisits(progRes.data.data || []);
      setRecords(recRes.data.data || []);
      setAppointments(apptRes.data.data || []);
      setDoctors(docRes.data.data || []);
      setBills(billRes.data.data || []);
      setClinicSettings(setRes.data?.data || null);

      if (profRes.data.data) {
        setProfileName(profRes.data.data.name || '');
        setProfileLocation(profRes.data.data.location || '');
        setProfileEmail(profRes.data.data.email || '');
      }
    } catch {
      toast.error('Failed to load patient health records');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPatientData();

    const socket = getSocket();
    socket.on('appointment:updated', () => fetchPatientData());

    return () => {
      socket.off('appointment:updated');
    };
  }, [fetchPatientData]);

  // Load available slots when doctor and date are chosen
  useEffect(() => {
    if (bookDoctorId && bookDate) {
      api
        .get(`/appointments/slots/${bookDoctorId}/${bookDate}`)
        .then((res) => {
          const booked = (res.data.data.bookedSlots || []).map((s: string) =>
            new Date(s).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
          );
          // Standard appointment slots between 09:30 and 17:30
          const allSlots = [
            '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30',
            '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00'
          ];
          const open = allSlots.filter((slot) => !booked.includes(slot));
          setAvailableSlots(open);
          if (open.length > 0) setBookSlot(open[0] || '');
        })
        .catch(() => setAvailableSlots([]));
    }
  }, [bookDoctorId, bookDate]);

  const handleBookAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookDoctorId || !bookDate || !bookSlot) {
      toast.error('Please select doctor, appointment date, and time slot');
      return;
    }
    try {
      const [hours, minutes] = bookSlot.split(':');
      const scheduledDate = new Date(bookDate);
      scheduledDate.setHours(parseInt(hours || '10', 10), parseInt(minutes || '0', 10), 0, 0);

      await api.post('/appointments', {
        patientId: patient?._id,
        doctorId: bookDoctorId,
        scheduledAt: scheduledDate.toISOString(),
        mode: bookMode,
        type: bookType,
        notes: bookNotes,
      });

      toast.success(`Appointment successfully booked for ${scheduledDate.toLocaleDateString()} at ${bookSlot}`);
      setBookDoctorId('');
      setBookDate('');
      setBookSlot('');
      setBookNotes('');
      setBookType('Consult');
      fetchPatientData();
      setActiveTab('appointments');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to book appointment');
    }
  };

  const handleCancelAppointment = async (apptId: string) => {
    try {
      await api.patch(`/appointments/${apptId}/status`, { status: 'Cancelled' });
      toast.success('Appointment cancelled successfully');
      setCancellingAppt(null);
      fetchPatientData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to cancel appointment');
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.patch('/client/my-profile', {
        name: profileName,
        location: profileLocation,
        email: profileEmail,
      });
      toast.success('Profile information updated');
      refreshUser();
      fetchPatientData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to update profile');
    }
  };

  const getBmiCategory = (bmi: number) => {
    if (bmi < 18.5) return { label: 'Underweight', variant: 'warn' as const };
    if (bmi < 25) return { label: 'Normal', variant: 'success' as const };
    if (bmi < 30) return { label: 'Overweight', variant: 'warn' as const };
    return { label: 'Obese', variant: 'error' as const };
  };

  const navGroups = [
    {
      title: 'My Care Portal',
      items: [
        { id: 'dashboard', label: 'Patient Overview', icon: LayoutDashboard },
        { id: 'progress', label: 'Trichology Progress Hub', icon: TrendingUp },
        { id: 'records', label: 'Clinical Records & Rx', icon: FileText, badge: records.length },
        { id: 'appointments', label: 'My Appointments', icon: Calendar, badge: appointments.length },
        { id: 'book', label: 'Book Consultation', icon: Plus },
        { id: 'bills', label: 'Billing & Invoices', icon: CreditCard, badge: bills.length },
        { id: 'profile', label: 'My Profile', icon: UserIcon },
      ],
    },
  ];

  // Scalp Photos Metadata across all visits (newest first for examination carousel)
  interface PatientScalpPhotoMeta {
    filename: string;
    visitId: string;
    visitDate: string | Date;
    visitType?: string;
    diagnosis?: string;
    photoIndex: number;
  }

  const allCarouselPhotos: PatientScalpPhotoMeta[] = [...progressVisits]
    .reverse()
    .flatMap((v) =>
      (v.scalpImages || []).map((img, idx) => ({
        filename: img,
        visitId: v._id,
        visitDate: v.visitDate,
        visitType: v.visitType || 'Clinical Consultation',
        diagnosis: v.diagnosis,
        photoIndex: idx + 1,
      })).reverse()
    );

  const hasCarouselImages = allCarouselPhotos.length > 0;
  const safeCarouselIndex = Math.min(
    Math.max(0, activeScalpCarouselIdx),
    Math.max(0, allCarouselPhotos.length - 1)
  );
  const currentCarouselPhoto = allCarouselPhotos[safeCarouselIndex];

  // Scalp Photos Array across all visits (for progress tab)
  const allScalpImages = progressVisits.flatMap((v) =>
    (v.scalpImages || []).map((img) => ({
      url: getMediaUrl(img),
      date: v.visitDate,
      visitType: v.visitType,
    }))
  );

  const baselinePhoto =
    allScalpImages[0]?.url || '/images/scalp-dummy-images/scalp-stage-4.png';
  const baselineDate = allScalpImages[0]
    ? new Date(allScalpImages[0].date).toLocaleDateString()
    : 'Month 0 (Baseline)';
  const latestPhoto =
    allScalpImages[allScalpImages.length - 1]?.url ||
    '/images/scalp-dummy-images/scalp-stage-2.png';
  const latestDate = allScalpImages[allScalpImages.length - 1]
    ? new Date(allScalpImages[allScalpImages.length - 1].date).toLocaleDateString()
    : 'Latest Trichoscopy';

  // Density Chart Data
  const densityChartData: { name: string; density: number; weight?: number }[] =
    progressVisits.filter((v) => v.hairDensity).length > 0
      ? progressVisits.map((v, i) => ({
          name: `Visit ${i + 1} (${new Date(v.visitDate).toLocaleDateString([], { month: 'short', year: '2-digit' })})`,
          density: v.hairDensity || 50,
          weight: v.weightKg,
        }))
      : [
          { name: 'Baseline (M0)', density: 50 },
          { name: 'Follow-up (M2)', density: 58 },
          { name: 'Review (M4)', density: 66 },
          { name: 'Current (M6)', density: 75 },
        ];

  // Clinical Milestones Stages
  const totalVisitsCount = progressVisits.length;
  const stages = [
    {
      title: 'Baseline Assessment & Trichoscopy',
      desc: 'Norwood/Ludwig pattern staging, high-res baseline dermoscopy, and customized medical regimen opening',
      status: totalVisitsCount >= 1 ? 'completed' : 'in-progress',
      icon: Sparkles,
      timeframe: 'Month 0',
    },
    {
      title: 'Follicular Stabilization & Shedding Control',
      desc: 'Anti-androgen therapy adaptation, topical serum tolerance, and telogen shedding arrest',
      status: totalVisitsCount >= 2 ? 'completed' : totalVisitsCount === 1 ? 'in-progress' : 'upcoming',
      icon: ShieldCheck,
      timeframe: 'Months 1–2',
    },
    {
      title: 'Active Terminal Regrowth & Density Gain',
      desc: 'Miniaturization reversal, follicular unit thickening, and measurable follicular density growth',
      status: totalVisitsCount >= 4 ? 'completed' : totalVisitsCount >= 2 ? 'in-progress' : 'upcoming',
      icon: TrendingUp,
      timeframe: 'Months 3–6',
    },
    {
      title: 'Hairline Consolidation & Long-Term Maintenance',
      desc: 'Plateau density stabilization, procedural PRP maintenance, and routine annual follow-ups',
      status: totalVisitsCount >= 6 ? 'completed' : totalVisitsCount >= 4 ? 'in-progress' : 'upcoming',
      icon: Activity,
      timeframe: 'Month 6+',
    },
  ];

  // Latest Clinical Records & Biomarkers
  const latestVisitWithStaging = [...progressVisits].reverse().find((v) => v.staging);
  const latestVisitWithDlqi = [...progressVisits].reverse().find((v) => v.dlqiScore !== undefined);
  const latestVisitWithScalp = [...progressVisits].reverse().find((v) => v.scalpChecklist);
  const latestVisit = progressVisits[progressVisits.length - 1];

  // Filtered Clinical Records for Search
  const filteredRecords = records.filter((r) => {
    if (!recordSearch.trim()) return true;
    const q = recordSearch.toLowerCase();
    const doc = ((r.doctorId as User)?.fullName || '').toLowerCase();
    const diag = (r.diagnosis || '').toLowerCase();
    const notes = (r.clinicalNotes || '').toLowerCase();
    const meds = (r.prescriptions || []).map((p) => p.medicineName.toLowerCase()).join(' ');
    const tests = (r.labTests || []).map((t) => (typeof t === 'string' ? t : t.testName).toLowerCase()).join(' ');
    return doc.includes(q) || diag.includes(q) || notes.includes(q) || meds.includes(q) || tests.includes(q);
  });

  // Appointments Partition
  const upcomingAppointments = appointments.filter(
    (a) => a.status === 'Scheduled' || a.status === 'Waiting' || a.status === 'InProgress' || a.status === 'Postponed'
  );
  const pastAppointments = appointments.filter(
    (a) => a.status !== 'Scheduled' && a.status !== 'Waiting' && a.status !== 'InProgress' && a.status !== 'Postponed'
  );

  return (
    <AppShell
      navGroups={navGroups}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      pageTitle="Patient Health Portal"
      topbarActions={
        <button
          onClick={() => setActiveTab('book')}
          className="btn-brass px-3 py-1.5 rounded text-xs font-mono font-medium flex items-center gap-1.5 shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Book Consultation</span>
        </button>
      }
    >
      <div className="space-y-6">
        {/* ================= DASHBOARD TAB ================= */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Welcome Banner */}
            <div className="surface-card p-6 border-l-4 border-[var(--brass)] flex flex-wrap justify-between items-center gap-4 bg-gradient-to-r from-[var(--surface-1)] to-[var(--surface-2)]">
              <div>
                <span className="font-mono text-xs text-[var(--brass)] uppercase font-semibold block mb-1">
                  DermaTrack Trichology &amp; Dermatology Care
                </span>
                <h2 className="font-display font-bold text-2xl text-[var(--text)]">
                  Welcome back, {patient?.name || 'Patient'}
                </h2>
                <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-[var(--text-dim)] font-mono">
                  <span>UHID: <strong className="text-[var(--brass)]">{patient?.patientId}</strong></span>
                  <span>•</span>
                  <span>Contact: +91 {patient?.phone}</span>
                  {patient?.gender && (
                    <>
                      <span>•</span>
                      <span>Gender: {patient.gender}</span>
                    </>
                  )}
                  {patient?.age && (
                    <>
                      <span>•</span>
                      <span>Age: {patient.age} yrs</span>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => setActiveTab('progress')}
                  className="btn-brass px-4 py-2 rounded text-xs font-mono font-bold flex items-center gap-1.5 shadow-sm"
                >
                  <Sparkles className="w-3.5 h-3.5" /> View Scalp Recovery Hub
                </button>
                <button
                  onClick={() => setActiveTab('book')}
                  className="btn-surface px-4 py-2 rounded text-xs font-mono font-medium flex items-center gap-1.5 border border-[var(--border)] hover:border-[var(--brass)] text-[var(--text)] transition-colors"
                >
                  <Calendar className="w-3.5 h-3.5 text-[var(--brass)]" /> Book Visit
                </button>
              </div>
            </div>

            {/* Top KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <KpiCard
                label="Completed Consultations"
                value={dashboardData?.totalVisits || records.length}
                delta={records.length > 0 ? "Clinical Records Logged" : "No Past Visits"}
                deltaType="positive"
                icon={<FileText className="w-5 h-5" />}
              />
              <KpiCard
                label="Upcoming Appointments"
                value={upcomingAppointments.length}
                delta={upcomingAppointments.length > 0 ? "Confirmed Session" : "None Scheduled"}
                deltaType={upcomingAppointments.length > 0 ? "positive" : "neutral"}
                icon={<Calendar className="w-5 h-5" />}
              />
              <KpiCard
                label="Outstanding Invoices"
                value={dashboardData?.unpaidInvoices?.length || bills.filter((b) => b.status !== 'Paid').length}
                delta={bills.filter((b) => b.status !== 'Paid').length > 0 ? "Pending Payment" : "All Settled"}
                deltaType={bills.filter((b) => b.status !== 'Paid').length > 0 ? "negative" : "positive"}
                icon={<CreditCard className="w-5 h-5" />}
              />
            </div>

            {/* Next Appointment Alert Banner */}
            {upcomingAppointments.length > 0 && (
              <div className="p-4 bg-[var(--surface-2)] border border-[var(--brass)]/30 rounded-lg flex flex-wrap justify-between items-center gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-[var(--brass)]/15 border border-[var(--brass)] rounded-full text-[var(--brass)]">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[11px] font-mono text-[var(--brass)] uppercase font-semibold block">Next Scheduled Appointment</span>
                    <strong className="text-sm text-[var(--text)]">
                      {new Date(upcomingAppointments[0].scheduledAt).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' })} at{' '}
                      {new Date(upcomingAppointments[0].scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </strong>
                    <span className="text-xs text-[var(--text-dim)] block">
                      With {(upcomingAppointments[0].doctorId as User)?.fullName || 'Consulting Specialist'} • {upcomingAppointments[0].mode === 'Online' ? 'Online Video Consult' : 'In-Clinic Hospital Visit'}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setActiveTab('appointments')}
                  className="btn-brass px-3 py-1.5 rounded text-xs font-mono font-medium flex items-center gap-1"
                >
                  <span>Manage Appointment</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Scalp Examination Carousel & Active Prescriptions Split */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Panel
                title="Scalp Phototrichogram Examination"
                subtitle={
                  hasCarouselImages
                    ? `${allCarouselPhotos.length} total patient scalp photos • Showing latest taken image by default`
                    : 'No scalp photos recorded yet'
                }
                action={
                  <button
                    type="button"
                    onClick={() => setGalleryModalOpen(true)}
                    className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-teal-500/10 hover:bg-teal-500/20 text-teal-600 dark:text-teal-400 border border-teal-500/20 transition-colors"
                    title="Open Date-wise Gallery and Comparison"
                  >
                    <ImageIcon className="w-3.5 h-3.5" />
                    <span>View Gallery & Compare</span>
                  </button>
                }
              >
                {!hasCarouselImages ? (
                  /* Empty State */
                  <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-[var(--border)] rounded-xl bg-[var(--surface-2)]/40 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20 flex items-center justify-center mb-3">
                      <ImageIcon className="w-7 h-7" />
                    </div>
                    <h4 className="text-sm font-bold text-[var(--text)]">No Scalp Photos Recorded Yet</h4>
                    <p className="text-xs text-[var(--text-dim)] max-w-xs mt-1 mb-2">
                      Clinical scalp phototrichogram photos captured by your doctor during consultations will appear here with full comparison tracking.
                    </p>
                  </div>
                ) : (
                  /* Has Images: Scalp Carousel + Taken Date Badge + Actions */
                  <div className="space-y-4">
                    {/* Scalp Image Carousel View Container */}
                    <div className="relative aspect-4/3 w-full rounded-2xl overflow-hidden border border-[var(--border)] bg-black group shadow-md flex items-center justify-center">
                      {/* Main Scalp Image */}
                      <img
                        src={getMediaUrl(currentCarouselPhoto.filename)}
                        alt={`Scalp photo captured on ${new Date(currentCarouselPhoto.visitDate).toLocaleDateString()}`}
                        className="w-full h-full object-cover cursor-pointer transition-transform duration-300 group-hover:scale-[1.02]"
                        onClick={() => {
                          setLightboxIndex(safeCarouselIndex);
                          setLightboxImages(allCarouselPhotos.map((p) => p.filename));
                          setLightboxSubtitle(
                            `Visit Date: ${new Date(currentCarouselPhoto.visitDate).toLocaleDateString()} • Photo #${currentCarouselPhoto.photoIndex}`
                          );
                          setLightboxOpen(true);
                        }}
                      />

                      {/* Top Overlay Badges */}
                      <div className="absolute top-3 inset-x-3 flex items-center justify-between pointer-events-none">
                        <div className="flex items-center gap-1.5">
                          {safeCarouselIndex === 0 ? (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500 text-slate-950 shadow-lg backdrop-blur-md flex items-center gap-1">
                              <Sparkles className="w-3 h-3" />
                              Last Taken Scalp Image
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-black/75 text-white/90 shadow-md backdrop-blur-md">
                              Past Scan #{allCarouselPhotos.length - safeCarouselIndex}
                            </span>
                          )}
                        </div>

                        <span className="px-2.5 py-1 rounded-full text-[11px] font-mono font-bold bg-black/75 text-white shadow-md backdrop-blur-md">
                          {safeCarouselIndex + 1} / {allCarouselPhotos.length}
                        </span>
                      </div>

                      {/* Floating Overlay Navigation Arrows */}
                      {allCarouselPhotos.length > 1 && (
                        <>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveScalpCarouselIdx((prev) => Math.max(0, prev - 1));
                            }}
                            disabled={safeCarouselIndex === 0}
                            title="View newer scalp photo"
                            className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/60 hover:bg-black/90 disabled:opacity-0 text-white flex items-center justify-center backdrop-blur-md border border-white/20 shadow-xl transition-all cursor-pointer disabled:cursor-default"
                          >
                            <ChevronLeft className="w-5 h-5" />
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveScalpCarouselIdx((prev) => Math.min(allCarouselPhotos.length - 1, prev + 1));
                            }}
                            disabled={safeCarouselIndex === allCarouselPhotos.length - 1}
                            title="View older scalp photo"
                            className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/60 hover:bg-black/90 disabled:opacity-0 text-white flex items-center justify-center backdrop-blur-md border border-white/20 shadow-xl transition-all cursor-pointer disabled:cursor-default"
                          >
                            <ChevronRight className="w-5 h-5" />
                          </button>
                        </>
                      )}

                      {/* Hover Zoom Hint */}
                      <div className="absolute bottom-2.5 right-2.5 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-black/80 text-white backdrop-blur-md flex items-center gap-1 shadow-md">
                          <ZoomIn className="w-3 h-3" />
                          Click to Zoom
                        </span>
                      </div>
                    </div>

                    {/* Medical Image Taken Date & Carousel Controls */}
                    <div className="p-3.5 rounded-xl bg-gradient-to-r from-[var(--surface-2)] to-[var(--surface-1)] border border-[var(--border)] shadow-xs space-y-2">
                      <div className="flex items-center justify-between flex-wrap gap-2.5">
                        {/* Date & Context Badge */}
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20 flex items-center justify-center shrink-0 shadow-xs">
                            <Calendar className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-bold text-[var(--text)] tracking-tight">
                                Taken on {new Date(currentCarouselPhoto.visitDate).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                })}
                              </span>
                              {safeCarouselIndex === 0 ? (
                                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/15 border border-emerald-500/25 px-2 py-0.5 rounded-full">
                                  Last Taken Image
                                </span>
                              ) : (
                                <span className="text-[10px] font-medium text-[var(--text-dim)] bg-[var(--surface-3)] px-2 py-0.5 rounded-full">
                                  Past Image
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-[var(--text-dim)] mt-0.5">
                              {currentCarouselPhoto.visitType} • Photo #{currentCarouselPhoto.photoIndex}
                              {currentCarouselPhoto.diagnosis ? ` • ${currentCarouselPhoto.diagnosis}` : ''}
                            </p>
                          </div>
                        </div>

                        {/* Carousel Changing Buttons */}
                        <div className="flex items-center gap-2">
                          <div className="flex items-center rounded-lg border border-[var(--border)] bg-[var(--surface-1)] p-0.5 shadow-xs">
                            <button
                              type="button"
                              onClick={() => setActiveScalpCarouselIdx((prev) => Math.max(0, prev - 1))}
                              disabled={safeCarouselIndex === 0}
                              title="View newer scalp photo"
                              className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold text-[var(--text)] hover:bg-[var(--surface-2)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            >
                              <ChevronLeft className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline text-[11px]">Newer</span>
                            </button>
                            <div className="h-4 w-px bg-[var(--border)] mx-0.5" />
                            <span className="text-[11px] font-mono font-bold text-[var(--text-dim)] px-2">
                              {safeCarouselIndex + 1} / {allCarouselPhotos.length}
                            </span>
                            <div className="h-4 w-px bg-[var(--border)] mx-0.5" />
                            <button
                              type="button"
                              onClick={() =>
                                setActiveScalpCarouselIdx((prev) =>
                                  Math.min(allCarouselPhotos.length - 1, prev + 1)
                                )
                              }
                              disabled={safeCarouselIndex === allCarouselPhotos.length - 1}
                              title="View older scalp photo"
                              className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold text-[var(--text)] hover:bg-[var(--surface-2)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            >
                              <span className="hidden sm:inline text-[11px]">Older</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setLightboxIndex(safeCarouselIndex);
                              setLightboxImages(allCarouselPhotos.map((p) => p.filename));
                              setLightboxSubtitle(
                                `Visit Date: ${new Date(currentCarouselPhoto.visitDate).toLocaleDateString()} • Photo #${currentCarouselPhoto.photoIndex}`
                              );
                              setLightboxOpen(true);
                            }}
                            title="Open Fullscreen Lightbox"
                            className="p-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-1)] hover:bg-[var(--surface-3)] text-[var(--text)] transition-colors"
                          >
                            <ZoomIn className="w-4 h-4 text-teal-500" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </Panel>

              <Panel title="Active Prescribed Regimen" subtitle="Medicines prescribed during your latest clinical consultation">
                {latestVisit?.prescriptions && latestVisit.prescriptions.length > 0 ? (
                  <div className="space-y-3 pt-1">
                    <div className="flex items-center justify-between pb-2 border-b border-[var(--border)] text-xs text-[var(--text-dim)] font-mono">
                      <span>Doctor: {(latestVisit.doctorId as User)?.fullName || 'Doctor'}</span>
                      <span>Date: {new Date(latestVisit.visitDate).toLocaleDateString()}</span>
                    </div>
                    <div className="space-y-2">
                      {latestVisit.prescriptions.map((p, idx) => (
                        <div key={idx} className="p-3 bg-[var(--surface-2)] border border-[var(--border)] rounded-md flex justify-between items-center text-xs">
                          <div>
                            <strong className="text-sm block text-[var(--text)]">{p.medicineName}</strong>
                            <span className="text-[11px] font-mono text-[var(--text-dim)]">
                              Dosage: {p.dosage} • Frequency: {p.frequency} • {p.duration}
                            </span>
                            {p.instructions && (
                              <p className="text-[11px] text-[var(--brass)] mt-0.5 italic">{p.instructions}</p>
                            )}
                          </div>
                          <Badge variant={p.isDispensed ? 'success' : 'warn'}>
                            {p.isDispensed ? 'Dispensed' : 'Prescribed'}
                          </Badge>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => setActiveTab('records')}
                      className="w-full btn-surface py-2 rounded text-xs font-mono flex items-center justify-center gap-1 mt-2 text-[var(--text-dim)] hover:text-[var(--text)]"
                    >
                      <span>View All Historical Prescriptions</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <div className="py-8 text-center text-xs text-[var(--text-dim)] space-y-2 font-mono">
                    <p>No active prescriptions on file.</p>
                    <button
                      onClick={() => setActiveTab('book')}
                      className="btn-brass px-3 py-1.5 rounded text-xs font-mono inline-flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> Book Initial Consultation
                    </button>
                  </div>
                )}
              </Panel>
            </div>
          </div>
        )}

        {/* ================= MY PROGRESS TAB (F1) ================= */}
        {activeTab === 'progress' && (
          <div className="space-y-6">
            {/* Header / Summary Card */}
            <div className="bg-[var(--surface-1)] border border-[var(--border)] p-5 rounded-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h2 className="text-lg font-display font-bold text-[var(--text)] flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-[var(--brass)]" />
                  Trichology Progress Hub &amp; Recovery Timeline
                </h2>
                <p className="text-xs text-[var(--text-dim)] mt-1">
                  Track your personalized hair regrowth journey across clinical consultations, follicular density changes, and macro trichoscopic imaging.
                </p>
              </div>
              <Badge variant="brass" className="text-xs px-3 py-1">
                {totalVisitsCount >= 6 ? 'Stage 4: Consolidation' : totalVisitsCount >= 4 ? 'Stage 3: Regrowth Phase' : totalVisitsCount >= 2 ? 'Stage 2: Stabilization' : 'Stage 1: Baseline Mapping'}
              </Badge>
            </div>

            {/* 4-Stage Clinical Milestones Tracker */}
            <Panel title="Treatment Milestones Roadmap" subtitle="Clinical stages of androgenetic and alopecia recovery">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-2">
                {stages.map((stage, idx) => {
                  const Icon = stage.icon;
                  const isDone = stage.status === 'completed';
                  const isCurrent = stage.status === 'in-progress';
                  return (
                    <div
                      key={idx}
                      className={`p-4 rounded-lg border transition-all space-y-2.5 relative ${
                        isCurrent
                          ? 'bg-[var(--brass)]/10 border-[var(--brass)] shadow-md'
                          : isDone
                          ? 'bg-[var(--surface-2)] border-emerald-500/40'
                          : 'bg-[var(--surface-2)]/50 border-[var(--border)] opacity-60'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div className={`p-2 rounded-full ${isDone ? 'bg-emerald-500/20 text-emerald-400' : isCurrent ? 'bg-[var(--brass)]/20 text-[var(--brass)]' : 'bg-[var(--surface-3)] text-[var(--text-dim)]'}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <Badge variant={isDone ? 'success' : isCurrent ? 'brass' : 'neutral'}>
                          {isDone ? 'Completed' : isCurrent ? 'Current Phase' : 'Upcoming'}
                        </Badge>
                      </div>

                      <div>
                        <span className="text-[10px] font-mono text-[var(--brass)] font-semibold uppercase block">
                          Stage {idx + 1} • {stage.timeframe}
                        </span>
                        <h4 className="text-xs font-bold text-[var(--text)] mt-0.5">{stage.title}</h4>
                        <p className="text-[11px] text-[var(--text-dim)] mt-1 leading-relaxed">{stage.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Panel>

            {/* Scalp Comparison & Follicular Chart */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Scalp Photo Comparison */}
              <Panel
                title="High-Magnification Trichoscopy Comparison"
                subtitle="Baseline dermoscopy versus latest clinical review"
              >
                <div className="space-y-4 pt-1">
                  <CompareSlider
                    beforeImage={baselinePhoto}
                    afterImage={latestPhoto}
                    beforeLabel={baselineDate}
                    afterLabel={latestDate}
                  />

                  {/* Scalp Gallery Strip if multiple photos */}
                  {allScalpImages.length > 0 && (
                    <div className="pt-3 border-t border-[var(--border)]">
                      <span className="block text-[11px] font-mono text-[var(--text-dim)] uppercase tracking-wider mb-2">
                        Clinical Macro Photo Archive ({allScalpImages.length} Captures):
                      </span>
                      <div className="flex gap-2 overflow-x-auto pb-2">
                        {allScalpImages.map((img, i) => (
                          <div
                            key={i}
                            onClick={() => setPreviewImage(img.url)}
                            className="relative w-16 h-16 rounded border border-[var(--border)] hover:border-[var(--brass)] cursor-pointer shrink-0 overflow-hidden group"
                          >
                            <img src={img.url} alt={`Scalp ${i + 1}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                            <span className="absolute bottom-0 inset-x-0 bg-black/70 text-[9px] font-mono text-center text-white py-0.5">
                              {new Date(img.date).toLocaleDateString([], { month: 'numeric', day: 'numeric' })}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </Panel>

              {/* Follicular Density Progression */}
              <Panel
                title="Follicular Density Trajectory"
                subtitle="Dermoscopic follicular count per square centimeter (follicles / cm²)"
              >
                <div className="h-64 w-full pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={densityChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#232D30" />
                      <XAxis dataKey="name" stroke="#7A8B88" fontSize={10} />
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
                        name="Density (follicles/cm²)"
                        dot={{ fill: '#C98A4B', r: 5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 pt-3 border-t border-[var(--border)] grid grid-cols-2 gap-3 text-xs font-mono">
                  <div className="p-2.5 bg-[var(--surface-2)] rounded">
                    <span className="text-[var(--text-dim)] block text-[10px]">BASELINE DENSITY</span>
                    <strong className="text-sm text-[var(--text)]">
                      {progressVisits[0]?.hairDensity || 50} follicles/cm²
                    </strong>
                  </div>
                  <div className="p-2.5 bg-[var(--surface-2)] rounded">
                    <span className="text-[var(--text-dim)] block text-[10px]">LATEST DENSITY</span>
                    <strong className="text-sm text-[var(--brass)]">
                      {latestVisit?.hairDensity || 75} follicles/cm²
                    </strong>
                  </div>
                </div>
              </Panel>
            </div>

            {/* Latest Clinical Biomarkers Panel */}
            <Panel title="Verified Clinical Biomarkers" subtitle="Latest dermatological staging and objective diagnostic findings">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
                {/* Staging */}
                <div className="p-3.5 bg-[var(--surface-2)] border border-[var(--border)] rounded-md space-y-1">
                  <span className="text-[11px] font-mono text-[var(--text-dim)] block uppercase">Alopecia Staging</span>
                  <strong className="text-sm text-[var(--brass)] block">
                    {latestVisitWithStaging?.staging?.scale
                      ? `${latestVisitWithStaging.staging.scale} - ${latestVisitWithStaging.staging.stage}`
                      : latestVisit?.diagnosis || 'Norwood Stage II'}
                  </strong>
                  <span className="text-[11px] text-[var(--text-dim)] block">
                    Assessed on {latestVisit ? new Date(latestVisit.visitDate).toLocaleDateString() : 'Baseline'}
                  </span>
                </div>

                {/* Scalp Checklist */}
                <div className="p-3.5 bg-[var(--surface-2)] border border-[var(--border)] rounded-md space-y-1">
                  <span className="text-[11px] font-mono text-[var(--text-dim)] block uppercase">Scalp Health Matrix</span>
                  <div className="text-xs space-y-0.5 pt-0.5">
                    <div className="flex justify-between">
                      <span className="text-[var(--text-dim)]">Pull Test:</span>
                      <strong className="text-[var(--text)]">{latestVisitWithScalp?.scalpChecklist?.pullTest || 'Negative (<6 hairs)'}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--text-dim)]">Sebum:</span>
                      <strong className="text-[var(--text)]">{latestVisitWithScalp?.scalpChecklist?.sebum || 'Normal'}</strong>
                    </div>
                  </div>
                </div>

                {/* DLQI */}
                <div className="p-3.5 bg-[var(--surface-2)] border border-[var(--border)] rounded-md space-y-1">
                  <span className="text-[11px] font-mono text-[var(--text-dim)] block uppercase">Quality of Life (DLQI)</span>
                  <strong className="text-sm text-[var(--text)] block">
                    {latestVisitWithDlqi?.dlqiScore !== undefined ? `${latestVisitWithDlqi.dlqiScore} / 30 Score` : '3 / 30 Score'}
                  </strong>
                  <span className="text-[11px] text-emerald-400 block font-medium">Small impact on life</span>
                </div>

                {/* Vitals */}
                <div className="p-3.5 bg-[var(--surface-2)] border border-[var(--border)] rounded-md space-y-1">
                  <span className="text-[11px] font-mono text-[var(--text-dim)] block uppercase">Recorded Vitals</span>
                  <strong className="text-sm text-[var(--text)] block">
                    {latestVisit?.weightKg ? `${latestVisit.weightKg} kg` : '68.0 kg'} • {latestVisit?.heightCm ? `${latestVisit.heightCm} cm` : '172 cm'}
                  </strong>
                  {latestVisit?.weightKg && latestVisit?.heightCm && (
                    <div className="pt-0.5">
                      {(() => {
                        const bmi = parseFloat((latestVisit.weightKg / Math.pow(latestVisit.heightCm / 100, 2)).toFixed(1));
                        const cat = getBmiCategory(bmi);
                        return <Badge variant={cat.variant}>BMI: {bmi} ({cat.label})</Badge>;
                      })()}
                    </div>
                  )}
                </div>
              </div>
            </Panel>
          </div>
        )}

        {/* ================= MY RECORDS TAB (F2) ================= */}
        {activeTab === 'records' && (
          <Panel title="Consultation History &amp; Prescriptions" subtitle="Comprehensive record of clinical visits, doctor advice, and medication regimens">
            {/* Search Bar */}
            <div className="mb-4 pb-4 border-b border-[var(--border)] flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-dim)]" />
                <input
                  type="text"
                  placeholder="Search consultation records by doctor, diagnosis, medicines, or notes..."
                  value={recordSearch}
                  onChange={(e) => setRecordSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-xs bg-[var(--surface-2)] border border-[var(--border)] rounded text-[var(--text)] placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--brass)]"
                />
              </div>
              {recordSearch && (
                <button
                  onClick={() => setRecordSearch('')}
                  className="btn-surface px-3 py-2 rounded text-xs font-mono"
                >
                  Clear
                </button>
              )}
            </div>

            {filteredRecords.length > 0 ? (
              <div className="space-y-4">
                {filteredRecords.map((r) => (
                  <div key={r._id} className="p-5 bg-[var(--surface)] border border-[var(--border)] rounded-lg space-y-4 shadow-sm hover:border-[var(--border-light)] transition-colors">
                    {/* Header */}
                    <div className="flex flex-wrap justify-between items-start gap-2 border-b border-[var(--border)] pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <strong className="text-sm text-[var(--text)]">{(r.doctorId as User)?.fullName || 'Consulting Dermatologist'}</strong>
                          <span className="text-xs text-[var(--text-dim)]">({(r.doctorId as User)?.specialization || 'Trichologist'})</span>
                        </div>
                        <span className="font-mono text-xs text-[var(--text-dim)] block mt-0.5">
                          {new Date(r.visitDate).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })} • {r.visitType === 'FirstVisit' ? 'Initial Case Onboarding' : 'Follow-up Consultation'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {r.staging?.stage && (
                          <Badge variant="brass">{r.staging.stage}</Badge>
                        )}
                        <Badge variant="neutral">{r.diagnosis || 'Clinical Trichology Consult'}</Badge>
                      </div>
                    </div>

                    {/* Vitals Strip */}
                    {(r.weightKg || r.heightCm) && (
                      <div className="p-2.5 bg-[var(--surface-2)] rounded flex flex-wrap items-center gap-4 text-xs font-mono">
                        <div className="flex items-center gap-1.5 text-[var(--text-dim)]">
                          <HeartPulse className="w-4 h-4 text-red-400" />
                          <span>Recorded Vitals:</span>
                        </div>
                        {r.weightKg && <span>Weight: <strong className="text-[var(--text)]">{r.weightKg} kg</strong></span>}
                        {r.heightCm && <span>Height: <strong className="text-[var(--text)]">{r.heightCm} cm</strong></span>}
                        {r.weightKg && r.heightCm && (() => {
                          const bmi = parseFloat((r.weightKg / Math.pow(r.heightCm / 100, 2)).toFixed(1));
                          const cat = getBmiCategory(bmi);
                          return (
                            <div className="flex items-center gap-1">
                              <span>BMI: <strong>{bmi}</strong></span>
                              <Badge variant={cat.variant}>{cat.label}</Badge>
                            </div>
                          );
                        })()}
                      </div>
                    )}

                    {/* Doctor Clinical Notes */}
                    {r.clinicalNotes && (
                      <div className="p-3 bg-[var(--surface-2)]/70 border-l-2 border-[var(--brass)] rounded text-xs text-[var(--text)] italic leading-relaxed">
                        &ldquo;{r.clinicalNotes}&rdquo;
                      </div>
                    )}

                    {/* Scalp Checklist Evaluation */}
                    {r.scalpChecklist && (
                      <div className="grid grid-cols-3 gap-2 p-2.5 bg-[var(--surface-2)] rounded text-xs font-mono">
                        <div>
                          <span className="text-[10px] text-[var(--text-dim)] block">HAIR PULL TEST</span>
                          <strong className="text-[var(--text)]">{r.scalpChecklist.pullTest || 'Negative (<6 hairs)'}</strong>
                        </div>
                        <div>
                          <span className="text-[10px] text-[var(--text-dim)] block">SEBUM PRODUCTION</span>
                          <strong className="text-[var(--text)]">{r.scalpChecklist.sebum || 'Normal'}</strong>
                        </div>
                        <div>
                          <span className="text-[10px] text-[var(--text-dim)] block">PERIFOLLICULAR ERYTHEMA</span>
                          <strong className="text-[var(--text)]">{r.scalpChecklist.erythema || 'Absent'}</strong>
                        </div>
                      </div>
                    )}

                    {/* Prescriptions */}
                    {r.prescriptions && r.prescriptions.length > 0 && (
                      <div>
                        <span className="block font-mono text-[11px] text-[var(--text-dim)] uppercase tracking-wider mb-2">
                          Prescribed Medications &amp; Topicals:
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {r.prescriptions.map((p, idx) => (
                            <div key={idx} className="p-3 bg-[var(--surface-2)] border border-[var(--border)] rounded-md text-xs flex justify-between items-start">
                              <div className="space-y-0.5">
                                <strong className="text-sm block text-[var(--text)]">{p.medicineName}</strong>
                                <span className="block text-[var(--text-dim)] font-mono text-[11px]">
                                  {p.dosage} • {p.frequency} ({p.duration})
                                </span>
                                {p.instructions && (
                                  <p className="text-[11px] text-[var(--brass)] italic mt-1">{p.instructions}</p>
                                )}
                              </div>
                              <Badge variant={p.isDispensed ? 'success' : 'warn'}>
                                {p.isDispensed ? 'Dispensed' : 'Prescribed'}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Ordered Lab Tests */}
                    {r.labTests && r.labTests.length > 0 && (
                      <div>
                        <span className="block font-mono text-[11px] text-[var(--text-dim)] uppercase tracking-wider mb-2">
                          Ordered Pathology / Trichology Tests:
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {r.labTests.map((t: any, idx: number) => (
                            <div key={idx} className="p-2.5 bg-[var(--surface-2)] border border-[var(--border)] rounded-md text-xs flex justify-between items-center">
                              <div>
                                <strong className="text-[var(--text)]">{typeof t === 'string' ? t : t.testName}</strong>
                                {t.notes && (
                                  <span className="block text-[var(--text-dim)] font-mono text-[11px]">
                                    Indication: {t.notes}
                                  </span>
                                )}
                              </div>
                              <Badge variant="brass">
                                {(typeof t === 'object' && t.status) || 'Ordered'}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Scalp Photos Gallery */}
                    {r.scalpImages && r.scalpImages.length > 0 && (
                      <div>
                        <span className="block font-mono text-[11px] text-[var(--text-dim)] uppercase tracking-wider mb-2">
                          Attached Scalp Macro Photos:
                        </span>
                        <div className="flex gap-2.5 overflow-x-auto pb-1">
                          {r.scalpImages.map((img, idx) => (
                            <div
                              key={idx}
                              onClick={() => setPreviewImage(getMediaUrl(img))}
                              className="relative w-20 h-20 rounded border border-[var(--border)] hover:border-[var(--brass)] cursor-pointer overflow-hidden group shrink-0"
                            >
                              <img src={getMediaUrl(img)} alt={`Visit Photo ${idx + 1}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                                <Eye className="w-4 h-4" />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center space-y-2">
                <FileText className="w-8 h-8 text-[var(--text-dim)] mx-auto opacity-50" />
                <p className="font-mono text-xs text-[var(--text-dim)]">
                  {recordSearch ? 'No consultation records matched your query.' : 'No past consultation records recorded yet.'}
                </p>
                {recordSearch && (
                  <button onClick={() => setRecordSearch('')} className="text-xs text-[var(--brass)] hover:underline">
                    Clear Search
                  </button>
                )}
              </div>
            )}
          </Panel>
        )}

        {/* ================= APPOINTMENTS TAB (F3) ================= */}
        {activeTab === 'appointments' && (
          <Panel
            title="My Doctor Appointments"
            subtitle="Scheduled, waiting, and completed consultations with your specialists"
          >
            {/* Tab Filter & New Appointment Button */}
            <div className="flex justify-between items-center pb-4 mb-4 border-b border-[var(--border)]">
              <div className="flex items-center gap-1 bg-[var(--surface-2)] p-0.5 rounded border border-[var(--border)]">
                <button
                  onClick={() => setAppointmentsTabFilter('upcoming')}
                  className={`px-3 py-1.5 text-xs font-mono rounded transition-colors ${
                    appointmentsTabFilter === 'upcoming'
                      ? 'bg-[var(--brass)] text-black font-bold shadow-xs'
                      : 'text-[var(--text-dim)] hover:text-[var(--text)]'
                  }`}
                >
                  Upcoming ({upcomingAppointments.length})
                </button>
                <button
                  onClick={() => setAppointmentsTabFilter('past')}
                  className={`px-3 py-1.5 text-xs font-mono rounded transition-colors ${
                    appointmentsTabFilter === 'past'
                      ? 'bg-[var(--brass)] text-black font-bold shadow-xs'
                      : 'text-[var(--text-dim)] hover:text-[var(--text)]'
                  }`}
                >
                  Past &amp; Completed ({pastAppointments.length})
                </button>
              </div>

              <button
                onClick={() => setActiveTab('book')}
                className="btn-brass px-3 py-1.5 rounded text-xs font-mono font-medium flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Book New Session
              </button>
            </div>

            {/* List */}
            {appointmentsTabFilter === 'upcoming' ? (
              upcomingAppointments.length > 0 ? (
                <div className="space-y-3">
                  {upcomingAppointments.map((a) => {
                    const isPostponed = a.status === 'Postponed';
                    const diffMs = new Date(a.scheduledAt).getTime() - Date.now();
                    const isLocked = !isPostponed && diffMs <= 24 * 60 * 60 * 1000;

                    return (
                      <div key={a._id} className="p-4 bg-[var(--surface-2)] border border-[var(--border)] rounded-lg flex flex-wrap justify-between items-center gap-4">
                        <div className="space-y-1.5 flex-1 min-w-[240px]">
                          <div className="flex items-center gap-2 flex-wrap">
                            <strong className="text-sm text-[var(--text)]">{(a.doctorId as User)?.fullName || 'Specialist Doctor'}</strong>
                            <Badge variant="brass">{a.type}</Badge>
                            <Badge variant={a.mode === 'Online' ? 'info' : 'neutral'}>
                              {a.mode === 'Online' ? 'Online Video' : 'In-Clinic'}
                            </Badge>
                            {isLocked && (
                              <span
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10.5px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30"
                                title="Within 24 hours of appointment: online changes locked"
                              >
                                <Lock className="w-3 h-3" /> Locked (24h Policy)
                              </span>
                            )}
                          </div>

                          {isPostponed && a.postponedWithoutDate ? (
                            <div className="flex items-center gap-2 text-xs font-mono text-amber-400">
                              <CalendarClock className="w-3.5 h-3.5" />
                              <span>Time will be scheduled later</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 text-xs font-mono text-[var(--text-dim)]">
                              <Calendar className="w-3.5 h-3.5 text-[var(--brass)]" />
                              <span>
                                {new Date(a.scheduledAt).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })} at{' '}
                                {new Date(a.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          )}

                          {a.notes && (
                            <p className="text-xs text-[var(--text-dim)] italic pt-0.5">Notes: {a.notes}</p>
                          )}

                          {/* Postponement or Doctor Reason Alert */}
                          {a.postponedReason && (
                            <div className="p-2 rounded bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 leading-snug">
                              <strong>Doctor Note:</strong> &quot;{a.postponedReason}&quot;
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <Badge variant={a.status === 'Scheduled' ? 'warn' : a.status === 'Postponed' ? 'warn' : 'success'}>
                            {a.status}
                          </Badge>

                          {isPostponed ? (
                            <button
                              onClick={() => handlePatientAppointmentAction(a, 'reschedule')}
                              className="px-3 py-1.5 text-xs font-mono font-semibold rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 transition-colors flex items-center gap-1"
                            >
                              <CalendarClock className="w-3.5 h-3.5" /> Pick New Slot
                            </button>
                          ) : (
                            <>
                              <button
                                onClick={() => handlePatientAppointmentAction(a, 'reschedule')}
                                className="px-2.5 py-1 text-xs font-mono bg-teal-500/10 hover:bg-teal-500/20 border border-teal-500/30 text-teal-400 rounded transition-colors flex items-center gap-1"
                                title={isLocked ? 'Appointment is locked within 24h' : 'Reschedule appointment'}
                              >
                                <CalendarClock className="w-3 h-3" /> Reschedule
                              </button>
                              <button
                                onClick={() => handlePatientAppointmentAction(a, 'cancel')}
                                className="px-2.5 py-1 text-xs font-mono bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 rounded transition-colors flex items-center gap-1"
                                title={isLocked ? 'Appointment is locked within 24h' : 'Cancel appointment'}
                              >
                                <Ban className="w-3 h-3" /> Cancel
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-12 text-center space-y-3">
                  <Calendar className="w-8 h-8 text-[var(--text-dim)] mx-auto opacity-50" />
                  <p className="font-mono text-xs text-[var(--text-dim)]">You have no upcoming appointments scheduled.</p>
                  <button onClick={() => setActiveTab('book')} className="btn-brass px-3 py-1.5 rounded text-xs font-mono inline-flex items-center gap-1">
                    <Plus className="w-3.5 h-3.5" /> Book an Appointment
                  </button>
                </div>
              )
            ) : (
              <DataTable
                columns={[
                  {
                    header: 'DATE & TIME',
                    accessor: (a) => (
                      <span className="font-mono text-xs">
                        {new Date(a.scheduledAt).toLocaleDateString()} {new Date(a.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    ),
                  },
                  { header: 'DOCTOR', accessor: (a) => (a.doctorId as User)?.fullName || 'Doctor' },
                  { header: 'TYPE', accessor: (a) => <Badge variant="brass">{a.type}</Badge> },
                  { header: 'MODE', accessor: (a) => <Badge variant="neutral">{a.mode}</Badge> },
                  {
                    header: 'STATUS',
                    accessor: (a) => (
                      <div className="flex flex-col gap-0.5">
                        <Badge variant={a.status === 'Completed' ? 'success' : a.status === 'Cancelled' ? 'error' : 'neutral'}>
                          {a.status}
                        </Badge>
                        {a.cancellationReason && (
                          <span className="text-[10px] text-red-300/80 italic max-w-[150px] truncate" title={a.cancellationReason}>
                            &quot;{a.cancellationReason}&quot;
                          </span>
                        )}
                        {a.postponedReason && (
                          <span className="text-[10px] text-amber-300/80 italic max-w-[150px] truncate" title={a.postponedReason}>
                            &quot;{a.postponedReason}&quot;
                          </span>
                        )}
                      </div>
                    ),
                  },
                ]}
                data={pastAppointments}
                keyExtractor={(a) => a._id}
                emptyMessage="No past appointments recorded."
              />
            )}
          </Panel>
        )}

        {/* ================= BOOK APPOINTMENT WIZARD (F3) ================= */}
        {activeTab === 'book' && (
          <div className="max-w-xl mx-auto space-y-6">
            <Panel title="Book Consultation or Procedure" subtitle="Self-service appointment reservation with your specialist">
              <form onSubmit={handleBookAppointment} className="space-y-4">
                {/* Step 1: Mode & Type */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider mb-1.5">
                      1. Session Type
                    </label>
                    <select
                      value={bookType}
                      onChange={(e) => setBookType(e.target.value as any)}
                      className="w-full px-3 py-2 text-sm bg-[var(--surface-2)] border border-[var(--border)] rounded text-[var(--text)] focus:outline-none focus:border-[var(--brass)] font-sans"
                    >
                      <option value="Consult">Dermatology Consult</option>
                      <option value="Surgery">Procedure / Dermatosurgery</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider mb-1.5">
                      2. Consultation Mode
                    </label>
                    <select
                      value={bookMode}
                      onChange={(e) => setBookMode(e.target.value as any)}
                      className="w-full px-3 py-2 text-sm bg-[var(--surface-2)] border border-[var(--border)] rounded text-[var(--text)] focus:outline-none focus:border-[var(--brass)] font-sans"
                    >
                      <option value="Offline">In-Clinic Hospital Visit</option>
                      <option value="Online">Online Video Consultation</option>
                    </select>
                  </div>
                </div>

                {/* Step 2: Select Doctor */}
                <div>
                  <label className="block text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider mb-1.5">
                    3. Choose Specialist Doctor *
                  </label>
                  <select
                    required
                    value={bookDoctorId}
                    onChange={(e) => setBookDoctorId(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-[var(--surface-2)] border border-[var(--border)] rounded text-[var(--text)] focus:outline-none focus:border-[var(--brass)] font-sans"
                  >
                    <option value="">-- Select Specialist --</option>
                    {doctors.map((d) => (
                      <option key={d._id} value={d._id}>
                        {d.fullName} — {d.specialization || 'Dermatologist'} (Consult Fee: ₹{d.consultFee || 500})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Step 3: Date */}
                <div>
                  <label className="block text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider mb-1.5">
                    4. Select Appointment Date *
                  </label>
                  <input
                    type="date"
                    required
                    min={new Date().toISOString().split('T')[0]}
                    value={bookDate}
                    onChange={(e) => setBookDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-[var(--surface-2)] border border-[var(--border)] rounded text-[var(--text)] font-mono focus:outline-none focus:border-[var(--brass)]"
                  />
                </div>

                {/* Step 4: Available Slot Picker */}
                {bookDoctorId && bookDate && (
                  <div>
                    <label className="block text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider mb-1.5">
                      5. Available Time Slots *
                    </label>
                    {availableSlots.length > 0 ? (
                      <div className="grid grid-cols-4 gap-2">
                        {availableSlots.map((slot) => (
                          <button
                            key={slot}
                            type="button"
                            onClick={() => setBookSlot(slot)}
                            className={`px-3 py-2 text-xs font-mono rounded border transition-all text-center ${
                              bookSlot === slot
                                ? 'bg-[var(--brass)] text-black font-bold border-[var(--brass)] shadow-sm'
                                : 'bg-[var(--surface-2)] text-[var(--text)] border-[var(--border)] hover:border-[var(--brass)]'
                            }`}
                          >
                            {slot}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="font-mono text-xs text-red-400 p-2 bg-red-500/10 rounded border border-red-500/20">
                        No time slots available on this date for this doctor. Please pick an alternative date.
                      </p>
                    )}
                  </div>
                )}

                {/* Step 5: Notes */}
                <div>
                  <label className="block text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider mb-1.5">
                    Chief Complaint / Notes (Optional)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Briefly describe your hair, scalp, or skin concern..."
                    value={bookNotes}
                    onChange={(e) => setBookNotes(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-[var(--surface-2)] border border-[var(--border)] rounded text-[var(--text)] focus:outline-none focus:border-[var(--brass)]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={!bookDoctorId || !bookDate || !bookSlot}
                  className="w-full btn-brass py-2.5 rounded text-xs font-mono font-bold flex items-center justify-center gap-2 mt-4 disabled:opacity-40 disabled:cursor-not-allowed shadow-md"
                >
                  <CheckCircle className="w-4 h-4" /> Confirm &amp; Reserve Appointment
                </button>
              </form>
            </Panel>
          </div>
        )}

        {/* ================= BILLS & INVOICES TAB (F4) ================= */}
        {activeTab === 'bills' && (
          <div className="space-y-6">
            {/* Financial KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <KpiCard
                label="Total Invoiced"
                value={`₹${bills.reduce((sum, b) => sum + (b.grandTotal || 0), 0).toLocaleString()}`}
                delta={`${bills.length} Total Bills`}
                deltaType="neutral"
                icon={<CreditCard className="w-5 h-5" />}
              />
              <KpiCard
                label="Total Paid"
                value={`₹${bills.reduce((sum, b) => sum + (b.amountPaid || 0), 0).toLocaleString()}`}
                delta="Settled"
                deltaType="positive"
                icon={<IndianRupee className="w-5 h-5" />}
              />
              <KpiCard
                label="Outstanding Balance"
                value={`₹${bills.reduce((sum, b) => sum + Math.max(0, (b.grandTotal || 0) - (b.amountPaid || 0)), 0).toLocaleString()}`}
                delta={bills.some((b) => b.status !== 'Paid') ? "Pending Dues" : "Zero Balance"}
                deltaType={bills.some((b) => b.status !== 'Paid') ? "negative" : "positive"}
                icon={<AlertCircle className="w-5 h-5" />}
              />
            </div>

            <Panel title="My Invoices &amp; Official Receipts" subtitle="Download GST-compliant clinical receipts or settle pending dues online">
              <DataTable
                columns={[
                  {
                    header: 'INVOICE #',
                    accessor: (b) => <span className="font-mono text-xs font-bold text-[var(--brass)]">{b.invoiceNumber}</span>,
                  },
                  {
                    header: 'DATE',
                    accessor: (b) => <span className="font-mono text-xs">{new Date(b.createdAt).toLocaleDateString()}</span>,
                  },
                  {
                    header: 'LINE ITEMS',
                    accessor: (b) => (
                      <span className="text-xs text-[var(--text-dim)]">
                        {b.lineItems?.length || 0} item{b.lineItems?.length === 1 ? '' : 's'}
                      </span>
                    ),
                  },
                  {
                    header: 'GST AMOUNT',
                    accessor: (b) => <span className="font-mono text-xs text-[var(--text-dim)]">₹{(b.totalGst || 0).toLocaleString()}</span>,
                  },
                  {
                    header: 'GRAND TOTAL',
                    accessor: (b) => <span className="font-mono font-bold text-xs text-[var(--text)]">₹{(b.grandTotal || 0).toLocaleString()}</span>,
                  },
                  {
                    header: 'PAID',
                    accessor: (b) => <span className="font-mono text-xs text-emerald-400 font-semibold">₹{(b.amountPaid || 0).toLocaleString()}</span>,
                  },
                  {
                    header: 'STATUS',
                    accessor: (b) => (
                      <Badge variant={b.status === 'Paid' ? 'success' : b.status === 'Partially Paid' ? 'warn' : 'error'}>
                        {b.status}
                      </Badge>
                    ),
                  },
                  {
                    header: 'ACTIONS',
                    accessor: (b) => {
                      const balance = Math.max(0, (b.grandTotal || 0) - (b.amountPaid || 0));
                      return (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => setSelectedInvoice(b)}
                            className="btn-surface px-2.5 py-1 rounded text-xs font-mono flex items-center gap-1 text-[var(--brass)] hover:text-white"
                            title="View & Download GST Tax Invoice"
                          >
                            <FileText className="w-3.5 h-3.5" /> View / PDF
                          </button>
                          {balance > 0 && (
                            <button
                              onClick={() => setSelectedInvoice(b)}
                              className="btn-brass px-2.5 py-1 rounded text-xs font-mono font-bold flex items-center gap-1 shadow-xs"
                            >
                              <CreditCard className="w-3.5 h-3.5" /> Pay Now
                            </button>
                          )}
                        </div>
                      );
                    },
                  },
                ]}
                data={bills}
                keyExtractor={(b) => b._id}
                emptyMessage="No billing records found."
              />
            </Panel>
          </div>
        )}

        {/* ================= PROFILE TAB ================= */}
        {activeTab === 'profile' && (
          <div className="max-w-md mx-auto space-y-6">
            <Panel title="My Demographic Profile" subtitle="Manage your registered patient details and contact coordinates">
              <form onSubmit={handleUpdateProfile} className="space-y-4">
                <div>
                  <label className="block text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider mb-1">
                    Patient ID (Read-only)
                  </label>
                  <input
                    type="text"
                    disabled
                    value={patient?.patientId || ''}
                    className="w-full px-3 py-2 text-sm bg-[var(--surface-2)]/50 border border-[var(--border)] rounded text-[var(--text-dim)] font-mono cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider mb-1">
                    Mobile Phone (Primary Identifier)
                  </label>
                  <input
                    type="text"
                    disabled
                    value={`+91 ${patient?.phone || ''}`}
                    className="w-full px-3 py-2 text-sm bg-[var(--surface-2)]/50 border border-[var(--border)] rounded text-[var(--text-dim)] font-mono cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-[var(--surface-2)] border border-[var(--border)] rounded text-[var(--text)] focus:outline-none focus:border-[var(--brass)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={profileEmail}
                    onChange={(e) => setProfileEmail(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-[var(--surface-2)] border border-[var(--border)] rounded text-[var(--text)] font-mono focus:outline-none focus:border-[var(--brass)]"
                    placeholder="name@example.com"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider mb-1">
                    Location / City
                  </label>
                  <input
                    type="text"
                    value={profileLocation}
                    onChange={(e) => setProfileLocation(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-[var(--surface-2)] border border-[var(--border)] rounded text-[var(--text)] focus:outline-none focus:border-[var(--brass)]"
                    placeholder="Chennai"
                  />
                </div>

                <button type="submit" className="w-full btn-brass py-2.5 rounded text-xs font-mono font-bold shadow-sm">
                  Update Profile Details
                </button>
              </form>
            </Panel>
          </div>
        )}
      </div>

      {/* ================= INVOICE PDF & RAZORPAY MODAL ================= */}
      {selectedInvoice && (
        <InvoicePDFModal
          invoice={selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
          onPaymentSuccess={fetchPatientData}
          clinicInfo={{
            clinicName: clinicSettings?.clinicName,
            address: clinicSettings?.address,
            phone: clinicSettings?.phone,
            email: clinicSettings?.email,
            gstNumber: clinicSettings?.gstNumber,
          }}
        />
      )}

      {/* ================= APPOINTMENT 24H LOCKDOWN MODAL ================= */}
      <AppointmentLockModal
        isOpen={isLockModalOpen}
        onClose={() => {
          setIsLockModalOpen(false);
          setSelectedApptForLock(null);
        }}
        appointmentDate={selectedApptForLock?.scheduledAt}
        patientName={patient?.name}
        doctorName={
          selectedApptForLock?.doctorId && typeof selectedApptForLock.doctorId === 'object'
            ? (selectedApptForLock.doctorId as any).fullName
            : 'Specialist Doctor'
        }
        hospitalPhone={clinicSettings?.phone || '+91 98765 43210'}
        role="patient"
      />

      {/* ================= APPOINTMENT CANCEL / RESCHEDULE ACTION MODAL ================= */}
      {selectedApptForAction && (
        <AppointmentActionModal
          isOpen={isActionModalOpen}
          onClose={() => {
            setIsActionModalOpen(false);
            setSelectedApptForAction(null);
          }}
          appointment={selectedApptForAction}
          actionType={actionModalType}
          userRole="patient"
          doctors={doctors}
          hospitalPhone={clinicSettings?.phone || '+91 98765 43210'}
          onSuccess={() => {
            fetchPatientData();
          }}
          onLockedTrigger={() => {
            setSelectedApptForLock(selectedApptForAction);
            setIsLockModalOpen(true);
          }}
        />
      )}

      {/* ================= IMAGE PREVIEW MODAL ================= */}
      {previewImage && (
        <div
          onClick={() => setPreviewImage(null)}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 cursor-pointer"
        >
          <div className="max-w-2xl max-h-[85vh] relative surface-card p-2 border border-[var(--border)] overflow-hidden rounded-lg shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute top-4 right-4 bg-black/70 text-white w-8 h-8 rounded-full flex items-center justify-center hover:bg-black font-mono text-sm z-10"
            >
              ✕
            </button>
            <img src={previewImage} alt="Scalp Trichoscopy Macro" className="w-full h-auto max-h-[80vh] object-contain rounded" />
          </div>
        </div>
      )}

      {/* ================= PATIENT SCALP GALLERY & COMPARISON MODAL ================= */}
      <PatientScalpGalleryModal
        isOpen={galleryModalOpen}
        onClose={() => setGalleryModalOpen(false)}
        visits={progressVisits}
        patientName={patient?.name}
        uhid={patient?.patientId}
        onOpenLightbox={(images, index, subtitle) => {
          setLightboxImages(images);
          setLightboxIndex(index);
          setLightboxSubtitle(subtitle || '');
          setLightboxOpen(true);
        }}
        onOpenCompare={(img1, img2) => {
          setCompareImages({ img1, img2 });
          setCompareModalOpen(true);
        }}
      />

      {/* ================= FULLSCREEN IMAGE LIGHTBOX MODAL ================= */}
      <ImageLightboxModal
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        images={lightboxImages}
        initialIndex={lightboxIndex}
        title={`Patient Scalp Record: ${patient?.name || 'Patient'}`}
        subtitle={lightboxSubtitle}
        // Note: onDeleteImage is omitted so patient cannot delete or edit
      />

      {/* ================= SCALP COMPARISON MODAL (SLIDER & SIDE-BY-SIDE) ================= */}
      {compareImages && (
        <ScalpCompareModal
          isOpen={compareModalOpen}
          onClose={() => {
            setCompareModalOpen(false);
            setCompareImages(null);
          }}
          image1={compareImages.img1}
          image2={compareImages.img2}
          patientName={patient?.name}
          uhid={patient?.patientId}
        />
      )}
    </AppShell>
  );
}
