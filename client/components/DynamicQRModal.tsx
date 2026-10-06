'use client';

import React, { useEffect, useState, useCallback } from 'react';
import QRCode from 'react-qr-code';
import { X, Loader2, Zap, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';
import { getSocket } from '../lib/socket';

interface DynamicQRModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  /** Pre-created order data returned from POST /api/payment/dynamic-order */
  orderData: {
    recordId: string;
    orderId: string;
    amount: number;
    qrValue: string;
    keyId: string;
    isTestMode: boolean;
  } | null;
  patientName: string;
  title?: string;
}

type PaymentStatus = 'waiting' | 'confirmed' | 'failed';

export function DynamicQRModal({
  isOpen,
  onClose,
  onSuccess,
  orderData,
  patientName,
  title,
}: DynamicQRModalProps) {
  const [status, setStatus] = useState<PaymentStatus>('waiting');
  const [confirmedAmount, setConfirmedAmount] = useState<number | null>(null);

  // ── Socket listener for real-time webhook confirmation ──
  const handlePaymentConfirmed = useCallback(
    (payload: { orderId: string; amount: number }) => {
      if (orderData && payload.orderId === orderData.orderId) {
        setStatus('confirmed');
        setConfirmedAmount(payload.amount);
      }
    },
    [orderData]
  );

  const handlePaymentFailed = useCallback(
    (payload: { orderId: string }) => {
      if (orderData && payload.orderId === orderData.orderId) {
        setStatus('failed');
      }
    },
    [orderData]
  );

  // Auto-close on confirmed after 2.5s
  useEffect(() => {
    if (status !== 'confirmed') return;
    const timer = setTimeout(() => {
      onSuccess();
      onClose();
    }, 2500);
    return () => clearTimeout(timer);
  }, [status, onSuccess, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    setStatus('waiting');
    setConfirmedAmount(null);

    const socket = getSocket();
    socket.on('payment:confirmed', handlePaymentConfirmed);
    socket.on('payment:failed', handlePaymentFailed);
    return () => {
      socket.off('payment:confirmed', handlePaymentConfirmed);
      socket.off('payment:failed', handlePaymentFailed);
    };
  }, [isOpen, handlePaymentConfirmed, handlePaymentFailed]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen || !orderData) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm surface-card rounded-2xl border border-[var(--border-light)] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[var(--border)] bg-[var(--surface-2)] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-violet-500/15 border border-violet-500/30 flex items-center justify-center">
              <Zap className="w-4 h-4 text-violet-500" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display font-bold text-sm text-[var(--text)]">{title || 'Dynamic QR Payment'}</h3>
                {orderData.isTestMode && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-500 border border-amber-500/30">
                    TEST
                  </span>
                )}
              </div>
              <p className="text-[11px] font-mono text-[var(--text-dim)]">{patientName}</p>
            </div>
          </div>
          {status !== 'confirmed' && (
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-lg hover:bg-[var(--surface-3)] flex items-center justify-center text-[var(--text-dim)] hover:text-[var(--text)] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {/* ── WAITING STATE ── */}
          {status === 'waiting' && (
            <>
              <div className="text-center">
                <p className="text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider mb-1">Auto-filled Amount</p>
                <p className="font-display text-4xl font-bold text-[var(--text)] tracking-tight">
                  ₹{orderData.amount.toLocaleString()}
                </p>
              </div>

              {/* QR */}
              <div className="flex justify-center">
                <div className="p-4 bg-white rounded-2xl shadow-md border border-[var(--border)] relative">
                  <QRCode value={orderData.qrValue} size={200} level="M" />
                </div>
              </div>

              {/* Status Pill */}
              <div className="flex items-center justify-center gap-2 py-2 px-4 rounded-full bg-[var(--surface-2)] border border-[var(--border)] w-fit mx-auto">
                <RefreshCw className="w-3.5 h-3.5 text-[var(--brass)] animate-spin" />
                <span className="text-xs font-mono text-[var(--text-dim)]">Waiting for payment...</span>
              </div>

              {orderData.isTestMode && (
                <div className="text-center p-3 rounded-xl bg-amber-500/8 border border-amber-500/20">
                  <p className="text-[11px] font-mono text-amber-600 font-semibold">🧪 Test Mode</p>
                  <p className="text-[11px] font-mono text-[var(--text-dim)] mt-0.5">
                    UPI: <span className="text-amber-600 font-bold">success@razorpay</span>
                  </p>
                </div>
              )}

              <button
                onClick={onClose}
                className="w-full px-3 py-2.5 rounded-xl text-xs font-mono font-semibold bg-[var(--surface-3)] text-[var(--text)] hover:bg-[var(--surface-2)] border border-[var(--border)] transition-colors"
              >
                Cancel
              </button>
            </>
          )}

          {/* ── CONFIRMED STATE ── */}
          {status === 'confirmed' && (
            <div className="py-6 text-center space-y-4">
              <div className="w-20 h-20 rounded-full bg-emerald-500/15 border-2 border-emerald-500/40 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-10 h-10 text-emerald-500" />
              </div>
              <div>
                <p className="font-display text-xl font-bold text-emerald-500">Payment Confirmed!</p>
                <p className="text-sm font-mono text-[var(--text-dim)] mt-1">
                  ₹{(confirmedAmount ?? orderData.amount).toLocaleString()} received from {patientName}
                </p>
              </div>
              <p className="text-xs text-[var(--text-dim)] font-mono animate-pulse">Closing automatically...</p>
            </div>
          )}

          {/* ── FAILED STATE ── */}
          {status === 'failed' && (
            <div className="py-6 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-[var(--error-bg)] border border-[var(--error)]/30 flex items-center justify-center mx-auto">
                <XCircle className="w-8 h-8 text-[var(--error)]" />
              </div>
              <div>
                <p className="font-display text-base font-bold text-[var(--error)]">Payment Failed</p>
                <p className="text-xs text-[var(--text-dim)] mt-1">The payment was not completed.</p>
              </div>
              <button
                onClick={onClose}
                className="w-full px-3 py-2.5 rounded-xl text-xs font-mono font-semibold bg-[var(--surface-3)] border border-[var(--border)] text-[var(--text)]"
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
