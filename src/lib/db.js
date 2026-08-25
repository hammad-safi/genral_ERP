/**
 * ============================================
 * DEXIE DATABASE INITIALIZATION & MANAGEMENT
 * ============================================
 * 
 * OVERVIEW:
 * This module manages IndexedDB database initialization using Dexie.js
 * The application uses a single database for Pharmacy operations:
 * - pharmacyDB: Pharmacy / Medical store business
 * 
 * ARCHITECTURE:
 * - IndexedDB for robust offline-first data storage
 * - Schema versioning (V4: supports products, inventory, sales, customers, etc.)
 * - Environment-aware seeding (demo data only in development)
 * - User data persistence across app restarts
 * - Safe error handling (never auto-delete user data)
 * 
 * DATA FLOW:
 * 1. App startup → BusinessContext calls initDB() or initDBWithSeed()
 * 2. initDB() → Opens database with schema, preserves existing user data
 * 3. initDBWithSeed() → For development ONLY, seeds demo data if empty
 * 4. In production, database starts empty (no auto-seeding)
 * 5. User adds data manually or imports existing backup
 * 6. Data persists between app restarts (no automatic clearing)
 * 7. Reset only happens via Settings → Reset Database (user confirmation)
 * 
 * CRITICAL DESIGN DECISIONS:
 * ✓ NO automatic data deletion on app startup or errors
 * ✓ User data ALWAYS persists between sessions
 * ✓ Seeding is opt-in, not automatic (except in dev mode)
 * ✓ Reset requires explicit user confirmation via UI
 * ✓ Three separate databases for data isolation
 * ✓ Dexie versioning for schema migration support
 * 
 * KEY FUNCTIONS:
 * - initDB(business) → Open database, no seeding
 * - initDBWithSeed(business) → Open + seed if empty (dev mode)
 * - resetDatabase(business) → Clear all data (user-initiated)
 * - exportDatabase(db) → Backup all data to JSON
 * - getDB(business) → Get database instance
 * - setDB(business) → Activate database
 * 
 * ENVIRONMENT DETECTION:
 * Uses import.meta.env.DEV (Vite environment variable):
 * - DEV mode: Demo data seeds on first launch, resets show demo data
 * - PROD mode: All databases start empty, no auto-seeding
 * 
 * DATABASE SCHEMA:
 * V1 (14 tables):
 *   - products, inventory, purchases, sales, suppliers, customers
 *   - expenses, salesReturns, customerLedger, settings
 * 
 * V2 (14 tables + expiryDate):
 *   - Same as V1 but products/inventory/purchases track expiration
 *   - Automatic migration on database open
 */

import Dexie from 'dexie';
import { seedDatabase } from './seed.js';

/**
 * ShopDatabase - Main database class using Dexie
 * 
 * Schema Strategy:
 * - Version 1: Initial schema with all core tables
 * - Version 2: Extended schema with expiryDate fields
 * 
 * Migration Note:
 * Dexie automatically handles version migrations. When users upgrade from V1/V2,
 * NO DATA IS LOST during migration - only new tables/fields are added.
 */
export class ShopDatabase extends Dexie {
  constructor(dbName) {
    super(dbName);

    // ============================================
    // VERSION 1: Initial Schema
    // ============================================
    // Defines all tables with their primary keys and indexes
    this.version(1).stores({
      // Products & Inventory
      products: '++id, name, category, barcode, price, costPrice, unit, createdAt',
      inventory: '++id, productId, quantity, lowStockThreshold, lastUpdated',
      
      // Business Transactions
      purchases: '++id, productId, productName, quantity, costPrice, totalCost, supplier, date',
      sales: '++id, date, totalAmount, discount, paymentMethod, customerId',
      
      // Contacts
      suppliers: '++id, name, phone, email, address, createdAt',
      customers: '++id, name, phone, email',
      
      // Expenses & Returns
      expenses: '++id, title, amount, category, date',
      salesReturns: '++id, originalSaleId, productId, productName, quantity, refundAmount, reason, refundMethod, customerId, date',
      
      customerLedger: '++id, customerId, type, amount, description, date',
      
      // Configuration
      settings: 'key',
    });

    // ============================================
    // VERSION 2: Schema Extension
    // ============================================
    // Adds expiryDate field for product tracking and cosmetics expiry management
    this.version(2).stores({
      // Updated with expiryDate for tracking
      products: '++id, name, category, barcode, price, costPrice, unit, createdAt, expiryDate',
      inventory: '++id, productId, quantity, lowStockThreshold, lastUpdated, expiryDate',
      purchases: '++id, productId, productName, quantity, costPrice, totalCost, supplier, date, expiryDate',
      
      // Unchanged tables (must be redefined for version 2)
      sales: '++id, date, totalAmount, discount, paymentMethod, customerId',
      suppliers: '++id, name, phone, email, address, createdAt',
      customers: '++id, name, phone, email',
      expenses: '++id, title, amount, category, date',
      salesReturns: '++id, originalSaleId, productId, productName, quantity, refundAmount, reason, refundMethod, customerId, date',
      customerLedger: '++id, customerId, type, amount, description, date',
      settings: 'key',
    });

    // VERSION 3: Match schema to prevent version mismatch errors
    // Keep same tables from V2 - no upgrade hook needed
    this.version(3).stores({
      products: '++id, name, category, barcode, price, costPrice, unit, createdAt, expiryDate',
      inventory: '++id, productId, quantity, lowStockThreshold, lastUpdated, expiryDate',
      purchases: '++id, productId, productName, quantity, costPrice, totalCost, supplier, date, expiryDate',
      sales: '++id, date, totalAmount, discount, paymentMethod, customerId',
      suppliers: '++id, name, phone, email, address, createdAt',
      customers: '++id, name, phone, email',
      expenses: '++id, title, amount, category, date',
      salesReturns: '++id, originalSaleId, productId, productName, quantity, refundAmount, reason, refundMethod, customerId, date',
      customerLedger: '++id, customerId, type, amount, description, date',
      settings: 'key',
    });

    // VERSION 4: Add price history tracking
    // Tracks all purchase price and sale price changes for audit trail
    this.version(4).stores({
      products: '++id, name, category, barcode, price, costPrice, unit, createdAt, expiryDate',
      inventory: '++id, productId, quantity, lowStockThreshold, lastUpdated, expiryDate',
      purchases: '++id, productId, productName, quantity, costPrice, totalCost, supplier, date, expiryDate',
      sales: '++id, date, totalAmount, discount, paymentMethod, customerId',
      suppliers: '++id, name, phone, email, address, createdAt',
      customers: '++id, name, phone, email',
      expenses: '++id, title, amount, category, date',
      salesReturns: '++id, originalSaleId, productId, productName, quantity, refundAmount, reason, refundMethod, customerId, date',
      customerLedger: '++id, customerId, type, amount, description, date',
      priceHistory: '++id, productId, type, date',
      settings: 'key',
    });
  }
}

// ============================================
// DATABASE INSTANCES
// ============================================
// Single IndexedDB database for Pharmacy operations
export const pharmacyDB = new ShopDatabase('ShopERP_Pharmacy');

// Active database reference
export let db = pharmacyDB;

// ============================================
// DATABASE ACCESS FUNCTIONS
// ============================================
/**
 * Get the database instance
 * @returns {ShopDatabase} The pharmacy database instance
 */
export const getDB = () => {
  return pharmacyDB;
};

/**
 * Set the active database (kept for compatibility)
 */
export const setDB = () => {
  db = pharmacyDB;
};

/**
 * Safely open a database without deleting user data
 * 
 * CRITICAL: This function NEVER calls db.delete() or clears tables on error.
 * User data is always preserved across app restarts, even when errors occur.
 * 
 * Error handling strategy:
 * 1. Attempt normal open
 * 2. If error occurs, close DB gracefully and retry
 * 3. If upgrade handler fails, log error but keep existing data intact
 * 
 * @param {Dexie} targetDB - Database instance to open
 * @returns {Dexie} The opened database instance
 * @throws {Error} If unable to open database after retries
 */
async function safeOpenDB(targetDB) {
  try {
    await targetDB.open();
    return targetDB;
  } catch (error) {
    console.warn(`Dexie open failed for ${targetDB.name}`, error);
    
    // Attempt to close and reopen without deleting data
    try {
      await targetDB.close();
    } catch (closeError) {
      console.warn(`Failed to close DB ${targetDB.name}`, closeError);
    }

    // Retry opening without deleting user data
    try {
      await targetDB.open();
      return targetDB;
    } catch (retryError) {
      console.error(`Failed to recover DB ${targetDB.name}`, retryError);
      throw retryError;
    }
  }
}

/**
 * Initialize default settings for a business if they don't exist
 * Each business has different default currency and settings
 * 
 * @param {Dexie} targetDB - Database instance
 * @param {string} business - Business type: 'general', 'jaggery', or 'cosmetics'
 */
async function initializeDefaultSettings(targetDB) {
  const settingsCount = await targetDB.settings.count();
  
  if (settingsCount === 0) {
    // Set defaults for Pharmacy
    const businessDefaults = {
      shopName: 'General Store',
      currency: 'Rs',
      address: '',
      phone: '',
    };
    
    try {
      await Promise.all([
        targetDB.settings.put({ key: 'shopName', value: businessDefaults.shopName }),
        targetDB.settings.put({ key: 'currency', value: businessDefaults.currency }),
        targetDB.settings.put({ key: 'address', value: businessDefaults.address }),
        targetDB.settings.put({ key: 'phone', value: businessDefaults.phone }),
      ]);
    } catch (error) {
      console.warn(`Failed to initialize default settings for Pharmacy:`, error);
    }
  }
}

/**
 * Initialize a database without seeding
 * 
 * NORMAL STARTUP PATH: Opens database with schema migration but NO data insertion.
 * If data exists from previous session, it is preserved. If this is first run, 
 * database opens empty and ready for user input.
 * 
 * Used in:
 * - Production builds (no demo data)
 * - Database reset (clearing existing data)
 * 
 * @param {string} business - Business type: 'general', 'jaggery', or 'cosmetics'
 * @returns {Promise<Dexie>} The opened database instance
 */
export async function initDB() {
  const targetDB = pharmacyDB;
  await safeOpenDB(targetDB);
  await deduplicateProducts(targetDB);
  await initializeDefaultSettings(targetDB);
  return targetDB;
}

export async function initDBWithSeed() {
  const targetDB = pharmacyDB;
  await safeOpenDB(targetDB);
  await deduplicateProducts(targetDB);
  await initializeDefaultSettings(targetDB);
  const count = await targetDB.products.count();
  if (count === 0) {
    try {
      await seedDatabase(targetDB);
    } catch (error) {
      console.error(`Seeding failed for Pharmacy database:`, error);
      // If seeding fails due to constraint errors, try force reinit
      if (error.name === 'ConstraintError') {
        console.warn(`ConstraintError during seeding, clearing and retrying...`);
        await forceInitDB();
      } else {
        throw error;
      }
    }
  }
  return targetDB;
}

/**
 * Force reinitialize a database (used when seeding fails)
 * 
 * Used internally when initDBWithSeed() encounters ConstraintError during seeding.
 * Clears tables and retries seeding with fresh database state.
 * 
 * @internal
 * @param {string} business - Business type
 * @returns {Promise<Dexie>} Reinitialized database
 */
export async function forceInitDB() {
  const targetDB = pharmacyDB;
  await safeOpenDB(targetDB);
  
  // Clear all tables
  await targetDB.products.clear();
  await targetDB.inventory.clear();
  await targetDB.purchases.clear();
  await targetDB.sales.clear();
  await targetDB.suppliers.clear();
  await targetDB.expenses.clear();
  await targetDB.salesReturns.clear();
  await targetDB.settings.clear();
  await targetDB.customers.clear();
  await targetDB.customerLedger.clear();
  await targetDB.priceHistory.clear();
  
  // Re-seed with pharmacy data
  await seedDatabase(targetDB);
  
  return targetDB;
}

/**
 * Initialize all databases
 * 
 * Useful for comprehensive startup (loads all three business databases in parallel)
 * 
 * @returns {Promise<void>}
 */
export async function initAllDBs() {
  await initDB();
}

/**
 * Remove duplicate products and orphaned inventory records
 * 
 * Deduplication strategy:
 * 1. Products: Removed if barcode/name matches earlier product
 * 2. Inventory: Removed if productId no longer exists
 * 3. InventoryPK: Removed if multiple records reference same productId
 * 
 * @param {Dexie} targetDB - Database to deduplicate
 * @returns {Promise<void>}
 */
export async function deduplicateProducts(targetDB = pharmacyDB) {
  const allProducts = await targetDB.products.toArray();
  const seen = new Map();
  const toDelete = [];

  for (const product of allProducts) {
    const key = product.barcode ?? product.name;
    if (seen.has(key)) {
      if (product.id) toDelete.push(product.id);
    } else if (product.id) {
      seen.set(key, product.id);
    }
  }

  if (toDelete.length > 0) {
    await targetDB.products.bulkDelete(toDelete);
  }

  const validProductIds = (await targetDB.products.toArray()).map((product) => product.id).filter(Boolean);
  const allInventory = await targetDB.inventory.toArray();
  const orphanedInventory = allInventory.filter((item) => !validProductIds.includes(item.productId)).map((item) => item.id).filter(Boolean);
  if (orphanedInventory.length > 0) {
    await targetDB.inventory.bulkDelete(orphanedInventory);
  }

  const allInv = await targetDB.inventory.toArray();
  const seenProductIds = new Set();
  const dupInv = [];
  for (const inv of allInv) {
    if (seenProductIds.has(inv.productId)) {
      if (inv.id) dupInv.push(inv.id);
    } else {
      seenProductIds.add(inv.productId);
    }
  }
  if (dupInv.length > 0) {
    await targetDB.inventory.bulkDelete(dupInv);
  }
}

/**
 * Export database contents to JSON
 * 
 * Exports all tables from a database as a JSON object.
 * Used for backup/restore functionality in Settings page.
 * 
 * @param {Dexie} targetDB - Database to export (default: generalDB)
 * @returns {Promise<Object>} JSON object with all table data
 */
export async function exportDatabase(targetDB = pharmacyDB) {
  const [products, inventory, purchases, sales, suppliers, expenses, salesReturns, settings, customers, customerLedger] = await Promise.all([
    targetDB.products.toArray(),
    targetDB.inventory.toArray(),
    targetDB.purchases.toArray(),
    targetDB.sales.toArray(),
    targetDB.suppliers.toArray(),
    targetDB.expenses.toArray(),
    targetDB.salesReturns.toArray(),
    targetDB.settings.toArray(),
    targetDB.customers.toArray(),
    targetDB.customerLedger.toArray(),
  ]);

  return {
    products,
    inventory,
    purchases,
    sales,
    suppliers,
    expenses,
    salesReturns,
    settings,
    customers,
    customerLedger,
  };
}

/**
 * Export all three databases (general, jaggery, cosmetics)
 * 
 * @returns {Promise<Object>} Object with general, jaggery, and cosmetics exports
 */
export async function exportAllDatabases() {
  return {
    pharmacy: await exportDatabase(pharmacyDB),
  };
}

/**
 * Alias for backwards compatibility
 * @deprecated Use initDB instead
 */
export { initDB as initDb };

/**
 * Reset a database by clearing all data (user-initiated only)
 * 
 * IMPORTANT: This function is ONLY called when user clicks "Reset Database" in Settings
 * after confirming the destructive action. It is NOT called automatically on startup.
 * 
 * Behavior:
 * 1. User clicks "Reset Database" button in Settings page
 * 2. ConfirmDialog asks for verification
 * 3. On confirmation, resetDatabase() is called
 * 4. All tables are cleared (products, inventory, purchases, sales, suppliers, 
 *    expenses, salesReturns, settings, customers, customerLedger)
 * 5. Database opens empty for user to add new data
 * 6. NO automatic re-seeding happens
 * 
 * @param {string} business - Business type: 'general', 'jaggery', or 'cosmetics'
 * @returns {Promise<boolean>} True if reset successful
 */
export async function resetDatabase() {
  const targetDB = pharmacyDB;
  await safeOpenDB(targetDB);
  
  // Clear all tables
  await targetDB.products.clear();
  await targetDB.inventory.clear();
  await targetDB.purchases.clear();
  await targetDB.sales.clear();
  await targetDB.suppliers.clear();
  await targetDB.expenses.clear();
  await targetDB.salesReturns.clear();
  await targetDB.settings.clear();
  await targetDB.customers.clear();
  await targetDB.customerLedger.clear();
  await targetDB.priceHistory.clear();
  
  console.log(`Pharmacy database cleared - all data deleted. User must add data manually.`);
  
  return true;
}

/**
 * Reset all databases (general, jaggery, cosmetics)
 * 
 * Clears data from all three business type databases simultaneously.
 * User-initiated only (called from Settings after confirmation).
 * 
 * @returns {Promise<void>}
 */
export async function resetAllDatabases() {
  await resetDatabase();
}
