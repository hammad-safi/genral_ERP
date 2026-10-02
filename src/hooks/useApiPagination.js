import { useState, useEffect, useCallback } from 'react';

const globalCache = {};

export const clearPaginationCache = (key) => {
  if (key) {
    Object.keys(globalCache).forEach(k => {
      if (k.includes(key)) delete globalCache[k];
    });
  } else {
    for (let k in globalCache) delete globalCache[k];
  }
};

export function useApiPagination({ endpoint, pageSize = 20, dependencies = [], search: externalSearch, mode = 'infinite' }) {
  const [data, setData] = useState([]);
  // Initial load is true ONLY if not in cache
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [totalItems, setTotalItems] = useState(0);
  
  // Support both internal search state and external search prop
  const [internalSearch, setInternalSearch] = useState('');
  const search = externalSearch !== undefined ? externalSearch : internalSearch;

  const fetchData = useCallback(async (force = false) => {
    try {
      const url = new URL(endpoint, 'http://localhost:3001');
      url.searchParams.set('page', pageIndex);
      url.searchParams.set('limit', pageSize);
      if (search) url.searchParams.set('search', search);

      const cacheKey = url.toString();
      
      if (!force && globalCache[cacheKey]) {
        setData(globalCache[cacheKey].data);
        setTotalItems(globalCache[cacheKey].total);
        setLoading(false);
        return;
      }

      setLoading(true);
      const response = await fetch(cacheKey);
      if (!response.ok) throw new Error('Failed to fetch data');
      
      const result = await response.json();
      
      globalCache[cacheKey] = {
        data: result.data || [],
        total: result.total || 0
      };

      if (mode === 'infinite' && pageIndex > 0) {
        setData(prev => {
          // Avoid duplicates by checking IDs if they exist
          const existingIds = new Set(prev.map(item => item.id));
          const newItems = (result.data || []).filter(item => !existingIds.has(item.id));
          return [...prev, ...newItems];
        });
      } else {
        setData(result.data || []);
      }
      setTotalItems(result.total || 0);
      setError(null);
    } catch (err) {
      console.error('Pagination Error:', err);
      setError(err.message);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [endpoint, pageIndex, pageSize, search, ...dependencies]);

  useEffect(() => {
    setPageIndex(0);
  }, [endpoint, search, pageSize, ...dependencies]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const refresh = (force = true) => fetchData(force);

  return {
    data,
    loading,
    error,
    pageIndex,
    setPageIndex,
    pageSize,
    totalItems,
    totalPages: Math.ceil(totalItems / pageSize),
    search,
    setSearch: setInternalSearch,
    refresh
  };
}
