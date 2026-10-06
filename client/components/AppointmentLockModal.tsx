'use client';

import React from 'react';
import { Lock, Phone, X, AlertTriangle, Clock } from 'lucide-react';

interface AppointmentLockModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointmentDate?: Date | string;
  patientName?: string;
  doctorName?: string;
  hospitalPhone?: string;
  role?: 'doctor' | 'patient';
}

export function AppointmentLockModal({
  isOpen,
  onClose,
  appointmentDate,
  patientName,
  doctorName,
  hospitalPhone = '+91 98765 43210',
  role = 'doctor',
}: AppointmentLockModalProps) {
  if (!isOpen) return null;

  const formattedDate = appointmentDate
    ? new Date(appointmentDate).toLocaleDateString([], {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }) +
      ' at ' +
      new Date(appointmentDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : 'Scheduled Time';

  const cleanPhone = hospitalPhone.replace(/[^0-9+]/g, '');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn select-none">
      <div className="relative w-full max-w-md rounded-2xl bg-[var(--surface-1,theme(colors.slate.900))] border-2 border-amber-500/40 shadow-2xl overflow-hidden text-center p-6 space-y-5">
        {/* Close Icon */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-[var(--text-dim,theme(colors.slate.400))] hover:text-[var(--text,theme(colors.white))] hover:bg-[var(--surface-2,theme(colors.slate.800))] transition-colors"
          title="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Lock Icon Badge */}
        <div className="w-16 h-16 mx-auto rounded-3xl bg-amber-500/15 border border-amber-500/30 text-amber-500 flex items-center justify-center shadow-lg shadow-amber-500/10">
          <Lock className="w-8 h-8" />
        </div>

        {/* Title */}
        <div>
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-400 border border-amber-500/30 mb-2">
            <Clock className="w-3 h-3" /> 24-Hour Policy Lockdown
          </span>
          <h2 className="text-lg font-bold text-[var(--text,theme(colors.white))]">
            Appointment Locked
          </h2>
          <p className="text-xs text-[var(--text-dim,theme(colors.slate.400))] mt-1">
            Slot: <strong className="text-[var(--text,theme(colors.slate-200))]">{formattedDate}</strong>
          </p>
        </div>

        {/* Policy Explanation Message */}
        <div className="p-4 rounded-xl bg-[var(--surface-2,theme(colors.slate.800/80))] border border-[var(--border,theme(colors.slate-700/60))] text-left text-xs space-y-2 leading-relaxed">
          <div className="flex items-start gap-2 text-amber-300 font-semibold">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
            <span>Modification deadline passed</span>
          </div>
          <p className="text-[var(--text-dim,theme(colors.slate-300))] text-[11.5px]">
            This appointment is scheduled within the next <strong>24 hours</strong>. Online cancellations and rescheduling are locked to prevent scheduling conflicts, physician roster disruption, and technical glitches.
          </p>
          <p className="text-[var(--text-dim,theme(colors.slate-400))] text-[11px] border-t border-[var(--border,theme(colors.slate-700/50))] pt-2">
            {role === 'doctor'
              ? 'Only the hospital receptionist desk has authorization to override and make adjustments within the 24-hour window.'
              : 'Patients cannot cancel or edit online within 24 hours of the appointment. The hospital receptionist can assist you directly.'}
          </p>
        </div>

        {/* Immediate Contact Desk Action */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-[var(--text,theme(colors.slate-300))]">
            Need an urgent change or immediate cancellation?
          </p>
          <a
            href={`tel:${cleanPhone}`}
            className="w-full py-3 px-4 rounded-xl font-bold text-sm bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white shadow-lg shadow-teal-500/20 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
          >
            <Phone className="w-4 h-4" />
            <span>Call Receptionist Desk: {hospitalPhone}</span>
          </a>
        </div>

        {/* Dismiss Button */}
        <button
          onClick={onClose}
          type="button"
          className="w-full py-2.5 rounded-xl font-semibold text-xs text-[var(--text-dim,theme(colors.slate-400))] hover:text-[var(--text,theme(colors.white))] bg-[var(--surface-2,theme(colors.slate.800))] hover:bg-[var(--surface-3,theme(colors.slate-700))] border border-[var(--border,theme(colors.slate-700))] transition-colors"
        >
          Understood
        </button>
      </div>
    </div>
  );
}