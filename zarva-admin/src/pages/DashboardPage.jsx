import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid
} from 'recharts';
import {
  DollarSign, Users, Briefcase, AlertTriangle,
  TrendingUp, Clock, Activity
} from 'lucide-react';

// ── Mock chart data (30 days) ─────────────────────
const MOCK_CHART_DATA = Array.from({ length: 30 }, (_, i) => {
  const date = new Date();
  date.setDate(date.getDate() - 29 + i);
  const revenue = Math.floor(8000 + Math.random() * 12000);
  return {
    date: date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
    revenue,
    payouts: Math.floor(revenue * (0.6 + Math.random() * 0.15)),
  };
});

// ── Mock ops feed ──────────────────────────────────
const MOCK_FEED = [
  { id: 1, text: 'Worker Arun accepted Job #1247', type: 'success', time: '2m ago' },
  { id: 2, text: 'Dispute opened by Customer Jane — Job #1241', type: 'warn', time: '5m ago' },
  { id: 3, text: 'Worker KYC approved — Ravi M.', type: 'info', time: '12m ago' },
  { id: 4, text: 'Job #1238 completed — ₹2,450 settled', type: 'success', time: '18m ago' },
  { id: 5, text: 'Customer Priya boosted rate to ₹600/hr', type: 'info', time: '22m ago' },
  { id: 6, text: 'Worker Suresh went offline', type: 'neutral', time: '30m ago' },
  { id: 7, text: 'New customer registration — +91 98456XXXXX', type: 'info', time: '35m ago' },
  { id: 8, text: 'Dispute resolved — Job #1230 (refund issued)', type: 'success', time: '1h ago' },
];

const FEED_COLORS = {
  success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  warn:    'bg-amber-500/10 text-amber-400 border-amber-500/20',
  info:    'bg-blue-500/10 text-blue-400 border-blue-500/20',
  neutral: 'bg-zinc-800 text-zinc-400 border-zinc-700',
};

function KPICard({ title, value, icon: Icon, trend, color }) {
  const colors = {
    purple:  'from-purple-500/15 to-transparent border-purple-500/20 text-purple-400',
    emerald: 'from-emerald-500/15 to-transparent border-emerald-500/20 text-emerald-400',
    blue:    'from-blue-500/15 to-transparent border-blue-500/20 text-blue-400',
    amber:   'from-amber-500/15 to-transparent border-amber-500/20 text-amber-400',
  };

  return (
    <div className={`relative overflow-hidden rounded-xl border bg-gradient-to-br ${colors[color]} p-5`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">{title}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-white">{value}</p>
          {trend && (
            <p className="mt-1 flex items-center gap-1 text-xs text-emerald-400">
              <TrendingUp className="h-3 w-3" />
              {trend}
            </p>
          )}
        </div>
        <div className={`rounded-lg bg-zinc-900/60 p-2.5 ${colors[color].split(' ').pop()}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-3 shadow-xl">
      <p className="mb-2 text-xs font-medium text-zinc-400">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-sm text-white">
          <span style={{ color: p.color }}>●</span> {p.name}: <span className="font-semibold">₹{p.value?.toLocaleString('en-IN')}</span>
        </p>
      ))}
    </div>
  );
};

export default function DashboardPage() {
  const [overview, setOverview] = useState(null);

  useEffect(() => {
    api.get('/admin/analytics/overview')
      .then(res => setOverview(res.data.overview))
      .catch(err => console.error('[Dashboard] overview error:', err));
  }, []);

  const jobs    = overview?.jobs    || {};
  const workers = overview?.workers || {};
  const revenue = overview?.revenue || {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Command Center</h1>
        <p className="text-sm text-zinc-400">Real-time operations overview</p>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KPICard
          title="Total GMV (Month)"
          value={`₹${Number(revenue.revenue_month || 0).toLocaleString('en-IN')}`}
          icon={DollarSign}
          trend="+12.5% vs last month"
          color="purple"
        />
        <KPICard
          title="Active Workers (Online)"
          value={workers.online || '0'}
          icon={Users}
          color="emerald"
        />
        <KPICard
          title="Jobs Completed Today"
          value={jobs.jobs_completed_today || '0'}
          icon={Briefcase}
          trend={`${jobs.jobs_searching || 0} searching`}
          color="blue"
        />
        <KPICard
          title="KYC Pending"
          value={workers.kyc_pending || '0'}
          icon={AlertTriangle}
          color="amber"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Revenue Chart — 2/3 */}
        <Card className="col-span-1 border-zinc-800 bg-zinc-900/50 xl:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-purple-400" />
              <CardTitle className="text-sm font-semibold text-white">Revenue vs Payouts (30d)</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="h-[320px] pl-0 pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={MOCK_CHART_DATA} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id="gRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#a78bfa" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gPayouts" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#34d399" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="revenue" stroke="#a78bfa" fill="url(#gRevenue)" strokeWidth={2} name="Revenue" />
                <Area type="monotone" dataKey="payouts" stroke="#34d399" fill="url(#gPayouts)" strokeWidth={2} name="Payouts" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Live Ops Feed — 1/3 */}
        <Card className="border-zinc-800 bg-zinc-900/50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-purple-400" />
                <CardTitle className="text-sm font-semibold text-white">Live Ops Feed</CardTitle>
              </div>
              <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live
              </span>
            </div>
          </CardHeader>
          <CardContent className="max-h-[320px] space-y-2 overflow-y-auto pr-2">
            {MOCK_FEED.map((item) => (
              <div
                key={item.id}
                className={`flex items-start gap-3 rounded-lg border p-3 transition-colors ${FEED_COLORS[item.type]}`}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs leading-relaxed">{item.text}</p>
                </div>
                <span className="shrink-0 text-[10px] text-zinc-500">{item.time}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
