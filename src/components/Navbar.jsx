import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/hooks/useSettings';
import { useBusiness, businessConfig } from '@/contexts/BusinessContext';
import {
  Home,
  LogOut,
  Shield,
  Box,
  Layers,
  ShoppingCart,
  Truck,
  Users,
  Wallet,
  BarChart4,
  Settings,
  X,
  User,
  Calendar,
  ChevronLeft,
  ChevronRight,
  FileText,
  Tags,
} from 'lucide-react';

// Get navigation links
function getLinks(hasPermission) {
  const links = [
    { path: '/', label: 'Dashboard', icon: Home, module: 'Dashboard' },
    { path: '/pos', label: 'POS', icon: ShoppingCart, module: 'POS' },
    { path: '/products', label: 'Products', icon: Box, module: 'Products' },
    { path: '/categories', label: 'Categories', icon: Tags, module: 'Categories' },
    { path: '/inventory', label: 'Inventory', icon: Layers, module: 'Inventory' },
    { path: '/sales', label: 'Sales', icon: FileText, module: 'Sales' },
    { path: '/purchases', label: 'Purchases', icon: Truck, module: 'Purchases' },
    { path: '/suppliers', label: 'Suppliers', icon: Users, module: 'Suppliers' },
    { path: '/customers', label: 'Customers', icon: User, module: 'Customers' },
    { path: '/expenses', label: 'Expenses', icon: Wallet, module: 'Expenses' },
    { path: '/monthly-records', label: 'Monthly Records', icon: Calendar, module: 'Monthly Records' },
    { path: '/reports', label: 'Reports', icon: BarChart4, module: 'Reports' },
    { path: '/users-roles', label: 'Users & Roles', icon: Shield, module: 'Users' },
    { path: '/settings', label: 'Settings', icon: Settings, module: 'Settings' },
  ];
  return links.filter(link => !hasPermission || hasPermission(link.module, 'View'));
}

export default function Navbar() {
  const location = useLocation();
  const settings = useSettings();
  const { user, logout, hasPermission } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const shopName = settings?.shopName ?? 'webzen';

  useEffect(() => {
    document.title = shopName;
    if (window.electronAPI && window.electronAPI.updateWindowTitle) {
      window.electronAPI.updateWindowTitle(shopName);
    }
  }, [shopName]);

  return (
    <>
      {/* Mobile Drawer Hamburger */}
      <button
        type="button"
        onClick={() => setDrawerOpen(true)}
        className="fixed left-4 top-4 z-50 flex items-center gap-2 rounded-2xl border border-slate-700 bg-[#0B1739] text-white px-3 py-2 text-sm font-semibold shadow-lg lg:hidden"
      >
        <span className="text-lg">☰</span>
      </button>

      {/* Main Desktop Sidebar */}
      <nav className={`hidden flex-none flex-col border-r border-[#162244] bg-[#0B1739] py-5 text-white lg:flex relative transition-all duration-300 z-30 ${isCollapsed ? 'w-20 px-2' : 'w-64 px-3'}`}>

        {/* Logo, Shop Name, and Collapse Toggle */}
        <div className={`mb-6 flex ${isCollapsed ? 'flex-col items-center gap-3' : 'items-center justify-between px-2'} transition-all`}>
          <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} overflow-hidden transition-all`}>
            {settings?.logo ? (
              <img src={settings.logo} alt="Logo" className={`${isCollapsed ? 'h-9 w-9' : 'h-9 w-9'} rounded-xl object-cover shadow-sm shrink-0`} />
            ) : (
              <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center font-black text-white text-sm shadow-md shrink-0 tracking-tighter">
                WZ
              </div>
            )}
            {!isCollapsed && (
              <div className="overflow-hidden whitespace-nowrap flex items-center gap-1.5">
                <span className="text-lg font-black tracking-tight text-white">{shopName}</span>
              </div>
            )}
          </div>
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1.5 rounded-lg text-slate-400 hover:bg-white/10 hover:text-white transition-colors shrink-0"
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        {/* Navigation Links */}
        <div className="flex-1 space-y-1 overflow-y-auto overflow-x-hidden py-1 px-1 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
          {getLinks(hasPermission).map((item) => {
            const Icon = item.icon;
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`group relative flex items-center ${isCollapsed ? 'justify-center px-0' : 'gap-3 px-3.5'} rounded-xl py-2.5 text-sm font-medium transition-all duration-150 ${
                  active
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                    : 'text-slate-300 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className={`h-5 w-5 flex-shrink-0 transition-colors ${active ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'}`} />
                {!isCollapsed && <span className="truncate">{item.label}</span>}
                
                {/* Custom tooltip for collapsed mode */}
                {isCollapsed && (
                  <div className="absolute left-16 rounded-md bg-slate-900 border border-slate-700 px-2.5 py-1 text-xs font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-xl">
                    {item.label}
                  </div>
                )}
              </Link>
            );
          })}
        </div>

        {/* Store Info Label */}
        {!isCollapsed && (
          <div className="px-3 pt-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Store Info</p>
          </div>
        )}

        {/* User Profile & Logout */}
        <div className="mt-2 pt-2">
          <div className={`flex items-center justify-between bg-[#132247] rounded-2xl border border-white/10 ${isCollapsed ? 'p-2 justify-center' : 'p-2.5'}`}>
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-xs uppercase shrink-0 shadow-inner">
                {user?.username?.[0] || 'A'}
              </div>
              {!isCollapsed && (
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white truncate leading-tight">{user?.username || 'admin'}</p>
                  <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 leading-tight mt-0.5">{user?.role || 'ADMIN'}</p>
                </div>
              )}
            </div>
            {!isCollapsed && (
              <button
                onClick={logout}
                className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-white/10 rounded-xl transition-colors shrink-0"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
          {isCollapsed && (
            <button
              onClick={logout}
              className="mt-2 w-full p-2 text-slate-400 hover:text-red-400 hover:bg-white/10 rounded-xl transition-colors flex justify-center"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </nav>

      {/* Mobile Drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setDrawerOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-72 overflow-y-auto bg-[#0B1739] text-white shadow-2xl transition-transform duration-300 flex flex-col p-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center font-black text-white text-sm shadow-md shrink-0">
                  WZ
                </div>
                <div>
                  <h1 className="text-base font-bold text-white">{shopName}</h1>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="rounded-xl border border-white/10 bg-white/5 p-2 text-slate-300 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Mobile Navigation Links */}
            <div className="space-y-1 py-4 flex-1 overflow-y-auto">
              {getLinks(hasPermission).map((item) => {
                const Icon = item.icon;
                const active = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setDrawerOpen(false)}
                    className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all ${
                      active
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'text-slate-300 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    {item.label}
                  </Link>
                );
              })}
            </div>

            {/* Mobile User Profile & Logout */}
            <div className="pt-4 border-t border-white/10">
              <div className="flex items-center justify-between bg-[#132247] p-3 rounded-2xl border border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold uppercase shrink-0">
                    {user?.username?.[0] || 'A'}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">{user?.username || 'admin'}</p>
                    <p className="text-xs font-medium text-slate-400">{user?.role || 'ADMIN'}</p>
                  </div>
                </div>
                <button
                  onClick={() => { setDrawerOpen(false); logout(); }}
                  className="p-2 text-slate-400 hover:text-red-400 hover:bg-white/10 rounded-xl"
                  title="Sign Out"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
