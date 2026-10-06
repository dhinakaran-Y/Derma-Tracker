'use client';

import React, { useEffect, useRef } from 'react';
import QRCode from 'react-qr-code';
import { X, CheckCircle2, Loader2, QrCode } from 'lucide-react';

interface StaticQRModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (notes?: string) => Promise<void>;
  amount: number;
  patientName: string;
  vpa: string;
  displayName: string;
  isSubmitting: boolean;
  title?: string;
  transactionNote?: string;
}

export function StaticQRModal({
  isOpen,
  onClose,
  onConfirm,
  amount,
  patientName,
  vpa,
  displayName,
  isSubmitting,
  title,
  transactionNote,
}: StaticQRModalProps) {
  const notesRef = useRef<HTMLInputElement>(null);

  // Build UPI deep link — works with PhonePe, GPay, Paytm, BHIM, etc.
  const upiUrl = vpa
    ? `upi://pay?pa=${encodeURIComponent(vpa)}&pn=${encodeURIComponent(displayName)}&am=${amount}&cu=INR&tn=${encodeURIComponent(transactionNote || 'Clinic Payment')}`
    : '';

  useEffect(() => {
    if (isOpen) {
      // Lock body scroll when modal open
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm surface-card rounded-2xl border border-[var(--border-light)] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[var(--border)] bg-[var(--surface-2)] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/15 border border-blue-500/30 flex items-center justify-center">
              <QrCode className="w-4 h-4 text-blue-500" />
            </div>
            <div>
              <h3 className="font-display font-bold text-sm text-[var(--text)]">{title || 'Static QR Payment'}</h3>
              <p className="text-[11px] font-mono text-[var(--text-dim)]">{patientName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg hover:bg-[var(--surface-3)] flex items-center justify-center text-[var(--text-dim)] hover:text-[var(--text)] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* QR Code Section */}
        <div className="p-6 space-y-5">
          {vpa ? (
            <>
              {/* Amount Banner */}
              <div className="text-center">
                <p className="text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider mb-1">Amount to Collect</p>
                <p className="font-display text-4xl font-bold text-[var(--text)] tracking-tight">
                  ₹{amount.toLocaleString()}
                </p>
              </div>

              {/* QR Code */}
              <div className="flex justify-center">
                <div className="p-4 bg-white rounded-2xl shadow-md border border-[var(--border)]">
                  <QRCode value={upiUrl} size={200} level="M" />
                </div>
              </div>

              {/* UPI Info */}
              <div className="text-center space-y-1">
                <p className="text-xs font-mono text-[var(--text-dim)]">
                  Scan with any UPI app · PhonePe · GPay · Paytm · BHIM
                </p>
                <p className="text-xs font-mono font-semibold text-[var(--text)]">{displayName}</p>
                <p className="text-[11px] font-mono text-[var(--text-dim)]">{vpa}</p>
              </div>

              {/* Notes */}
              <div>
                <label className="text-[11px] font-mono text-[var(--text-dim)] block mb-1">
                  Notes (optional)
                </label>
                <input
                  ref={notesRef}
                  type="text"
                  placeholder="e.g. Cash received, receipt shown..."
                  className="w-full px-3 py-2 text-xs bg-[var(--surface-2)] border border-[var(--border)] rounded-lg text-[var(--text)] focus:outline-none focus:border-[var(--brass)] font-mono"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2.5">
                <button
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="flex-1 px-3 py-2.5 rounded-xl text-xs font-mono font-semibold bg-[var(--surface-3)] text-[var(--text)] hover:bg-[var(--surface-2)] border border-[var(--border)] transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => onConfirm(notesRef.current?.value)}
                  disabled={isSubmitting}
                  className="flex-2 flex-grow px-4 py-2.5 rounded-xl text-xs font-mono font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" /><span>Recording...</span></>
                  ) : (
                    <><CheckCircle2 className="w-3.5 h-3.5" /><span>Mark as Paid</span></>
                  )}
                </button>
              </div>
            </>
          ) : (
            // No VPA configured
            <div className="py-8 text-center space-y-3">
              <div className="w-14 h-14 rounded-full bg-[var(--warn-bg)] border border-[var(--warn)]/30 flex items-center justify-center mx-auto text-2xl">
                ⚠️
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--text)]">UPI VPA not configured</p>
                <p className="text-xs text-[var(--text-dim)] mt-1 max-w-[260px] mx-auto">
                  Please set your UPI VPA (e.g. clinic@upi) in Payment Settings before using Static QR.
                </p>
              </div>
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-xs font-mono bg-[var(--surface-3)] border border-[var(--border)] text-[var(--text)]"
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
