// --- CONFIGURACIÓN DE FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyB4eg-yFaE9FQe9dB3WNeOj9JjWMd9Etzk",
  authDomain: "control-caja-ultra.firebaseapp.com",
  projectId: "control-caja-ultra",
  storageBucket: "control-caja-ultra.firebasestorage.app",
  messagingSenderId: "76362765432",
  appId: "1:76362765432:web:1e44c161254bec0de7898d"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();
const auth = firebase.auth();

window.currentUID = null;
window.currentUsername = "";

// ==========================================
// MÓDULO DE AUTENTICACIÓN Y REGISTRO
// ==========================================
let isRegisterMode = false;

function toggleAuthMode() {
  isRegisterMode = !isRegisterMode;
  const subtitle = document.getElementById('authSubtitle');
  const btnSubmit = document.getElementById('btnAuthSubmit');
  const btnToggle = document.getElementById('btnToggleAuthMode');
  const warningBox = document.getElementById('authWarningBox');

  if (isRegisterMode) {
    subtitle.textContent = "Creá tu cuenta y contraseña de administrador por primera vez";
    btnSubmit.textContent = "Registrarme y Configurar";
    btnToggle.textContent = "¿Ya tenés cuenta? Iniciá sesión acá";
    if (warningBox) warningBox.style.display = 'block';
  } else {
    subtitle.textContent = "Ingresá con tu cuenta para gestionar tu negocio";
    btnSubmit.textContent = "Iniciar Sesión";
    btnToggle.textContent = "¿No tenés cuenta? Registrate acá";
    if (warningBox) warningBox.style.display = 'none';
  }
}

async function handleAuth(e) {
  e.preventDefault();
  const usernameInput = document.getElementById('authUsername').value.trim().toLowerCase();
  const passwordInput = document.getElementById('authPassword').value;

  if (!usernameInput || !passwordInput) {
    alert("Por favor, completa todos los campos.");
    return;
  }

  const emailSimulado = `${usernameInput}@controlcaja.com`;

  try {
    if (isRegisterMode) {
      const userCredential = await auth.createUserWithEmailAndPassword(emailSimulado, passwordInput);
      const uid = userCredential.user.uid;

      await db.collection("licenses").doc(uid).set({
        username: usernameInput,
        createdAt: new Date().getTime(),
        expirationDate: new Date().getTime() + (3 * 24 * 60 * 60 * 1000), // 3 días de prueba
        status: 'trial'
      });

      alert("¡Cuenta creada con éxito! Recordá guardar bien tu contraseña.");
    } else {
      await auth.signInWithEmailAndPassword(emailSimulado, passwordInput);
    }
  } catch (err) {
    console.error("Error de autenticación:", err);
    if (err.code === 'auth/email-already-in-use') {
      alert("El nombre de usuario ya está registrado. Probá iniciando sesión.");
    } else if (err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
      alert("Usuario o contraseña incorrectos.");
    } else {
      alert("Error al autenticar: " + err.message);
    }
  }
}

function cerrarSesion() {
  auth.signOut().then(() => {
    location.reload();
  });
}

// Función para actualizar el enlace de WhatsApp con el titular de la transferencia
function actualizarEnlaceWhatsAppRenovacion() {
  const btnRenovarWA = document.getElementById('btnRenovarWA');
  if (!btnRenovarWA) return;

  const inputTitular = document.getElementById('inputTitularPago');
  const titular = inputTitular ? inputTitular.value.trim() : "";
  const nombreNegocio = window.currentUsername || "Desconocido";

  const titularTexto = titular ? titular : "[Falta indicar titular]";
  const text = `Hola! Ya realicé el pago de mi suscripción de Control De Caja Ultra.\n\nNegocio: *${nombreNegocio}*\nTitular de la cuenta que pagó: *${titularTexto}*`;
  
  btnRenovarWA.href = `https://api.whatsapp.com/send?phone=5493755449964&text=${encodeURIComponent(text)}`;
}

document.addEventListener('input', (e) => {
  if (e.target && e.target.id === 'inputTitularPago') {
    actualizarEnlaceWhatsAppRenovacion();
  }
});

// Control de sesión y despliegue del selector de rol
auth.onAuthStateChanged(async (user) => {
  const authScreen = document.getElementById('authScreen');
  const roleScreen = document.getElementById('roleScreen');
  const mainApp = document.getElementById('mainApp');
  const lockScreen = document.getElementById('lockScreen');

  if (user) {
    window.currentUID = user.uid;
    
    const docRef = db.collection("licenses").doc(user.uid);
    const docSnap = await docRef.get();

    if (docSnap.exists) {
      const data = docSnap.data();
      window.currentUsername = data.username || "comercio";

      const nowMs = new Date().getTime();
      const expireTime = data.expirationDate || nowMs;
      const diffMs = expireTime - nowMs;
      const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      const userAccountName = document.getElementById('userAccountName');
      if (userAccountName) userAccountName.textContent = window.currentUsername;

      // Actualizar enlace inicial de WhatsApp para renovación
      actualizarEnlaceWhatsAppRenovacion();

      if (diffMs <= 0) {
        authScreen.style.display = 'none';
        roleScreen.style.display = 'none';
        mainApp.style.display = 'none';
        lockScreen.style.display = 'flex';
      } else {
        authScreen.style.display = 'none';
        lockScreen.style.display = 'none';
        mainApp.style.display = 'none';
        if (roleScreen) roleScreen.style.display = 'flex';

        const trialBadge = document.getElementById('trialBadge');
        if (trialBadge) {
          if (data.status === 'trial') {
            trialBadge.textContent = `⏳ Prueba Gratuita: queda${daysLeft === 1 ? '' : 'n'} ${daysLeft} día${daysLeft === 1 ? '' : 's'}`;
            trialBadge.style.backgroundColor = '#fef7e0';
            trialBadge.style.color = '#b06000';
          } else {
            trialBadge.textContent = `✅ Suscripción Activa: queda${daysLeft === 1 ? '' : 'n'} ${daysLeft} día${daysLeft === 1 ? '' : 's'}`;
            trialBadge.style.backgroundColor = '#e6f4ea';
            trialBadge.style.color = '#137333';
          }
        }

        loadProductsForCashier();
        sincronizarMovimientosCloud();
        sincronizarCierresCloud();
      }
    }
  } else {
    window.currentUID = null;
    if (authScreen) authScreen.style.display = 'flex';
    if (roleScreen) roleScreen.style.display = 'none';
    if (mainApp) mainApp.style.display = 'none';
    if (lockScreen) lockScreen.style.display = 'none';
  }
});

// ==========================================
// SELECCIÓN DE PERFIL (CAJERO VS ADMIN)
// ==========================================
function seleccionarRolCajero() {
  document.getElementById('roleScreen').style.display = 'none';
  document.getElementById('mainApp').style.display = 'block';

  const navTabs = document.querySelector('.nav-tabs');
  if (navTabs) navTabs.style.display = 'none';

  switchTab('caja');
}

async function seleccionarRolAdmin() {
  const passwordIngresada = prompt("🔒 Ingrese la Contraseña de Administrador (Dueño):");
  if (!passwordIngresada) return;

  try {
    const emailSimulado = `${window.currentUsername}@controlcaja.com`;
    await auth.signInWithEmailAndPassword(emailSimulado, passwordIngresada);
    
    document.getElementById('roleScreen').style.display = 'none';
    document.getElementById('mainApp').style.display = 'block';

    const navTabs = document.querySelector('.nav-tabs');
    if (navTabs) navTabs.style.display = 'flex';

    switchTab('caja');
    loadProducts();
  } catch (err) {
    alert("❌ Contraseña de administrador incorrecta.");
  }
}

// ==========================================
// SEGURIDAD: CONTRASEÑA PARA BORRAR / ACCIONES
// ==========================================
async function solicitarPasswordAdmin(accionAutorizada) {
  const passwordIngresada = prompt("🔒 Ingrese la Contraseña de Administrador (Dueño):");
  if (!passwordIngresada) return;

  try {
    const emailSimulado = `${window.currentUsername}@controlcaja.com`;
    await auth.signInWithEmailAndPassword(emailSimulado, passwordIngresada);
    accionAutorizada();
  } catch (err) {
    alert("❌ Contraseña de administrador incorrecta.");
  }
}

function intentarCierreCaja() {
  solicitarPasswordAdmin(() => {
    ejecutarCierreCajaReal();
  });
}

function intentarLimpiarHistorial() {
  solicitarPasswordAdmin(() => {
    limpiarHistorialReal();
  });
}

// ==========================================
// MÓDULO DE PESTAÑAS
// ==========================================
function switchTab(tab) {
  const secCaja = document.getElementById('sectionCaja');
  const secCatalogo = document.getElementById('sectionCatalogo');
  const secHistorial = document.getElementById('sectionHistorial');

  const btnCaja = document.getElementById('btnTabCaja');
  const btnCatalogo = document.getElementById('btnTabCatalogo');
  const btnHistorial = document.getElementById('btnTabHistorial');

  if (!secCaja || !secCatalogo || !secHistorial) return;

  [btnCaja, btnCatalogo, btnHistorial].forEach(btn => {
    if (btn) {
      btn.className = 'btn btn-secondary';
      btn.style.background = '#333';
      btn.style.color = '#ccc';
    }
  });

  secCaja.style.display = 'none';
  secCatalogo.style.display = 'none';
  secHistorial.style.display = 'none';

  if (tab === 'caja') {
    secCaja.style.display = 'block';
    if (btnCaja) {
      btnCaja.className = 'btn btn-primary';
      btnCaja.style.background = '';
      btnCaja.style.color = '#fff';
    }
  } else if (tab === 'catalogo') {
    secCatalogo.style.display = 'block';
    if (btnCatalogo) {
      btnCatalogo.className = 'btn btn-primary';
      btnCatalogo.style.background = '';
      btnCatalogo.style.color = '#fff';
    }
    loadProducts();
  } else if (tab === 'historial') {
    secHistorial.style.display = 'block';
    if (btnHistorial) {
      btnHistorial.className = 'btn btn-primary';
      btnHistorial.style.background = '';
      btnHistorial.style.color = '#fff';
    }
  }
}

// ==========================================
// PRODUCTOS Y STOCK
// ==========================================
function calcularPrecioVentaAutomatico() {
  const costInput = parseFloat(document.getElementById('prodCost').value) || 0;
  const marginInput = parseFloat(document.getElementById('prodMargin').value) || 0;
  const priceInput = document.getElementById('prodPrice');

  if (costInput > 0) {
    const precioFinal = costInput + (costInput * (marginInput / 100));
    priceInput.value = Math.round(precioFinal * 100) / 100;
  }
}

window.inventarioProductosCache = [];

function loadProducts() {
  if (!window.currentUID) return;

  db.collection('licenses').doc(window.currentUID).collection('products')
    .onSnapshot((snapshot) => {
      window.inventarioProductosCache = [];
      snapshot.forEach((doc) => {
        window.inventarioProductosCache.push({ id: doc.id, ...doc.data() });
      });

      const searchInput = document.getElementById('searchInventory');
      const query = searchInput ? searchInput.value.trim().toLowerCase() : '';
      
      if (query) {
        const filtrados = window.inventarioProductosCache.filter(p => p.name.toLowerCase().includes(query));
        renderizarTablaInventario(filtrados);
      } else {
        renderizarTablaInventario(window.inventarioProductosCache);
      }
    });
}

function loadProductsForCashier() {
  if (!window.currentUID) return;

  db.collection('licenses').doc(window.currentUID).collection('products')
    .onSnapshot((snapshot) => {
      window.inventarioProductosCache = [];
      snapshot.forEach((doc) => {
        window.inventarioProductosCache.push({ id: doc.id, ...doc.data() });
      });
    });
}

function renderizarTablaInventario(productos) {
  const list = document.getElementById('productList');
  if (!list) return;
  list.innerHTML = '';

  if (productos.length === 0) {
    list.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #888;">No se encontraron productos.</td></tr>`;
    return;
  }

  productos.forEach((p) => {
    const costoStr = p.cost ? `$${Number(p.cost).toLocaleString('es-AR')}` : '-';
    const margenStr = p.margin ? `${p.margin}%` : '-';

    list.innerHTML += `
      <tr>
        <td><strong>${p.name}</strong></td>
        <td><small style="color: #64748b;">Costo: ${costoStr}<br>Ganancia: ${margenStr}</small></td>
        <td><strong class="text-success">$${Number(p.price).toLocaleString('es-AR')}</strong></td>
        <td><span class="badge ${p.stock > 0 ? 'text-success' : 'text-danger'}">${p.stock}</span></td>
        <td style="text-align: right; display: flex; gap: 5px; justify-content: flex-end;">
          <button onclick="editProduct('${p.id}', '${p.name.replace(/'/g, "\\'")}', ${p.price || 0}, ${p.stock || 0}, ${p.cost || 0}, ${p.margin || 30})" class="btn btn-primary" style="padding: 4px 8px; font-size: 0.8rem;">✏️ Editar</button>
          <button onclick="deleteProduct('${p.id}')" class="btn btn-danger-soft" style="padding: 4px 8px; font-size: 0.8rem;">🗑️ Eliminar</button>
        </td>
      </tr>
    `;
  });
}

function filtrarInventario(texto) {
  const query = texto.trim().toLowerCase();
  if (!query) {
    renderizarTablaInventario(window.inventarioProductosCache);
    return;
  }
  const filtrados = window.inventarioProductosCache.filter(p => p.name.toLowerCase().includes(query));
  renderizarTablaInventario(filtrados);
}

window.precioUnitarioSeleccionado = 0;

function filtrarProductosSugeridos(texto) {
  const box = document.getElementById('sugerenciasBox');
  if (!box) return;

  const query = texto.trim().toLowerCase();
  if (query === '' || window.inventarioProductosCache.length === 0) {
    box.style.display = 'none';
    box.innerHTML = '';
    return;
  }

  const matches = window.inventarioProductosCache.filter(p => p.name.toLowerCase().includes(query));
  if (matches.length === 0) {
    box.style.display = 'none';
    box.innerHTML = '';
    return;
  }

  box.innerHTML = '';
  matches.forEach(prod => {
    const item = document.createElement('div');
    item.style.padding = '12px 14px';
    item.style.cursor = 'pointer';
    item.style.borderBottom = '1px solid #eee';
    item.style.display = 'flex';
    item.style.justifyContent = 'space-between';
    item.style.alignItems = 'center';
    item.style.color = '#333';
    item.style.background = '#fff';

    item.innerHTML = `
      <div>
        <strong>${prod.name}</strong><br>
        <small style="color: #666;">Stock: ${prod.stock}</small>
      </div>
      <div style="color: #0066cc; font-weight: bold; font-size: 1.05rem;">
        $${Number(prod.price).toLocaleString('es-AR')}
      </div>
    `;

    item.addEventListener('mousedown', (e) => {
      e.preventDefault();
      document.getElementById('movDesc').value = prod.name;
      window.precioUnitarioSeleccionado = Number(prod.price);
      const qty = parseInt(document.getElementById('movQty').value) || 1;
      document.getElementById('movAmount').value = window.precioUnitarioSeleccionado * qty;
      box.style.display = 'none';
      box.innerHTML = '';
    });

    box.appendChild(item);
  });

  box.style.display = 'block';
}

document.addEventListener('click', (e) => {
  const box = document.getElementById('sugerenciasBox');
  const input = document.getElementById('movDesc');
  if (box && input && !input.contains(e.target) && !box.contains(e.target)) {
    box.style.display = 'none';
  }
});

function actualizarMontoPorCantidad() {
  const qty = parseInt(document.getElementById('movQty').value) || 1;
  const movAmountInput = document.getElementById('movAmount');
  if (window.precioUnitarioSeleccionado > 0) {
    movAmountInput.value = window.precioUnitarioSeleccionado * qty;
  }
}

function editProduct(id, name, price, stock, cost = 0, margin = 30) {
  document.getElementById('editProductId').value = id;
  document.getElementById('prodName').value = name;
  document.getElementById('prodCost').value = cost > 0 ? cost : '';
  document.getElementById('prodMargin').value = margin;
  document.getElementById('prodPrice').value = price;
  document.getElementById('prodStock').value = stock;
  
  document.getElementById('formProductTitle').textContent = '✏️ Modificar Producto';
  document.getElementById('btnSaveProduct').textContent = '💾 Actualizar Cambios';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function saveProduct(e) {
  e.preventDefault();
  if (!window.currentUID) return;

  const editId = document.getElementById('editProductId').value;
  const name = document.getElementById('prodName').value.trim();
  const cost = parseFloat(document.getElementById('prodCost').value) || 0;
  const margin = parseFloat(document.getElementById('prodMargin').value) || 0;
  const price = parseFloat(document.getElementById('prodPrice').value);
  const stock = parseInt(document.getElementById('prodStock').value);

  if (!name || isNaN(price) || isNaN(stock)) return;

  try {
    const productsRef = db.collection('licenses').doc(window.currentUID).collection('products');
    const productoData = {
      name, cost, margin, price, stock,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    if (editId) {
      await productsRef.doc(editId).update(productoData);
      alert('¡Producto actualizado con éxito!');
    } else {
      productoData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      await productsRef.add(productoData);
    }

    document.getElementById('formProduct').reset();
    document.getElementById('editProductId').value = '';
    document.getElementById('prodMargin').value = '30';
    document.getElementById('formProductTitle').textContent = '📦 Agregar Producto';
    document.getElementById('btnSaveProduct').textContent = '💾 Guardar Producto';
  } catch (err) {
    console.error("Error al guardar producto:", err);
    alert("Hubo un error al guardar el producto.");
  }
}

async function deleteProduct(id) {
  if (!confirm('¿Seguro que deseas eliminar este producto del catálogo?')) return;
  if (!window.currentUID) return;

  try {
    await db.collection('licenses').doc(window.currentUID).collection('products').doc(id).delete();
  } catch (err) {
    console.error("Error al eliminar producto:", err);
  }
}

async function descontarStockCantidad(nombreProducto, cantidadVenta) {
  if (!window.currentUID || !nombreProducto) return;

  try {
    const productsRef = db.collection('licenses').doc(window.currentUID).collection('products');
    const snapshot = await productsRef.get();

    snapshot.forEach(async (docSnap) => {
      const prod = docSnap.data();
      if (prod.name.trim().toLowerCase() === nombreProducto.trim().toLowerCase()) {
        const stockActual = Number(prod.stock) || 0;
        const nuevoStock = Math.max(0, stockActual - cantidadVenta);
        await productsRef.doc(docSnap.id).update({ stock: nuevoStock });
      }
    });
  } catch (err) {
    console.error("Error al sincronizar el stock:", err);
  }
}

// ==========================================
// CARRITO Y MOVIMIENTOS EN TIEMPO REAL (NUBE)
// ==========================================
let carritoVenta = [];
let movements = [];
let closedDays = [];

function sincronizarMovimientosCloud() {
  if (!window.currentUID) return;

  db.collection('licenses').doc(window.currentUID).collection('movements')
    .orderBy('timestamp', 'desc')
    .onSnapshot((snapshot) => {
      movements = [];
      snapshot.forEach((doc) => {
        movements.push({ id: doc.id, ...doc.data() });
      });
      renderMovements();
      calculateMonthlySummary();
    });
}

function sincronizarCierresCloud() {
  if (!window.currentUID) return;

  db.collection('licenses').doc(window.currentUID).collection('closedDays')
    .orderBy('timestamp', 'desc')
    .onSnapshot((snapshot) => {
      closedDays = [];
      snapshot.forEach((doc) => {
        closedDays.push({ id: doc.id, ...doc.data() });
      });
      renderClosedDays();
      initMonthSelector();
    });
}

function agregarItemAlCarrito() {
  const desc = document.getElementById('movDesc').value.trim();
  const qty = parseInt(document.getElementById('movQty').value) || 1;
  const amountInput = parseFloat(document.getElementById('movAmount').value);
  const type = document.getElementById('movType').value;

  if (!desc || isNaN(amountInput) || amountInput <= 0 || qty <= 0) {
    alert('Por favor, ingresa un producto, cantidad y un monto válido.');
    return;
  }

  carritoVenta.push({
    desc: desc,
    qty: qty,
    amount: amountInput,
    type: type,
    subtotal: amountInput
  });

  document.getElementById('movDesc').value = '';
  document.getElementById('movQty').value = '1';
  document.getElementById('movAmount').value = '';
  window.precioUnitarioSeleccionado = 0;
  
  const box = document.getElementById('sugerenciasBox');
  if (box) box.style.display = 'none';

  renderizarCarrito();
}

function renderizarCarrito() {
  const container = document.getElementById('ticketContainer');
  const list = document.getElementById('carritoList');
  const lblTotal = document.getElementById('lblCarritoTotal');

  if (!container || !list || !lblTotal) return;

  if (carritoVenta.length === 0) {
    container.style.display = 'none';
    list.innerHTML = '';
    lblTotal.textContent = '$0';
    return;
  }

  container.style.display = 'block';
  list.innerHTML = '';
  let totalGeneral = 0;

  carritoVenta.forEach((item, index) => {
    totalGeneral += item.subtotal;
    const sign = item.type === 'income' ? '+' : '-';
    
    const tr = document.createElement('tr');
    tr.style.borderBottom = '1px dashed #ddd';
    tr.innerHTML = `
      <td style="padding: 8px 4px; color: #1f2937 !important; font-size: 0.9rem; text-align: left; width: 70%;">
        <span style="color: #0284c7; font-weight: bold; margin-right: 4px;">${item.qty}x</span> 
        <span style="color: #1f2937; font-weight: 600;">${item.desc}</span>
      </td>
      <td style="padding: 8px 4px; text-align: right; color: #16a34a !important; font-weight: bold; font-size: 0.95rem; width: 25%;">
        ${sign}$${Number(item.subtotal).toLocaleString('es-AR')}
      </td>
      <td style="padding: 8px 4px; text-align: right; width: 5%;">
        <button type="button" onclick="eliminarItemCarrito(${index})" style="background:none; border:none; color:#dc2626; cursor:pointer; font-size:1rem; padding:0 4px;" title="Quitar">❌</button>
      </td>
    `;
    list.appendChild(tr);
  });

  lblTotal.textContent = `$${totalGeneral.toLocaleString('es-AR')}`;
}

function eliminarItemCarrito(index) {
  carritoVenta.splice(index, 1);
  renderizarCarrito();
}

document.addEventListener('DOMContentLoaded', () => {
  const btnAddMov = document.getElementById('btnAddMov');
  const movDescInput = document.getElementById('movDesc');
  const movQtyInput = document.getElementById('movQty');
  const movAmountInput = document.getElementById('movAmount');
  const movTypeSelect = document.getElementById('movType');

  if (btnAddMov) {
    btnAddMov.addEventListener('click', async () => {
      if (!window.currentUID) return;

      if (carritoVenta.length > 0) {
        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        for (const item of carritoVenta) {
          const detalleTexto = item.qty > 1 ? `${item.desc} (x${item.qty})` : item.desc;
          
          await db.collection('licenses').doc(window.currentUID).collection('movements').add({
            desc: detalleTexto,
            amount: item.amount,
            type: item.type,
            time: timeStr,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
          });

          if (item.type === 'income') {
            descontarStockCantidad(item.desc, item.qty);
          }
        }

        carritoVenta = [];
        renderizarCarrito();
        return;
      }

      const desc = movDescInput.value.trim();
      const qty = parseInt(movQtyInput.value) || 1;
      const amount = parseFloat(movAmountInput.value);
      const type = movTypeSelect.value;

      if (!desc || isNaN(amount) || amount <= 0 || qty <= 0) {
        alert('Por favor, agrega productos al carrito o completa los campos para registrar un movimiento.');
        return;
      }

      const detalleTexto = qty > 1 ? `${desc} (x${qty})` : desc;
      
      await db.collection('licenses').doc(window.currentUID).collection('movements').add({
        desc: detalleTexto,
        amount: amount,
        type: type,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      });
      
      if (type === 'income') {
        descontarStockCantidad(desc, qty);
      }
      
      movDescInput.value = '';
      movQtyInput.value = '1';
      movAmountInput.value = '';
      window.precioUnitarioSeleccionado = 0;
    });
  }
});

function renderMovements() {
  const movList = document.getElementById('movList');
  const lblTotalIncome = document.getElementById('lblTotalIncome');
  const lblTotalExpense = document.getElementById('lblTotalExpense');
  const lblNetBalance = document.getElementById('lblNetBalance');

  if (!movList) return;
  movList.innerHTML = '';
  let totalIncome = 0;
  let totalExpense = 0;

  if (movements.length === 0) {
    movList.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#999;">Sin movimientos registrados hoy</td></tr>';
    lblTotalIncome.textContent = '$0';
    lblTotalExpense.textContent = '$0';
    lblNetBalance.textContent = '$0';
    return;
  }

  movements.forEach((mov) => {
    if (mov.type === 'income') totalIncome += mov.amount;
    else totalExpense += mov.amount;

    const tr = document.createElement('tr');
    const amountClass = mov.type === 'income' ? 'text-success' : 'text-danger';
    const sign = mov.type === 'income' ? '+' : '-';

    tr.innerHTML = `
      <td><strong>${mov.desc}</strong><br><small>${mov.time || ''}</small></td>
      <td>${mov.type === 'income' ? 'Ingreso' : 'Gasto'}</td>
      <td style="text-align: right;" class="${amountClass}"><strong>${sign}$${Number(mov.amount).toLocaleString('es-AR')}</strong></td>
      <td><button class="btn btn-danger" onclick="intentarBorrarMovimiento('${mov.id}')" title="Requiere Contraseña de Administrador">🗑️ 🔒</button></td>
    `;
    movList.appendChild(tr);
  });

  let net = totalIncome - totalExpense;
  lblTotalIncome.textContent = `$${totalIncome.toLocaleString('es-AR')}`;
  lblTotalExpense.textContent = `$${totalExpense.toLocaleString('es-AR')}`;
  lblNetBalance.textContent = `$${net.toLocaleString('es-AR')}`;
  lblNetBalance.className = net >= 0 ? 'text-success' : 'text-danger';
}

window.intentarBorrarMovimiento = (id) => {
  solicitarPasswordAdmin(async () => {
    try {
      await db.collection('licenses').doc(window.currentUID).collection('movements').doc(id).delete();
      alert("✅ Venta eliminada correctamente.");
    } catch (err) {
      console.error("Error al borrar movimiento:", err);
    }
  });
};

async function ejecutarCierreCajaReal() {
  if (movements.length === 0) {
    alert('No hay movimientos registrados hoy para cerrar.');
    return;
  }

  let totalIncome = 0;
  let totalExpense = 0;

  movements.forEach(m => {
    if (m.type === 'income') totalIncome += m.amount;
    else totalExpense += m.amount;
  });

  let net = totalIncome - totalExpense;
  let dateStr = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });

  try {
    await db.collection('licenses').doc(window.currentUID).collection('closedDays').add({
      date: dateStr,
      income: totalIncome,
      expense: totalExpense,
      net: net,
      items: [...movements],
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });

    const batch = db.batch();
    const movsRef = db.collection('licenses').doc(window.currentUID).collection('movements');
    const snapshot = await movsRef.get();
    snapshot.forEach((doc) => {
      batch.delete(doc.ref);
    });
    await batch.commit();

    alert('¡Cierre de caja guardado con éxito!');
  } catch (err) {
    console.error("Error al ejecutar cierre de caja:", err);
    alert("Hubo un error al realizar el cierre.");
  }
}

function renderClosedDays() {
  const closedDaysList = document.getElementById('closedDaysList');
  if (!closedDaysList) return;
  closedDaysList.innerHTML = '';
  
  if (closedDays.length === 0) {
    closedDaysList.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#999;">Sin cierres anteriores guardados</td></tr>';
    return;
  }

  closedDays.forEach((day) => {
    const tr = document.createElement('tr');
    const netClass = day.net >= 0 ? 'text-success' : 'text-danger';
    const sign = day.net >= 0 ? '+' : '';

    tr.innerHTML = `
      <td><strong>📅 ${day.date}</strong> <br><small style="color:#0066cc;">Ver detalle 🔍</small></td>
      <td><small>➕ $${(day.income || 0).toLocaleString('es-AR')}</small><br><small>➖ $${(day.expense || 0).toLocaleString('es-AR')}</small></td>
      <td style="text-align: right;" class="${netClass}"><strong>${sign}$${(day.net || 0).toLocaleString('es-AR')}</strong></td>
      <td><button class="btn btn-danger-soft" onclick="event.stopPropagation(); deleteClosedDay('${day.id}')">x</button></td>
    `;

    tr.addEventListener('click', () => {
      openDayDetail(day);
    });

    closedDaysList.appendChild(tr);
  });
}

function openDayDetail(day) {
  const dayModal = document.getElementById('dayModal');
  const modalTitle = document.getElementById('modalTitle');
  const modalMovList = document.getElementById('modalMovList');

  if (!modalTitle || !modalMovList || !dayModal) return;
  modalTitle.textContent = `Detalle del Cierre - ${day.date}`;
  modalMovList.innerHTML = '';

  if (!day.items || day.items.length === 0) {
    modalMovList.innerHTML = '<tr><td colspan="3" style="text-align:center; color:#999;">No hay movimientos detallados guardados para este día.</td></tr>';
  } else {
    day.items.forEach(item => {
      const tr = document.createElement('tr');
      const amountClass = item.type === 'income' ? 'text-success' : 'text-danger';
      const sign = item.type === 'income' ? '+' : '-';
      tr.innerHTML = `
        <td><strong>${item.desc}</strong><br><small>${item.time || ''}</small></td>
        <td>${item.type === 'income' ? 'Ingreso' : 'Gasto'}</td>
        <td style="text-align: right;" class="${amountClass}"><strong>${sign}$${Number(item.amount).toLocaleString('es-AR')}</strong></td>
      `;
      modalMovList.appendChild(tr);
    });
  }

  dayModal.style.display = 'flex';
}

document.addEventListener('click', (e) => {
  const dayModal = document.getElementById('dayModal');
  const btnCloseModal = document.getElementById('btnCloseModal');
  if (e.target === dayModal || e.target === btnCloseModal) {
    dayModal.style.display = 'none';
  }
});

function initMonthSelector() {
  const monthSelector = document.getElementById('monthSelector');
  if (!monthSelector) return;
  let availableMonths = new Set();
  
  const now = new Date();
  const currentVal = `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
  availableMonths.add(currentVal);

  closedDays.forEach(day => {
    const parts = day.date.split('/');
    if (parts.length === 3) {
      availableMonths.add(`${parts[1]}/${parts[2]}`);
    }
  });

  const currentSelected = monthSelector.value;
  monthSelector.innerHTML = '';

  const sortedMonths = Array.from(availableMonths).sort((a, b) => {
    let [mA, yA] = a.split('/');
    let [mB, yB] = b.split('/');
    return new Date(yB, mB - 1) - new Date(yA, mA - 1);
  });

  const monthNames = {
    "01": "Enero", "02": "Febrero", "03": "Marzo", "04": "Abril",
    "05": "Mayo", "06": "Junio", "07": "Julio", "08": "Agosto",
    "09": "Septiembre", "10": "Octubre", "11": "Noviembre", "12": "Diciembre"
  };

  sortedMonths.forEach(mKey => {
    let [mNum, yNum] = mKey.split('/');
    const opt = document.createElement('option');
    opt.value = mKey;
    opt.textContent = `${monthNames[mNum] || mNum} ${yNum}`;
    monthSelector.appendChild(opt);
  });

  if (currentSelected && availableMonths.has(currentSelected)) {
    monthSelector.value = currentSelected;
  } else {
    monthSelector.value = currentVal;
  }

  calculateMonthlySummary();
}

document.addEventListener('change', (e) => {
  if (e.target && e.target.id === 'monthSelector') {
    calculateMonthlySummary();
  }
});

function calculateMonthlySummary() {
  const monthSelector = document.getElementById('monthSelector');
  const lblMonthIncome = document.getElementById('lblMonthIncome');
  const lblMonthExpense = document.getElementById('lblMonthExpense');
  const lblMonthMargin = document.getElementById('lblMonthMargin');
  const lblMonthNet = document.getElementById('lblMonthNet');

  if (!monthSelector || !lblMonthIncome) return;
  const selectedMonthYear = monthSelector.value; 
  if (!selectedMonthYear) return;

  let monthIncome = 0;
  let monthExpense = 0;

  const [selM, selY] = selectedMonthYear.split('/');
  const now = new Date();
  const currentM = String(now.getMonth() + 1).padStart(2, '0');
  const currentY = String(now.getFullYear());

  if (selM === currentM && selY === currentY) {
    movements.forEach(m => {
      if (m.type === 'income') monthIncome += m.amount;
      else monthExpense += m.amount;
    });
  }

  closedDays.forEach(day => {
    const parts = day.date.split('/'); 
    if (parts.length === 3) {
      if (parts[1] === selM && parts[2] === selY) {
        monthIncome += Number(day.income) || 0;
        monthExpense += Number(day.expense) || 0;
      }
    }
  });

  let monthNet = monthIncome - monthExpense;
  let profitMargin = monthExpense > 0 ? (monthNet / monthExpense) * 100 : 0;

  lblMonthIncome.textContent = `$${monthIncome.toLocaleString('es-AR')}`;
  lblMonthExpense.textContent = `$${monthExpense.toLocaleString('es-AR')}`;
  lblMonthMargin.textContent = `${profitMargin.toFixed(1)}%`;
  lblMonthMargin.className = profitMargin >= 0 ? 'text-success' : 'text-danger';
  lblMonthNet.textContent = `$${monthNet.toLocaleString('es-AR')}`;
  lblMonthNet.className = monthNet >= 0 ? 'text-success' : 'text-danger';
}

document.addEventListener('click', (e) => {
  if (e.target && e.target.id === 'btnWhatsApp') {
    const monthSelector = document.getElementById('monthSelector');
    const monthText = monthSelector.options[monthSelector.selectedIndex]?.text || '';
    const income = document.getElementById('lblMonthIncome').textContent;
    const expense = document.getElementById('lblMonthExpense').textContent;
    const margin = document.getElementById('lblMonthMargin').textContent;
    const net = document.getElementById('lblMonthNet').textContent;

    const mensaje = `📊 *Resumen de Caja - Control De Caja Ultra*\n📅 Período: ${monthText}\n\n🟢 Ventas / Ingresos: ${income}\n🔴 Compras / Gastos: ${expense}\n📈 Rentabilidad s/ Costo: ${margin}\n💵 Ganancia Neta: ${net}\n\n_Enviado desde mi app de control diario_`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(mensaje)}`, '_blank');
  }
});

window.deleteClosedDay = (id) => {
  if (confirm('¿Eliminar este cierre del historial?')) {
    solicitarPasswordAdmin(async () => {
      try {
        await db.collection('licenses').doc(window.currentUID).collection('closedDays').doc(id).delete();
      } catch (err) {
        console.error("Error al eliminar cierre:", err);
      }
    });
  }
};

function limpiarHistorialReal() {
  if (confirm('¿Deseas borrar todo el historial de cierres?')) {
    solicitarPasswordAdmin(async () => {
      try {
        const snapshot = await db.collection('licenses').doc(window.currentUID).collection('closedDays').get();
        const batch = db.batch();
        snapshot.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        alert("🗑️ Historial limpiado.");
      } catch (err) {
        console.error("Error al limpiar historial:", err);
      }
    });
  }
}
