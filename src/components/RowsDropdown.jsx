import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

export default function RowsDropdown({ limit, setLimit, value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();
  const currentLimit = value !== undefined ? value : limit;
  const updateLimit = onChange || setLimit;
  
  useEffect(() => {
    const handleOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  return (
    <div className="relative inline-flex items-center gap-1.5" ref={ref}>
      <span className="text-xs text-slate-500 font-medium">Show</span>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`flex min-w-[3.5rem] items-center justify-between gap-1.5 rounded-lg border bg-white py-1 px-2.5 text-xs font-semibold outline-none transition-all shadow-xs ${
          open 
            ? 'border-blue-600 ring-2 ring-blue-500/20 text-blue-600' 
            : 'border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
        }`}
      >
        <span>{currentLimit}</span>
        <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform ${open ? 'rotate-180 text-blue-600' : ''}`} />
      </button>
      <span className="text-xs text-slate-500 font-medium">per page</span>

      {open && (
        <div className="absolute bottom-full left-8 mb-1 w-16 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl z-50 py-1">
          {[10, 20, 50, 100].map(val => (
            <button
              key={val}
              type="button"
              onClick={() => { updateLimit && updateLimit(val); setOpen(false); }}
              className={`block w-full text-center py-1.5 text-xs font-semibold transition-colors ${
                val === currentLimit 
                  ? 'bg-blue-600 text-white' 
                  : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              {val}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
