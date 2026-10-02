import React from 'react';
import { ArrowRight, ChevronRight, ArrowUpRight } from 'lucide-react';

const colorThemes = {
  blue: {
    accent: 'bg-blue-600',
    iconBg: 'bg-blue-50 text-blue-600',
    arrowBtn: 'bg-blue-50 text-blue-600 hover:bg-blue-100',
  },
  emerald: {
    accent: 'bg-emerald-500',
    iconBg: 'bg-emerald-50 text-emerald-600',
    arrowBtn: 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100',
  },
  green: {
    accent: 'bg-emerald-500',
    iconBg: 'bg-emerald-50 text-emerald-600',
    arrowBtn: 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100',
  },
  amber: {
    accent: 'bg-amber-500',
    iconBg: 'bg-amber-50 text-amber-600',
    arrowBtn: 'bg-amber-50 text-amber-600 hover:bg-amber-100',
  },
  orange: {
    accent: 'bg-amber-500',
    iconBg: 'bg-amber-50 text-amber-600',
    arrowBtn: 'bg-amber-50 text-amber-600 hover:bg-amber-100',
  },
  purple: {
    accent: 'bg-purple-600',
    iconBg: 'bg-purple-50 text-purple-600',
    arrowBtn: 'bg-purple-50 text-purple-600 hover:bg-purple-100',
  },
  red: {
    accent: 'bg-red-500',
    iconBg: 'bg-red-50 text-red-600',
    arrowBtn: 'bg-red-50 text-red-600 hover:bg-red-100',
  },
  teal: {
    accent: 'bg-teal-500',
    iconBg: 'bg-teal-50 text-teal-600',
    arrowBtn: 'bg-teal-50 text-teal-600 hover:bg-teal-100',
  },
};

function resolveTheme(color, type) {
  if (color && colorThemes[color]) return colorThemes[color];
  if (type === 'positive') return colorThemes.emerald;
  if (type === 'negative') return colorThemes.red;
  if (type === 'warning') return colorThemes.amber;
  return colorThemes.blue;
}

export default function StatsCard({ 
  title, 
  value, 
  description, 
  color = 'blue', 
  type = 'neutral', 
  trend, 
  trendValue, 
  icon: Icon,
  arrow = 'forward',
  onClick 
}) {
  const theme = resolveTheme(color, type);

  return (
    <div 
      onClick={onClick}
      className={`group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 px-5 sm:px-6 shadow-2xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md flex items-center justify-between gap-4 min-h-[96px] ${
        onClick ? 'cursor-pointer' : ''
      }`}
    >
      {/* Accent Bar */}
      <div className={`absolute left-0 top-0 bottom-0 w-1.5 rounded-l-2xl ${theme.accent}`} />

      {/* Left Icon + Text Column */}
      <div className="flex items-center gap-4 min-w-0">
        {Icon && (
          <div className={`flex h-12 w-12 items-center justify-center rounded-2xl shrink-0 transition-transform group-hover:scale-105 ${theme.iconBg}`}>
            <Icon className="h-6 w-6 stroke-[2.2]" />
          </div>
        )}
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 truncate leading-tight">
            {title}
          </p>
          <p className="text-2xl font-black text-slate-900 tracking-tight leading-tight my-1">
            {value}
          </p>
          {description && (
            <p className="text-xs font-medium text-slate-400 truncate leading-tight">
              {description}
            </p>
          )}
        </div>
      </div>

      {/* Right Arrow / Trend */}
      <div className="flex items-center gap-2 shrink-0">
        {trend && (
          <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
            trend === 'up' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
          }`}>
            {trend === 'up' ? '↑' : '↓'} {trendValue}
          </span>
        )}

        {arrow && (
          <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer ${theme.arrowBtn}`}>
            {arrow === 'right' ? (
              <ChevronRight className="w-4 h-4" />
            ) : arrow === 'forward' ? (
              <ArrowRight className="w-4 h-4 stroke-[2.5]" />
            ) : (
              <ArrowUpRight className="w-4 h-4" />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
