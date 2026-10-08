'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import axios from 'axios';
import { Camera, CheckCircle2, AlertCircle, RefreshCw, Upload, Image as ImageIcon, Shield, Trash2 } from 'lucide-react';
import { MobileCameraModal } from '@/components/MobileCameraModal';
import { compressImage } from '@/lib/imageCompression';
import { getApiBaseUrl } from '@/lib/api';

// Dedicated unauthenticated API client for the public capture page.
// This avoids using the main `api` instance which injects the doctor's JWT
// from localStorage, causing spurious 401 errors in the browser console.
const captureApi = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

captureApi.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    config.baseURL = getApiBaseUrl();
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

interface SessionData {
  valid: boolean;
  token: string;
  patientName: string;
  patientUhid: string;
  doctorName?: string;
  doctorUsername?: string;
  isPasswordVerified?: boolean;
  visitDate: string;
  count: number;
  maxImages: number;
  scalpImages: string[];
  status?: string;
}

export default function MobileCapturePage() {
  const params = useParams();
  const token = params?.token as string;

  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [verifyingPassword, setVerifyingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState<string>('Initializing...');
  const [isCompleted, setIsCompleted] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [deletingFilename, setDeletingFilename] = useState<string | null>(null);
  const [cameraModalOpen, setCameraModalOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const maxRetries = 3;

  // Fetch and validate session
  const fetchSession = async () => {
    if (!token) {
      setConnectionStatus('Waiting for token...');
      return;
    }
    try {
      setLoading(true);
      setError(null);
      setConnectionStatus('Connecting to server...');
      const res = await captureApi.get(`/capture-sessions/${token}`, {
        timeout: 10000, // 10 second timeout for mobile
      });
      if (res.data?.success && res.data.data) {
        setSession(res.data.data);
        setConnectionStatus('Connected!');
        if (res.data.data.isPasswordVerified) {
          setIsVerified(true);
        }
        if (res.data.data.status === 'completed') {
          setIsCompleted(true);
        }
      } else {
        setError('Invalid session or session has expired.');
      }
    } catch (err: any) {
      const isTimeout = err.code === 'ECONNABORTED' || err.message?.includes('timeout');
      const isNetworkError = err.code === 'ERR_NETWORK' || !err.response;
      
      if (isTimeout) {
        setConnectionStatus('Connection timed out');
        setError('Connection timed out. The server may not be reachable from this network. Ensure the laptop and phone are on the same Wi-Fi or hotspot.');
      } else if (isNetworkError) {
        setConnectionStatus('Network unreachable');
        setError('Cannot reach the server. Make sure your phone is on the same Wi-Fi network as the clinic computer, or use a public tunnel URL.');
      } else {
        setError(getErrorMessage(err, 'Unable to connect to capture session. Please request a new QR code from the doctor workbench.'));
      }
    } finally {
      setLoading(false);
    }
  };

  // Auto-retry on failure
  useEffect(() => {
    if (error && retryCount < maxRetries && token) {
      const timer = setTimeout(() => {
        setRetryCount(prev => prev + 1);
        fetchSession();
      }, 3000); // retry after 3 seconds
      return () => clearTimeout(timer);
    }
  }, [error, retryCount, token]);

  useEffect(() => {
    if (token) {
      fetchSession();
    } else {
      // Token not yet available from URL params - this shouldn't stay stuck
      const timeout = setTimeout(() => {
        if (!token) {
          setLoading(false);
          setError('Invalid capture URL. No session token found.');
        }
      }, 2000);
      return () => clearTimeout(timeout);
    }
  }, [token]);

  // Handle doctor password verification
  const handleVerifyPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setPasswordError('Please enter doctor account password');
      return;
    }

    try {
      setVerifyingPassword(true);
      setPasswordError(null);
      const res = await captureApi.post(`/capture-sessions/${token}/verify-password`, {
        password: password.trim(),
      }, { timeout: 15000 });

      if (res.data?.success) {
        setIsVerified(true);
        setPassword('');
        setUploadSuccess('Doctor verified! Camera is now unlocked.');
        setTimeout(() => setUploadSuccess(null), 4000);
      }
    } catch (err: any) {
      setPasswordError(getErrorMessage(err, 'Incorrect doctor password. Please try again.'));
    } finally {
      setVerifyingPassword(false);
    }
  };

  // Handle image capture via live viewfinder or gallery upload
  const uploadPhotoBlob = async (blob: Blob) => {
    if (!session) return;

    if (session.count >= session.maxImages) {
      alert(`Maximum ${session.maxImages} photos allowed for this visit.`);
      return;
    }

    try {
      setUploading(true);
      setError(null);
      setUploadSuccess(null);

      // Compress client-side to ensure max 1920px Full HD and avoid Android low memory crashes
      const compressedBlob = await compressImage(blob, 1920, 0.85);

      const formData = new FormData();
      formData.append('image', compressedBlob, `scalp-${Date.now()}.jpg`);

      const res = await captureApi.post(`/capture-sessions/${token}/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 30000, // 30s for file upload
      });

      if (res.data?.success && res.data.data) {
        setSession((prev) =>
          prev
            ? {
                ...prev,
                count: res.data.data.count,
                scalpImages: res.data.data.scalpImages,
              }
            : null
        );
        setUploadSuccess('Clinical photo captured & saved in high quality! It is now visible on the doctor screen.');
        setTimeout(() => setUploadSuccess(null), 6000);
      }
    } catch (err: any) {
      setError(getErrorMessage(err, 'Upload failed. Please try capturing again.'));
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !session) return;
    await uploadPhotoBlob(file);
  };

  const triggerCamera = () => {
    if (!uploading && session && session.count < session.maxImages) {
      setCameraModalOpen(true);
    }
  };

  const triggerGallery = () => {
    if (fileInputRef.current && !uploading && session && session.count < session.maxImages) {
      fileInputRef.current.click();
    }
  };

  // Finish session early and wind up page
  const handleFinishSession = async () => {
    if (!session) return;
    const photoCount = session.scalpImages?.length || 0;
    const confirmMsg =
      photoCount === 0
        ? 'No photos have been captured yet. Are you sure you want to finish and wind up this session?'
        : `Finish session with ${photoCount} clinical ${photoCount === 1 ? 'photo' : 'photos'}? This will wind up this mobile capture page and save all photos to the consultation record.`;

    if (!confirm(confirmMsg)) return;

    try {
      setFinishing(true);
      setError(null);
      const res = await captureApi.post(`/capture-sessions/${token}/finish`);
      if (res.data?.success) {
        setIsCompleted(true);
      }
    } catch (err: any) {
      setError(getErrorMessage(err, 'Failed to complete session. Please try again.'));
    } finally {
      setFinishing(false);
    }
  };

  // Delete an unwanted photo before finishing
  const handleDeletePhoto = async (filename: string) => {
    if (!confirm('Are you sure you want to permanently delete this captured photo?')) return;
    try {
      setDeletingFilename(filename);
      setError(null);
      const safeFilename = encodeURIComponent(filename.split('/').pop() || filename);
      const res = await captureApi.delete(`/capture-sessions/${token}/images/${safeFilename}`);
      if (res.data?.success && res.data.data) {
        setSession((prev) =>
          prev
            ? {
                ...prev,
                count: res.data.data.count,
                scalpImages: res.data.data.scalpImages,
              }
            : null
        );
        setUploadSuccess('Photo deleted successfully.');
        setTimeout(() => setUploadSuccess(null), 3000);
      }
    } catch (err: any) {
      setError(getErrorMessage(err, 'Failed to delete photo.'));
    } finally {
      setDeletingFilename(null);
    }
  };

  // Dedicated Completion & Windup Screen
  if (isCompleted && session) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 p-5 flex flex-col justify-between max-w-md mx-auto">
        <div className="text-center pt-8">
          <div className="w-20 h-20 mx-auto rounded-3xl bg-emerald-500/15 border-2 border-emerald-500/40 text-emerald-400 flex items-center justify-center mb-5 shadow-2xl shadow-emerald-500/20">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
            Session Completed
          </span>

          <h2 className="text-2xl font-black text-white mt-3 tracking-tight">Scalp Examination Finished</h2>
          <p className="text-xs text-slate-400 mt-2 max-w-xs mx-auto leading-relaxed">
            All clinical scalp photos have been securely synchronized to Dr. {session.doctorName || 'Doctor'}&apos;s consultation terminal.
          </p>

          {/* Session Summary Card */}
          <div className="mt-6 p-4 rounded-2xl bg-slate-900/90 border border-slate-800 text-left space-y-2.5">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-800/80">
              <span className="text-xs text-slate-400">Patient Name</span>
              <span className="text-xs font-bold text-white">{session.patientName}</span>
            </div>
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-800/80">
              <span className="text-xs text-slate-400">UHID</span>
              <span className="text-xs font-mono text-slate-300">{session.patientUhid || 'N/A'}</span>
            </div>
            <div className="flex items-center justify-between pt-0.5">
              <span className="text-xs text-slate-400">Photos Saved</span>
              <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                {session.scalpImages.length} High-Res {session.scalpImages.length === 1 ? 'Photo' : 'Photos'}
              </span>
            </div>
          </div>

          {/* Synchronized Thumbnails Gallery */}
          {session.scalpImages.length > 0 && (
            <div className="mt-5 text-left">
              <p className="text-[11px] font-semibold text-slate-400 mb-2">Saved Consultation Photos ({session.scalpImages.length}):</p>
              <div className="grid grid-cols-3 gap-2">
                {session.scalpImages.map((img, idx) => (
                  <div key={img} className="relative aspect-square rounded-xl overflow-hidden border border-slate-800 bg-slate-900">
                    <img src={getMediaUrl(img)} alt={`Photo ${idx + 1}`} className="w-full h-full object-cover" />
                    <span className="absolute bottom-1 right-1 text-[9px] font-bold text-white bg-black/70 px-1 rounded">#{idx + 1}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="pb-4 pt-6 text-center">
          <p className="text-xs text-slate-500 mb-3">
            You can now safely close this browser window or navigate away.
          </p>
          <button
            type="button"
            onClick={() => {
              if (typeof window !== 'undefined') {
                window.close();
              }
            }}
            className="w-full py-3.5 rounded-xl font-bold text-sm bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 transition-colors"
          >
            Done • Close Window
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 text-center">
        <RefreshCw className="w-10 h-10 text-teal-400 animate-spin mb-4" />
        <h2 className="text-lg font-semibold">Connecting to Clinical Workbench...</h2>
        <p className="text-xs text-slate-400 mt-2">{connectionStatus}</p>
        {retryCount > 0 && (
          <p className="text-[11px] text-slate-500 mt-1">Attempt {retryCount + 1} of {maxRetries + 1}</p>
        )}
      </div>
    );
  }

  if (error && !session) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mb-4">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-lg font-bold text-red-400">Connection Failed</h2>
        <p className="text-sm text-slate-300 mt-2 max-w-sm">{error}</p>
        {retryCount < maxRetries && (
          <p className="text-[11px] text-teal-400 mt-2 animate-pulse">Auto-retrying... ({retryCount + 1}/{maxRetries})</p>
        )}
        <button
          onClick={() => { setRetryCount(0); setError(null); fetchSession(); }}
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

  // Doctor Password Verification Screen (Locked State)
  if (session && !isVerified) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center p-5 max-w-md mx-auto">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl">
          {/* Lock Icon */}
          <div className="w-14 h-14 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-teal-400 flex items-center justify-center mx-auto mb-4">
            <Shield className="w-7 h-7" />
          </div>

          <h2 className="text-xl font-bold text-center text-white">Doctor Verification</h2>
          <p className="text-xs text-slate-400 text-center mt-1">
            Authorize camera connection for active patient consultation
          </p>

          {/* Session Details Card */}
          <div className="mt-5 p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800/80 space-y-2 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Consultant:</span>
              <span className="font-semibold text-teal-400">{session.doctorName || 'Doctor'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Patient:</span>
              <span className="font-semibold text-white">{session.patientName}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">UHID:</span>
              <span className="font-mono text-slate-300">{session.patientUhid || 'N/A'}</span>
            </div>
          </div>

          {/* Password Form */}
          <form onSubmit={handleVerifyPassword} className="mt-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Doctor's Account Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password to unlock..."
                autoFocus
                className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all"
              />
            </div>

            {passwordError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{passwordError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={verifyingPassword || !password.trim()}
              className="w-full py-3.5 rounded-xl font-semibold text-sm bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-slate-950 shadow-lg shadow-teal-500/20 transition-all flex items-center justify-center gap-2"
            >
              {verifyingPassword ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Verifying Password...</span>
                </>
              ) : (
                <>
                  <Shield className="w-4 h-4" />
                  <span>Unlock Clinical Camera</span>
                </>
              )}
            </button>
          </form>

          <p className="text-[11px] text-slate-500 text-center mt-4">
            Works from any network or mobile data. Protected by end-to-end clinic credentials.
          </p>
        </div>
      </div>
    );
  }

  const isMaxReached = (session?.count || 0) >= (session?.maxImages || 5);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-5 max-w-md mx-auto">
      {/* Hidden file input for gallery/file fallback (without capture="environment" to avoid OS memory crash) */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Top Clinic Branding Header */}
      <div>
        <header className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-white">DermaTrack Mobile</h1>
              <p className="text-[11px] text-teal-400 font-medium">Scalp Phototrichogram Capture</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-[11px] text-slate-300">
            <Shield className="w-3.5 h-3.5 text-teal-400" />
            <span>Secure Link</span>
          </div>
        </header>

        {/* Patient Card */}
        {session && (
          <div className="mt-5 p-4 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-md">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded-full border border-teal-500/20 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-teal-400" />
                    Dr. {session.doctorName || 'Doctor'} Verified
                  </span>
                </div>
                <p className="text-xs text-slate-400">Active Patient</p>
                <h2 className="text-base font-bold text-white mt-0.5">{session.patientName}</h2>
                <p className="text-xs font-mono text-slate-400 mt-0.5">UHID: {session.patientUhid || 'N/A'}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-400">Visit Photos</p>
                <span
                  className={`inline-block text-sm font-bold mt-0.5 px-2.5 py-0.5 rounded-full border ${
                    isMaxReached
                      ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                      : 'bg-teal-500/10 text-teal-400 border-teal-500/30'
                  }`}
                >
                  {session.count} / {session.maxImages}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Upload Success Alert */}
        {uploadSuccess && (
          <div className="mt-4 p-3.5 rounded-xl bg-teal-500/15 border border-teal-500/30 text-teal-300 text-xs flex items-center gap-2.5 animate-fadeIn">
            <CheckCircle2 className="w-5 h-5 shrink-0 text-teal-400" />
            <span>{uploadSuccess}</span>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="mt-4 p-3.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs flex items-center gap-2.5 animate-fadeIn">
            <AlertCircle className="w-5 h-5 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Photos in current visit */}
        {session && session.scalpImages.length > 0 && (
          <div className="mt-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-300">
                Captured Photos ({session.scalpImages.length})
              </span>
              <span className="text-[11px] text-slate-500">Uncompressed Quality</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {session.scalpImages.map((img, idx) => (
                <div
                  key={img}
                  className="relative group aspect-square rounded-xl overflow-hidden border border-slate-800 bg-slate-900"
                >
                  <img
                    src={getMediaUrl(img)}
                    alt={`Photo ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <span className="absolute bottom-1 right-1 text-[10px] font-bold text-white bg-black/70 px-1.5 py-0.5 rounded pointer-events-none">
                    #{idx + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDeletePhoto(img)}
                    disabled={deletingFilename === img}
                    title="Delete this photo"
                    className="absolute top-1.5 right-1.5 z-10 w-7 h-7 rounded-lg bg-red-600/90 hover:bg-red-600 text-white flex items-center justify-center shadow-lg active:scale-90 transition-transform"
                  >
                    {deletingFilename === img ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Main Action Button */}
      <div className="pt-6 pb-2">
        <button
          type="button"
          onClick={triggerCamera}
          disabled={isMaxReached || uploading}
          className={`w-full py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-3 transition-all shadow-xl active:scale-[0.98] ${
            isMaxReached
              ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
              : uploading
              ? 'bg-teal-700 text-white cursor-wait'
              : 'bg-teal-500 hover:bg-teal-400 text-slate-950 shadow-teal-500/25'
          }`}
        >
          {uploading ? (
            <>
              <RefreshCw className="w-5 h-5 animate-spin" />
              <span>Saving Photo...</span>
            </>
          ) : isMaxReached ? (
            <>
              <CheckCircle2 className="w-5 h-5 text-amber-400" />
              <span>Max 5 Photos Captured</span>
            </>
          ) : (
            <>
              <Camera className="w-5 h-5" />
              <span>Open Live Camera ({session?.count || 0}/5)</span>
            </>
          )}
        </button>

        {/* Gallery / File Fallback Button */}
        {!isMaxReached && (
          <button
            type="button"
            onClick={triggerGallery}
            disabled={uploading}
            className="w-full mt-2.5 py-2.5 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 bg-slate-900/60 hover:bg-slate-800 border border-slate-800 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
          >
            <ImageIcon className="w-3.5 h-3.5 text-teal-400" />
            <span>Upload from Gallery / Files</span>
          </button>
        )}

        {/* Finish & Windup Button (allows doctor to finish after e.g. 2 photos) */}
        {session && session.scalpImages.length > 0 && (
          <button
            type="button"
            onClick={handleFinishSession}
            disabled={finishing || uploading}
            className="w-full mt-3 py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2.5 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 shadow-xl shadow-emerald-500/25 active:scale-[0.98] transition-all"
          >
            {finishing ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span>Completing & Syncing Session...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-5 h-5 text-slate-950" />
                <span>Finish & Windup Session ({session.scalpImages.length} {session.scalpImages.length === 1 ? 'Photo' : 'Photos'}) ✓</span>
              </>
            )}
          </button>
        )}

        <p className="text-center text-[11px] text-slate-500 mt-3">
          Captures in-browser with live alignment grid. Automatically synchronizes with doctor consultation.
        </p>
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
        title={session?.patientName ? `Capture: ${session.patientName}` : 'Scalp Photo Viewfinder'}
      />
    </div>
  );
}
