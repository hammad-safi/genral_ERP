import { useState, useEffect, useRef } from 'react';
import { Search, Bell, Sun, Moon, Calendar, Clock } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

export default function TopGlobalBar() {
  const [timeStr, setTimeStr] = useState('');
  const [dateStr, setDateStr] = useState('');
  const [searchValue, setSearchValue] = useState('');
  const searchInputRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const updateDateTime = () => {
      const now = new Date();
      // Formats e.g. "Mon, 29 Sep 2025"
      const dateFormatted = now.toLocaleDateString('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
      // Formats e.g. "10:24 AM"
      const timeFormatted = now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
      setDateStr(dateFormatted);
      setTimeStr(timeFormatted);
    };

    updateDateTime();
    const interval = setInterval(updateDateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Global hotkey Ctrl+K to focus search
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSearchSubmit = (e) => {
    if (e.key === 'Enter' && searchValue.trim()) {
      if (location.pathname === '/pos') {
        // Dispatched or handled inside POS if custom event
        window.dispatchEvent(new CustomEvent('pos-search', { detail: searchValue.trim() }));
      } else {
        navigate(`/products?search=${encodeURIComponent(searchValue.trim())}`);
      }
    }
  };

  return (
    <header className="h-16 px-4 sm:px-6 lg:px-8 border-b border-slate-200/80 bg-white/80 backdrop-blur-md flex items-center justify-between gap-4 sticky top-0 z-20 shrink-0">
      {/* Quick Search with Ctrl + K */}
      <div className="flex-1 max-w-xl">
        <div className="relative flex items-center">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            onKeyDown={handleSearchSubmit}
            placeholder="Search products, categories, barcode..."
            className="w-full bg-slate-50/80 hover:bg-slate-50 focus:bg-white text-slate-800 placeholder-slate-400 text-sm pl-10 pr-16 py-2 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all shadow-inner/5"
          />
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none flex items-center gap-0.5">
            <kbd className="px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 bg-white border border-slate-200 rounded shadow-xs">
              Ctrl
            </kbd>
            <kbd className="px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 bg-white border border-slate-200 rounded shadow-xs">
              K
            </kbd>
          </div>
        </div>
      </div>

      {/* Right Controls: Notifications, Theme, Live Clock */}
      <div className="flex items-center gap-2.5 sm:gap-3">
        {/* Notification Bell */}
        <button
          type="button"
          className="relative w-9 h-9 rounded-xl bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 flex items-center justify-center text-slate-600 transition-all shadow-xs"
          title="Notifications"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white font-bold text-[10px] rounded-full flex items-center justify-center shadow-xs">
            3
          </span>
        </button>

        {/* Light / Dark Mode Toggle Pill */}
        <div className="hidden sm:flex items-center bg-white border border-slate-200 rounded-xl p-1 shadow-xs">
          <button
            type="button"
            className="p-1 rounded-lg bg-amber-50 text-amber-500 hover:text-amber-600 transition-colors"
            title="Light Mode"
          >
            <Sun className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
            title="Dark Mode"
          >
            <Moon className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Live Date & Time Widget */}
        <div className="hidden md:flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-1.5 shadow-xs">
          <Calendar className="w-4 h-4 text-blue-600" />
          <div className="flex flex-col text-right">
            <span className="text-[10px] font-medium text-slate-400 leading-tight">
              {dateStr || 'Today'}
            </span>
            <span className="text-xs font-bold text-slate-800 leading-tight">
              {timeStr || '12:00 PM'}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
