const fs = require('fs');

const salesPath = 'src/pages/Sales.jsx';
let content = fs.readFileSync(salesPath, 'utf8');

// Find the POS section to replace
const startMarker = '<PageHeader title="Sales" description="POS with scanner, cart, and receipt printing" />';
const endMarker = '      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">\n        <div className="flex gap-3 mb-4 items-center flex-wrap">';

const startIndex = content.indexOf(startMarker);
const endIndex = content.indexOf(endMarker);

if (startIndex === -1 || endIndex === -1) {
  console.log("Could not find markers.");
  process.exit(1);
}

const posReplacement = `
      <div className="flex bg-slate-100 rounded-xl overflow-hidden shadow-sm border border-slate-200" style={{ height: 'calc(100vh - 120px)', minHeight: '600px' }}>
        {/* Left Side: Product Grid */}
        <div className="flex-1 flex flex-col border-r border-slate-200 bg-slate-50">
          <div className="p-4 bg-white border-b border-slate-200 flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                ref={barcodeRef}
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={handleBarcodeInput}
                placeholder="Search products or scan barcode..."
                className="w-full pl-9 pr-4 py-2 bg-slate-100 border-transparent rounded-lg text-sm focus:bg-white focus:border-blue-500 outline-none transition-colors"
              />
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4">
            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}>
              {(searchQuery ? searchResults : inventory.map(i => ({ id: i.productId, name: i.productName, price: i.price, image: i.image }))).map(product => {
                const stockItem = inventory.find(i => i.productId === product.id);
                const stock = stockItem?.quantity || 0;
                return (
                  <button 
                    key={product.id}
                    onClick={() => stock > 0 && addToCart({ ...product, price: product.price || stockItem?.unitPrice || 0 })}
                    className={\`bg-white rounded-lg border \${stock > 0 ? 'border-slate-200 hover:border-blue-500 cursor-pointer shadow-sm active:scale-95' : 'border-slate-100 opacity-50 cursor-not-allowed'} flex flex-col overflow-hidden text-left transition-all\`}
                  >
                    <div className="h-28 w-full bg-slate-100 flex items-center justify-center shrink-0">
                      {product.image ? (
                        <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="text-slate-300">dY"</div>
                      )}
                    </div>
                    <div className="p-3">
                      <p className="text-sm font-bold text-slate-900 leading-tight mb-1 truncate" title={product.name}>{product.name || stockItem?.productName}</p>
                      <p className="text-sm font-bold text-blue-600">{formatCurrency(product.price || stockItem?.unitPrice || 0, currency)}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Right Side: Cart Panel */}
        <div className="w-[380px] bg-white flex flex-col shrink-0">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-white">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-slate-800" />
              <h2 className="text-lg font-bold text-slate-900">Current Order</h2>
            </div>
            <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded">#1042</span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
            {cart.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-sm font-medium">Cart is empty</div>
            ) : (
              cart.map((item) => (
                <div key={item.productId} className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm relative overflow-hidden">
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-600"></div>
                  <div className="flex justify-between items-start mb-2 pl-2">
                    <p className="font-bold text-slate-900 text-sm leading-tight pr-4">{item.productName}</p>
                    <p className="font-bold text-slate-900 text-sm shrink-0">{formatCurrency(item.subtotal, currency)}</p>
                  </div>
                  <div className="flex items-center justify-between pl-2 mt-3">
                    <div className="flex items-center bg-slate-100 rounded border border-slate-200 overflow-hidden">
                      <button onClick={() => updateQty(item.productId, Math.max(1, item.qty - 1))} className="px-3 py-1 hover:bg-slate-200 text-slate-600 font-bold transition-colors">−</button>
                      <input 
                        type="text" 
                        value={item.qty} 
                        onChange={e => updateQty(item.productId, removeLeadingZeros(e.target.value))}
                        onFocus={e => e.target.select()}
                        className="w-10 text-center bg-transparent text-sm font-bold outline-none"
                      />
                      <button onClick={() => updateQty(item.productId, item.qty + 1)} className="px-3 py-1 hover:bg-slate-200 text-slate-600 font-bold transition-colors">+</button>
                    </div>
                    <button onClick={() => removeItem(item.productId)} className="text-red-400 hover:text-red-600 p-1">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="p-5 border-t border-slate-200 bg-white">
            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500 font-medium">Subtotal</span>
                <span className="text-slate-900 font-bold">{formatCurrency(subtotal, currency)}</span>
              </div>
              <div className="flex justify-between text-sm items-center">
                <span className="text-slate-500 font-medium">Discount</span>
                <div className="flex items-center gap-2">
                  {discount ? (
                    <span className="text-slate-900 font-bold">-{formatCurrency(discount, currency)}</span>
                  ) : (
                    <button onClick={() => {
                      const d = window.prompt('Enter discount amount:');
                      if (d) setDiscount(d);
                    }} className="text-blue-600 text-xs font-bold flex items-center gap-1 hover:underline">
                      <div className="h-4 w-4 rounded-full border border-blue-600 flex items-center justify-center">+</div> Add
                    </button>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex justify-between items-end mb-4 pt-4 border-t border-slate-100">
              <span className="text-lg font-bold text-slate-900">Total</span>
              <span className="text-4xl font-black text-slate-900 tracking-tight">{formatCurrency(totalAmount, currency)}</span>
            </div>
            
            <button
              onClick={() => {
                if (cart.length > 0) {
                  // Quick logic to simulate the Checkout Modal for now
                  const pm = window.prompt('Payment Method (Cash/Card):', 'Cash');
                  if (pm) {
                    setPaymentMethod(pm);
                    completeSaleLogic();
                  }
                }
              }}
              disabled={cart.length === 0}
              className="w-full bg-[#0056d6] hover:bg-[#0047b3] disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold text-lg py-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
            >
              PAY NOW
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
            </button>
          </div>
        </div>
      </div>\n\n`;

const newContent = content.substring(0, startIndex) + posReplacement + content.substring(endIndex);

fs.writeFileSync(salesPath, newContent, 'utf8');
console.log("Successfully patched Sales.jsx");
