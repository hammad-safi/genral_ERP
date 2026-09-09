export default function BulkDeleteBar({
  selectedCount,
  onDelete,
  onCancel,
  itemLabel = 'item',
  isDeleting = false
}) {
  if (selectedCount === 0) return null

  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 animate-slide-up">
      <div className="bg-white border border-red-200 rounded-2xl shadow-2xl px-6 py-4 flex items-center gap-4">
        <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
          <span className="text-red-600 font-bold text-sm">{selectedCount}</span>
        </div>
        <span className="text-sm font-medium text-slate-900">
          {isDeleting ? `Deleting ${itemLabel}(s)...` : `${selectedCount} ${itemLabel}(s) selected`}
        </span>
        <button
          onClick={onDelete}
          disabled={isDeleting}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
            isDeleting 
              ? 'bg-slate-100 text-slate-500 cursor-not-allowed' 
              : 'bg-red-600 text-white hover:bg-red-700'
          }`}
        >
          {isDeleting ? (
            <>
              <span className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></span>
              Deleting...
            </>
          ) : (
            <>🗑 Delete Selected</>
          )}
        </button>
        <button
          onClick={onCancel}
          disabled={isDeleting}
          className={`px-2 py-2 text-sm transition-colors ${
            isDeleting 
              ? 'text-slate-500 cursor-not-allowed' 
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          ✕ Cancel
        </button>
      </div>
    </div>
  )
}
