import React, { useState, useRef, useEffect } from 'react';

export default function RowsDropdown({ limit, setLimit }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();
  
  useEffect(() => {
    const handleOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className={`flex w-14 items-center justify-between gap-1 rounded border bg-white py-1 pl-2 pr-1 text-xs font-medium outline-none transition-colors ${open ? 'border-blue-500 ring-1 ring-blue-500 text-slate-900' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}
      >
        <span>{limit}</span>
        <svg className="h-3 w-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 w-full overflow-hidden rounded border border-slate-200 bg-white shadow-lg z-50">
          {[10, 20, 50, 100].map(val => (
            <button
              key={val}
              onClick={() => { setLimit(val); setOpen(false); }}
              className={`block w-full text-left px-2 py-1.5 text-xs transition-colors ${val === limit ? 'bg-blue-600 text-white font-medium' : 'text-slate-700 hover:bg-slate-50'}`}
            >
              {val}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
