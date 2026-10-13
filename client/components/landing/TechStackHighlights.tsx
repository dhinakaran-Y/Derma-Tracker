'use client';

import React from 'react';
import {
  QrCode, Smartphone, Monitor, Wifi, Camera, ArrowRight,
  Zap, Globe, Shield, Bell, FileText, CreditCard,
} from 'lucide-react';

const TECH_FEATURES = [
  {
    id: 'camera-pairing',
    title: 'Wireless Mobile Scalp Camera Pairing',
    subtitle: 'Mobile-to-Desktop Handshake',
    description: 'Zero-install hardware synchronization. Doctor clicks "Pair Mobile Camera", scans a dynamic QR code with their smartphone, and captures microscopic scalp photos that appear in real-time on the desktop consultation gallery.',
    icon: Camera,
    color: '#C98A4B',
    steps: [
      { icon: Monitor, text: 'Doctor clicks "Pair Camera" on workstation' },
      { icon: QrCode, text: 'Dynamic QR code generated on screen' },
      { icon: Smartphone, text: 'Scan QR with smartphone to connect' },
      { icon: Wifi, text: 'Encrypted WebSocket connects instantly' },
      { icon: Camera, text: 'Capture photos on phone, view on desktop' },
    ],
  },
  {
    id: 'otp-engine',
    title: 'Dual-Channel OTP & Notification Engine',
    subtitle: 'WhatsApp + SMS Gateway',
    description: 'Reliable patient communication through native Baileys WhatsApp Web automation with automatic fallback to Android SMS Gateway. Instant token notifications, visit summaries, and OTP authentication.',
    icon: Bell,
    color: '#5FAE7C',
    steps: [
      { icon: Smartphone, text: 'Patient registers with mobile number' },
      { icon: Zap, text: 'OTP sent via WhatsApp (primary channel)' },
      { icon: Bell, text: 'Automatic SMS fallback if WA unavailable' },
      { icon: Shield, text: 'DPDP-compliant encrypted delivery' },
      { icon: Globe, text: 'Token notifications & visit summaries' },
    ],
  },
  {
    id: 'gst-billing',
    title: 'Indian Healthcare GST Billing Engine',
    subtitle: 'End-to-End Tax Compliance',
    description: 'Differential tax rate engine with procedures at 18% GST, medications at 5% GST, and configurable consultation rates. Financial year auto-sequencing and Razorpay online checkout integration.',
    icon: CreditCard,
    color: '#5B9BB8',
    steps: [
      { icon: FileText, text: 'Procedures → 18% GST automatic' },
      { icon: FileText, text: 'Medications → 5% GST automatic' },
      { icon: FileText, text: 'Consultations → Exempt / Standard' },
      { icon: CreditCard, text: 'FY auto-sequencing (2026-27)' },
      { icon: Globe, text: 'Razorpay online checkout integration' },
    ],
  },
];

export default function TechStackHighlights() {
  return (
    <section className="tech-section" id="technology">
      <div className="tech-section__container">
        <div className="tech-section__header">
          <span className="tech-section__eyebrow">Flagship Technology</span>
          <h2 className="tech-section__title">
            What Makes DermaTrack <span className="text-[var(--brass)]">Different</span>
          </h2>
          <p className="tech-section__subtitle">
            Advanced features purpose-built for modern dermatology and trichology practice management.
          </p>
        </div>

        <div className="tech-section__grid">
          {TECH_FEATURES.map((feature) => (
            <div key={feature.id} className="tech-section__card" style={{ '--card-color': feature.color } as React.CSSProperties}>
              <div className="tech-section__card-header">
                <div className="tech-section__card-icon">
                  <feature.icon className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="tech-section__card-title">{feature.title}</h3>
                  <span className="tech-section__card-subtitle">{feature.subtitle}</span>
                </div>
              </div>
              <p className="tech-section__card-description">{feature.description}</p>
              <div className="tech-section__card-steps">
                {feature.steps.map((step, i) => (
                  <div key={i} className="tech-section__card-step">
                    <div className="tech-section__card-step-dot">
                      <step.icon className="w-3.5 h-3.5" />
                    </div>
                    <span>{step.text}</span>
                    {i < feature.steps.length - 1 && (
                      <div className="tech-section__card-step-line" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
