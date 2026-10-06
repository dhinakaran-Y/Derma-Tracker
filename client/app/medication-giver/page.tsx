'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AppShell } from '../../components/AppShell';
import { KpiCard } from '../../components/KpiCard';
import { Panel } from '../../components/Panel';
import { Badge } from '../../components/Badge';
import { DataTable, Column } from '../../components/DataTable';
import { StaticQRModal } from '../../components/StaticQRModal';
import { CounterQRModal } from '../../components/CounterQRModal';
import { DynamicQRModal } from '../../components/DynamicQRModal';
import { PaymentHistory, PharmacyPaymentRecord, PaymentStats } from '../../components/PaymentHistory';
import { api, getMediaUrl } from '../../lib/api';
import { getSocket } from '../../lib/socket';
import { Visit, Patient, Medicine, User } from '../../types';
import { toast } from 'sonner';
import {
  Pill,
  CheckCircle2,
  Loader2,
  Clock,
  QrCode,
  Layers,
  History,
  FileCheck,
  Search,
  BarChart3,
  Users,
  TrendingUp,
  Calendar,
  RefreshCw,
  BookOpen,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  Check,
  X,
  Filter,
  CreditCard,
  Zap,
  Settings2,
} from 'lucide-react';
import { Batch } from '../../types';
import { ExpiryBadge } from '../../lib/formatExpiry';

interface PaymentSettings {
  staticQrEnabled: boolean;
  staticQrVpa: string;
  staticQrDisplayName: string;
  dynamicQrEnabled: boolean;
  razorpayKeyId: string;
  isTestMode: boolean;
}

interface SalesSummary {
  totalUnitsSold: number;
  totalPatients: number;
  totalDispensations: number;
  totalRevenue: number;
}

interface MedicineSaleItem {
  medicineName: string;
  medicineId: string | null;
  category: string;
  unit: string;
  imageUrl: string | null;
  totalQuantity: number;
  uniquePatients: number;
  dispensationCount: number;
  estimatedRevenue: number;
  avgQuantityPerPatient: number;
}

interface SalesAnalyticsData {
  period: 'day' | 'week' | 'month' | 'year' | 'all';
  startDate: string;
  endDate: string;
  summary: SalesSummary;
  allTimeCount?: number;
  medicines: MedicineSaleItem[];
}

function getNearestExpiry(batches: Batch[]): Batch | null {
  if (!batches || batches.length === 0) return null;
  return batches.reduce((nearest, b) => new Date(b.expiryDate) < new Date(nearest.expiryDate) ? b : nearest);
}

export default function MedicationGiverPage() {
  const [activeTab, setActiveTab] = useState('pending');
  const [pendingVisits, setPendingVisits] = useState<Visit[]>([]);
  const [pendingFilter, setPendingFilter] = useState<'all' | 'today'>('all');
  const [pendingSearch, setPendingSearch] = useState('');
  const [catalogue, setCatalogue] = useState<Medicine[]>([]);
  const [dispenseLogs, setDispenseLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Dispense Log & Sales Analytics Toggle State
  const [logView, setLogView] = useState<'history' | 'analytics'>('history');
  const [analyticsPeriod, setAnalyticsPeriod] = useState<'day' | 'week' | 'month' | 'year' | 'all'>('day');
  const [analyticsData, setAnalyticsData] = useState<SalesAnalyticsData | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  // Active Dispensing State
  const [dispenseVisit, setDispenseVisit] = useState<Visit | null>(null);

  // Active Booklet Dispensing Modal State
  const [bookletVisit, setBookletVisit] = useState<Visit | null>(null);
  const [bookletSearch, setBookletSearch] = useState('');
  const [bookletCategory, setBookletCategory] = useState('All');
  const [selectedBookletItems, setSelectedBookletItems] = useState<
    Array<{
      medicine: Medicine;
      quantity: number;
      dosage: string;
      frequency: string;
      duration: string;
      instructions: string;
    }>
  >([]);
  const [isSubmittingBooklet, setIsSubmittingBooklet] = useState(false);

  // ── Payment Settings & History State ──
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings>({
    staticQrEnabled: false,
    staticQrVpa: '',
    staticQrDisplayName: 'DermaTrack Clinic',
    dynamicQrEnabled: false,
    razorpayKeyId: '',
    isTestMode: true,
  });
  const [paymentRecords, setPaymentRecords] = useState<PharmacyPaymentRecord[]>([]);
  const [paymentStats, setPaymentStats] = useState<PaymentStats | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentStatsPeriod, setPaymentStatsPeriod] = useState<'today' | 'week' | 'month'>('today');
  const [paymentModeFilter, setPaymentModeFilter] = useState<'' | 'static_qr' | 'dynamic_qr'>('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<'' | 'pending' | 'paid' | 'failed'>('');

  // ── Static QR Modal State ──
  const [staticQRVisit, setStaticQRVisit] = useState<Visit | null>(null);
  const [staticQRAmount, setStaticQRAmount] = useState(0);
  const [isConfirmingStatic, setIsConfirmingStatic] = useState(false);
  const [isCounterStaticQrOpen, setIsCounterStaticQrOpen] = useState(false);

  // ── Dynamic QR Modal State ──
  const [dynamicQRVisit, setDynamicQRVisit] = useState<Visit | null>(null);
  const [dynamicOrderData, setDynamicOrderData] = useState<any>(null);
  const [isCreatingDynamicOrder, setIsCreatingDynamicOrder] = useState(false);

  const fetchPharmacyData = useCallback(async (filterOverride?: 'all' | 'today') => {
    const f = filterOverride !== undefined ? filterOverride : pendingFilter;
    try {
      setLoading(true);
      const [pRes, cRes, lRes, settingsRes] = await Promise.all([
        api.get(`/pharmacy/pending?date=${f}`),
        api.get('/pharmacy/catalogue'),
        api.get('/pharmacy/dispense-log?limit=50'),
        api.get('/payment/settings'),
      ]);
      setPendingVisits(pRes.data.data || []);
      setCatalogue(cRes.data.data || []);
      setDispenseLogs(lRes.data.data || []);
      if (settingsRes.data.data) setPaymentSettings(settingsRes.data.data);
    } catch {
      toast.error('Failed to load pharmacy data');
    } finally {
      setLoading(false);
    }
  }, [pendingFilter]);

  const filteredPendingVisits = useMemo(() => {
    if (!pendingSearch.trim()) return pendingVisits;
    const q = pendingSearch.toLowerCase().trim();
    return pendingVisits.filter((v) => {
      const p = v.patientId as Patient;
      const doc = v.doctorId as User;
      const patientMatch =
        p?.name?.toLowerCase().includes(q) ||
        p?.patientId?.toLowerCase().includes(q) ||
        p?.phone?.includes(q);
      const docMatch = doc?.fullName?.toLowerCase().includes(q);
      const medMatch = v.prescriptions?.some((pr) => pr.medicineName?.toLowerCase().includes(q));
      return Boolean(patientMatch || docMatch || medMatch);
    });
  }, [pendingVisits, pendingSearch]);

  const fetchPaymentData = useCallback(async (period: 'today' | 'week' | 'month' = 'today', mode = '', status = '') => {
    try {
      setPaymentLoading(true);
      const params = new URLSearchParams({ period });
      if (mode) params.append('mode', mode);
      if (status) params.append('status', status);
      const [histRes, statsRes] = await Promise.all([
        api.get(`/payment/history?${params}`),
        api.get(`/payment/stats?period=${period}`),
      ]);
      setPaymentRecords(histRes.data.data?.records || []);
      setPaymentStats(statsRes.data.data || null);
    } catch {
      toast.error('Failed to load payment data');
    } finally {
      setPaymentLoading(false);
    }
  }, []);

  const fetchAnalytics = useCallback(async (period: 'day' | 'week' | 'month' | 'year' | 'all') => {
    try {
      setAnalyticsLoading(true);
      const res = await api.get(`/pharmacy/sales-analytics?period=${period}`);
      setAnalyticsData(res.data.data);
    } catch {
      toast.error('Failed to load sales analytics');
    } finally {
      setAnalyticsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPharmacyData();
    const socket = getSocket();
    socket.on('queue:updated', () => {
      fetchPharmacyData();
      if (logView === 'analytics') fetchAnalytics(analyticsPeriod);
    });
    // Real-time payment settings update (toggled by receptionist / settings page)
    socket.on('settings:payment-updated', (updated: PaymentSettings) => {
      setPaymentSettings((prev) => ({ ...prev, ...updated }));
    });
    return () => {
      socket.off('queue:updated');
      socket.off('settings:payment-updated');
    };
  }, [fetchPharmacyData, fetchAnalytics, logView, analyticsPeriod]);

  useEffect(() => {
    if (activeTab === 'logs' && logView === 'analytics') {
      fetchAnalytics(analyticsPeriod);
    }
  }, [activeTab, logView, analyticsPeriod, fetchAnalytics]);

  useEffect(() => {
    if (activeTab === 'payments') {
      fetchPaymentData(paymentStatsPeriod, paymentModeFilter, paymentStatusFilter);
    }
  }, [activeTab, paymentStatsPeriod, paymentModeFilter, paymentStatusFilter, fetchPaymentData]);

  const handleDispenseItem = async (visitId: string, prescriptionId: string) => {
    try {
      await api.post('/pharmacy/dispense', { visitId, prescriptionId });
      toast.success('Medicine dispensed & stock deducted (FIFO)');
      fetchPharmacyData();

      // Update current modal state if open
      if (dispenseVisit && dispenseVisit._id === visitId) {
        setDispenseVisit((prev) =>
          prev
            ? {
                ...prev,
                prescriptions: prev.prescriptions.map((p) =>
                  p._id === prescriptionId ? { ...p, isDispensed: true } : p
                ),
              }
            : null
        );
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Dispense failed');
    }
  };

  const [dispensingAll, setDispensingAll] = useState(false);

  const handleDispenseAll = async (visitId: string) => {
    if (!dispenseVisit) return;
    const pendingItems = dispenseVisit.prescriptions.filter((p) => !p.isDispensed);
    if (pendingItems.length === 0) {
      toast.info('All items in this prescription are already dispensed');
      return;
    }

    setDispensingAll(true);
    let successCount = 0;
    try {
      for (const item of pendingItems) {
        if (!item._id) continue;
        try {
          await api.post('/pharmacy/dispense', { visitId, prescriptionId: item._id });
          successCount++;
        } catch (itemErr: any) {
          toast.error(`Failed to dispense ${item.medicineName}: ${itemErr.response?.data?.error || itemErr.message}`);
        }
      }

      if (successCount > 0) {
        toast.success(`Successfully dispensed ${successCount} medicine(s) & deducted stock!`);
        fetchPharmacyData();
        setDispenseVisit((prev) =>
          prev
            ? {
                ...prev,
                prescriptions: prev.prescriptions.map((p) => ({ ...p, isDispensed: true })),
              }
            : null
        );
      }
    } finally {
      setDispensingAll(false);
    }
  };

  const handleOpenBookletModal = (visit: Visit) => {
    setBookletVisit(visit);
    setBookletSearch('');
    setBookletCategory('All');
    setSelectedBookletItems([]);
  };

  const handleAddMedicineToBooklet = (med: Medicine) => {
    if (med.totalStock <= 0) {
      toast.error(`"${med.name}" is out of stock`);
      return;
    }

    setSelectedBookletItems((prev) => {
      const exists = prev.find((item) => item.medicine._id === med._id);
      if (exists) {
        if (exists.quantity >= med.totalStock) {
          toast.warning(`Maximum available stock reached for ${med.name} (${med.totalStock} ${med.unit})`);
          return prev;
        }
        return prev.map((item) =>
          item.medicine._id === med._id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [
        ...prev,
        {
          medicine: med,
          quantity: 1,
          dosage: med.category === 'Tablet' || med.category === 'Capsule' ? '1 tablet' : 'Apply thin film',
          frequency: 'Once daily at night',
          duration: '30 days',
          instructions: 'As directed in booklet',
        },
      ];
    });
    toast.success(`Added ${med.name} to order`);
  };

  const handleUpdateBookletItemQty = (medicineId: string, delta: number) => {
    setSelectedBookletItems((prev) =>
      prev
        .map((item) => {
          if (item.medicine._id === medicineId) {
            const newQty = item.quantity + delta;
            if (newQty > item.medicine.totalStock) {
              toast.warning(`Maximum stock available is ${item.medicine.totalStock}`);
              return item;
            }
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as any
    );
  };

  const handleRemoveBookletItem = (medicineId: string) => {
    setSelectedBookletItems((prev) => prev.filter((item) => item.medicine._id !== medicineId));
  };

  const handleUpdateBookletItemField = (medicineId: string, field: string, val: string) => {
    setSelectedBookletItems((prev) =>
      prev.map((item) => (item.medicine._id === medicineId ? { ...item, [field]: val } : item))
    );
  };

  const handleFulfillBookletOrder = async () => {
    if (!bookletVisit) return;
    if (selectedBookletItems.length === 0) {
      toast.error('Please select at least one medicine to fulfill this order');
      return;
    }

    try {
      setIsSubmittingBooklet(true);
      const itemsPayload = selectedBookletItems.map((item) => ({
        medicineId: item.medicine._id,
        quantity: item.quantity,
        dosage: item.dosage,
        frequency: item.frequency,
        duration: item.duration,
        instructions: item.instructions,
      }));

      await api.post('/pharmacy/booklet-fulfill', {
        visitId: bookletVisit._id,
        items: itemsPayload,
      });

      toast.success('Prescription booklet order fulfilled & stock deducted!');
      setBookletVisit(null);
      setSelectedBookletItems([]);
      fetchPharmacyData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to fulfill booklet order');
    } finally {
      setIsSubmittingBooklet(false);
    }
  };

  // ── Static QR: open modal ──
  const handleOpenStaticQR = (visit: Visit) => {
    const total = visit.prescriptions
      .filter((p) => !p.isDispensed)
      .reduce((acc, p) => {
        const med = catalogue.find((m) => m._id === p.medicineId || m.name.toLowerCase() === p.medicineName?.toLowerCase());
        return acc + (p.quantity || 1) * (med?.sellingPrice || 0);
      }, 0);
    setStaticQRAmount(total > 0 ? total : 1);
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
        notes,
      });
      toast.success(`₹${staticQRAmount} payment recorded via Static QR`);
      setStaticQRVisit(null);
      fetchPaymentData(paymentStatsPeriod);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to record payment');
    } finally {
      setIsConfirmingStatic(false);
    }
  };

  // ── Dynamic QR: create order & open modal ──
  const handleOpenDynamicQR = async (visit: Visit) => {
    const total = visit.prescriptions
      .filter((p) => !p.isDispensed)
      .reduce((acc, p) => {
        const med = catalogue.find((m) => m._id === p.medicineId || m.name.toLowerCase() === p.medicineName?.toLowerCase());
        return acc + (p.quantity || 1) * (med?.sellingPrice || 0);
      }, 0);
    const amount = total > 0 ? total : 1;
    try {
      setIsCreatingDynamicOrder(true);
      setDynamicQRVisit(visit);
      const res = await api.post('/payment/dynamic-order', {
        amount,
        visitId: visit._id,
        patientName: (visit.patientId as Patient)?.name,
      });
      setDynamicOrderData(res.data.data);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to create Razorpay order');
      setDynamicQRVisit(null);
    } finally {
      setIsCreatingDynamicOrder(false);
    }
  };

  const navGroups = [
    {
      title: 'Dispensary',
      items: [
        { id: 'pending', label: 'Pending Prescriptions', icon: Clock, badge: pendingVisits.length },
        { id: 'catalogue', label: 'Medicine Catalogue', icon: Pill },
        { id: 'logs', label: 'Dispense Log', icon: History },
        ...(paymentSettings.staticQrEnabled || paymentSettings.dynamicQrEnabled
          ? [{ id: 'payments', label: 'Payment History', icon: CreditCard }]
          : []),
      ],
    },
  ];

  const pendingColumns: Column<Visit>[] = [
    {
      header: 'PATIENT',
      accessor: (v) => {
        const p = v.patientId as Patient;
        return (
          <div>
            <strong className="block text-[var(--text)]">{p?.name || 'Patient'}</strong>
            <span className="font-mono text-xs text-[var(--text-dim)]">{p?.patientId} • +91 {p?.phone}</span>
          </div>
        );
      },
    },
    {
      header: 'PRESCRIBING DOCTOR',
      accessor: (v) => (v.doctorId as User)?.fullName || 'Doctor',
    },
    {
      header: 'VISIT DATE',
      accessor: (v) => {
        const isToday =
          new Date(v.visitDate).toDateString() === new Date().toDateString();
        return (
          <div className="font-mono text-xs">
            <span className={isToday ? 'text-[var(--brass)] font-bold' : 'text-[var(--text)]'}>
              {new Date(v.visitDate).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
            {isToday ? (
              <span className="block text-[10px] text-[var(--success)] font-semibold">Today</span>
            ) : (
              <span className="block text-[10px] text-[var(--text-dim)]">Queue</span>
            )}
          </div>
        );
      },
    },
    {
      header: 'PRESCRIBED MEDICINES',
      accessor: (v) => {
        if (v.consultationWorkflow === 'prescription_booklet') {
          return (
            <div className="space-y-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-mono font-bold bg-amber-500/15 text-amber-500 border border-amber-500/30">
                <span>📖</span>
                <span>Prescription Booklet Workflow</span>
              </span>
              <span className="block font-mono text-[11px] text-[var(--text-dim)]">
                {v.prescriptions?.length
                  ? `${v.prescriptions.length} medicine(s) logged`
                  : 'Documented in physical OP booklet • Add & Sale below'}
              </span>
            </div>
          );
        }
        const pending = v.prescriptions.filter((p) => !p.isDispensed);
        return (
          <span className="font-mono text-xs text-[var(--brass)] font-semibold">
            {pending.length} pending ({v.prescriptions.length} total)
          </span>
        );
      },
    },
    {
      header: 'ACTION',
      accessor: (v) => {
        const isBooklet = v.consultationWorkflow === 'prescription_booklet';
        return (
          <div className="flex flex-wrap items-center gap-1.5">
            {/* Primary fulfill button */}
            {isBooklet ? (
              <button
                onClick={() => handleOpenBookletModal(v)}
                className="px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-sm transition-all cursor-pointer"
              >
                <span>📖</span>
                <span>Fulfill Rx</span>
              </button>
            ) : (
              <button
                onClick={() => setDispenseVisit(v)}
                className="btn-brass px-3 py-1 rounded text-xs font-mono flex items-center gap-1 cursor-pointer"
              >
                <FileCheck className="w-3.5 h-3.5" />
                <span>Fulfill</span>
              </button>
            )}

            {/* Dynamic QR button — only when enabled */}
            {paymentSettings.dynamicQrEnabled && (
              <button
                onClick={() => handleOpenDynamicQR(v)}
                disabled={isCreatingDynamicOrder}
                className="px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1 bg-violet-600 hover:bg-violet-500 text-white shadow-sm transition-all cursor-pointer disabled:opacity-50"
                title="Generate Dynamic QR"
              >
                {isCreatingDynamicOrder ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Zap className="w-3.5 h-3.5" />
                )}
                <span className="hidden sm:inline">Dyn QR</span>
              </button>
            )}
          </div>
        );
      },
    },
  ];

  const catalogueColumns: Column<Medicine>[] = [
    {
      header: 'MEDICINE',
      accessor: (m) => (
        <div className="flex items-center gap-3">
          {m.imageUrl ? (
            <img
              src={getMediaUrl(m.imageUrl)}
              alt={m.name}
              className="w-10 h-10 object-cover rounded-lg border border-[var(--border)] shrink-0 bg-white shadow-xs"
            />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-[var(--surface-3)] border border-[var(--border)] flex items-center justify-center shrink-0 text-lg shadow-xs" title={m.category}>
              {m.category === 'Serum' ? '💧' : m.category === 'Shampoo' ? '🧴' : m.category === 'Solution' ? '🧪' : m.category === 'Ointment' ? '🩹' : m.category === 'Oil' ? '✨' : '💊'}
            </div>
          )}
          <div className="min-w-0">
            <strong className="text-sm block text-[var(--text)] truncate">{m.name}</strong>
            <span className="text-xs text-[var(--text-dim)] block truncate">{m.genericName || '-'}</span>
            {m.description && (
              <span className="text-[10px] text-[var(--text-dim)] block truncate max-w-[260px]" title={m.description}>
                {m.description.slice(0, 70)}{m.description.length > 70 ? '...' : ''}
              </span>
            )}
          </div>
        </div>
      ),
    },
    { header: 'CATEGORY', accessor: (m) => <Badge variant="brass">{m.category}</Badge> },
    {
      header: 'STOCK AVAILABLE',
      accessor: (m) => (
        <span
          className={`font-mono font-bold text-xs ${
            m.totalStock <= m.reorderLevel ? 'text-[var(--error)]' : 'text-[var(--success)]'
          }`}
        >
          {m.totalStock} {m.unit}
        </span>
      ),
    },
    {
      header: 'NEAREST EXPIRY',
      accessor: (m) => {
        const nearest = getNearestExpiry(m.batches);
        if (!nearest) return <span className="font-mono text-xs text-[var(--text-dim)]">-</span>;
        return <ExpiryBadge dateStr={nearest.expiryDate} />;
      },
    },
    { header: 'PRICE', accessor: (m) => <span className="font-mono font-semibold">₹{m.sellingPrice}</span> },
  ];

  const logColumns: Column<any>[] = [
    {
      header: 'TIMESTAMP',
      headerClassName: 'w-[180px]',
      className: 'w-[180px] whitespace-nowrap',
      accessor: (l) => (
        <span className="font-mono text-xs text-[var(--text-dim)]">
          {new Date(l.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} •{' '}
          {new Date(l.createdAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      header: 'MEDICINE DISPENSED',
      headerClassName: 'min-w-[240px]',
      className: 'min-w-[240px]',
      accessor: (l) => (
        <strong className="text-xs font-semibold text-[var(--text)]">
          {l.details?.medicineName || l.description?.replace(/^Dispensed medication:\s*/, '') || '-'}
        </strong>
      ),
    },
    {
      header: 'QTY',
      headerClassName: 'w-[100px]',
      className: 'w-[100px] whitespace-nowrap',
      accessor: (l) => <Badge variant="neutral">{l.details?.quantity || 1} units</Badge>,
    },
    {
      header: 'DISPENSED BY',
      headerClassName: 'w-[150px]',
      className: 'w-[150px] whitespace-nowrap',
      accessor: (l) => (
        <span className="font-mono text-xs text-[var(--text)]">
          {l.actorName || l.userRole || 'MedicationGiver'}
        </span>
      ),
    },
  ];

  const analyticsColumns: Column<MedicineSaleItem>[] = [
    {
      header: 'MEDICINE',
      headerClassName: 'min-w-[260px]',
      className: 'min-w-[260px]',
      accessor: (m) => (
        <div className="flex items-center gap-3">
          {m.imageUrl ? (
            <img
              src={getMediaUrl(m.imageUrl)}
              alt={m.medicineName}
              className="w-10 h-10 object-cover rounded-lg border border-[var(--border)] shrink-0 bg-white shadow-xs"
            />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-[var(--surface-3)] border border-[var(--border)] flex items-center justify-center shrink-0 text-lg shadow-xs" title={m.category}>
              {m.category === 'Serum' ? '💧' : m.category === 'Shampoo' ? '🧴' : m.category === 'Solution' ? '🧪' : m.category === 'Ointment' ? '🩹' : m.category === 'Oil' ? '✨' : '💊'}
            </div>
          )}
          <div className="min-w-0">
            <strong className="text-sm block text-[var(--text)] truncate">{m.medicineName}</strong>
            <span className="text-xs text-[var(--brass)] font-mono block truncate">
              {m.totalQuantity} {m.unit} sold for {m.uniquePatients} patient{m.uniquePatients !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      ),
    },
    {
      header: 'CATEGORY',
      headerClassName: 'w-[120px]',
      className: 'w-[120px] whitespace-nowrap',
      accessor: (m) => <Badge variant="brass">{m.category}</Badge>,
    },
    {
      header: 'UNITS SOLD',
      headerClassName: 'w-[130px]',
      className: 'w-[130px] whitespace-nowrap',
      accessor: (m) => (
        <span className="font-mono font-bold text-xs text-[var(--text)] bg-[var(--surface-2)] px-2.5 py-1 rounded border border-[var(--border)]">
          {m.totalQuantity} {m.unit}
        </span>
      ),
    },
    {
      header: 'PATIENTS SERVED',
      headerClassName: 'w-[140px]',
      className: 'w-[140px] whitespace-nowrap',
      accessor: (m) => (
        <span className="font-mono text-xs font-semibold text-[var(--text)] flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5 text-[var(--text-dim)]" />
          {m.uniquePatients} {m.uniquePatients === 1 ? 'patient' : 'patients'}
        </span>
      ),
    },
    {
      header: 'DISPENSATIONS',
      headerClassName: 'w-[130px]',
      className: 'w-[130px] whitespace-nowrap',
      accessor: (m) => (
        <span className="font-mono text-xs text-[var(--text-dim)]">
          {m.dispensationCount} orders
        </span>
      ),
    },
    {
      header: 'AVG / PATIENT',
      headerClassName: 'w-[120px]',
      className: 'w-[120px] whitespace-nowrap',
      accessor: (m) => (
        <span className="font-mono text-xs text-[var(--text-dim)]">
          {m.avgQuantityPerPatient} {m.unit}
        </span>
      ),
    },
    {
      header: 'EST. REVENUE',
      headerClassName: 'w-[130px] text-right',
      className: 'w-[130px] text-right whitespace-nowrap',
      accessor: (m) => (
        <span className="font-mono font-bold text-xs text-[var(--success)]">
          ₹{m.estimatedRevenue.toLocaleString()}
        </span>
      ),
    },
  ];

  return (
    <AppShell
      navGroups={navGroups}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      pageTitle="Pharmacy & Medication Dispensing"
    >
      {/* ================= PENDING TAB ================= */}
      {activeTab === 'pending' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <KpiCard
              label="Pending Orders"
              value={pendingVisits.length}
              delta="Live Queue"
              deltaType="warn"
              icon={<Clock className="w-5 h-5" />}
            />
            <KpiCard
              label="Catalogue Items"
              value={catalogue.length}
              subtext="Active Formulations"
              icon={<Pill className="w-5 h-5" />}
            />
            <KpiCard
              label="Dispensed Today"
              value={dispenseLogs.length}
              delta="Completed"
              deltaType="positive"
              icon={<CheckCircle2 className="w-5 h-5" />}
            />
          </div>

          <Panel
            title="Prescriptions Pending Fulfillment"
            subtitle="Orders written by consulting doctors awaiting physical verification & dispensing"
            action={
              <div className="flex flex-wrap items-center gap-2.5">
                {/* Search */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-dim)]" />
                  <input
                    type="text"
                    placeholder="Search patient, doctor, Rx..."
                    value={pendingSearch}
                    onChange={(e) => setPendingSearch(e.target.value)}
                    className="pl-8 pr-6 py-1 text-xs bg-[var(--surface-2)] border border-[var(--border)] rounded-md text-[var(--text)] font-mono placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--brass)] w-44 sm:w-56"
                  />
                  {pendingSearch && (
                    <button
                      onClick={() => setPendingSearch('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-dim)] hover:text-[var(--text)] text-xs cursor-pointer"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Date Filter: All Pending vs Today */}
                <div className="flex items-center rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-0.5 text-xs font-mono">
                  <button
                    type="button"
                    onClick={() => {
                      setPendingFilter('all');
                      fetchPharmacyData('all');
                    }}
                    className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                      pendingFilter === 'all'
                        ? 'bg-[var(--brass)] text-white font-bold shadow-xs'
                        : 'text-[var(--text-dim)] hover:text-[var(--text)]'
                    }`}
                  >
                    All Pending ({pendingVisits.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPendingFilter('today');
                      fetchPharmacyData('today');
                    }}
                    className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                      pendingFilter === 'today'
                        ? 'bg-[var(--brass)] text-white font-bold shadow-xs'
                        : 'text-[var(--text-dim)] hover:text-[var(--text)]'
                    }`}
                  >
                    Today
                  </button>
                </div>

                {/* Static QR Code Button */}
                {paymentSettings.staticQrEnabled && (
                  <button
                    type="button"
                    onClick={() => setIsCounterStaticQrOpen(true)}
                    className="px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white shadow-xs transition-all cursor-pointer"
                    title="View, download (JPG/PDF), share, or print Pharmacy Static QR Code"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    <span>Static QR Code</span>
                  </button>
                )}

                {/* Manual Refresh */}
                <button
                  type="button"
                  onClick={() => fetchPharmacyData()}
                  className="p-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-dim)] hover:text-[var(--text)] transition-colors cursor-pointer"
                  title="Refresh pending prescriptions"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            }
          >
            <DataTable
              columns={pendingColumns}
              data={filteredPendingVisits}
              keyExtractor={(v) => v._id}
              emptyMessage={
                pendingSearch
                  ? 'No pending prescriptions match your search.'
                  : pendingFilter === 'today'
                  ? "No pending prescriptions written today. Switch to 'All Pending' to view previous queue."
                  : 'No pending prescriptions at this time.'
              }
            />
          </Panel>
        </div>
      )}

      {/* ================= CATALOGUE TAB ================= */}
      {activeTab === 'catalogue' && (
        <Panel title="Dispensary Medicine Formulary" subtitle="Active medications in stock">
          <DataTable
            columns={catalogueColumns}
            data={catalogue}
            keyExtractor={(m) => m._id}
            emptyMessage="No medicines available."
          />
        </Panel>
      )}

      {/* ================= LOGS TAB ================= */}
      {activeTab === 'logs' && (
        <div className="space-y-6">
          {/* View Toggle Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-[var(--surface)] p-2 rounded-xl border border-[var(--border)] shadow-xs">
            {/* View Switcher: Method 1 (History Log) vs Method 2 (Sales Analytics) */}
            <div className="flex items-center bg-[var(--surface-2)] p-1 rounded-lg border border-[var(--border)]">
              <button
                type="button"
                onClick={() => setLogView('history')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-mono font-semibold transition-all ${
                  logView === 'history'
                    ? 'bg-[var(--brass)] text-[var(--bg)] shadow-sm'
                    : 'text-[var(--text-dim)] hover:text-[var(--text)]'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>1. Dispensation Log</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setLogView('analytics');
                  if (!analyticsData) fetchAnalytics(analyticsPeriod);
                }}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-mono font-semibold transition-all ${
                  logView === 'analytics'
                    ? 'bg-[var(--brass)] text-[var(--bg)] shadow-sm'
                    : 'text-[var(--text-dim)] hover:text-[var(--text)]'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>2. Sales Analytics</span>
              </button>
            </div>

            {/* If Analytics view is active, show Period Filters (Day / Week / Month / Year / All) */}
            {logView === 'analytics' && (
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono text-[var(--text-dim)] uppercase tracking-wider flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Period:
                </span>
                <div className="flex items-center bg-[var(--surface-2)] p-1 rounded-lg border border-[var(--border)]">
                  {(['day', 'week', 'month', 'year', 'all'] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => {
                        setAnalyticsPeriod(p);
                        fetchAnalytics(p);
                      }}
                      className={`px-3 py-1 rounded-md text-xs font-mono font-medium transition-all ${
                        analyticsPeriod === p
                          ? 'bg-[var(--brass)] text-[var(--bg)] shadow-xs font-bold'
                          : 'text-[var(--text-dim)] hover:text-[var(--text)]'
                      }`}
                    >
                      {p === 'all' ? 'All Time' : p.charAt(0).toUpperCase() + p.slice(1)}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => fetchAnalytics(analyticsPeriod)}
                  title="Refresh analytics"
                  className="p-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-dim)] hover:text-[var(--text)] transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${analyticsLoading ? 'animate-spin text-[var(--brass)]' : ''}`} />
                </button>
              </div>
            )}
          </div>

          {/* METHOD 1: HISTORY LOG */}
          {logView === 'history' && (
            <Panel title="Dispensation History" subtitle="Audit trail of verified and dispensed medications">
              <DataTable
                columns={logColumns}
                data={dispenseLogs}
                keyExtractor={(l) => l._id}
                emptyMessage="No dispensation logs recorded."
              />
            </Panel>
          )}

          {/* METHOD 2: SALES ANALYTICS */}
          {logView === 'analytics' && (
            <div className="space-y-6">
              {/* Summary KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard
                  label="Units Sold"
                  value={analyticsData?.summary?.totalUnitsSold || 0}
                  delta={`${analyticsPeriod === 'all' ? 'ALL TIME' : analyticsPeriod.toUpperCase()}`}
                  deltaType="warn"
                  icon={<Pill className="w-5 h-5" />}
                />
                <KpiCard
                  label="Patients Served"
                  value={analyticsData?.summary?.totalPatients || 0}
                  delta="Unique Patients"
                  deltaType="positive"
                  icon={<Users className="w-5 h-5" />}
                />
                <KpiCard
                  label="Dispensations"
                  value={analyticsData?.summary?.totalDispensations || 0}
                  delta="Orders Fulfilled"
                  icon={<FileCheck className="w-5 h-5" />}
                />
                <KpiCard
                  label="Estimated Revenue"
                  value={`₹${(analyticsData?.summary?.totalRevenue || 0).toLocaleString()}`}
                  delta="Gross Sales"
                  deltaType="positive"
                  icon={<TrendingUp className="w-5 h-5" />}
                />
              </div>

              {/* Medicine Sales Breakdown Panel */}
              <Panel
                title={`Sales Analytics — ${analyticsPeriod === 'all' ? 'ALL TIME' : analyticsPeriod.toUpperCase()} SUMMARY`}
                subtitle={
                  analyticsPeriod === 'all'
                    ? 'All-time consolidated sales volume across all recorded dispensary orders'
                    : analyticsData?.startDate && analyticsData?.endDate
                    ? `Consolidated sales breakdown between ${new Date(analyticsData.startDate).toLocaleDateString()} and ${new Date(analyticsData.endDate).toLocaleDateString()}`
                    : 'Consolidated sales volume by medication'
                }
              >
                {analyticsLoading ? (
                  <div className="py-12 flex flex-col items-center justify-center text-center space-y-2">
                    <RefreshCw className="w-6 h-6 animate-spin text-[var(--brass)]" />
                    <span className="font-mono text-xs text-[var(--text-dim)]">Aggregating sales data...</span>
                  </div>
                ) : (analyticsData?.medicines || []).length > 0 ? (
                  <DataTable
                    columns={analyticsColumns}
                    data={analyticsData?.medicines || []}
                    keyExtractor={(m) => m.medicineName}
                    emptyMessage="No medication sales recorded."
                  />
                ) : (
                  <div className="py-12 px-4 text-center space-y-3 bg-[var(--surface-2)]/40 rounded-lg border border-dashed border-[var(--border)]">
                    <div className="w-12 h-12 mx-auto rounded-full bg-[var(--surface-3)] flex items-center justify-center text-xl">
                      📊
                    </div>
                    <div className="space-y-1">
                      <strong className="text-sm block text-[var(--text)]">
                        No medication sales recorded for {analyticsPeriod === 'day' ? 'today' : `this ${analyticsPeriod}`}.
                      </strong>
                      <p className="text-xs text-[var(--text-dim)] max-w-md mx-auto">
                        Sales analytics calculate from prescriptions fulfilled in the dispensary. You can switch to other timeframes or view all-time history.
                      </p>
                    </div>
                    {analyticsPeriod !== 'all' && (
                      <div className="pt-2">
                        <button
                          type="button"
                          onClick={() => {
                            setAnalyticsPeriod('all');
                            fetchAnalytics('all');
                          }}
                          className="btn-brass px-4 py-2 rounded text-xs font-mono font-semibold inline-flex items-center gap-2 shadow-xs"
                        >
                          <Calendar className="w-3.5 h-3.5" />
                          <span>View All-Time Sales (All)</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </Panel>
            </div>
          )}
        </div>
      )}

      {/* ================= DISPENSE MODAL ================= */}
      {dispenseVisit && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-xl surface-card p-6 border border-[var(--border-light)] shadow-2xl space-y-4 rounded-2xl overflow-hidden">
            <div className="flex justify-between items-center pb-3 border-b border-[var(--border)]">
              <div>
                <h3 className="font-display font-bold text-base text-[var(--text)]">
                  Fulfill Prescription — {(dispenseVisit.patientId as Patient)?.name}
                </h3>
                <span className="font-mono text-xs text-[var(--text-dim)]">
                  ID: {(dispenseVisit.patientId as Patient)?.patientId}
                </span>
              </div>
              <button
                onClick={() => setDispenseVisit(null)}
                className="text-[var(--text-dim)] hover:text-[var(--text)] font-mono text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            {(() => {
              const grandTotal = dispenseVisit.prescriptions.reduce((acc, p) => {
                const medInfo = catalogue.find(
                  (m) =>
                    (p.medicineId && m._id === p.medicineId) ||
                    m.name.toLowerCase() === p.medicineName.toLowerCase()
                );
                return acc + (p.quantity || 1) * (medInfo?.sellingPrice || 0);
              }, 0);
              const dispensedCount = dispenseVisit.prescriptions.filter((pr) => pr.isDispensed).length;

              return (
                <>
                  <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
                    {dispenseVisit.prescriptions.map((p, idx) => {
                      const medInfo = catalogue.find(
                        (m) =>
                          (p.medicineId && m._id === p.medicineId) ||
                          m.name.toLowerCase() === p.medicineName.toLowerCase()
                      );
                      const unitPrice = medInfo?.sellingPrice || 0;
                      const itemTotal = (p.quantity || 1) * unitPrice;

                      return (
                        <div
                          key={p._id || idx}
                          className="p-3 bg-[var(--surface-2)] border border-[var(--border)] rounded-xl flex flex-wrap sm:flex-nowrap justify-between items-center gap-3"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {medInfo?.imageUrl ? (
                              <img
                                src={getMediaUrl(medInfo.imageUrl)}
                                alt={p.medicineName}
                                className="w-12 h-12 object-cover rounded-lg border border-[var(--border)] shrink-0 bg-white shadow-xs"
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-lg bg-[var(--surface-3)] border border-[var(--border)] flex items-center justify-center shrink-0 text-xl shadow-xs">
                                💊
                              </div>
                            )}
                            <div className="min-w-0">
                              <strong className="text-sm block text-[var(--text)] truncate">{p.medicineName}</strong>
                              <span className="font-mono text-xs text-[var(--text-dim)] block truncate">
                                {p.dosage} • {p.frequency} • {p.duration}
                              </span>
                              <div className="flex flex-wrap items-center gap-2 mt-1 font-mono text-xs">
                                <span className="text-[var(--brass)] font-semibold">
                                  Qty: {p.quantity} units
                                </span>
                                <span className="text-[var(--text-dim)]">•</span>
                                <span className="text-[var(--text-dim)]">
                                  Price: <span className="text-[var(--text)] font-semibold">₹{unitPrice}</span>/unit
                                </span>
                                <span className="text-[var(--text-dim)]">•</span>
                                <span className="font-bold text-[var(--brass)] bg-[var(--surface-3)] px-2 py-0.5 rounded border border-[var(--border)]">
                                  Total: ₹{itemTotal.toLocaleString()}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="shrink-0 flex items-center gap-2 self-end sm:self-center ml-auto">
                            {p.isDispensed ? (
                              <Badge variant="success" size="md">
                                ✓ Dispensed
                              </Badge>
                            ) : (
                              <button
                                onClick={() => handleDispenseItem(dispenseVisit._id, p._id!)}
                                className="btn-brass px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold shrink-0 shadow-xs cursor-pointer"
                              >
                                Dispense
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Summary Footer with Total Amount */}
                  <div className="pt-3 border-t border-[var(--border)] bg-[var(--surface-2)] -mx-6 -mb-6 p-4 sm:p-5 rounded-b-2xl mt-4 space-y-3.5">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-mono text-[var(--text-dim)] block font-semibold">
                          TOTAL PRESCRIPTION CHARGES
                        </span>
                        <span className="text-[11px] font-mono text-[var(--text-dim)]">
                          {dispenseVisit.prescriptions.length} medicine{dispenseVisit.prescriptions.length !== 1 ? 's' : ''} • {dispensedCount} dispensed
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="font-mono text-2xl font-bold text-[var(--brass)] block">
                          ₹{grandTotal.toLocaleString()}
                        </span>
                        <span className="text-[10px] font-mono text-[var(--text-dim)]">
                          Net Total Amount
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[var(--border)]/60">
                      <div className="flex items-center gap-2">
                        {paymentSettings.dynamicQrEnabled && (
                          <button
                            type="button"
                            onClick={() => handleOpenDynamicQR(dispenseVisit)}
                            className="px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 bg-violet-600 hover:bg-violet-500 text-white shadow-xs transition-all cursor-pointer"
                            title="Generate Dynamic UPI QR with exact amount"
                          >
                            <Zap className="w-3.5 h-3.5" />
                            <span>Pay ₹{grandTotal} Dyn QR</span>
                          </button>
                        )}
                        {paymentSettings.staticQrEnabled && (
                          <button
                            type="button"
                            onClick={() => setIsCounterStaticQrOpen(true)}
                            className="px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white shadow-xs transition-all cursor-pointer"
                            title="Open Counter Static QR Code"
                          >
                            <QrCode className="w-3.5 h-3.5" />
                            <span>Counter Static QR</span>
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {dispenseVisit.prescriptions.some((pr) => !pr.isDispensed) && (
                          <button
                            type="button"
                            onClick={() => handleDispenseAll(dispenseVisit._id)}
                            disabled={dispensingAll}
                            className="btn-brass px-4 py-2 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 shadow-md cursor-pointer disabled:opacity-50"
                          >
                            {dispensingAll ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                <span>Dispensing All...</span>
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Dispense All Items ({dispenseVisit.prescriptions.filter((pr) => !pr.isDispensed).length})</span>
                              </>
                            )}
                          </button>
                        )}

                        <button
                          onClick={() => {
                            setDispenseVisit(null);
                            fetchPharmacyData();
                          }}
                          className="btn-surface px-4 py-2 rounded-lg text-xs font-mono font-semibold cursor-pointer"
                        >
                          Close Fulfiller
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* ================= BOOKLET FULFILLMENT & MINI INVENTORY CATALOGUE MODAL ================= */}
      {bookletVisit && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-5">
          <div className="w-full max-w-6xl surface-card border border-[var(--border-light)] shadow-2xl rounded-2xl flex flex-col max-h-[92vh] overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-[var(--border)] bg-[var(--surface-2)] flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-xl shrink-0">
                  📖
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-display font-bold text-base text-[var(--text)]">
                      Prescription Booklet Fulfillment &amp; Sale — {(bookletVisit.patientId as Patient)?.name}
                    </h3>
                    <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-amber-500/15 text-amber-500 border border-amber-500/30">
                      Booklet Workflow
                    </span>
                  </div>
                  <span className="font-mono text-xs text-[var(--text-dim)] block mt-0.5">
                    Patient ID: {(bookletVisit.patientId as Patient)?.patientId} • Phone: +91 {(bookletVisit.patientId as Patient)?.phone} • Consulting Doctor: {(bookletVisit.doctorId as User)?.fullName || 'Doctor'}
                  </span>
                </div>
              </div>
              <button
                onClick={() => {
                  setBookletVisit(null);
                  setSelectedBookletItems([]);
                }}
                className="w-8 h-8 rounded-lg hover:bg-[var(--surface-3)] text-[var(--text-dim)] hover:text-[var(--text)] flex items-center justify-center transition-colors cursor-pointer text-sm"
              >
                ✕
              </button>
            </div>

            {/* Modal Main Content (2-Column Grid) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 p-5 overflow-y-auto flex-1 bg-[var(--surface)]">
              {/* Left Column: Mini Complete Inventory Catalogue (7 cols) */}
              <div className="lg:col-span-7 flex flex-col space-y-4 border-b lg:border-b-0 lg:border-r border-[var(--border)] lg:pr-5 pb-5 lg:pb-0">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-display font-bold text-sm text-[var(--text)] flex items-center gap-2">
                        <span>Complete Inventory Catalogue</span>
                        <Badge variant="brass">{catalogue.length} in formulary</Badge>
                      </h4>
                      <p className="text-xs text-[var(--text-dim)]">
                        Search and filter clinic medications to select items prescribed in the patient's booklet.
                      </p>
                    </div>
                  </div>

                  {/* Search Input */}
                  <div className="relative">
                    <Search className="w-4 h-4 text-[var(--text-dim)] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search medication name, brand, or generic composition..."
                      value={bookletSearch}
                      onChange={(e) => setBookletSearch(e.target.value)}
                      className="w-full pl-9 pr-8 py-2 text-xs bg-[var(--surface-2)] border border-[var(--border)] rounded-lg text-[var(--text)] focus:outline-none focus:border-[var(--brass)] font-mono"
                    />
                    {bookletSearch && (
                      <button
                        type="button"
                        onClick={() => setBookletSearch('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[var(--text-dim)] hover:text-[var(--text)] cursor-pointer"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* Category Pills */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
                    {['All', 'Tablet', 'Capsule', 'Serum', 'Shampoo', 'Solution', 'Ointment', 'Oil'].map((cat) => {
                      const count =
                        cat === 'All'
                          ? catalogue.length
                          : catalogue.filter((m) => m.category?.toLowerCase() === cat.toLowerCase()).length;
                      const isSelected = bookletCategory === cat;
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setBookletCategory(cat)}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-mono font-medium transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                            isSelected
                              ? 'bg-[var(--brass)] text-black font-bold shadow-xs'
                              : 'bg-[var(--surface-2)] text-[var(--text-dim)] hover:text-[var(--text)] border border-[var(--border)]'
                          }`}
                        >
                          {cat} <span className="opacity-70 text-[10px]">({count})</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Filtered Inventory Items List */}
                <div className="flex-1 overflow-y-auto space-y-2.5 max-h-[460px] pr-1">
                  {(() => {
                    const filtered = catalogue.filter((m) => {
                      const matchesCategory =
                        bookletCategory === 'All' ||
                        m.category?.toLowerCase() === bookletCategory.toLowerCase();
                      const searchTrim = bookletSearch.trim().toLowerCase();
                      const matchesSearch =
                        !searchTrim ||
                        m.name.toLowerCase().includes(searchTrim) ||
                        (m.genericName && m.genericName.toLowerCase().includes(searchTrim));
                      return matchesCategory && matchesSearch;
                    });

                    if (filtered.length === 0) {
                      return (
                        <div className="py-12 text-center text-xs text-[var(--text-dim)] border border-dashed border-[var(--border)] rounded-xl bg-[var(--surface-2)]/30">
                          <p>No medications match your search criteria.</p>
                        </div>
                      );
                    }

                    return filtered.map((m) => {
                      const isAdded = selectedBookletItems.some((item) => item.medicine._id === m._id);
                      const selectedItem = selectedBookletItems.find((item) => item.medicine._id === m._id);
                      const isOutOfStock = m.totalStock <= 0;
                      const nearestBatch = getNearestExpiry(m.batches);

                      return (
                        <div
                          key={m._id}
                          className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                            isAdded
                              ? 'border-amber-500/50 bg-amber-500/5 shadow-xs'
                              : 'border-[var(--border)] bg-[var(--surface-2)] hover:border-[var(--border-light)]'
                          }`}
                        >
                          {/* Medicine Info */}
                          <div className="flex items-center gap-3 min-w-0">
                            {m.imageUrl ? (
                              <img
                                src={getMediaUrl(m.imageUrl)}
                                alt={m.name}
                                className="w-12 h-12 object-cover rounded-lg border border-[var(--border)] shrink-0 bg-white shadow-xs"
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-lg bg-[var(--surface-3)] border border-[var(--border)] flex items-center justify-center shrink-0 text-xl shadow-xs">
                                {m.category === 'Serum'
                                  ? '💧'
                                  : m.category === 'Shampoo'
                                  ? '🧴'
                                  : m.category === 'Solution'
                                  ? '🧪'
                                  : m.category === 'Ointment'
                                  ? '🩹'
                                  : m.category === 'Oil'
                                  ? '✨'
                                  : '💊'}
                              </div>
                            )}

                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <strong className="text-sm text-[var(--text)] truncate">{m.name}</strong>
                                <Badge variant="brass" size="sm">
                                  {m.category}
                                </Badge>
                              </div>
                              <span className="text-xs text-[var(--text-dim)] block truncate">
                                {m.genericName || '-'}
                              </span>

                              <div className="flex items-center gap-3 mt-1 flex-wrap text-[11px] font-mono">
                                <span
                                  className={`font-semibold ${
                                    isOutOfStock
                                      ? 'text-red-500'
                                      : m.totalStock <= m.reorderLevel
                                      ? 'text-amber-500'
                                      : 'text-emerald-500'
                                  }`}
                                >
                                  Stock: {m.totalStock} {m.unit}
                                </span>
                                <span className="text-[var(--text)] font-semibold">₹{m.sellingPrice}</span>
                                {nearestBatch && <ExpiryBadge dateStr={nearestBatch.expiryDate} />}
                              </div>
                            </div>
                          </div>

                          {/* Action Button */}
                          <div className="shrink-0">
                            {isOutOfStock ? (
                              <span className="px-2.5 py-1 text-[11px] font-mono rounded bg-red-500/10 text-red-400 border border-red-500/20">
                                Out of Stock
                              </span>
                            ) : isAdded ? (
                              <div className="flex items-center gap-1 bg-[var(--surface-1)] border border-amber-500/40 rounded-lg p-0.5">
                                <button
                                  type="button"
                                  onClick={() => handleUpdateBookletItemQty(m._id, -1)}
                                  className="w-6 h-6 rounded flex items-center justify-center text-xs hover:bg-[var(--surface-3)] text-[var(--text)] cursor-pointer"
                                >
                                  <Minus className="w-3 h-3" />
                                </button>
                                <span className="w-6 text-center font-mono text-xs font-bold text-amber-500">
                                  {selectedItem?.quantity}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateBookletItemQty(m._id, 1)}
                                  className="w-6 h-6 rounded flex items-center justify-center text-xs hover:bg-[var(--surface-3)] text-[var(--text)] cursor-pointer"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleAddMedicineToBooklet(m)}
                                className="px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1 bg-[var(--surface-3)] hover:bg-[var(--brass)] hover:text-black border border-[var(--border)] transition-all cursor-pointer shadow-xs"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Add</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>

              {/* Right Column: Selected Items to Dispense & Sale Summary (5 cols) */}
              <div className="lg:col-span-5 flex flex-col space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="w-4 h-4 text-amber-500" />
                    <h4 className="font-display font-bold text-sm text-[var(--text)]">
                      Prescription Order Items
                    </h4>
                  </div>
                  <Badge variant="brass">{selectedBookletItems.length} selected</Badge>
                </div>

                {/* Selected Items List */}
                <div className="flex-1 overflow-y-auto space-y-3 max-h-[380px] pr-1">
                  {selectedBookletItems.length === 0 ? (
                    <div className="py-14 text-center space-y-3 border border-dashed border-[var(--border)] rounded-xl bg-[var(--surface-2)]/30 p-4">
                      <div className="w-12 h-12 rounded-full bg-[var(--surface-3)] text-xl flex items-center justify-center mx-auto">
                        📋
                      </div>
                      <div className="space-y-1">
                        <strong className="text-xs font-semibold text-[var(--text)] block">
                          No medicines selected yet
                        </strong>
                        <p className="text-[11px] text-[var(--text-dim)] max-w-xs mx-auto leading-relaxed">
                          Consult the physical patient prescription booklet and click <strong>+ Add</strong> on the left catalogue to select medications.
                        </p>
                      </div>
                    </div>
                  ) : (
                    selectedBookletItems.map((item, idx) => (
                      <div
                        key={item.medicine._id || idx}
                        className="p-3 bg-[var(--surface-2)] border border-[var(--border)] rounded-xl space-y-2.5 shadow-xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <strong className="text-xs text-[var(--text)] block truncate">
                              {item.medicine.name}
                            </strong>
                            <span className="font-mono text-[11px] text-[var(--text-dim)]">
                              ₹{item.medicine.sellingPrice} / unit
                            </span>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-mono text-xs font-bold text-emerald-500">
                              ₹{(item.quantity * item.medicine.sellingPrice).toLocaleString()}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveBookletItem(item.medicine._id)}
                              className="p-1 rounded text-[var(--text-dim)] hover:text-red-400 hover:bg-[var(--surface-3)] transition-colors cursor-pointer"
                              title="Remove item"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Quantity & Dosage Controls */}
                        <div className="grid grid-cols-3 gap-2 text-xs font-mono pt-1 border-t border-[var(--border)]/60">
                          {/* Quantity Counter */}
                          <div>
                            <span className="text-[10px] text-[var(--text-dim)] block mb-0.5">Qty (Units):</span>
                            <div className="flex items-center border border-[var(--border)] rounded bg-[var(--surface-1)]">
                              <button
                                type="button"
                                onClick={() => handleUpdateBookletItemQty(item.medicine._id, -1)}
                                className="px-2 py-1 text-xs hover:bg-[var(--surface-3)] cursor-pointer"
                              >
                                -
                              </button>
                              <span className="flex-1 text-center font-bold text-[var(--text)]">
                                {item.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleUpdateBookletItemQty(item.medicine._id, 1)}
                                className="px-2 py-1 text-xs hover:bg-[var(--surface-3)] cursor-pointer"
                              >
                                +
                              </button>
                            </div>
                          </div>

                          {/* Dosage */}
                          <div>
                            <span className="text-[10px] text-[var(--text-dim)] block mb-0.5">Dosage:</span>
                            <input
                              type="text"
                              value={item.dosage}
                              onChange={(e) =>
                                handleUpdateBookletItemField(item.medicine._id, 'dosage', e.target.value)
                              }
                              className="w-full px-2 py-1 bg-[var(--surface-1)] border border-[var(--border)] rounded text-xs text-[var(--text)]"
                            />
                          </div>

                          {/* Frequency */}
                          <div>
                            <span className="text-[10px] text-[var(--text-dim)] block mb-0.5">Frequency:</span>
                            <input
                              type="text"
                              value={item.frequency}
                              onChange={(e) =>
                                handleUpdateBookletItemField(item.medicine._id, 'frequency', e.target.value)
                              }
                              className="w-full px-2 py-1 bg-[var(--surface-1)] border border-[var(--border)] rounded text-xs text-[var(--text)]"
                            />
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Order Summary & Dispense Action */}
                <div className="pt-3 border-t border-[var(--border)] space-y-3 bg-[var(--surface-2)] p-3.5 rounded-xl">
                  <div className="space-y-1.5 text-xs font-mono">
                    <div className="flex justify-between text-[var(--text-dim)]">
                      <span>Total Medications:</span>
                      <strong className="text-[var(--text)]">{selectedBookletItems.length} items</strong>
                    </div>
                    <div className="flex justify-between text-[var(--text-dim)]">
                      <span>Total Units to Dispense:</span>
                      <strong className="text-[var(--text)]">
                        {selectedBookletItems.reduce((acc, i) => acc + i.quantity, 0)} units
                      </strong>
                    </div>
                    <div className="flex justify-between text-sm font-bold pt-1 border-t border-[var(--border)]">
                      <span className="text-[var(--text)]">Estimated Total Bill:</span>
                      <span className="text-emerald-500 font-mono">
                        ₹
                        {selectedBookletItems
                          .reduce((acc, i) => acc + i.quantity * (i.medicine.sellingPrice || 0), 0)
                          .toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setBookletVisit(null);
                        setSelectedBookletItems([]);
                      }}
                      className="btn-surface px-3 py-2 rounded-lg text-xs font-mono flex-1 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={selectedBookletItems.length === 0 || isSubmittingBooklet}
                      onClick={handleFulfillBookletOrder}
                      className="btn-brass px-4 py-2 rounded-lg text-xs font-mono font-bold flex-2 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed bg-amber-500 hover:bg-amber-400 text-slate-950 border-amber-500 shadow-md"
                    >
                      {isSubmittingBooklet ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Dispensing &amp; Deducting Stock...</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4" />
                          <span>Fulfill &amp; Dispense Order</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= PAYMENTS TAB ================= */}
      {activeTab === 'payments' && (
        <PaymentHistory
          records={paymentRecords}
          stats={paymentStats}
          loading={paymentLoading}
          statsPeriod={paymentStatsPeriod}
          onPeriodChange={(p) => { setPaymentStatsPeriod(p); fetchPaymentData(p, paymentModeFilter, paymentStatusFilter); }}
          modeFilter={paymentModeFilter}
          statusFilter={paymentStatusFilter}
          onModeFilter={(m) => { setPaymentModeFilter(m); fetchPaymentData(paymentStatsPeriod, m, paymentStatusFilter); }}
          onStatusFilter={(s) => { setPaymentStatusFilter(s); fetchPaymentData(paymentStatsPeriod, paymentModeFilter, s); }}
          onRefresh={() => fetchPaymentData(paymentStatsPeriod, paymentModeFilter, paymentStatusFilter)}
          staticEnabled={paymentSettings.staticQrEnabled}
          dynamicEnabled={paymentSettings.dynamicQrEnabled}
        />
      )}

      {/* ================= CLINIC PHARMACY COUNTER STATIC QR MODAL ================= */}
      <CounterQRModal
        isOpen={isCounterStaticQrOpen}
        onClose={() => setIsCounterStaticQrOpen(false)}
        vpa={paymentSettings.staticQrVpa}
        displayName={paymentSettings.staticQrDisplayName || 'DermaTrack Clinic Pharmacy'}
        clinicName="DermaTrack Clinic"
        counterTitle="PHARMACY & MEDICATION DISPENSARY"
      />

      {/* ================= STATIC QR MODAL ================= */}
      <StaticQRModal
        isOpen={!!staticQRVisit}
        onClose={() => setStaticQRVisit(null)}
        onConfirm={handleConfirmStaticQR}
        amount={staticQRAmount}
        patientName={(staticQRVisit?.patientId as Patient)?.name || 'Patient'}
        vpa={paymentSettings.staticQrVpa}
        displayName={paymentSettings.staticQrDisplayName}
        isSubmitting={isConfirmingStatic}
      />

      {/* ================= DYNAMIC QR MODAL ================= */}
      <DynamicQRModal
        isOpen={!!dynamicQRVisit && !!dynamicOrderData}
        onClose={() => { setDynamicQRVisit(null); setDynamicOrderData(null); }}
        onSuccess={() => { fetchPaymentData(paymentStatsPeriod); toast.success('Payment confirmed via Razorpay!'); }}
        orderData={dynamicOrderData}
        patientName={(dynamicQRVisit?.patientId as Patient)?.name || 'Patient'}
      />
    </AppShell>
  );
}
