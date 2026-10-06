'use client';

import React from 'react';
import { KpiCard } from './KpiCard';
import { Panel } from './Panel';
import { Badge } from './Badge';
import { DataTable, Column } from './DataTable';
import { TrendingUp, QrCode, Zap, RefreshCw, Filter } from 'lucide-react';

export interface PharmacyPaymentRecord {
  _id: string;
  patientName?: string;
  amount: number;
  mode: 'static_qr' | 'dynamic_qr';
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  status: 'pending' | 'paid' | 'failed';
  notes?: string;
  recordedBy?: { name: string; role: string };
  paidAt?: string;
  createdAt: string;
}

export interface PaymentStats {
  totalRevenue: number;
  totalCount: number;
  staticQrRevenue: number;
  staticQrCount: number;
  dynamicQrRevenue: number;
  dynamicQrCount: number;
}

interface PaymentHistoryProps {
  records: PharmacyPaymentRecord[];
  stats: PaymentStats | null;
  loading: boolean;
  statsPeriod: 'today' | 'week' | 'month';
  onPeriodChange: (p: 'today' | 'week' | 'month') => void;
  modeFilter: '' | 'static_qr' | 'dynamic_qr';
  statusFilter: '' | 'pending' | 'paid' | 'failed';
  onModeFilter: (m: '' | 'static_qr' | 'dynamic_qr') => void;
  onStatusFilter: (s: '' | 'pending' | 'paid' | 'failed') => void;
  onRefresh: () => void;
  staticEnabled: boolean;
  dynamicEnabled: boolean;
}

function ModeBadge({ mode }: { mode: 'static_qr' | 'dynamic_qr' }) {
  if (mode === 'static_qr') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono font-bold bg-blue-500/12 text-blue-500 border border-blue-500/25">
        <QrCode className="w-3 h-3" />
        Static QR
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono font-bold bg-violet-500/12 text-violet-500 border border-violet-500/25">
      <Zap className="w-3 h-3" />
      Dynamic QR
    </span>
  );
}

function StatusChip({ status }: { status: 'pending' | 'paid' | 'failed' }) {
  if (status === 'paid') return <Badge variant="success" size="sm">✓ Paid</Badge>;
  if (status === 'failed') return <Badge variant="error" size="sm">✗ Failed</Badge>;
  return <Badge variant="warn" size="sm">⏳ Pending</Badge>;
}

export function PaymentHistory({
  records,
  stats,
  loading,
  statsPeriod,
  onPeriodChange,
  modeFilter,
  statusFilter,
  onModeFilter,
  onStatusFilter,
  onRefresh,
  staticEnabled,
  dynamicEnabled,
}: PaymentHistoryProps) {
  const columns: Column<PharmacyPaymentRecord>[] = [
    {
      header: 'DATE / TIME',
      headerClassName: 'w-[160px]',
      className: 'w-[160px] whitespace-nowrap',
      accessor: (r) => (
        <span className="font-mono text-xs text-[var(--text-dim)]">
          {new Date(r.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
          {' • '}
          {new Date(r.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      ),
    },
    {
      header: 'PATIENT',
      accessor: (r) => (
        <span className="text-xs font-semibold text-[var(--text)]">
          {r.patientName || '—'}
        </span>
      ),
    },
    {
      header: 'AMOUNT',
      headerClassName: 'w-[110px]',
      className: 'w-[110px]',
      accessor: (r) => (
        <span className="font-mono font-bold text-sm text-[var(--text)]">
          ₹{r.amount.toLocaleString()}
        </span>
      ),
    },
    {
      header: 'TYPE',
      headerClassName: 'w-[130px]',
      className: 'w-[130px]',
      accessor: (r) => <ModeBadge mode={r.mode} />,
    },
    {
      header: 'STATUS',
      headerClassName: 'w-[110px]',
      className: 'w-[110px]',
      accessor: (r) => <StatusChip status={r.status} />,
    },
    {
      header: 'REF ID',
      headerClassName: 'w-[160px]',
      className: 'w-[160px]',
      accessor: (r) => r.razorpayPaymentId ? (
        <span className="font-mono text-[10px] text-[var(--text-dim)] truncate block max-w-[140px]" title={r.razorpayPaymentId}>
          {r.razorpayPaymentId}
        </span>
      ) : (
        <span className="text-[var(--text-dim)] text-xs">—</span>
      ),
    },
    {
      header: 'BY',
      headerClassName: 'w-[120px]',
      className: 'w-[120px]',
      accessor: (r) => (
        <span className="font-mono text-xs text-[var(--text-dim)]">
          {(r.recordedBy as any)?.name || '—'}
        </span>
      ),
    },
  ];

  const bothEnabled = staticEnabled && dynamicEnabled;

  return (
    <div className="space-y-5">
      {/* ── KPI Cards ── */}
      <div className={`grid gap-4 ${bothEnabled ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2'}`}>
        <KpiCard
          label="Total Revenue"
          value={`₹${(stats?.totalRevenue || 0).toLocaleString()}`}
          delta={`${stats?.totalCount || 0} transactions`}
          deltaType="positive"
          icon={<TrendingUp className="w-5 h-5" />}
        />
        {staticEnabled && (
          <KpiCard
            label="Static QR Revenue"
            value={`₹${(stats?.staticQrRevenue || 0).toLocaleString()}`}
            delta={`${stats?.staticQrCount || 0} payments`}
            deltaType="neutral"
            icon={<QrCode className="w-5 h-5" />}
          />
        )}
        {dynamicEnabled && (
          <KpiCard
            label="Dynamic QR Revenue"
            value={`₹${(stats?.dynamicQrRevenue || 0).toLocaleString()}`}
            delta={`${stats?.dynamicQrCount || 0} payments`}
            deltaType="neutral"
            icon={<Zap className="w-5 h-5" />}
          />
        )}
      </div>

      {/* ── Period Picker + Filters ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[var(--surface)] p-2 rounded-xl border border-[var(--border)] shadow-xs">
        {/* Period Selector */}
        <div className="flex items-center bg-[var(--surface-2)] p-1 rounded-lg border border-[var(--border)]">
          {(['today', 'week', 'month'] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onPeriodChange(p)}
              className={`px-3 py-1.5 rounded-md text-xs font-mono font-medium transition-all ${
                statsPeriod === p
                  ? 'bg-[var(--brass)] text-[var(--bg)] shadow-sm font-bold'
                  : 'text-[var(--text-dim)] hover:text-[var(--text)]'
              }`}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>

        {/* Filter Chips */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-mono text-[var(--text-dim)] flex items-center gap-1">
            <Filter className="w-3 h-3" /> Filter:
          </span>

          {/* Mode Filter */}
          <div className="flex items-center bg-[var(--surface-2)] p-0.5 rounded-lg border border-[var(--border)]">
            {[
              { v: '' as const, label: 'All' },
              { v: 'static_qr' as const, label: '🟦 Static QR' },
              { v: 'dynamic_qr' as const, label: '🟣 Dynamic QR' },
            ].map(({ v, label }) => (
              <button
                key={v || 'all-mode'}
                type="button"
                onClick={() => onModeFilter(v)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-mono font-medium transition-all ${
                  modeFilter === v
                    ? 'bg-[var(--brass)] text-[var(--bg)] shadow-xs font-bold'
                    : 'text-[var(--text-dim)] hover:text-[var(--text)]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Status Filter */}
          <div className="flex items-center bg-[var(--surface-2)] p-0.5 rounded-lg border border-[var(--border)]">
            {[
              { v: '' as const, label: 'All Status' },
              { v: 'paid' as const, label: '✅ Paid' },
              { v: 'pending' as const, label: '⏳ Pending' },
              { v: 'failed' as const, label: '✗ Failed' },
            ].map(({ v, label }) => (
              <button
                key={v || 'all-status'}
                type="button"
                onClick={() => onStatusFilter(v)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-mono font-medium transition-all ${
                  statusFilter === v
                    ? 'bg-[var(--brass)] text-[var(--bg)] shadow-xs font-bold'
                    : 'text-[var(--text-dim)] hover:text-[var(--text)]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onRefresh}
            title="Refresh"
            className="p-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-dim)] hover:text-[var(--text)] transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[var(--brass)]' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── Table ── */}
      <Panel
        title="Payment History"
        subtitle="All pharmacy QR payment transactions with type badges"
      >
        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-[var(--brass)]" />
            <span className="font-mono text-xs text-[var(--text-dim)]">Loading payments...</span>
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={records}
            keyExtractor={(r) => r._id}
            emptyMessage="No payment records found. Try adjusting the filters or period."
          />
        )}
      </Panel>
    </div>
  );
}
