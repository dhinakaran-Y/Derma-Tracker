'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../hooks/useAuth';

export default function RootPage() {
  const { user, patient, userType, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    if (user && userType === 'staff') {
      switch (user.role) {
        case 'Admin':
          router.replace('/admin');
          break;
        case 'Doctor':
          router.replace('/doctor');
          break;
        case 'Receptionist':
          router.replace('/receptionist');
          break;
        case 'MedicationGiver':
          router.replace('/medication-giver');
          break;
        case 'StockManager':
          router.replace('/stock-manager');
          break;
        default:
          router.replace('/admin');
      }
    } else if (patient && userType === 'patient') {
      router.replace('/patient');
    } else {
      router.replace('/login');
    }
  }, [user, patient, userType, loading, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-full border-2 border-[var(--brass)] border-t-transparent animate-spin" />
        <span className="font-mono text-xs text-[var(--text-dim)] uppercase tracking-wider">
          Loading DermaTrack Workstation...
        </span>
      </div>
    </div>
  );
}
