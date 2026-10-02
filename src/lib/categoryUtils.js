/**
 * Category Management Utilities - PERMANENT SOLUTION
 * 
 * ============================================
 * HOW CATEGORIES WORK (Single Source of Truth)
 * ============================================
 * 
 * 1. DATABASE MIGRATION (db.js - V3 Upgrade Hook)
 *    - When app runs, database automatically upgrades from V2→V3
 *    - V3 upgrade hook initializes categories table with defaults
 *    - This happens ONCE per database, automatically
 *    - DEFAULT CATEGORIES: Biscuits, Chocolates, Beverages, Snacks, Dairy, Grocery
 * 
 * 2. RUNTIME OPERATIONS (This file)
 *    - getCategories() - Fetch all categories from database
 *    - addCategory() - User adds new custom category (e.g., "Healthcare")
 *    - deleteCategory() - User removes a category
 * 
 * 3. UI UPDATES (Products.jsx)
 *    - Products page loads and displays categories in dropdown
 *    - User can add new categories via "Manage Categories" section
 *    - Changes persist to database immediately
 * 
 * ============================================
 * IMPORTANT: DO NOT MODIFY
 * ============================================
 * - seed.js NO LONGER adds categories (removed to prevent duplicates)
 * - initializeCategoriesIfEmpty is NOT called (V3 migration handles it)
 * - This file is the ONLY runtime manager for categories
 * 
 * ============================================
 */

const DEFAULT_CATEGORIES = ['Biscuits', 'Chocolates', 'Beverages', 'Snacks', 'Dairy', 'Grocery'];

/**
 * Get all categories from the database, sorted alphabetically
 * Falls back to defaults if table is unavailable (safety net only)
 * 
 * SAFE TO CALL: Multiple times, called on every page load
 * NO SIDE EFFECTS: Only reads data
 * 
 * @param {Database} db - Database connection instance
 * @returns {Promise<string[]>} Array of category names sorted alphabetically
 */
export async function getCategories(db) {
  try {
    const res = await fetch("/api/categories"); const d = await res.json(); const allCategories = d.data || [];
    const names = allCategories.map(c => c.name);
    return names.length > 0 ? names.sort() : DEFAULT_CATEGORIES;
  } catch (error) {
    console.warn('Could not fetch categories, using defaults:', error.message);
    return DEFAULT_CATEGORIES;
  }
}

/**
 * Add a new custom category to the database
 * 
 * VALIDATION:
 * - Checks for empty names
 * - Prevents duplicates (case-insensitive)
 * - User sees immediate feedback on error
 * 
 * @param {Database} db - Database connection instance
 * @param {string} categoryName - Name of category to add (e.g., "Healthcare", "Electronics")
 * @returns {Promise<number>} ID of newly added category
 * @throws {Error} With user-friendly message if validation fails
 * 
 * EXAMPLES:
 *   await addCategory(db, "Healthcare")
 *   await addCategory(db, "Electronics")
 *   await addCategory(db, "Furniture")
 */
export async function addCategory(db, categoryName) {
  try {
    const trimmed = categoryName.trim();
    
    // Validation: Name required
    if (!trimmed) {
      throw new Error('Category name cannot be empty');
    }
    
    // Validation: Prevent duplicates (case-insensitive)
    const existing = await db.categories
      .where('name')
      .equalsIgnoreCase(trimmed)
      .first();
    
    if (existing) {
      throw new Error(`Category "${trimmed}" already exists`);
    }
    
    // Add to database
    const id = await db.categories.add({ name: trimmed });
    console.log(`✓ Added category: ${trimmed}`);
    return id;
  } catch (error) {
    console.error('Error adding category:', error.message);
    throw error;
  }
}

/**
 * Delete a category from the database
 * 
 * WARNING: Existing products will keep their category name,
 * they just won't match dropdown anymore. Consider warning users.
 * 
 * @param {Database} db - Database connection instance
 * @param {string} categoryName - Name of category to delete
 * @throws {Error} If category not found or deletion fails
 */
export async function deleteCategory(db, categoryName) {
  try {
    const trimmed = categoryName.trim();
    
    // Find and delete the category
    const deleted = await db.categories
      .where('name')
      .equals(trimmed)
      .delete();
    
    if (deleted === 0) {
      throw new Error(`Category "${trimmed}" not found`);
    }
    
    console.log(`✓ Deleted category: ${trimmed}`);
  } catch (error) {
    console.error('Error deleting category:', error.message);
    throw error;
  }
}
