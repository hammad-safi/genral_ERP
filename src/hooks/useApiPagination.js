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
  // Synchronous cache hit check for 0ms instant mount
  const getInitialCache = () => {
    try {
      const baseUrl = (() => {
        if (typeof window !== 'undefined') {
          if (window.location.protocol === 'file:' || window.electronAPI) return 'http://localhost:3001';
          return window.location.origin;
        }
        return 'http://localhost:3001';
      })();
      const url = new URL(endpoint, baseUrl);
      url.searchParams.set('page', 0);
      url.searchParams.set('limit', pageSize);
      const searchVal = externalSearch !== undefined ? externalSearch : '';
      if (searchVal) url.searchParams.set('search', searchVal);
      const key = url.toString();
      return globalCache[key] || null;
    } catch (e) {
      return null;
    }
  };

  const initialCached = getInitialCache();

  const [data, setData] = useState(() => initialCached?.data || []);
  const [loading, setLoading] = useState(() => !initialCached);
  const [error, setError] = useState(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [totalItems, setTotalItems] = useState(() => initialCached?.total || 0);
  const [summary, setSummary] = useState(() => initialCached?.summary || null);
  
  // Support both internal search state and external search prop
  const [internalSearch, setInternalSearch] = useState('');
  const search = externalSearch !== undefined ? externalSearch : internalSearch;

  const fetchData = useCallback(async (force = false) => {
    try {
      const baseUrl = (() => {
        if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL.replace(/\/$/, '');
        if (typeof window !== 'undefined') {
          if (window.location.protocol === 'file:' || window.electronAPI) return 'http://localhost:3001';
          return window.location.origin;
        }
        return 'http://localhost:3001';
      })();
      const url = new URL(endpoint, baseUrl);
      url.searchParams.set('page', pageIndex);
      url.searchParams.set('limit', pageSize);
      if (search) url.searchParams.set('search', search);

      const cacheKey = url.toString();
      
      if (!force && globalCache[cacheKey]) {
        setData(globalCache[cacheKey].data);
        setTotalItems(globalCache[cacheKey].total);
        setSummary(globalCache[cacheKey].summary || null);
        setLoading(false);
        return;
      }

      // If we don't have cached data yet, show loading spinner. If we already have cached data, background validate without spinner (SWR).
      if (!globalCache[cacheKey]) {
        setLoading(true);
      }

      const response = await fetch(cacheKey);
      if (!response.ok) throw new Error('Failed to fetch data');
      
      const result = await response.json();
      
      globalCache[cacheKey] = {
        data: result.data || [],
        total: result.total || 0,
        summary: result.summary || null
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
      setSummary(result.summary || null);
      setError(null);
    } catch (err) {
      console.error('Pagination Error:', err);
      setError(err.message);
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

  // Optimistic UI updates
  const optimisticInsert = useCallback((newItem) => {
    setData(prev => [newItem, ...prev.filter(x => x.id !== newItem.id)]);
    setTotalItems(prev => prev + 1);
  }, []);

  const optimisticUpdate = useCallback((updatedItem) => {
    setData(prev => prev.map(item => item.id === updatedItem.id ? { ...item, ...updatedItem } : item));
  }, []);

  const optimisticDelete = useCallback((id) => {
    setData(prev => prev.filter(item => item.id !== id));
    setTotalItems(prev => Math.max(0, prev - 1));
  }, []);

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
    summary,
    refresh,
    optimisticInsert,
    optimisticUpdate,
    optimisticDelete
  };
}
