import React from 'react';

interface RockerOption {
  label: string;
  value: string;
  count?: number;
}

interface RockerToggleProps {
  options: [RockerOption, RockerOption] | RockerOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function RockerToggle({ options, value, onChange, className = '' }: RockerToggleProps) {
  return (
    <div className={`inline-flex p-1 bg-[var(--surface-2)] border border-[var(--border)] rounded-md ${className}`}>
      {options.map((opt) => {
        const isSelected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`px-3 py-1 text-xs font-mono font-medium rounded transition-all duration-150 flex items-center gap-1.5 ${
              isSelected
                ? 'bg-[var(--brass)] text-white shadow-sm'
                : 'text-[var(--text-dim)] hover:text-[var(--text)]'
            }`}
          >
            <span>{opt.label}</span>
            {opt.count !== undefined && (
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  isSelected ? 'bg-black/20 text-white' : 'bg-[var(--surface-3)] text-[var(--text-dim)]'
                }`}
              >
                {opt.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
