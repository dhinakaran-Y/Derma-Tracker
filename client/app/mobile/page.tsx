'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { Smartphone, RefreshCw, QrCode, AlertCircle } from 'lucide-react';

const mobileApi = axios.create({
  baseURL: typeof window !== 'undefined' ? '/api' : 'http://localhost:5000/api',
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? match[2] : null;
}

export default function MobileLandingPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkCookie = async () => {
      const savedToken = getCookie('derma_device_token');
      if (!savedToken) {
        setChecking(false);
        return;
      }

      // Validate the saved token with the server
      try {
        const res = await mobileApi.get(`/device-pairing/${savedToken}`);
        if (res.data?.success && res.data.data?.valid) {
          // Valid pairing — redirect to the mobile page
          router.replace(`/mobile/${savedToken}`);
          return;
        }
      } catch {
        // Token invalid or expired — clear cookie
        document.cookie = 'derma_device_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
      }
      setChecking(false);
    };

    checkCookie();
  }, [router]);

  if (checking) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 text-center">
        <RefreshCw className="w-10 h-10 text-teal-400 animate-spin mb-4" />
        <h2 className="text-lg font-semibold">Checking device pairing...</h2>
        <p className="text-xs text-slate-400 mt-2">Looking for a saved pairing session</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 text-center">
      <div className="w-20 h-20 rounded-3xl bg-teal-500/10 border-2 border-teal-500/30 text-teal-400 flex items-center justify-center mb-6 shadow-2xl shadow-teal-500/10">
        <Smartphone className="w-10 h-10" />
      </div>

      <h1 className="text-2xl font-black text-white tracking-tight mb-2">DermaTrack Mobile</h1>
      <p className="text-sm text-slate-400 max-w-xs mb-8 leading-relaxed">
        Scalp photo capture companion for the doctor&apos;s consultation workbench.
      </p>

      {error && (
        <div className="mb-6 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2 max-w-xs">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl max-w-xs w-full">
        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-4">
          <QrCode className="w-7 h-7" />
        </div>

        <h2 className="text-base font-bold text-white mb-2">Scan QR Code to Pair</h2>
        <p className="text-xs text-slate-400 leading-relaxed mb-4">
          Open the <strong className="text-slate-300">Device Pairing</strong> page on the doctor&apos;s workbench and scan the QR code with this phone&apos;s camera.
        </p>

        <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/50 text-[11px] text-slate-400 space-y-1.5 text-left">
          <p className="font-semibold text-slate-300">📱 Once paired:</p>
          <ul className="list-disc list-inside space-y-0.5">
            <li>Device stays connected for 30 days</li>
            <li>Auto-detects the active patient</li>
            <li>Capture photos — they sync instantly</li>
            <li>Bookmark this page for quick access</li>
          </ul>
        </div>
      </div>

      <p className="text-[10px] text-slate-600 mt-6 max-w-xs">
        Ensure this phone and the clinic computer are on the same Wi-Fi network or use a public tunnel URL.
      </p>
    </div>
  );
}
