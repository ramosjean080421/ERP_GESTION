<script src="https://unpkg.com/feather-icons"></script>
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>
<script>
/* ============= STORAGE HELPERS ============= */
const Store = {
  get(k, fb){ try{ return JSON.parse(localStorage.getItem(k)) ?? fb; } catch(e){ return fb; } },
  set(k,v){ localStorage.setItem(k, JSON.stringify(v)); },
  remove(k){ localStorage.removeItem(k); }
};

/* ============= AUTH ============= */
const Auth = {
  login(user, pass){
    if(user==='ADMIN' && pass==='1234'){
      Store.set('currentUser', { username:'ADMIN', name:'Administrador', role:'admin' });
      return true;
    }
    return false;
  },
  current(){ return Store.get('currentUser', null); },
  require(){ if(!this.current()) location.href='login.html'; },
  logout(){ Store.remove('currentUser'); location.href='login.html'; }
};

/* ============= CONFIG ============= */
const Config = {
  default: { taxRate:0.18, currency:'PEN', invoiceSeries:'F001', receiptSeries:'B001',
    permissions:{ admin:true, sales:true, inventory:true } },
  get(){ return Store.get('config', this.default); },
  set(c){ Store.set('config', c); }
};

/* ============= SEEDS ============= */
function seedProducts(){
  if(Store.get('products', null)) return;
  const cats = ['Computadoras','Laptops','Monitores','Componentes','Accesorios','Oficina','Redes','Almacenamiento','Impresoras','Software'];
  const products=[]; let id=1;
  for(const cat of cats){
    for(let i=1;i<=12;i++){
      const sku = `${cat.slice(0,3).toUpperCase()}-${String(i).padStart(3,'0')}`;
      const price = Math.round((50+Math.random()*1450)*100)/100;
      const stock = Math.floor(Math.random()*30)+1;
      products.push({ id:id++, name:`${cat} Producto ${i}`, category:cat, sku, price, stock });
    }
  }
  Store.set('products', products);   // 120+
}
function seedClients(){
  if(Store.get('clients', null)) return;
  const base=['Juan Pérez','María Gómez','Carlos Rivas','Ana Torres','Luis Mendoza','Sofía Ruiz','Miguel Campos','Elena Castro','Jorge Díaz','Paola Vargas','Ricardo Flores','Carmen Silva','Gustavo Paredes','Valeria Soto','Diego Alarcón','Adriana Puente','Kevin Pérez','Christopher Mera'];
  const list = base.map((n,i)=>({ id:i+1, name:n, email:n.toLowerCase().replace(/ /g,'.')+'@mail.com', phone:`9${Math.floor(10000000+Math.random()*89999999)}` }));
  Store.set('clients', list);        // 15+
}
function seedSuppliers(){
  if(Store.get('suppliers', null)) return;
  const base=['Tech Import SAC','Global Office SRL','Insumos Perú','MegaPrint S.A.','Redes & Cables EIRL','CompuWorld','ElectroHub','DataStorage Peru','SoftLicenses','Distribuidora Andes','Peru Office','ImpresaCorp','ALM Soluciones','FPS Parts','NovaTech','Zetta Proveedores','ServiCom','Paper&Ink','HardwareMax','AndesNet','Suministros Lima','OfficePlus','PrintExpress','OptiSupply','CloudSoft','MobiAcc','Peru Red','VisionMonitor','ServerParts','TechCity'];
  const list = base.map((n,i)=>({ id:i+1, name:n, ruc:String(20000000000+i), phone:`(01) 4${Math.floor(100000+Math.random()*899999)}`, email:n.toLowerCase().replace(/[^a-z]/g,'.')+'@provee.com' }));
  Store.set('suppliers', list);      // 25+
}

/* ============= CART & BILLING (VENTAS) ============= */
function getCart(){ return Store.get('cart', []); }
function setCart(v){ Store.set('cart', v); }
function clearCart(){ Store.remove('cart'); }
function addToCart(productId, qty=1){
  const cart = getCart(); const f = cart.find(i=>i.productId===productId);
  if(f) f.qty+=qty; else cart.push({productId, qty});
  setCart(cart);
}
function cartItemsDetailed(){
  const prods = Store.get('products', []);
  return getCart().map(i=>{ const p=prods.find(x=>x.id===i.productId); return {...i, name:p?.name, sku:p?.sku, price:p?.price, category:p?.category}; });
}

/* ============= PURCHASE ORDERS (COMPRAS) ============= */
function getPOs(){ return Store.get('purchaseOrders', []); }
function setPOs(v){ Store.set('purchaseOrders', v); }
function poCart(){ return Store.get('poCart', []); }
function setPoCart(v){ Store.set('poCart', v); }
function addToPO(productId, qty=1){
  const cart = poCart(); const f = cart.find(i=>i.productId===productId);
  if(f) f.qty+=qty; else cart.push({productId, qty});
  setPoCart(cart);
}
function submitPO(){
  const items = poCart(); if(!items.length){ alert('No hay items en la orden'); return; }
  const po = { id: Date.now(), date:new Date().toISOString(), items };
  const list = getPOs(); list.push(po); setPOs(list);
  // Impactar inventario
  const prods = Store.get('products', []);
  items.forEach(it=>{ const p=prods.find(x=>x.id===it.productId); if(p) p.stock += it.qty; });
  Store.set('products', prods); setPoCart([]);
  alert('Orden registrada e inventario actualizado');
  if(typeof renderPOCart==='function') renderPOCart();
}

/* ============= CRUD CLIENTES ============= */
function renderClients(){
  const tb = document.getElementById('clientsBody'); if(!tb) return;
  const list = Store.get('clients', []);
  tb.innerHTML = list.map(c=>`
    <tr>
      <td>${c.name}</td><td>${c.email}</td><td>${c.phone}</td>
      <td style="display:flex;gap:8px">
        <button class="btn btn-primary" onclick="editClient(${c.id})">Editar</button>
        <button class="btn btn-danger" onclick="deleteClient(${c.id})">Eliminar</button>
      </td>
    </tr>`).join('');
}
function saveClient(e){
  e.preventDefault();
  const id = Number(e.target.id.value||0);
  const obj = { id:id || Date.now(), name:e.target.name.value, email:e.target.email.value, phone:e.target.phone.value };
  const list = Store.get('clients', []);
  const idx = list.findIndex(x=>x.id===id); if(idx>=0) list[idx]=obj; else list.push(obj);
  Store.set('clients', list); e.target.reset(); renderClients();
}
function editClient(id){
  const c = Store.get('clients', []).find(x=>x.id===id); if(!c) return;
  document.getElementById('clientId').value=c.id;
  document.getElementById('clientName').value=c.name;
  document.getElementById('clientEmail').value=c.email;
  document.getElementById('clientPhone').value=c.phone;
}
function deleteClient(id){
  Store.set('clients', Store.get('clients', []).filter(x=>x.id!==id)); renderClients();
}

/* ============= CRUD PROVEEDORES ============= */
function renderSuppliers(){
  const tb = document.getElementById('suppliersBody'); if(!tb) return;
  const list = Store.get('suppliers', []);
  tb.innerHTML = list.map(s=>`
    <tr>
      <td>${s.name}</td><td>${s.ruc}</td><td>${s.email}</td><td>${s.phone}</td>
      <td style="display:flex;gap:8px">
        <button class="btn btn-primary" onclick="editSupplier(${s.id})">Editar</button>
        <button class="btn btn-danger" onclick="deleteSupplier(${s.id})">Eliminar</button>
      </td>
    </tr>`).join('');
}
function saveSupplier(e){
  e.preventDefault();
  const id = Number(e.target.id.value||0);
  const obj = { id:id || Date.now(), name:e.target.name.value, ruc:e.target.ruc.value, email:e.target.email.value, phone:e.target.phone.value };
  const list = Store.get('suppliers', []);
  const idx = list.findIndex(x=>x.id===id); if(idx>=0) list[idx]=obj; else list.push(obj);
  Store.set('suppliers', list); e.target.reset(); renderSuppliers();
}
function editSupplier(id){
  const s = Store.get('suppliers', []).find(x=>x.id===id); if(!s) return;
  document.getElementById('supplierId').value=s.id;
  document.getElementById('supplierName').value=s.name;
  document.getElementById('supplierRuc').value=s.ruc;
  document.getElementById('supplierEmail').value=s.email;
  document.getElementById('supplierPhone').value=s.phone;
}
function deleteSupplier(id){
  Store.set('suppliers', Store.get('suppliers', []).filter(x=>x.id!==id)); renderSuppliers();
}

/* ============= FACTURACIÓN ============= */
function processSale(){
  const items = cartItemsDetailed();
  if(!items.length){ alert('El carrito está vacío'); return; }
  Store.set('lastSale', { items, date:new Date().toISOString() });
  location.href='facturacion.html';
}
function loadBilling(){
  const sale = Store.get('lastSale', null); if(!sale) return;
  const cfg = Config.get();
  const tbody = document.getElementById('billingItems');
  const totals = document.getElementById('billingTotals');
  tbody.innerHTML = sale.items.map(it=>`
    <tr><td>${it.sku}</td><td>${it.name}</td><td>${it.qty}</td><td>S/. ${it.price.toFixed(2)}</td><td>S/. ${(it.price*it.qty).toFixed(2)}</td></tr>
  `).join('');
  const subtotal = sale.items.reduce((s,i)=>s+i.price*i.qty,0);
  const igv = subtotal*cfg.taxRate; const total=subtotal+igv;
  totals.innerHTML = `
    <tr><td>Subtotal</td><td style="text-align:right">S/. ${subtotal.toFixed(2)}</td></tr>
    <tr><td>IGV (${(cfg.taxRate*100).toFixed(0)}%)</td><td style="text-align:right">S/. ${igv.toFixed(2)}</td></tr>
    <tr><td><strong>Total</strong></td><td style="text-align:right"><strong>S/. ${total.toFixed(2)}</strong></td></tr>`;
}
function emitDocument(type){
  const cfg = Config.get(); const sale = Store.get('lastSale', null);
  if(!sale){ alert('No hay venta cargada'); return; }
  const series = (type==='factura')? cfg.invoiceSeries : cfg.receiptSeries;
  const num = Math.floor(100000 + Math.random()*899999);
  const docNumber = `${series}-${num}`;
  alert(`${type.toUpperCase()} generada: ${docNumber}`);
  clearCart(); Store.remove('lastSale'); location.href='index.html';
}

/* ============= RENDER SALES (productos por categoría) ============= */
function renderSalesProducts(){
  const cont = document.getElementById('salesProducts'); if(!cont) return;
  const grouped = Store.get('products', []).reduce((a,p)=>(a[p.category]??=[],a[p.category].push(p),a),{});
  cont.innerHTML='';
  Object.keys(grouped).sort().forEach(cat=>{
    const items = grouped[cat].map(p=>`
      <li class="flex justify-between items-center" style="padding:10px 0; border-bottom:1px solid var(--line);">
        <div>
          <div style="font-weight:700">${p.name}</div>
          <div style="color:var(--muted); font-size:13px;">SKU: ${p.sku} • S/. ${p.price.toFixed(2)} • Stock: ${p.stock}</div>
        </div>
        <button class="btn btn-primary" onclick="addToCart(${p.id},1)">Agregar</button>
      </li>`).join('');
    cont.insertAdjacentHTML('beforeend', `
      <div class="card">
        <h3 style="margin:0 0 8px 0; font-size:18px; font-weight:800">${cat}</h3>
        <ul>${items}</ul>
      </div>`);
  });
}

/* ============= CARRITO (VENTAS) UI ============= */
function renderCart(){
  const list = document.getElementById('cartList'); const totals = document.getElementById('cartTotals');
  if(!list||!totals) return;
  const cfg = Config.get(); const items = cartItemsDetailed();
  list.innerHTML = items.map(it=>`
    <li class="flex justify-between items-center" style="padding:10px 0; border-bottom:1px solid var(--line);">
      <div>
        <div style="font-weight:700">${it.name}</div>
        <div style="color:var(--muted); font-size:13px;">S/. ${it.price.toFixed(2)} x ${it.qty}</div>
      </div>
      <div style="display:flex; gap:6px">
        <button class="btn btn-gray" onclick="updateQty(${it.productId},-1)">-</button>
        <button class="btn btn-gray" onclick="updateQty(${it.productId},1)">+</button>
        <button class="btn btn-danger" onclick="removeItem(${it.productId})">x</button>
      </div>
    </li>`).join('');
  const subtotal = items.reduce((s,i)=>s+i.price*i.qty,0);
  const igv = subtotal*cfg.taxRate; const total=subtotal+igv;
  totals.innerHTML = `
    <p class="flex justify-between"><span>Subtotal:</span><span>S/. ${subtotal.toFixed(2)}</span></p>
    <p class="flex justify-between"><span>IGV (${(cfg.taxRate*100).toFixed(0)}%):</span><span>S/. ${igv.toFixed(2)}</span></p>
    <p class="flex justify-between" style="font-weight:800"><span>Total:</span><span>S/. ${total.toFixed(2)}</span></p>`;
}
function updateQty(pid, d){
  const cart = getCart(); const it = cart.find(x=>x.productId===pid); if(!it) return;
  it.qty+=d; if(it.qty<=0) cart.splice(cart.indexOf(it),1); setCart(cart); renderCart();
}
function removeItem(pid){ setCart(getCart().filter(x=>x.productId!==pid)); renderCart(); }

/* ============= COMPRAS UI ============= */
function renderPOCart(){
  const list = document.getElementById('poCart'); if(!list) return;
  const prods = Store.get('products', []);
  const items = poCart().map(it=>{ const p=prods.find(x=>x.id===it.productId); return {...it, name:p?.name, sku:p?.sku}; });
  list.innerHTML = items.map(it=>`
    <li class="flex justify-between items-center" style="padding:10px 0; border-bottom:1px solid var(--line);">
      <div><div style="font-weight:700">${it.name}</div><div style="color:var(--muted); font-size:13px;">${it.sku} x ${it.qty}</div></div>
      <div style="display:flex; gap:6px">
        <button class="btn btn-gray" onclick="changePOQty(${it.productId},-1)">-</button>
        <button class="btn btn-gray" onclick="changePOQty(${it.productId},1)">+</button>
        <button class="btn btn-danger" onclick="removePOItem(${it.productId})">x</button>
      </div>
    </li>`).join('');
}
function changePOQty(pid, d){
  const cart = poCart(); const it = cart.find(x=>x.productId===pid); if(!it) return;
  it.qty+=d; if(it.qty<=0) cart.splice(cart.indexOf(it),1); setPoCart(cart); renderPOCart();
}
function removePOItem(pid){ setPoCart(poCart().filter(x=>x.productId!==pid)); renderPOCart(); }

/* ============= REPORTES ============= */
function buildReportData(type){
  const products = Store.get('products', []), clients=Store.get('clients', []), suppliers=Store.get('suppliers', []);
  if(type==='inventario') return products.map(p=>({SKU:p.sku, Producto:p.name, Categoria:p.category, Stock:p.stock, Precio:p.price}));
  if(type==='clientes') return clients.map(c=>({Nombre:c.name, Email:c.email, Tel:c.phone}));
  if(type==='proveedores') return suppliers.map(s=>({Nombre:s.name, RUC:s.ruc, Email:s.email, Tel:s.phone}));
  if(type==='compras'){
    const pos=getPOs();
    return pos.flatMap(po=>po.items.map(i=>({PO:po.id, ProductID:i.productId, Cantidad:i.qty})));
  }
  if(type==='ventas'){
    const sale = Store.get('lastSale', null);
    return sale? sale.items.map(i=>({SKU:i.sku, Producto:i.name, Cantidad:i.qty, Precio:i.price, Total:(i.price*i.qty).toFixed(2)})) : [];
  }
  return [];
}
function exportExcel(type){
  const data = buildReportData(type); if(!data.length){ alert('No hay datos'); return; }
  const ws = XLSX.utils.json_to_sheet(data), wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, type); XLSX.writeFile(wb, `reporte_${type}.xlsx`);
}
function exportPDF(type){
  const data = buildReportData(type); if(!data.length){ alert('No hay datos'); return; }
  const { jsPDF } = window.jspdf; const doc = new jsPDF({unit:'pt', format:'a4'});
  doc.setFontSize(15); doc.text(`Reporte: ${type.toUpperCase()}`, 40, 40);
  let y=70; const headers=Object.keys(data[0]); doc.setFontSize(10); doc.text(headers.join(' | '), 40, y); y+=14;
  data.forEach(r=>{ const line=headers.map(h=>String(r[h])).join(' | '); if(y>780){ doc.addPage(); y=40; } doc.text(line, 40, y); y+=14; });
  doc.save(`reporte_${type}.pdf`);
}

/* ============= CHARTS (altura fija + maintainAspectRatio) ============= */
function initCharts(){
  const s = document.getElementById('salesChart');
  if(s){ new Chart(s.getContext('2d'), { type:'line',
    data:{ labels:['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'],
      datasets:[{label:'Ventas', data:[1200,1900,1500,2300,2000,2500,1800], borderColor:'#36D399', backgroundColor:'rgba(54,211,153,.12)', tension:.3, borderWidth:2, fill:true}]},
    options:{ responsive:true, maintainAspectRatio:true, plugins:{legend:{display:false}}, scales:{y:{beginAtZero:true}} } }); }
  const p = document.getElementById('paymentChart');
  if(p){ new Chart(p.getContext('2d'), { type:'doughnut', data:{labels:['Efectivo','Tarjeta','Transferencia'], datasets:[{data:[55,30,15]}]},
    options:{responsive:true, maintainAspectRatio:true, plugins:{legend:{position:'bottom'}}}}); }
  const m = document.getElementById('monthlySalesChart');
  if(m){ new Chart(m.getContext('2d'), { type:'bar', data:{labels:['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'],
      datasets:[{label:'Ventas', data:[12000,15000,18000,16000,21000,19000,22000,23000,25000,24000,26000,28000], backgroundColor:'#60A5FA'}]},
    options:{responsive:true, maintainAspectRatio:true, scales:{y:{beginAtZero:true}}, plugins:{legend:{display:false}}}}); }
}

/* ============= COMMON BOOT ============= */
function mountSidebarUser(){
  const u = Auth.current(); const box = document.querySelector('.sidebar-footer'); if(!u||!box) return;
  box.innerHTML = `
    <div class="u">
      <img src="https://ui-avatars.com/api/?background=0B1B2B&color=fff&name=${encodeURIComponent(u.username)}" width="30" height="30" style="border-radius:9999px;">
      <div><div class="name">${u.name}</div><div class="tag">@${u.username}</div></div>
    </div>
    <button id="btnLogout" title="Cerrar sesión"><i data-feather="log-out"></i><span>Salir</span></button>`;
  feather.replace(); document.getElementById('btnLogout').onclick = ()=>Auth.logout();
}

function boot(){
  seedProducts(); seedClients(); seedSuppliers();
  feather.replace(); mountSidebarUser();
}
document.addEventListener('DOMContentLoaded', boot);
</script>
