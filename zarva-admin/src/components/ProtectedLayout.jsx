import { useState } from 'react';
import { Navigate, Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, Wrench, Map, Briefcase,
  AlertTriangle, Settings, ChevronLeft, ChevronRight,
  Search, LogOut, Shield, Bell, Menu, Wallet
} from 'lucide-react';

const NAV_ITEMS = [
  { to: '/',         icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/customers', icon: Users,          label: 'Customers' },
  { to: '/workers',  icon: Wrench,          label: 'Workers' },
  { to: '/map',      icon: Map,             label: 'Live Map' },
  { to: '/jobs',     icon: Briefcase,       label: 'Jobs' },
  { to: '/disputes', icon: AlertTriangle,   label: 'Disputes' },
  { to: '/finance',  icon: Wallet,           label: 'Finance' },
  { to: '/settings', icon: Settings,        label: 'Settings' },
];

function SidebarLink({ to, icon: Icon, label, collapsed }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        `group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200
        ${isActive
          ? 'bg-purple-500/10 text-purple-400 shadow-[inset_2px_0_0_#a78bfa]'
          : 'text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-100'
        }
        ${collapsed ? 'justify-center' : ''}`
      }
      title={collapsed ? label : undefined}
    >
      <Icon className="h-[18px] w-[18px] shrink-0" />
      {!collapsed && <span className="truncate">{label}</span>}
    </NavLink>
  );
}

export default function ProtectedLayout() {
  const token = localStorage.getItem('admin_token');
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();

  if (!token) return <Navigate to="/login" replace />;

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    navigate('/login');
  };

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-950">
      {/* ── Sidebar ───────────────────────────────── */}
      <aside
        className={`flex flex-col border-r border-zinc-800/60 bg-zinc-950 transition-all duration-300 ${
          collapsed ? 'w-16' : 'w-60'
        }`}
      >
        {/* Brand */}
        <div className={`flex h-14 items-center border-b border-zinc-800/60 px-4 ${collapsed ? 'justify-center' : 'gap-3'}`}>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/15">
            <Shield className="h-4 w-4 text-purple-400" />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-sm font-bold tracking-tight text-white">ZARVA</span>
              <span className="text-[10px] font-medium uppercase tracking-widest text-purple-400/70">Command Center</span>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-4">
          {NAV_ITEMS.map((item) => (
            <SidebarLink key={item.to} {...item} collapsed={collapsed} />
          ))}
        </nav>

        {/* Footer */}
        <div className="border-t border-zinc-800/60 p-2">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs text-zinc-500 transition-colors hover:bg-zinc-800/60 hover:text-zinc-300"
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <><ChevronLeft className="h-4 w-4" /><span>Collapse</span></>}
          </button>
        </div>
      </aside>

      {/* ── Main content ─────────────────────────── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-14 items-center justify-between border-b border-zinc-800/60 bg-zinc-950 px-6">
          <div className="flex items-center gap-4">
            <button className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white lg:hidden">
              <Menu className="h-5 w-5" />
            </button>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                placeholder="Search anything..."
                className="h-9 w-64 rounded-lg border border-zinc-800 bg-zinc-900 pl-9 pr-4 text-sm text-zinc-200 placeholder-zinc-500 outline-none transition-all focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Env badge */}
            <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live Ops
            </span>

            {/* Notifications */}
            <button className="relative rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white">
              <Bell className="h-4 w-4" />
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" />
            </button>

            {/* Profile */}
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-300 transition-all hover:border-zinc-700 hover:bg-zinc-800"
            >
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-purple-500/20 text-xs font-bold text-purple-400">A</div>
              <span className="hidden sm:inline">Admin</span>
              <LogOut className="h-3.5 w-3.5 text-zinc-500" />
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto bg-zinc-950 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
