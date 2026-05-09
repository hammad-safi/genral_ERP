// ============================================
// DEVELOPMENT DEMO DATA (Development mode only)
// ============================================
// Demo products for testing - only loaded in development mode
import { DEFAULT_IMAGE } from './utils.js';

const DEMO_DATE = '2024-01-15T00:00:00.000Z';

const demoProducts = [
  {
    name: 'Panadol 500mg',
    category: 'Analgesics',
    barcode: 'PANA001',
    price: 50,
    costPrice: 40,
    unit: 'strip',
    image: DEFAULT_IMAGE,
    description: 'Paracetamol for pain relief',
    createdAt: DEMO_DATE,
    expiryDate: '2026-12-31',
  },
  {
    name: 'Amoxicillin 250mg',
    category: 'Antibiotics',
    barcode: 'AMOX001',
    price: 120,
    costPrice: 100,
    unit: 'box',
    image: DEFAULT_IMAGE,
    description: 'Broad-spectrum antibiotic',
    createdAt: DEMO_DATE,
    expiryDate: '2025-06-30',
  },
  {
    name: 'Cough Syrup',
    category: 'Syrups',
    barcode: 'SYRP001',
    price: 150,
    costPrice: 120,
    unit: 'bottle',
    image: DEFAULT_IMAGE,
    description: 'Relief from dry cough',
    createdAt: DEMO_DATE,
    expiryDate: '2025-12-31',
  },
];

const demoSuppliers = [
  {
    name: 'Pharma Distributing Co.',
    phone: '+1234567890',
    email: 'sales@pharmadist.com',
    address: 'Medical Plaza, Floor 2',
    createdAt: DEMO_DATE,
  },
  {
    name: 'LifeCare Meds',
    phone: '+0987654321',
    email: 'orders@lifecare.com',
    address: 'Health Way Boulevard',
    createdAt: DEMO_DATE,
  },
];

const demoCustomers = [
  {
    name: 'John Doe',
    phone: '0300-1111111',
    email: 'john@example.com',
    address: 'House 123, Street 4',
    createdAt: DEMO_DATE,
  },
];

const demoExpenses = [
  {
    title: 'Electricity Bill',
    amount: 5000,
    category: 'Utilities',
    date: DEMO_DATE,
    note: 'Monthly shop bill',
  },
];

const demoSettings = [
  { key: 'shopName', value: 'Pharmacy Store' },
  { key: 'currency', value: 'Rs' },
];
// ============================================
// CATEGORY COLORS - Pharmacy
// ============================================
export const categoryColors = {
  pharmacy: {
    Analgesics: '#10b981',
    Antibiotics: '#059669',
    Syrups: '#34d399',
    Injections: '#047857',
    FirstAid: '#6ee7b7',
    Supplements: '#065f46',
  },
};

// ============================================
// SEED DATABASE FUNCTION
// ============================================
export async function seedDatabase(targetDB) {
  // Only seed demo data in development mode
  if (import.meta.env.DEV !== true) {
    console.log('Production mode: Skipping demo data. Database stays empty.');
    return;
  }

  // Check if already seeded
  const productCount = await targetDB.products.count();
  if (productCount > 0) {
    console.log('Demo data already loaded.');
    return;
  }

  try {
    console.log('Development mode: Loading demo data for testing...');

    // Note: Categories are automatically initialized by database V3 upgrade hook
    // Do not add them here to avoid duplicates

    // Add demo products
    await targetDB.products.bulkAdd(demoProducts);
    const allProducts = await targetDB.products.toArray();
    const productIds = allProducts.map((p) => p.id);

    // Add inventory for products
    const inventoryItems = productIds.map((productId) => ({
      productId,
      quantity: 50,
      lowStockThreshold: 10,
      lastUpdated: DEMO_DATE,
    }));
    await targetDB.inventory.bulkPut(inventoryItems);

    // Add suppliers
    await targetDB.suppliers.bulkAdd(demoSuppliers);

    // Add expenses
    await targetDB.expenses.bulkAdd(demoExpenses);

    // Add settings
    await targetDB.settings.bulkPut(demoSettings);

    // Add customers
    await targetDB.customers.bulkAdd(demoCustomers);

    console.log('Demo data loaded successfully for development (Pharmacy business)');
  } catch (error) {
    console.error('Failed to seed demo data:', error);
  }
}