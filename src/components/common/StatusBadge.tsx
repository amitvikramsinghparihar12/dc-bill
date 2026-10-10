import React from 'react';
import { BillStatus } from '../../types';

interface StatusBadgeProps {
  status: BillStatus | string;
  size?: 'sm' | 'md' | 'lg';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  let colorClass = 'bg-slate-100 text-slate-700 border-slate-300';
  let dotClass = 'bg-slate-400';

  switch (status) {
    case 'Draft':
      colorClass = 'bg-slate-100 text-slate-700 border-slate-300';
      dotClass = 'bg-slate-400';
      break;
    case 'Pending Verification':
      colorClass = 'bg-amber-50 text-amber-800 border-amber-300';
      dotClass = 'bg-amber-500 animate-pulse';
      break;
    case 'Pending Approval':
      colorClass = 'bg-blue-50 text-blue-800 border-blue-300';
      dotClass = 'bg-blue-600 animate-pulse';
      break;
    case 'Pending RTGS':
      colorClass = 'bg-purple-50 text-purple-800 border-purple-300';
      dotClass = 'bg-purple-600';
      break;
    case 'Paid':
    case 'Approved':
      colorClass = 'bg-emerald-50 text-emerald-800 border-emerald-300';
      dotClass = 'bg-emerald-600';
      break;
    case 'Rejected':
      colorClass = 'bg-rose-50 text-rose-800 border-rose-300';
      dotClass = 'bg-rose-600';
      break;
    case 'Uploaded':
      colorClass = 'bg-emerald-50 text-emerald-700 border-emerald-300';
      dotClass = 'bg-emerald-500';
      break;
    case 'Pending':
      colorClass = 'bg-amber-50 text-amber-700 border-amber-300';
      dotClass = 'bg-amber-500';
      break;
    default:
      colorClass = 'bg-slate-100 text-slate-700 border-slate-200';
      dotClass = 'bg-slate-400';
  }

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 gap-1',
    md: 'text-xs font-semibold px-2.5 py-1 gap-1.5',
    lg: 'text-sm font-semibold px-3 py-1.5 gap-2',
  }[size];

  return (
    <span
      className={`inline-flex items-center rounded-md border font-medium ${sizeClasses} ${colorClass}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />
      <span>{status}</span>
    </span>
  );
};
