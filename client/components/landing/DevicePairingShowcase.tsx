'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import {
  Smartphone, Monitor, QrCode, Wifi, Camera, Check,
  RefreshCw, Zap, ShieldCheck
} from 'lucide-react';

export default function DevicePairingShowcase() {
  const [step, setStep] = useState<'idle' | 'pairing' | 'connected' | 'capturing' | 'synced'>('idle');
  const [syncedPhotos, setSyncedPhotos] = useState<string[]>([
    '/images/scalp-dummy-images/scalp-stage-4.png',
  ]);
  const [flash, setFlash] = useState(false);

  const startSimulation = () => {
    setStep('pairing');
    setTimeout(() => {
      setStep('connected');
      setTimeout(() => {
        // Trigger capture
        setStep('capturing');
        setFlash(true);
        setTimeout(() => setFlash(false), 300);

        setTimeout(() => {
          setSyncedPhotos((prev) => [
            '/images/scalp-dummy-images/scalp-stage-2.png',
            ...prev,
          ]);
          setStep('synced');
        }, 600);
      }, 1500);
    }, 1200);
  };

  const resetSimulation = () => {
    setStep('idle');
    setSyncedPhotos(['/images/scalp-dummy-images/scalp-stage-4.png']);
  };

  return (
    <section className="device-pairing-section" id="mobile-pairing">
      <div className="device-pairing-section__container">
        {/* Header */}
        <div className="device-pairing-section__header">
          <span className="device-pairing-section__eyebrow">
            <Zap className="w-3.5 h-3.5 inline mr-1 text-[var(--brass)]" />
            Hardware Zero-Install Sync
          </span>
          <h2 className="device-pairing-section__title">
            Wireless Mobile Scalp Camera <span className="text-[var(--brass)]">Pairing</span>
          </h2>
          <p className="device-pairing-section__subtitle">
            Turn any doctor&apos;s iPhone or Android into a high-magnification dermoscopy camera with instant WebSocket desktop synchronization.
          </p>
        </div>

        {/* Action Bar */}
        <div className="device-pairing-controls">
          <button
            type="button"
            onClick={step === 'synced' ? resetSimulation : startSimulation}
            disabled={step === 'pairing' || step === 'connected' || step === 'capturing'}
            className="pairing-action-btn"
          >
            {step === 'idle' && (
              <>
                <Camera className="w-4 h-4" />
                <span>Simulate Live Pairing &amp; Capture</span>
              </>
            )}
            {step === 'pairing' && (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-[var(--brass)]" />
                <span>Establishing Secure WebSocket Handshake...</span>
              </>
            )}
            {step === 'connected' && (
              <>
                <Wifi className="w-4 h-4 text-emerald-400 animate-pulse" />
                <span>Phone Paired! Capturing High-Res Macro Image...</span>
              </>
            )}
            {step === 'capturing' && (
              <>
                <Camera className="w-4 h-4 text-emerald-400" />
                <span>Streaming Optical Dermoscopy to Desktop...</span>
              </>
            )}
            {step === 'synced' && (
              <>
                <RefreshCw className="w-4 h-4" />
                <span>Reset Simulation</span>
              </>
            )}
          </button>

          <div className="pairing-status-indicator">
            <span
              className={`pairing-status-dot ${
                step === 'idle'
                  ? 'bg-amber-500'
                  : step === 'synced' || step === 'connected'
                  ? 'bg-emerald-500'
                  : 'bg-blue-500 animate-ping'
              }`}
            />
            <span className="text-xs font-mono text-[var(--text-dim)]">
              {step === 'idle' && 'Status: Standby • Ready to Pair'}
              {step === 'pairing' && 'Status: Exchanging TLS Tunnel Keys...'}
              {step === 'connected' && 'Status: Tunnel Active (Cloudflare WS 48ms)'}
              {step === 'capturing' && 'Status: Optical Shutter Fired'}
              {step === 'synced' && 'Status: 2 Photos Synced to Electronic Health Record'}
            </span>
          </div>
        </div>

        {/* Side-by-Side Live Devices */}
        <div className="pairing-devices-container">
          {/* Desktop Workstation View */}
          <div className="device-mockup device-mockup--desktop">
            <div className="device-mockup__chrome">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80 inline-block" />
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block" />
              </div>
              <div className="device-mockup__url font-mono text-[11px] text-[var(--text-dim)]">
                dermatrack.internal/doctor/consultation?token=14
              </div>
              <div className="flex items-center gap-1 text-[var(--brass)] text-[11px] font-mono">
                <Monitor className="w-3.5 h-3.5" />
                <span>Desktop Station</span>
              </div>
            </div>

            <div className="device-mockup__screen">
              <div className="desktop-consult-bar">
                <div>
                  <h4 className="font-semibold text-sm text-[var(--text)]">Dr. Vimal Aruna, MD (Derm)</h4>
                  <p className="text-xs text-[var(--text-dim)]">Patient: Rajesh Kumar &bull; Follicular Alopecia Evaluation</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Live Session
                  </span>
                </div>
              </div>

              <div className="desktop-consult-body">
                {/* QR Code Handshake Panel */}
                <div className="desktop-qr-panel">
                  <div className="desktop-qr-box">
                    <QrCode className="w-20 h-20 text-[var(--brass)]" />
                    {(step === 'pairing' || step === 'connected' || step === 'capturing' || step === 'synced') && (
                      <div className="desktop-qr-scanned-overlay">
                        <Check className="w-8 h-8 text-emerald-400" />
                        <span className="text-[10px] font-mono text-emerald-400 mt-1">Paired</span>
                      </div>
                    )}
                  </div>
                  <div className="text-center">
                    <span className="text-xs font-medium block text-[var(--text)]">Pairing Passcode</span>
                    <span className="font-mono text-xs text-[var(--brass)] tracking-widest">DERMA-8921-SYNC</span>
                  </div>
                </div>

                {/* Live Synced Photo Gallery */}
                <div className="desktop-gallery-panel">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold uppercase font-mono tracking-wider text-[var(--text-muted)]">
                      Dermoscopy Gallery ({syncedPhotos.length} captures)
                    </span>
                    <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
                      <Wifi className="w-3 h-3" /> Auto-Sync Active
                    </span>
                  </div>

                  <div className="desktop-gallery-grid">
                    {syncedPhotos.map((src, i) => (
                      <div
                        key={i}
                        className={`desktop-gallery-item ${i === 0 && step === 'synced' ? 'animate-pulse ring-2 ring-[var(--brass)]' : ''}`}
                      >
                        <Image
                          src={src}
                          alt={`Captured Dermoscopy ${i + 1}`}
                          fill
                          className="object-cover"
                        />
                        <div className="desktop-gallery-tag">
                          {i === 0 && step === 'synced' ? 'Just Synced (120ms)' : `Photo #${syncedPhotos.length - i}`}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Mobile Smartphone View */}
          <div className="device-mockup device-mockup--mobile">
            <div className="mobile-notch">
              <div className="mobile-speaker" />
              <div className="mobile-lens" />
            </div>

            <div className="mobile-screen">
              {flash && <div className="camera-flash-overlay" />}

              {/* Viewfinder Header */}
              <div className="mobile-camera-header">
                <div className="flex items-center gap-1 text-[10px] font-mono text-white/80">
                  <Smartphone className="w-3 h-3" />
                  <span>DermCam v2.4</span>
                </div>
                <div className="flex items-center gap-1 text-[10px] font-mono text-emerald-400">
                  <ShieldCheck className="w-3 h-3" />
                  <span>Encrypted</span>
                </div>
              </div>

              {/* Viewfinder Lens View */}
              <div className="mobile-viewfinder">
                <Image
                  src={
                    step === 'synced' || step === 'capturing'
                      ? '/images/scalp-dummy-images/scalp-stage-2.png'
                      : '/images/scalp-dummy-images/scalp-stage-4.png'
                  }
                  alt="Live Camera Viewfinder"
                  fill
                  className="object-cover"
                />

                <div className="viewfinder-crosshairs">
                  <div className="crosshair-corner crosshair-corner--tl" />
                  <div className="crosshair-corner crosshair-corner--tr" />
                  <div className="crosshair-corner crosshair-corner--bl" />
                  <div className="crosshair-corner crosshair-corner--br" />
                  <div className="crosshair-center" />
                </div>

                <div className="viewfinder-telemetry">
                  <span>MAGNIFICATION: 40X</span>
                  <span>POLARIZED: YES</span>
                </div>
              </div>

              {/* Viewfinder Shutter Controls */}
              <div className="mobile-camera-controls">
                <div className="text-[11px] font-mono text-center text-white/70 mb-2">
                  {step === 'synced' ? 'Transmitted &bull; 0.12s' : 'Tap shutter to capture & stream'}
                </div>
                <div className="flex items-center justify-center">
                  <button
                    type="button"
                    onClick={startSimulation}
                    className="shutter-button"
                    title="Shutter Button"
                  >
                    <div className="shutter-inner" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
