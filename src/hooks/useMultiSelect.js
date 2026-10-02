import { useState, useEffect } from 'react'

export const useMultiSelect = (items = []) => {
  const [selectedIds, setSelectedIds] = useState([])

  // Reset selection when items change (e.g., after navigation or data refresh)
  useEffect(() => {
    // filter out undefined items from sparse arrays before mapping
    const validItems = items.filter(Boolean);
    const itemIds = new Set(validItems.map(i => i.id));
    
    // Only update state if there's actually something to remove
    // This prevents infinite loops if filter returns a new array but same contents
    setSelectedIds(prev => {
      const next = prev.filter(id => itemIds.has(id));
      if (next.length !== prev.length) return next;
      return prev;
    });
  }, [items])

  const isSelected = (id) => selectedIds.includes(id)

  const toggleOne = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const toggleAll = () => {
    // Only consider fully loaded items for toggleAll
    const validItems = items.filter(Boolean);
    
    if (selectedIds.length === validItems.length && validItems.length > 0) {
      setSelectedIds([])
    } else {
      setSelectedIds(validItems.map(i => i.id))
    }
  }

  const clearSelection = () => setSelectedIds([])

  const validItems = items.filter(Boolean);
  const isAllSelected = validItems.length > 0 && selectedIds.length === validItems.length
  const isPartialSelected = selectedIds.length > 0 && selectedIds.length < validItems.length

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
