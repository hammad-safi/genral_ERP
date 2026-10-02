import React from 'react';

export default function PageHeader({ 
  title, 
  description, 
  action, 
  icon: Icon,
  eyebrow
}) {
  return (
    <div className="mb-6 relative">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between relative z-10">
        <div className="flex items-center gap-3.5">
          {Icon && (
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-sm shadow-blue-500/20 shrink-0">
              <Icon className="h-6 w-6 stroke-[2.2]" />
            </div>
          )}
          <div>
            {eyebrow && (
              <p className="text-[11px] font-bold uppercase tracking-wider text-blue-600 mb-0.5">
                {eyebrow}
              </p>
            )}
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight leading-tight">
              {title}
            </h1>
            {description && (
              <p className="mt-0.5 text-xs sm:text-sm text-slate-500 font-normal">
                {description}
              </p>
            )}
          </div>
        </div>
        {action ? <div className="flex-shrink-0 flex items-center gap-2.5">{action}</div> : null}
      </div>
    </div>
  );
}
