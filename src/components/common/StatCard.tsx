import React from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: string;
  trendPositive?: boolean;
  colorScheme?: 'blue' | 'emerald' | 'amber' | 'purple' | 'rose' | 'slate';
  onClick?: () => void;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  trend,
  trendPositive,
  colorScheme = 'blue',
  onClick,
}) => {
  const schemeStyles = {
    blue: {
      border: 'border-blue-100 hover:border-blue-300',
      iconBg: 'bg-blue-50 text-blue-700',
    },
    emerald: {
      border: 'border-emerald-100 hover:border-emerald-300',
      iconBg: 'bg-emerald-50 text-emerald-700',
    },
    amber: {
      border: 'border-amber-100 hover:border-amber-300',
      iconBg: 'bg-amber-50 text-amber-700',
    },
    purple: {
      border: 'border-purple-100 hover:border-purple-300',
      iconBg: 'bg-purple-50 text-purple-700',
    },
    rose: {
      border: 'border-rose-100 hover:border-rose-300',
      iconBg: 'bg-rose-50 text-rose-700',
    },
    slate: {
      border: 'border-slate-200 hover:border-slate-300',
      iconBg: 'bg-slate-100 text-slate-700',
    },
  }[colorScheme];

  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl border p-5 shadow-xs transition-all ${
        onClick ? 'cursor-pointer hover:shadow-md' : ''
      } ${schemeStyles.border}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          {title}
        </span>
        <div className={`p-2.5 rounded-lg ${schemeStyles.iconBg}`}>{icon}</div>
      </div>

      <div className="mt-3">
        <div className="text-2xl font-bold tracking-tight text-slate-900">{value}</div>
        {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
      </div>

      {trend && (
        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center text-xs">
          <span
            className={`font-semibold mr-1.5 ${
              trendPositive ? 'text-emerald-600' : 'text-rose-600'
            }`}
          >
            {trend}
          </span>
          <span className="text-slate-400">vs last financial quarter</span>
        </div>
      )}
    </div>
  );
};
