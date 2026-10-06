'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../hooks/useAuth';
import {
  LayoutDashboard,
  UserCheck,
  Calendar,
  CreditCard,
  Pill,
  Users,
  Stethoscope,
  QrCode,
  Package,
  Layers,
  AlertTriangle,
  FileText,
  Settings,
  ShieldAlert,
  Percent,
  TrendingUp,
  History,
  User,
  LogOut,
} from 'lucide-react';

import { HospitalBrandBadge } from './HospitalBrandBadge';

export interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number | string;
}

export interface NavGroup {
  title?: string;
  items: NavItem[];
}

interface SidebarProps {
  navGroups: NavGroup[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  titlePrefix?: string;
}

export function Sidebar({ navGroups, activeTab, onTabChange }: SidebarProps) {
  const { user, patient, hospital, userType, logout } = useAuth();
  const displayName = user?.fullName || patient?.name || 'User';
  const roleName = user?.role || (userType === 'patient' ? 'Patient' : 'Guest');

  return (
    <aside className="app-sidebar w-64 h-screen sticky top-0 flex flex-col shrink-0 p-4 select-none bg-[#10161A] text-[#E5ECE9] border-r border-[#232D30] z-40">
      {/* Top Brand Header */}
      <div className="shrink-0 px-2 py-3 mb-4 border-b border-[#232D30]">
        <HospitalBrandBadge
          hospital={hospital}
          roleName={`${roleName} Portal`}
          size="md"
        />
      </div>

      {/* Navigation Groups (Scrollable) */}
      <div className="flex-1 overflow-y-auto min-h-0 space-y-6 pr-1 custom-sidebar-scroll">
        {navGroups.map((group, gIdx) => (
          <div key={gIdx}>
            {group.title && (
              <div className="px-3 mb-2 font-mono text-[10px] font-semibold text-[#7A8B88] uppercase tracking-wider">
                {group.title}
              </div>
            )}
            <nav className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onTabChange(item.id)}
                    type="button"
                    className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium rounded-md transition-all text-left group ${
                      isActive
                        ? 'bg-[#1B2325] text-white font-semibold border-l-2 border-[#C98A4B] pl-[10px] shadow-sm'
                        : 'text-[#7A8B88] hover:bg-[#1B2325] hover:text-[#E5ECE9]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon
                        className={`w-4 h-4 transition-colors ${
                          isActive ? 'text-[#C98A4B]' : 'text-[#4F5E5C] group-hover:text-[#E5ECE9]'
                        }`}
                      />
                      <span>{item.label}</span>
                    </div>
                    {item.badge !== undefined && (
                      <span
                        className={`font-mono text-[10px] px-1.5 py-0.5 rounded-full ${
                          isActive
                            ? 'bg-[#C98A4B] text-white font-bold'
                            : 'bg-[#151C1D] text-[#7A8B88] border border-[#232D30]'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>
        ))}
      </div>

      {/* User Footer Profile & Logout (Fixed at Bottom) */}
      <div className="shrink-0 pt-3 border-t border-[#232D30] mt-auto">
        <div className="flex items-center justify-between px-2.5 py-2 rounded-lg bg-[#151C1D]/60 border border-[#232D30]">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-full bg-[#C98A4B]/20 border border-[#C98A4B]/40 flex items-center justify-center text-xs text-[#C98A4B] font-bold shrink-0">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div className="overflow-hidden">
              <span className="block text-xs font-semibold text-[#E5ECE9] truncate">{displayName}</span>
              <span className="block font-mono text-[10px] text-[#7A8B88] truncate">{roleName}</span>
            </div>
          </div>
          <button
            onClick={() => logout()}
            type="button"
            title="Log out"
            className="p-1.5 text-[#7A8B88] hover:text-[#C9614B] hover:bg-[#1B2325] rounded transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
