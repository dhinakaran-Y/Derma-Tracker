import React from 'react';

interface KpiCardProps {
  label: string;
  value: string | number;
  delta?: string;
  deltaType?: 'positive' | 'negative' | 'neutral' | 'warn';
  subtext?: string;
  icon?: React.ReactNode;
}

export function KpiCard({ label, value, delta, deltaType = 'neutral', subtext, icon }: KpiCardProps) {
  const deltaColor =
    deltaType === 'positive'
      ? 'text-[var(--success)]'
      : deltaType === 'negative'
      ? 'text-[var(--error)]'
      : deltaType === 'warn'
      ? 'text-[var(--warn)]'
      : 'text-[var(--text-dim)]';

  return (
    <div className="surface-card p-4 flex flex-col justify-between transition-all hover:border-[var(--border-light)]">
      <div className="flex items-center justify-between text-[var(--text-dim)] mb-2">
        <span className="font-mono text-xs uppercase tracking-wider">{label}</span>
        {icon && <div className="text-[var(--brass)] opacity-80">{icon}</div>}
      </div>

      <div className="flex items-baseline justify-between gap-2 mt-1">
        <span className="font-display text-2xl font-bold text-[var(--text)] tracking-tight">
          {value}
        </span>
        {delta && (
          <span className={`font-mono text-xs font-medium ${deltaColor}`}>
            {delta}
          </span>
        )}
      </div>

      {subtext && (
        <span className="text-xs text-[var(--text-dim)] mt-2 block">{subtext}</span>
      )}
    </div>
  );
}
