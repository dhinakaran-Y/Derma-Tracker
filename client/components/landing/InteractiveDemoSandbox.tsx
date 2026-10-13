'use client';

import React from 'react';
import Link from 'next/link';
import {
  ShieldCheck, Users, Pill, Package, Smartphone, Stethoscope,
  ArrowRight, Zap, ClipboardList,
} from 'lucide-react';

const DEMO_ROLES = [
  {
    id: 'admin',
    label: 'Admin',
    emoji: '👑',
    icon: ShieldCheck,
    email: 'aruna_hair_care@gmail.com',
    color: '#D0A24C',
    description: 'Full administrative access: analytics, staff management, revenue & audit trails',
  },
  {
    id: 'doctor',
    label: 'Doctor',
    emoji: '🩺',
    icon: Stethoscope,
    email: 'aruna.vimal@gmail.com',
    color: '#C98A4B',
    description: 'Consultation suite: scalp dermoscopy, Norwood grading & e-prescriptions',
  },
  {
    id: 'receptionist',
    label: 'Receptionist',
    emoji: '🛎️',
    icon: ClipboardList,
    email: 'aruna.sharmi@gmail.com',
    color: '#5B9BB8',
    description: 'Front desk: patient registration, queue tokens & payment collection',
  },
  {
    id: 'pharmacy',
    label: 'Pharmacy',
    emoji: '💊',
    icon: Pill,
    email: 'aruna.kavitha@gmail.com',
    color: '#5FAE7C',
    description: 'Medication dispensing: prescription queue, batch allocation & dosage',
  },
  {
    id: 'stock',
    label: 'Stock Manager',
    emoji: '📦',
    icon: Package,
    email: 'aruna.yakavi@gmail.com',
    color: '#C9614B',
    description: 'Inventory control: batch tracking, expiry alerts & reorder management',
  },
  {
    id: 'patient',
    label: 'Patient',
    emoji: '📱',
    icon: Smartphone,
    email: null,
    phone: '0123456789',
    otp: '123456',
    color: '#5B9BB8',
    description: 'Patient portal: treatment history, scalp progress & online payments',
  },
];

export default function InteractiveDemoSandbox() {
  return (
    <section className="demo-section" id="demo">
      <div className="demo-section__container">
        <div className="demo-section__header">
          <div className="demo-section__header-badge">
            <Zap className="w-4 h-4" />
            <span>Live Demo</span>
          </div>
          <h2 className="demo-section__title">
            Test-Drive Any Role <span className="text-[var(--brass)]">Instantly</span>
          </h2>
          <p className="demo-section__subtitle">
            Experience DermaTrack from every perspective. Click any role below to launch
            a pre-configured demo session with real data.
          </p>
        </div>

        <div className="demo-section__grid">
          {DEMO_ROLES.map((role) => (
            <Link
              key={role.id}
              href="/login"
              className="demo-section__card"
              style={{ '--card-color': role.color } as React.CSSProperties}
            >
              <div className="demo-section__card-header">
                <div className="demo-section__card-icon">
                  <role.icon className="w-5 h-5" />
                </div>
                <span className="demo-section__card-emoji">{role.emoji}</span>
              </div>
              <h3 className="demo-section__card-title">Try as {role.label}</h3>
              <p className="demo-section__card-desc">{role.description}</p>
              <div className="demo-section__card-credentials">
                {role.email ? (
                  <code className="demo-section__card-credential">{role.email}</code>
                ) : (
                  <>
                    <code className="demo-section__card-credential">📱 {role.phone}</code>
                    <code className="demo-section__card-credential">OTP: {role.otp}</code>
                  </>
                )}
              </div>
              <div className="demo-section__card-cta">
                <span>Launch Session</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </Link>
          ))}
        </div>

        <div className="demo-section__note">
          <span>All demo accounts use password: </span>
          <code className="demo-section__note-code">pass123</code>
        </div>
      </div>
    </section>
  );
}
