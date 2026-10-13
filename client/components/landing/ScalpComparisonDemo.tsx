'use client';

import React, { useState, useRef, useCallback } from 'react';
import Image from 'next/image';
import { Sparkles, Activity, ArrowLeftRight, CheckCircle2 } from 'lucide-react';

export default function ScalpComparisonDemo() {
  const [sliderPosition, setSliderPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMove = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const percent = Math.max(0, Math.min((x / rect.width) * 100, 100));
    setSliderPosition(percent);
  }, []);

  const handleMouseDown = () => setIsDragging(true);
  const handleMouseUp = () => setIsDragging(false);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    handleMove(e.clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length > 0) {
      handleMove(e.touches[0].clientX);
    }
  };

  return (
    <section className="scalp-demo-section" id="scalp-analysis">
      <div className="scalp-demo-section__container">
        {/* Header */}
        <div className="scalp-demo-section__header">
          <span className="scalp-demo-section__eyebrow">
            <Sparkles className="w-3.5 h-3.5 inline mr-1 text-[var(--brass)]" />
            Trichology Intelligence
          </span>
          <h2 className="scalp-demo-section__title">
            Sequential Scalp Progress <span className="text-[var(--brass)]">Comparison</span>
          </h2>
          <p className="scalp-demo-section__subtitle">
            Track microscopic follicular density, terminal-to-vellus ratios, and regrowth milestones with side-by-side photographic dermoscopy.
          </p>
        </div>

        <div className="scalp-demo-grid">
          {/* Interactive Slider Card */}
          <div className="scalp-slider-card">
            <div className="scalp-slider-card__header">
              <div className="flex items-center gap-2">
                <span className="scalp-status-dot" />
                <span className="text-xs font-mono font-medium tracking-wide uppercase text-[var(--text-dim)]">
                  Interactive Dermoscopy Slider &bull; Drag to Compare
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSliderPosition(20)}
                  className={`text-xs px-2.5 py-1 rounded font-mono transition-colors ${
                    sliderPosition <= 25
                      ? 'bg-[var(--brass)] text-white'
                      : 'bg-[var(--surface-hover)] text-[var(--text-muted)]'
                  }`}
                >
                  Month 0
                </button>
                <button
                  type="button"
                  onClick={() => setSliderPosition(50)}
                  className={`text-xs px-2.5 py-1 rounded font-mono transition-colors ${
                    sliderPosition > 25 && sliderPosition < 75
                      ? 'bg-[var(--brass)] text-white'
                      : 'bg-[var(--surface-hover)] text-[var(--text-muted)]'
                  }`}
                >
                  50/50 Split
                </button>
                <button
                  type="button"
                  onClick={() => setSliderPosition(80)}
                  className={`text-xs px-2.5 py-1 rounded font-mono transition-colors ${
                    sliderPosition >= 75
                      ? 'bg-[var(--brass)] text-white'
                      : 'bg-[var(--surface-hover)] text-[var(--text-muted)]'
                  }`}
                >
                  Month 6
                </button>
              </div>
            </div>

            {/* Slider Container */}
            <div
              ref={containerRef}
              className="scalp-compare-viewport"
              onMouseDown={handleMouseDown}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onMouseMove={handleMouseMove}
              onTouchMove={handleTouchMove}
            >
              {/* After Image (Background: Month 6 Regrowth) */}
              <div className="scalp-image-layer scalp-image-layer--after">
                <Image
                  src="/images/scalp-dummy-images/scalp-stage-2.png"
                  alt="Post-Treatment Scalp - Month 6"
                  fill
                  className="object-cover"
                  priority
                />
                <div className="scalp-image-badge scalp-image-badge--right">
                  <span className="badge-title">Month 6 (Post-PRP & Rx)</span>
                  <span className="badge-desc">Norwood Grade II &bull; 78 foll/cm²</span>
                </div>
              </div>

              {/* Before Image (Clipped Overlay: Month 0 Baseline) */}
              <div
                className="scalp-image-layer scalp-image-layer--before"
                style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
              >
                <Image
                  src="/images/scalp-dummy-images/scalp-stage-4.png"
                  alt="Baseline Scalp - Month 0"
                  fill
                  className="object-cover"
                  priority
                />
                <div className="scalp-image-badge scalp-image-badge--left">
                  <span className="badge-title">Month 0 (Baseline)</span>
                  <span className="badge-desc">Norwood Grade IV &bull; 42 foll/cm²</span>
                </div>
              </div>

              {/* Divider Handle */}
              <div
                className="scalp-slider-handle"
                style={{ left: `${sliderPosition}%` }}
              >
                <div className="scalp-slider-handle__line" />
                <div className="scalp-slider-handle__btn">
                  <ArrowLeftRight className="w-4 h-4 text-white" />
                </div>
              </div>
            </div>

            {/* Slider Footer Instructions */}
            <div className="scalp-slider-card__footer">
              <span className="text-xs text-[var(--text-dim)] flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-[var(--brass)]" />
                Click or drag anywhere on the image to inspect follicular regeneration progress.
              </span>
              <span className="text-xs font-mono text-[var(--brass)] font-medium">
                {Math.round(sliderPosition)}% Baseline / {100 - Math.round(sliderPosition)}% Regrowth
              </span>
            </div>
          </div>

          {/* Analysis & Treatment Milestones Card */}
          <div className="scalp-metrics-card">
            <h3 className="scalp-metrics-card__title">Clinical Assessment Telemetry</h3>
            <p className="scalp-metrics-card__subtitle">
              Measured using DermaTrack Trichoscopy AI &amp; paired dermoscopic optical lens.
            </p>

            <div className="scalp-stat-badges">
              <div className="scalp-stat-box">
                <span className="scalp-stat-box__label">Follicular Density</span>
                <span className="scalp-stat-box__val text-emerald-500">+85.7%</span>
                <span className="scalp-stat-box__sub">42 &rarr; 78 units/cm²</span>
              </div>
              <div className="scalp-stat-box">
                <span className="scalp-stat-box__label">Alopecia Norwood</span>
                <span className="scalp-stat-box__val text-[var(--brass)]">-2 Grades</span>
                <span className="scalp-stat-box__sub">Grade IV &rarr; Grade II</span>
              </div>
              <div className="scalp-stat-box">
                <span className="scalp-stat-box__label">Terminal Caliber</span>
                <span className="scalp-stat-box__val text-blue-400">+34 &mu;m</span>
                <span className="scalp-stat-box__sub">Hair shaft thickening</span>
              </div>
              <div className="scalp-stat-box">
                <span className="scalp-stat-box__label">Anagen Ratio</span>
                <span className="scalp-stat-box__val text-purple-400">89%</span>
                <span className="scalp-stat-box__sub">Active growth cycle</span>
              </div>
            </div>

            <div className="scalp-milestones">
              <h4 className="scalp-milestones__heading">Documented Treatment Protocol</h4>
              <div className="scalp-milestone-item">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <div>
                  <strong>Session 1 (Day 0):</strong> Micro-needling &amp; autologous PRP session + 5% topical Minoxidil initiation.
                </div>
              </div>
              <div className="scalp-milestone-item">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <div>
                  <strong>Session 3 (Month 3):</strong> Vellus hair emergence observed at vertex &amp; frontal hairline.
                </div>
              </div>
              <div className="scalp-milestone-item">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <div>
                  <strong>Session 6 (Month 6):</strong> Significant terminal hair stabilization and patient satisfaction confirmation.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
