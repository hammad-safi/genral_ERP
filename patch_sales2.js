const fs = require('fs');
const salesPath = 'src/pages/Sales.jsx';
let content = fs.readFileSync(salesPath, 'utf8');

const startMarker = '<PageHeader title="Sales"';
let startIndex = content.indexOf(startMarker);

const endSearchStr = '            <label className="text-xs text-slate-500">From</label>';
let endSearchIdx = content.indexOf(endSearchStr);
let endIndex = content.lastIndexOf('<section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">', endSearchIdx);

if (startIndex === -1 || endIndex === -1) {
  console.log("Could not find markers.", startIndex, endIndex);
  process.exit(1);
}

const posReplacement = `
      <div className="flex bg-slate-100 rounded-xl overflow-hidden shadow-sm border border-slate-200 mb-6" style={{ height: 'calc(100vh - 120px)', minHeight: '600px' }}>
        {/* Left Side: Product Grid */}
        <div className="flex-1 flex flex-col border-r border-slate-200 bg-slate-50">
          <div className="p-4 bg-white border-b border-slate-200 flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <input
                ref={barcodeRef}
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={handleBarcodeInput}
                placeholder="Search products or scan barcode..."
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:border-blue-500 outline-none transition-colors"
              />
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 no-scrollbar">
            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))' }}>
              {(searchQuery ? searchResults : inventory.map(i => ({ id: i.productId, name: i.productName, price: i.price, image: i.image }))).map(product => {
                const stockItem = inventory.find(i => i.productId === product.id);
                const stock = stockItem?.quantity || 0;
                return (
                  <button 
                    key={product.id}
                    onClick={() => stock > 0 && addToCart({ ...product, price: product.price || stockItem?.unitPrice || 0 })}
                    className={\`bg-white rounded-xl border \${stock > 0 ? 'border-slate-200 hover:border-blue-500 cursor-pointer shadow-sm hover:shadow-md hover:-translate-y-0.5 active:scale-95' : 'border-slate-100 opacity-50 cursor-not-allowed'} flex flex-col overflow-hidden text-left transition-all\`}
                  >
                    <div className="h-32 w-full bg-slate-100 flex items-center justify-center shrink-0 relative">
                      {product.image ? (
                        <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="text-slate-300">
                           <ShoppingCart className="h-8 w-8 opacity-20" />
                        </div>
                      )}
                      {stock <= 0 && <div className="absolute inset-0 bg-white/50 flex items-center justify-center"><span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">Out of Stock</span></div>}
                    </div>
                    <div className="p-3">
                      <p className="text-sm font-bold text-slate-900 leading-tight mb-1 truncate" title={product.name}>{product.name || stockItem?.productName}</p>
                      <p className="text-sm font-bold text-[#0056d6]">{formatCurrency(product.price || stockItem?.unitPrice || 0, currency)}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Right Side: Cart Panel */}
        <div className="w-[380px] bg-white flex flex-col shrink-0">
          <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-white">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-slate-800" />
              <h2 className="text-xl font-bold text-slate-900">Current Order</h2>
            </div>
            <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded">#1042</span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50 no-scrollbar">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-3">
                 <ShoppingCart className="h-12 w-12 opacity-20" />
                 <p className="text-sm font-medium">Cart is empty</p>
              </div>
            ) : (
              cart.map((item) => (
                <div key={item.productId} className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm relative overflow-hidden flex flex-col gap-3">
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#0056d6]"></div>
                  <div className="flex justify-between items-start pl-2">
                    <p className="font-bold text-slate-900 text-sm leading-snug pr-4">{item.productName}</p>
                    <p className="font-bold text-slate-900 text-sm shrink-0">{formatCurrency(item.subtotal, currency)}</p>
                  </div>
                  <div className="flex items-center justify-between pl-2">
                    <div className="flex items-center bg-slate-100 rounded border border-slate-200 overflow-hidden h-8">
                      <button onClick={() => updateQty(item.productId, Math.max(1, item.qty - 1))} className="w-8 h-full flex items-center justify-center hover:bg-slate-200 text-slate-600 font-bold transition-colors">−</button>
                      <input 
                        type="text" 
                        value={item.qty} 
                        onChange={e => updateQty(item.productId, removeLeadingZeros(e.target.value))}
                        onFocus={e => e.target.select()}
                        className="w-10 h-full text-center bg-transparent text-sm font-bold outline-none border-x border-slate-200"
                      />
                      <button onClick={() => updateQty(item.productId, item.qty + 1)} className="w-8 h-full flex items-center justify-center hover:bg-slate-200 text-slate-600 font-bold transition-colors">+</button>
                    </div>
                    <button onClick={() => removeItem(item.productId)} className="text-red-400 hover:text-red-600 p-1.5 transition-colors">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="p-6 border-t border-slate-200 bg-white">
            <div className="space-y-3 mb-5">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500 font-medium">Subtotal</span>
                <span className="text-slate-900 font-bold">{formatCurrency(subtotal, currency)}</span>
              </div>
              <div className="flex justify-between text-sm items-center">
                <span className="text-slate-500 font-medium">Tax (0%) <button className="text-slate-400 hover:text-slate-600 ml-1">✎</button></span>
                <span className="text-slate-900 font-bold">{formatCurrency(0, currency)}</span>
              </div>
              <div className="flex justify-between text-sm items-center">
                <span className="text-[#0056d6] font-medium">Discount</span>
                <div className="flex items-center gap-2">
                  {discount ? (
                    <span className="text-slate-900 font-bold">-{formatCurrency(discount, currency)}</span>
                  ) : (
                    <button onClick={() => {
                      const d = window.prompt('Enter discount amount:');
                      if (d) setDiscount(d);
                    }} className="text-[#0056d6] bg-blue-50 px-2 py-1 rounded text-xs font-bold flex items-center gap-1 hover:bg-blue-100 transition-colors">
                      <div className="h-3.5 w-3.5 rounded-full border border-[#0056d6] flex items-center justify-center text-[10px]">+</div> Add
                    </button>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex justify-between items-end mb-5 pt-5 border-t border-slate-100">
              <span className="text-xl font-bold text-slate-900">Total</span>
              <span className="text-[2.5rem] font-black text-slate-900 tracking-tight leading-none">{formatCurrency(totalAmount, currency)}</span>
            </div>
            
            <button
              onClick={() => {
                if (cart.length > 0) {
                  const pm = window.prompt('Payment Method (Cash/Card):', 'Cash');
                  if (pm) {
                    setPaymentMethod(pm);
                    completeSaleLogic();
                  }
                }
              }}
              disabled={cart.length === 0}
              className="w-full bg-[#0056d6] hover:bg-[#0047b3] disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold text-lg py-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-md active:scale-[0.98]"
            >
              PAY NOW
              <svg className="w-5 h-5 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
            </button>
          </div>
        </div>
      </div>\n\n`;

const newContent = content.substring(0, startIndex) + posReplacement + content.substring(endIndex);
fs.writeFileSync(salesPath, newContent, 'utf8');
console.log("Successfully patched Sales.jsx");
