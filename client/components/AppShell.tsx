'use client';

import React from 'react';
import { Sidebar, NavGroup } from './Sidebar';
import { Topbar } from './Topbar';

interface AppShellProps {
  navGroups: NavGroup[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  pageTitle?: string;
  topbarActions?: React.ReactNode;
  onSearch?: (query: string) => void;
  children: React.ReactNode;
}

export function AppShell({
  navGroups,
  activeTab,
  onTabChange,
  pageTitle,
  topbarActions,
  onSearch,
  children,
}: AppShellProps) {
  return (
    <div className="flex min-h-screen bg-[var(--bg)]">
      {/* Permanent Dark Sidebar */}
      <Sidebar
        navGroups={navGroups}
        activeTab={activeTab}
        onTabChange={onTabChange}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar
          pageTitle={pageTitle}
          actions={topbarActions}
          onSearch={onSearch}
        />
        <main className="flex-1 p-6 overflow-y-auto max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
