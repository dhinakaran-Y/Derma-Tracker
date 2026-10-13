'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useTheme } from '../../hooks/useTheme';
import {
  Sun, Moon, LogIn, Building2, Menu, X, ChevronDown,
} from 'lucide-react';

const NAV_LINKS = [
  { label: 'Features', href: '#features' },
  { label: 'Workflow', href: '#workflow' },
  { label: 'Technology', href: '#technology' },
  { label: 'Compliance', href: '#compliance' },
  { label: 'Demo', href: '#demo' },
];

export default function LandingNavbar() {
  const { theme, toggleTheme } = useTheme();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const smoothScroll = (href: string) => {
    setMobileOpen(false);
    const el = document.querySelector(href);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <header
      className={`landing-navbar ${scrolled ? 'landing-navbar--scrolled' : ''}`}
    >
      <div className="landing-navbar__inner">
        {/* Brand */}
        <Link href="/" className="landing-navbar__brand">
          <div className="landing-navbar__logo">
            <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="8" fill="var(--brass)" />
              <text x="6" y="23" fontFamily="Space Grotesk, sans-serif" fontWeight="700" fontSize="18" fill="#fff">D</text>
            </svg>
          </div>
          <div className="landing-navbar__brand-text">
            <span className="landing-navbar__title">DermaTrack</span>
            <span className="landing-navbar__subtitle">Trichology &amp; Dermatology ERP</span>
          </div>
        </Link>

        {/* Desktop Nav */}
        <nav className="landing-navbar__nav">
          {NAV_LINKS.map((link) => (
            <button
              key={link.href}
              onClick={() => smoothScroll(link.href)}
              className="landing-navbar__link"
            >
              {link.label}
            </button>
          ))}
        </nav>

        {/* Actions */}
        <div className="landing-navbar__actions">
          <button
            onClick={toggleTheme}
            className="landing-navbar__theme-btn"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          <Link href="/register-hospital" className="landing-navbar__register-btn">
            <Building2 className="w-3.5 h-3.5" />
            <span>Register Clinic</span>
          </Link>

          <Link href="/login" className="landing-navbar__signin-btn">
            <LogIn className="w-3.5 h-3.5" />
            <span>Sign In</span>
          </Link>

          {/* Mobile Toggle */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="landing-navbar__mobile-toggle"
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Dropdown */}
      {mobileOpen && (
        <div className="landing-navbar__mobile-menu">
          {NAV_LINKS.map((link) => (
            <button
              key={link.href}
              onClick={() => smoothScroll(link.href)}
              className="landing-navbar__mobile-link"
            >
              {link.label}
            </button>
          ))}
          <div className="landing-navbar__mobile-actions">
            <Link href="/register-hospital" className="landing-navbar__register-btn landing-navbar__register-btn--full">
              <Building2 className="w-3.5 h-3.5" />
              <span>Register Clinic</span>
            </Link>
            <Link href="/login" className="landing-navbar__signin-btn landing-navbar__signin-btn--full">
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
