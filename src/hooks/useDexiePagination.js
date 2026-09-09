import { useState, useEffect, useRef, useCallback } from 'react';
import { getDB } from '@/lib/db';
import { forceRepaintAfterRender } from '@/lib/utils';

export const paginationCache = new Map();

export const clearPaginationCache = (key) => {
  if (key) {
    // Clear specific keys, supporting partial matches for composite keys
    for (const cacheKey of paginationCache.keys()) {
      if (cacheKey.startsWith(key)) {
        paginationCache.delete(cacheKey);
      }
    }
  } else {
    paginationCache.clear();
  }
};

/**
 * A hook to perform Database-Level Pagination (True Lazy Loading) with Dexie.
 * 
 * @param {Function} queryBuilder - A function receiving the Dexie DB instance and returning a Dexie Collection or Table (e.g. `(db) => db.products.filter(...)`)
 * @param {Array} deps - Dependencies that should reset the pagination (like search strings or filter variables)
 * @param {number} pageSize - Number of items to fetch per chunk
 * @param {Function} transformChunk - Optional async function to transform the chunk (e.g. hydrating relationships)
 * @param {string} cacheKey - Optional key to cache data in memory across route transitions.
 */
export function useDexiePagination(queryBuilder, deps = [], pageSize = 20, transformChunk = null, cacheKey = null) {
  // Generate a composite key based on cacheKey + deps so different searches don't overwrite each other
  const activeCacheKey = cacheKey ? `${cacheKey}-${JSON.stringify(deps)}` : null;
  const cachedState = activeCacheKey ? paginationCache.get(activeCacheKey) : null;

  const [data, setData] = useState(cachedState?.data || []);
  const [page, setPage] = useState(cachedState?.page || 0);
  const [hasMore, setHasMore] = useState(cachedState?.hasMore ?? true);
  const [isLoading, setIsLoading] = useState(!cachedState);
  const [totalCount, setTotalCount] = useState(cachedState?.totalCount || 0);
  
  const observer = useRef();
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const isFirstRender = useRef(true);

  // When dependencies change (e.g. user types in search bar), reset to page 0 or restore cache
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    
    if (activeCacheKey) {
      const newCachedState = paginationCache.get(activeCacheKey);
      if (newCachedState) {
        setData(newCachedState.data);
        setPage(newCachedState.page);
        setHasMore(newCachedState.hasMore);
        setTotalCount(newCachedState.totalCount);
        setIsLoading(false);
        return;
      }
    }

    setData([]);
    setPage(0);
    setHasMore(true);
    // The load effect will naturally pick this up
  }, deps);

  // Save to cache whenever state changes meaningfully
  useEffect(() => {
    if (activeCacheKey && !isLoading && data.length > 0) {
      paginationCache.set(activeCacheKey, { data, page, hasMore, totalCount });
    }
  }, [data, page, hasMore, totalCount, activeCacheKey, isLoading]);

  // Force repaint after data changes to prevent Chromium render freezes on Windows
  useEffect(() => {
    forceRepaintAfterRender();
  }, [data]);

  // Fetch the data chunk from Dexie
  useEffect(() => {
    let isMounted = true;
    
    const loadData = async () => {
      // If we don't have data, show loading. If we DO have data, we are silently refreshing/appending.
      if (data.length === 0) setIsLoading(true);
      
      try {
        const db = getDB();
        const baseQuery = queryBuilder(db);
        
        // Execute sequentially because Dexie Collections may not support concurrent execution of different operations on the same instance
        const rawChunk = await baseQuery.offset(page * pageSize).limit(pageSize).toArray();
        const count = page === 0 ? await queryBuilder(db).count() : totalCount;
        
        const chunk = transformChunk ? await transformChunk(rawChunk) : rawChunk;

        if (isMounted) {
          setData(prev => page === 0 ? chunk : [...prev, ...chunk]);
          setHasMore(chunk.length === pageSize);
          if (page === 0) setTotalCount(count);
          setIsLoading(false);
        }
      } catch (error) {
        console.error("Dexie pagination error:", error);
        if (isMounted) {
          setIsLoading(false);
          setHasMore(false);
        }
      }
    };
    
    // Only load if we are on page 0 without cache, OR we explicitly requested more/refresh
    if (!cachedState || page > cachedState.page || refreshTrigger > 0) {
      if (hasMore || page === 0) {
        loadData();
      }
    }
    
    return () => {
      isMounted = false;
    };
  }, [page, refreshTrigger, ...deps]);

  // Ref to attach to the last element in the table to trigger next load
  const loadMoreRef = useCallback(node => {
    if (isLoading) return;
    if (observer.current) observer.current.disconnect();
    
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        setPage(prevPage => prevPage + 1);
      }
    });
    
    if (node) observer.current.observe(node);
  }, [isLoading, hasMore]);

  // A method to force a complete reload (useful after adding/deleting/editing items)
  const refresh = useCallback((forceClearCache = true) => {
    if (forceClearCache && activeCacheKey) {
      paginationCache.delete(activeCacheKey);
    }
    setData([]); // Instantly clear UI to prevent stale data
    setPage(0);
    setHasMore(true);
    setRefreshTrigger(prev => prev + 1);
  }, [activeCacheKey]);

  return { 
    data, 
    loadMoreRef, 
    hasMore, 
    isLoading, 
    refresh, 
    setData,
    totalCount
  };
}

/**
 * A hook to perform Database-Level Page-based Pagination with Dexie.
 * 
 * @param {Function} queryBuilder - A function receiving the Dexie DB instance and returning a Dexie Collection or Table
 * @param {Array} deps - Dependencies that trigger a total count refresh
 * @param {number} page - Current page (1-indexed)
 * @param {number} limit - Number of items to fetch per page
 * @param {Function} transformChunk - Optional async function to transform the chunk
 */
export function useDexieOffsetPagination(queryBuilder, deps = [], page = 1, limit = 20, transformChunk = null) {
  const [data, setData] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // 1. Fetch total count when dependencies change
  useEffect(() => {
    let isMounted = true;
    const fetchCount = async () => {
      try {
        const db = getDB();
        const count = await queryBuilder(db).count();
        if (isMounted) setTotalCount(count);
      } catch (err) {
        console.error("Dexie count error:", err);
      }
    };
    fetchCount();
    return () => { isMounted = false; };
  }, [...deps, refreshTrigger]);

  // 2. Fetch page data when page, limit, or totalCount changes
  useEffect(() => {
    let isMounted = true;
    const loadPage = async () => {
      setIsLoading(true);
      try {
        const db = getDB();
        const rawChunk = await queryBuilder(db)
          .offset((page - 1) * limit)
          .limit(limit)
          .toArray();
        const chunk = transformChunk ? await transformChunk(rawChunk) : rawChunk;
        
        if (isMounted) {
          setData(chunk);
          setIsLoading(false);
          forceRepaintAfterRender();
        }
      } catch (err) {
        console.error("Dexie pagination load error:", err);
        if (isMounted) setIsLoading(false);
      }
    };
    loadPage();
    return () => { isMounted = false; };
  }, [page, limit, totalCount, refreshTrigger, ...deps]);

  const refresh = useCallback(() => setRefreshTrigger(prev => prev + 1), []);

  return {
    data,
    totalCount,
    isLoading,
    refresh
  };
}
