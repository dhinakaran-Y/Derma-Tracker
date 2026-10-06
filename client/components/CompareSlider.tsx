'use client';

import React, { useState, useRef, useEffect } from 'react';

interface CompareSliderProps {
  beforeImage: string;
  afterImage: string;
  beforeLabel?: string;
  afterLabel?: string;
  className?: string;
}

export function CompareSlider({
  beforeImage,
  afterImage,
  beforeLabel = 'Baseline (Month 0)',
  afterLabel = 'Current (Month 6)',
  className = '',
}: CompareSliderProps) {
  const [sliderPosition, setSliderPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMove = (clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPosition(percentage);
  };

  const handleMouseDown = () => setIsDragging(true);
  const handleTouchStart = () => setIsDragging(true);

  useEffect(() => {
    const handleMouseUp = () => setIsDragging(false);
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) handleMove(e.clientX);
    };
    const handleTouchMove = (e: TouchEvent) => {
      if (isDragging && e.touches[0]) handleMove(e.touches[0].clientX);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleTouchMove);
      window.addEventListener('touchend', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, [isDragging]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-[280px] select-none overflow-hidden rounded-lg border border-[var(--border)] bg-black/40 cursor-ew-resize ${className}`}
      onClick={(e) => handleMove(e.clientX)}
    >
      {/* After Image (Background) */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${afterImage})` }}
      />

      {/* Before Image (Clipped Overlay) */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ clipPath: `polygon(0 0, ${sliderPosition}% 0, ${sliderPosition}% 100%, 0 100%)` }}
      >
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${beforeImage})` }}
        />
      </div>

      {/* Bottom Gradient for Contrast & Legibility */}
      <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/75 via-black/30 to-transparent pointer-events-none" />

      {/* Before Label (Bottom Left) */}
      <div
        className="absolute bottom-3 left-3 z-10 pointer-events-none transition-opacity duration-150"
        style={{ opacity: sliderPosition < 8 ? 0 : 1 }}
      >
        <span className="font-mono text-xs px-2.5 py-1 rounded bg-black/80 text-white/95 border border-white/20 backdrop-blur-xs shadow-md">
          {beforeLabel}
        </span>
      </div>

      {/* After Label (Bottom Right) */}
      <div
        className="absolute bottom-3 right-3 z-10 pointer-events-none transition-opacity duration-150"
        style={{ opacity: sliderPosition > 92 ? 0 : 1 }}
      >
        <span className="font-mono text-xs px-2.5 py-1 rounded bg-black/80 text-[var(--brass)] border border-[var(--brass)]/40 backdrop-blur-xs shadow-md">
          {afterLabel}
        </span>
      </div>

      {/* Vertical Brass Divider Bar */}
      <div
        className="absolute top-0 bottom-0 w-0.5 bg-[var(--brass)] shadow-[0_0_8px_rgba(201,138,75,0.8)]"
        style={{ left: `${sliderPosition}%` }}
      >
        {/* Handle Knob */}
        <div
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-[var(--brass)] border-2 border-white flex items-center justify-center shadow-lg cursor-grab active:cursor-grabbing text-white text-xs font-bold"
        >
          ↔
        </div>
      </div>
    </div>
  );
}
