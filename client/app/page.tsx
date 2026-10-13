'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../hooks/useAuth';
import Link from 'next/link';
import { ArrowRight, LogIn } from 'lucide-react';

/* Landing Page Components */
import LandingNavbar from '../components/landing/LandingNavbar';
import HeroSection from '../components/landing/HeroSection';
import WorkflowJourney from '../components/landing/WorkflowJourney';
import PortalExplorer from '../components/landing/PortalExplorer';
import ScalpComparisonDemo from '../components/landing/ScalpComparisonDemo';
import DevicePairingShowcase from '../components/landing/DevicePairingShowcase';
import TechStackHighlights from '../components/landing/TechStackHighlights';
import InteractiveDemoSandbox from '../components/landing/InteractiveDemoSandbox';
import ComplianceSecuritySection from '../components/landing/ComplianceSecuritySection';
import LandingFooter from '../components/landing/LandingFooter';
import '../components/landing/landing.css';

export default function RootPage() {
  const { user, patient, userType, loading } = useAuth();
  const router = useRouter();
  const [showLanding, setShowLanding] = useState(false);

  useEffect(() => {
    if (loading) return;

    // If the user is already logged in, show a "Go to Workstation" banner
    // but still show the landing page underneath
    if (user && userType === 'staff') {
      setShowLanding(true);
    } else if (patient && userType === 'patient') {
      setShowLanding(true);
    } else {
      // Not logged in: show landing page
      setShowLanding(true);
    }
  }, [user, patient, userType, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-2 border-[var(--brass)] border-t-transparent animate-spin" />
          <span className="font-mono text-xs text-[var(--text-dim)] uppercase tracking-wider">
            Loading DermaTrack...
          </span>
        </div>
      </div>
    );
  }

  if (!showLanding) return null;

  // Compute the redirect path for authenticated users
  const getWorkstationPath = () => {
    if (user && userType === 'staff') {
      switch (user.role) {
        case 'Admin': return '/admin';
        case 'Doctor': return '/doctor';
        case 'Receptionist': return '/receptionist';
        case 'MedicationGiver': return '/medication-giver';
        case 'StockManager': return '/stock-manager';
        default: return '/admin';
      }
    }
    if (patient && userType === 'patient') return '/patient';
    return null;
  };

  const workstationPath = getWorkstationPath();

  return (
    <div className="landing-page">
      {/* Authenticated User Banner */}
      {workstationPath && (
        <div className="landing-auth-banner">
          <div className="landing-auth-banner__inner">
            <div className="landing-auth-banner__info">
              <LogIn className="w-4 h-4 text-[var(--brass)]" />
              <span>
                Welcome back, <strong>{user?.fullName || patient?.name || 'User'}</strong>!
                You are logged in as <strong>{user?.role || 'Patient'}</strong>.
              </span>
            </div>
            <Link href={workstationPath} className="landing-auth-banner__btn">
              <span>Go to Workstation</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      )}

      <LandingNavbar />
      <HeroSection />
      <WorkflowJourney />
      <PortalExplorer />
      <ScalpComparisonDemo />
      <DevicePairingShowcase />
      <TechStackHighlights />
      <InteractiveDemoSandbox />
      <ComplianceSecuritySection />
      <LandingFooter />
    </div>
  );
}
