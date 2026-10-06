'use client';

import React, { useState } from 'react';
import { X, Columns, SlidersHorizontal, Maximize2, Minimize2 } from 'lucide-react';
import { getMediaUrl } from '@/lib/api';
import { CompareSlider } from './CompareSlider';

export interface ComparisonImageItem {
  filename: string;
  visitDate: string;
  visitNumber?: number;
  label?: string;
}

interface ScalpCompareModalProps {
  isOpen: boolean;
  onClose: () => void;
  image1: ComparisonImageItem;
  image2: ComparisonImageItem;
  patientName?: string;
  uhid?: string;
}

export function ScalpCompareModal({
  isOpen,
  onClose,
  image1,
  image2,
  patientName,
  uhid,
}: ScalpCompareModalProps) {
  const [viewMode, setViewMode] = useState<'split' | 'slider'>('slider');
  const [isFullscreen, setIsFullscreen] = useState(false);

  if (!isOpen) return null;

  const url1 = getMediaUrl(image1.filename);
  const url2 = getMediaUrl(image2.filename);

  const label1 = image1.label || `Visit (${new Date(image1.visitDate).toLocaleDateString()})`;
  const label2 = image2.label || `Visit (${new Date(image2.visitDate).toLocaleDateString()})`;

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      setIsFullscreen(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95 backdrop-blur-md animate-fadeIn select-none">
      {/* Top Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-black/60 border-b border-white/10 z-20">
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span>Phototrichogram Clinical Comparison</span>
              {patientName && (
                <span className="text-xs font-normal text-teal-400 bg-teal-950/60 px-2 py-0.5 rounded border border-teal-800">
                  {patientName} {uhid ? `(${uhid})` : ''}
                </span>
              )}
            </h2>
            <p className="text-xs text-white/50">
              Comparing Baseline vs Follow-up Follicular Density & Scalp Health
            </p>
          </div>
        </div>

        {/* View Mode Switcher & Tools */}
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-white/10 p-1 rounded-xl border border-white/10">
            <button
              onClick={() => setViewMode('slider')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'slider'
                  ? 'bg-teal-600 text-white shadow-md'
                  : 'text-white/70 hover:text-white hover:bg-white/10'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Interactive Slider</span>
            </button>
            <button
              onClick={() => setViewMode('split')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'split'
                  ? 'bg-teal-600 text-white shadow-md'
                  : 'text-white/70 hover:text-white hover:bg-white/10'
              }`}
            >
              <Columns className="w-3.5 h-3.5" />
              <span>Side-by-Side</span>
            </button>
          </div>

          <button
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            className="p-2 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-xl border border-white/10 transition-colors"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          <button
            onClick={onClose}
            title="Close Comparison"
            className="p-2 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-xl border border-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Comparison Area */}
      <div className="flex-1 p-4 md:p-6 overflow-hidden flex items-center justify-center">
        {viewMode === 'slider' ? (
          <div className="w-full h-full max-w-6xl max-h-[85vh] flex items-center justify-center">
            <CompareSlider
              beforeImage={url1}
              afterImage={url2}
              beforeLabel={label1}
              afterLabel={label2}
              className="w-full h-full max-h-[80vh] shadow-2xl rounded-2xl border-white/20"
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full h-full max-w-7xl max-h-[85vh]">
            {/* Left Image (Before) */}
            <div className="relative flex flex-col items-center justify-center bg-zinc-950 rounded-2xl border border-white/10 overflow-hidden group">
              <div className="absolute top-4 left-4 z-10 px-3 py-1.5 rounded-lg bg-black/80 backdrop-blur-md border border-white/20 text-white font-mono text-xs font-semibold shadow-lg">
                {label1}
              </div>
              <img
                src={url1}
                alt={label1}
                className="w-full h-full object-contain max-h-[78vh]"
                style={{ imageRendering: 'auto' }}
              />
            </div>

            {/* Right Image (After) */}
            <div className="relative flex flex-col items-center justify-center bg-zinc-950 rounded-2xl border border-white/10 overflow-hidden group">
              <div className="absolute top-4 left-4 z-10 px-3 py-1.5 rounded-lg bg-black/80 backdrop-blur-md border border-teal-500/40 text-teal-300 font-mono text-xs font-semibold shadow-lg">
                {label2}
              </div>
              <img
                src={url2}
                alt={label2}
                className="w-full h-full object-contain max-h-[78vh]"
                style={{ imageRendering: 'auto' }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="px-6 py-3 bg-black/60 border-t border-white/10 flex items-center justify-between text-xs text-white/50">
        <div>
          <span>Comparison between: </span>
          <span className="text-white font-medium">{image1.filename}</span>
          <span> and </span>
          <span className="text-white font-medium">{image2.filename}</span>
        </div>
        <div>
          <span>Clinical High Definition • Full Resolution Display</span>
        </div>
      </div>
    </div>
  );
}
