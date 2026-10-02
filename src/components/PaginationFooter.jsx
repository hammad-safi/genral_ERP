import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import RowsDropdown from './RowsDropdown';

export default function PaginationFooter({ 
  pageIndex, 
  setPageIndex, 
  totalPages, 
  limit, 
  setLimit, 
  totalCount,
  visibleDataLength,
  mode = 'paged'
}) {
  const currentPage = pageIndex + 1;
  const startItem = totalCount === 0 ? 0 : mode === 'infinite' ? 1 : (currentPage - 1) * limit + 1;
  const endItem = mode === 'infinite' ? visibleDataLength : Math.min(currentPage * limit, totalCount);

  const getPageNumbers = () => {
    const pages = [];
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 3) {
        pages.push(1, 2, 3, '...', totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1, '...', totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, '...', currentPage, '...', totalPages);
      }
    }
    return pages;
  };

  return (
    <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-200/80 bg-transparent">
      {/* Left: Show X per page + Entry count */}
      <div className="flex items-center gap-3">
        <RowsDropdown limit={limit} setLimit={setLimit} />
        {totalCount > 0 && (
          <span className="text-xs text-slate-400 font-normal hidden md:inline">
            (Showing {startItem} - {endItem} of {totalCount})
          </span>
        )}
      </div>
      
      {/* Right: Modern Page Buttons */}
      {totalPages > 1 && (
        <div className="flex items-center gap-1.5">
          {/* Previous Page Button */}
          <button
            type="button"
            disabled={currentPage === 1}
            onClick={() => setPageIndex(Math.max(0, pageIndex - 1))}
            className={`flex h-8 w-8 items-center justify-center rounded-lg border text-xs font-semibold transition-all ${
              currentPage === 1 
                ? 'border-slate-100 bg-slate-50/50 text-slate-300 cursor-not-allowed' 
                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 shadow-xs'
            }`}
            title="Previous page"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          
          {/* Numeric Page Buttons */}
          {getPageNumbers().map((pageNum, idx) => (
            pageNum === '...' ? (
              <span key={`dots-${idx}`} className="px-1 text-xs text-slate-400 font-bold select-none">
                ...
              </span>
            ) : (
              <button
                key={pageNum}
                type="button"
                onClick={() => setPageIndex(pageNum - 1)}
                className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold transition-all shadow-xs ${
                  pageNum === currentPage 
                    ? 'bg-blue-600 text-white shadow-blue-500/20' 
                    : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                {pageNum}
              </button>
            )
          ))}

          {/* Next Page Button */}
          <button
            type="button"
            disabled={currentPage === totalPages}
            onClick={() => setPageIndex(Math.min(totalPages - 1, pageIndex + 1))}
            className={`flex h-8 w-8 items-center justify-center rounded-lg border text-xs font-semibold transition-all ${
              currentPage === totalPages 
                ? 'border-slate-100 bg-slate-50/50 text-slate-300 cursor-not-allowed' 
                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 shadow-xs'
            }`}
            title="Next page"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
