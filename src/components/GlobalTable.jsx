import React from 'react';

export default function GlobalTable({
  data = [],
  columns = [],
  renderRow,
  hasMore = false,
  onLoadMore,
  loading = false,
  emptyState, 
  className = '',
  rowKey = 'id',
  onEdit,
  editIcon,
  maxHeight
}) {
  const defaultRenderRow = (item, index) => (
    <tr 
      key={item[rowKey] || index} 
      className="group hover:bg-slate-50/80 transition-colors border-b border-slate-100 last:border-0 even:bg-slate-50/30" 
      data-index={index}
    >
      {columns.map((col, i) => (
        <td 
          key={col.key || i} 
          className={`px-4 py-3.5 sm:py-4 whitespace-nowrap text-sm font-medium text-slate-700 ${col.className || ''}`} 
          style={{ width: col.width || 'auto' }}
        >
          {col.render ? col.render(item[col.key], item) : item[col.key]}
        </td>
      ))}
      {(onEdit || editIcon) && (
        <td className="px-4 py-3.5 sm:py-4 whitespace-nowrap text-right text-sm font-medium">
          <button
            onClick={() => onEdit(item)}
            className="text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 p-1.5 rounded-lg transition-colors shadow-2xs"
          >
            {editIcon || 'Edit'}
          </button>
        </td>
      )}
    </tr>
  );

  const scrollContainerClass = maxHeight 
    ? `overflow-y-auto ${maxHeight}` 
    : onLoadMore 
    ? 'overflow-y-auto max-h-[60vh]' 
    : '';

  return (
    <div 
      className={`w-full overflow-x-auto rounded-2xl border border-slate-200/80 bg-white shadow-2xs relative ${scrollContainerClass} ${className}`}
      onScroll={(e) => {
        if (!onLoadMore) return;
        const remainingScroll = e.target.scrollHeight - e.target.scrollTop - e.target.clientHeight; 
        const threshold = Math.max(e.target.scrollHeight / 2, 600); 
        const bottom = remainingScroll < threshold;
        if (bottom && hasMore && !loading) {
          onLoadMore();
        }
      }}
    >
      <table className="min-w-full divide-y divide-slate-100">
        <thead className="bg-slate-50/80 sticky top-0 z-10 border-b border-slate-200/80 backdrop-blur-xs">
          <tr>
            {columns.map((col, i) => (
              <th
                key={col.key || i}
                scope="col"
                className={`px-4 py-3.5 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider ${col.className || ''}`}
                style={{ width: col.width || 'auto' }}
              >
                {col.header || col.label}
              </th>
            ))}
            {(onEdit || editIcon) && (
              <th scope="col" className="px-4 py-3.5 text-right text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Actions
              </th>
            )}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-slate-100">
          {data.length > 0 ? (
            data.map((item, index) => renderRow ? renderRow(item, index) : defaultRenderRow(item, index))
          ) : (
            !loading && (
              <tr>
                <td colSpan={columns.length + (onEdit || editIcon ? 1 : 0)} className="px-4 py-16 text-center">
                  {emptyState || (
                    <div className="flex flex-col items-center justify-center text-slate-400">
                      <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mb-2">
                        📄
                      </div>
                      <p className="text-sm font-semibold text-slate-800">No records found</p>
                      <p className="text-xs text-slate-400 mt-0.5">Adjust your search or add new records.</p>
                    </div>
                  )}
                </td>
              </tr>
            )
          )}
          {loading && (
            <tr>
              <td colSpan={columns.length + (onEdit || editIcon ? 1 : 0)} className="px-4 py-8 text-center">
                <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
