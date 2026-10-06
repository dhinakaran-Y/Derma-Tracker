import React from 'react';

export type BadgeVariant = 'success' | 'warn' | 'error' | 'brass' | 'neutral' | 'info';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
  size?: 'sm' | 'md';
}

export function Badge({ children, variant = 'neutral', className = '', size = 'sm' }: BadgeProps) {
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs';
  const variantClass = `badge-${variant}`;

  return (
    <span
      className={`inline-flex items-center gap-1 font-mono font-medium rounded-full ${sizeClasses} ${variantClass} ${className}`}
    >
      {children}
    </span>
  );
}
