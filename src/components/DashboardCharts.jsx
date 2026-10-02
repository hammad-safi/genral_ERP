import { Cell, Area, AreaChart, Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from 'recharts';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Package, TrendingUp } from 'lucide-react';

const CustomTooltip = ({ active, payload, label, currency }) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white/90 backdrop-blur-sm shadow-card p-3">
        <p className="text-xs font-semibold text-slate-500 mb-1">{label}</p>
        <p className="text-sm font-bold text-blue-600">{formatCurrency(Number(payload[0].value), currency)}</p>
      </div>
    );
  }
  return null;
};

export default function DashboardCharts({ lineData, barData, recentTransactions = [], topSellingProducts = [], currency }) {
  
  // Color scheme
  const colors = {
    textPrimary: '#64748b',
    textSecondary: '#94a3b8',
    gridColor: '#f1f5f9',
    axisColor: '#e2e8f0',
    lineColor: '#2563eb', // blue-600
    revenueColor: '#2563eb', // vibrant blue
    expenseColor: '#10b981', // emerald green matching reference
  };

  return (
    <>
      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Trend</p>
              <h3 className="text-lg font-bold text-slate-900 tracking-tight">Daily Sales (30 days)</h3>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={lineData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={colors.lineColor} stopOpacity={0.2}/>
                    <stop offset="95%" stopColor={colors.lineColor} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis 
                  dataKey="name" 
                  tick={{ fontSize: 11, fill: colors.textPrimary }} 
                  axisLine={{ stroke: colors.axisColor }}
                  tickLine={false}
                  tickMargin={10}
                />
                <YAxis 
                  tick={{ fontSize: 11, fill: colors.textPrimary }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(value) => value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value}
                />
                <Tooltip content={<CustomTooltip currency={currency} />} cursor={{ stroke: colors.axisColor, strokeWidth: 1, strokeDasharray: '4 4' }} />
                <Area 
                  type="monotone" 
                  dataKey="value" 
                  stroke={colors.lineColor} 
                  fillOpacity={1}
                  fill="url(#colorSales)"
                  strokeWidth={2} 
                  activeDot={{ r: 4, fill: '#fff', stroke: colors.lineColor, strokeWidth: 2 }}
                />
              </AreaChart>
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
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-600">Performance</p>
              <h3 className="text-lg font-bold text-slate-900">Top Selling Products</h3>
            </div>
          </div>
          <div className="h-72 overflow-y-auto pr-2">
            {topSellingProducts.length > 0 ? (
              <div className="space-y-3">
                {/* Top 1 Product is highlighted */}
                <div className="flex items-start gap-4 rounded-xl bg-blue-50/50 p-4 border border-blue-100 relative mt-2">
                  <div className="absolute -top-[1px] -left-[1px] bg-blue-600 text-white w-7 h-7 rounded-tl-xl rounded-br-xl flex items-center justify-center text-sm font-bold shadow-sm z-10">1</div>
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-600 overflow-hidden ml-2">
                    {topSellingProducts[0].image && topSellingProducts[0].image.startsWith('data:image') ? (
                      <img src={topSellingProducts[0].image} alt={topSellingProducts[0].name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full bg-[#dbeafe]"></div>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="text-lg font-bold text-slate-900 leading-tight">{topSellingProducts[0].name}</h4>
                      </div>
                      <div className="text-right">
                        <p className="text-base font-bold text-slate-900">{topSellingProducts[0].quantity} sold</p>
                        <p className="text-sm font-semibold text-emerald-600">{formatCurrency(topSellingProducts[0].revenue, currency)}</p>
                      </div>
                    </div>
                    <div className="mt-2 text-sm text-slate-500 font-medium">Price: {formatCurrency(topSellingProducts[0].price, currency)}</div>
                  </div>
                </div>

                {/* Remaining top products */}
                <div className="space-y-3">
                  {topSellingProducts.slice(1).map((product, index) => (
                    <div key={index} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-white hover:bg-slate-50 transition-colors relative mt-3">
                      <div className="absolute -top-[1px] -left-[1px] bg-slate-200 text-slate-700 w-6 h-6 rounded-tl-xl rounded-br-xl flex items-center justify-center text-xs font-bold shadow-sm z-10">{index + 2}</div>
                      <div className="flex items-center gap-3 pl-2">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 overflow-hidden">
                          {product.image && product.image.startsWith('data:image') ? (
                            <img src={product.image} alt={product.name} className="h-full w-full object-cover" />
                          ) : (
                            <div className="h-full w-full bg-slate-100"></div>
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 leading-tight">{product.name}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{formatCurrency(product.price, currency)}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-slate-900">{product.quantity} sold</p>
                        <p className="text-xs font-semibold text-emerald-600">{formatCurrency(product.revenue, currency)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center text-slate-500">No sales data available yet.</div>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900">Recent Transactions</h3>
          </div>
          <div className="space-y-3">
            {recentTransactions.length === 0 ? (
              <p className="text-sm text-slate-500">No recent activity yet.</p>
            ) : (
              recentTransactions.map((txn, index) => (
                <div key={`${txn.type}-${index}`} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
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
