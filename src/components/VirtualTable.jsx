import React, { useRef, useEffect, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

export default function VirtualTable({
  data,
  columns,
  renderRow,
  hasMore,
  loadMoreRef,
  emptyState,
}) {
  const parentRef = useRef(null);
  
  // Need to force a re-render after mounting so virtualizer gets the correct container rect
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const rowVirtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 64, // Approximate row height in px
    overscan: 5,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();
  
  const paddingTop = virtualItems.length > 0 ? virtualItems[0].start : 0;
  const paddingBottom =
    virtualItems.length > 0
      ? rowVirtualizer.getTotalSize() - virtualItems[virtualItems.length - 1].end
      : 0;

  return (
    <div ref={parentRef} className="w-full overflow-x-auto overflow-y-auto max-h-[58vh] rounded-3xl border border-slate-200 bg-white shadow-panel relative">
      <table className="w-full text-left">
        <thead className="sticky top-0 bg-slate-50 z-10 border-b border-slate-200">
          <tr className="text-xs font-semibold uppercase tracking-wider text-slate-600">
            {columns.map((col, idx) => (
              <th key={idx} className={`px-4 py-3 ${col.className || ''}`}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {paddingTop > 0 && (
            <tr>
              <td style={{ height: `${paddingTop}px` }} colSpan={columns.length} />
            </tr>
          )}

          {virtualItems.map((virtualRow) => {
            const item = data[virtualRow.index];
            return renderRow(item, virtualRow.index, rowVirtualizer.measureElement);
          })}

          {paddingBottom > 0 && (
            <tr>
              <td style={{ height: `${paddingBottom}px` }} colSpan={columns.length} />
            </tr>
          )}

          {hasMore && (
            <tr ref={loadMoreRef}>
              <td colSpan={columns.length} className="p-4 text-center text-sm text-slate-500">
                Loading more...
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {data.length === 0 && emptyState}
    </div>
  );
}
