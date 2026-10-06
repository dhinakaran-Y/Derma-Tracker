'use client';

import React, { useState, useEffect } from 'react';
import { X, ZoomIn, ZoomOut, RotateCcw, Trash2, Download, ChevronLeft, ChevronRight, Maximize2 } from 'lucide-react';
import { getMediaUrl } from '@/lib/api';

interface ImageLightboxModalProps {
  isOpen: boolean;
  onClose: () => void;
  images: string[];
  initialIndex?: number;
  title?: string;
  subtitle?: string;
  onDeleteImage?: (filename: string) => Promise<void>;
}

export function ImageLightboxModal({
  isOpen,
  onClose,
  images,
  initialIndex = 0,
  title,
  subtitle,
  onDeleteImage,
}: ImageLightboxModalProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setCurrentIndex(initialIndex);
    setZoomLevel(1);
    setPan({ x: 0, y: 0 });
    setConfirmDelete(false);
  }, [initialIndex, isOpen]);

  // Keyboard navigation & shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight' && currentIndex < images.length - 1) {
        setCurrentIndex((i) => i + 1);
        setZoomLevel(1);
        setPan({ x: 0, y: 0 });
      } else if (e.key === 'ArrowLeft' && currentIndex > 0) {
        setCurrentIndex((i) => i - 1);
        setZoomLevel(1);
        setPan({ x: 0, y: 0 });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentIndex, images.length, onClose]);

  if (!isOpen || images.length === 0) return null;

  const currentFilename = images[currentIndex];
  const currentUrl = getMediaUrl(currentFilename);

  const handleZoomIn = () => setZoomLevel((z) => Math.min(z + 0.5, 4));
  const handleZoomOut = () => setZoomLevel((z) => Math.max(z - 0.5, 0.5));
  const handleResetZoom = () => {
    setZoomLevel(1);
    setPan({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoomLevel > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && zoomLevel > 1) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleDelete = async () => {
    if (!onDeleteImage || !currentFilename) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 4000);
      return;
    }

    try {
      setIsDeleting(true);
      await onDeleteImage(currentFilename);
      setConfirmDelete(false);
      if (images.length <= 1) {
        onClose();
      } else {
        setCurrentIndex((i) => Math.max(0, i - 1));
      }
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/95 backdrop-blur-md select-none animate-fadeIn"
      onMouseUp={handleMouseUp}
    >
      {/* Top Header Controls */}
      <div className="flex items-center justify-between px-6 py-4 bg-black/60 border-b border-white/10 z-10">
        <div className="flex flex-col">
          <h3 className="text-sm font-semibold text-white">
            {title || `Clinical Image ${currentIndex + 1} of ${images.length}`}
          </h3>
          <p className="text-xs text-white/50">
            {subtitle || `Original 100% Quality Resolution • File: ${currentFilename}`}
          </p>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2">
          {/* Zoom Controls */}
          <div className="flex items-center bg-white/10 rounded-lg p-1 border border-white/10 mr-2">
            <button
              onClick={handleZoomOut}
              title="Zoom Out"
              className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-md transition-colors"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-xs font-mono text-white/90 px-2 min-w-[42px] text-center">
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              onClick={handleZoomIn}
              title="Zoom In"
              className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-md transition-colors"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={handleResetZoom}
              title="Reset Zoom"
              className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-md transition-colors ml-1"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          {/* Download Original */}
          <a
            href={currentUrl}
            download={`scalp-photo-${currentIndex + 1}.jpg`}
            target="_blank"
            rel="noopener noreferrer"
            title="Download Original High-Res Image"
            className="p-2 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-lg transition-colors border border-white/10"
          >
            <Download className="w-4 h-4" />
          </a>

          {/* Delete Image */}
          {onDeleteImage && (
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              title={confirmDelete ? "Click again to permanently delete" : "Delete this image"}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                confirmDelete
                  ? 'bg-red-600 hover:bg-red-500 text-white border-red-400 shadow-lg animate-pulse'
                  : 'text-red-400 hover:text-red-300 bg-red-500/20 hover:bg-red-500/30 border-red-500/30'
              }`}
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{confirmDelete ? 'Confirm Delete?' : 'Delete'}</span>
            </button>
          )}

          {/* Close */}
          <button
            onClick={onClose}
            title="Close (Esc)"
            className="p-2 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-lg transition-colors ml-2"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Image Viewport */}
      <div
        className="flex-1 relative flex items-center justify-center overflow-hidden cursor-default"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        style={{ cursor: zoomLevel > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
      >
        {/* Left Arrow */}
        {currentIndex > 0 && (
          <button
            onClick={() => {
              setCurrentIndex((i) => i - 1);
              setZoomLevel(1);
              setPan({ x: 0, y: 0 });
            }}
            className="absolute left-6 z-20 p-3 rounded-full bg-black/60 hover:bg-black/90 text-white/80 hover:text-white border border-white/20 transition-all shadow-xl hover:scale-105"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}

        {/* Right Arrow */}
        {currentIndex < images.length - 1 && (
          <button
            onClick={() => {
              setCurrentIndex((i) => i + 1);
              setZoomLevel(1);
              setPan({ x: 0, y: 0 });
            }}
            className="absolute right-6 z-20 p-3 rounded-full bg-black/60 hover:bg-black/90 text-white/80 hover:text-white border border-white/20 transition-all shadow-xl hover:scale-105"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}

        {/* Uncompressed High-Resolution Image Element */}
        <div
          className="transition-transform duration-75 ease-out select-none"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoomLevel})`,
            transformOrigin: 'center center',
          }}
        >
          <img
            src={currentUrl}
            alt={`Clinical scalp photo ${currentIndex + 1}`}
            className="max-h-[82vh] max-w-[90vw] object-contain rounded-md shadow-2xl pointer-events-none"
            style={{ imageRendering: 'auto' }}
          />
        </div>
      </div>

      {/* Bottom Thumbnail Strip */}
      <div className="px-6 py-3 bg-black/60 border-t border-white/10 flex items-center justify-center gap-3 overflow-x-auto z-10">
        {images.map((img, idx) => (
          <button
            key={img}
            onClick={() => {
              setCurrentIndex(idx);
              setZoomLevel(1);
              setPan({ x: 0, y: 0 });
            }}
            className={`relative w-14 h-14 rounded-lg overflow-hidden border-2 transition-all shrink-0 ${
              idx === currentIndex
                ? 'border-teal-400 scale-105 shadow-lg shadow-teal-500/20'
                : 'border-white/20 opacity-50 hover:opacity-100'
            }`}
          >
            <img
              src={getMediaUrl(img)}
              alt={`Thumb ${idx + 1}`}
              className="w-full h-full object-cover"
            />
            <span className="absolute bottom-0.5 right-1 text-[9px] font-bold text-white bg-black/70 px-1 rounded">
              #{idx + 1}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
