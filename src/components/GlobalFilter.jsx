import React from 'react';

/**
 * GlobalFilter
 * @param {Array} options - Array of string or objects { label, value }
 * @param {string} value - Currently selected value
 * @param {function} onChange - Callback for when value changes
 * @param {string} variant - 'chips' or 'select'
 * @param {string} placeholder - Placeholder for select dropdown
 */
export default function GlobalFilter({
  options = [],
  value,
  onChange,
  variant = 'chips',
  placeholder = 'Select option...',
  className = '',
  icon: Icon,
}) {
  const normalizedOptions = options.map((opt) =>
    typeof opt === 'string' ? { label: opt, value: opt } : opt
  );

  const [isOpen, setIsOpen] = React.useState(false);
  const dropdownRef = React.useRef(null);

  React.useEffect(() => {
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

  if (variant === 'select') {
    const selectedOption = normalizedOptions.find((opt) => opt.value === value);

    return (
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs sm:text-sm font-medium text-slate-700 outline-none transition-colors hover:bg-slate-50 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 h-[42px] shadow-2xs ${className}`}
        >
          <div className="flex items-center gap-2 truncate">
            {Icon && <Icon className="h-4 w-4 text-slate-500 shrink-0" />}
            <span className="truncate">{selectedOption ? selectedOption.label : placeholder}</span>
          </div>
          <svg className={`h-3.5 w-3.5 text-slate-400 transition-transform shrink-0 ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isOpen && (
          <div className="absolute right-0 top-full z-50 mt-1 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
            {placeholder && (
              <div className="px-4 py-3 text-sm text-slate-500 border-b border-slate-100">
                {placeholder}
              </div>
            )}
            <div className="max-h-60 overflow-y-auto py-1">
              {normalizedOptions.map((opt) => {
                const isSelected = value === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      onChange(opt.value);
                      setIsOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                      isSelected
                        ? 'bg-blue-600 text-white font-medium'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (variant === 'text-chips') {
    return (
      <div className={`flex flex-wrap items-center gap-6 ${className}`}>
        {normalizedOptions.map((opt) => {
          const isSelected = value === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => onChange(opt.value)}
              className={`text-sm transition-colors ${
                isSelected
                  ? 'font-bold text-slate-900'
                  : 'font-medium text-slate-500 hover:text-slate-700'
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    );
  }

  // default variant: 'chips'
  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {normalizedOptions.map((opt) => {
        const isSelected = value === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
              isSelected
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
