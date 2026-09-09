import React from 'react';
import VirtualTable from './VirtualTable';

export default function GlobalTable({
  data = [],
  columns = [],
  renderRow,
  hasMore = false,
  loadMoreRef,
  emptyState,
  className = '',
}) {
  return (
    <div className={`w-full ${className}`}>
      <VirtualTable
        data={data}
        columns={columns}
        renderRow={renderRow}
        hasMore={hasMore}
        loadMoreRef={loadMoreRef}
        containerClassName="w-full overflow-x-auto overflow-y-auto max-h-[58vh] bg-white relative"
        emptyState={
          emptyState || (
            <div className="p-8 text-center text-sm text-slate-500">
              No data available
            </div>
          )
        }
      />
    </div>
  );
}
