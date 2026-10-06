'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Camera, RefreshCw, X, Check, AlertCircle, Trash2, SwitchCamera } from 'lucide-react';
import { api, getMediaUrl, getErrorMessage } from '@/lib/api';

interface ScalpCameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  visitId: string;
  patientName?: string;
  initialImages?: string[];
  onImagesUpdated: (images: string[]) => void;
}

export function ScalpCameraModal({
  isOpen,
  onClose,
  visitId,
  patientName,
  initialImages = [],
  onImagesUpdated,
}: ScalpCameraModalProps) {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [images, setImages] = useState<string[]>(initialImages);
  const [deletingFilename, setDeletingFilename] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Sync initial images
  useEffect(() => {
    setImages(initialImages);
  }, [initialImages]);

  // Enumerate video devices
  useEffect(() => {
    if (!isOpen) return;

    let mounted = true;

    async function getDevices() {
      try {
        setError(null);
        // Request temporary stream to get permissions so device labels are visible
        const initialStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        initialStream.getTracks().forEach((track) => track.stop());

        const deviceList = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = deviceList.filter((d) => d.kind === 'videoinput');

        if (mounted) {
          setDevices(videoInputs);
          if (videoInputs.length > 0 && !selectedDeviceId) {
            setSelectedDeviceId(videoInputs[0].deviceId);
          }
        }
      } catch (err) {
        if (mounted) {
          setError('Camera permission denied or camera not accessible. Please grant browser camera permissions.');
        }
      }
    }

    getDevices();

    return () => {
      mounted = false;
    };
  }, [isOpen]);

  // Start selected camera stream
  useEffect(() => {
    if (!isOpen || !selectedDeviceId) return;

    let activeStream: MediaStream | null = null;

    async function startCamera() {
      try {
        setError(null);
        // Stop any existing stream
        if (stream) {
          stream.getTracks().forEach((track) => track.stop());
        }

        // Request maximum sensor resolution (e.g. 4K / 1080p)
        const newStream = await navigator.mediaDevices.getUserMedia({
          video: {
            deviceId: { exact: selectedDeviceId },
            width: { ideal: 3840, min: 1280 },
            height: { ideal: 2160, min: 720 },
          },
          audio: false,
        });

        activeStream = newStream;
        setStream(newStream);

        if (videoRef.current) {
          videoRef.current.srcObject = newStream;
        }
      } catch (err: any) {
        setError('Failed to start selected camera: ' + (err?.message || 'Unknown error'));
      }
    }

    startCamera();

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [isOpen, selectedDeviceId]);

  // Cleanup on close
  const handleClose = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    onClose();
  };

  // Capture frame & upload
  const handleCapture = async () => {
    if (!videoRef.current || images.length >= 5 || uploading) return;

    try {
      setCapturing(true);
      setError(null);

      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 1920;
      canvas.height = video.videoHeight || 1080;

      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context unavailable');

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Convert canvas to uncompressed/high-quality JPEG Blob
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((b) => resolve(b), 'image/jpeg', 1.0);
      });

      if (!blob) throw new Error('Failed to create image frame from camera');

      setUploading(true);
      const formData = new FormData();
      formData.append('image', blob, `scalp-${Date.now()}.jpg`);

      const res = await api.post(`/doctor/visits/${visitId}/images`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (res.data?.success && res.data.data?.scalpImages) {
        const updated = res.data.data.scalpImages;
        setImages(updated);
        onImagesUpdated(updated);
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to capture or upload photo'));
    } finally {
      setCapturing(false);
      setUploading(false);
    }
  };

  // Delete image
  const handleDelete = async (filename: string) => {
    if (!confirm('Are you sure you want to delete this clinical photo?')) return;

    try {
      setDeletingFilename(filename);
      const cleanTarget = filename.split('/').pop() || filename;
      const safeFilename = encodeURIComponent(cleanTarget);
      const res = await api.delete(`/doctor/visits/${visitId}/images/${safeFilename}`);
      if (res.data?.success && res.data.data?.scalpImages) {
        const updated = res.data.data.scalpImages;
        setImages(updated);
        onImagesUpdated(updated);
      }
    } catch (err) {
      alert(getErrorMessage(err, 'Failed to delete image'));
    } finally {
      setDeletingFilename(null);
    }
  };

  if (!isOpen) return null;

  const isMaxReached = images.length >= 5;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-4xl bg-[var(--surface-1)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] bg-[var(--surface-2)]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[var(--text)]">System Camera Capture</h2>
              <p className="text-xs text-[var(--text-dim)]">
                {patientName ? `Patient: ${patientName} • ` : ''}Webcam, USB Dermatoscope & External Trichoscope
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span
              className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
                isMaxReached
                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
                  : 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/30'
              }`}
            >
              {images.length} / 5 Images
            </span>
            <button
              onClick={handleClose}
              className="p-1.5 text-[var(--text-dim)] hover:text-[var(--text)] rounded-lg hover:bg-[var(--surface-3)] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Camera Selector & Errors */}
        <div className="px-6 py-3 bg-[var(--surface-2)]/60 border-b border-[var(--border)] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <SwitchCamera className="w-4 h-4 text-[var(--text-dim)]" />
            <label className="text-xs font-medium text-[var(--text-dim)]">Camera Device:</label>
            <select
              value={selectedDeviceId}
              onChange={(e) => setSelectedDeviceId(e.target.value)}
              className="px-3 py-1.5 text-xs bg-[var(--surface-1)] border border-[var(--border)] rounded-lg text-[var(--text)] focus:outline-none focus:border-teal-500"
            >
              {devices.map((device, idx) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Camera ${idx + 1}`}
                </option>
              ))}
            </select>
          </div>

          {isMaxReached && (
            <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 font-medium">
              <AlertCircle className="w-4 h-4" />
              Maximum 5 images reached for this visit. Delete an image to capture another.
            </div>
          )}
        </div>

        {error && (
          <div className="mx-6 mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Viewfinder Preview */}
        <div className="flex-1 min-h-[360px] bg-black relative flex items-center justify-center overflow-hidden">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-contain max-h-[50vh]"
          />

          {/* Crosshair Overlay for Trichoscopy centering */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-30">
            <div className="w-24 h-24 border border-white/60 rounded-full flex items-center justify-center">
              <div className="w-2 h-2 bg-teal-400 rounded-full" />
            </div>
          </div>

          {/* Shutter flash effect */}
          {capturing && <div className="absolute inset-0 bg-white/70 animate-pulse pointer-events-none" />}
        </div>

        {/* Controls & Thumbnail Strip */}
        <div className="p-5 bg-[var(--surface-2)] border-t border-[var(--border)] flex flex-col gap-4">
          <div className="flex items-center justify-between">
            {/* Captured Photos Thumbnail Strip */}
            <div className="flex items-center gap-2 overflow-x-auto py-1 max-w-[65%]">
              {images.length === 0 ? (
                <span className="text-xs text-[var(--text-dim)] italic">No photos captured in this session yet</span>
              ) : (
                images.map((img, idx) => (
                  <div key={img} className="relative group w-14 h-14 rounded-lg overflow-hidden border border-[var(--border)] shrink-0 bg-black">
                    <img
                      src={getMediaUrl(img)}
                      alt={`Scalp photo ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <button
                      onClick={() => handleDelete(img)}
                      disabled={deletingFilename === img}
                      title="Delete this image"
                      className="absolute inset-0 bg-red-900/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      {deletingFilename === img ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <span className="absolute bottom-0.5 right-1 text-[9px] font-bold text-white bg-black/60 px-1 rounded">
                      #{idx + 1}
                    </span>
                  </div>
                ))
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleCapture}
                disabled={isMaxReached || uploading || capturing || !selectedDeviceId}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-md ${
                  isMaxReached || !selectedDeviceId
                    ? 'bg-[var(--surface-3)] text-[var(--text-dim)] cursor-not-allowed'
                    : 'bg-teal-600 hover:bg-teal-500 active:scale-95 text-white shadow-teal-500/20'
                }`}
              >
                {uploading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Saving Original...</span>
                  </>
                ) : (
                  <>
                    <Camera className="w-4 h-4" />
                    <span>Capture Photo ({images.length}/5)</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2.5 rounded-xl border border-[var(--border)] text-[var(--text)] hover:bg-[var(--surface-3)] text-sm font-medium transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
