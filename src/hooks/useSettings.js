import { useEffect, useState } from 'react';
import { liveQuery } from 'dexie';
import { initDB, getDB } from '@/lib/db';

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

const mapSettings = (rows) => {
  const map = {};
  rows.forEach((row) => {
    map[row.key] = row.value;
  });

  const defaults = getDefaultSettings();

  let categories = defaults.categories;
  try {
    if (map['categories']) {
      const parsed = JSON.parse(map['categories']);
      if (Array.isArray(parsed) && parsed.length > 0) categories = parsed;
    }
  } catch (e) { /* use defaults */ }

  return {
    shopName: map['shopName'] ?? defaults.shopName,
    currency: map['currency'] ?? defaults.currency,
    address: map['address'] ?? defaults.address,
    phone: map['phone'] ?? defaults.phone,
    logo: map['logo'] ?? defaults.logo,
    receiptPrinter: map['receiptPrinter'] ?? defaults.receiptPrinter,
    labelPrinter: map['labelPrinter'] ?? defaults.labelPrinter,
    reportsPrinter: map['reportsPrinter'] ?? defaults.reportsPrinter,
    categories,
  };
};

export const useSettings = () => {
  const defaultSettings = getDefaultSettings();
  const [settings, setSettings] = useState(defaultSettings);

  useEffect(() => {
    let subscription = null;
    let mounted = true;

    const loadSettings = async () => {
      await initDB();
      const currentDB = getDB();
      
      subscription = liveQuery(() => currentDB.settings.toArray()).subscribe({
        next: (rows) => {
          if (mounted) {
            setSettings(mapSettings(rows));
          }
        },
      });
    };

    loadSettings();

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  return settings;
};