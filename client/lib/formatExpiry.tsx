import React from 'react';

/**
 * Format expiry time remaining according to the clinical specification:
 * - Below 1 month: e.g. "29 days left", "15 days left", "1 day left"
 * - Below 1 year (>= 1 month): e.g. "11 months 3 days left", "4 months left"
 * - Above 1 year (>= 1 year): e.g. "3y 3m 12d left", "1y 5m left" (y=year, m=month, d=day)
 * - Expired: "Expired 15 days ago", "Expired 2 months 3 days ago", "Expired 1y 2m ago"
 */
export function formatExpiryTimeRemaining(dateStr: string | Date): {
  text: string;
  totalDays: number;
  isExpired: boolean;
  years: number;
  months: number;
  days: number;
  formattedDate: string;
} {
  const expiry = new Date(dateStr);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  expiry.setHours(0, 0, 0, 0);

  const formattedDate = isNaN(expiry.getTime())
    ? String(dateStr)
    : expiry.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });

  if (isNaN(expiry.getTime())) {
    return {
      text: 'Invalid date',
      totalDays: 0,
      isExpired: false,
      years: 0,
      months: 0,
      days: 0,
      formattedDate: String(dateStr),
    };
  }

  const diffMs = expiry.getTime() - now.getTime();
  const totalDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const isExpired = totalDays < 0;

  const start = isExpired ? new Date(expiry) : new Date(now);
  const end = isExpired ? new Date(now) : new Date(expiry);

  let years = end.getFullYear() - start.getFullYear();
  let months = end.getMonth() - start.getMonth();
  let days = end.getDate() - start.getDate();

  if (days < 0) {
    months -= 1;
    // Get days in the previous month of end date
    const prevMonth = new Date(end.getFullYear(), end.getMonth(), 0);
    days += prevMonth.getDate();
  }

  if (months < 0) {
    years -= 1;
    months += 12;
  }

  let text = '';
  if (isExpired) {
    if (years >= 1) {
      const parts = [`${years} y`];
      if (months > 0) parts.push(`${months} m`);
      if (days > 0) parts.push(`${days}d`);
      text = `Expired ${parts.join(' ')} ago`;
    } else if (months >= 1) {
      const mText = months === 1 ? '1 month' : `${months} months`;
      const dText = days > 0 ? (days === 1 ? ' 1 day' : ` ${days} days`) : '';
      text = `Expired ${mText}${dText} ago`;
    } else {
      const d = Math.abs(totalDays);
      text = d === 1 ? 'Expired 1 day ago' : `Expired ${d} days ago`;
    }
  } else if (totalDays === 0) {
    text = 'Expiring today';
  } else {
    // Future expiry
    if (years >= 1) {
      const parts = [`${years} y`];
      if (months > 0) parts.push(`${months} m`);
      if (days > 0) parts.push(`${days}d`);
      text = `${parts.join(' ')} left`;
    } else if (months >= 1) {
      const mText = months === 1 ? '1 month' : `${months} months`;
      const dText = days > 0 ? (days === 1 ? ' 1 day' : ` ${days} days`) : '';
      text = `${mText}${dText} left`;
    } else {
      text = days === 1 ? '1 day left' : `${days} days left`;
    }
  }

  return { text, totalDays, isExpired, years, months, days, formattedDate };
}

/**
 * Format from integer days remaining when only days are supplied (fallback helper)
 */
export function formatDaysRemainingText(daysRemaining: number): string {
  if (daysRemaining < 0) {
    const abs = Math.abs(daysRemaining);
    if (abs >= 365) {
      const y = Math.floor(abs / 365);
      const rem = abs % 365;
      const m = Math.floor(rem / 30);
      const d = rem % 30;
      const parts = [`${y} y`];
      if (m > 0) parts.push(`${m} m`);
      if (d > 0) parts.push(`${d}d`);
      return `Expired ${parts.join(' ')} ago`;
    }
    if (abs >= 30) {
      const m = Math.floor(abs / 30);
      const d = abs % 30;
      const mText = m === 1 ? '1 month' : `${m} months`;
      const dText = d > 0 ? (d === 1 ? ' 1 day' : ` ${d} days`) : '';
      return `Expired ${mText}${dText} ago`;
    }
    return abs === 1 ? 'Expired 1 day ago' : `Expired ${abs} days ago`;
  }

  if (daysRemaining === 0) return 'Expiring today';

  if (daysRemaining >= 365) {
    const y = Math.floor(daysRemaining / 365);
    const rem = daysRemaining % 365;
    const m = Math.floor(rem / 30);
    const d = rem % 30;
    const parts = [`${y} y`];
    if (m > 0) parts.push(`${m} m`);
    if (d > 0) parts.push(`${d}d`);
    return `${parts.join(' ')} left`;
  }

  if (daysRemaining >= 30) {
    const m = Math.floor(daysRemaining / 30);
    const d = daysRemaining % 30;
    const mText = m === 1 ? '1 month' : `${m} months`;
    const dText = d > 0 ? (d === 1 ? ' 1 day' : ` ${d} days`) : '';
    return `${mText}${dText} left`;
  }

  return daysRemaining === 1 ? '1 day left' : `${daysRemaining} days left`;
}

/**
 * Reusable clinical ExpiryBadge component
 */
export function ExpiryBadge({
  dateStr,
  daysRemaining,
  showDate = true,
  className = '',
}: {
  dateStr?: string | Date;
  daysRemaining?: number;
  showDate?: boolean;
  className?: string;
}) {
  const info = dateStr
    ? formatExpiryTimeRemaining(dateStr)
    : {
        text: formatDaysRemainingText(daysRemaining ?? 0),
        totalDays: daysRemaining ?? 0,
        isExpired: (daysRemaining ?? 0) < 0,
        formattedDate: '',
      };

  const { text, totalDays, isExpired, formattedDate } = info;
  const dateSuffix = showDate && formattedDate ? ` • ${formattedDate}` : '';

  if (isExpired) {
    return (
      <span
        className={`whitespace-nowrap inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse ${className}`}
      >
        ⛔ {text}{dateSuffix}
      </span>
    );
  }

  if (totalDays <= 30) {
    return (
      <span
        className={`whitespace-nowrap inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-500/15 text-red-400 border border-red-500/25 ${className}`}
      >
        🔴 {text}{dateSuffix}
      </span>
    );
  }

  if (totalDays <= 90) {
    return (
      <span
        className={`whitespace-nowrap inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-500/15 text-orange-400 border border-orange-500/25 ${className}`}
      >
        🟠 {text}{dateSuffix}
      </span>
    );
  }

  if (totalDays <= 180) {
    return (
      <span
        className={`whitespace-nowrap inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-yellow-500/15 text-yellow-500 border border-yellow-500/25 ${className}`}
      >
        🟡 {text}{dateSuffix}
      </span>
    );
  }

  return (
    <span
      className={`whitespace-nowrap inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 ${className}`}
    >
      ✅ {text}{dateSuffix}
    </span>
  );
}
