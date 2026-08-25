import { Cell, Line, LineChart, Bar, BarChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from 'recharts';
import { formatCurrency, formatDate } from '@/lib/utils';

const CustomTooltip = ({ active, payload, label, currency }) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white shadow-lg p-3">
        <p className="text-sm font-medium text-slate-600">{label}</p>
        <p className="text-sm text-slate-900">{formatCurrency(Number(payload[0].value), currency)}</p>
      </div>
    );
  }
  return null;
};

export default function DashboardCharts({ lineData, barData, pieData, recentTransactions = [], currency }) {
  
  // Color scheme
  const colors = {
    textPrimary: '#64748b',
    textSecondary: '#94a3b8',
    gridColor: '#e2e8f0',
    axisColor: '#e2e8f0',
    lineColor: '#3b82f6',
    revenueColor: '#3b82f6',
    expenseColor: '#ef4444',
  };

  return (
    <>
      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-600">Trend</p>
              <h3 className="text-lg font-bold text-slate-900">Daily Sales (30 days)</h3>
            </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineData}>
                <XAxis 
                  dataKey="name" 
                  tick={{ fontSize: 11, fill: colors.textPrimary }} 
                  axisLine={{ stroke: colors.axisColor }}
                  tickLine={{ stroke: colors.gridColor }}
                />
                <YAxis 
                  tick={{ fontSize: 11, fill: colors.textPrimary }}
                  axisLine={{ stroke: colors.axisColor }}
                  tickLine={{ stroke: colors.gridColor }}
                  tickFormatter={(value) => value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value}
                />
                <Tooltip content={<CustomTooltip currency={currency} />} />
                <Line 
                  type="monotone" 
                  dataKey="value" 
                  stroke={colors.lineColor} 
                  strokeWidth={3} 
                  dot={false}
                  activeDot={{ r: 6, fill: colors.lineColor, stroke: '#fff', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-600">Comparison</p>
              <h3 className="text-lg font-bold text-slate-900">Revenue vs Expenses</h3>
            </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData}>
                <XAxis 
                  dataKey="name" 
                  tick={{ fontSize: 11, fill: colors.textPrimary }}
                  axisLine={{ stroke: colors.axisColor }}
                  tickLine={{ stroke: colors.gridColor }}
                />
                <YAxis 
                  tick={{ fontSize: 11, fill: colors.textPrimary }}
                  axisLine={{ stroke: colors.axisColor }}
                  tickLine={{ stroke: colors.gridColor }}
                  tickFormatter={(value) => value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value}
                />
                <Tooltip content={<CustomTooltip currency={currency} />} />
                <Legend 
                  wrapperStyle={{ color: colors.textPrimary, paddingTop: '16px' }}
                  iconType="square"
                />
                <Bar dataKey="revenue" fill={colors.revenueColor} radius={[4, 4, 0, 0]} />
                <Bar dataKey="expense" fill={colors.expenseColor} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-600">Distribution</p>
              <h3 className="text-lg font-bold text-slate-900">Top Sales by Category</h3>
            </div>
          </div>
          <div className="h-72">
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData.filter((entry) => entry.value > 0)}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                    nameKey="name"
                    label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                    labelLine={{ stroke: colors.textSecondary }}
                  >
                    {pieData.filter((entry) => entry.value > 0).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip currency={currency} />} />
                  <Legend 
                    wrapperStyle={{ color: colors.textPrimary, paddingTop: '16px' }}
                    iconType="square"
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-slate-500">No sales category data available yet.</div>
            )}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-panel">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900">Recent Transactions</h3>
          </div>
          <div className="space-y-3">
            {recentTransactions.length === 0 ? (
              <p className="text-sm text-slate-500">No recent activity yet.</p>
            ) : (
              recentTransactions.map((txn, index) => (
                <div key={`${txn.type}-${index}`} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between mb-3">
                    <p className="font-semibold text-slate-900">{txn.type}</p>
                    <p className="text-sm text-slate-500">{formatDate(txn.date)}</p>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3 text-sm text-slate-600">
                    <p>{txn.label}</p>
                    <p>{formatCurrency(txn.amount, currency)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </>
  );
}
