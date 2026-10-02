import React, { useState, useRef, useEffect } from 'react';
import { Columns } from 'lucide-react';

export default function ColumnsDropdown({ columns, visibleColumns, setVisibleColumns }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleColumn = (key) => {
    if (visibleColumns.find(c => c.key === key)) {
      if (visibleColumns.length > 1) {
        setVisibleColumns(visibleColumns.filter(c => c.key !== key));
      }
    } else {
      const col = columns.find(c => c.key === key);
      const newVisible = [...visibleColumns, col];
      const ordered = columns.filter(c => newVisible.find(v => v.key === c.key));
      setVisibleColumns(ordered);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors h-10"
      >
        <Columns size={16} />
        Columns
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-100 z-50 p-2">
          <div className="text-xs font-bold text-slate-400 mb-2 px-2 uppercase tracking-wider">Visible Columns</div>
          <div className="space-y-1">
            {columns.map(col => {
              if (!col.header) return null;
              const isVisible = !!visibleColumns.find(c => c.key === col.key);
              return (
                <label key={col.key} className="flex items-center gap-3 px-2 py-1.5 hover:bg-slate-50 rounded-lg cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isVisible}
                    onChange={() => toggleColumn(col.key)}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                  />
                  <span className="text-sm font-medium text-slate-700">{col.header}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
