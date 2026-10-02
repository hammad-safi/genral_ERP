import { useState, useEffect } from 'react';

// A mock useLiveQuery that fetches from the API instead of Dexie.
export function useApiQuery(queryFn, deps = []) {
  const [data, setData] = useState(undefined);
  
  useEffect(() => {
    let isMounted = true;
    
    async function fetchData() {
      try {
        const result = await queryFn();
        if (isMounted) setData(result);
      } catch (error) {
        console.error('API Query Error:', error);
        if (isMounted) setData(null);
      }
    }
    
    fetchData();
    
    return () => {
      isMounted = false;
    };
  }, deps);
  
  return data;
}
