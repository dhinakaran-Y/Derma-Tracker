'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { AppShell } from '../../components/AppShell';
import { KpiCard } from '../../components/KpiCard';
import { Panel } from '../../components/Panel';
import { Badge } from '../../components/Badge';
import { DataTable, Column } from '../../components/DataTable';
import { api, getMediaUrl } from '../../lib/api';
import { Medicine, Batch } from '../../types';
import { toast } from 'sonner';
import {
  Package,
  Layers,
  AlertTriangle,
  FileText,
  Plus,
  Trash2,
  TrendingDown,
  Calendar,
  Upload,
  X,
  Image as ImageIcon,
  LayoutList,
  LayoutGrid,
  Search,
  Filter,
  ArrowUpDown,
  History,
  Pill,
  Users,
  TrendingUp,
  FileCheck,
  BarChart3,
  RefreshCw,
} from 'lucide-react';

import { ExpiryBadge, formatExpiryTimeRemaining } from '../../lib/formatExpiry';

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

// Helper: get the nearest expiry batch from a medicine
function getNearestExpiry(batches: Batch[]): Batch | null {
  if (!batches || batches.length === 0) return null;
  return batches.reduce((nearest, b) =>
    new Date(b.expiryDate) < new Date(nearest.expiryDate) ? b : nearest
  );
}

export default function StockManagerPage() {
  const [activeTab, setActiveTab] = useState('catalogue');
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [reorderAlerts, setReorderAlerts] = useState<any[]>([]);
  const [stockOverview, setStockOverview] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Dispense Log & Sales Analytics State
  const [dispenseLogs, setDispenseLogs] = useState<any[]>([]);
  const [logView, setLogView] = useState<'history' | 'analytics'>('history');
  const [analyticsPeriod, setAnalyticsPeriod] = useState<'day' | 'week' | 'month' | 'year' | 'all'>('day');
  const [analyticsData, setAnalyticsData] = useState<SalesAnalyticsData | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [logsLoading, setLogsLoading] = useState(false);

  // Catalogue View & Filter States
  const [catalogueView, setCatalogueView] = useState<'table' | 'grid'>('table');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState<string>('default');

  const filteredMedicines = useMemo(() => {
    const list = medicines.filter((m) => {
      if (categoryFilter !== 'ALL' && m.category !== categoryFilter) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        m.name?.toLowerCase().includes(q) ||
        m.genericName?.toLowerCase().includes(q) ||
        m.category?.toLowerCase().includes(q) ||
        m.manufacturer?.toLowerCase().includes(q) ||
        m.description?.toLowerCase().includes(q)
      );
    });

    return [...list].sort((a, b) => {
      switch (sortBy) {
        case 'price_desc':
          return (b.sellingPrice ?? 0) - (a.sellingPrice ?? 0);
        case 'price_asc':
          return (a.sellingPrice ?? 0) - (b.sellingPrice ?? 0);

        case 'expiry_asc': {
          // Short to long: soonest expiring first
          const expA = getNearestExpiry(a.batches);
          const expB = getNearestExpiry(b.batches);
          const timeA = expA?.expiryDate ? new Date(expA.expiryDate).getTime() : null;
          const timeB = expB?.expiryDate ? new Date(expB.expiryDate).getTime() : null;
          if (!timeA && !timeB) return 0;
          if (!timeA) return 1;
          if (!timeB) return -1;
          return timeA - timeB;
        }

        case 'expiry_desc': {
          // Long to short: farthest expiring first
          const expA = getNearestExpiry(a.batches);
          const expB = getNearestExpiry(b.batches);
          const timeA = expA?.expiryDate ? new Date(expA.expiryDate).getTime() : null;
          const timeB = expB?.expiryDate ? new Date(expB.expiryDate).getTime() : null;
          if (!timeA && !timeB) return 0;
          if (!timeA) return 1;
          if (!timeB) return -1;
          return timeB - timeA;
        }

        case 'stock_desc':
          return (b.totalStock ?? 0) - (a.totalStock ?? 0);
        case 'stock_asc':
          return (a.totalStock ?? 0) - (b.totalStock ?? 0);

        case 'default':
        default:
          return (a.name || '').localeCompare(b.name || '');
      }
    });
  }, [medicines, categoryFilter, searchQuery, sortBy]);

  // New Medicine Modal State
  const [showAddMedModal, setShowAddMedModal] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [newMed, setNewMed] = useState({
    name: '',
    genericName: '',
    category: 'Serum' as any,
    manufacturer: '',
    sellingPrice: 0,
    costPrice: 0,
    reorderLevel: 10,
    unit: 'pcs',
    imageUrl: '',
  });

  // Add Batch Modal State
  const [activeMedForBatch, setActiveMedForBatch] = useState<Medicine | null>(null);
  const [newBatch, setNewBatch] = useState({
    batchNumber: '',
    quantity: 50,
    expiryDate: '',
    purchasePrice: 0,
  });

  const fetchStockData = useCallback(async () => {
    try {
      setLoading(true);
      const [mRes, rRes, oRes] = await Promise.all([
        api.get('/stock/medicines'),
        api.get('/stock/reorder-alerts'),
        api.get('/stock/reports/overview'),
      ]);
      setMedicines(mRes.data.data || []);
      setReorderAlerts(rRes.data.data || []);
      setStockOverview(oRes.data.data || null);
    } catch {
      toast.error('Failed to load stock data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStockData();
  }, [fetchStockData]);

  const fetchDispenseLogs = useCallback(async () => {
    try {
      setLogsLoading(true);
      const res = await api.get('/pharmacy/dispense-log?limit=100');
      setDispenseLogs(res.data.data || []);
    } catch {
      toast.error('Failed to load dispense logs');
    } finally {
      setLogsLoading(false);
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
    if (activeTab === 'dispense-log') {
      if (logView === 'history') {
        fetchDispenseLogs();
      } else {
        fetchAnalytics(analyticsPeriod);
      }
    }
  }, [activeTab, logView, analyticsPeriod, fetchDispenseLogs, fetchAnalytics]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image must be smaller than 5 MB');
        return;
      }
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCreateMedicine = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setUploadingImage(true);
      let finalImageUrl = newMed.imageUrl || '';

      if (imageFile) {
        const formData = new FormData();
        formData.append('image', imageFile);
        const uploadRes = await api.post('/stock/upload-image', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        if (uploadRes.data?.data?.imageUrl) {
          finalImageUrl = uploadRes.data.data.imageUrl;
        }
      }

      await api.post('/stock/medicines', {
        ...newMed,
        imageUrl: finalImageUrl || undefined,
      });

      toast.success(`Medicine ${newMed.name} added to inventory`);
      setShowAddMedModal(false);
      setImageFile(null);
      setImagePreview(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setNewMed({
        name: '',
        genericName: '',
        category: 'Serum',
        manufacturer: '',
        sellingPrice: 0,
        costPrice: 0,
        reorderLevel: 10,
        unit: 'pcs',
        imageUrl: '',
      });
      fetchStockData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to add medicine');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleAddBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeMedForBatch) return;
    try {
      await api.post(`/stock/medicines/${activeMedForBatch._id}/batches`, newBatch);
      toast.success(`Batch ${newBatch.batchNumber} added`);
      setActiveMedForBatch(null);
      setNewBatch({ batchNumber: '', quantity: 50, expiryDate: '', purchasePrice: 0 });
      fetchStockData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to add batch');
    }
  };

  const handleDeleteBatch = async (medId: string, batchId: string) => {
    if (!confirm('Are you sure you want to remove this batch?')) return;
    try {
      await api.delete(`/stock/medicines/${medId}/batches/${batchId}`);
      toast.success('Batch removed');
      fetchStockData();
    } catch (err: any) {
      toast.error('Failed to delete batch');
    }
  };

  const navGroups = [
    {
      title: 'Inventory Control',
      items: [
        { id: 'catalogue', label: 'Stock Catalogue', icon: Package, badge: medicines.length },
        { id: 'batches', label: 'Batch & Expiry Records', icon: Layers },
        { id: 'alerts', label: 'Reorder Alerts', icon: AlertTriangle, badge: reorderAlerts.length },
        { id: 'dispense-log', label: 'Dispense Log', icon: History },
      ],
    },
  ];

  const catalogueColumns: Column<Medicine>[] = [
    {
      header: 'ITEM NAME',
      headerClassName: 'text-left min-w-[260px]',
      className: 'min-w-[260px]',
      accessor: (m) => (
        <div className="flex items-center gap-3 py-1">
          {m.imageUrl ? (
            <img
              src={getMediaUrl(m.imageUrl)}
              alt={m.name}
              className="w-11 h-11 object-cover rounded-lg border border-[var(--border)] shrink-0 bg-white shadow-xs"
            />
          ) : (
            <div
              className="w-11 h-11 rounded-lg bg-[var(--surface-3)] border border-[var(--border)] flex items-center justify-center shrink-0 text-xl shadow-xs"
              title={m.category}
            >
              {m.category === 'Serum' ? '💧' : m.category === 'Shampoo' ? '🧴' : m.category === 'Solution' ? '🧪' : m.category === 'Ointment' ? '🩹' : m.category === 'Oil' ? '✨' : '💊'}
            </div>
          )}
          <div className="min-w-0 pr-2">
            <strong className="text-sm font-semibold block truncate leading-snug text-[var(--text)]">{m.name}</strong>
            <span className="font-mono text-xs text-[var(--text-dim)] block truncate mt-0.5">{m.genericName || '-'}</span>
            {m.description && (
              <span className="text-[11px] text-[var(--text-muted)] block truncate max-w-[280px] mt-0.5" title={m.description}>
                {m.description}
              </span>
            )}
          </div>
        </div>
      ),
    },
    {
      header: 'CATEGORY',
      headerClassName: 'text-left w-[110px] min-w-[110px]',
      className: 'w-[110px] min-w-[110px] whitespace-nowrap',
      accessor: (m) => (
        <Badge variant="brass" size="sm" className="font-medium text-[11px] tracking-wide">
          {m.category}
        </Badge>
      ),
    },
    {
      header: 'STOCK / REORDER',
      headerClassName: 'text-left w-[150px] min-w-[150px]',
      className: 'w-[150px] min-w-[150px] whitespace-nowrap',
      accessor: (m) => {
        const isLow = m.totalStock <= m.reorderLevel;
        return (
          <div className="space-y-1">
            <div className="flex items-baseline gap-1.5 whitespace-nowrap">
              <span
                className={`font-mono text-sm font-bold ${
                  isLow ? 'text-[var(--error)]' : 'text-[var(--text)]'
                }`}
              >
                {m.totalStock}
              </span>
              <span className="text-xs text-[var(--text-dim)] font-normal truncate max-w-[95px]" title={m.unit}>
                {m.unit}
              </span>
            </div>
            <div className="text-[11px] font-mono text-[var(--text-dim)] flex items-center gap-1.5">
              <span>Min:</span>
              <span className="text-[var(--text-muted)] font-semibold">{m.reorderLevel}</span>
              {isLow && (
                <span className="text-[10px] font-bold text-[var(--error)] bg-red-500/10 px-1 py-0.2 rounded border border-red-500/20 leading-none">
                  LOW
                </span>
              )}
            </div>
          </div>
        );
      },
    },
    {
      header: 'NEAREST EXPIRY',
      headerClassName: 'text-left w-[200px] min-w-[200px]',
      className: 'w-[200px] min-w-[200px] whitespace-nowrap',
      accessor: (m) => {
        const nearest = getNearestExpiry(m.batches);
        if (!nearest) return <span className="font-mono text-xs text-[var(--text-dim)]">—</span>;
        const expiryInfo = formatExpiryTimeRemaining(nearest.expiryDate);
        return (
          <div className="space-y-1">
            <div>
              <ExpiryBadge dateStr={nearest.expiryDate} showDate={false} className="text-xs px-2.5 py-0.5" />
            </div>
            <div className="font-mono text-[11px] text-[var(--text-dim)] flex items-center gap-1.5">
              <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-semibold">Exp:</span>
              <span className="text-[var(--text)] font-medium">{expiryInfo.formattedDate}</span>
            </div>
          </div>
        );
      },
    },
    {
      header: 'PRICE',
      headerClassName: 'text-left w-[115px] min-w-[115px]',
      className: 'w-[115px] min-w-[115px] whitespace-nowrap',
      accessor: (m) => (
        <div className="space-y-0.5">
          <div className="font-mono text-sm font-bold text-[var(--text)]">
            ₹{m.sellingPrice != null ? m.sellingPrice.toLocaleString('en-IN') : '-'}
          </div>
          <div className="font-mono text-[11px] text-[var(--text-dim)]">
            Cost: ₹{m.costPrice != null ? m.costPrice.toLocaleString('en-IN') : '-'}
          </div>
        </div>
      ),
    },
    {
      header: 'ACTIONS',
      headerClassName: 'text-center w-[120px] min-w-[120px]',
      className: 'w-[120px] min-w-[120px] text-center whitespace-nowrap',
      accessor: (m) => (
        <button
          onClick={() => {
            setActiveMedForBatch(m);
            setNewBatch({ ...newBatch, purchasePrice: m.costPrice || 0 });
          }}
          className="btn-brass px-3 py-1.5 rounded-md text-xs font-mono font-medium inline-flex items-center gap-1.5 shadow-xs hover:brightness-110 active:scale-95 transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Batch</span>
        </button>
      ),
    },
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
      pageTitle="Stock & Inventory Control Station"
      topbarActions={
        <button
          onClick={() => setShowAddMedModal(true)}
          className="btn-brass px-3 py-1.5 rounded text-xs font-mono font-medium flex items-center gap-1"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Medicine</span>
        </button>
      }
    >
      <div className="space-y-6">
        {/* KPI Summary Row */}
        {stockOverview && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              label="Total Stock Value"
              value={`₹${(stockOverview.totalValue || 0).toLocaleString()}`}
              delta="At Purchase Cost"
              deltaType="neutral"
              icon={<Package className="w-5 h-5" />}
            />
            <KpiCard
              label="Total Stocked Units"
              value={stockOverview.totalStock || 0}
              subtext={`${stockOverview.totalItems} Active Formulations`}
              icon={<Layers className="w-5 h-5" />}
            />
            <KpiCard
              label="Low Stock Alerts"
              value={stockOverview.lowStockCount || 0}
              delta={stockOverview.lowStockCount > 0 ? 'Below Reorder' : 'Healthy'}
              deltaType={stockOverview.lowStockCount > 0 ? 'negative' : 'positive'}
              icon={<AlertTriangle className="w-5 h-5" />}
            />
            <KpiCard
              label="Near-Expiry Batches"
              value={stockOverview.expiringBatches || 0}
              delta="< 90 Days"
              deltaType="warn"
              icon={<Calendar className="w-5 h-5" />}
            />
          </div>
        )}

        {/* ================= CATALOGUE TAB ================= */}
        {activeTab === 'catalogue' && (
          <Panel
            title="Complete Inventory Catalogue"
            subtitle="Formulation management, unit pricing, and batch-level stock quantities"
            noPadding={catalogueView === 'table'}
            action={
              <div className="flex flex-wrap items-center gap-2.5">
                {/* Search Input */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-dim)]" />
                  <input
                    type="text"
                    placeholder="Search catalogue..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="input-brass pl-8 pr-7 py-1 text-xs w-36 sm:w-48 rounded-md"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-dim)] hover:text-[var(--text)]"
                      title="Clear search"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Category Dropdown Filter */}
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="input-brass px-2.5 py-1 text-xs rounded-md bg-[var(--surface)] text-[var(--text)] border border-[var(--border)]"
                >
                  <option value="ALL">All Categories</option>
                  <option value="Serum">Serum</option>
                  <option value="Shampoo">Shampoo</option>
                  <option value="Tablet">Tablet</option>
                  <option value="Capsule">Capsule</option>
                  <option value="Lotion">Lotion</option>
                  <option value="Oil">Oil</option>
                  <option value="Ointment">Ointment</option>
                  <option value="Solution">Solution</option>
                </select>

                {/* Multi-Sort Dropdown */}
                <div className="relative flex items-center">
                  <ArrowUpDown className="w-3.5 h-3.5 absolute left-2.5 text-[var(--text-dim)] pointer-events-none" />
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="input-brass pl-8 pr-3 py-1 text-xs rounded-md bg-[var(--surface)] text-[var(--text)] border border-[var(--border)] cursor-pointer"
                    title="Sort Catalogue"
                  >
                    <option value="default">Default Sort (A - Z)</option>
                    <optgroup label="PRICE">
                      <option value="price_desc">Price: Max to Min</option>
                      <option value="price_asc">Price: Min to Max</option>
                    </optgroup>
                    <optgroup label="EXPIRY">
                      <option value="expiry_asc">Expiry: Short to Long</option>
                      <option value="expiry_desc">Expiry: Long to Short</option>
                    </optgroup>
                    <optgroup label="STOCK">
                      <option value="stock_desc">Stock: High to Low</option>
                      <option value="stock_asc">Stock: Low to High</option>
                    </optgroup>
                  </select>
                </div>

                {sortBy !== 'default' && (
                  <button
                    type="button"
                    onClick={() => setSortBy('default')}
                    className="text-[11px] font-mono text-[var(--brass)] hover:underline flex items-center gap-1 px-1 py-0.5"
                    title="Reset sorting to default"
                  >
                    <X className="w-3 h-3" /> Reset
                  </button>
                )}

                {/* View Switcher: Table vs Grid Cards */}
                <div className="flex items-center bg-[var(--surface-3)] p-0.5 rounded-lg border border-[var(--border)]">
                  <button
                    type="button"
                    onClick={() => setCatalogueView('table')}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-mono font-medium transition-all ${
                      catalogueView === 'table'
                        ? 'bg-[var(--brass)] text-black shadow-xs font-bold'
                        : 'text-[var(--text-dim)] hover:text-[var(--text)]'
                    }`}
                    title="Current Table View"
                  >
                    <LayoutList className="w-3.5 h-3.5" />
                    <span>Table</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCatalogueView('grid')}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-mono font-medium transition-all ${
                      catalogueView === 'grid'
                        ? 'bg-[var(--brass)] text-black shadow-xs font-bold'
                        : 'text-[var(--text-dim)] hover:text-[var(--text)]'
                    }`}
                    title="Grid Card View"
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    <span>Grid Cards</span>
                  </button>
                </div>
              </div>
            }
          >
            {catalogueView === 'table' ? (
              <DataTable
                columns={catalogueColumns}
                data={filteredMedicines}
                keyExtractor={(m) => m._id}
                emptyMessage={
                  searchQuery || categoryFilter !== 'ALL'
                    ? 'No medicines match your search criteria.'
                    : 'No medicines added to inventory.'
                }
              />
            ) : (
              /* Grid Card View */
              <div className="p-5">
                {filteredMedicines.length === 0 ? (
                  <div className="py-16 text-center text-xs font-mono text-[var(--text-dim)] space-y-2">
                    <Package className="w-8 h-8 mx-auto text-[var(--text-dim)] opacity-50" />
                    <p>No medicines match your search or filter criteria.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                    {filteredMedicines.map((m) => {
                      const nearest = getNearestExpiry(m.batches);
                      const isLowStock = m.totalStock <= m.reorderLevel;
                      const isOutOfStock = m.totalStock <= 0;

                      return (
                        <div
                          key={m._id}
                          className="group relative flex flex-col justify-between rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--brass)]/70 hover:shadow-lg transition-all duration-200 overflow-hidden"
                        >
                          {/* Image or Category Banner */}
                          <div className="relative h-44 w-full bg-gradient-to-b from-[var(--surface-2)] to-[var(--surface-3)]/60 flex items-center justify-center overflow-hidden border-b border-[var(--border)]">
                            {m.imageUrl ? (
                              <img
                                src={getMediaUrl(m.imageUrl)}
                                alt={m.name}
                                className="w-full h-full object-contain p-3 transition-transform duration-300 group-hover:scale-105"
                              />
                            ) : (
                              <div
                                className="text-5xl select-none filter drop-shadow-sm transition-transform duration-300 group-hover:scale-110"
                                title={m.category}
                              >
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

                            {/* Category Pill */}
                            <div className="absolute top-2.5 left-2.5">
                              <Badge variant="brass" size="sm">
                                {m.category}
                              </Badge>
                            </div>

                            {/* Stock Status Pill */}
                            <div className="absolute top-2.5 right-2.5">
                              {isOutOfStock ? (
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-red-500/20 text-red-500 font-bold border border-red-500/30">
                                  Out of Stock
                                </span>
                              ) : isLowStock ? (
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold border border-amber-500/30">
                                  Low Stock
                                </span>
                              ) : (
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-medium border border-emerald-500/25">
                                  {m.totalStock} {m.unit}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Card Content */}
                          <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                            <div>
                              <h4
                                className="font-display font-semibold text-sm text-[var(--text)] line-clamp-1 group-hover:text-[var(--brass)] transition-colors"
                                title={m.name}
                              >
                                {m.name}
                              </h4>
                              <p className="font-mono text-[11px] text-[var(--text-dim)] truncate mt-0.5">
                                {m.genericName || m.manufacturer || '-'}
                              </p>
                              {m.description && (
                                <p
                                  className="text-xs text-[var(--text-dim)] line-clamp-2 mt-2 leading-relaxed"
                                  title={m.description}
                                >
                                  {m.description}
                                </p>
                              )}
                            </div>

                            {/* Metadata Details */}
                            <div className="pt-3 border-t border-[var(--border)]/60 space-y-2.5 text-xs">
                              {/* Nearest Expiry */}
                              <div className="flex items-center justify-between">
                                <span className="text-[var(--text-dim)] text-[11px]">Nearest Expiry:</span>
                                <div>
                                  {nearest ? (
                                    <ExpiryBadge dateStr={nearest.expiryDate} />
                                  ) : (
                                    <span className="font-mono text-xs text-[var(--text-dim)]">No batches</span>
                                  )}
                                </div>
                              </div>

                              {/* Price & Stock Grid */}
                              <div className="flex items-center justify-between pt-1">
                                <div>
                                  <span className="text-[10px] uppercase font-mono text-[var(--text-dim)] block">
                                    Selling Price
                                  </span>
                                  <span className="font-mono font-bold text-sm text-[var(--text)]">
                                    ₹{m.sellingPrice}
                                  </span>
                                  <span className="font-mono text-[10px] text-[var(--text-dim)] block">
                                    Cost: ₹{m.costPrice}
                                  </span>
                                </div>
                                <div className="text-right">
                                  <span className="text-[10px] uppercase font-mono text-[var(--text-dim)] block">
                                    Total Stock
                                  </span>
                                  <span
                                    className={`font-mono font-bold text-sm ${
                                      isLowStock ? 'text-[var(--error)]' : 'text-[var(--success)]'
                                    }`}
                                  >
                                    {m.totalStock} {m.unit}
                                  </span>
                                  <span className="font-mono text-[10px] text-[var(--text-dim)] block">
                                    Min: {m.reorderLevel}
                                  </span>
                                </div>
                              </div>

                              {/* Add Batch Action Button */}
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveMedForBatch(m);
                                  setNewBatch({ ...newBatch, purchasePrice: m.costPrice || 0 });
                                }}
                                className="btn-brass w-full py-1.5 rounded-lg text-xs font-mono font-medium flex items-center justify-center gap-1.5 mt-2 shadow-xs hover:shadow transition-all"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Add Batch</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </Panel>
        )}

        {/* ================= BATCHES TAB ================= */}
        {activeTab === 'batches' && (
          <div className="space-y-6">
            {medicines.map((med) => (
              <Panel
                key={med._id}
                title={
                  <div className="flex items-center gap-3">
                    {med.imageUrl ? (
                      <img
                        src={getMediaUrl(med.imageUrl)}
                        alt={med.name}
                        className="w-7 h-7 object-cover rounded border border-[var(--border)] shrink-0 bg-white"
                      />
                    ) : (
                      <span className="text-sm">💊</span>
                    )}
                    <span>{med.name} ({med.category})</span>
                  </div>
                }
                subtitle={`Total Stock: ${med.totalStock} ${med.unit} • Selling: ₹${med.sellingPrice}`}
                action={
                  <button
                    onClick={() => {
                      setActiveMedForBatch(med);
                      setNewBatch({ ...newBatch, purchasePrice: med.costPrice || 0 });
                    }}
                    className="btn-brass px-2.5 py-1 rounded text-xs font-mono flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Add Batch
                  </button>
                }
              >
                {med.batches && med.batches.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {med.batches.map((b) => {
                      const expInfo = formatExpiryTimeRemaining(b.expiryDate);
                      const isExpired = expInfo.isExpired;
                      const isNearExpiry = !isExpired && expInfo.totalDays <= 90;
                      return (
                        <div
                          key={b._id}
                          className={`p-3 bg-[var(--surface)] border rounded transition-all ${
                            isExpired
                              ? 'border-red-500/50 bg-red-500/5'
                              : isNearExpiry
                              ? 'border-orange-500/40 bg-orange-500/5'
                              : 'border-[var(--border)]'
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <div className="space-y-1 min-w-0 flex-1">
                              <strong className="font-mono text-xs text-[var(--brass)] block">
                                Batch: {b.batchNumber}
                              </strong>
                              <span className="font-mono text-xs text-[var(--text)] block">
                                Qty: {b.quantity} {med.unit}
                              </span>
                              <ExpiryBadge dateStr={b.expiryDate} />
                            </div>
                            <button
                              onClick={() => handleDeleteBatch(med._id, b._id)}
                              className="text-[var(--error)] hover:bg-[var(--surface-2)] p-1 rounded shrink-0 ml-2"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="font-mono text-xs text-[var(--text-dim)] py-2">
                    No active batches registered for this medicine.
                  </p>
                )}
              </Panel>
            ))}
          </div>
        )}

        {/* ================= ALERTS TAB ================= */}
        {activeTab === 'alerts' && (
          <Panel
            title="Reorder Threshold Deficit Alerts"
            subtitle="Items requiring immediate supplier purchase order creation"
          >
            <DataTable
              columns={[
                {
                  header: 'MEDICINE',
                  headerClassName: 'text-left min-w-[240px]',
                  className: 'min-w-[240px]',
                  accessor: (a) => (
                    <div className="flex items-center gap-3 py-1">
                      {a.imageUrl ? (
                        <img
                          src={getMediaUrl(a.imageUrl)}
                          alt={a.name}
                          className="w-10 h-10 object-cover rounded-lg border border-[var(--border)] shrink-0 bg-white"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-[var(--surface-3)] border border-[var(--border)] flex items-center justify-center shrink-0 text-base">
                          💊
                        </div>
                      )}
                      <div>
                        <strong className="text-sm font-semibold block text-[var(--text)]">{a.name}</strong>
                        <span className="font-mono text-xs text-[var(--text-dim)]">{a.genericName || '-'}</span>
                      </div>
                    </div>
                  ),
                },
                {
                  header: 'CATEGORY',
                  headerClassName: 'text-left w-[110px] min-w-[110px]',
                  className: 'w-[110px] min-w-[110px] whitespace-nowrap',
                  accessor: (a) => <Badge variant="brass" size="sm">{a.category}</Badge>,
                },
                {
                  header: 'CURRENT STOCK',
                  headerClassName: 'text-left w-[140px] min-w-[140px]',
                  className: 'w-[140px] min-w-[140px] whitespace-nowrap',
                  accessor: (a) => (
                    <div className="flex items-baseline gap-1.5">
                      <span className="font-mono text-[var(--error)] font-bold text-sm">{a.totalStock}</span>
                      <span className="text-xs text-[var(--text-dim)]">{a.unit}</span>
                    </div>
                  ),
                },
                {
                  header: 'MIN THRESHOLD',
                  headerClassName: 'text-left w-[120px] min-w-[120px]',
                  className: 'w-[120px] min-w-[120px] whitespace-nowrap',
                  accessor: (a) => <span className="font-mono text-xs text-[var(--text-dim)]">Min: {a.reorderLevel}</span>,
                },
                {
                  header: 'REQUIRED DEFICIT',
                  headerClassName: 'text-left w-[140px] min-w-[140px]',
                  className: 'w-[140px] min-w-[140px] whitespace-nowrap',
                  accessor: (a) => (
                    <Badge variant="error">
                      Deficit: {a.deficit} {a.unit}
                    </Badge>
                  ),
                },
              ]}
              data={reorderAlerts}
              keyExtractor={(a) => a._id}
              emptyMessage="All medicine inventories are currently above reorder levels."
            />
          </Panel>
        )}

        {/* ================= DISPENSE LOG TAB ================= */}
        {activeTab === 'dispense-log' && (
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

              {/* If Analytics view is active, show Period Filters (Day / Week / Month / Year / All Time) */}
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
                {logsLoading ? (
                  <div className="py-12 flex flex-col items-center justify-center text-center space-y-2">
                    <RefreshCw className="w-6 h-6 animate-spin text-[var(--brass)]" />
                    <span className="font-mono text-xs text-[var(--text-dim)]">Loading dispensation logs...</span>
                  </div>
                ) : (
                  <DataTable
                    columns={logColumns}
                    data={dispenseLogs}
                    keyExtractor={(l) => l._id}
                    emptyMessage="No dispensation logs recorded."
                  />
                )}
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
      </div>

      {/* ================= ADD MEDICINE MODAL ================= */}
      {showAddMedModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md surface-card p-6 border border-[var(--border-light)] shadow-2xl space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-[var(--border)]">
              <h3 className="font-display font-bold text-base text-[var(--text)]">
                Add Formulation to Inventory
              </h3>
              <button
                onClick={() => setShowAddMedModal(false)}
                className="text-[var(--text-dim)] hover:text-[var(--text)] font-mono text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateMedicine} className="space-y-3">
              {/* Image Input Component */}
              <div>
                <label className="block text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider mb-1.5">
                  Medicine Image / Product Packaging
                </label>
                <div className="flex items-center gap-3">
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="w-16 h-16 rounded-lg border-2 border-dashed border-[var(--border)] hover:border-[var(--brass)] bg-[var(--surface-2)] flex flex-col items-center justify-center cursor-pointer transition-all overflow-hidden relative shrink-0 group"
                  >
                    {imagePreview ? (
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-[var(--text-dim)] group-hover:text-[var(--brass)]">
                        <Upload className="w-5 h-5 mb-0.5" />
                        <span className="font-mono text-[8px] uppercase tracking-wider">Upload</span>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="btn-surface px-2.5 py-1 rounded text-xs font-mono flex items-center gap-1.5"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>{imagePreview ? 'Change Image' : 'Select Image File'}</span>
                      </button>
                      {imagePreview && (
                        <button
                          type="button"
                          onClick={() => {
                            setImageFile(null);
                            setImagePreview(null);
                            if (fileInputRef.current) fileInputRef.current.value = '';
                          }}
                          className="text-[var(--error)] hover:bg-[var(--surface-3)] p-1 rounded text-xs font-mono"
                          title="Remove image"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <p className="font-mono text-[10px] text-[var(--text-dim)]">
                      PNG, JPG, or WebP (max 5MB). Helps doctors & dispensers visually identify items.
                    </p>
                  </div>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleImageChange}
                  className="hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider mb-1">
                  Medicine / Brand Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Minoxil Solution 5%"
                  value={newMed.name}
                  onChange={(e) => setNewMed({ ...newMed, name: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-[var(--surface-2)] border border-[var(--border)] rounded text-[var(--text)] focus:outline-none focus:border-[var(--brass)]"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider mb-1">
                  Generic Formulation
                </label>
                <input
                  type="text"
                  placeholder="e.g. Minoxidil USP 5%"
                  value={newMed.genericName}
                  onChange={(e) => setNewMed({ ...newMed, genericName: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-[var(--surface-2)] border border-[var(--border)] rounded text-[var(--text)] focus:outline-none focus:border-[var(--brass)]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider mb-1">
                    Category *
                  </label>
                  <select
                    value={newMed.category}
                    onChange={(e) => setNewMed({ ...newMed, category: e.target.value as any })}
                    className="w-full px-3 py-2 text-xs bg-[var(--surface-2)] border border-[var(--border)] rounded text-[var(--text)] focus:outline-none focus:border-[var(--brass)]"
                  >
                    {['Serum', 'Tablet', 'Capsule', 'Shampoo', 'Lotion', 'Oil', 'Ointment', 'Solution'].map(
                      (cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider mb-1">
                    Unit Type
                  </label>
                  <input
                    type="text"
                    placeholder="Bottle, Strip, Tube"
                    value={newMed.unit}
                    onChange={(e) => setNewMed({ ...newMed, unit: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-[var(--surface-2)] border border-[var(--border)] rounded text-[var(--text)]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider mb-1">
                    Cost Price (₹)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={newMed.costPrice}
                    onChange={(e) => setNewMed({ ...newMed, costPrice: parseFloat(e.target.value) || 0 })}
                    className="w-full px-2.5 py-1.5 text-xs bg-[var(--surface-2)] border border-[var(--border)] rounded text-[var(--text)] font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider mb-1">
                    Selling Price (₹)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={newMed.sellingPrice}
                    onChange={(e) => setNewMed({ ...newMed, sellingPrice: parseFloat(e.target.value) || 0 })}
                    className="w-full px-2.5 py-1.5 text-xs bg-[var(--surface-2)] border border-[var(--border)] rounded text-[var(--text)] font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider mb-1">
                    Reorder Min
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={newMed.reorderLevel}
                    onChange={(e) => setNewMed({ ...newMed, reorderLevel: parseInt(e.target.value) || 10 })}
                    className="w-full px-2.5 py-1.5 text-xs bg-[var(--surface-2)] border border-[var(--border)] rounded text-[var(--text)] font-mono"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddMedModal(false)}
                  className="flex-1 btn-surface py-2 rounded text-xs font-mono"
                >
                  Cancel
                </button>
                <button type="submit" className="flex-1 btn-brass py-2 rounded text-xs font-mono font-bold">
                  Add Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= ADD BATCH MODAL ================= */}
      {activeMedForBatch && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md surface-card p-6 border border-[var(--border-light)] shadow-2xl space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-[var(--border)]">
              <div>
                <h3 className="font-display font-bold text-base text-[var(--text)]">
                  Add Batch — {activeMedForBatch.name}
                </h3>
                <span className="font-mono text-xs text-[var(--text-dim)]">
                  Category: {activeMedForBatch.category}
                </span>
              </div>
              <button
                onClick={() => setActiveMedForBatch(null)}
                className="text-[var(--text-dim)] hover:text-[var(--text)] font-mono text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddBatch} className="space-y-3">
              <div>
                <label className="block text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider mb-1">
                  Batch Number *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. BT-2026-08"
                  value={newBatch.batchNumber}
                  onChange={(e) => setNewBatch({ ...newBatch, batchNumber: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-[var(--surface-2)] border border-[var(--border)] rounded text-[var(--text)] font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider mb-1">
                    Quantity Received *
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={newBatch.quantity}
                    onChange={(e) => setNewBatch({ ...newBatch, quantity: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 text-sm bg-[var(--surface-2)] border border-[var(--border)] rounded text-[var(--text)] font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider mb-1">
                    Purchase Cost (₹)
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={newBatch.purchasePrice}
                    onChange={(e) => setNewBatch({ ...newBatch, purchasePrice: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 text-sm bg-[var(--surface-2)] border border-[var(--border)] rounded text-[var(--text)] font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider mb-1">
                  Expiry Date *
                </label>
                <input
                  type="date"
                  required
                  value={newBatch.expiryDate}
                  onChange={(e) => setNewBatch({ ...newBatch, expiryDate: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-[var(--surface-2)] border border-[var(--border)] rounded text-[var(--text)] font-mono"
                />
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setActiveMedForBatch(null)}
                  className="flex-1 btn-surface py-2 rounded text-xs font-mono"
                >
                  Cancel
                </button>
                <button type="submit" className="flex-1 btn-brass py-2 rounded text-xs font-mono font-bold">
                  Save Batch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
