'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Medicine } from '../types';
import { Badge } from './Badge';
import { getMediaUrl } from '../lib/api';
import { formatExpiryTimeRemaining } from '../lib/formatExpiry';
import { Search, X, Check, AlertCircle } from 'lucide-react';

interface MedicineSearchDropdownProps {
  medicines: Medicine[];
  selectedMedicineId?: string;
  onSelectMedicine: (medicine: Medicine) => void;
  placeholder?: string;
  onlyInStock?: boolean;
  className?: string;
}

export function MedicineSearchDropdown({
  medicines,
  selectedMedicineId,
  onSelectMedicine,
  placeholder = 'Search medicine by brand name, generic name, or category...',
  onlyInStock = true,
  className = '',
}: MedicineSearchDropdownProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedTerm, setDebouncedTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounce search term by 200ms
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedTerm(searchTerm.trim());
    }, 200);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filtered medicines
  const filteredMedicines = useMemo(() => {
    return medicines.filter((m) => {
      // Must be active
      if (m.isActive === false) return false;

      // Filter in-stock if requested
      if (onlyInStock && (m.totalStock || 0) <= 0) return false;

      if (!debouncedTerm) return true;

      const query = debouncedTerm.toLowerCase();
      const matchName = m.name?.toLowerCase().includes(query);
      const matchGeneric = m.genericName?.toLowerCase().includes(query);
      const matchCategory = m.category?.toLowerCase().includes(query);
      const matchManufacturer = m.manufacturer?.toLowerCase().includes(query);

      return matchName || matchGeneric || matchCategory || matchManufacturer;
    });
  }, [medicines, debouncedTerm, onlyInStock]);

  const selectedMedicine = useMemo(() => {
    return medicines.find((m) => m._id === selectedMedicineId);
  }, [medicines, selectedMedicineId]);

  const handleSelect = (med: Medicine) => {
    onSelectMedicine(med);
    setSearchTerm('');
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev < filteredMedicines.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev > 0 ? prev - 1 : filteredMedicines.length - 1
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < filteredMedicines.length) {
        handleSelect(filteredMedicines[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      {/* Search Input Box */}
      <div className="relative">
        <Search className="w-4 h-4 text-[var(--text-dim)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setIsOpen(true);
            setHighlightedIndex(-1);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={selectedMedicine ? `${selectedMedicine.name} (${selectedMedicine.category}) — change...` : placeholder}
          className="w-full pl-9 pr-8 py-2 text-xs bg-[var(--surface-2)] border border-[var(--border)] rounded-md text-[var(--text)] placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--brass)] font-sans"
        />
        {searchTerm && (
          <button
            type="button"
            onClick={() => {
              setSearchTerm('');
              inputRef.current?.focus();
            }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-dim)] hover:text-[var(--text)] p-0.5"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Live Dropdown Results */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-40 bg-[var(--surface)] border border-[var(--border)] rounded-lg shadow-xl max-h-64 overflow-y-auto divide-y divide-[var(--border)]/50">
          <div className="px-3 py-1.5 bg-[var(--surface-2)]/80 text-[10px] font-mono text-[var(--text-dim)] flex items-center justify-between">
            <span>Pharmacy Catalogue ({filteredMedicines.length} in stock)</span>
            <span className="text-[9px]">Use ↑↓ to navigate, Enter to select</span>
          </div>

          {filteredMedicines.length > 0 ? (
            filteredMedicines.map((med, idx) => {
              const isSelected = med._id === selectedMedicineId;
              const isHighlighted = idx === highlightedIndex;

              return (
                <div
                  key={med._id}
                  onClick={() => handleSelect(med)}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  className={`p-2.5 flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                    isHighlighted
                      ? 'bg-[var(--surface-2)]'
                      : isSelected
                      ? 'bg-[var(--brass)]/10'
                      : 'hover:bg-[var(--surface-2)]/60'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {med.imageUrl ? (
                      <img
                        src={getMediaUrl(med.imageUrl)}
                        alt={med.name}
                        className="w-9 h-9 object-cover rounded border border-[var(--border)] shrink-0 bg-white shadow-xs"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded bg-[var(--surface-3)] border border-[var(--border)] flex items-center justify-center shrink-0 text-base shadow-xs" title={med.category}>
                        {med.category === 'Serum' ? '💧' : med.category === 'Shampoo' ? '🧴' : med.category === 'Solution' ? '🧪' : med.category === 'Ointment' ? '🩹' : med.category === 'Oil' ? '✨' : '💊'}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <strong className="text-xs font-semibold text-[var(--text)] truncate block">
                          {med.name}
                        </strong>
                        <Badge variant="brass" size="sm">
                          {med.category}
                        </Badge>
                      </div>
                      <span className="text-[11px] font-mono text-[var(--text-dim)] block truncate">
                        {med.genericName || 'Standard'} • ₹{med.sellingPrice} / {med.unit}
                      </span>
                      {med.description && (
                        <span className="text-[10px] text-[var(--text-dim)] block truncate max-w-[300px]" title={med.description}>
                          {med.description.slice(0, 65)}{med.description.length > 65 ? '...' : ''}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-right shrink-0 flex items-center gap-2">
                    {med.batches && med.batches.length > 0 && (() => {
                      const validBatches = med.batches.filter((b) => b.quantity > 0);
                      if (validBatches.length === 0) return null;
                      const sorted = [...validBatches].sort(
                        (a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime()
                      );
                      const nearest = sorted[0];
                      const info = formatExpiryTimeRemaining(nearest.expiryDate);
                      const badgeClass = info.isExpired
                        ? 'bg-red-500/20 text-red-400 border-red-500/30'
                        : info.totalDays <= 60 
                        ? 'bg-amber-500/15 text-amber-400 border-amber-500/25'
                        : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
                      return (
                        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${badgeClass}`} title={`Nearest expiry: ${info.formattedDate}`}>
                          {info.text}
                        </span>
                      );
                    })()}
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      {med.totalStock} in stock
                    </span>
                    {isSelected && (
                      <Check className="w-3.5 h-3.5 text-[var(--brass)]" />
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-4 text-center text-xs font-mono text-[var(--text-dim)] space-y-1">
              <AlertCircle className="w-4 h-4 mx-auto text-[var(--text-dim)] mb-1" />
              <p>No in-stock medicines match &quot;{searchTerm}&quot;</p>
              <span className="text-[10px] text-[var(--text-dim)]/70">
                Try searching by brand (e.g. Kera, Strandz, CosmoQ, Duman)
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default MedicineSearchDropdown;
