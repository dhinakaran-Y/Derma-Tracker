'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AppShell } from '../../components/AppShell';
import { KpiCard } from '../../components/KpiCard';
import { Panel } from '../../components/Panel';
import { Badge } from '../../components/Badge';
import { DataTable, Column } from '../../components/DataTable';
import { api } from '../../lib/api';
import { User, Patient, Appointment, Invoice, ClinicSettings, GstRule } from '../../types';
import { toast } from 'sonner';
import { useAuth } from '../../hooks/useAuth';
import InvoicePDFModal from '../../components/InvoicePDFModal';
import { formatExpiryTimeRemaining } from '../../lib/formatExpiry';
import {
  formatActivitySentence,
  getActorName,
  formatLogTime,
  formatLogDateTime,
} from '../../lib/formatAuditActivity';
import {
  LayoutDashboard,
  Users,
  Calendar,
  Stethoscope,
  Shield,
  CreditCard,
  Percent,
  Settings,
  History,
  Plus,
  Trash2,
  Save,
  CheckCircle,
  AlertOctagon,
  AlertTriangle,
  UserCheck,
  Eye,
  EyeOff,
  IndianRupee,
  TrendingUp,
  Clock,
  FileText,
  X,
  Banknote,
  Smartphone,
  CreditCard as CardIcon,
  Filter,
  Download,
  CalendarDays,
  Edit2,
  Package,
  Search,
  Wifi,
  WifiOff,
  ExternalLink,
} from 'lucide-react';
import Link from 'next/link';

// ── WhatsApp Integration Status Card (used in Settings tab) ───────────────────
function WhatsAppIntegrationCard() {
  const [waStatus, setWaStatus] = React.useState<{ connected: boolean; enabled: boolean; hasQr: boolean } | null>(null);

  React.useEffect(() => {
    const check = () =>
      api.get('/whatsapp/status')
        .then((res) => setWaStatus(res.data?.data ?? null))
        .catch(() => {});
    check();
    const iv = setInterval(check, 5000);
    return () => clearInterval(iv);
  }, []);

  const isConnected = waStatus?.connected ?? false;
  const isEnabled = waStatus?.enabled ?? false;
  const hasQr = waStatus?.hasQr ?? false;

  return (
    <div className={`rounded-xl border p-5 ${
      isConnected ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-[var(--border)] bg-[var(--surface-2)]'
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
            isConnected ? 'bg-emerald-500/20 text-emerald-400' : 'bg-[var(--surface-3)] text-[var(--text-dim)]'
          }`}>
            {isConnected ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-[var(--text)]">WhatsApp OTP</span>
              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full border ${
                isConnected
                  ? 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10'
                  : hasQr
                    ? 'text-amber-400 border-amber-500/40 bg-amber-500/10'
                    : 'text-[var(--text-dim)] border-[var(--border)] bg-[var(--surface-3)]'
              }`}>
                {isConnected ? 'CONNECTED' : hasQr ? 'SCAN QR' : isEnabled ? 'INITIALISING' : 'DISABLED'}
              </span>
            </div>
            <p className="text-[11px] text-[var(--text-dim)] mt-0.5">
              {isConnected
                ? 'Patients can receive OTP via WhatsApp'
                : hasQr
                  ? 'QR ready — scan to connect your clinic WhatsApp'
                  : isEnabled
                    ? 'Starting up…'
                    : 'Set WHATSAPP_ENABLED=true in .env to activate'}
            </p>
          </div>
        </div>
        <Link
          href="/admin/whatsapp"
          className="flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded-lg bg-[var(--surface-3)] border border-[var(--border)] text-[var(--text-dim)] hover:text-[var(--brass)] hover:border-[var(--brass)]/50 transition-all"
        >
          {hasQr ? 'Scan QR' : 'Setup'}
          <ExternalLink className="w-3 h-3" />
        </Link>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const { user: currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [staff, setStaff] = useState<User[]>([]);
  const [doctors, setDoctors] = useState<User[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clinicSettings, setClinicSettings] = useState<ClinicSettings | null>(null);
  const [gstRules, setGstRules] = useState<GstRule[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [collectionReport, setCollectionReport] = useState<any>(null);
  const [reportsSummary, setReportsSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Billing / Revenue tab state
  const [billingFilter, setBillingFilter] = useState<'all' | 'today' | 'yesterday' | 'last_week' | 'last_month' | 'specific_date'>('all');
  const [billingSpecificDate, setBillingSpecificDate] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  // Staff Management State
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);
  const [showStaffPassword, setShowStaffPassword] = useState(false);
  const [newStaff, setNewStaff] = useState({
    username: '',
    password: '',
    fullName: '',
    email: '',
    role: 'Doctor' as any,
    specialization: '',
    consultFee: 500,
  });
  const [editingStaff, setEditingStaff] = useState<User | null>(null);
  const [editStaffPassword, setEditStaffPassword] = useState('');

  // GST Rule State
  const [newGstRule, setNewGstRule] = useState({ itemType: '', gstRate: 18 });
  const [editingGstRule, setEditingGstRule] = useState<{ _id: string; itemType: string; gstRate: number } | null>(null);

  // Audit Logs Filter State
  const [auditSearch, setAuditSearch] = useState('');
  const [auditRoleFilter, setAuditRoleFilter] = useState('all');
  const [auditDateFilter, setAuditDateFilter] = useState<'all' | 'today' | 'week'>('all');

  // Appointments Tab Filter State
  const [appointmentSearch, setAppointmentSearch] = useState('');
  const [appointmentStatusFilter, setAppointmentStatusFilter] = useState('all');
  const [appointmentDateFilter, setAppointmentDateFilter] = useState<'all' | 'today' | 'upcoming' | 'past'>('all');

  const fetchAdminData = useCallback(async () => {
    try {
      setLoading(true);
      const [stRes, docRes, pRes, aRes, invRes, setRes, audRes, colRes, sumRes] = await Promise.all([
        api.get('/admin/staff'),
        api.get('/admin/doctors'),
        api.get('/receptionist/patients?limit=50'),
        api.get('/appointments?limit=50'),
        api.get('/billing/invoices?limit=50'),
        api.get('/admin/settings'),
        api.get('/admin/audit-log?limit=100'),
        api.get('/admin/reports/collections'),
        api.get('/admin/reports/summary'),
      ]);

      setStaff(stRes.data.data || []);
      setDoctors(docRes.data.data || []);
      setPatients(pRes.data.data || []);
      setAppointments(aRes.data.data || []);
      setInvoices(invRes.data.data || []);
      setClinicSettings(setRes.data.data || null);
      setGstRules(setRes.data.data?.gstRules || []);
      setAuditLogs(audRes.data.data || []);
      setCollectionReport(colRes.data.data || null);
      setReportsSummary(sumRes.data.data || null);
    } catch {
      toast.error('Failed to load administration data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAdminData();
  }, [fetchAdminData]);

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: any = {
        username: newStaff.username.trim(),
        password: newStaff.password,
        fullName: newStaff.fullName.trim(),
        role: newStaff.role,
      };
      if (newStaff.email?.trim()) payload.email = newStaff.email.trim();
      if (newStaff.specialization?.trim()) payload.specialization = newStaff.specialization.trim();
      if (newStaff.role === 'Doctor') {
        payload.consultFee = Number(newStaff.consultFee) || 500;
      }

      await api.post('/admin/staff', payload);
      toast.success(`Staff account created for ${newStaff.fullName}`);
      setShowAddStaffModal(false);
      setNewStaff({
        username: '',
        password: '',
        fullName: '',
        email: '',
        role: 'Doctor',
        specialization: '',
        consultFee: 500,
      });
      fetchAdminData();
    } catch (err: any) {
      const errMsg = err.response?.data?.details?.[0]?.message || err.response?.data?.error || 'Failed to create staff account';
      toast.error(errMsg);
    }
  };

  const handleToggleStaffStatus = async (user: User) => {
    const nextStatus = user.status === 'Active' ? 'Suspended' : 'Active';
    try {
      await api.patch(`/admin/staff/${user._id}/status`, { status: nextStatus });
      toast.info(`Account status updated to ${nextStatus}`);
      fetchAdminData();
    } catch {
      toast.error('Failed to update status');
    }
  };

  const handleRemoveStaff = async (staffMember: User) => {
    if (staffMember._id === currentUser?._id) {
      toast.error('You cannot remove your own admin account');
      return;
    }
    const confirmed = window.confirm(
      `Are you sure you want to remove staff member "${staffMember.fullName}" (@${staffMember.username})? This action cannot be undone.`
    );
    if (!confirmed) return;

    try {
      await api.delete(`/admin/staff/${staffMember._id}`);
      toast.success(`Staff member "${staffMember.fullName}" removed successfully`);
      fetchAdminData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to remove staff member');
    }
  };

  const handleSaveClinicSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clinicSettings) return;
    try {
      await api.patch('/admin/settings', clinicSettings);
      toast.success('Clinic configuration saved');
      fetchAdminData();
    } catch {
      toast.error('Failed to save settings');
    }
  };

  const handleAddGstRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGstRule.itemType) return;
    try {
      const res = await api.post('/admin/gst-rules', newGstRule);
      setGstRules(res.data.data || []);
      setNewGstRule({ itemType: '', gstRate: 18 });
      toast.success(`GST Rule for ${newGstRule.itemType} added`);
    } catch {
      toast.error('Failed to add GST rule');
    }
  };

  const handleDeleteGstRule = async (ruleId: string) => {
    try {
      const res = await api.delete(`/admin/gst-rules/${ruleId}`);
      setGstRules(res.data.data || []);
      toast.success('GST rule deleted');
    } catch {
      toast.error('Failed to delete GST rule');
    }
  };

  const handleUpdateGstRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGstRule) return;
    try {
      const res = await api.patch(`/admin/gst-rules/${editingGstRule._id}`, {
        itemType: editingGstRule.itemType,
        gstRate: editingGstRule.gstRate,
      });
      setGstRules(res.data.data || []);
      toast.success(`GST rate for ${editingGstRule.itemType} updated to ${editingGstRule.gstRate}%`);
      setEditingGstRule(null);
    } catch {
      toast.error('Failed to update GST rule');
    }
  };

  const handleUpdateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaff) return;
    try {
      await api.patch(`/admin/staff/${editingStaff._id}`, {
        fullName: editingStaff.fullName,
        email: editingStaff.email,
        role: editingStaff.role,
        specialization: editingStaff.specialization,
        consultFee: editingStaff.consultFee,
      });

      if (editStaffPassword && editStaffPassword.length >= 6) {
        await api.patch(`/admin/staff/${editingStaff._id}/password`, {
          password: editStaffPassword,
        });
      }

      toast.success(`Updated profile & role for ${editingStaff.fullName}`);
      setEditingStaff(null);
      setEditStaffPassword('');
      fetchAdminData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.response?.data?.message || 'Failed to update staff');
    }
  };

  // Filtered audit logs based on search, role, and date filters
  const filteredAuditLogs = auditLogs.filter((l) => {
    if (auditSearch.trim()) {
      const q = auditSearch.toLowerCase();
      const actor = (getActorName(l) || '').toLowerCase();
      const action = (l.action || '').toLowerCase();
      const desc = (formatActivitySentence(l) || '').toLowerCase();
      const ip = (l.ipAddress || '').toLowerCase();
      const role = (l.userRole || '').toLowerCase();
      if (!actor.includes(q) && !action.includes(q) && !desc.includes(q) && !ip.includes(q) && !role.includes(q)) {
        return false;
      }
    }
    if (auditRoleFilter !== 'all') {
      if ((l.userRole || 'System').toLowerCase() !== auditRoleFilter.toLowerCase()) {
        return false;
      }
    }
    if (auditDateFilter === 'today') {
      const logDate = new Date(l.createdAt);
      const now = new Date();
      if (
        logDate.getDate() !== now.getDate() ||
        logDate.getMonth() !== now.getMonth() ||
        logDate.getFullYear() !== now.getFullYear()
      ) {
        return false;
      }
    } else if (auditDateFilter === 'week') {
      const logTime = new Date(l.createdAt).getTime();
      const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      if (logTime < weekAgo) return false;
    }
    return true;
  });

  const exportAuditLogsToCsv = () => {
    if (filteredAuditLogs.length === 0) {
      toast.error('No audit records to export');
      return;
    }
    const headers = ['Timestamp', 'Role', 'Actor Name', 'Action Description', 'IP Address'];
    const rows = filteredAuditLogs.map((l) => [
      `"${new Date(l.createdAt).toISOString()}"`,
      `"${l.userRole || 'System'}"`,
      `"${(getActorName(l) || '').replace(/"/g, '""')}"`,
      `"${(formatActivitySentence(l) || '').replace(/"/g, '""')}"`,
      `"${l.ipAddress || '127.0.0.1'}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `dermatrack-audit-log-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Audit log CSV exported successfully');
  };

  const exportReportsSummaryToCsv = () => {
    if (!reportsSummary) {
      toast.error('No report data available to export');
      return;
    }
    const lines: string[] = [];
    lines.push('DERMATRACK CLINIC - COMPREHENSIVE EXECUTIVE REPORT');
    lines.push(`Generated At: ${new Date().toLocaleString()}`);
    lines.push('');
    lines.push('--- REVENUE & COLLECTIONS ---');
    lines.push(`Today Collections,₹${reportsSummary.dailyCollections?.today?.amount || 0},${reportsSummary.dailyCollections?.today?.count || 0} Invoices`);
    lines.push(`MTD Collections,₹${reportsSummary.dailyCollections?.month?.amount || 0},${reportsSummary.dailyCollections?.month?.count || 0} Invoices`);
    lines.push(`Pending Dues,₹${reportsSummary.pendingDues?.totalAmount || 0},${reportsSummary.pendingDues?.count || 0} Invoices`);
    lines.push('');
    lines.push('--- GST SUMMARY ---');
    lines.push(`Taxable Sales,₹${reportsSummary.gstSummary?.taxableSales || 0}`);
    lines.push(`CGST (Central GST 50%),₹${reportsSummary.gstSummary?.cgst || 0}`);
    lines.push(`SGST (State GST 50%),₹${reportsSummary.gstSummary?.sgst || 0}`);
    lines.push(`Total GST Liability,₹${reportsSummary.gstSummary?.totalGst || 0}`);
    lines.push(`Total Invoiced Gross,₹${reportsSummary.gstSummary?.totalAmountPaid || 0}`);
    lines.push('');
    lines.push('--- PAYMENT MODES ---');
    lines.push('Mode,Count,Total Collected (₹)');
    (reportsSummary.byPaymentMode || []).forEach((m: any) => {
      lines.push(`${m.mode || m._id || 'Other'},${m.count},₹${m.total}`);
    });
    lines.push('');
    lines.push('--- FAST-MOVING MEDICATIONS (LAST 30 DAYS) ---');
    lines.push('Medicine Name,Category,Units Dispensed,Revenue (₹)');
    (reportsSummary.fastMovers || []).forEach((fm: any) => {
      lines.push(`"${fm.name}","${fm.category || 'Medicine'}",${fm.totalQuantity},₹${fm.totalRevenue}`);
    });
    lines.push('');
    lines.push('--- EXPIRY RISK WATCHLIST (<90 DAYS) ---');
    lines.push('Medicine Name,Batch Number,Expiry Date,Days Remaining,Units in Stock,Cost Value at Risk (₹)');
    (reportsSummary.expiryRisk || []).forEach((er: any) => {
      lines.push(`"${er.name}","${er.batchNumber}","${er.expiryDate}",${er.daysRemaining},${er.units},₹${er.valueAtRisk}`);
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + lines.join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `dermatrack-executive-report-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Executive report CSV exported successfully');
  };

  const navGroups = [
    {
      title: 'Administration',
      items: [
        { id: 'overview', label: 'Executive Overview', icon: LayoutDashboard },
        { id: 'reports', label: 'Reports & Analytics', icon: TrendingUp },
        { id: 'doctors', label: 'Doctor Roster', icon: Stethoscope, badge: doctors.length },
        { id: 'staff', label: 'Staff Management', icon: Shield, badge: staff.length },
        { id: 'patients', label: 'Patient Master', icon: Users, badge: patients.length },
        { id: 'appointments', label: 'Appointments', icon: Calendar, badge: appointments.length },
        { id: 'billing', label: 'Revenue & Invoices', icon: CreditCard },
        { id: 'gst', label: 'GST Tax Rates', icon: Percent },
        { id: 'settings', label: 'Clinic Configuration', icon: Settings },
        { id: 'audit', label: 'Audit Trail Logs', icon: History },
      ],
    },
  ];

  return (
    <AppShell
      navGroups={navGroups}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      pageTitle="Administrator & Operations Console"
      topbarActions={
        <button
          onClick={() => setShowAddStaffModal(true)}
          className="btn-brass px-3 py-1.5 rounded text-xs font-mono font-medium flex items-center gap-1"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Staff Account</span>
        </button>
      }
    >
      <div className="space-y-6">
        {/* ================= OVERVIEW TAB ================= */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard
                label="Registered Patients"
                value={patients.length}
                delta={patients.length > 0 ? "+12% MoM" : "New Facility"}
                deltaType={patients.length > 0 ? "positive" : "neutral"}
                icon={<Users className="w-5 h-5" />}
              />
              <KpiCard
                label="Total Revenue Collections"
                value={`₹${(collectionReport?.totalCollected || 0).toLocaleString()}`}
                delta={collectionReport?.totalCollected > 0 ? "Direct In-Clinic" : "No Invoices Yet"}
                deltaType={collectionReport?.totalCollected > 0 ? "positive" : "neutral"}
                icon={<CreditCard className="w-5 h-5" />}
              />
              <KpiCard
                label="Active Staff Accounts"
                value={staff.filter((s) => s.status === 'Active').length}
                subtext={`${staff.length} Total Users`}
                icon={<Shield className="w-5 h-5" />}
              />
              <KpiCard
                label="Active Doctors"
                value={doctors.filter((d) => d.isOnDuty).length}
                subtext={`${doctors.length} Registered Specialists`}
                icon={<Stethoscope className="w-5 h-5" />}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Panel title="Recent System Activity Log" subtitle="Live overview of clinic operations, patient visits, and staff actions">
                <DataTable
                  columns={[
                    {
                      header: 'TIME',
                      className: 'whitespace-nowrap w-24',
                      accessor: (l) => <span className="font-mono text-xs text-[var(--text-dim)]">{formatLogTime(l.createdAt)}</span>,
                    },
                    {
                      header: 'ROLE',
                      className: 'whitespace-nowrap w-28',
                      accessor: (l) => <Badge variant="brass">{l.userRole || 'System'}</Badge>,
                    },
                    {
                      header: 'NAME',
                      className: 'whitespace-nowrap font-medium text-xs text-[var(--text)] max-w-[120px] truncate',
                      accessor: (l) => <span title={getActorName(l)}>{getActorName(l)}</span>,
                    },
                    {
                      header: 'ACTION',
                      className: 'text-xs text-[var(--text)] font-medium leading-relaxed',
                      accessor: (l) => <span>{formatActivitySentence(l)}</span>,
                    },
                  ]}
                  data={auditLogs.slice(0, 6)}
                  keyExtractor={(l) => l._id}
                  emptyMessage="No activity logs for this hospital yet."
                />
              </Panel>

              <Panel title="Consulting Doctors Availability" subtitle="Live duty state and patient assignment">
                <div className="space-y-3">
                  {doctors.length === 0 ? (
                    <div className="p-8 text-center border border-dashed border-[var(--border)] rounded-lg bg-[var(--surface)]/50">
                      <Stethoscope className="w-8 h-8 text-[var(--text-dim)] mx-auto mb-2 opacity-50" />
                      <p className="text-xs text-[var(--text-dim)] font-medium">No doctors registered yet</p>
                      <p className="text-[11px] text-[var(--text-dim)]/70 mt-1">
                        Click &ldquo;Add Staff Account&rdquo; in the top bar to add your hospital&apos;s specialists and doctors.
                      </p>
                    </div>
                  ) : (
                    doctors.map((doc) => (
                      <div
                        key={doc._id}
                        className="p-3 bg-[var(--surface-2)] border border-[var(--border)] rounded flex justify-between items-center"
                      >
                        <div>
                          <strong className="text-sm block text-[var(--text)]">{doc.fullName}</strong>
                          <span className="text-xs text-[var(--text-dim)]">{doc.specialization}</span>
                          <span className="block font-mono text-xs text-[var(--brass)] mt-0.5">
                            Consultation Fee: ₹{doc.consultFee || 500}
                          </span>
                        </div>
                        <Badge variant={doc.isOnDuty ? 'success' : 'neutral'}>
                          {doc.isOnDuty ? 'On Duty' : 'Off Duty'}
                        </Badge>
                      </div>
                    ))
                  )}
                </div>
              </Panel>
            </div>
          </div>
        )}

        {/* ================= REPORTS & ANALYTICS TAB ================= */}
        {activeTab === 'reports' && (
          <div className="space-y-6">
            {/* Header / Actions Bar */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[var(--surface-1)] border border-[var(--border)] p-4 rounded-lg">
              <div>
                <h2 className="text-base font-display font-bold text-[var(--text)] flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-[var(--brass)]" />
                  Clinic Financial &amp; Operational Intelligence
                </h2>
                <p className="text-xs text-[var(--text-dim)] mt-0.5">
                  Real-time consolidated analytics across revenue collections, GST liabilities, medication velocity, and inventory valuation.
                </p>
              </div>
              <button
                onClick={exportReportsSummaryToCsv}
                className="btn-brass px-3.5 py-2 rounded text-xs font-mono font-medium flex items-center gap-2 shadow-sm shrink-0"
              >
                <Download className="w-4 h-4" />
                <span>Export Report CSV</span>
              </button>
            </div>

            {/* Top KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <KpiCard
                label="Today's Collections"
                value={`₹${(reportsSummary?.dailyCollections?.today?.amount || 0).toLocaleString()}`}
                delta={`${reportsSummary?.dailyCollections?.today?.count || 0} Invoices`}
                deltaType={(reportsSummary?.dailyCollections?.today?.amount || 0) > 0 ? 'positive' : 'neutral'}
                icon={<IndianRupee className="w-5 h-5" />}
              />
              <KpiCard
                label="MTD Collections"
                value={`₹${(reportsSummary?.dailyCollections?.month?.amount || 0).toLocaleString()}`}
                delta={`${reportsSummary?.dailyCollections?.month?.count || 0} Settled`}
                deltaType={(reportsSummary?.dailyCollections?.month?.amount || 0) > 0 ? 'positive' : 'neutral'}
                icon={<CreditCard className="w-5 h-5" />}
              />
              <KpiCard
                label="Outstanding Dues"
                value={`₹${(reportsSummary?.pendingDues?.totalAmount || 0).toLocaleString()}`}
                delta={`${reportsSummary?.pendingDues?.count || 0} Unpaid`}
                deltaType={(reportsSummary?.pendingDues?.totalAmount || 0) > 0 ? 'negative' : 'positive'}
                icon={<AlertTriangle className="w-5 h-5" />}
              />
              <KpiCard
                label="Total GST Liability"
                value={`₹${(reportsSummary?.gstSummary?.totalGst || 0).toLocaleString()}`}
                delta={`CGST ₹${(reportsSummary?.gstSummary?.cgst || 0).toLocaleString()} | SGST ₹${(reportsSummary?.gstSummary?.sgst || 0).toLocaleString()}`}
                deltaType="neutral"
                icon={<Percent className="w-5 h-5" />}
              />
              <KpiCard
                label="Stock Retail Value"
                value={`₹${(reportsSummary?.stockValuation?.retailValuation || 0).toLocaleString()}`}
                delta={`Cost: ₹${(reportsSummary?.stockValuation?.costValuation || 0).toLocaleString()}`}
                deltaType="positive"
                icon={<Package className="w-5 h-5" />}
              />
            </div>

            {/* Row 2: Payment Modes & GST Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Payment Mode Mix */}
              <Panel
                title="Collections by Payment Channel"
                subtitle="Distribution across physical cash, digital UPI, cards, and online gateways"
              >
                <div className="space-y-4 pt-1">
                  {(!reportsSummary?.byPaymentMode || reportsSummary.byPaymentMode.length === 0) ? (
                    <p className="text-xs text-[var(--text-dim)] py-4 text-center">No payment transactions recorded yet.</p>
                  ) : (
                    reportsSummary.byPaymentMode.map((pm: any, idx: number) => {
                      const mode = pm.mode || pm._id || 'Other';
                      const totalCollected = reportsSummary.dailyCollections?.month?.amount || reportsSummary.gstSummary?.totalAmountPaid || 1;
                      const percent = Math.min(100, Math.round((pm.total / (totalCollected || 1)) * 100));
                      const getModeIcon = (m: string) => {
                        if (m === 'Cash') return <Banknote className="w-4 h-4 text-emerald-500" />;
                        if (m === 'UPI') return <Smartphone className="w-4 h-4 text-purple-500" />;
                        if (m === 'Card') return <CardIcon className="w-4 h-4 text-blue-500" />;
                        return <CreditCard className="w-4 h-4 text-[var(--brass)]" />;
                      };
                      return (
                        <div key={`payment-mode-${mode}-${idx}`} className="space-y-1.5 p-3 bg-[var(--surface-2)] border border-[var(--border)] rounded-md">
                          <div className="flex justify-between items-center text-xs">
                            <div className="flex items-center gap-2 font-medium text-[var(--text)]">
                              {getModeIcon(mode)}
                              <span>{mode}</span>
                              <span className="text-[10px] font-mono text-[var(--text-dim)]">({pm.count} txns)</span>
                            </div>
                            <div className="font-mono font-bold text-[var(--text)]">
                              ₹{pm.total.toLocaleString()}
                              <span className="text-[11px] text-[var(--text-dim)] ml-1.5 font-normal">({percent}%)</span>
                            </div>
                          </div>
                          <div className="w-full h-2 bg-[var(--surface-3)] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[var(--brass)] rounded-full transition-all duration-500"
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </Panel>

              {/* GST Compliance Matrix */}
              <Panel
                title="GST Tax Distribution"
                subtitle="Dual Central (CGST) and State (SGST) tax accounts breakdown"
              >
                <div className="space-y-3 pt-1">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-[var(--surface-2)] border border-[var(--border)] rounded-md">
                      <span className="text-[11px] font-mono text-[var(--text-dim)] block">TAXABLE SALES (EXCL. GST)</span>
                      <strong className="text-base font-mono text-[var(--text)]">
                        ₹{(reportsSummary?.gstSummary?.taxableSales || 0).toLocaleString()}
                      </strong>
                    </div>
                    <div className="p-3 bg-[var(--surface-2)] border border-[var(--border)] rounded-md">
                      <span className="text-[11px] font-mono text-[var(--text-dim)] block">TOTAL GROSS INVOICED</span>
                      <strong className="text-base font-mono text-[var(--brass)]">
                        ₹{(reportsSummary?.gstSummary?.totalAmountPaid || 0).toLocaleString()}
                      </strong>
                    </div>
                  </div>

                  <div className="p-3 bg-[var(--surface-2)] border border-[var(--border)] rounded-md space-y-2">
                    <div className="flex justify-between text-xs py-1 border-b border-[var(--border)]">
                      <span className="text-[var(--text-dim)]">Central GST (CGST - 50%):</span>
                      <span className="font-mono font-bold text-[var(--text)]">
                        ₹{(reportsSummary?.gstSummary?.cgst || 0).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs py-1 border-b border-[var(--border)]">
                      <span className="text-[var(--text-dim)]">State GST (SGST - 50%):</span>
                      <span className="font-mono font-bold text-[var(--text)]">
                        ₹{(reportsSummary?.gstSummary?.sgst || 0).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs pt-1 font-bold">
                      <span className="text-[var(--brass)]">Total GST Payable to Govt:</span>
                      <span className="font-mono text-[var(--brass)] text-sm">
                        ₹{(reportsSummary?.gstSummary?.totalGst || 0).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div className="p-3 bg-[var(--surface-2)]/60 border border-[var(--border)] rounded-md flex items-center justify-between text-xs">
                    <span className="text-[var(--text-dim)]">Invoices Processed:</span>
                    <Badge variant="brass">{reportsSummary?.gstSummary?.totalInvoices || 0} Invoices</Badge>
                  </div>
                </div>
              </Panel>
            </div>

            {/* Row 3: Fast-Movers & Expiry Watchlist */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Fast-Moving Medications */}
              <Panel
                title="Top 5 Fast-Moving Medications (30 Days)"
                subtitle="Highest dispensed products ranked by prescription volume"
              >
                <DataTable
                  columns={[
                    {
                      header: 'MEDICINE',
                      accessor: (m: any) => (
                        <div>
                          <strong className="text-xs block text-[var(--text)]">{m.name}</strong>
                          <span className="text-[10px] text-[var(--text-dim)]">{m.category || 'Medicine'}</span>
                        </div>
                      ),
                    },
                    {
                      header: 'UNITS DISPENSED',
                      accessor: (m: any) => (
                        <span className="font-mono text-xs font-bold text-[var(--text)]">{m.totalQuantity} units</span>
                      ),
                    },
                    {
                      header: 'REVENUE',
                      accessor: (m: any) => (
                        <span className="font-mono text-xs font-bold text-[var(--brass)]">
                          ₹{(m.totalRevenue || 0).toLocaleString()}
                        </span>
                      ),
                    },
                  ]}
                  data={reportsSummary?.fastMovers || []}
                  keyExtractor={(m: any, idx: number) => m.medicineId || idx}
                  emptyMessage="No medicines dispensed in the past 30 days."
                />
              </Panel>

              {/* Expiry Risk Watchlist */}
              <Panel
                title="Medication Expiry Risk Watchlist"
                subtitle="Batches expiring within the next 90 days requiring priority dispensing"
              >
                <DataTable
                  columns={[
                    {
                      header: 'PRODUCT & BATCH',
                      accessor: (b: any) => (
                        <div>
                          <strong className="text-xs block text-[var(--text)]">{b.name}</strong>
                          <span className="text-[10px] font-mono text-[var(--text-dim)]">Batch: {b.batchNumber}</span>
                        </div>
                      ),
                    },
                    {
                      header: 'EXPIRY',
                      accessor: (b: any) => {
                        const info = formatExpiryTimeRemaining(b.expiryDate);
                        return (
                          <div>
                            <span className="font-mono text-xs text-[var(--text)] block">
                              {info.formattedDate || b.expiryDate}
                            </span>
                            <Badge
                              variant={info.isExpired || info.totalDays <= 30 ? 'error' : info.totalDays <= 90 ? 'warn' : 'neutral'}
                            >
                              {info.text}
                            </Badge>
                          </div>
                        );
                      },
                    },
                    {
                      header: 'UNITS',
                      accessor: (b: any) => (
                        <span className="font-mono text-xs text-[var(--text)]">{b.units}</span>
                      ),
                    },
                    {
                      header: 'VALUE AT RISK',
                      accessor: (b: any) => (
                        <span className="font-mono text-xs font-bold text-red-400">
                          ₹{(b.valueAtRisk || 0).toLocaleString()}
                        </span>
                      ),
                    },
                  ]}
                  data={reportsSummary?.expiryRisk || []}
                  keyExtractor={(b: any, idx: number) => `${b.medicineId}-${b.batchNumber}-${idx}`}
                  emptyMessage="No medication batches expiring within the next 90 days."
                />
              </Panel>
            </div>
          </div>
        )}

        {/* ================= DOCTORS ROSTER TAB ================= */}
        {activeTab === 'doctors' && (
          <Panel title="Doctor Specialist Roster" subtitle="Manage consulting dermatologists and fee tariffs">
            {doctors.length === 0 ? (
              <div className="surface-card border border-[var(--border)] rounded-2xl p-10 text-center flex flex-col items-center justify-center space-y-3 my-2">
                <div className="w-12 h-12 rounded-xl bg-[var(--surface-3)] border border-[var(--border)] flex items-center justify-center text-[var(--brass)] shadow-inner">
                  <Stethoscope className="w-6 h-6 opacity-80" />
                </div>
                <h4 className="font-display font-semibold text-sm text-[var(--text)]">No Doctors Registered Yet</h4>
                <p className="text-xs text-[var(--text-dim)] max-w-sm">
                  No consulting doctors have been added to this clinic yet. Add a doctor account to configure consultation fee tariffs.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setNewStaff((prev) => ({ ...prev, role: 'Doctor' }));
                    setShowAddStaffModal(true);
                  }}
                  className="btn-brass px-3.5 py-1.5 rounded text-xs font-mono font-medium flex items-center gap-1.5 mt-2"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Doctor Account</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {doctors.map((d) => (
                <div key={d._id} className="surface-card p-5 space-y-3 border-t-2 border-[var(--brass)]">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[var(--brass)]/20 border border-[var(--brass)] flex items-center justify-center font-display font-bold text-sm text-[var(--brass)]">
                      {d.fullName.charAt(0)}
                    </div>
                    <div>
                      <strong className="text-sm block text-[var(--text)]">{d.fullName}</strong>
                      <span className="text-xs text-[var(--text-dim)]">{d.specialization}</span>
                    </div>
                  </div>

                  <div className="p-2.5 bg-[var(--surface-2)] rounded font-mono text-xs space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="text-[var(--text-dim)]">Doctor Consultation Fee:</span>
                      <strong className="text-[var(--brass)] font-semibold">₹{d.consultFee || 500}</strong>
                    </div>
                    <div className="flex justify-between items-center text-[11px] text-[var(--text-dim)] pt-1 border-t border-[var(--border)]">
                      <span>1st Visit Case Opening &amp; Book Log:</span>
                      <span className="font-semibold text-[var(--text)]">+₹{clinicSettings?.registrationFee ?? 200} (Hospital)</span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-2">
                    <Badge variant={d.isOnDuty ? 'success' : 'neutral'}>
                      {d.isOnDuty ? 'Available' : 'Unavailable'}
                    </Badge>
                    <button
                      onClick={() => handleToggleStaffStatus(d)}
                      className="text-xs font-mono text-[var(--text-dim)] hover:text-[var(--brass)]"
                    >
                      {d.status === 'Active' ? 'Suspend' : 'Activate'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
            )}
          </Panel>
        )}

        {/* ================= STAFF MANAGEMENT TAB ================= */}
        {activeTab === 'staff' && (
          <Panel title="Staff Accounts & Role-Based Access Control" subtitle="Manage clinic accounts and permissions">
            <DataTable
              columns={[
                { header: 'NAME', accessor: (s) => <strong>{s.fullName}</strong> },
                { header: 'USERNAME', accessor: (s) => <span className="font-mono text-xs">{s.username}</span> },
                { header: 'EMAIL', accessor: (s) => <span className="text-xs text-[var(--text-dim)]">{s.email || '-'}</span> },
                { header: 'ROLE', accessor: (s) => <Badge variant="brass">{s.role}</Badge> },
                {
                  header: 'STATUS',
                  accessor: (s) => (
                    <Badge variant={s.status === 'Active' ? 'success' : 'error'}>
                      {s.status}
                    </Badge>
                  ),
                },
                {
                  header: 'ACTIONS',
                  accessor: (s) => (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setEditingStaff({ ...s });
                          setEditStaffPassword('');
                        }}
                        className="text-xs font-mono px-2 py-1 bg-[var(--surface-2)] hover:bg-[var(--surface-3)] border border-[var(--border)] rounded text-[var(--brass)] hover:text-white transition-colors flex items-center gap-1"
                      >
                        <Edit2 className="w-3 h-3" />
                        <span>Edit</span>
                      </button>
                      <button
                        onClick={() => handleToggleStaffStatus(s)}
                        className="text-xs font-mono px-2 py-1 bg-[var(--surface-2)] hover:bg-[var(--surface-3)] border border-[var(--border)] rounded text-[var(--text-dim)] hover:text-[var(--text)] transition-colors"
                      >
                        {s.status === 'Active' ? 'Suspend' : 'Activate'}
                      </button>
                      <button
                        onClick={() => handleRemoveStaff(s)}
                        disabled={s._id === currentUser?._id}
                        title={s._id === currentUser?._id ? 'Cannot remove your own admin account' : `Remove ${s.fullName}`}
                        className="text-xs font-mono px-2 py-1 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded text-red-500 hover:text-red-400 transition-colors flex items-center gap-1 disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Remove</span>
                      </button>
                    </div>
                  ),
                },
              ]}
              data={staff}
              keyExtractor={(s) => s._id}
              emptyMessage="No staff accounts registered."
            />
          </Panel>
        )}

        {/* ================= PATIENTS TAB ================= */}
        {activeTab === 'patients' && (
          <Panel title="Master Patient Index" subtitle="Complete registry of clinic patients">
            {patients.length === 0 ? (
              <div className="surface-card border border-[var(--border)] rounded-2xl p-10 text-center flex flex-col items-center justify-center space-y-3 my-2">
                <div className="w-12 h-12 rounded-xl bg-[var(--surface-3)] border border-[var(--border)] flex items-center justify-center text-[var(--brass)] shadow-inner">
                  <Users className="w-6 h-6 opacity-80" />
                </div>
                <h4 className="font-display font-semibold text-sm text-[var(--text)]">No Patients Registered Yet</h4>
                <p className="text-xs text-[var(--text-dim)] max-w-sm">
                  No patient profiles have been created. Patients registered through Receptionist check-in will appear here automatically.
                </p>
              </div>
            ) : (
              <DataTable
                columns={[
                  { header: 'ID', accessor: (p) => <span className="font-mono text-xs font-bold text-[var(--brass)]">{p.patientId}</span> },
                  { header: 'PATIENT NAME', accessor: (p) => <strong>{p.name}</strong> },
                  { header: 'PHONE', accessor: (p) => <span className="font-mono text-xs">{p.phone}</span> },
                  { header: 'GENDER', accessor: (p) => <Badge variant="neutral">{p.gender || '-'}</Badge> },
                  { header: 'LOCATION', accessor: (p) => p.location || 'Chennai' },
                  {
                    header: 'REGISTERED DATE',
                    accessor: (p) => <span className="font-mono text-xs">{new Date(p.createdAt).toLocaleDateString()}</span>,
                  },
                ]}
                data={patients}
                keyExtractor={(p) => p._id}
                emptyMessage="No registered patients."
              />
            )}
          </Panel>
        )}

        {/* ================= APPOINTMENTS TAB ================= */}
        {activeTab === 'appointments' && (() => {
          const totalAppts = appointments.length;
          const scheduledAppts = appointments.filter((a) => a.status === 'Scheduled').length;
          const activeAppts = appointments.filter((a) => a.status === 'Waiting' || a.status === 'InProgress').length;
          const completedAppts = appointments.filter((a) => a.status === 'Completed').length;
          const cancelledAppts = appointments.filter((a) => a.status === 'Cancelled' || a.status === 'NoShow').length;

          const filteredAppointments = appointments.filter((appt) => {
            if (appointmentSearch.trim()) {
              const q = appointmentSearch.toLowerCase();
              const pName = (typeof appt.patientId === 'object' && appt.patientId?.name ? appt.patientId.name : '').toLowerCase();
              const pPhone = (typeof appt.patientId === 'object' && appt.patientId?.phone ? appt.patientId.phone : '').toLowerCase();
              const pCode = (typeof appt.patientId === 'object' && appt.patientId?.patientId ? appt.patientId.patientId : '').toLowerCase();
              const dName = (typeof appt.doctorId === 'object' && appt.doctorId?.fullName ? appt.doctorId.fullName : '').toLowerCase();
              if (!pName.includes(q) && !pPhone.includes(q) && !pCode.includes(q) && !dName.includes(q)) {
                return false;
              }
            }

            if (appointmentStatusFilter !== 'all') {
              if (appt.status !== appointmentStatusFilter) return false;
            }

            if (appointmentDateFilter !== 'all') {
              const apptDate = new Date(appt.scheduledAt);
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const tomorrow = new Date(today);
              tomorrow.setDate(tomorrow.getDate() + 1);

              if (appointmentDateFilter === 'today') {
                if (apptDate < today || apptDate >= tomorrow) return false;
              } else if (appointmentDateFilter === 'upcoming') {
                if (apptDate < today) return false;
              } else if (appointmentDateFilter === 'past') {
                if (apptDate >= today) return false;
              }
            }

            return true;
          });

          const getStatusBadge = (status: string) => {
            let variant: 'success' | 'warn' | 'error' | 'brass' | 'neutral' | 'info' = 'neutral';
            switch (status) {
              case 'Scheduled':
                variant = 'info';
                break;
              case 'Waiting':
              case 'InProgress':
                variant = 'warn';
                break;
              case 'Completed':
                variant = 'success';
                break;
              case 'Cancelled':
              case 'NoShow':
                variant = 'error';
                break;
              case 'Postponed':
                variant = 'neutral';
                break;
            }
            return <Badge variant={variant}>{status}</Badge>;
          };

          return (
            <div className="space-y-6">
              {/* Top Summary KPI Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                <div className="surface-card p-4 rounded-xl border border-[var(--border)]">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-[var(--text-dim)] uppercase">Total Booked</span>
                    <Calendar className="w-4 h-4 text-[var(--brass)]" />
                  </div>
                  <div className="text-2xl font-mono font-bold text-[var(--text)] mt-1">{totalAppts}</div>
                  <div className="text-[11px] text-[var(--text-dim)] mt-0.5">All Recorded</div>
                </div>

                <div className="surface-card p-4 rounded-xl border border-[var(--border)]">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-[var(--text-dim)] uppercase">Scheduled</span>
                    <Clock className="w-4 h-4 text-sky-400" />
                  </div>
                  <div className="text-2xl font-mono font-bold text-sky-400 mt-1">{scheduledAppts}</div>
                  <div className="text-[11px] text-[var(--text-dim)] mt-0.5">Upcoming Visits</div>
                </div>

                <div className="surface-card p-4 rounded-xl border border-[var(--border)]">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-[var(--text-dim)] uppercase">Waiting / Active</span>
                    <Users className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="text-2xl font-mono font-bold text-amber-400 mt-1">{activeAppts}</div>
                  <div className="text-[11px] text-[var(--text-dim)] mt-0.5">In Clinic Queue</div>
                </div>

                <div className="surface-card p-4 rounded-xl border border-[var(--border)]">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-[var(--text-dim)] uppercase">Completed</span>
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="text-2xl font-mono font-bold text-emerald-400 mt-1">{completedAppts}</div>
                  <div className="text-[11px] text-[var(--text-dim)] mt-0.5">Consulted</div>
                </div>

                <div className="surface-card p-4 rounded-xl border border-[var(--border)]">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-[var(--text-dim)] uppercase">Cancelled</span>
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                  </div>
                  <div className="text-2xl font-mono font-bold text-rose-400 mt-1">{cancelledAppts}</div>
                  <div className="text-[11px] text-[var(--text-dim)] mt-0.5">No-Show / Cancelled</div>
                </div>
              </div>

              {/* Panel with Toolbar & DataTable or Empty State */}
              <Panel
                title="Appointments & Consultation Master"
                subtitle="Live registry of consultations, procedures, and appointments across all doctor schedules"
              >
                {/* Search & Filter Toolbar */}
                <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 pb-4 mb-4 border-b border-[var(--border)]">
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-dim)]" />
                    <input
                      type="text"
                      placeholder="Search patient, phone, ID, or doctor..."
                      value={appointmentSearch}
                      onChange={(e) => setAppointmentSearch(e.target.value)}
                      className="w-full pl-9 pr-8 py-1.5 text-xs bg-[var(--surface-2)] border border-[var(--border)] rounded text-[var(--text)] placeholder-[var(--text-dim)] focus:outline-none focus:border-[var(--brass)]"
                    />
                    {appointmentSearch && (
                      <button
                        type="button"
                        onClick={() => setAppointmentSearch('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-dim)] hover:text-[var(--text)]"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* Date filter dropdown */}
                    <div className="flex items-center gap-1 bg-[var(--surface-2)] border border-[var(--border)] rounded p-0.5 text-xs font-mono">
                      {(['all', 'today', 'upcoming', 'past'] as const).map((df) => (
                        <button
                          key={df}
                          type="button"
                          onClick={() => setAppointmentDateFilter(df)}
                          className={`px-2.5 py-1 rounded capitalize transition-all ${
                            appointmentDateFilter === df
                              ? 'bg-[var(--brass)] text-black font-bold shadow-xs'
                              : 'text-[var(--text-dim)] hover:text-[var(--text)]'
                          }`}
                        >
                          {df === 'all' ? 'All Dates' : df}
                        </button>
                      ))}
                    </div>

                    {/* Status filter dropdown */}
                    <select
                      value={appointmentStatusFilter}
                      onChange={(e) => setAppointmentStatusFilter(e.target.value)}
                      className="px-2.5 py-1.5 text-xs font-mono bg-[var(--surface-2)] border border-[var(--border)] rounded text-[var(--text)] focus:outline-none focus:border-[var(--brass)]"
                    >
                      <option value="all">All Statuses</option>
                      <option value="Scheduled">Scheduled</option>
                      <option value="Waiting">Waiting</option>
                      <option value="InProgress">In Progress</option>
                      <option value="Completed">Completed</option>
                      <option value="Cancelled">Cancelled</option>
                      <option value="NoShow">No Show</option>
                      <option value="Postponed">Postponed</option>
                    </select>
                  </div>
                </div>

                {/* Content: Empty State vs DataTable */}
                {totalAppts === 0 ? (
                  <div className="surface-card border border-[var(--border)] rounded-2xl p-12 text-center flex flex-col items-center justify-center space-y-4 my-2">
                    <div className="w-16 h-16 rounded-2xl bg-[var(--surface-3)] border border-[var(--border)] flex items-center justify-center text-[var(--brass)] shadow-inner">
                      <Calendar className="w-8 h-8 opacity-80" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="font-display font-bold text-base text-[var(--text)]">No Appointments Recorded</h3>
                      <p className="text-xs text-[var(--text-dim)] max-w-md mx-auto">
                        There are currently no patient appointments scheduled or recorded in the clinic database.
                      </p>
                    </div>
                    <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[var(--surface-2)] border border-[var(--border)] text-[11px] font-mono text-[var(--text-dim)]">
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                      Appointments booked by Receptionists or Patients will appear here in real-time.
                    </div>
                  </div>
                ) : filteredAppointments.length === 0 ? (
                  <div className="surface-card border border-[var(--border)] rounded-2xl p-10 text-center flex flex-col items-center justify-center space-y-3 my-2">
                    <Calendar className="w-8 h-8 text-[var(--text-dim)] opacity-60" />
                    <h4 className="font-display font-semibold text-sm text-[var(--text)]">No Matching Appointments</h4>
                    <p className="text-xs text-[var(--text-dim)] max-w-sm">
                      No appointments match your active search &quot;{appointmentSearch}&quot; or selected filters.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setAppointmentSearch('');
                        setAppointmentStatusFilter('all');
                        setAppointmentDateFilter('all');
                      }}
                      className="btn-brass px-3 py-1.5 rounded text-xs font-mono font-medium"
                    >
                      Reset All Filters
                    </button>
                  </div>
                ) : (
                  <DataTable
                    columns={[
                      {
                        header: 'PATIENT',
                        accessor: (a) => {
                          const p = typeof a.patientId === 'object' ? a.patientId : null;
                          return (
                            <div>
                              <strong className="block text-[var(--text)]">{p?.name || 'Walk-in / Patient'}</strong>
                              <div className="flex items-center gap-2 font-mono text-[11px] text-[var(--text-dim)]">
                                {p?.patientId && <span className="text-[var(--brass)] font-bold">{p.patientId}</span>}
                                {p?.phone && <span>{p.phone}</span>}
                              </div>
                            </div>
                          );
                        },
                      },
                      {
                        header: 'DOCTOR',
                        accessor: (a) => {
                          const d = typeof a.doctorId === 'object' ? a.doctorId : null;
                          return (
                            <div>
                              <strong className="block text-[var(--text)]">{d?.fullName || 'Assigned Doctor'}</strong>
                              {d?.specialization && (
                                <span className="text-[11px] text-[var(--text-dim)] block">{d.specialization}</span>
                              )}
                            </div>
                          );
                        },
                      },
                      {
                        header: 'SCHEDULED DATE & TIME',
                        accessor: (a) => {
                          const dateObj = new Date(a.scheduledAt);
                          return (
                            <div className="font-mono text-xs">
                              <span className="font-bold text-[var(--text)] block">
                                {dateObj.toLocaleDateString(undefined, {
                                  weekday: 'short',
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                })}
                              </span>
                              <span className="text-[var(--brass)] text-[11px]">
                                {dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          );
                        },
                      },
                      {
                        header: 'MODE & TYPE',
                        accessor: (a) => (
                          <div className="flex items-center gap-1.5">
                            <Badge variant={a.mode === 'Online' ? 'info' : 'neutral'} size="sm">
                              {a.mode || 'Offline'}
                            </Badge>
                            <Badge variant={a.type === 'Surgery' ? 'brass' : 'neutral'} size="sm">
                              {a.type || 'Consult'}
                            </Badge>
                          </div>
                        ),
                      },
                      {
                        header: 'STATUS',
                        accessor: (a) => getStatusBadge(a.status),
                      },
                      {
                        header: 'BOOKED BY',
                        accessor: (a) => (
                          <span className="font-mono text-[11px] text-[var(--text-dim)]">
                            {a.bookedByRole || 'Staff'}
                          </span>
                        ),
                      },
                      {
                        header: 'NOTES / REASON',
                        accessor: (a) => (
                          <span className="text-xs text-[var(--text-dim)] max-w-xs truncate block" title={a.notes || a.cancellationReason || ''}>
                            {a.notes || a.cancellationReason || a.postponedReason || '—'}
                          </span>
                        ),
                      },
                    ]}
                    data={filteredAppointments}
                    keyExtractor={(a) => a._id}
                    emptyMessage="No appointments found."
                  />
                )}
              </Panel>
            </div>
          );
        })()}


        {/* ================= REVENUE & INVOICES TAB ================= */}
        {activeTab === 'billing' && (() => {
          // Compute filtered invoices
          const paidInvoices = invoices.filter((inv) => (inv.amountPaid || 0) > 0);
          let filteredInvoices = [...paidInvoices];
          const now = new Date();

          if (billingFilter === 'today') {
            const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
            const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();
            filteredInvoices = filteredInvoices.filter((inv) => {
              const t = new Date(inv.createdAt).getTime();
              return t >= start && t <= end;
            });
          } else if (billingFilter === 'yesterday') {
            const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0, 0).getTime();
            const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999).getTime();
            filteredInvoices = filteredInvoices.filter((inv) => {
              const t = new Date(inv.createdAt).getTime();
              return t >= start && t <= end;
            });
          } else if (billingFilter === 'last_week') {
            const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7, 0, 0, 0, 0).getTime();
            filteredInvoices = filteredInvoices.filter((inv) => new Date(inv.createdAt).getTime() >= start);
          } else if (billingFilter === 'last_month') {
            const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30, 0, 0, 0, 0).getTime();
            filteredInvoices = filteredInvoices.filter((inv) => new Date(inv.createdAt).getTime() >= start);
          } else if (billingFilter === 'specific_date' && billingSpecificDate) {
            const [y, m, d] = billingSpecificDate.split('-').map(Number);
            const start = new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
            const end = new Date(y, m - 1, d, 23, 59, 59, 999).getTime();
            filteredInvoices = filteredInvoices.filter((inv) => {
              const t = new Date(inv.createdAt).getTime();
              return t >= start && t <= end;
            });
          }

          // Aggregate stats
          const totalRevenue = paidInvoices.reduce((sum, inv) => sum + (inv.amountPaid || 0), 0);
          const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
          const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();
          const todayInvoices = paidInvoices.filter((inv) => {
            const t = new Date(inv.createdAt).getTime();
            return t >= todayStart && t <= todayEnd;
          });
          const todayRevenue = todayInvoices.reduce((sum, inv) => sum + (inv.amountPaid || 0), 0);
          const pendingInvoices = invoices.filter((inv) => inv.status !== 'Paid');
          const pendingAmount = pendingInvoices.reduce((sum, inv) => sum + (inv.grandTotal - (inv.amountPaid || 0)), 0);

          // Aggregate payment mode breakdown from filtered invoices
          const modeBreakdown: Record<string, { count: number; total: number }> = {};
          filteredInvoices.forEach((inv) => {
            if (inv.payments && inv.payments.length > 0) {
              inv.payments.forEach((p) => {
                if (!modeBreakdown[p.mode]) modeBreakdown[p.mode] = { count: 0, total: 0 };
                modeBreakdown[p.mode].count += 1;
                modeBreakdown[p.mode].total += p.amount;
              });
            } else if (inv.amountPaid > 0) {
              if (!modeBreakdown['Cash']) modeBreakdown['Cash'] = { count: 0, total: 0 };
              modeBreakdown['Cash'].count += 1;
              modeBreakdown['Cash'].total += inv.amountPaid;
            }
          });
          const filteredTotal = filteredInvoices.reduce((sum, inv) => sum + (inv.amountPaid || 0), 0);

          return (
            <div className="space-y-6">
              {/* KPI Cards Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard
                  label="Total Revenue Collected"
                  value={`₹${totalRevenue.toLocaleString()}`}
                  delta={paidInvoices.length > 0 ? `${paidInvoices.length} Invoices` : 'No Invoices'}
                  deltaType={totalRevenue > 0 ? 'positive' : 'neutral'}
                  icon={<IndianRupee className="w-5 h-5" />}
                />
                <KpiCard
                  label="Today's Collections"
                  value={`₹${todayRevenue.toLocaleString()}`}
                  delta={todayInvoices.length > 0 ? `${todayInvoices.length} Paid Today` : 'No Payments Today'}
                  deltaType={todayRevenue > 0 ? 'positive' : 'neutral'}
                  icon={<TrendingUp className="w-5 h-5" />}
                />
                <KpiCard
                  label="Outstanding Dues"
                  value={`₹${pendingAmount.toLocaleString()}`}
                  delta={pendingInvoices.length > 0 ? `${pendingInvoices.length} Pending` : 'All Settled'}
                  deltaType={pendingAmount > 0 ? 'warn' : 'positive'}
                  icon={<Clock className="w-5 h-5" />}
                />
                <KpiCard
                  label="Filtered Period Total"
                  value={`₹${filteredTotal.toLocaleString()}`}
                  delta={`${filteredInvoices.length} Invoices`}
                  deltaType={filteredTotal > 0 ? 'positive' : 'neutral'}
                  icon={<FileText className="w-5 h-5" />}
                />
              </div>

              {/* Payment Mode Breakdown Cards */}
              {Object.keys(modeBreakdown).length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {['Cash', 'UPI', 'Card'].map((mode) => {
                    const data = modeBreakdown[mode];
                    const modeIcon = mode === 'Cash' ? <Banknote className="w-4 h-4" /> : mode === 'UPI' ? <Smartphone className="w-4 h-4" /> : <CardIcon className="w-4 h-4" />;
                    const modeColor = mode === 'Cash' ? 'text-emerald-400' : mode === 'UPI' ? 'text-violet-400' : 'text-sky-400';
                    return (
                      <div key={mode} className="surface-card p-4 flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-full bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center ${modeColor}`}>
                          {modeIcon}
                        </div>
                        <div className="flex-1">
                          <p className="font-mono text-xs uppercase tracking-wider text-[var(--text-dim)]">{mode} Payments</p>
                          <p className="font-display text-lg font-bold text-[var(--text)]">
                            ₹{(data?.total || 0).toLocaleString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="font-mono text-xs text-[var(--text-dim)]">{data?.count || 0} txns</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Filter Controls + Invoice Table */}
              <Panel
                title="Invoice Ledger"
                subtitle="Complete record of all collected consultation fees, procedures, and pharmacy bills"
              >
                {/* Date Filter Row */}
                <div className="flex flex-wrap items-center gap-2 mb-4 pb-4 border-b border-[var(--border)]">
                  <Filter className="w-3.5 h-3.5 text-[var(--text-dim)]" />
                  <span className="text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider mr-1">Period:</span>
                  {[
                    { key: 'all', label: 'All Time' },
                    { key: 'today', label: 'Today' },
                    { key: 'yesterday', label: 'Yesterday' },
                    { key: 'last_week', label: 'Last 7 Days' },
                    { key: 'last_month', label: 'Last 30 Days' },
                    { key: 'specific_date', label: 'Pick Date' },
                  ].map((opt) => (
                    <button
                      key={opt.key}
                      onClick={() => setBillingFilter(opt.key as any)}
                      className={`px-2.5 py-1 rounded text-xs font-mono transition-all ${
                        billingFilter === opt.key
                          ? 'bg-[var(--brass)] text-[var(--bg)] font-bold'
                          : 'bg-[var(--surface-2)] text-[var(--text-dim)] hover:text-[var(--text)] border border-[var(--border)]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                  {billingFilter === 'specific_date' && (
                    <input
                      type="date"
                      value={billingSpecificDate}
                      onChange={(e) => setBillingSpecificDate(e.target.value)}
                      className="px-2.5 py-1 text-xs font-mono bg-[var(--surface-2)] border border-[var(--border)] rounded text-[var(--text)] focus:outline-none focus:border-[var(--brass)]"
                    />
                  )}
                </div>

                <DataTable<Invoice>
                  columns={[
                    {
                      header: 'INVOICE #',
                      accessor: (i) => (
                        <button
                          onClick={() => setSelectedInvoice(i)}
                          className="font-mono text-xs font-bold text-[var(--brass)] hover:underline cursor-pointer"
                        >
                          {i.invoiceNumber}
                        </button>
                      ),
                    },
                    {
                      header: 'DATE & TIME',
                      accessor: (i) => {
                        if (!i.createdAt) return '-';
                        const d = new Date(i.createdAt);
                        return (
                          <div className="font-mono text-xs">
                            <span className="text-[var(--text)]">{d.toLocaleDateString()}</span>
                            <span className="text-[10px] text-[var(--text-dim)] ml-1.5">
                              {d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        );
                      },
                    },
                    {
                      header: 'PATIENT',
                      accessor: (i) => {
                        const p = i.patientId as Patient;
                        return (
                          <div>
                            <span className="font-medium text-xs text-[var(--text)]">{p?.name || 'Patient'}</span>
                            {p?.phone && (
                              <span className="block font-mono text-[10px] text-[var(--text-dim)]">{p.phone}</span>
                            )}
                          </div>
                        );
                      },
                    },
                    {
                      header: 'SERVICES',
                      accessor: (i) => {
                        const types = Array.from(new Set(i.lineItems?.map((li) => li.itemType) || []));
                        return (
                          <div className="flex flex-wrap gap-1">
                            {types.map((t) => (
                              <Badge key={t} variant="neutral" size="sm">{t}</Badge>
                            ))}
                          </div>
                        );
                      },
                    },
                    {
                      header: 'SUBTOTAL',
                      accessor: (i) => <span className="font-mono text-xs">₹{(i.subtotal || 0).toLocaleString()}</span>,
                    },
                    {
                      header: 'GST',
                      accessor: (i) => (
                        <span className="font-mono text-xs text-[var(--text-dim)]">
                          ₹{(i.totalGst || 0).toLocaleString()}
                        </span>
                      ),
                    },
                    {
                      header: 'GRAND TOTAL',
                      accessor: (i) => <span className="font-mono font-semibold text-sm">₹{i.grandTotal.toLocaleString()}</span>,
                    },
                    {
                      header: 'PAID',
                      accessor: (i) => (
                        <span className="font-mono font-semibold text-sm text-[var(--success)]">₹{(i.amountPaid || 0).toLocaleString()}</span>
                      ),
                    },
                    {
                      header: 'PAYMENT MODE',
                      accessor: (i) => {
                        const modes =
                          i.payments && i.payments.length > 0
                            ? Array.from(new Set(i.payments.map((p) => p.mode)))
                            : i.amountPaid > 0
                            ? ['Cash']
                            : ['-'];
                        return (
                          <div className="flex flex-wrap gap-1">
                            {modes.map((m, idx) => {
                              const variant = m === 'Cash' ? 'success' : m === 'UPI' ? 'info' : m === 'Card' ? 'brass' : 'neutral';
                              return <Badge key={idx} variant={variant}>{m}</Badge>;
                            })}
                          </div>
                        );
                      },
                    },
                    {
                      header: 'STATUS',
                      accessor: (i) => (
                        <Badge variant={i.status === 'Paid' ? 'success' : i.status === 'Partially Paid' ? 'warn' : 'error'}>
                          {i.status}
                        </Badge>
                      ),
                    },
                    {
                      header: 'DETAILS',
                      accessor: (i) => (
                        <button
                          onClick={() => setSelectedInvoice(i)}
                          className="text-xs font-mono px-2 py-1 bg-[var(--surface-2)] hover:bg-[var(--surface-3)] border border-[var(--border)] rounded text-[var(--text-dim)] hover:text-[var(--brass)] transition-colors flex items-center gap-1"
                        >
                          <Eye className="w-3 h-3" /> View
                        </button>
                      ),
                    },
                  ]}
                  data={filteredInvoices}
                  keyExtractor={(i) => i._id}
                  emptyMessage="No invoices found for the selected period."
                />

                {/* Summary Row */}
                {filteredInvoices.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-[var(--border)] flex flex-wrap items-center justify-between gap-4">
                    <span className="text-xs font-mono text-[var(--text-dim)]">
                      Showing {filteredInvoices.length} of {paidInvoices.length} invoices
                    </span>
                    <div className="flex items-center gap-4">
                      <span className="text-xs font-mono text-[var(--text-dim)]">
                        Period Subtotal: <strong className="text-[var(--text)]">₹{filteredInvoices.reduce((s, i) => s + (i.subtotal || 0), 0).toLocaleString()}</strong>
                      </span>
                      <span className="text-xs font-mono text-[var(--text-dim)]">
                        GST: <strong className="text-[var(--text)]">₹{filteredInvoices.reduce((s, i) => s + (i.totalGst || 0), 0).toLocaleString()}</strong>
                      </span>
                      <span className="text-sm font-mono font-bold text-[var(--brass)]">
                        Total Collected: ₹{filteredTotal.toLocaleString()}
                      </span>
                    </div>
                  </div>
                )}
              </Panel>
            </div>
          );
        })()}

        {/* ================= GST SETTINGS TAB ================= */}
        {activeTab === 'gst' && (
          <div className="max-w-2xl space-y-6">
            <Panel title="Goods & Services Tax (GST) Tariff Matrix" subtitle="Define per-line item tax rates">
              <DataTable
                columns={[
                  { header: 'ITEM TYPE', accessor: (r) => <strong className="text-sm">{r.itemType}</strong> },
                  { header: 'GST RATE (%)', accessor: (r) => <span className="font-mono font-bold text-sm text-[var(--brass)]">{r.gstRate}%</span> },
                  {
                    header: 'ACTIONS',
                    accessor: (r) => (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setEditingGstRule({ _id: r._id!, itemType: r.itemType, gstRate: r.gstRate })}
                          className="text-[var(--brass)] hover:bg-[var(--surface-2)] p-1.5 rounded transition-colors"
                          title="Edit GST Rate"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteGstRule(r._id!)}
                          className="text-[var(--error)] hover:bg-[var(--surface-2)] p-1.5 rounded transition-colors"
                          title="Delete GST Rule"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ),
                  },
                ]}
                data={gstRules}
                keyExtractor={(r, idx) => r._id || idx}
                emptyMessage="No GST rules configured."
              />

              {/* Add Rule Form */}
              <form onSubmit={handleAddGstRule} className="mt-4 pt-4 border-t border-[var(--border)] flex gap-3 items-end">
                <div className="flex-1">
                  <label className="block text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider mb-1">
                    Item Category
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. PRP Therapy, Scalp Biopsy"
                    value={newGstRule.itemType}
                    onChange={(e) => setNewGstRule({ ...newGstRule, itemType: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs bg-[var(--surface-2)] border border-[var(--border)] rounded text-[var(--text)]"
                  />
                </div>
                <div className="w-28">
                  <label className="block text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider mb-1">
                    GST Rate (%)
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    max={100}
                    value={newGstRule.gstRate}
                    onChange={(e) => setNewGstRule({ ...newGstRule, gstRate: parseFloat(e.target.value) || 0 })}
                    className="w-full px-2.5 py-1.5 text-xs bg-[var(--surface-2)] border border-[var(--border)] rounded text-[var(--text)] font-mono"
                  />
                </div>
                <button type="submit" className="btn-brass px-3 py-1.5 rounded text-xs font-mono flex items-center gap-1">
                  <Plus className="w-3.5 h-3.5" /> Add Rule
                </button>
              </form>
            </Panel>
          </div>
        )}

        {/* ================= CLINIC SETTINGS TAB ================= */}
        {activeTab === 'settings' && (
          !clinicSettings ? (
            <Panel title="Clinic Configuration" subtitle="Global branding and tax metadata">
              <div className="surface-card border border-[var(--border)] rounded-2xl p-12 text-center flex flex-col items-center justify-center space-y-3 my-2">
                <Settings className="w-10 h-10 text-[var(--text-dim)] animate-spin" />
                <h4 className="font-display font-semibold text-sm text-[var(--text)]">Loading Clinic Configuration...</h4>
                <p className="text-xs text-[var(--text-dim)] max-w-sm">Please wait while clinic metadata is retrieved or click below to reload.</p>
                <button
                  type="button"
                  onClick={fetchAdminData}
                  className="btn-brass px-3.5 py-1.5 rounded text-xs font-mono font-medium"
                >
                  Reload Settings
                </button>
              </div>
            </Panel>
          ) : (
            <div className="max-w-xl space-y-6">
            <Panel title="Clinic Identity & Invoicing Details" subtitle="Global branding and tax metadata">
              <form onSubmit={handleSaveClinicSettings} className="space-y-4">
                <div>
                  <label className="block text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider mb-1">
                    Clinic Brand Name
                  </label>
                  <input
                    type="text"
                    required
                    value={clinicSettings.clinicName}
                    onChange={(e) => setClinicSettings({ ...clinicSettings, clinicName: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-[var(--surface-2)] border border-[var(--border)] rounded text-[var(--text)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider mb-1">
                    Clinic Address
                  </label>
                  <textarea
                    rows={2}
                    value={clinicSettings.address || ''}
                    onChange={(e) => setClinicSettings({ ...clinicSettings, address: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-[var(--surface-2)] border border-[var(--border)] rounded text-[var(--text)]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider mb-1">
                      Helpline Phone
                    </label>
                    <input
                      type="text"
                      value={clinicSettings.phone || ''}
                      onChange={(e) => setClinicSettings({ ...clinicSettings, phone: e.target.value })}
                      className="w-full px-3 py-2 text-sm bg-[var(--surface-2)] border border-[var(--border)] rounded text-[var(--text)] font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider mb-1">
                      Official Email
                    </label>
                    <input
                      type="email"
                      value={clinicSettings.email || ''}
                      onChange={(e) => setClinicSettings({ ...clinicSettings, email: e.target.value })}
                      className="w-full px-3 py-2 text-sm bg-[var(--surface-2)] border border-[var(--border)] rounded text-[var(--text)] font-mono"
                      placeholder="clinic@dermatrack.com"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider mb-1">
                    GSTIN Identification
                  </label>
                  <input
                    type="text"
                    value={clinicSettings.gstNumber || ''}
                    onChange={(e) => setClinicSettings({ ...clinicSettings, gstNumber: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-[var(--surface-2)] border border-[var(--border)] rounded text-[var(--text)] font-mono font-bold text-[var(--brass)]"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider mb-1">
                      Slot Duration (Mins)
                    </label>
                    <input
                      type="number"
                      min={5}
                      max={120}
                      value={clinicSettings.appointmentDuration ?? 30}
                      onChange={(e) => setClinicSettings({ ...clinicSettings, appointmentDuration: parseInt(e.target.value) || 30 })}
                      className="w-full px-3 py-2 text-sm bg-[var(--surface-2)] border border-[var(--border)] rounded text-[var(--text)] font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider mb-1">
                      Opening Time
                    </label>
                    <input
                      type="time"
                      value={clinicSettings.workingHours?.start || '09:00'}
                      onChange={(e) => setClinicSettings({
                        ...clinicSettings,
                        workingHours: { start: e.target.value, end: clinicSettings.workingHours?.end || '18:00' }
                      })}
                      className="w-full px-3 py-2 text-sm bg-[var(--surface-2)] border border-[var(--border)] rounded text-[var(--text)] font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider mb-1">
                      Closing Time
                    </label>
                    <input
                      type="time"
                      value={clinicSettings.workingHours?.end || '18:00'}
                      onChange={(e) => setClinicSettings({
                        ...clinicSettings,
                        workingHours: { start: clinicSettings.workingHours?.start || '09:00', end: e.target.value }
                      })}
                      className="w-full px-3 py-2 text-sm bg-[var(--surface-2)] border border-[var(--border)] rounded text-[var(--text)] font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider mb-1">
                    Hospital 1st Visit Patient History Book Log &amp; Registration Fee (₹)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={clinicSettings.registrationFee ?? 200}
                    onChange={(e) => setClinicSettings({ ...clinicSettings, registrationFee: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 text-sm bg-[var(--surface-2)] border border-[var(--border)] rounded text-[var(--text)] font-mono font-bold text-[var(--brass)] focus:outline-none focus:border-[var(--brass)]"
                  />
                  <p className="text-[11px] text-[var(--text-dim)] mt-1">
                    Hospitality &amp; administrative fee charged once on patient&apos;s initial visit for clinical record file opening, patient history book log, and digital onboarding.
                  </p>
                </div>

                <button type="submit" className="btn-brass px-4 py-2 rounded text-xs font-mono font-bold flex items-center gap-1.5">
                  <Save className="w-3.5 h-3.5" /> Save Configuration
                </button>
              </form>
            </Panel>

            {/* WhatsApp Integration Card */}
            <WhatsAppIntegrationCard />
          </div>
          )
        )}

        {/* ================= AUDIT LOG TAB ================= */}
        {activeTab === 'audit' && (
          <Panel
            title="System Security & Mutation Audit Logs"
            subtitle="Permanent record of system actions and hospital operations"
          >
            {/* Filter Bar & Export */}
            <div className="mb-4 pb-4 border-b border-[var(--border)] flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
                {/* Search Bar */}
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-dim)]" />
                  <input
                    type="text"
                    placeholder="Search actions, names, descriptions, IPs..."
                    value={auditSearch}
                    onChange={(e) => setAuditSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-[var(--surface-2)] border border-[var(--border)] rounded text-[var(--text)] placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--brass)] font-sans"
                  />
                  {auditSearch && (
                    <button
                      onClick={() => setAuditSearch('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-[var(--text-dim)] hover:text-[var(--text)]"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Role Filter */}
                <div className="flex items-center gap-1.5">
                  <Filter className="w-3.5 h-3.5 text-[var(--text-dim)]" />
                  <select
                    value={auditRoleFilter}
                    onChange={(e) => setAuditRoleFilter(e.target.value)}
                    className="px-2.5 py-1.5 text-xs bg-[var(--surface-2)] border border-[var(--border)] rounded text-[var(--text)] font-sans"
                  >
                    <option value="all">All Roles</option>
                    <option value="Admin">Admin</option>
                    <option value="Doctor">Doctor</option>
                    <option value="Receptionist">Receptionist</option>
                    <option value="MedicationGiver">Medication Giver</option>
                    <option value="StockManager">Stock Manager</option>
                    <option value="System">System</option>
                  </select>
                </div>

                {/* Date Filter Buttons */}
                <div className="flex items-center gap-1 bg-[var(--surface-2)] p-0.5 rounded border border-[var(--border)]">
                  {(['all', 'today', 'week'] as const).map((filterOption) => (
                    <button
                      key={filterOption}
                      onClick={() => setAuditDateFilter(filterOption)}
                      className={`px-2 py-1 text-xs font-mono rounded transition-colors ${
                        auditDateFilter === filterOption
                          ? 'bg-[var(--brass)] text-black font-semibold shadow-xs'
                          : 'text-[var(--text-dim)] hover:text-[var(--text)]'
                      }`}
                    >
                      {filterOption === 'all' ? 'All Time' : filterOption === 'today' ? 'Today' : 'Last 7 Days'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Export to CSV */}
              <button
                onClick={exportAuditLogsToCsv}
                className="btn-surface px-3 py-1.5 rounded text-xs font-mono flex items-center gap-1.5 border border-[var(--border)] hover:border-[var(--brass)] text-[var(--text)] transition-colors shrink-0"
              >
                <Download className="w-3.5 h-3.5 text-[var(--brass)]" />
                <span>Export CSV</span>
              </button>
            </div>

            {/* Audit Log Table */}
            <DataTable
              columns={[
                {
                  header: 'TIMESTAMP',
                  className: 'whitespace-nowrap w-36',
                  accessor: (l) => (
                    <span className="font-mono text-xs text-[var(--text-dim)]">
                      {formatLogDateTime(l.createdAt)}
                    </span>
                  ),
                },
                {
                  header: 'ROLE',
                  className: 'whitespace-nowrap w-28',
                  accessor: (l) => <Badge variant="brass">{l.userRole || 'System'}</Badge>,
                },
                {
                  header: 'NAME',
                  className: 'whitespace-nowrap font-medium text-xs text-[var(--text)] max-w-[130px] truncate',
                  accessor: (l) => <span title={getActorName(l)}>{getActorName(l)}</span>,
                },
                {
                  header: 'ACTION DESCRIPTION',
                  className: 'text-xs text-[var(--text)] font-medium',
                  accessor: (l) => <span>{formatActivitySentence(l)}</span>,
                },
                {
                  header: 'IP ADDRESS',
                  className: 'whitespace-nowrap font-mono text-xs text-[var(--text-dim)] w-28',
                  accessor: (l) => <span>{l.ipAddress || '127.0.0.1'}</span>,
                },
              ]}
              data={filteredAuditLogs}
              keyExtractor={(l) => l._id}
              emptyMessage="No audit logs match your search and filter criteria."
            />

            {/* Summary Footer */}
            <div className="mt-3 pt-3 border-t border-[var(--border)] flex items-center justify-between text-xs font-mono text-[var(--text-dim)]">
              <span>Showing {filteredAuditLogs.length} of {auditLogs.length} total logged events</span>
              {(auditSearch || auditRoleFilter !== 'all' || auditDateFilter !== 'all') && (
                <button
                  onClick={() => {
                    setAuditSearch('');
                    setAuditRoleFilter('all');
                    setAuditDateFilter('all');
                  }}
                  className="text-[var(--brass)] hover:underline"
                >
                  Clear Filters
                </button>
              )}
            </div>
          </Panel>
        )}
      </div>

      {/* ================= INVOICE DETAIL MODAL ================= */}
      {selectedInvoice && (
        <InvoicePDFModal
          invoice={selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
          onPaymentSuccess={fetchAdminData}
          clinicInfo={{
            clinicName: clinicSettings?.clinicName,
            address: clinicSettings?.address,
            phone: clinicSettings?.phone,
            email: clinicSettings?.email,
            gstNumber: clinicSettings?.gstNumber,
          }}
        />
      )}

      {/* ================= CREATE STAFF MODAL ================= */}
      {showAddStaffModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md surface-card p-6 border border-[var(--border-light)] shadow-2xl space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-[var(--border)]">
              <h3 className="font-display font-bold text-base text-[var(--text)]">
                Create Staff Account
              </h3>
              <button
                onClick={() => setShowAddStaffModal(false)}
                className="text-[var(--text-dim)] hover:text-[var(--text)] font-mono text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateStaff} className="space-y-3">
              <div>
                <label className="block text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dr. Rajesh Varma"
                  value={newStaff.fullName}
                  onChange={(e) => setNewStaff({ ...newStaff, fullName: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-[var(--surface-2)] border border-[var(--border)] rounded text-[var(--text)]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider mb-1">
                    Username *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="dr.rajesh"
                    value={newStaff.username}
                    onChange={(e) => setNewStaff({ ...newStaff, username: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-[var(--surface-2)] border border-[var(--border)] rounded text-[var(--text)] font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider mb-1">
                    Initial Password *
                  </label>
                  <div className="relative">
                    <input
                      type={showStaffPassword ? 'text' : 'password'}
                      required
                      placeholder="••••••••"
                      value={newStaff.password}
                      onChange={(e) => setNewStaff({ ...newStaff, password: e.target.value })}
                      className="w-full pl-3 pr-10 py-2 text-sm bg-[var(--surface-2)] border border-[var(--border)] rounded text-[var(--text)] font-mono focus:outline-none focus:border-[var(--brass)]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowStaffPassword(!showStaffPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[var(--text-dim)] hover:text-[var(--brass)] transition-colors rounded focus:outline-none"
                      title={showStaffPassword ? 'Hide password' : 'Show password'}
                      aria-label={showStaffPassword ? 'Hide password' : 'Show password'}
                    >
                      {showStaffPassword ? (
                        <EyeOff className="w-4 h-4 text-[var(--brass)]" />
                      ) : (
                        <Eye className="w-4 h-4 hover:text-[var(--brass)]" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider mb-1">
                  Email Address (Optional)
                </label>
                <input
                  type="email"
                  placeholder="doctor@hospital.com"
                  value={newStaff.email}
                  onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-[var(--surface-2)] border border-[var(--border)] rounded text-[var(--text)] font-mono focus:outline-none focus:border-[var(--brass)]"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider mb-1">
                  Role Permission *
                </label>
                <select
                  value={newStaff.role}
                  onChange={(e) => setNewStaff({ ...newStaff, role: e.target.value as any })}
                  className="w-full px-3 py-2 text-xs bg-[var(--surface-2)] border border-[var(--border)] rounded text-[var(--text)]"
                >
                  <option value="Doctor">Doctor (Consulting Physician)</option>
                  <option value="Receptionist">Receptionist (Front Desk)</option>
                  <option value="MedicationGiver">Medication Giver (Pharmacist)</option>
                  <option value="StockManager">Stock Manager (Inventory)</option>
                  <option value="Admin">Administrator (Full Access)</option>
                </select>
              </div>

              {newStaff.role === 'Doctor' && (
                <>
                  <div>
                    <label className="block text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider mb-1">
                      Specialization
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Trichology & Dermatosurgery"
                      value={newStaff.specialization}
                      onChange={(e) => setNewStaff({ ...newStaff, specialization: e.target.value })}
                      className="w-full px-3 py-2 text-sm bg-[var(--surface-2)] border border-[var(--border)] rounded text-[var(--text)]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider mb-1">
                      Doctor Consultation Fee (₹) *
                    </label>
                    <input
                      type="number"
                      min={0}
                      required
                      value={newStaff.consultFee}
                      onChange={(e) => setNewStaff({ ...newStaff, consultFee: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 text-sm bg-[var(--surface-2)] border border-[var(--border)] rounded text-[var(--text)] font-mono focus:outline-none focus:border-[var(--brass)]"
                    />
                    <p className="text-[11px] text-[var(--text-dim)] mt-1.5 leading-relaxed">
                      The doctor&apos;s consultation fee is uniform for all visits. The 1st visit extra fee (+₹{clinicSettings?.registrationFee ?? 200}) is charged by the hospital for opening the case file and patient history book log.
                    </p>
                  </div>
                </>
              )}

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddStaffModal(false)}
                  className="flex-1 btn-surface py-2 rounded text-xs font-mono"
                >
                  Cancel
                </button>
                <button type="submit" className="flex-1 btn-brass py-2 rounded text-xs font-mono font-bold">
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= EDIT STAFF MODAL ================= */}
      {editingStaff && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md surface-card p-6 border border-[var(--border-light)] shadow-2xl space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-[var(--border)]">
              <h3 className="font-display font-bold text-base text-[var(--text)]">
                Edit Staff Account: {editingStaff.fullName}
              </h3>
              <button
                onClick={() => setEditingStaff(null)}
                className="text-[var(--text-dim)] hover:text-[var(--text)] font-mono text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateStaff} className="space-y-3">
              <div>
                <label className="block text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={editingStaff.fullName}
                  onChange={(e) => setEditingStaff({ ...editingStaff, fullName: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-[var(--surface-2)] border border-[var(--border)] rounded text-[var(--text)]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider mb-1">
                    Username
                  </label>
                  <input
                    type="text"
                    disabled
                    value={editingStaff.username}
                    className="w-full px-3 py-2 text-sm bg-[var(--surface-3)] opacity-60 border border-[var(--border)] rounded text-[var(--text)] font-mono cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider mb-1">
                    Role Permission *
                  </label>
                  <select
                    value={editingStaff.role}
                    onChange={(e) => setEditingStaff({ ...editingStaff, role: e.target.value as any })}
                    className="w-full px-3 py-2 text-xs bg-[var(--surface-2)] border border-[var(--border)] rounded text-[var(--text)]"
                  >
                    <option value="Doctor">Doctor</option>
                    <option value="Receptionist">Receptionist</option>
                    <option value="MedicationGiver">Medication Giver</option>
                    <option value="StockManager">Stock Manager</option>
                    <option value="Admin">Administrator</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={editingStaff.email || ''}
                  onChange={(e) => setEditingStaff({ ...editingStaff, email: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-[var(--surface-2)] border border-[var(--border)] rounded text-[var(--text)] font-mono"
                />
              </div>

              {editingStaff.role === 'Doctor' && (
                <>
                  <div>
                    <label className="block text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider mb-1">
                      Specialization
                    </label>
                    <input
                      type="text"
                      value={editingStaff.specialization || ''}
                      onChange={(e) => setEditingStaff({ ...editingStaff, specialization: e.target.value })}
                      className="w-full px-3 py-2 text-sm bg-[var(--surface-2)] border border-[var(--border)] rounded text-[var(--text)]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider mb-1">
                      Consultation Fee (₹)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={editingStaff.consultFee ?? 500}
                      onChange={(e) => setEditingStaff({ ...editingStaff, consultFee: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 text-sm bg-[var(--surface-2)] border border-[var(--border)] rounded text-[var(--text)] font-mono text-[var(--brass)]"
                    />
                  </div>
                </>
              )}

              <div className="pt-2 border-t border-[var(--border)]">
                <label className="block text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider mb-1">
                  Reset Password (Optional)
                </label>
                <input
                  type="password"
                  placeholder="Leave blank to keep current password"
                  value={editStaffPassword}
                  onChange={(e) => setEditStaffPassword(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-[var(--surface-2)] border border-[var(--border)] rounded text-[var(--text)] font-mono"
                />
                <p className="text-[11px] text-[var(--text-dim)] mt-1">Minimum 6 characters if setting a new password</p>
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingStaff(null)}
                  className="flex-1 btn-surface py-2 rounded text-xs font-mono"
                >
                  Cancel
                </button>
                <button type="submit" className="flex-1 btn-brass py-2 rounded text-xs font-mono font-bold">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= EDIT GST RULE MODAL ================= */}
      {editingGstRule && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm surface-card p-6 border border-[var(--border-light)] shadow-2xl space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-[var(--border)]">
              <h3 className="font-display font-bold text-base text-[var(--text)]">
                Edit GST Rate
              </h3>
              <button
                onClick={() => setEditingGstRule(null)}
                className="text-[var(--text-dim)] hover:text-[var(--text)] font-mono text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateGstRule} className="space-y-3">
              <div>
                <label className="block text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider mb-1">
                  Item Category / Type
                </label>
                <input
                  type="text"
                  required
                  value={editingGstRule.itemType}
                  onChange={(e) => setEditingGstRule({ ...editingGstRule, itemType: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-[var(--surface-2)] border border-[var(--border)] rounded text-[var(--text)]"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider mb-1">
                  GST Rate (%)
                </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  required
                  value={editingGstRule.gstRate}
                  onChange={(e) => setEditingGstRule({ ...editingGstRule, gstRate: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 text-sm bg-[var(--surface-2)] border border-[var(--border)] rounded text-[var(--text)] font-mono font-bold text-[var(--brass)]"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingGstRule(null)}
                  className="flex-1 btn-surface py-2 rounded text-xs font-mono"
                >
                  Cancel
                </button>
                <button type="submit" className="flex-1 btn-brass py-2 rounded text-xs font-mono font-bold">
                  Update Rate
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
