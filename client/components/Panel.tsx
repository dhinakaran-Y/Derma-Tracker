import React from 'react';

interface PanelProps {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
}

export function Panel({ title, subtitle, action, children, className = '', noPadding = false }: PanelProps) {
  return (
    <div className={`surface-card overflow-hidden ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--border)] bg-[var(--surface-2)]">
          <div>
            {title && <h3 className="font-display font-semibold text-sm text-[var(--text)] tracking-wide">{title}</h3>}
            {subtitle && <p className="text-xs text-[var(--text-dim)] mt-0.5">{subtitle}</p>}
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      <div className={noPadding ? '' : 'p-5'}>{children}</div>
    </div>
  );
}
