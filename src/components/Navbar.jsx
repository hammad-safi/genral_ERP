import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useSettings } from '@/hooks/useSettings';
import { useBusiness, businessConfig } from '@/contexts/BusinessContext';
import generalStoreLogo from '/General store.jpeg?url';
import honeyLogo from '/Honey.jpeg?url';
import cosmeticsLogo from '/Cosmetics.jpeg?url';
import {
  Home,
  Box,
  Layers,
  ShoppingCart,
  Truck,
  Users,
  Wallet,
  BarChart4,
  Settings,
  X,
  GraduationCap,
  User,
  ChevronDown,
  Check,
  Calendar,
} from 'lucide-react';
const DEFAULT_LOGO = honeyLogo;

// Get business-specific logo
// Get pharmacy logo (can be customized)
function getBusinessLogo() {
  return honeyLogo; // Using honeyLogo as a placeholder, user can change in settings
}

// Get navigation links
function getLinks() {
  return [
    { path: '/', label: 'Dashboard', icon: Home },
    { path: '/products', label: 'Products', icon: Box },
    { path: '/inventory', label: 'Inventory', icon: Layers },
    { path: '/sales', label: 'Sales', icon: ShoppingCart },
    { path: '/purchases', label: 'Purchases', icon: Truck },
    { path: '/suppliers', label: 'Suppliers', icon: Users },
    { path: '/customers', label: 'Customers', icon: User },
    { path: '/expenses', label: 'Expenses', icon: Wallet },
    { path: '/reports', label: 'Reports', icon: BarChart4 },
    { path: '/monthly-records', label: 'Monthly Records', icon: Calendar },
    { path: '/settings', label: 'Settings', icon: Settings },
  ];
}

export default function Navbar() {
  const location = useLocation();
  const settings = useSettings();
  const { businessColor } = useBusiness();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const shopName = settings?.shopName ?? 'Pharmacy Store';
  const currentConfig = businessConfig.pharmacy;

  return (
    <>
      <button
        type="button"
        onClick={() => setDrawerOpen(true)}
        className="fixed left-4 top-4 z-50 flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold shadow-lg lg:hidden"
      >
        <span className="text-lg">☰</span>
      </button>

      <nav className="hidden w-72 flex-none flex-col border-r border-slate-200 bg-white px-4 py-6 text-slate-900 lg:flex sticky top-0 max-h-screen overflow-y-auto">


        {/* Logo and Shop Name */}
        <div className="mb-6 flex items-center gap-3 px-2">
          <div className="h-16 w-16 rounded-2xl bg-emerald-100 flex items-center justify-center text-3xl shadow-sm">
            💊
          </div>
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-slate-600">Pharmacy ERP</p>
            <h1 className="text-xl font-semibold text-slate-900">{shopName}</h1>
          </div>
        </div>

        {/* Navigation Links */}
        <div className="space-y-1 flex-1">
          {getLinks().map((item) => {
            const Icon = item.icon;
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-all duration-150 ${
                  active
                    ? `${currentConfig.lightBgColor} ${currentConfig.lightTextColor}`
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Icon className={`h-5 w-5 ${active ? currentConfig.textColor : ''}`} />
                {item.label}
              </Link>
            );
          })}
        </div>

        {/* Footer Info */}
        <div className={`mt-auto rounded-2xl border-2 ${currentConfig.borderColor} ${currentConfig.lightBgColor} p-4 text-sm ${currentConfig.lightTextColor}`}>
          <p className="font-medium">{currentConfig.name}</p>
          <p className="text-slate-500 text-xs mt-1">Fully offline ERP system</p>
        </div>
      </nav>

      {/* Mobile Drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/20" onClick={() => setDrawerOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-72 overflow-y-auto bg-white shadow-2xl transition-transform duration-300">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4">
              <div className="flex items-center gap-3">
                <img 
                  src={settings?.logo || DEFAULT_LOGO} 
                  alt="Shop Logo" 
                  className="h-12 w-12 rounded-xl object-cover shadow-sm"
                />
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-600">Offline Shop</p>
                  <h1 className="text-base font-semibold text-slate-900">{shopName}</h1>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="rounded-xl border border-slate-200 bg-slate-50 p-2 text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Mobile Business Switcher */}
            <div className="px-4 py-3 border-b border-slate-200">
              <p className="text-xs text-slate-600 mb-1">Pharmacy ERP</p>
              <p className="text-sm font-semibold text-slate-900">{currentConfig.name}</p>
            </div>

            {/* Mobile Navigation Links */}
            <div className="space-y-1 px-4 py-4">
              {getLinks().map((item) => {
                const Icon = item.icon;
                const active = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setDrawerOpen(false)}
                    className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all ${
                      active
                        ? `${currentConfig.lightBgColor} ${currentConfig.lightTextColor}`
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className={`h-5 w-5 ${active ? currentConfig.textColor : ''}`} />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}