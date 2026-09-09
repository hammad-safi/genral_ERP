export default function StatsCard({ title, value, description, type = 'neutral', trend, trendValue, icon: Icon }) {
  const borderColors = {
    neutral: 'border-l-blue-500',
    positive: 'border-l-blue-500', // Changed from emerald-500 to blue-500 as per user request to make green cards blue
    negative: 'border-l-blue-500'
  };

  const iconColors = {
    neutral: 'text-blue-500',
    positive: 'text-blue-500',
    negative: 'text-blue-500'
  };

  return (
    <div className={`rounded-2xl border border-slate-200 border-l-4 ${borderColors[type]} bg-white p-5 shadow-sm hover:-translate-y-0.5 hover:shadow-card-hover transition-all duration-200`}>
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-2">
          {Icon && <Icon className={`w-5 h-5 ${iconColors[type]}`} />}
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</p>
        </div>
        {trend && (
          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
            trend === 'up' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
          }`}>
            {trend === 'up' ? '↑' : '↓'} {trendValue}
          </span>
        )}
      </div>
      <p className="mt-3 text-3xl font-bold text-slate-900 tracking-tight">{value}</p>
      <p className="mt-2 text-sm font-medium text-slate-500">{description}</p>
    </div>
  );
}
