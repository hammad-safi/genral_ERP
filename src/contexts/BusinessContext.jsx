import { createContext, useContext, useState, useEffect, useCallback } from 'react';


export const BusinessContext = createContext({
  activeBusiness: 'business',
  switchBusiness: () => {},
  
  businessName: 'Business Management System',
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
  business: {
    name: 'Business Management System',
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
  const [activeBusiness, setActiveBusiness] = useState('business');
  const [mounted, setMounted] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Removed local db initialization
  useEffect(() => {
    setIsInitialized(true);
  }, []);

  // Set mounted
  useEffect(() => {
    setMounted(true);
  }, []);

  const switchBusiness = useCallback(async (business) => {
    setActiveBusiness(business);
    localStorage.setItem('activeBusiness', business);
  }, []);

  const config = businessConfig[activeBusiness];

  // Prevent SSR mismatch
  if (!mounted) {
    return (
      <BusinessContext.Provider value={{
        activeBusiness: 'business',
        switchBusiness,
        
        businessName: 'Business Management System',
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
