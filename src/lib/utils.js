export const formatCurrency = (amount, currency = 'Rs') => {
  // Convert to number if it's a string, handle null/undefined
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : (amount ?? 0);
  // Return 0 if NaN
  const finalAmount = Number.isNaN(numAmount) ? 0 : numAmount;
  return `${currency} ${finalAmount.toFixed(2)}`;
};

export const currencyFormatter = (value, currency = 'Rs') => {
  return formatCurrency(value, currency);
};

export const formatDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return typeof value === 'string' ? value : 'Invalid date';
  }
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

export const downloadJson = (data, fileName = 'shop-erp-backup.json') => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
};

export const calculateCOGS = (sales, products) => {
  return sales.reduce((total, sale) => {
    return sale.items.reduce((saleSum, item) => {
      // Use snapshotted costPrice from sale item if available,
      // fall back to current product costPrice for old records
      const costPrice = item.costPrice
        ?? products.find((p) => p.id === item.productId)?.costPrice
        ?? 0;
      return saleSum + costPrice * item.qty;
    }, total);
  }, 0);
};

export const calculateNetProfit = (sales, products, expenses) => {
  const validSales = sales.filter((sale) => sale.returned !== true);
  const totalRevenue = validSales.reduce((sum, sale) => sum + sale.totalAmount, 0);
  const totalCOGS = calculateCOGS(validSales, products);
  const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  return totalRevenue - totalCOGS - totalExpenses;
};

export const calculateNetProfitCashBasis = (sales, purchases, expenses) => {
  const validSales = sales.filter((sale) => sale.returned !== true);
  const totalSales = validSales.reduce((sum, sale) => sum + sale.totalAmount, 0);
  const totalPurchases = purchases.reduce((sum, purchase) => sum + (purchase.totalCost ?? 0), 0);
  const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  return totalSales - totalPurchases - totalExpenses;
};

export const DEFAULT_IMAGE =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAAWUlEQVR4Xu3BAQ0AAADCIPunNscwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA4F0GAAE2ApH4AAAAAElFTkSuQmCC';

/**
 * Remove leading zeros from numeric input while preserving decimals
 * Returns STRING to prevent decimal point destruction during typing
 * Used with onChange handlers so state stays as string while user types
 * Only parse to number when saving or calculating
 * Examples:
 * - "01" → "1"
 * - "0.5" → "0.5"
 * - "150." → "150." (preserves trailing dot for "150.5" input)
 * - "" → "" (stays empty, doesn't snap to "0")
 * - "-" → "-" (allows minus sign in progress)
 */
export const removeLeadingZeros = (value) => {
  if (value === '' || value === null || value === undefined) return '';
  const str = String(value).trim();
  
  // Allow lone minus sign (for negative input in progress)
  if (str === '-') return '-';
  
  // Preserve trailing decimal point so user can type "150." → "150.5"
  const hasTrailingDot = str.endsWith('.');
  
  if (str.includes('.')) {
    const [intPart, decPart] = str.split('.');
    const cleanInt = intPart === '' || intPart === '-' ? (intPart || '0') 
                   : String(parseInt(intPart, 10) || 0);
    return hasTrailingDot ? `${cleanInt}.` : `${cleanInt}.${decPart}`;
  }
  
  // Integer: strip leading zeros, but allow empty string
  if (str === '0' || str === '') return str;
  const parsed = parseInt(str, 10);
  return Number.isNaN(parsed) ? '' : String(parsed);
};

/**
 * Force Electron to repaint after React DOM updates complete.
 * This fixes the "frozen input fields after delete" bug by ensuring
 * the compositor repaint happens AFTER React has rendered changes.
 * Uses requestAnimationFrame + setTimeout to properly queue the operation.
 */
export const forceRepaintAfterRender = () => {
  if (typeof requestAnimationFrame !== 'undefined') {
    requestAnimationFrame(() => {
      setTimeout(() => {
        window.electronAPI?.forceRepaint?.();
      }, 0);
    });
  } else {
    setTimeout(() => {
      window.electronAPI?.forceRepaint?.();
    }, 0);
  }
};