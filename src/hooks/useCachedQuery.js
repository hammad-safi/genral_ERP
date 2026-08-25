import { useState, useEffect, useRef } from 'react';
import { paginationCache } from './useDexiePagination';

/**
 * A generic hook to fetch data with in-memory caching and stale-while-revalidate.
 *
 * @param {string} cacheKey - The base key for caching this query.
 * @param {Function} queryFn - An async function that returns the data.
 * @param {Array} deps - Dependencies that trigger a re-fetch.
 */
export function useCachedQuery(cacheKey, queryFn, deps = []) {
  const activeCacheKey = cacheKey ? `${cacheKey}-${JSON.stringify(deps)}` : null;
  const cachedData = activeCacheKey ? paginationCache.get(activeCacheKey) : null;

  const [data, setData] = useState(cachedData?.data || null);
  // Only show loading if we don't have cached data
  const [isLoading, setIsLoading] = useState(!cachedData);
  const [error, setError] = useState(null);
  
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const isFirstRender = useRef(true);

  // Handle dependency changes: restore from cache if available, else clear
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    
    if (activeCacheKey) {
      const newCachedState = paginationCache.get(activeCacheKey);
      if (newCachedState) {
        setData(newCachedState.data);
        setIsLoading(false);
        // Silently revalidate in the background
        setRefreshTrigger(prev => prev + 1);
        return;
      }
    }
    
    setData(null);
  }, deps);

  // Fetch data and save to cache
  useEffect(() => {
    let isMounted = true;
    
    const loadData = async () => {
      if (!data) setIsLoading(true);
      setError(null);
      
      try {
        const result = await queryFn();
        if (isMounted) {
          setData(result);
          setIsLoading(false);
          if (activeCacheKey) {
            paginationCache.set(activeCacheKey, { data: result });
          }
        }
      } catch (err) {
        if (isMounted) {
          console.error("Cached query error:", err);
          setError(err);
          setIsLoading(false);
        }
      }
    };
    
    loadData();
    
    return () => {
      isMounted = false;
    };
  }, [refreshTrigger, ...deps]);
  
  const refresh = () => setRefreshTrigger(prev => prev + 1);
  
  return { data, isLoading, error, refresh, setData };
}
