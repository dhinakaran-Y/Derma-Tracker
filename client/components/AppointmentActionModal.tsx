'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  AlertTriangle,
  Calendar,
  Clock,
  User as UserIcon,
  Video,
  Building,
  Check,
  Loader2,
  CalendarClock,
  Sparkles,
} from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';

interface DoctorOption {
  _id: string;
  fullName: string;
  specialization?: string;
}

interface AppointmentActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointment: any;
  actionType: 'cancel' | 'reschedule';
  userRole: 'doctor' | 'patient';
  doctors?: DoctorOption[];
  onSuccess: () => void;
  onLockedTrigger?: () => void;
  hospitalPhone?: string;
}

// Standard daily clinic slots
const STANDARD_SLOTS = [
  '09:30', '10:00', '10:30', '11:00', '11:30',
  '12:00', '14:00', '14:30', '15:00', '15:30',
  '16:00', '16:30', '17:00',
];

export function AppointmentActionModal({
  isOpen,
  onClose,
  appointment,
  actionType,
  userRole,
  doctors = [],
  onSuccess,
  onLockedTrigger,
  hospitalPhone = '+91 98765 43210',
}: AppointmentActionModalProps) {
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState('');

  // Reschedule state
  const [postponeWithoutDate, setPostponeWithoutDate] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedSlot, setSelectedSlot] = useState('');
  const [bookedSlots, setBookedSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Patient editable options
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [selectedMode, setSelectedMode] = useState<'Offline' | 'Online'>('Offline');
  const [selectedType, setSelectedType] = useState<'Consult' | 'Surgery'>('Consult');

  // Initialize values when modal opens or appointment changes
  useEffect(() => {
    if (!isOpen || !appointment) return;

    setReason('');
    setPostponeWithoutDate(false);

    // Initial doctor
    const currentDocId =
      typeof appointment.doctorId === 'object'
        ? appointment.doctorId?._id
        : appointment.doctorId;
    setSelectedDoctorId(currentDocId || '');

    // Initial mode & type
    setSelectedMode(appointment.mode || 'Offline');
    setSelectedType(appointment.type || 'Consult');

    // Initial date (default to tomorrow's date if upcoming date is soon)
    const d = new Date();
    d.setDate(d.getDate() + 1);
    const tomorrowStr = d.toISOString().split('T')[0];
    setSelectedDate(tomorrowStr);
    setSelectedSlot('');
  }, [isOpen, appointment]);

  // Fetch slots whenever selectedDate or selectedDoctorId changes
  useEffect(() => {
    if (!isOpen || actionType !== 'reschedule' || postponeWithoutDate) return;
    if (!selectedDoctorId || !selectedDate) return;

    let isMounted = true;
    setLoadingSlots(true);

    const apptId = appointment?._id || '';
    api
      .get(`/appointments/slots/${selectedDoctorId}/${selectedDate}?excludeApptId=${apptId}`)
      .then((res) => {
        if (!isMounted) return;
        const booked = res.data?.data?.bookedSlots || [];
        // Extract "HH:MM" in local timezone
        const bookedTimes = booked.map((iso: string) => {
          const dateObj = new Date(iso);
          return dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
        });
        setBookedSlots(bookedTimes);
      })
      .catch((err) => {
        console.error('Failed to fetch slots:', err);
      })
      .finally(() => {
        if (isMounted) setLoadingSlots(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, actionType, postponeWithoutDate, selectedDoctorId, selectedDate, appointment]);

  if (!isOpen || !appointment) return null;

  const patientName =
    typeof appointment.patientId === 'object'
      ? appointment.patientId?.name
      : 'Patient';
  const doctorName =
    typeof appointment.doctorId === 'object'
      ? appointment.doctorId?.fullName
      : 'Doctor';

  const scheduledDateFormatted = appointment.scheduledAt
    ? new Date(appointment.scheduledAt).toLocaleDateString([], {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }) +
      ' at ' +
      new Date(appointment.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : 'Not Scheduled';

  // Tomorrow min date for picker
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDateStr = tomorrow.toISOString().split('T')[0];

  const handleCancelSubmit = async () => {
    try {
      setLoading(true);
      await api.patch(`/appointments/${appointment._id}/status`, {
        status: 'Cancelled',
        cancellationReason: reason.trim() || undefined,
      });
      toast.success('Appointment cancelled successfully');
      onSuccess();
      onClose();
    } catch (err: any) {
      if (err.response?.data?.code === 'APPOINTMENT_LOCKED_24H') {
        onClose();
        if (onLockedTrigger) onLockedTrigger();
        return;
      }
      toast.error(err.response?.data?.message || 'Failed to cancel appointment');
    } finally {
      setLoading(false);
    }
  };

  const handleRescheduleSubmit = async () => {
    try {
      setLoading(true);

      // 1. Postpone without date (Doctor only feature)
      if (postponeWithoutDate) {
        await api.patch(`/appointments/${appointment._id}/status`, {
          status: 'Postponed',
          postponedWithoutDate: true,
          postponedReason: reason.trim() || undefined,
        });
        toast.success('Appointment postponed. Time will be scheduled later.');
        onSuccess();
        onClose();
        return;
      }

      // 2. Pick new date & slot
      if (!selectedDate) {
        toast.error('Please pick a new date');
        return;
      }
      if (!selectedSlot) {
        toast.error('Please select an available time slot');
        return;
      }

      const [hours, minutes] = selectedSlot.split(':').map(Number);
      const newScheduledDate = new Date(`${selectedDate}T00:00:00`);
      newScheduledDate.setHours(hours, minutes, 0, 0);

      const payload: any = {
        scheduledAt: newScheduledDate.toISOString(),
        rescheduleReason: reason.trim() || undefined,
      };

      if (userRole === 'patient') {
        if (selectedDoctorId) payload.doctorId = selectedDoctorId;
        payload.mode = selectedMode;
        payload.type = selectedType;
      }

      await api.patch(`/appointments/${appointment._id}`, payload);
      toast.success('Appointment rescheduled successfully');
      onSuccess();
      onClose();
    } catch (err: any) {
      if (err.response?.data?.code === 'APPOINTMENT_LOCKED_24H') {
        onClose();
        if (onLockedTrigger) onLockedTrigger();
        return;
      }
      toast.error(err.response?.data?.message || 'Failed to reschedule appointment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-lg rounded-2xl bg-[var(--surface-1,theme(colors.slate.900))] border border-[var(--border,theme(colors.slate-700))] shadow-2xl overflow-hidden text-left p-6 space-y-5 max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-[var(--text-dim,theme(colors.slate.400))] hover:text-[var(--text,theme(colors.white))] hover:bg-[var(--surface-2,theme(colors.slate.800))] transition-colors"
          title="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              actionType === 'cancel'
                ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                : 'bg-teal-500/15 text-teal-400 border border-teal-500/30'
            }`}
          >
            {actionType === 'cancel' ? (
              <AlertTriangle className="w-5 h-5" />
            ) : (
              <CalendarClock className="w-5 h-5" />
            )}
          </div>
          <div>
            <h2 className="text-lg font-bold text-[var(--text,theme(colors.white))]">
              {actionType === 'cancel'
                ? 'Cancel Appointment'
                : userRole === 'doctor'
                ? 'Reschedule / Postpone Appointment'
                : 'Reschedule Appointment'}
            </h2>
            <p className="text-xs text-[var(--text-dim,theme(colors.slate.400))]">
              {userRole === 'doctor' ? `Patient: ${patientName}` : `Doctor: ${doctorName}`}
            </p>
          </div>
        </div>

        {/* Current Appointment Summary Card */}
        <div className="p-3.5 rounded-xl bg-[var(--surface-2,theme(colors.slate.800/60))] border border-[var(--border,theme(colors.slate-700/50))] space-y-2 text-xs">
          <div className="flex items-center justify-between text-[var(--text-dim,theme(colors.slate-400))]">
            <span>Currently Scheduled</span>
            <span className="font-semibold text-[var(--text,theme(colors.slate-200))]">
              {scheduledDateFormatted}
            </span>
          </div>
          <div className="flex items-center justify-between text-[var(--text-dim,theme(colors.slate-400))]">
            <span>Type & Mode</span>
            <span className="font-mono text-[11px] text-[var(--text,theme(colors.slate-300))]">
              {appointment.type} • {appointment.mode}
            </span>
          </div>
        </div>

        {/* ================= CANCEL MODE ================= */}
        {actionType === 'cancel' && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[var(--text,theme(colors.slate-300))] mb-1.5">
                Reason for cancellation <span className="text-[var(--text-dim,theme(colors.slate-500))] font-normal">(optional)</span>
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Schedule conflict, feeling unwell, or personal emergency..."
                rows={3}
                className="w-full p-3 rounded-xl bg-[var(--surface-2,theme(colors.slate-800))] border border-[var(--border,theme(colors.slate-700))] text-xs text-[var(--text,theme(colors.white))] placeholder:text-[var(--text-dim,theme(colors.slate-500))] focus:outline-none focus:border-red-500/50 resize-none"
              />
            </div>

            <p className="text-[11.5px] text-[var(--text-dim,theme(colors.slate-400))] leading-relaxed">
              This appointment will be marked as <strong>Cancelled</strong>. The{' '}
              {userRole === 'doctor' ? 'patient' : 'doctor'} will receive an immediate notification with your reason.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-[var(--text-dim,theme(colors.slate-400))] hover:text-[var(--text,theme(colors.white))] bg-[var(--surface-2,theme(colors.slate-800))] border border-[var(--border,theme(colors.slate-700))]"
              >
                Keep Appointment
              </button>
              <button
                type="button"
                onClick={handleCancelSubmit}
                disabled={loading}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-500 shadow-lg shadow-red-600/20 flex items-center gap-1.5 transition-all active:scale-[0.98] disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                <span>Confirm Cancel</span>
              </button>
            </div>
          </div>
        )}

        {/* ================= RESCHEDULE MODE ================= */}
        {actionType === 'reschedule' && (
          <div className="space-y-4">
            {/* Doctor-only Postpone toggle */}
            {userRole === 'doctor' && (
              <div className="p-3 rounded-xl bg-[var(--surface-2,theme(colors.slate-800/80))] border border-[var(--border,theme(colors.slate-700))] flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-[var(--text,theme(colors.white))]">
                    Time will be scheduled later
                  </h4>
                  <p className="text-[11px] text-[var(--text-dim,theme(colors.slate-400))]">
                    Postpone without setting a date now. You or the patient can pick a slot later.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPostponeWithoutDate(!postponeWithoutDate)}
                  className={`w-11 h-6 rounded-full transition-colors relative flex items-center p-0.5 ${
                    postponeWithoutDate ? 'bg-amber-500' : 'bg-[var(--surface-3,theme(colors.slate-700))]'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white transition-transform ${
                      postponeWithoutDate ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            )}

            {/* If Not postponed without date, show Date & Slot selectors */}
            {!postponeWithoutDate && (
              <>
                {/* Patient customizable options (Doctor, Mode, Type) */}
                {userRole === 'patient' && (
                  <div className="space-y-3 p-3 rounded-xl bg-[var(--surface-2,theme(colors.slate-800/50))] border border-[var(--border,theme(colors.slate-700/50))]">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--brass,theme(colors.teal.400))] flex items-center gap-1">
                      <Sparkles className="w-3 h-3" /> Consultation Preferences
                    </span>

                    {/* Preferred Doctor */}
                    {doctors.length > 0 && (
                      <div>
                        <label className="block text-[11px] font-semibold text-[var(--text-dim,theme(colors.slate-400))] mb-1">
                          Preferred Doctor
                        </label>
                        <select
                          value={selectedDoctorId}
                          onChange={(e) => setSelectedDoctorId(e.target.value)}
                          className="w-full p-2.5 rounded-lg bg-[var(--surface-1,theme(colors.slate-900))] border border-[var(--border,theme(colors.slate-700))] text-xs text-[var(--text,theme(colors.white))] focus:outline-none"
                        >
                          {doctors.map((doc) => (
                            <option key={doc._id} value={doc._id}>
                              {doc.fullName} {doc.specialization ? `(${doc.specialization})` : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                      {/* Mode */}
                      <div>
                        <label className="block text-[11px] font-semibold text-[var(--text-dim,theme(colors.slate-400))] mb-1">
                          Consultation Mode
                        </label>
                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedMode('Offline')}
                            className={`py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-colors border ${
                              selectedMode === 'Offline'
                                ? 'bg-teal-500/20 text-teal-300 border-teal-500/40'
                                : 'bg-[var(--surface-1,theme(colors.slate-900))] text-[var(--text-dim,theme(colors.slate-400))] border-[var(--border,theme(colors.slate-700))]'
                            }`}
                          >
                            <Building className="w-3 h-3" /> In-Clinic
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedMode('Online')}
                            className={`py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-colors border ${
                              selectedMode === 'Online'
                                ? 'bg-teal-500/20 text-teal-300 border-teal-500/40'
                                : 'bg-[var(--surface-1,theme(colors.slate-900))] text-[var(--text-dim,theme(colors.slate-400))] border-[var(--border,theme(colors.slate-700))]'
                            }`}
                          >
                            <Video className="w-3 h-3" /> Online
                          </button>
                        </div>
                      </div>

                      {/* Type */}
                      <div>
                        <label className="block text-[11px] font-semibold text-[var(--text-dim,theme(colors.slate-400))] mb-1">
                          Session Type
                        </label>
                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedType('Consult')}
                            className={`py-1.5 px-2 rounded-lg text-xs font-semibold transition-colors border ${
                              selectedType === 'Consult'
                                ? 'bg-teal-500/20 text-teal-300 border-teal-500/40'
                                : 'bg-[var(--surface-1,theme(colors.slate-900))] text-[var(--text-dim,theme(colors.slate-400))] border-[var(--border,theme(colors.slate-700))]'
                            }`}
                          >
                            Consult
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedType('Surgery')}
                            className={`py-1.5 px-2 rounded-lg text-xs font-semibold transition-colors border ${
                              selectedType === 'Surgery'
                                ? 'bg-teal-500/20 text-teal-300 border-teal-500/40'
                                : 'bg-[var(--surface-1,theme(colors.slate-900))] text-[var(--text-dim,theme(colors.slate-400))] border-[var(--border,theme(colors.slate-700))]'
                            }`}
                          >
                            Surgery
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Date Picker */}
                <div>
                  <label className="block text-xs font-semibold text-[var(--text,theme(colors.slate-300))] mb-1.5">
                    Select New Date
                  </label>
                  <input
                    type="date"
                    min={minDateStr}
                    value={selectedDate}
                    onChange={(e) => {
                      setSelectedDate(e.target.value);
                      setSelectedSlot('');
                    }}
                    className="w-full p-2.5 rounded-xl bg-[var(--surface-2,theme(colors.slate-800))] border border-[var(--border,theme(colors.slate-700))] text-xs text-[var(--text,theme(colors.white))] focus:outline-none focus:border-teal-500/50"
                  />
                </div>

                {/* Slot Selector */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-[var(--text,theme(colors.slate-300))]">
                      Select Time Slot
                    </label>
                    {loadingSlots && (
                      <span className="text-[11px] text-teal-400 flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" /> checking availability...
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 max-h-36 overflow-y-auto p-1">
                    {STANDARD_SLOTS.map((slot) => {
                      const isBooked = bookedSlots.includes(slot);
                      const isSelected = selectedSlot === slot;

                      return (
                        <button
                          key={slot}
                          type="button"
                          disabled={isBooked}
                          onClick={() => setSelectedSlot(slot)}
                          className={`py-2 px-1.5 rounded-lg text-xs font-mono font-semibold transition-all border ${
                            isSelected
                              ? 'bg-teal-600 text-white border-teal-500 shadow-md shadow-teal-500/20'
                              : isBooked
                              ? 'bg-[var(--surface-2,theme(colors.slate-800/40))] text-[var(--text-dim,theme(colors.slate-600))] border-[var(--border,theme(colors.slate-800))] cursor-not-allowed line-through'
                              : 'bg-[var(--surface-2,theme(colors.slate-800))] text-[var(--text,theme(colors.slate-300))] border-[var(--border,theme(colors.slate-700))] hover:border-teal-500/50 hover:text-white'
                          }`}
                        >
                          {slot}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {/* Optional Reason */}
            <div>
              <label className="block text-xs font-semibold text-[var(--text,theme(colors.slate-300))] mb-1.5">
                {postponeWithoutDate ? 'Reason for postponing' : 'Reason for rescheduling'}{' '}
                <span className="text-[var(--text-dim,theme(colors.slate-500))] font-normal">(optional)</span>
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={
                  postponeWithoutDate
                    ? 'e.g. Doctor attending emergency surgery, or clinic schedule adjustment...'
                    : 'e.g. Need to adjust time slot due to travel / appointment conflict...'
                }
                rows={2}
                className="w-full p-3 rounded-xl bg-[var(--surface-2,theme(colors.slate-800))] border border-[var(--border,theme(colors.slate-700))] text-xs text-[var(--text,theme(colors.white))] placeholder:text-[var(--text-dim,theme(colors.slate-500))] focus:outline-none focus:border-teal-500/50 resize-none"
              />
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-[var(--text-dim,theme(colors.slate-400))] hover:text-[var(--text,theme(colors.white))] bg-[var(--surface-2,theme(colors.slate-800))] border border-[var(--border,theme(colors.slate-700))]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRescheduleSubmit}
                disabled={loading || (!postponeWithoutDate && (!selectedDate || !selectedSlot))}
                className={`px-5 py-2 rounded-xl text-xs font-bold text-white shadow-lg flex items-center gap-1.5 transition-all active:scale-[0.98] disabled:opacity-50 ${
                  postponeWithoutDate
                    ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/20'
                    : 'bg-teal-600 hover:bg-teal-500 shadow-teal-600/20'
                }`}
              >
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                <span>
                  {postponeWithoutDate
                    ? 'Postpone Appointment'
                    : 'Confirm Reschedule'}
                </span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
