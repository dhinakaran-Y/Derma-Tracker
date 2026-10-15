'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Camera, X, RefreshCw, SwitchCamera, AlertCircle, Grid, Zap } from 'lucide-react';

interface MobileCameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (blob: Blob) => Promise<void>;
  uploading: boolean;
  uploadProgress?: number | null;
  title?: string;
}

export function MobileCameraModal({
  isOpen,
  onClose,
  onCapture,
  uploading,
  uploadProgress = null,
  title = 'Scalp Photo Viewfinder',
}: MobileCameraModalProps) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [showGrid, setShowGrid] = useState(true);
  const [flashAnimation, setFlashAnimation] = useState(false);
  const [startingCamera, setStartingCamera] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Stop camera tracks helper
  const stopTracks = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  }, [stream]);

  const fallbackInputRef = useRef<HTMLInputElement | null>(null);

  const handleNativeCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await onCapture(file);
      stopTracks();
      onClose();
    } catch {}
    if (fallbackInputRef.current) {
      fallbackInputRef.current.value = '';
    }
  };

  // Start camera stream
  const startCamera = useCallback(async (mode: 'environment' | 'user') => {
    try {
      setStartingCamera(true);
      setCameraError(null);

      // Stop previous stream
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }

      if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        const isHttpLan = typeof window !== 'undefined' &&
          window.location.protocol === 'http:' &&
          !['localhost', '127.0.0.1'].includes(window.location.hostname);

        setCameraError(
          isHttpLan
            ? 'Live video viewfinder requires HTTPS on mobile devices. You can use your Phone Camera directly below to capture photos.'
            : 'Live camera is not supported in this browser. Please use your Phone Camera directly below.'
        );
        return;
      }

      const newStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: mode },
          width: { ideal: 1920, max: 1920 },
          height: { ideal: 1080, max: 1080 },
        },
        audio: false,
      });

      setStream(newStream);

      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
      }
    } catch (err: any) {
      console.warn('Camera access unavailable:', err?.message || err);
      let msg = 'Could not access phone camera.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        msg = 'Camera permission denied. Please allow camera access in browser site settings, or use the Phone Camera button below.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        msg = 'No camera found on this device. Use the Phone Camera button below.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        msg = 'Camera is already in use by another app. Please close other camera apps and retry.';
      } else if (err.message) {
        msg = err.message;
      }
      setCameraError(msg);
    } finally {
      setStartingCamera(false);
    }
  }, [stream]);

  // Open/close lifecycle
  useEffect(() => {
    if (isOpen) {
      startCamera(facingMode);
    } else {
      stopTracks();
    }
    return () => {
      stopTracks();
    };
  }, [isOpen, facingMode]);

  const handleSwitchCamera = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  const handleCapture = async () => {
    if (!videoRef.current || uploading || startingCamera) return;

    try {
      setFlashAnimation(true);
      setTimeout(() => setFlashAnimation(false), 250);

      const video = videoRef.current;
      const width = video.videoWidth || 1280;
      const height = video.videoHeight || 720;

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not create canvas context');

      // If user camera, mirror horizontally for natural feel
      if (facingMode === 'user') {
        ctx.translate(width, 0);
        ctx.scale(-1, 1);
      }

      ctx.drawImage(video, 0, 0, width, height);

      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.88);
      });

      if (!blob) throw new Error('Failed to generate image from camera');

      await onCapture(blob);
    } catch (err: any) {
      setCameraError(err.message || 'Failed to capture photo.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col justify-between select-none animate-in fade-in duration-200">
      {/* Shutter flash effect */}
      {flashAnimation && (
        <div className="absolute inset-0 bg-white pointer-events-none z-50 animate-out fade-out duration-200" />
      )}

      {/* Top Controls Bar */}
      <div className="relative z-20 flex items-center justify-between p-4 bg-gradient-to-b from-black/80 via-black/40 to-transparent">
        <button
          type="button"
          onClick={() => {
            stopTracks();
            onClose();
          }}
          className="w-10 h-10 rounded-full bg-slate-900/80 border border-slate-700/80 text-white flex items-center justify-center active:scale-95 transition-all shadow-md"
          aria-label="Close camera"
        >
          <X className="w-5 h-5" />
        </button>

        <span className="text-xs font-semibold text-slate-200 bg-slate-900/60 backdrop-blur-md px-3 py-1 rounded-full border border-slate-700/50">
          {title}
        </span>

        <button
          type="button"
          onClick={() => setShowGrid((prev) => !prev)}
          className={`w-10 h-10 rounded-full border flex items-center justify-center active:scale-95 transition-all shadow-md ${
            showGrid
              ? 'bg-teal-500/20 border-teal-500 text-teal-300'
              : 'bg-slate-900/80 border-slate-700/80 text-slate-400'
          }`}
          aria-label="Toggle grid"
        >
          <Grid className="w-5 h-5" />
        </button>
      </div>

      {/* Viewfinder Viewport */}
      <div className="relative flex-1 flex items-center justify-center overflow-hidden bg-black">
        {cameraError ? (
          <div className="p-6 text-center max-w-sm space-y-4">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center">
              <Camera className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white mb-1.5">Capture with Phone Camera</h3>
              <p className="text-xs text-slate-300 leading-relaxed">{cameraError}</p>
            </div>

            <div className="space-y-2.5 pt-2">
              <label className="w-full py-3.5 px-4 rounded-xl font-bold text-sm bg-teal-600 hover:bg-teal-500 active:bg-teal-700 text-white flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-teal-600/30 active:scale-[0.98] transition-all">
                <Camera className="w-4 h-4" />
                <span>📸 Open Native Camera</span>
                <input
                  ref={fallbackInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleNativeCapture}
                />
              </label>

              <button
                type="button"
                onClick={() => startCamera(facingMode)}
                className="w-full py-2 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-300 font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry Live Stream</span>
              </button>
            </div>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
              onLoadedMetadata={() => {
                if (videoRef.current) {
                  videoRef.current.play().catch(() => {});
                }
              }}
            />

            {/* Grid Overlay for Alignment */}
            {showGrid && (
              <div className="absolute inset-0 pointer-events-none grid grid-cols-3 grid-rows-3 border border-white/20">
                <div className="border-r border-b border-white/20" />
                <div className="border-r border-b border-white/20" />
                <div className="border-b border-white/20" />
                <div className="border-r border-b border-white/20" />
                <div className="border-r border-b border-white/20 flex items-center justify-center">
                  <div className="w-8 h-8 rounded-full border border-teal-400/40" />
                </div>
                <div className="border-b border-white/20" />
                <div className="border-r border-white/20" />
                <div className="border-r border-white/20" />
                <div />
              </div>
            )}

            {/* Starting / Loading Overlay */}
            {startingCamera && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm z-10">
                <RefreshCw className="w-8 h-8 text-teal-400 animate-spin mb-2" />
                <span className="text-xs text-slate-300 font-medium">Opening camera...</span>
              </div>
            )}
          </>
        )}

        {/* Upload Progress Overlay */}
        {uploading && uploadProgress !== null && (
          <div className="absolute bottom-0 inset-x-0 z-15 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-4 pointer-events-none">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-semibold text-teal-300">
                {uploadProgress >= 100 ? '✓ Photo synced!' : 'Uploading photo...'}
              </span>
              <span className="text-xs font-bold font-mono text-teal-400">{uploadProgress}%</span>
            </div>
            <div className="w-full h-2 bg-slate-800/80 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ease-out ${
                  uploadProgress >= 100
                    ? 'bg-gradient-to-r from-emerald-500 to-emerald-400'
                    : 'bg-gradient-to-r from-teal-600 via-teal-400 to-cyan-400'
                }`}
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Bottom Shutter & Controls Bar */}
      <div className="relative z-20 flex items-center justify-around p-6 bg-gradient-to-t from-black via-black/80 to-transparent">
        {/* Switch Camera */}
        <button
          type="button"
          onClick={handleSwitchCamera}
          disabled={uploading || startingCamera}
          className="w-12 h-12 rounded-full bg-slate-900/80 border border-slate-700/80 text-white flex items-center justify-center active:scale-90 transition-all shadow-md disabled:opacity-50"
          aria-label="Switch camera"
        >
          <SwitchCamera className="w-5 h-5" />
        </button>

        {/* Shutter Button / Native Snap Button */}
        {cameraError ? (
          <button
            type="button"
            onClick={() => fallbackInputRef.current?.click()}
            disabled={uploading}
            className="w-20 h-20 rounded-full border-4 border-teal-400 bg-teal-500 hover:bg-teal-400 text-white flex flex-col items-center justify-center transition-transform active:scale-95 shadow-xl shadow-teal-500/40 cursor-pointer"
            title="Snap with phone camera"
          >
            <Camera className="w-7 h-7 text-white" />
            <span className="text-[10px] font-bold uppercase mt-0.5">Snap</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={handleCapture}
            disabled={uploading || startingCamera}
            className={`w-20 h-20 rounded-full border-4 flex items-center justify-center transition-transform active:scale-95 shadow-xl ${
              uploading
                ? 'border-slate-600 bg-slate-800 text-slate-400'
                : 'border-white bg-teal-500 hover:bg-teal-400 text-white shadow-teal-500/40'
            }`}
            aria-label="Take photo"
          >
            {uploading ? (
              <RefreshCw className="w-7 h-7 animate-spin text-white" />
            ) : (
              <div className="w-14 h-14 rounded-full border-2 border-white/60 bg-white/20 flex items-center justify-center">
                <Camera className="w-6 h-6 text-white" />
              </div>
            )}
          </button>
        )}

        {/* Done / Close Viewfinder */}
        <button
          type="button"
          onClick={() => {
            stopTracks();
            onClose();
          }}
          className="w-12 h-12 rounded-full bg-slate-900/80 border border-slate-700/80 text-emerald-400 flex items-center justify-center text-xs font-bold active:scale-90 transition-all shadow-md"
        >
          Done
        </button>
      </div>
    </div>
  );
}
