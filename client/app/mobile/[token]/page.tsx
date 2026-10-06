'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import axios from 'axios';
import { Camera, CheckCircle2, Check, AlertCircle, RefreshCw, Shield, Trash2, User, Clock, Wifi, WifiOff, Smartphone, Image as ImageIcon } from 'lucide-react';
import { MobileCameraModal } from '@/components/MobileCameraModal';
import { compressImage } from '@/lib/imageCompression';
import { detectClientDeviceName } from '@/lib/deviceDetector';

// Unauthenticated API client for the public mobile page
const mobileApi = axios.create({
  baseURL: typeof window !== 'undefined' ? '/api' : 'http://localhost:5000/api',
  timeout: 15000,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

// Automatically inject stored device secret header
mobileApi.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    // Extract token from request URL if present: /device-pairing/:token/...
    const match = config.url?.match(/device-pairing\/([a-zA-Z0-9_-]+)/);
    const urlParts = window.location.pathname.split('/');
    const pathToken = urlParts[urlParts.length - 1];
    const targetToken = match ? match[1] : pathToken;

    const secret =
      (targetToken && localStorage.getItem(`derma_device_secret_${targetToken}`)) ||
      (pathToken && localStorage.getItem(`derma_device_secret_${pathToken}`)) ||
      localStorage.getItem('derma_device_secret');
    if (secret && !config.headers['x-device-secret']) {
      config.headers['x-device-secret'] = secret;
    }
  }
  return config;
});

function getMediaUrl(path?: string): string {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) return path;
  if (path.startsWith('/images/') || path.startsWith('/icons/') || path.startsWith('/favicon')) return path;
  let clean = path;
  if (!clean.startsWith('/api/uploads') && !clean.startsWith('api/uploads')) {
    const filename = clean.replace(/^\/+/, '').replace(/^uploads\//, '');
    clean = `/api/uploads/${filename}`;
  } else if (!clean.startsWith('/')) {
    clean = `/${clean}`;
  }
  return clean;
}

function getErrorMessage(error: unknown, fallback = 'An unexpected error occurred'): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as any;
    if (data?.message && typeof data.message === 'string') return data.message;
    if (data?.error && typeof data.error === 'string') return data.error;
    if (error.message) return error.message;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}

interface PairingData {
  valid: boolean;
  token: string;
  deviceName?: string;
  isCustomName?: boolean;
  doctorName: string;
  doctorUsername?: string;
  isPasswordVerified: boolean;
  expiresAt: string;
}

interface PatientInfo {
  _id: string;
  name: string;
  patientId: string;
  phone?: string;
  gender?: string;
  dateOfBirth?: string;
}

interface VisitInfo {
  _id: string;
  visitDate: string;
  visitType: string;
  status: string;
  scalpImages: string[];
  count: number;
  maxImages: number;
}

export default function MobilePairingPage() {
  const params = useParams();
  const rawToken = params?.token as string;
  const [currentToken, setCurrentToken] = useState<string>(rawToken || '');

  // Keep currentToken in sync if URL route param changes
  useEffect(() => {
    if (rawToken && rawToken !== currentToken) {
      setCurrentToken(rawToken);
    }
  }, [rawToken]);

  // Pairing state
  const [pairing, setPairing] = useState<PairingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Auth state
  const [password, setPassword] = useState('');
  const [verifyingPassword, setVerifyingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);

  // Detected hardware model & friendly name
  const [detectedModel, setDetectedModel] = useState<string>('');
  const [deviceDisplayName, setDeviceDisplayName] = useState<string>('');
  const [isEditingDeviceName, setIsEditingDeviceName] = useState(false);

  // Detect mobile hardware model (e.g. Realme 7, Oppo A23) on mount
  useEffect(() => {
    detectClientDeviceName().then((name) => {
      if (name) {
        setDetectedModel(name);
        setDeviceDisplayName((prev) => prev || name);
      }
    });
  }, []);

  // Active patient monitoring
  const [activePatient, setActivePatient] = useState<PatientInfo | null>(null);
  const [activeVisit, setActiveVisit] = useState<VisitInfo | null>(null);
  const [monitoringStatus, setMonitoringStatus] = useState<'polling' | 'connected' | 'error'>('polling');
  const [finishedVisitId, setFinishedVisitId] = useState<string | null>(null);

  // Photo capture
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [deletingFilename, setDeletingFilename] = useState<string | null>(null);
  const [cameraModalOpen, setCameraModalOpen] = useState(false);

  // Revoked/expired state
  const [isRevoked, setIsRevoked] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ==================== Validate Pairing Token ====================
  const validatePairing = useCallback(async () => {
    if (!currentToken) return;
    try {
      setLoading(true);
      setError(null);

      // Check for stored device trust secret for this token or device
      const storedSecret =
        typeof window !== 'undefined'
          ? localStorage.getItem(`derma_device_secret_${currentToken}`) ||
            localStorage.getItem('derma_device_secret')
          : null;

      const headers: Record<string, string> = {};
      if (storedSecret) {
        headers['x-device-secret'] = storedSecret;
      }

      const queryName = deviceDisplayName || detectedModel;
      if (queryName) {
        headers['x-device-name'] = queryName;
      }

      const url = queryName
        ? `/device-pairing/${currentToken}?deviceName=${encodeURIComponent(queryName)}`
        : `/device-pairing/${currentToken}`;

      const res = await mobileApi.get(url, {
        headers,
        timeout: 10000,
      });

      if (res.data?.success && res.data.data) {
        setPairing(res.data.data);
        if (res.data.data.deviceName) {
          setDeviceDisplayName(res.data.data.deviceName);
        }
        if (res.data.data.isPasswordVerified) {
          setIsVerified(true);
          // Save token to cookie
          setCookie('derma_device_token', currentToken, 30);
        } else {
          setIsVerified(false);
        }
      }
    } catch (err: any) {
      const isNetworkError = err.code === 'ERR_NETWORK' || !err.response;
      if (isNetworkError) {
        setError('Cannot reach the server. Make sure your phone is on the same Wi-Fi network as the clinic computer.');
      } else if (err.response?.status === 404) {
        setIsRevoked(true);
        setError('This device pairing has been revoked or expired. Please scan a new QR code from the doctor workbench.');
        removeCookie('derma_device_token');
        removeCookie('derma_device_secret');
        if (typeof window !== 'undefined') {
          localStorage.removeItem(`derma_device_secret_${currentToken}`);
          localStorage.removeItem('derma_device_secret');
        }
      } else {
        setError(getErrorMessage(err, 'Unable to validate device pairing.'));
      }
    } finally {
      setLoading(false);
    }
  }, [currentToken, deviceDisplayName, detectedModel]);

  useEffect(() => {
    if (currentToken) {
      validatePairing();
    } else {
      setLoading(false);
      setError('Invalid mobile URL. No pairing token found.');
    }
  }, [currentToken, validatePairing]);

  // ==================== Cookie Helpers ====================
  function setCookie(name: string, value: string, days: number) {
    if (typeof document === 'undefined') return;
    const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toUTCString();
    document.cookie = `${name}=${value}; expires=${expires}; path=/; SameSite=Lax`;
  }

  function removeCookie(name: string) {
    if (typeof document === 'undefined') return;
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
  }

  // ==================== Password Verification ====================
  const handleVerifyPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setPasswordError('Please enter doctor account password');
      return;
    }
    try {
      setVerifyingPassword(true);
      setPasswordError(null);
      const finalDeviceName = deviceDisplayName.trim() || detectedModel;
      const res = await mobileApi.post(`/device-pairing/${currentToken}/verify-password`, {
        password: password.trim(),
        deviceName: finalDeviceName,
      }, { timeout: 15000 });

      if (res.data?.success && res.data.data) {
        const { deviceSecret, token: activeToken } = res.data.data;
        const targetToken = activeToken || currentToken;

        if (res.data.data.deviceName) {
          setDeviceDisplayName(res.data.data.deviceName);
        }

        if (deviceSecret) {
          localStorage.setItem(`derma_device_secret_${targetToken}`, deviceSecret);
          localStorage.setItem('derma_device_secret', deviceSecret);
          setCookie('derma_device_secret', deviceSecret, 30);
        }
        setCookie('derma_device_token', targetToken, 30);
        setIsVerified(true);
        setPassword('');

        // If the server provisioned a new token for this phone (multi-device split)
        if (activeToken && activeToken !== currentToken) {
          setCurrentToken(activeToken);
          window.history.replaceState({}, '', `/mobile/${activeToken}`);
        }
      }
    } catch (err: any) {
      setPasswordError(getErrorMessage(err, 'Incorrect doctor password. Please try again.'));
    } finally {
      setVerifyingPassword(false);
    }
  };

  // ==================== Active Patient Polling ====================
  const pollActivePatient = useCallback(async () => {
    if (!currentToken || !isVerified) return;
    try {
      const res = await mobileApi.get(`/device-pairing/${currentToken}/active-patient`, { timeout: 8000 });
      if (res.data?.success && res.data.data) {
        const { hasActivePatient, patient, visit } = res.data.data;
        if (hasActivePatient) {
          setActivePatient(patient);
          setActiveVisit(visit);
        } else {
          setActivePatient(null);
          setActiveVisit(null);
        }
        setMonitoringStatus('connected');
      }
    } catch (err: any) {
      if (err.response?.status === 404) {
        // Pairing revoked
        setIsRevoked(true);
        setError('This device pairing has been revoked. Please scan a new QR code.');
        removeCookie('derma_device_token');
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      } else if (err.response?.status === 403) {
        // Password not verified somehow
        setIsVerified(false);
      } else {
        setMonitoringStatus('error');
      }
    }
  }, [currentToken, isVerified]);

  useEffect(() => {
    if (isVerified && !isRevoked) {
      // Initial poll
      pollActivePatient();
      // Responsive polling every 3.5 seconds
      pollIntervalRef.current = setInterval(pollActivePatient, 3500);

      // Instant poll when user unlocks phone or returns to browser tab
      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
          pollActivePatient();
        }
      };
      document.addEventListener('visibilitychange', handleVisibilityChange);

      return () => {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    }
  }, [isVerified, isRevoked, pollActivePatient]);

  // ==================== Photo Capture ====================
  const uploadPhotoBlob = async (blob: Blob) => {
    if (!activeVisit) return;

    if (activeVisit.count >= activeVisit.maxImages) {
      alert(`Maximum ${activeVisit.maxImages} photos allowed for this visit.`);
      return;
    }

    try {
      setUploading(true);
      setError(null);
      setUploadSuccess(null);

      // Compress client-side to ensure max 1920px Full HD and avoid Android memory issues
      const compressedBlob = await compressImage(blob, 1920, 0.85);

      const formData = new FormData();
      formData.append('image', compressedBlob, `scalp-${Date.now()}.jpg`);

      const res = await mobileApi.post(`/device-pairing/${currentToken}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 30000,
      });

      if (res.data?.success && res.data.data) {
        setActiveVisit((prev) =>
          prev ? { ...prev, count: res.data.data.count, scalpImages: res.data.data.scalpImages } : null
        );
        setUploadSuccess('Clinical photo captured & synced to workbench!');
        setTimeout(() => setUploadSuccess(null), 5000);
      }
    } catch (err: any) {
      setError(getErrorMessage(err, 'Upload failed. Please try again.'));
      setTimeout(() => setError(null), 5000);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeVisit) return;
    await uploadPhotoBlob(file);
  };

  const triggerCamera = () => {
    if (!uploading && activeVisit && activeVisit.count < activeVisit.maxImages) {
      setCameraModalOpen(true);
    }
  };

  const triggerGallery = () => {
    if (fileInputRef.current && !uploading && activeVisit && activeVisit.count < activeVisit.maxImages) {
      fileInputRef.current.click();
    }
  };

  const [confirmDeleteFilename, setConfirmDeleteFilename] = useState<string | null>(null);

  // ==================== Photo Delete ====================
  const handleDeletePhoto = async (filename: string) => {
    if (confirmDeleteFilename !== filename) {
      setConfirmDeleteFilename(filename);
      setTimeout(() => setConfirmDeleteFilename(null), 4000);
      return;
    }

    try {
      setDeletingFilename(filename);
      setConfirmDeleteFilename(null);
      const safeFilename = encodeURIComponent(filename.split('/').pop() || filename);
      const res = await mobileApi.delete(`/device-pairing/${currentToken}/active-patient/images/${safeFilename}`);
      if (res.data?.success && res.data.data) {
        setActiveVisit((prev) =>
          prev ? { ...prev, count: res.data.data.count, scalpImages: res.data.data.scalpImages } : null
        );
        setUploadSuccess('Photo deleted successfully');
        setTimeout(() => setUploadSuccess(null), 3000);
      }
    } catch (err: any) {
      setError(getErrorMessage(err, 'Failed to delete photo.'));
      setTimeout(() => setError(null), 4000);
    } finally {
      setDeletingFilename(null);
    }
  };

  // ==================== RENDER: Loading ====================
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 text-center">
        <RefreshCw className="w-10 h-10 text-teal-400 animate-spin mb-4" />
        <h2 className="text-lg font-semibold">Connecting to DermaTrack...</h2>
        <p className="text-xs text-slate-400 mt-2">Validating device pairing</p>
      </div>
    );
  }

  // ==================== RENDER: Revoked / Expired ====================
  if (isRevoked || (error && !pairing && !isVerified)) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mb-4">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-lg font-bold text-red-400">Connection Failed</h2>
        <p className="text-sm text-slate-300 mt-2 max-w-sm">{error || 'Device pairing is no longer valid.'}</p>
        <button
          onClick={() => { setError(null); setIsRevoked(false); validatePairing(); }}
          className="mt-6 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium transition-colors"
        >
          Retry Connection
        </button>
        <p className="text-[10px] text-slate-500 mt-4 max-w-xs leading-relaxed">
          Tip: Make sure the laptop running DermaTrack and this phone are on the same Wi-Fi network or mobile hotspot.
        </p>
      </div>
    );
  }

  // ==================== RENDER: Password Entry ====================
  if (pairing && !isVerified) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center p-5 max-w-md mx-auto">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-teal-400 flex items-center justify-center mx-auto mb-4">
            <Shield className="w-7 h-7" />
          </div>

          <h2 className="text-center text-lg font-bold text-white mb-1">Doctor Authentication</h2>
          <p className="text-center text-xs text-slate-400 mb-1">
            Dr. {pairing.doctorName}
          </p>
          <p className="text-center text-[11px] text-slate-500 mb-4">
            Enter your doctor password to pair this device. Once verified, this device will stay paired for 30 days.
          </p>

          {/* Detected Device Identification Card */}
          <div className="p-3 rounded-2xl bg-slate-800/80 border border-slate-700/80 mb-3.5 flex items-center justify-between gap-2 text-left">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className="w-8 h-8 rounded-lg bg-teal-500/15 border border-teal-500/30 text-teal-400 flex items-center justify-center shrink-0">
                <Smartphone className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[10px] text-slate-400 block font-mono">This Mobile Device</span>
                {isEditingDeviceName ? (
                  <input
                    type="text"
                    value={deviceDisplayName}
                    onChange={(e) => setDeviceDisplayName(e.target.value)}
                    placeholder="e.g. Realme 7, Oppo A23"
                    className="text-xs font-bold text-white bg-slate-900 border border-teal-500 rounded px-2 py-0.5 mt-0.5 focus:outline-none w-full"
                    autoFocus
                  />
                ) : (
                  <strong className="text-xs font-bold text-white truncate block">
                    {deviceDisplayName || detectedModel || 'Detecting model...'}
                  </strong>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsEditingDeviceName(!isEditingDeviceName)}
              className="text-[11px] font-mono text-teal-400 hover:text-teal-300 px-2.5 py-1 rounded bg-teal-500/10 border border-teal-500/20 shrink-0 cursor-pointer"
            >
              {isEditingDeviceName ? 'Done' : 'Rename'}
            </button>
          </div>

          <form onSubmit={handleVerifyPassword} className="space-y-3">
            <div>
              <input
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setPasswordError(null); }}
                placeholder="Enter Doctor Password"
                autoFocus
                className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm font-mono placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all"
              />
              {passwordError && (
                <p className="mt-1.5 text-xs text-red-400 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {passwordError}
                </p>
              )}
            </div>
            <button
              type="submit"
              disabled={verifyingPassword || !password.trim()}
              className="w-full py-3.5 rounded-xl font-bold text-sm bg-teal-600 hover:bg-teal-500 text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-teal-600/20 cursor-pointer"
            >
              {verifyingPassword ? (
                <><RefreshCw className="w-4 h-4 animate-spin" /> Verifying...</>
              ) : (
                <><Shield className="w-4 h-4" /> Authenticate & Pair Device</>
              )}
            </button>
          </form>

          <div className="mt-5 p-3 rounded-xl bg-slate-800/60 border border-slate-700/50 text-[11px] text-slate-400 space-y-1.5">
            <p className="font-semibold text-slate-300">🔒 Persistent Pairing</p>
            <p>Once verified, this device will automatically detect which patient is in consultation and allow photo capture — no need to scan QR again for every patient.</p>
          </div>
        </div>
      </div>
    );
  }

  // ==================== RENDER: Monitoring Mode (Verified) ====================
  const isMaxReached = activeVisit ? activeVisit.count >= activeVisit.maxImages : false;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col max-w-md mx-auto">
      {/* Top Status Bar */}
      <div className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur-sm border-b border-slate-800 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-teal-500/15 border border-teal-500/30 text-teal-400 flex items-center justify-center">
              <Smartphone className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-white leading-tight">
                {pairing?.deviceName || deviceDisplayName || detectedModel || 'DermaTrack Phone'}
              </p>
              <p className="text-[10px] text-slate-400">Dr. {pairing?.doctorName || 'Doctor'}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${monitoringStatus === 'connected' ? 'bg-emerald-400 animate-pulse' : monitoringStatus === 'error' ? 'bg-red-400' : 'bg-amber-400 animate-pulse'}`} />
            <span className="text-[10px] text-slate-400 font-mono">
              {monitoringStatus === 'connected' ? 'Live' : monitoringStatus === 'error' ? 'Reconnecting' : 'Polling'}
            </span>
          </div>
        </div>
      </div>

      {/* Hidden file input for gallery/file fallback (without capture="environment" to avoid OS memory crash) */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Main Content */}
      <div className="flex-1 p-4 space-y-4">
        {/* Success / Error Toasts */}
        {uploadSuccess && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2 animate-in slide-in-from-top">
            <CheckCircle2 className="w-4 h-4 shrink-0" /> {uploadSuccess}
          </div>
        )}
        {error && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        {/* ==================== No Active Patient ==================== */}
        {!activePatient && (
          <div className="flex flex-col items-center justify-center text-center py-16 px-4">
            <div className="w-24 h-24 rounded-3xl bg-slate-800/80 border-2 border-slate-700/50 flex items-center justify-center mb-6">
              <div className="relative">
                <User className="w-10 h-10 text-slate-500" />
                <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-slate-800 border border-slate-600 flex items-center justify-center">
                  <Clock className="w-2.5 h-2.5 text-slate-400" />
                </div>
              </div>
            </div>

            <h2 className="text-xl font-bold text-slate-300 mb-2">Waiting for Patient</h2>
            <p className="text-xs text-slate-500 max-w-xs leading-relaxed mb-6">
              No patient is currently in consultation. When the doctor starts a consultation, this screen will automatically show the patient&apos;s details and enable the camera.
            </p>

            <div className="flex items-center gap-2 text-[11px] text-teal-400 font-mono">
              <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
              Monitoring consultation room...
            </div>

            <div className="mt-8 p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-[11px] text-slate-400 max-w-xs">
              <p className="font-semibold text-slate-300 mb-1">How this works:</p>
              <p>This screen automatically updates when the doctor starts a new patient consultation. You don&apos;t need to scan any QR code — just keep this page open.</p>
            </div>
          </div>
        )}

        {/* ==================== Active Patient + Camera ==================== */}
        {activePatient && activeVisit && (
          <>
            {/* Patient Info Card */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-teal-900/40 to-slate-900 border border-teal-500/20 shadow-lg shadow-teal-500/5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-2xl bg-teal-500/15 border border-teal-500/25 flex items-center justify-center text-teal-400">
                  <User className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-bold text-white truncate">{activePatient.name}</h3>
                  <p className="text-[11px] text-teal-300 font-mono">UHID: {activePatient.patientId || 'N/A'}</p>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-teal-500/15 border border-teal-500/25 text-teal-400 text-[10px] font-bold uppercase tracking-wider">
                  In Consultation
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-[11px]">
                <div className="p-2 rounded-lg bg-slate-800/50 border border-slate-700/50 text-center">
                  <span className="text-slate-400 block mb-0.5">Visit</span>
                  <span className="text-white font-semibold">{activeVisit.visitType === 'FirstVisit' ? '1st Visit' : 'Follow-Up'}</span>
                </div>
                <div className="p-2 rounded-lg bg-slate-800/50 border border-slate-700/50 text-center">
                  <span className="text-slate-400 block mb-0.5">Date</span>
                  <span className="text-white font-semibold">{new Date(activeVisit.visitDate).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                </div>
                <div className="p-2 rounded-lg bg-slate-800/50 border border-slate-700/50 text-center">
                  <span className="text-slate-400 block mb-0.5">Photos</span>
                  <span className="text-teal-400 font-bold">{activeVisit.count} / {activeVisit.maxImages}</span>
                </div>
              </div>
            </div>

            {/* Session Finished State */}
            {finishedVisitId === activeVisit._id ? (
              <div className="p-6 rounded-2xl bg-gradient-to-br from-emerald-950/60 to-slate-900 border border-emerald-500/30 text-center space-y-4 shadow-xl">
                <div className="w-16 h-16 rounded-3xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 mx-auto flex items-center justify-center shadow-lg">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Capture Completed</h3>
                  <p className="text-xs text-emerald-300/90 mt-1 max-w-xs mx-auto">
                    {activeVisit.scalpImages.length} scalp {activeVisit.scalpImages.length === 1 ? 'photo' : 'photos'} saved & synchronized to Dr. {pairing?.doctorName || 'Doctor'}&apos;s workbench.
                  </p>
                </div>

                <div className="pt-2 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => setFinishedVisitId(null)}
                    className="w-full py-2.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Camera className="w-3.5 h-3.5 text-teal-400" />
                    <span>Capture More Photos if Needed</span>
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Camera Capture Button */}
                <button
                  type="button"
                  onClick={triggerCamera}
                  disabled={uploading || isMaxReached}
                  className={`w-full py-5 rounded-2xl font-bold text-base flex items-center justify-center gap-3 transition-all shadow-lg active:scale-[0.98] ${
                    isMaxReached
                      ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                      : uploading
                        ? 'bg-teal-700 text-white border border-teal-600'
                        : 'bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-500 hover:to-teal-400 text-white border border-teal-400/30 shadow-teal-600/30'
                  }`}
                >
                  {uploading ? (
                    <><RefreshCw className="w-5 h-5 animate-spin" /> Uploading Photo...</>
                  ) : isMaxReached ? (
                    <><CheckCircle2 className="w-5 h-5" /> Maximum {activeVisit.maxImages} Photos Reached</>
                  ) : (
                    <><Camera className="w-6 h-6" /> Open Live Camera</>
                  )}
                </button>

                {/* Gallery / File Picker Fallback Button */}
                {!isMaxReached && (
                  <button
                    type="button"
                    onClick={triggerGallery}
                    disabled={uploading}
                    className="w-full py-2.5 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 bg-slate-900/60 hover:bg-slate-800 border border-slate-800 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                  >
                    <ImageIcon className="w-3.5 h-3.5 text-teal-400" />
                    <span>Upload from Gallery / Files</span>
                  </button>
                )}

                {/* Finish & Wind Up Button (Visible when photos taken) */}
                {activeVisit.scalpImages.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setFinishedVisitId(activeVisit._id)}
                    className="w-full py-3.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 transition-all shadow-sm active:scale-[0.98]"
                  >
                    <Check className="w-4 h-4" />
                    <span>Finish & Wind Up Capture ({activeVisit.scalpImages.length} {activeVisit.scalpImages.length === 1 ? 'photo' : 'photos'})</span>
                  </button>
                )}
              </>
            )}

            {/* Photo Gallery */}
            {activeVisit.scalpImages.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold text-slate-400 mb-2 uppercase tracking-wider">
                  Captured Photos ({activeVisit.scalpImages.length})
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {activeVisit.scalpImages.map((img, idx) => (
                    <div key={img} className="relative aspect-square rounded-xl overflow-hidden border border-slate-800 bg-slate-900 group">
                      <img
                        src={getMediaUrl(img)}
                        alt={`Scalp photo ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute bottom-1 left-1 text-[9px] font-bold text-white bg-black/70 px-1.5 py-0.5 rounded">
                        #{idx + 1}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeletePhoto(img);
                        }}
                        disabled={deletingFilename === img}
                        className={`absolute top-1.5 right-1.5 z-10 p-1.5 rounded-lg text-white shadow-md transition-all active:scale-90 flex items-center gap-1 ${
                          confirmDeleteFilename === img
                            ? 'bg-red-600 px-2 text-[10px] font-bold animate-pulse'
                            : 'bg-black/75 hover:bg-red-600'
                        }`}
                        title={confirmDeleteFilename === img ? "Tap again to permanently delete" : "Delete photo"}
                      >
                        {deletingFilename === img ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : confirmDeleteFilename === img ? (
                          <>
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Confirm?</span>
                          </>
                        ) : (
                          <Trash2 className="w-3.5 h-3.5 text-white/90" />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Bottom Status Bar */}
      <div className="sticky bottom-0 bg-slate-900/95 backdrop-blur-sm border-t border-slate-800 px-4 py-2.5">
        <div className="flex items-center justify-between text-[10px] text-slate-500">
          <span className="font-mono flex items-center gap-1.5">
            {monitoringStatus === 'connected' ? (
              <Wifi className="w-3 h-3 text-teal-400" />
            ) : (
              <WifiOff className="w-3 h-3 text-red-400" />
            )}
            Paired Device • {pairing?.doctorName || 'Doctor'}
          </span>
          <span className="font-mono">
            Expires: {pairing?.expiresAt ? new Date(pairing.expiresAt).toLocaleDateString([], { month: 'short', day: 'numeric' }) : 'N/A'}
          </span>
        </div>
      </div>

      {/* Live In-App Camera Viewfinder */}
      <MobileCameraModal
        isOpen={cameraModalOpen}
        onClose={() => setCameraModalOpen(false)}
        onCapture={async (blob) => {
          await uploadPhotoBlob(blob);
          setCameraModalOpen(false);
        }}
        uploading={uploading}
        title={activePatient ? `Capture: ${activePatient.name}` : 'Scalp Photo Viewfinder'}
      />
    </div>
  );
}
