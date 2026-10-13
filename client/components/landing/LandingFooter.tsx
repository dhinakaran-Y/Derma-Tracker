'use client';

import React from 'react';
import Link from 'next/link';
import {
  ArrowRight, LogIn, Building2, Smartphone, Shield,
  Heart,
} from 'lucide-react';

export default function LandingFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="landing-footer">
      {/* CTA Banner */}
      <div className="landing-footer__cta-banner">
        <div className="landing-footer__cta-content">
          <h2 className="landing-footer__cta-title">
            Ready to modernise your dermatology clinic?
          </h2>
          <p className="landing-footer__cta-subtitle">
            Join the next generation of clinical ERP — purpose-built for trichology and dermatology practices.
          </p>
          <div className="landing-footer__cta-actions">
            <Link href="/register-hospital" className="landing-footer__cta-btn landing-footer__cta-btn--primary">
              <Building2 className="w-4 h-4" />
              <span>Register Your Clinic</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/login" className="landing-footer__cta-btn landing-footer__cta-btn--secondary">
              <LogIn className="w-4 h-4" />
              <span>Staff Login</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Footer Links */}
      <div className="landing-footer__body">
        <div className="landing-footer__body-inner">
          <div className="landing-footer__brand">
            <div className="landing-footer__brand-logo">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <rect width="32" height="32" rx="8" fill="var(--brass)" />
                <text x="6" y="23" fontFamily="Space Grotesk, sans-serif" fontWeight="700" fontSize="18" fill="#fff">D</text>
              </svg>
              <div>
                <span className="landing-footer__brand-name">DermaTrack</span>
                <span className="landing-footer__brand-tagline">Trichology &amp; Dermatology ERP</span>
              </div>
            </div>
            <p className="landing-footer__brand-desc">
              Comprehensive clinical ERP and patient portal for dermatology and trichology clinics.
              Multi-role workstations, real-time queue management, and GST-compliant billing.
            </p>
          </div>

          <div className="landing-footer__links-group">
            <h4 className="landing-footer__links-title">Quick Access</h4>
            <Link href="/login" className="landing-footer__link">
              <LogIn className="w-3.5 h-3.5" /> Clinical Workstation
            </Link>
            <Link href="/register-hospital" className="landing-footer__link">
              <Building2 className="w-3.5 h-3.5" /> Register Hospital
            </Link>
            <Link href="/login" className="landing-footer__link">
              <Smartphone className="w-3.5 h-3.5" /> Patient Portal
            </Link>
          </div>

          <div className="landing-footer__links-group">
            <h4 className="landing-footer__links-title">Compliance</h4>
            <span className="landing-footer__link landing-footer__link--static">
              <Shield className="w-3.5 h-3.5" /> DPDP Act 2023
            </span>
            <span className="landing-footer__link landing-footer__link--static">
              <Shield className="w-3.5 h-3.5" /> GST Compliant
            </span>
            <span className="landing-footer__link landing-footer__link--static">
              <Shield className="w-3.5 h-3.5" /> RBAC Security
            </span>
          </div>
        </div>
      </div>

      {/* Copyright */}
      <div className="landing-footer__copyright">
        <span>
          © {currentYear} DermaTrack. Built with <Heart className="w-3 h-3 inline text-[var(--brass)]" /> for modern dermatology clinics.
        </span>
      </div>
    </footer>
  );
}
