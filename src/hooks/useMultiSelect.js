import { useState, useEffect } from 'react'

export const useMultiSelect = (items = []) => {
  const [selectedIds, setSelectedIds] = useState([])

  // Reset selection when items change (e.g., after navigation or data refresh)
  useEffect(() => {
    const itemIds = new Set(items.map(i => i.id))
    // Remove any selected IDs that no longer exist in items
    setSelectedIds(prev => prev.filter(id => itemIds.has(id)))
  }, [items])

  const isSelected = (id) => selectedIds.includes(id)

  const toggleOne = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const toggleAll = () => {
    if (selectedIds.length === items.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(items.map(i => i.id))
    }
  }

  const clearSelection = () => setSelectedIds([])

  const isAllSelected = items.length > 0 && selectedIds.length === items.length
  const isPartialSelected = selectedIds.length > 0 && selectedIds.length < items.length

  return {
    selectedIds,
    isSelected,
    toggleOne,
    toggleAll,
    clearSelection,
    isAllSelected,
    isPartialSelected,
    selectedCount: selectedIds.length
  }
}
