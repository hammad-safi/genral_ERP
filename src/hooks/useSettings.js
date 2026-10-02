import { useEffect, useState } from 'react';

const DEFAULT_CATEGORIES = ['General', 'Electronics', 'Clothing', 'Food', 'Medicine', 'Hardware', 'Accessories', 'Other'];

const getDefaultSettings = () => {
  return {
    shopName: 'webzen Business',
    currency: 'Rs',
    address: '',
    phone: '',
    logo: './default-logo.jpg',
    receiptPrinter: '',
    labelPrinter: '',
    reportsPrinter: '',
    categories: DEFAULT_CATEGORIES,
  };
};

export const useSettings = () => {
  const [settings, setSettings] = useState(() => {
    const defaultSettings = getDefaultSettings();
    try {
      const storedSettings = localStorage.getItem('appSettings');
      if (storedSettings) {
        return { ...defaultSettings, ...JSON.parse(storedSettings) };
      }
    } catch (e) {
      console.error('Failed to parse settings from localStorage', e);
    }
    return defaultSettings;
  });

  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'appSettings') {
        try {
          const newSettings = e.newValue ? JSON.parse(e.newValue) : getDefaultSettings();
          setSettings(newSettings);
        } catch (err) {
          console.error(err);
        }
      }
    };
    
    // Also support a custom event for same-window updates
    const handleLocalUpdate = () => {
      try {
        const stored = localStorage.getItem('appSettings');
        if (stored) {
          setSettings({ ...getDefaultSettings(), ...JSON.parse(stored) });
        }
      } catch (err) {
        console.error(err);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('settings-updated', handleLocalUpdate);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('settings-updated', handleLocalUpdate);
    };
  }, []);

  return settings;
};