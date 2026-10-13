'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight, Zap, Shield, Activity, Smartphone,
  Users, FileText, QrCode,
} from 'lucide-react';

/* Animated counter hook */
function useCountUp(target: number, duration = 2000) {
  const [value, setValue] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const startTime = performance.now();
          const step = (now: number) => {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setValue(Math.floor(eased * target));
            if (progress < 1) requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
        }
      },
      { threshold: 0.3 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target, duration]);

  return { value, ref };
}

const HERO_STATS = [
  { label: 'Follicles / cm²', value: 64, suffix: '', icon: Activity },
  { label: 'Active Modules', value: 6, suffix: '+', icon: Zap },
  { label: 'Queue Automation', value: 100, suffix: '%', icon: Users },
];

const TRUST_BADGES = [
  { label: 'DPDP Act 2023', icon: Shield },
  { label: 'GST Billing', icon: FileText },
  { label: 'WhatsApp + SMS', icon: Smartphone },
  { label: 'QR Camera Sync', icon: QrCode },
];

export default function HeroSection() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <section className="hero-section" id="hero">
      {/* Ambient background effects */}
      <div className="hero-section__ambient">
        <div className="hero-section__orb hero-section__orb--1" />
        <div className="hero-section__orb hero-section__orb--2" />
        <div className="hero-section__orb hero-section__orb--3" />
      </div>

      <div className="hero-section__container">
        {/* Left: Text Content */}
        <div className={`hero-section__content ${mounted ? 'hero-section__content--visible' : ''}`}>
          <div className="hero-section__eyebrow">
            <Zap className="w-3.5 h-3.5" />
            <span>Specialized Clinical ERP Platform</span>
          </div>

          <h1 className="hero-section__heading">
            The Complete ERP for
            <span className="hero-section__heading-accent"> Dermatology &amp; Trichology </span>
            Hospitals
          </h1>

          <p className="hero-section__description">
            Unify your entire patient journey — from front-desk token generation and wireless mobile
            scalp dermoscopy to batch-level pharmacy fulfillment, GST billing, and WhatsApp patient engagement.
          </p>

          {/* CTAs */}
          <div className="hero-section__ctas">
            <Link href="/login" className="hero-section__cta hero-section__cta--primary">
              <span>Launch Workstation</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/login" className="hero-section__cta hero-section__cta--secondary">
              <Smartphone className="w-4 h-4" />
              <span>Patient Portal</span>
            </Link>
            <Link href="/register-hospital" className="hero-section__cta hero-section__cta--outline">
              <span>Register Hospital</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Trust Badges */}
          <div className="hero-section__badges">
            {TRUST_BADGES.map((badge) => (
              <div key={badge.label} className="hero-section__badge">
                <badge.icon className="w-3.5 h-3.5" />
                <span>{badge.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Interactive Dashboard Preview */}
        <div className={`hero-section__preview ${mounted ? 'hero-section__preview--visible' : ''}`}>
          <div className="hero-section__dashboard">
            {/* Floating Queue Card */}
            <div className="hero-section__float-card hero-section__float-card--queue">
              <div className="hero-section__float-card-header">
                <div className="hero-section__float-dot hero-section__float-dot--live" />
                <span>Live Queue</span>
              </div>
              <div className="hero-section__float-card-body">
                <span className="hero-section__token">Token #1</span>
                <span className="hero-section__patient-name">Aarav Mehta</span>
                <span className="hero-section__status hero-section__status--consulting">Consulting</span>
              </div>
            </div>

            {/* Floating Follicle Meter */}
            <div className="hero-section__float-card hero-section__float-card--meter">
              <div className="hero-section__float-card-header">
                <Activity className="w-3.5 h-3.5" />
                <span>Folli-Density</span>
              </div>
              <div className="hero-section__meter-display">
                <svg viewBox="0 0 120 120" className="hero-section__meter-ring">
                  <circle cx="60" cy="60" r="50" strokeWidth="8" stroke="var(--border)" fill="none" />
                  <circle
                    cx="60" cy="60" r="50" strokeWidth="8"
                    stroke="var(--brass)"
                    fill="none"
                    strokeDasharray="314"
                    strokeDashoffset="110"
                    strokeLinecap="round"
                    className="hero-section__meter-progress"
                  />
                </svg>
                <div className="hero-section__meter-value">
                  <span className="hero-section__meter-number">64</span>
                  <span className="hero-section__meter-unit">/ cm²</span>
                </div>
              </div>
            </div>

            {/* Floating prescription card */}
            <div className="hero-section__float-card hero-section__float-card--rx">
              <div className="hero-section__float-card-header">
                <FileText className="w-3.5 h-3.5" />
                <span>e-Prescription</span>
              </div>
              <div className="hero-section__rx-items">
                <div className="hero-section__rx-item">
                  <span className="hero-section__rx-dot hero-section__rx-dot--active" />
                  <span>Minoxidil 5% Topical</span>
                </div>
                <div className="hero-section__rx-item">
                  <span className="hero-section__rx-dot hero-section__rx-dot--active" />
                  <span>Biotin 10mg Tab</span>
                </div>
                <div className="hero-section__rx-item">
                  <span className="hero-section__rx-dot hero-section__rx-dot--pending" />
                  <span>PRP Session #3</span>
                </div>
              </div>
            </div>

            {/* Central dashboard mockup */}
            <div className="hero-section__main-mockup">
              <div className="hero-section__mockup-toolbar">
                <div className="hero-section__mockup-dots">
                  <span /><span /><span />
                </div>
                <span className="hero-section__mockup-title">DermaTrack Clinical Dashboard</span>
              </div>
              <div className="hero-section__mockup-body">
                <div className="hero-section__mockup-sidebar">
                  {['Dashboard', 'Patients', 'Queue', 'Pharmacy', 'Reports'].map((item) => (
                    <div key={item} className="hero-section__mockup-sidebar-item">{item}</div>
                  ))}
                </div>
                <div className="hero-section__mockup-content">
                  <div className="hero-section__mockup-stat-grid">
                    {HERO_STATS.map((stat) => {
                      return (
                        <HeroStatCard key={stat.label} stat={stat} />
                      );
                    })}
                  </div>
                  <div className="hero-section__mockup-chart">
                    <div className="hero-section__mockup-chart-bars">
                      {[65, 42, 78, 55, 90, 35, 68].map((h, i) => (
                        <div
                          key={i}
                          className="hero-section__mockup-bar"
                          style={{ height: `${h}%`, animationDelay: `${i * 0.1}s` }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Animated Stats Strip */}
      <div className="hero-section__stats-strip">
        {HERO_STATS.map((stat) => {
          return <HeroStatStrip key={stat.label} stat={stat} />;
        })}
      </div>
    </section>
  );
}

function HeroStatCard({ stat }: { stat: typeof HERO_STATS[number] }) {
  const { value, ref } = useCountUp(stat.value);
  return (
    <div ref={ref} className="hero-section__mockup-stat">
      <stat.icon className="w-3.5 h-3.5" />
      <span className="hero-section__mockup-stat-value">{value}{stat.suffix}</span>
      <span className="hero-section__mockup-stat-label">{stat.label}</span>
    </div>
  );
}

function HeroStatStrip({ stat }: { stat: typeof HERO_STATS[number] }) {
  const { value, ref } = useCountUp(stat.value);
  return (
    <div ref={ref} className="hero-section__stat-item">
      <stat.icon className="w-4 h-4 text-[var(--brass)]" />
      <span className="hero-section__stat-value">{value}{stat.suffix}</span>
      <span className="hero-section__stat-label">{stat.label}</span>
    </div>
  );
}
