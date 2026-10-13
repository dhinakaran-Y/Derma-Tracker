'use client';

import React, { useState } from 'react';
import {
  UserPlus, Stethoscope, Pill, Package, Smartphone,
  ArrowRight, CheckCircle2, ClipboardList, QrCode, Activity,
  CreditCard, Bell, Camera,
} from 'lucide-react';

const STEPS = [
  {
    id: 'reception',
    label: 'Reception & Triage',
    icon: UserPlus,
    color: '#5B9BB8',
    details: [
      { icon: ClipboardList, text: 'Rapid digital patient creation with mandatory demographics & DOB' },
      { icon: Activity, text: 'Height, Weight & automatic BMI vital computation' },
      { icon: CreditCard, text: 'Consultation fee collection with Instant Dynamic UPI QR Code & Cash receipts' },
      { icon: Bell, text: 'Real-time token generation & queue assignment' },
    ],
  },
  {
    id: 'doctor',
    label: 'Doctor Suite',
    icon: Stethoscope,
    color: '#C98A4B',
    details: [
      { icon: Activity, text: 'Live queue synchronization via WebSocket' },
      { icon: Camera, text: 'QR-based wireless phone camera pairing for hands-free scalp dermoscopy' },
      { icon: ClipboardList, text: 'Norwood scale grading, follicle mapping & scalp density metrics' },
      { icon: CheckCircle2, text: 'E-prescription generation with dosage & frequency' },
    ],
  },
  {
    id: 'pharmacy',
    label: 'Pharmacy Dispense',
    icon: Pill,
    color: '#5FAE7C',
    details: [
      { icon: ClipboardList, text: 'Prescription queue auto-populated from consultation' },
      { icon: Package, text: 'Batch-level FIFO/FEFO dispensing with dosage instructions' },
      { icon: CheckCircle2, text: 'Real-time stock verification before dispensing' },
      { icon: Bell, text: 'Automated WhatsApp medication reminders to patients' },
    ],
  },
  {
    id: 'stock',
    label: 'Stock Drawdown',
    icon: Package,
    color: '#D0A24C',
    details: [
      { icon: Activity, text: 'Real-time automated stock deductions on dispense' },
      { icon: Bell, text: 'Batch expiry tracking & minimum threshold warning alerts' },
      { icon: CreditCard, text: 'Purchase price vs selling price margin calculation' },
      { icon: ClipboardList, text: 'Reorder point alerts & inventory audit trail' },
    ],
  },
  {
    id: 'patient',
    label: 'Patient Portal',
    icon: Smartphone,
    color: '#5B9BB8',
    details: [
      { icon: Bell, text: 'Automated WhatsApp & SMS receipt and OTP delivery' },
      { icon: Camera, text: 'Visual before/after scalp growth progress tracking' },
      { icon: CreditCard, text: 'Razorpay online invoice payments' },
      { icon: CheckCircle2, text: 'Treatment timeline, e-prescriptions & appointment history' },
    ],
  },
];

export default function WorkflowJourney() {
  const [activeStep, setActiveStep] = useState(0);
  const step = STEPS[activeStep];

  return (
    <section className="workflow-section" id="workflow">
      <div className="workflow-section__container">
        <div className="workflow-section__header">
          <span className="workflow-section__eyebrow">End-to-End Clinical Journey</span>
          <h2 className="workflow-section__title">
            From Reception to <span className="text-[var(--brass)]">Patient Portal</span>
          </h2>
          <p className="workflow-section__subtitle">
            Follow the complete journey of a patient through all five clinical stations,
            automated and synchronized in real-time.
          </p>
        </div>

        {/* Stepper */}
        <div className="workflow-section__stepper">
          {STEPS.map((s, idx) => (
            <React.Fragment key={s.id}>
              <button
                onClick={() => setActiveStep(idx)}
                className={`workflow-section__step ${activeStep === idx ? 'workflow-section__step--active' : ''}`}
                style={{ '--step-color': s.color } as React.CSSProperties}
              >
                <div className="workflow-section__step-icon">
                  <s.icon className="w-5 h-5" />
                </div>
                <span className="workflow-section__step-label">{s.label}</span>
                <span className="workflow-section__step-number">{idx + 1}</span>
              </button>
              {idx < STEPS.length - 1 && (
                <div className={`workflow-section__connector ${idx < activeStep ? 'workflow-section__connector--done' : ''}`}>
                  <ArrowRight className="w-4 h-4" />
                </div>
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Detail Panel */}
        <div className="workflow-section__detail" style={{ '--step-color': step.color } as React.CSSProperties}>
          <div className="workflow-section__detail-header">
            <div className="workflow-section__detail-icon">
              <step.icon className="w-6 h-6" />
            </div>
            <div>
              <h3 className="workflow-section__detail-title">{step.label}</h3>
              <span className="workflow-section__detail-step">Step {activeStep + 1} of {STEPS.length}</span>
            </div>
          </div>
          <div className="workflow-section__detail-grid">
            {step.details.map((detail, i) => (
              <div key={i} className="workflow-section__detail-item">
                <div className="workflow-section__detail-item-icon">
                  <detail.icon className="w-4 h-4" />
                </div>
                <span>{detail.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
