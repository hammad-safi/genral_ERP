const fs = require('fs');
const salesPath = 'src/pages/Sales.jsx';
let content = fs.readFileSync(salesPath, 'utf8');

// 1. Replace searchResults
const oldSearch = `  const searchResults = useLiveQuery(
    async () => {
      if (!debouncedSearchQuery) return [];
      const term = debouncedSearchQuery.toLowerCase();
      const currentDB = getDB();
      return await currentDB.products
        .where('name').startsWithIgnoreCase(term)
        .or('barcode').startsWithIgnoreCase(term)
        .limit(20)
        .toArray();
    },
    [debouncedSearchQuery],
    []
  );`;

const newSearch = `  const searchResults = useLiveQuery(
    async () => {
      const currentDB = getDB();
      if (!debouncedSearchQuery) {
         return await currentDB.products.limit(100).toArray();
      }
      const term = debouncedSearchQuery.toLowerCase();
      return await currentDB.products
        .where('name').startsWithIgnoreCase(term)
        .or('barcode').startsWithIgnoreCase(term)
        .limit(50)
        .toArray();
    },
    [debouncedSearchQuery],
    []
  );`;

content = content.replace(oldSearch, newSearch);

// 2. Replace grid rendering
const oldGrid = `{(searchQuery ? searchResults : inventory.map(i => ({ id: i.productId, name: i.productName, price: i.price, image: i.image }))).map(product => {
                const stockItem = inventory.find(i => i.productId === product.id);
                const stock = stockItem?.quantity || 0;
                return (
                  <button 
                    key={product.id}
                    onClick={() => stock > 0 && addToCart({ ...product, price: product.price || stockItem?.unitPrice || 0 })}`;

const newGrid = `{searchResults.map(product => {
                const stockItem = inventory.find(i => i.productId === product.id);
                const stock = stockItem?.quantity || 0;
                return (
                  <button 
                    key={product.id}
                    onClick={() => stock > 0 && addToCart({ ...product, price: product.price || stockItem?.unitPrice || 0 })}`;

content = content.replace(oldGrid, newGrid);

fs.writeFileSync(salesPath, content, 'utf8');
console.log("Successfully patched Sales.jsx logic");
