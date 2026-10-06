'use client';

import React, { useState } from 'react';
import { Hospital } from '../types';
import { ShieldCheck, Building2, Stethoscope } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';

interface HospitalBrandBadgeProps {
  hospital?: Hospital | null;
  roleName?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showSubtitle?: boolean;
}

// Compute initials from shortName e.g. "Maga Health Care" -> "MH", "Apollo" -> "AP", "DermaTrack" -> "DT"
export function getHospitalInitials(name?: string): string {
  if (!name) return 'DT';
  const clean = name.trim();
  const words = clean.split(/[\s\-_]+/);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  if (clean.length >= 2) {
    return clean.slice(0, 2).toUpperCase();
  }
  return clean.toUpperCase() || 'DT';
}

// Format media URLs so uploads point to backend or rewrite
export function getMediaUrl(path?: string): string {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
    return path;
  }
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  // Directly point to backend server port 5000 if not in production proxy
  const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:5000';
  return `${serverUrl}${cleanPath}`;
}

export function HospitalBrandBadge({
  hospital,
  roleName = 'Portal',
  className = '',
  size = 'md',
  showSubtitle = true,
}: HospitalBrandBadgeProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [imgError, setImgError] = useState(false);
  const { theme } = useTheme();
  const isLight = theme === 'light';

  const shortName = hospital?.shortName || 'DermaTrack';
  const fullName = hospital?.name || (shortName === 'DermaTrack' ? 'DermaTrack Trichology & Dermatology Hospital' : shortName);
  const rawLogo = hospital?.logoUrl || hospital?.imageUrl;
  const logoUrl = rawLogo ? getMediaUrl(rawLogo) : null;
  const facilityType = hospital?.type || 'Clinic';
  const initials = getHospitalInitials(shortName);

  React.useEffect(() => {
    setImgError(false);
  }, [logoUrl]);

  const formattedType =
    facilityType === 'BigHospital'
      ? 'Multi-Specialty Hospital'
      : facilityType === 'Hospital'
      ? 'Dermatology Hospital'
      : 'Specialized Trichology Clinic';

  const avatarSizes = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
  };

  const hasImage = !!logoUrl && !imgError;

  return (
    <div
      className={`relative inline-block ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex items-center gap-3 cursor-pointer group">
        {/* Dynamic Logo Avatar */}
        <div
          className={`${avatarSizes[size]} rounded-lg overflow-hidden shrink-0 flex items-center justify-center font-bold font-mono tracking-wider transition-all duration-200 border border-[var(--brass)]/40 group-hover:border-[var(--brass)] group-hover:shadow-[0_0_15px_rgba(201,138,75,0.4)] ${
            hasImage
              ? 'bg-white p-1 shadow-sm'
              : 'bg-gradient-to-br from-[#C98A4B] to-[#8C5220] text-white shadow-md'
          }`}
        >
          {hasImage ? (
            <img
              src={logoUrl}
              alt={shortName}
              className="w-full h-full object-contain rounded"
              onError={() => setImgError(true)}
            />
          ) : (
            <span className="font-bold tracking-wider">{initials}</span>
          )}
        </div>

        {/* Brand Text */}
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-display font-bold text-sm tracking-wider text-white truncate block group-hover:text-[#C98A4B] transition-colors">
              {shortName.toUpperCase()}
            </span>
          </div>
          {showSubtitle && (
            <span className="font-mono text-[10px] text-[#C98A4B] uppercase tracking-widest block truncate font-medium">
              {roleName}
            </span>
          )}
        </div>
      </div>

      {/* Rich Hover Tooltip / Card showing Full Name & Verification */}
      {isHovered && (
        <div
          className={`absolute left-0 top-full mt-2 z-50 w-64 p-4 rounded-xl border shadow-2xl animate-in fade-in zoom-in-95 duration-150 pointer-events-none transition-colors ${
            isLight
              ? 'bg-white text-[#172120] border-[#C98A4B]/50 shadow-[0_12px_32px_rgba(0,0,0,0.18)]'
              : 'bg-[#141B1E] text-white border-[#C98A4B]/60 shadow-[0_12px_32px_rgba(0,0,0,0.8)]'
          }`}
        >
          <div className="flex items-start gap-3">
            <div
              className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 mt-0.5 shadow-sm border ${
                isLight
                  ? 'bg-[#FFF6ED] border-[#ECC8A1] text-[#A8672D]'
                  : 'bg-[#C98A4B]/20 border-[#C98A4B]/50 text-[#E5A967]'
              }`}
            >
              {facilityType === 'Clinic' ? <Stethoscope className="w-5 h-5" /> : <Building2 className="w-5 h-5" />}
            </div>
            <div className="min-w-0 flex-1">
              <span
                className={`font-display font-bold text-sm leading-snug block ${
                  isLight ? 'text-[#121A18]' : 'text-white drop-shadow-sm'
                }`}
              >
                {fullName}
              </span>
              <span
                className={`font-mono text-[11px] font-semibold block mt-0.5 tracking-wide ${
                  isLight ? 'text-[#A8672D]' : 'text-[#D99B5C]'
                }`}
              >
                {formattedType}
              </span>
            </div>
          </div>

          <div
            className={`mt-3 pt-2.5 border-t flex items-center justify-between text-[11px] font-mono ${
              isLight ? 'border-[#E2E8E6]' : 'border-[#263337]'
            }`}
          >
            <span
              className={`flex items-center gap-1.5 font-semibold ${
                isLight ? 'text-[#2E8552]' : 'text-[#5FAE7C]'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              Verified Facility
            </span>
            {hospital?.websiteUrl && (
              <span
                className={`flex items-center gap-0.5 truncate max-w-[110px] ${
                  isLight ? 'text-[#5C6B68]' : 'text-[#A2B3AE]'
                }`}
              >
                {hospital.websiteUrl.replace(/^https?:\/\//, '')}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
