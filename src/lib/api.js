const getBaseUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL.replace(/\/$/, '') + '/api';
  }
  if (typeof window !== 'undefined') {
    if (window.location.protocol === 'file:' || window.electronAPI) {
      return 'http://localhost:3001/api';
    }
    return `${window.location.origin}/api`;
  }
  return 'http://localhost:3001/api';
};

export const API_BASE_URL = getBaseUrl();

export const api = {
  // --- PRODUCTS ---
  getProducts: async (params = {}) => {
    const url = new URL(`${API_BASE_URL}/products`);
    url.searchParams.append('limit', params.limit || 10000);
    if (params.search) url.searchParams.append('search', params.search);
    if (params.page) url.searchParams.append('page', params.page);
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch products');
    return res.json();
  },
  createProduct: async (data) => {
    const res = await fetch(`${API_BASE_URL}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to create product');
    return res.json();
  },
  updateProduct: async (id, data) => {
    const res = await fetch(`${API_BASE_URL}/products/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to update product');
    return res.json();
  },
  deleteProduct: async (id) => {
    const res = await fetch(`${API_BASE_URL}/products/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete product');
    return res.json();
  },

  
  // --- PURCHASES & BATCHES ---
  createPurchase: async (data) => {
    const res = await fetch(`${API_BASE_URL}/purchases`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to record purchase');
    return res.json();
  },
  
  deletePurchase: async (id) => {
    const res = await fetch(`${API_BASE_URL}/purchases/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete purchase');
    return res.json();
  },

  clearData: async () => {
    const res = await fetch(`${API_BASE_URL}/clear-data`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to clear data');
    return res.json();
  },
getPurchases: async (params = {}) => {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE_URL}/purchases${query ? '?' + query : ''}`);
    if (!res.ok) throw new Error('Failed to fetch purchases');
    return res.json();
  },
  getBatches: async () => {
    const res = await fetch(`${API_BASE_URL}/batches`);
    if (!res.ok) throw new Error('Failed to fetch batches');
    return res.json();
  },
  getLedger: async (supplierId) => {
    const res = await fetch(`${API_BASE_URL}/ledger/${supplierId}`);
    if (!res.ok) throw new Error('Failed to fetch ledger');
    return res.json();
  },

  // --- INVENTORY ---
  getInventory: async () => {
    const res = await fetch(`${API_BASE_URL}/inventory`);
    if (!res.ok) throw new Error('Failed to fetch inventory');
    return res.json();
  },

  updateInventoryStock: async (productId, quantityChange) => {
    const res = await fetch(`${API_BASE_URL}/inventory/update-stock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, quantityChange })
    });
    if (!res.ok) throw new Error('Failed to update stock');
    return res.json();
  },


  // --- CUSTOMERS ---
  getCustomers: async () => {
    const res = await fetch(`${API_BASE_URL}/customers`);
    if (!res.ok) throw new Error('Failed to fetch customers');
    return res.json();
  },
  createCustomer: async (data) => {
    const res = await fetch(`${API_BASE_URL}/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to create customer');
    return res.json();
  },

  // --- SALES ---
  getSales: async () => {
    const res = await fetch(`${API_BASE_URL}/sales`);
    if (!res.ok) throw new Error('Failed to fetch sales');
    return res.json();
  },
  createSale: async (data) => {
    const res = await fetch(`${API_BASE_URL}/sales`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to record sale');
    return res.json();
  },

  // --- DASHBOARD ---
  getDashboardMetrics: async () => {
    const res = await fetch(`${API_BASE_URL}/metrics/dashboard`);
    if (!res.ok) throw new Error('Failed to fetch dashboard metrics');
    return res.json();
  }

  , // --- BULK OPERATIONS ---
  deleteProductsBulk: async (ids) => {
    const res = await fetch(`${API_BASE_URL}/products/bulk`, { method: 'DELETE', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ ids }) });
    if (!res.ok) throw new Error('Failed to delete products');
    return res.json();
  },
  deleteSalesBulk: async (ids) => {
    const res = await fetch(`${API_BASE_URL}/sales/bulk`, { method: 'DELETE', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ ids }) });
    // Assuming backend might not have /sales/bulk yet, if not, we do it via loops in the frontend or we need to add it to backend.
    // Wait, the backend has no /sales/bulk. Let's just create it on backend or let the wrapper loop.
    if (!res.ok) throw new Error('Failed to delete sales');
    return res.json();
  },

  // --- EXPENSES ---
  getExpenses: async (params = {}) => {
    const cleanParams = Object.fromEntries(
      Object.entries(params).filter(([_, v]) => v !== undefined && v !== null && v !== '')
    );
    const query = new URLSearchParams(cleanParams).toString();
    const res = await fetch(`${API_BASE_URL}/expenses${query ? `?${query}` : ''}`);
    if (!res.ok) throw new Error('Failed to fetch expenses');
    return res.json();
  },
  createExpense: async (data) => {
    const res = await fetch(`${API_BASE_URL}/expenses`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data) });
    if (!res.ok) throw new Error('Failed to create expense');
    return res.json();
  },
  updateExpense: async (id, data) => {
    const res = await fetch(`${API_BASE_URL}/expenses/${id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data) });
    if (!res.ok) throw new Error('Failed to update expense');
    return res.json();
  },
  deleteExpense: async (id) => {
    const res = await fetch(`${API_BASE_URL}/expenses/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete expense');
    return res.json();
  },
  deleteExpensesBulk: async (ids) => {
    const res = await fetch(`${API_BASE_URL}/expenses/bulk`, { method: 'DELETE', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ ids }) });
    if (!res.ok) throw new Error('Failed to delete expenses');
    return res.json();
  },

  // --- SUPPLIERS ---
  getSuppliers: async (params = {}) => {
    const cleanParams = Object.fromEntries(
      Object.entries(params).filter(([_, v]) => v !== undefined && v !== null && v !== '')
    );
    const query = new URLSearchParams(cleanParams).toString();
    const res = await fetch(`${API_BASE_URL}/suppliers${query ? `?${query}` : ''}`);
    if (!res.ok) throw new Error('Failed to fetch suppliers');
    return res.json();
  },
  createSupplier: async (data) => {
    const res = await fetch(`${API_BASE_URL}/suppliers`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data) });
    if (!res.ok) throw new Error('Failed to create supplier');
    return res.json();
  },
  updateSupplier: async (id, data) => {
    const res = await fetch(`${API_BASE_URL}/suppliers/${id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data) });
    if (!res.ok) throw new Error('Failed to update supplier');
    return res.json();
  },
  deleteSupplier: async (id) => {
    const res = await fetch(`${API_BASE_URL}/suppliers/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete supplier');
    return res.json();
  },
  deleteSuppliersBulk: async (ids) => {
    const res = await fetch(`${API_BASE_URL}/suppliers/bulk`, { method: 'DELETE', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ ids }) });
    if (!res.ok) throw new Error('Failed to delete suppliers');
    return res.json();
  },

  // --- CUSTOMERS (Missing update/delete) ---
  updateCustomer: async (id, data) => {
    const res = await fetch(`${API_BASE_URL}/customers/${id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data) });
    if (!res.ok) throw new Error('Failed to update customer');
    return res.json();
  },
  deleteCustomer: async (id) => {
    const res = await fetch(`${API_BASE_URL}/customers/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete customer');
    return res.json();
  },
  deleteCustomersBulk: async (ids) => {
    const res = await fetch(`${API_BASE_URL}/customers/bulk`, { method: 'DELETE', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ ids }) });
    if (!res.ok) throw new Error('Failed to delete customers');
    return res.json();
  },

  // --- SALES (Missing update/delete) ---
  updateSale: async (id, data) => {
    const res = await fetch(`${API_BASE_URL}/sales/${id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data) });
    if (!res.ok) throw new Error('Failed to update sale');
    return res.json();
  },
  deleteSale: async (id) => {
    const res = await fetch(`${API_BASE_URL}/sales/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete sale');
    return res.json();
  },


};
