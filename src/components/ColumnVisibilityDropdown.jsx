import React, { useState, useRef, useEffect } from 'react';
import { SlidersHorizontal } from 'lucide-react';

export default function ColumnVisibilityDropdown({ columns, visibleCols, toggleColumn }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 outline-none transition-colors hover:bg-slate-50 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 h-[42px]"
      >
        <SlidersHorizontal className="h-4 w-4 text-slate-500" />
        <span className={isOpen ? 'text-blue-600' : ''}>Columns</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-1 w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
          <div className="mb-2 px-3 pt-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Visible Columns
          </div>
          <div className="max-h-60 overflow-y-auto">
            {columns.map((col) => (
              <label
                key={col}
                className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-slate-50"
              >
                <input
                  type="checkbox"
                  checked={visibleCols.includes(col)}
                  onChange={() => toggleColumn(col)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-slate-700">{col}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
