'use client';

import React, { useState } from 'react';
import {
  X,
  Calendar,
  ZoomIn,
  Download,
  SlidersHorizontal,
  CheckSquare,
  Square,
  Sparkles,
  Info,
  Image as ImageIcon,
  Columns,
} from 'lucide-react';
import { getMediaUrl } from '@/lib/api';
import { ComparisonImageItem } from './ScalpCompareModal';

interface VisitData {
  _id: string;
  visitDate: string | Date;
  status?: string;
  chiefComplaints?: string;
  diagnosis?: string;
  visitType?: string;
  scalpImages?: string[];
}

interface PatientScalpGalleryModalProps {
  isOpen: boolean;
  onClose: () => void;
  visits: VisitData[];
  patientName?: string;
  uhid?: string;
  onOpenLightbox: (images: string[], index: number, subtitle?: string) => void;
  onOpenCompare: (image1: ComparisonImageItem, image2: ComparisonImageItem) => void;
}

export function PatientScalpGalleryModal({
  isOpen,
  onClose,
  visits,
  patientName,
  uhid,
  onOpenLightbox,
  onOpenCompare,
}: PatientScalpGalleryModalProps) {
  const [compareMode, setCompareMode] = useState(false);
  const [selectedForCompare, setSelectedForCompare] = useState<ComparisonImageItem[]>([]);

  if (!isOpen) return null;

  // Filter visits that actually have scalp images
  const visitsWithImages = visits
    .filter((v) => v.scalpImages && v.scalpImages.length > 0)
    .sort((a, b) => new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime());

  const totalPhotos = visitsWithImages.reduce((acc, v) => acc + (v.scalpImages?.length || 0), 0);

  // All individual photo items sorted newest first
  const allPhotos: ComparisonImageItem[] = visitsWithImages.flatMap((v, vIdx) => {
    const visitNum = visitsWithImages.length - vIdx;
    const dateFormatted = new Date(v.visitDate).toLocaleDateString('en-US', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    return (v.scalpImages || []).map((img, imgIdx) => ({
      filename: img,
      visitDate: String(v.visitDate),
      visitNumber: visitNum,
      label: `Visit #${visitNum} (${dateFormatted}) - Photo #${imgIdx + 1}`,
    }));
  });

  const isSelected = (filename: string) =>
    selectedForCompare.some((p) => p.filename === filename);

  const handleToggleCompare = (item: ComparisonImageItem) => {
    setSelectedForCompare((prev) => {
      const exists = prev.some((p) => p.filename === item.filename);
      if (exists) {
        return prev.filter((p) => p.filename !== item.filename);
      } else {
        if (prev.length >= 2) {
          // Replace second selection
          return [prev[0], item];
        }
        return [...prev, item];
      }
    });
  };

  const handleQuickCompareBaselineVsLatest = () => {
    if (allPhotos.length < 2) return;
    const latest = allPhotos[0];
    const baseline = allPhotos[allPhotos.length - 1];
    onOpenCompare(baseline, latest);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[var(--background)]/98 backdrop-blur-md animate-fadeIn select-none overflow-y-auto">
      {/* Top Header Bar */}
      <header className="sticky top-0 z-30 bg-[var(--surface-1)]/90 backdrop-blur-md border-b border-[var(--border)] px-6 py-4 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-[var(--surface-2)] hover:bg-[var(--surface-3)] border border-[var(--border)] text-[var(--text)] transition-colors"
              title="Close Gallery"
            >
              <X className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-lg font-bold tracking-tight text-[var(--text)]">
                  Scalp Phototrichogram Gallery
                </h1>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20">
                  {totalPhotos} Total Photos
                </span>
              </div>
              <p className="text-xs text-[var(--text-dim)] mt-0.5">
                Patient: <span className="font-semibold text-[var(--text)]">{patientName || 'Patient'}</span>
                {uhid ? (
                  <>
                    {' '}• UHID:{' '}
                    <span className="font-mono text-teal-600 dark:text-teal-400">{uhid}</span>
                  </>
                ) : null}
              </p>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-3">
            {allPhotos.length >= 2 && (
              <button
                type="button"
                onClick={handleQuickCompareBaselineVsLatest}
                className="hidden sm:flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-teal-500/10 hover:bg-teal-500/20 text-teal-600 dark:text-teal-400 border border-teal-500/25 transition-all shadow-xs"
                title="Directly compare your earliest baseline scan with your latest follow-up"
              >
                <Columns className="w-3.5 h-3.5" />
                <span>Compare Baseline vs Latest</span>
              </button>
            )}

            <button
              type="button"
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
                type="button"
                onClick={() => onOpenCompare(selectedForCompare[0], selectedForCompare[1])}
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
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-2.5 text-xs text-amber-700 dark:text-amber-300 font-medium sticky top-[73px] z-20 backdrop-blur-md">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-amber-500 shrink-0" />
              <span>
                Click any 2 photos across clinical visits to compare them side-by-side or with the interactive follicle density slider.
              </span>
            </div>
            <div className="font-bold shrink-0 ml-4">
              Selected: {selectedForCompare.length} / 2 photos
            </div>
          </div>
        </div>
      )}

      {/* Main Gallery Content */}
      <main className="max-w-7xl mx-auto px-6 py-8 w-full">
        {visitsWithImages.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-[var(--surface-1)] border border-[var(--border)] max-w-lg mx-auto mt-8">
            <ImageIcon className="w-12 h-12 text-[var(--text-dim)] mx-auto mb-3 opacity-40" />
            <h3 className="text-base font-bold text-[var(--text)]">No Scalp Images Recorded Yet</h3>
            <p className="text-xs text-[var(--text-dim)] mt-1">
              Your doctor will capture clinical phototrichogram photos during your consultation to track your hair density progression.
            </p>
            <button
              onClick={onClose}
              className="mt-6 px-4 py-2 rounded-xl bg-teal-600 text-white text-xs font-semibold hover:bg-teal-500 transition-colors shadow-sm"
            >
              Back to Overview
            </button>
          </div>
        ) : (
          <div className="space-y-8">
            {visitsWithImages.map((visit, vIdx) => {
              const visitDateFormatted = new Date(visit.visitDate).toLocaleDateString('en-US', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              });

              const visitNum = visitsWithImages.length - vIdx;
              const visitImages = visit.scalpImages || [];

              return (
                <section
                  key={visit._id}
                  className="p-6 rounded-2xl border border-[var(--border)] bg-[var(--surface-1)] shadow-sm"
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
                          {vIdx === 0 && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/30 flex items-center gap-1">
                              <Sparkles className="w-3 h-3" />
                              Latest Scan
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[var(--text-dim)] mt-0.5">
                          {visit.diagnosis ? `Diagnosis: ${visit.diagnosis}` : 'Scalp Examination Session'} •{' '}
                          {visitImages.length} {visitImages.length === 1 ? 'image' : 'images'} captured
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Scalp Photos Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 mt-6">
                    {visitImages.map((img, imgIdx) => {
                      const compareItem: ComparisonImageItem = {
                        filename: img,
                        visitDate: String(visit.visitDate),
                        visitNumber: visitNum,
                        label: `Visit #${visitNum} (${visitDateFormatted}) - Photo #${imgIdx + 1}`,
                      };

                      const checked = isSelected(img);
                      const imgUrl = getMediaUrl(img);

                      return (
                        <div
                          key={img}
                          className={`group relative aspect-square rounded-xl overflow-hidden border-2 bg-black transition-all shadow-md ${
                            checked
                              ? 'border-amber-500 ring-4 ring-amber-500/20 scale-[1.02]'
                              : 'border-[var(--border)] hover:border-teal-500/60'
                          }`}
                        >
                          {/* Scalp Image */}
                          <img
                            src={imgUrl}
                            alt={`Scalp photo ${imgIdx + 1} on ${visitDateFormatted}`}
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />

                          {/* Index Badge */}
                          <div className="absolute top-2 left-2 z-10 px-2 py-0.5 rounded bg-black/75 backdrop-blur-xs text-[10px] font-bold text-white">
                            #{imgIdx + 1}
                          </div>

                          {/* Compare Checkbox (when in compare mode) */}
                          {compareMode && (
                            <button
                              type="button"
                              onClick={() => handleToggleCompare(compareItem)}
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
                          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3 gap-2">
                            <div className="flex items-center justify-between gap-1.5">
                              <button
                                type="button"
                                onClick={() =>
                                  onOpenLightbox(
                                    visitImages,
                                    imgIdx,
                                    `Visit #${visitNum} • ${visitDateFormatted} • Photo #${imgIdx + 1}`
                                  )
                                }
                                title="Open in Full Screen Lightbox"
                                className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg bg-white/20 hover:bg-white/30 text-white text-xs font-semibold backdrop-blur-md transition-colors"
                              >
                                <ZoomIn className="w-3.5 h-3.5" />
                                <span>Zoom</span>
                              </button>

                              <a
                                href={imgUrl}
                                download={`scalp-photo-visit-${visitNum}-${imgIdx + 1}.jpg`}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Download Photo"
                                className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white transition-colors flex items-center justify-center"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Download className="w-3.5 h-3.5" />
                              </a>
                            </div>

                            {compareMode && (
                              <button
                                type="button"
                                onClick={() => handleToggleCompare(compareItem)}
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
                <p className="text-slate-400">
                  {selectedForCompare[0].label?.split(' - ')[0]} vs {selectedForCompare[1].label?.split(' - ')[0]}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onOpenCompare(selectedForCompare[0], selectedForCompare[1])}
              className="px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs shadow-lg shadow-teal-500/30 transition-transform active:scale-95"
            >
              Launch Comparison View →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
