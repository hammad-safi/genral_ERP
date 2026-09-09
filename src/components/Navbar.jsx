import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useSettings } from '@/hooks/useSettings';
import { useBusiness, businessConfig } from '@/contexts/BusinessContext';
import generalStoreLogo from '/Business Management System.jpeg?url';
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
  ChevronLeft,
  ChevronRight,
  FileText,
  Tags,
} from 'lucide-react';
const DEFAULT_LOGO = honeyLogo;

// Get business-specific logo
// Get business logo (can be customized)
function getBusinessLogo() {
  return honeyLogo; // Using honeyLogo as a placeholder, user can change in settings
}

// Get navigation links
function getLinks() {
  return [
    { path: '/', label: 'Dashboard', icon: Home },
    { path: '/pos', label: 'POS', icon: ShoppingCart },
    { path: '/products', label: 'Products', icon: Box },
    { path: '/categories', label: 'Categories', icon: Tags },
    { path: '/inventory', label: 'Inventory', icon: Layers },
    { path: '/sales', label: 'Sales', icon: FileText },
    { path: '/purchases', label: 'Purchases', icon: Truck },
    { path: '/suppliers', label: 'Suppliers', icon: Users },
    { path: '/customers', label: 'Customers', icon: User },
    { path: '/expenses', label: 'Expenses', icon: Wallet },
    { path: '/monthly-records', label: 'Monthly Records', icon: Calendar },
    { path: '/reports', label: 'Reports', icon: BarChart4 },
    { path: '/settings', label: 'Settings', icon: Settings },
  ];
}

export default function Navbar() {
  const location = useLocation();
  const settings = useSettings();
  const { businessColor } = useBusiness();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const shopName = settings?.shopName ?? 'Business Management System';
  const currentConfig = businessConfig.business;

  useEffect(() => {
    document.title = shopName;
    if (window.electronAPI && window.electronAPI.updateWindowTitle) {
      window.electronAPI.updateWindowTitle(shopName);
    }
    
    // Auto-migrate old names in the user's local database
    if (shopName === 'General Store' || shopName === 'Pharmacy Store') {
      import('@/lib/db').then(({ getDB }) => {
        getDB().settings.put({ key: 'shopName', value: 'Business Management System' });
      });
    }
  }, [shopName]);

  return (
    <>
      <button
        type="button"
        onClick={() => setDrawerOpen(true)}
        className="fixed left-4 top-4 z-50 flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold shadow-lg lg:hidden"
      >
        <span className="text-lg">☰</span>
      </button>

      <nav className={`hidden flex-none flex-col border-r border-slate-200 bg-white py-6 text-slate-900 lg:flex relative transition-all duration-300 ${isCollapsed ? 'w-20 px-2' : 'w-72 px-4'}`}>

        {/* Logo, Shop Name, and Collapse Toggle */}
        <div className={`mb-6 flex ${isCollapsed ? 'flex-col items-center gap-4' : 'items-center justify-between px-2'} transition-all`}>
          <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} overflow-hidden transition-all`}>
            {settings?.logo ? (
              <img src={settings.logo} alt="Logo" className={`${isCollapsed ? 'h-10 w-10' : 'h-10 w-10'} rounded-2xl object-cover shadow-sm transition-all shrink-0`} />
            ) : (
              <div className={`${isCollapsed ? 'h-10 w-10 text-xl' : 'h-10 w-10 text-xl'} rounded-2xl bg-blue-100 flex items-center justify-center shadow-sm transition-all shrink-0`}>
                🏪
              </div>
            )}
            {!isCollapsed && (
              <div className="overflow-hidden whitespace-nowrap">
                <h1 className="text-base font-semibold text-slate-900 truncate pr-2">{shopName}</h1>
              </div>
            )}
          </div>
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors shrink-0"
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        {/* Navigation Links */}
        <div className="space-y-1 flex-1 overflow-y-auto overflow-x-hidden no-scrollbar">
          {getLinks().map((item) => {
            const Icon = item.icon;
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`group relative flex items-center ${isCollapsed ? 'justify-center px-0 mx-2' : 'gap-3 px-4 mx-2'} rounded-xl py-2.5 text-sm font-medium transition-all duration-150 ${
                  active
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                {active && !isCollapsed && <div className="absolute left-0 top-2 bottom-2 w-1 bg-blue-600 rounded-r-full"></div>}
                {active && isCollapsed && <div className="absolute left-0 top-2 bottom-2 w-1 bg-blue-600 rounded-full"></div>}
                
                <Icon className={`h-5 w-5 flex-shrink-0 transition-colors ${active ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600'}`} />
                {!isCollapsed && <span className="truncate">{item.label}</span>}
                
                {/* Custom tooltip for collapsed mode */}
                {isCollapsed && (
                  <div className="absolute left-14 rounded-md bg-slate-800 px-2 py-1 text-xs font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-lg">
                    {item.label}
                  </div>
                )}
              </Link>
            );
          })}
        </div>

        {/* Business Info at Bottom */}
        <div className={`pt-4 mt-auto border-t border-slate-100 flex transition-all ${isCollapsed ? 'justify-center' : 'flex-col px-4'}`}>
          {!isCollapsed ? (
            <div className="space-y-1 text-xs text-slate-500">
              {settings?.phone && (
                <div className="flex items-center gap-2 truncate">
                  <span className="font-medium text-slate-700">{settings.phone}</span>
                </div>
              )}
              {settings?.address && (
                <div className="truncate opacity-80" title={settings.address}>
                  {settings.address}
                </div>
              )}
              {!settings?.phone && !settings?.address && (
                <div className="opacity-80">Store Info</div>
              )}
            </div>
          ) : (
            <div className="h-8 w-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 shadow-sm border border-slate-100" title={settings?.phone || shopName}>
              <Home className="h-3.5 w-3.5" />
            </div>
          )}
        </div>
      </nav>

      {/* Mobile Drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/20" onClick={() => setDrawerOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-72 overflow-y-auto bg-white shadow-2xl transition-transform duration-300">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4">
              <div className="flex items-center gap-3">
                {settings?.logo ? (
                  <img 
                    src={settings.logo} 
                    alt="Shop Logo" 
                    className="h-12 w-12 rounded-xl object-cover shadow-sm"
                  />
                ) : (
                  <div className="h-12 w-12 rounded-xl bg-slate-100 flex items-center justify-center text-2xl shadow-sm">
                    🏪
                  </div>
                )}
                <div>
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
              <p className="text-xs text-slate-600 mb-1">Business Management System</p>
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
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className={`h-5 w-5 ${active ? 'text-blue-600' : ''}`} />
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