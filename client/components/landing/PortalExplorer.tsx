'use client';

import React, { useState } from 'react';
import {
  Stethoscope, ClipboardList, ShieldCheck, Pill, Package, Smartphone,
  Activity, Camera, QrCode, CreditCard, Bell, Users, BarChart3,
  FileText, Lock, Layers, CalendarDays, Receipt,
} from 'lucide-react';

const ROLES = [
  {
    id: 'doctor',
    label: 'Doctor Suite',
    icon: Stethoscope,
    emoji: '🩺',
    color: '#C98A4B',
    features: [
      'Norwood alopecia grading with interactive scale picker',
      'Folli-density meter for precise scalp analysis',
      'Dual workflow: digital e-prescription or booklet scanning',
      'Scalp photo gallery with before/after comparison',
      'QR-based wireless mobile camera pairing',
      'Real-time patient queue with WebSocket sync',
    ],
    previewItems: [
      { icon: Activity, label: 'Norwood Scale', value: 'Grade III' },
      { icon: Camera, label: 'Scalp Photos', value: '12 captured' },
      { icon: FileText, label: 'Prescriptions', value: '3 active' },
    ],
  },
  {
    id: 'reception',
    label: 'Reception Desk',
    icon: ClipboardList,
    emoji: '🛎️',
    color: '#5B9BB8',
    features: [
      'Real-time queue tickets & token callout system',
      'Appointment diary with calendar management',
      'Mandatory DOB & vitals intake (Height, Weight, BMI)',
      'Dynamic UPI QR modal for instant payments',
      'Rapid digital patient registration',
      'Consultation fee collection (UPI/Cash)',
    ],
    previewItems: [
      { icon: Users, label: 'Queue', value: '8 waiting' },
      { icon: CalendarDays, label: 'Appointments', value: '14 today' },
      { icon: CreditCard, label: 'Collections', value: '₹12,400' },
    ],
  },
  {
    id: 'admin',
    label: 'Hospital Admin',
    icon: ShieldCheck,
    emoji: '👑',
    color: '#D0A24C',
    features: [
      'Multi-branch analytics & revenue dashboards',
      'Staff roster & role-based permissions management',
      'Revenue breakdown by department & service type',
      'GST tax slab configuration (18% procedures, 5% meds)',
      'System audit trail with operator tracking',
      'Hospital settings & branding management',
    ],
    previewItems: [
      { icon: BarChart3, label: 'Revenue', value: '₹2.4L' },
      { icon: Users, label: 'Staff', value: '12 active' },
      { icon: Lock, label: 'Audit Logs', value: '847 entries' },
    ],
  },
  {
    id: 'pharmacy',
    label: 'Pharmacy Station',
    icon: Pill,
    emoji: '💊',
    color: '#5FAE7C',
    features: [
      'Live prescription fulfillment queue from consultations',
      'Batch-level allocation with FIFO/FEFO logic',
      'Medicine instructions & dosage labeling',
      'Stock check warnings before dispensing',
      'Automatic stock deduction on dispense',
      'Prescription history & audit trail',
    ],
    previewItems: [
      { icon: FileText, label: 'Pending Rx', value: '5 queued' },
      { icon: Package, label: 'Stock Items', value: '234 SKUs' },
      { icon: Bell, label: 'Low Stock', value: '3 alerts' },
    ],
  },
  {
    id: 'stock',
    label: 'Stock Manager',
    icon: Package,
    emoji: '📦',
    color: '#C9614B',
    features: [
      'Batch management with purchase & expiry tracking',
      'Purchase vs selling price margin calculation',
      'Shelf expiry tracker with near-expiry alerts',
      'Reorder alerts with configurable thresholds',
      'Inventory audit trail & usage analytics',
      'GST-compliant stock categorization',
    ],
    previewItems: [
      { icon: Layers, label: 'Batches', value: '89 active' },
      { icon: Bell, label: 'Expiring', value: '7 batches' },
      { icon: Receipt, label: 'Value', value: '₹4.8L' },
    ],
  },
  {
    id: 'patient',
    label: 'Patient Portal',
    icon: Smartphone,
    emoji: '📱',
    color: '#5B9BB8',
    features: [
      'Passwordless phone OTP authentication (SMS + WhatsApp)',
      'Treatment timeline & visit history',
      'View e-prescriptions & medication details',
      'Razorpay invoice payments online',
      'Scalp photo history with progress tracking',
      'Appointment booking & token status',
    ],
    previewItems: [
      { icon: CalendarDays, label: 'Visits', value: '6 recorded' },
      { icon: Camera, label: 'Photos', value: '18 images' },
      { icon: CreditCard, label: 'Invoices', value: '₹8,200' },
    ],
  },
];

export default function PortalExplorer() {
  const [activeRole, setActiveRole] = useState(0);
  const role = ROLES[activeRole];

  return (
    <section className="portal-section" id="features">
      <div className="portal-section__container">
        <div className="portal-section__header">
          <span className="portal-section__eyebrow">Role-Based Portal Explorer</span>
          <h2 className="portal-section__title">
            Six Dedicated Workspaces, <span className="text-[var(--brass)]">One Unified Platform</span>
          </h2>
          <p className="portal-section__subtitle">
            Each role has its own specialized interface built for maximum efficiency and clinical accuracy.
          </p>
        </div>

        {/* Role Tabs */}
        <div className="portal-section__tabs">
          {ROLES.map((r, idx) => (
            <button
              key={r.id}
              onClick={() => setActiveRole(idx)}
              className={`portal-section__tab ${activeRole === idx ? 'portal-section__tab--active' : ''}`}
              style={{ '--tab-color': r.color } as React.CSSProperties}
            >
              <span className="portal-section__tab-emoji">{r.emoji}</span>
              <span className="portal-section__tab-label">{r.label}</span>
            </button>
          ))}
        </div>

        {/* Active Role Content */}
        <div className="portal-section__content" key={role.id}>
          <div className="portal-section__features">
            <div className="portal-section__features-header">
              <div className="portal-section__features-icon" style={{ color: role.color, borderColor: role.color }}>
                <role.icon className="w-6 h-6" />
              </div>
              <div>
                <h3 className="portal-section__features-title">{role.emoji} {role.label}</h3>
                <span className="portal-section__features-subtitle">Key Capabilities</span>
              </div>
            </div>
            <ul className="portal-section__feature-list">
              {role.features.map((feature, i) => (
                <li key={i} className="portal-section__feature-item">
                  <div className="portal-section__feature-check" style={{ color: role.color }}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
                      <path d="M5 8L7 10L11 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Preview Panel */}
          <div className="portal-section__preview">
            <div className="portal-section__preview-card">
              <div className="portal-section__preview-toolbar">
                <div className="portal-section__preview-dots">
                  <span /><span /><span />
                </div>
                <span className="portal-section__preview-title">{role.label} Dashboard</span>
              </div>
              <div className="portal-section__preview-body">
                {role.previewItems.map((item, i) => (
                  <div key={i} className="portal-section__preview-stat" style={{ '--stat-color': role.color } as React.CSSProperties}>
                    <div className="portal-section__preview-stat-icon">
                      <item.icon className="w-5 h-5" />
                    </div>
                    <div className="portal-section__preview-stat-info">
                      <span className="portal-section__preview-stat-value">{item.value}</span>
                      <span className="portal-section__preview-stat-label">{item.label}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
