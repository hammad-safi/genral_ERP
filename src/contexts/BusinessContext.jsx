import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getDB, initDB, initDBWithSeed, initAllDBs } from '@/lib/db';

export const BusinessContext = createContext({
  activeBusiness: 'pharmacy',
  switchBusiness: () => {},
  db: getDB('pharmacy'),
  businessName: 'Pharmacy Store',
  businessIcon: '💊',
  businessColor: 'emerald',
  bgColor: 'bg-emerald-600',
  textColor: 'text-emerald-600',
  borderColor: 'border-emerald-600',
  lightBgColor: 'bg-emerald-50',
  lightTextColor: 'text-emerald-700',
  isInitialized: false,
});

export const businessConfig = {
  pharmacy: {
    name: 'General Store',
    icon: '💊',
    color: 'emerald',
    bgColor: 'bg-emerald-600',
    textColor: 'text-emerald-600',
    borderColor: 'border-emerald-600',
    lightBgColor: 'bg-emerald-50',
    lightTextColor: 'text-emerald-700',
    gradient: 'from-emerald-500 to-emerald-600',
    ringColor: 'ring-emerald-500',
    hoverBg: 'hover:bg-emerald-50',
    badgeBg: 'bg-emerald-100',
    badgeText: 'text-emerald-800',
  },
};

export const BusinessProvider = ({ children }) => {
  const [activeBusiness, setActiveBusiness] = useState('pharmacy');
  const [mounted, setMounted] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize pharmacy database on mount
  useEffect(() => {
    const initializeDatabases = async () => {
      try {
        const isDev = import.meta.env.DEV;
        console.log(`Initializing Pharmacy database (${isDev ? 'development' : 'production'} mode)...`);
        
        if (isDev) {
          // In development: load demo data for testing
          await initDBWithSeed('pharmacy');
        } else {
          // In production: keep databases empty
          await initDB('pharmacy');
        }
        
        console.log('Pharmacy database ready.');
        setIsInitialized(true);
      } catch (error) {
        console.error('Failed to initialize database:', error);
      }
    };
    initializeDatabases();
  }, []);

  // Set mounted
  useEffect(() => {
    setMounted(true);
  }, []);

  const switchBusiness = useCallback(async (business) => {
    setActiveBusiness(business);
    localStorage.setItem('activeBusiness', business);
    const isDev = import.meta.env.DEV;
    
    if (isDev && (await getDB(business).products.count()) === 0) {
      await initDBWithSeed(business);
    } else {
      await initDB(business);
    }
  }, []);

  const config = businessConfig[activeBusiness];

  // Prevent SSR mismatch
  if (!mounted) {
    return (
      <BusinessContext.Provider value={{
        activeBusiness: 'pharmacy',
        switchBusiness,
        db: getDB('pharmacy'),
        businessName: 'Pharmacy Store',
        businessIcon: '💊',
        businessColor: 'emerald',
        bgColor: 'bg-emerald-600',
        textColor: 'text-emerald-600',
        borderColor: 'border-emerald-600',
        lightBgColor: 'bg-emerald-50',
        lightTextColor: 'text-emerald-700',
        isInitialized: false,
      }}>
        {children}
      </BusinessContext.Provider>
    );
  }

  return (
    <BusinessContext.Provider value={{
      activeBusiness,
      switchBusiness,
      db: getDB(activeBusiness),
      businessName: config.name,
      businessIcon: config.icon,
      businessColor: config.color,
      bgColor: config.bgColor,
      textColor: config.textColor,
      borderColor: config.borderColor,
      lightBgColor: config.lightBgColor,
      lightTextColor: config.lightTextColor,
      isInitialized,
    }}>
      {children}
    </BusinessContext.Provider>
  );
};

export const useBusiness = () => useContext(BusinessContext);