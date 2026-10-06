'use client';

import React from 'react';
import { useTheme } from '../hooks/useTheme';
import { Sun, Moon, Search } from 'lucide-react';

interface TopbarProps {
  pageTitle?: string;
  onSearch?: (query: string) => void;
  actions?: React.ReactNode;
}

export function Topbar({ pageTitle, onSearch, actions }: TopbarProps) {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="h-14 px-6 border-b border-[var(--border)] bg-[var(--surface)] flex items-center justify-between gap-4 sticky top-0 z-30">
      <div className="flex items-center gap-4">
        {pageTitle && (
          <h1 className="font-display font-bold text-sm tracking-wide text-[var(--text)] uppercase">
            {pageTitle}
          </h1>
        )}

        {onSearch && (
          <div className="relative w-64 hidden sm:block">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-dim)]" />
            <input
              type="text"
              placeholder="Quick search (Patient / ID / Rx)..."
              onChange={(e) => onSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-[var(--surface-2)] border border-[var(--border)] rounded-md text-[var(--text)] placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--brass)] font-mono"
            />
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        {actions}

        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          type="button"
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
          className="p-2 text-[var(--text-dim)] hover:text-[var(--text)] bg-[var(--surface-2)] border border-[var(--border)] rounded-md transition-colors"
        >
          {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
        </button>
      </div>
    </header>
  );
}
