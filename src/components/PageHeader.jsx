export default function PageHeader({ title, description, action, icon: Icon }) {
  // Map old confusing props to semantic usage (title was eyebrow, description was heading)
  const eyebrowText = title;
  const headingText = description;

  return (
    <div className="mb-6 pb-4 relative">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between relative z-10">
        <div className="flex items-center gap-4">
          {Icon && (
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600 shadow-sm shrink-0">
              <Icon className="h-6 w-6" />
            </div>
          )}
          <div>
            {eyebrowText && <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{eyebrowText}</p>}
            {headingText && (
              <h2 className="mt-0.5 text-2xl font-bold text-slate-900 tracking-tight">{headingText}</h2>
            )}
          </div>
        </div>
        {action ? <div className="flex-shrink-0">{action}</div> : null}
      </div>
      {/* Subtle bottom border with gradient fade */}
      <div className="absolute bottom-0 left-0 h-px w-full bg-gradient-to-r from-slate-200 via-slate-200 to-transparent"></div>
    </div>
  );
}
