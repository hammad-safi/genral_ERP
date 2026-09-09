import React, { useState, useRef, useEffect } from 'react';

export default function CustomSelect({ value, onChange, options, placeholder = "Select option...", className = "" }) {
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

  // Handle both string arrays and object arrays {label, value}
  const normalizedOptions = options.map(opt => 
    typeof opt === 'string' ? { label: opt, value: opt } : opt
  );
  
  const selectedOption = normalizedOptions.find(opt => String(opt.value) === String(value));

  return (
    <div className={`relative ${className || 'w-full'}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between rounded-2xl border px-4 py-3 text-sm font-medium outline-none transition-all ${
          isOpen ? 'border-blue-500 ring-1 ring-blue-500 bg-white' : 'border-slate-200 bg-slate-50 hover:border-slate-300'
        }`}
      >
        <span className={selectedOption ? 'text-slate-900' : 'text-slate-500'}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <svg className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full rounded-xl bg-white shadow-xl border border-slate-100 overflow-hidden flex flex-col">
          {placeholder && (
            <div className="py-2.5 px-4 text-sm text-slate-500 border-b border-slate-100 bg-slate-50/50">
               {placeholder}
            </div>
          )}
          <div className="max-h-60 overflow-y-auto py-1 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
            {normalizedOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                  String(value) === String(option.value)
                    ? 'bg-blue-50 text-blue-700 font-medium' 
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
