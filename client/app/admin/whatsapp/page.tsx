'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Wifi, WifiOff, RefreshCw, CheckCircle2, AlertCircle,
  Smartphone, ArrowLeft, Loader2, Info
} from 'lucide-react';
import Link from 'next/link';
import { api } from '../../../lib/api';

type WaStatus = {
  connected: boolean;
  enabled: boolean;
  hasQr: boolean;
};

export default function WhatsAppSetupPage() {
  const { user, userType, loading } = useAuth();
  const router = useRouter();

  const [status, setStatus] = useState<WaStatus | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Keep track of admin status for badge display
  const isAdmin = userType === 'staff' && user?.role === 'Admin';

  // ── Fetch status & QR ──────────────────────────────────────────────────────
  const checkStatus = useCallback(async () => {
    try {
      const res = await api.get('/whatsapp/status');
      const data: WaStatus = res.data?.data;
      setStatus(data);
      setLastChecked(new Date());

      if (data.connected) {
        // Connected — clear QR
        setQrDataUrl(null);
        stopPolling();
        return;
      }

      // Not connected — try to fetch QR
      if (data.hasQr) {
        const qrRes = await api.get('/whatsapp/qr');
        if (qrRes.data?.success && qrRes.data?.qr) {
          setQrDataUrl(qrRes.data.qr);
        }
      } else {
        setQrDataUrl(null);
      }
    } catch {
      // Network error — keep showing last state
    }
  }, []);

  const startPolling = useCallback(() => {
    setPolling(true);
    checkStatus();
    pollRef.current = setInterval(checkStatus, 3000);
  }, [checkStatus]);

  const stopPolling = useCallback(() => {
    setPolling(false);
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  // Enforce Admin authentication
  useEffect(() => {
    if (!loading && (!user || userType !== 'staff' || user.role !== 'Admin')) {
      toast.error('Admin access required');
      router.replace('/login');
    }
  }, [loading, user, userType, router]);

  // Start polling on mount (only for Admins), stop on unmount
  useEffect(() => {
    if (isAdmin) {
      startPolling();
    }
    return () => stopPolling();
  }, [isAdmin, startPolling, stopPolling]);

  // When connected, stop polling
  useEffect(() => {
    if (status?.connected) {
      stopPolling();
    }
  }, [status?.connected, stopPolling]);

  // ── Trigger reconnect ──────────────────────────────────────────────────────
  const handleReconnect = async () => {
    setReconnecting(true);
    setQrDataUrl(null);
    try {
      await api.post('/whatsapp/reconnect');
      toast.info('Reconnect triggered — QR will appear below in a few seconds');
      // Restart polling to pick up the new QR
      stopPolling();
      setTimeout(() => startPolling(), 3000);
    } catch {
      toast.error('Failed to trigger reconnect');
    } finally {
      setReconnecting(false);
    }
  };

  // ── Manual refresh ──────────────────────────────────────────────────────────
  const handleRefresh = () => {
    checkStatus();
    toast.info('Checking WhatsApp status…');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
        <Loader2 className="w-6 h-6 animate-spin text-[var(--brass)]" />
      </div>
    );
  }

  const isConnected = status?.connected ?? false;
  const isEnabled = status?.enabled ?? false;
  const hasQr = status?.hasQr ?? false;
  const isWaiting = !isConnected && !hasQr && isEnabled;

  return (
    <div className="min-h-screen bg-[var(--bg)] p-6">
      {/* Background glow */}
      <div className="fixed w-96 h-96 rounded-full bg-emerald-500/5 blur-3xl top-0 right-0 pointer-events-none" />
      <div className="fixed w-96 h-96 rounded-full bg-[var(--brass)]/5 blur-3xl bottom-0 left-0 pointer-events-none" />

      <div className="max-w-2xl mx-auto relative z-10">

        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link
            href="/admin"
            className="p-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-dim)] hover:text-[var(--text)] hover:border-[var(--brass)]/50 transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="font-display text-2xl font-bold text-[var(--text)]">WhatsApp Setup</h1>
            <p className="text-sm text-[var(--text-dim)] mt-0.5">
              Link your WhatsApp account to enable OTP delivery
            </p>
          </div>
        </div>

        {/* Status Card */}
        <div className={`surface-card p-6 mb-6 border ${
          isConnected
            ? 'border-emerald-500/40 bg-emerald-500/5'
            : 'border-[var(--border-light)]'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                isConnected
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'bg-[var(--surface-3)] text-[var(--text-dim)]'
              }`}>
                {isConnected ? <Wifi className="w-5 h-5" /> : <WifiOff className="w-5 h-5" />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-[var(--text)]">
                    {isConnected ? 'WhatsApp Connected' : 'WhatsApp Disconnected'}
                  </span>
                  {polling && !isConnected && (
                    <span className="flex items-center gap-1 text-[10px] font-mono text-[var(--text-dim)] bg-[var(--surface-2)] border border-[var(--border)] px-1.5 py-0.5 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--brass)] animate-pulse inline-block" />
                      LIVE
                    </span>
                  )}
                </div>
                <p className="text-xs text-[var(--text-dim)] mt-0.5">
                  {isConnected
                    ? 'OTP delivery via WhatsApp is active'
                    : isEnabled
                      ? 'Scan the QR code below to connect'
                      : 'WHATSAPP_ENABLED=false in server .env'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {lastChecked && (
                <span className="text-[10px] font-mono text-[var(--text-dim)]">
                  {lastChecked.toLocaleTimeString()}
                </span>
              )}
              <button
                onClick={handleRefresh}
                className="p-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-dim)] hover:text-[var(--text)] transition-all"
                title="Refresh status"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Feature bullets when connected */}
          {isConnected && (
            <div className="mt-4 pt-4 border-t border-emerald-500/20 grid grid-cols-2 gap-2 text-xs">
              {['OTP via WhatsApp active', 'Auto-fallback to SMS if disconnected', 'Session persists across restarts', 'Clinic phone stays linked'].map((f) => (
                <div key={f} className="flex items-center gap-1.5 text-[var(--text-dim)]">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                  {f}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* QR Section */}
        {!isConnected && isEnabled && (
          <div className="surface-card p-6 mb-6 border border-[var(--border-light)]">
            <h2 className="font-semibold text-[var(--text)] mb-1">Scan QR Code</h2>
            <p className="text-xs text-[var(--text-dim)] mb-6">
              Open WhatsApp on your clinic phone → <strong>Linked Devices</strong> → <strong>Link a Device</strong> → scan the code below.
            </p>

            {/* QR Display */}
            <div className="flex flex-col items-center gap-4">
              <div className={`relative rounded-2xl overflow-hidden border-2 shadow-xl transition-all duration-300 ${
                qrDataUrl
                  ? 'border-emerald-500/50 shadow-emerald-500/10'
                  : 'border-[var(--border)] bg-[var(--surface-2)]'
              }`}
                style={{ width: 280, height: 280 }}
              >
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt="WhatsApp QR Code"
                    width={280}
                    height={280}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-[var(--text-dim)]">
                    {isWaiting ? (
                      <>
                        <Loader2 className="w-8 h-8 animate-spin text-[var(--brass)]" />
                        <p className="text-xs font-mono text-center px-4">
                          Waiting for QR…<br />
                          <span className="text-[var(--text-dim)]/60">May take a few seconds</span>
                        </p>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-8 h-8 text-[var(--text-dim)]" />
                        <p className="text-xs text-center px-4">
                          No QR available.<br />Click &quot;Generate New QR&quot; below.
                        </p>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Expiry note */}
              {qrDataUrl && (
                <p className="text-[11px] text-[var(--text-dim)] text-center">
                  ⏱ QR code expires in ~60 seconds — refresh auto-updates
                </p>
              )}

              {/* Reconnect Button */}
              <button
                onClick={handleReconnect}
                disabled={reconnecting}
                className="flex items-center gap-2 px-4 py-2 bg-[var(--surface-2)] border border-[var(--border)] hover:border-emerald-500/50 hover:text-emerald-400 rounded-lg text-sm text-[var(--text-dim)] transition-all font-mono"
              >
                {reconnecting
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating…</>
                  : <><RefreshCw className="w-3.5 h-3.5" /> Generate New QR</>
                }
              </button>
            </div>
          </div>
        )}

        {/* Instructions Card */}
        <div className="surface-card p-5 border border-[var(--border-light)]">
          <div className="flex items-start gap-3">
            <Info className="w-4 h-4 text-[var(--brass)] shrink-0 mt-0.5" />
            <div className="space-y-2 text-xs text-[var(--text-dim)]">
              <p className="font-semibold text-[var(--text)]">How WhatsApp OTP works</p>
              <ol className="space-y-1.5 list-decimal list-inside">
                <li>Server starts → Baileys generates a QR (shown above)</li>
                <li>Scan QR with your <strong>clinic WhatsApp</strong> → Linked Devices</li>
                <li>Session saved to <code className="text-[var(--brass)] text-[10px]">server/whatsapp-session/</code> — persists across restarts</li>
                <li>Patients choose "WhatsApp" on login → OTP arrives in their WhatsApp</li>
                <li>If WhatsApp disconnects → OTP auto-falls back to SMS</li>
              </ol>
              <div className="mt-3 pt-3 border-t border-[var(--border)] space-y-1">
                <p className="font-mono text-[10px]">
                  <span className="text-[var(--text-dim)]/60">To re-link after logout:</span>{' '}
                  delete <code className="text-[var(--brass)]">server/whatsapp-session/</code> folder → restart server
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Spacer */}
        <div className="h-8" />
      </div>
    </div>
  );
}
