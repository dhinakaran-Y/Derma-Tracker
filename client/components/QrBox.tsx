import React from 'react';
import { QRCodeSVG } from 'qrcode.react';

interface QrBoxProps {
  value: string;
  size?: number;
  label?: string;
  subtext?: string;
  className?: string;
}

export function QrBox({ value, size = 180, label, subtext, className = '' }: QrBoxProps) {
  return (
    <div className={`flex flex-col items-center justify-center p-5 bg-[var(--surface-2)] border border-[var(--border)] rounded-2xl shadow-inner ${className}`}>
      <div className="p-4 bg-white rounded-xl shadow-lg border border-slate-200">
        <QRCodeSVG
          value={value}
          size={size}
          level="M"
          includeMargin={false}
        />
      </div>
      {label && (
        <p className="font-mono text-xs font-bold text-[var(--text)] mt-3.5 tracking-wider uppercase">
          {label}
        </p>
      )}
      {subtext && (
        <p className="text-xs text-[var(--text-dim)] font-medium mt-1 text-center max-w-[280px] leading-relaxed">
          {subtext}
        </p>
      )}
    </div>
  );
}
