'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Calendar,
  Layers,
  ZoomIn,
  Trash2,
  SlidersHorizontal,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Image as ImageIcon,
  CheckSquare,
  Square,
  Clock,
  Sparkles,
  Info,
} from 'lucide-react';
import { api, getMediaUrl, getErrorMessage } from '@/lib/api';
import { ImageLightboxModal } from '@/components/ImageLightboxModal';
import { ScalpCompareModal, ComparisonImageItem } from '@/components/ScalpCompareModal';
import { toast } from 'sonner';

interface PatientData {
  _id: string;
  name: string;
  phone: string;
  patientId: string;
  dateOfBirth?: string;
  gender?: string;
  bloodGroup?: string;
}

interface VisitGalleryItem {
  _id: string;
  visitDate: string;
  status: string;
  chiefComplaints?: string;
  diagnosis?: string;
  visitType?: string;
  scalpImages: string[];
  createdAt: string;
}

function ScalpGalleryContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const patientId = searchParams?.get('patientId');
  const currentVisitId = searchParams?.get('visitId');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [patient, setPatient] = useState<PatientData | null>(null);
  const [visits, setVisits] = useState<VisitGalleryItem[]>([]);

  // Compare mode state
  const [compareMode, setCompareMode] = useState(false);
  const [selectedForCompare, setSelectedForCompare] = useState<ComparisonImageItem[]>([]);
  const [showCompareModal, setShowCompareModal] = useState(false);

  // Lightbox state
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxSubtitle, setLightboxSubtitle] = useState('');
  const [activeLightboxVisitId, setActiveLightboxVisitId] = useState<string | null>(null);

  // Fetch gallery data
  const fetchGallery = async () => {
    if (!patientId) {
      setError('Missing patient ID in query parameters.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const res = await api.get(`/doctor/patients/${patientId}/scalp-gallery`);
      if (res.data?.success && res.data.data) {
        setPatient(res.data.data.patient);
        setVisits(res.data.data.visits || []);
      }
    } catch (err: any) {
      setError(getErrorMessage(err, 'Failed to load scalp phototrichogram gallery.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGallery();
  }, [patientId]);

  const [confirmDeleteKey, setConfirmDeleteKey] = useState<string | null>(null);

  // Delete image
  const handleDeleteImage = async (visitId: string, filename: string, skipConfirm = false) => {
    const key = `${visitId}-${filename}`;
    if (!skipConfirm && confirmDeleteKey !== key) {
      setConfirmDeleteKey(key);
      setTimeout(() => setConfirmDeleteKey(null), 4000);
      return;
    }
    setConfirmDeleteKey(null);

    try {
      const cleanTarget = filename.split('/').pop() || filename;
      const safeFilename = encodeURIComponent(cleanTarget);
      const res = await api.delete(`/doctor/visits/${visitId}/images/${safeFilename}`);
      if (res.data?.success) {
        toast.success('Scalp photo deleted successfully');
        // Update local state
        setVisits((prev) =>
          prev
            .map((v) => {
              if (v._id === visitId) {
                return {
                  ...v,
                  scalpImages: v.scalpImages.filter(
                    (img) => img !== filename && (img.split('/').pop() || img) !== cleanTarget
                  ),
                };
              }
              return v;
            })
            .filter((v) => v.scalpImages.length > 0)
        );

        // Also remove from selected comparison if present
        setSelectedForCompare((prev) =>
          prev.filter(
            (item) => item.filename !== filename && (item.filename.split('/').pop() || item.filename) !== cleanTarget
          )
        );
      }
    } catch (err) {
      alert(getErrorMessage(err, 'Failed to delete photo.'));
    }
  };

  // Open Lightbox
  const handleOpenLightbox = (visit: VisitGalleryItem, imageIndex: number) => {
    setLightboxImages(visit.scalpImages);
    setLightboxIndex(imageIndex);
    setActiveLightboxVisitId(visit._id);
    setLightboxSubtitle(
      `Visit Date: ${new Date(visit.visitDate).toLocaleDateString()} • ${visit.visitType || 'Follow-up'}`
    );
    setLightboxOpen(true);
  };

  // Toggle selection for comparison
  const handleToggleCompareImage = (item: ComparisonImageItem) => {
    setSelectedForCompare((prev) => {
      const exists = prev.some((p) => p.filename === item.filename);
      if (exists) {
        return prev.filter((p) => p.filename !== item.filename);
      } else {
        if (prev.length >= 2) {
          // Replace second image or alert
          return [prev[0], item];
        }
        return [...prev, item];
      }
    });
  };

  const isSelected = (filename: string) => selectedForCompare.some((p) => p.filename === filename);

  const totalImages = visits.reduce((acc, v) => acc + (v.scalpImages?.length || 0), 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex flex-col items-center justify-center p-6 text-[var(--text)]">
        <RefreshCw className="w-10 h-10 text-teal-500 animate-spin mb-4" />
        <p className="text-sm font-semibold">Loading Scalp Phototrichogram Gallery...</p>
      </div>
    );
  }

  if (error || !patient) {
    return (
      <div className="min-h-screen bg-[var(--background)] p-8 flex flex-col items-center justify-center text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mb-3" />
        <h2 className="text-lg font-bold text-[var(--text)]">Unable to Load Gallery</h2>
        <p className="text-sm text-[var(--text-dim)] mt-1 max-w-md">{error || 'Patient not found'}</p>
        <button
          onClick={() => router.back()}
          className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-sm font-medium border border-[var(--border)] text-[var(--text)]"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Consultation</span>
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--text)] pb-24">
      {/* Top Header Bar */}
      <header className="sticky top-0 z-30 bg-[var(--surface-1)]/90 backdrop-blur-md border-b border-[var(--border)] px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="p-2 rounded-xl bg-[var(--surface-2)] hover:bg-[var(--surface-3)] border border-[var(--border)] text-[var(--text)] transition-colors"
              title="Return to Doctor Consultation Workbench"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-lg font-bold tracking-tight text-[var(--text)]">
                  Scalp Phototrichogram Gallery
                </h1>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20">
                  {totalImages} Total Photos
                </span>
              </div>
              <p className="text-xs text-[var(--text-dim)] mt-0.5">
                Patient: <span className="font-semibold text-[var(--text)]">{patient.name}</span> • UHID:{' '}
                <span className="font-mono text-teal-600 dark:text-teal-400">{patient.patientId}</span> • Gender:{' '}
                {patient.gender || 'N/A'}
              </p>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setCompareMode(!compareMode);
                if (compareMode) setSelectedForCompare([]);
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all border shadow-sm ${
                compareMode
                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-600 dark:text-amber-400 ring-2 ring-amber-500/20'
                  : 'bg-[var(--surface-2)] hover:bg-[var(--surface-3)] border-[var(--border)] text-[var(--text)]'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span>{compareMode ? 'Exit Compare Mode' : '⚖️ Compare Photos'}</span>
            </button>

            {compareMode && selectedForCompare.length === 2 && (
              <button
                onClick={() => setShowCompareModal(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-500 text-white shadow-md shadow-teal-500/25 animate-pulse"
              >
                <Sparkles className="w-4 h-4" />
                <span>Launch Comparison View</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Compare Mode Instructions Banner */}
      {compareMode && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-2.5 text-xs text-amber-700 dark:text-amber-300 font-medium">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-amber-500 shrink-0" />
              <span>
                Click any 2 photos across visits to compare them side-by-side or with the interactive follicle density slider.
              </span>
            </div>
            <div className="font-bold">
              Selected: {selectedForCompare.length} / 2 photos
            </div>
          </div>
        </div>
      )}

      {/* Main Gallery Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {visits.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-[var(--surface-1)] border border-[var(--border)] max-w-lg mx-auto mt-8">
            <ImageIcon className="w-12 h-12 text-[var(--text-dim)] mx-auto mb-3 opacity-40" />
            <h3 className="text-base font-bold text-[var(--text)]">No Scalp Images Recorded Yet</h3>
            <p className="text-xs text-[var(--text-dim)] mt-1">
              Capture photos in the doctor consultation workbench using the System Camera or Mobile QR Camera to start chronological tracking.
            </p>
            <button
              onClick={() => router.back()}
              className="mt-6 px-4 py-2 rounded-xl bg-teal-600 text-white text-xs font-semibold hover:bg-teal-500 transition-colors shadow-sm"
            >
              Return to Consultation
            </button>
          </div>
        ) : (
          <div className="space-y-10">
            {visits.map((visit, vIdx) => {
              const visitDateFormatted = new Date(visit.visitDate).toLocaleDateString('en-US', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              });

              const isCurrentVisit = currentVisitId === visit._id;
              const visitNum = visits.length - vIdx;

              return (
                <section
                  key={visit._id}
                  className={`p-6 rounded-2xl border transition-all ${
                    isCurrentVisit
                      ? 'bg-[var(--surface-1)] border-teal-500/40 shadow-lg shadow-teal-500/5'
                      : 'bg-[var(--surface-1)] border-[var(--border)]'
                  }`}
                >
                  {/* Date & Visit Header */}
                  <div className="flex flex-wrap items-center justify-between pb-4 border-b border-[var(--border)] gap-2">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20">
                        <Calendar className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-base font-bold text-[var(--text)]">
                            {visitDateFormatted}
                          </h2>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--surface-2)] text-[var(--text-dim)] border border-[var(--border)]">
                            Visit #{visitNum}
                          </span>
                          {isCurrentVisit && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-teal-500/15 text-teal-600 dark:text-teal-400 font-bold border border-teal-500/30">
                              Active Visit
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[var(--text-dim)] mt-0.5">
                          {visit.diagnosis ? `Diagnosis: ${visit.diagnosis}` : 'Scalp Examination Session'} •{' '}
                          {visit.scalpImages.length} images captured (Max 5)
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Scalp Photos Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 mt-6">
                    {visit.scalpImages.map((img, imgIdx) => {
                      const compareItem: ComparisonImageItem = {
                        filename: img,
                        visitDate: visit.visitDate,
                        visitNumber: visitNum,
                        label: `Visit #${visitNum} (${visitDateFormatted}) - Photo #${imgIdx + 1}`,
                      };

                      const checked = isSelected(img);

                      return (
                        <div
                          key={img}
                          className={`group relative aspect-square rounded-xl overflow-hidden border-2 bg-black transition-all shadow-md ${
                            checked
                              ? 'border-amber-500 ring-4 ring-amber-500/20 scale-[1.02]'
                              : 'border-[var(--border)] hover:border-teal-500/60'
                          }`}
                        >
                          {/* Uncompressed Image */}
                          <img
                            src={getMediaUrl(img)}
                            alt={`Scalp photo ${imgIdx + 1} on ${visitDateFormatted}`}
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                            style={{ imageRendering: 'auto' }}
                          />

                          {/* Index Badge */}
                          <div className="absolute top-2 left-2 z-10 px-2 py-0.5 rounded bg-black/70 backdrop-blur-xs text-[10px] font-bold text-white">
                            #{imgIdx + 1}
                          </div>

                          {/* Compare Checkbox (when in compare mode) */}
                          {compareMode && (
                            <button
                              type="button"
                              onClick={() => handleToggleCompareImage(compareItem)}
                              className="absolute top-2 right-2 z-20 p-1.5 rounded-lg bg-black/80 text-white shadow-lg hover:scale-110 transition-transform"
                            >
                              {checked ? (
                                <CheckSquare className="w-5 h-5 text-amber-400" />
                              ) : (
                                <Square className="w-5 h-5 text-white/70" />
                              )}
                            </button>
                          )}

                          {/* Hover Overlay Actions */}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3 gap-2">
                            <div className="flex items-center justify-between gap-1">
                              <button
                                type="button"
                                onClick={() => handleOpenLightbox(visit, imgIdx)}
                                title="Open in Full Screen Lightbox"
                                className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg bg-white/20 hover:bg-white/30 text-white text-xs font-semibold backdrop-blur-md transition-colors"
                              >
                                <ZoomIn className="w-3.5 h-3.5" />
                                <span>Zoom</span>
                              </button>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteImage(visit._id, img);
                                }}
                                title={confirmDeleteKey === `${visit._id}-${img}` ? "Click again to confirm delete" : "Delete this scalp photo"}
                                className={`p-1.5 rounded-lg text-white transition-all flex items-center gap-1 ${
                                  confirmDeleteKey === `${visit._id}-${img}`
                                    ? 'bg-red-600 px-2 text-[10px] font-bold animate-pulse'
                                    : 'bg-red-600/80 hover:bg-red-600'
                                }`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                {confirmDeleteKey === `${visit._id}-${img}` && <span>Confirm?</span>}
                              </button>
                            </div>

                            {compareMode && (
                              <button
                                type="button"
                                onClick={() => handleToggleCompareImage(compareItem)}
                                className={`w-full py-1 rounded-lg text-[11px] font-bold transition-colors ${
                                  checked
                                    ? 'bg-amber-500 text-black'
                                    : 'bg-white/90 text-black hover:bg-white'
                                }`}
                              >
                                {checked ? 'Selected for Compare ✓' : 'Select for Compare'}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </main>

      {/* Floating Compare Action Bar when 2 are selected */}
      {compareMode && selectedForCompare.length === 2 && (
        <div className="fixed bottom-6 inset-x-0 flex justify-center z-40 px-4 animate-slideUp">
          <div className="flex items-center gap-4 px-6 py-3.5 bg-slate-900 border border-teal-500/40 rounded-2xl shadow-2xl backdrop-blur-xl text-white">
            <div className="flex items-center gap-3">
              <Sparkles className="w-5 h-5 text-teal-400" />
              <div className="text-xs">
                <p className="font-bold text-white">2 Photos Selected for Comparison</p>
                <p className="text-slate-400">{selectedForCompare[0].label?.split(' - ')[0]} vs {selectedForCompare[1].label?.split(' - ')[0]}</p>
              </div>
            </div>

            <button
              onClick={() => setShowCompareModal(true)}
              className="px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs shadow-lg shadow-teal-500/30 transition-transform active:scale-95"
            >
              Launch Comparison View →
            </button>
          </div>
        </div>
      )}

      {/* Lightbox Modal */}
      <ImageLightboxModal
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        images={lightboxImages}
        initialIndex={lightboxIndex}
        title={`Patient Scalp Record: ${patient.name}`}
        subtitle={lightboxSubtitle}
        onDeleteImage={
          activeLightboxVisitId
            ? (filename) => handleDeleteImage(activeLightboxVisitId, filename, true)
            : undefined
        }
      />

      {/* Scalp Comparison Modal */}
      {selectedForCompare.length === 2 && (
        <ScalpCompareModal
          isOpen={showCompareModal}
          onClose={() => setShowCompareModal(false)}
          image1={selectedForCompare[0]}
          image2={selectedForCompare[1]}
          patientName={patient.name}
          uhid={patient.patientId}
        />
      )}
    </div>
  );
}

export default function ScalpGalleryPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center">Loading Gallery...</div>}>
      <ScalpGalleryContent />
    </Suspense>
  );
}
