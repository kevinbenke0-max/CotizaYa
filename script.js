// --- CONFIGURACIÓN DE FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyB4eg-yFaE9FQe9dB3WNeOj9JJwI...",
  authDomain: "control-caja-ultra.firebaseapp.com",
  projectId: "control-caja-ultra",
  storageBucket: "control-caja-ultra.appspot.com",
  messagingSenderId: "76362765432",
  appId: "1:76362765432:web:1e44c161254bec0..."
};

// Inicializar Firebase
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();

// ==========================================
// MÓDULO DE PESTAÑAS Y CATÁLOGO (GLOBALES)
// ==========================================

function switchTab(tab) {
  const secCaja = document.getElementById('sectionCaja');
  const secCatalogo = document.getElementById('sectionCatalogo');
  const btnCaja = document.getElementById('btnTabCaja');
  const btnCatalogo = document.getElementById('btnTabCatalogo');

  if (!secCaja || !secCatalogo) return;

  if (tab === 'caja') {
    secCaja.style.display = 'block';
    secCatalogo.style.display = 'none';

    if (btnCaja) {
      btnCaja.className = 'btn btn-primary';
      btnCaja.style.background = '';
      btnCaja.style.color = '#fff';
    }
    if (btnCatalogo) {
      btnCatalogo.className = 'btn btn-secondary';
      btnCatalogo.style.background = '#333';
      btnCatalogo.style.color = '#ccc';
    }
    loadProductOptions();
  } else if (tab === 'catalogo') {
    secCaja.style.display = 'none';
    secCatalogo.style.display = 'block';

    if (btnCatalogo) {
      btnCatalogo.className = 'btn btn-primary';
      btnCatalogo.style.background = '';
      btnCatalogo.style.color = '#fff';
    }
    if (btnCaja) {
      btnCaja.className = 'btn btn-secondary';
      btnCaja.style.background = '#333';
      btnCaja.style.color = '#ccc';
    }
    
    loadProducts();
  }
}

// Cargar productos desde Firebase para la tabla de inventario
function loadProducts() {
  const deviceId = localStorage.getItem('ultraDeviceId');
  if (!deviceId) return;

  db.collection('licenses').doc(deviceId).collection('products')
    .onSnapshot((snapshot) => {
      const list = document.getElementById('productList');
      if (!list) return;
      list.innerHTML = '';

      if (snapshot.empty) {
        list.innerHTML = `<tr><td colspan="4" style="text-align: center; color: #888;">No hay productos cargados en el inventario.</td></tr>`;
        return;
      }

      snapshot.forEach((doc) => {
        const p = { id: doc.id, ...doc.data() };
        list.innerHTML += `
          <tr>
            <td><strong>${p.name}</strong></td>
            <td>$${Number(p.price).toLocaleString('es-AR')}</td>
            <td><span class="badge ${p.stock > 0 ? 'text-success' : 'text-danger'}">${p.stock} u.</span></td>
            <td style="text-align: right;">
              <button onclick="deleteProduct('${p.id}')" class="btn btn-danger-soft" style="padding: 4px 8px; font-size: 0.85rem;">🗑️ Eliminar</button>
            </td>
          </tr>
        `;
      });
    }, (err) => {
      console.error("Error al escuchar productos:", err);
    });
}

// Caché global para el buscador flotante con precio unitario
window.listaProductosCache = [];
window.precioUnitarioSeleccionado = 0;

function loadProductOptions() {
  const deviceId = localStorage.getItem('ultraDeviceId');
  if (!deviceId) return;

  db.collection('licenses').doc(deviceId).collection('products').get().then((snapshot) => {
    window.listaProductosCache = [];
    snapshot.forEach((doc) => {
      const p = doc.data();
      window.listaProductosCache.push({
        name: p.name,
        price: p.price,
        stock: p.stock
      });
    });
  });
}

// Actualizar el monto automáticamente al cambiar la cantidad
function actualizarMontoPorCantidad() {
  const qty = parseInt(document.getElementById('movQty').value) || 1;
  const movAmountInput = document.getElementById('movAmount');
  
  if (window.precioUnitarioSeleccionado > 0) {
    movAmountInput.value = window.precioUnitarioSeleccionado * qty;
  }
}

// Mostrar sugerencias flotantes al escribir en la caja
function filtrarProductosSugeridos(texto) {
  const box = document.getElementById('sugerenciasBox');
  if (!box) return;

  const query = texto.trim().toLowerCase();
  if (query === '' || window.listaProductosCache.length === 0) {
    box.style.display = 'none';
    box.innerHTML = '';
    return;
  }

  const matches = window.listaProductosCache.filter(p => p.name.toLowerCase().includes(query));

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
        <small style="color: #666;">Stock: ${prod.stock} u.</small>
      </div>
      <div style="color: #0066cc; font-weight: bold; font-size: 1.05rem;">
        $${Number(prod.price).toLocaleString('es-AR')}
      </div>
    `;

    // Al tocar la sugerencia con el dedo, se guarda el precio unitario y calcula el monto por cantidad
    item.addEventListener('mousedown', (e) => {
      e.preventDefault();
      document.getElementById('movDesc').value = prod.name;
      window.precioUnitarioSeleccionado = prod.price;
      
      const qty = parseInt(document.getElementById('movQty').value) || 1;
      document.getElementById('movAmount').value = prod.price * qty;

      box.style.display = 'none';
      box.innerHTML = '';
    });

    box.appendChild(item);
  });

  box.style.display = 'block';
}

// Ocultar sugerencias al hacer clic fuera
document.addEventListener('click', (e) => {
  const box = document.getElementById('sugerenciasBox');
  const input = document.getElementById('movDesc');
  if (box && input && !input.contains(e.target) && !box.contains(e.target)) {
    box.style.display = 'none';
  }
});

// Guardar producto en Firebase
async function saveProduct(e) {
  e.preventDefault();
  const deviceId = localStorage.getItem('ultraDeviceId');
  if (!deviceId) return;

  const name = document.getElementById('prodName').value.trim();
  const price = parseFloat(document.getElementById('prodPrice').value);
  const stock = parseInt(document.getElementById('prodStock').value);

  if (!name || isNaN(price) || isNaN(stock)) return;

  try {
    await db.collection('licenses').doc(deviceId).collection('products').add({
      name,
      price,
      stock,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    document.getElementById('formProduct').reset();
    loadProductOptions();
  } catch (err) {
    console.error("Error al guardar producto:", err);
    alert("Hubo un error al guardar el producto.");
  }
}

// Eliminar producto de Firebase
async function deleteProduct(id) {
  if (!confirm('¿Seguro que deseas eliminar este producto del catálogo?')) return;
  const deviceId = localStorage.getItem('ultraDeviceId');
  if (!deviceId) return;

  try {
    await db.collection('licenses').doc(deviceId).collection('products').doc(id).delete();
    loadProductOptions();
  } catch (err) {
    console.error("Error al eliminar producto:", err);
  }
}

// Descontar la cantidad exacta vendida del stock en Firestore
async function descontarStockCantidad(nombreProducto, cantidadVenta) {
  const deviceId = localStorage.getItem('ultraDeviceId');
  if (!deviceId || !nombreProducto) return;

  try {
    const productsRef = db.collection('licenses').doc(deviceId).collection('products');
    const snapshot = await productsRef.get();

    snapshot.forEach(async (docSnap) => {
      const prod = docSnap.data();
      if (prod.name.trim().toLowerCase() === nombreProducto.trim().toLowerCase()) {
        const stockActual = Number(prod.stock) || 0;
        const nuevoStock = Math.max(0, stockActual - cantidadVenta); // Resta la cantidad exacta

        await productsRef.doc(docSnap.id).update({
          stock: nuevoStock
        });
      }
    });
  } catch (err) {
    console.error("Error al sincronizar el stock:", err);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  let deviceId = localStorage.getItem('ultraDeviceId');
  if (!deviceId) {
    deviceId = 'DEV-' + Math.random().toString(36).substring(2, 9).toUpperCase();
    localStorage.setItem('ultraDeviceId', deviceId);
  }

  const mainApp = document.getElementById('mainApp');
  const lockScreen = document.getElementById('lockScreen');
  const trialBadge = document.getElementById('trialBadge');
  const userDeviceIdLabel = document.getElementById('userDeviceId');
  const btnRenovarWA = document.getElementById('btnRenovarWA');
  const lockUserName = document.getElementById('lockUserName');

  if (userDeviceIdLabel) userDeviceIdLabel.textContent = deviceId;

  const savedName = localStorage.getItem('ultraLockUserName') || '';
  if (lockUserName && savedName) {
    lockUserName.value = savedName;
  }

  function updateWhatsAppLink() {
    if (!btnRenovarWA) return;
    const userName = lockUserName.value.trim();
    if (userName) {
      localStorage.setItem('ultraLockUserName', userName);
    }
    const displayName = userName || "No especificado";
    const text = `Hola, realicé el pago de mi suscripción de Control De Caja Ultra.\nMi nombre en el comprobante es: *${displayName}*\nMi ID es: *${deviceId}*`;
    btnRenovarWA.href = `https://api.whatsapp.com/send?phone=5493755449964&text=${encodeURIComponent(text)}`;
  }

  if (lockUserName) {
    lockUserName.addEventListener('input', updateWhatsAppLink);
  }
  updateWhatsAppLink();

  if (btnRenovarWA) {
    btnRenovarWA.addEventListener('click', (e) => {
      const userName = lockUserName.value.trim();
      if (!userName) {
        e.preventDefault();
        alert('Por favor, ingresa tu Nombre y Apellido (como en el comprobante) antes de enviar el mensaje por WhatsApp.');
        lockUserName.focus();
      }
    });
  }

  // CONSULTAR LICENCIA EN FIREBASE FIRESTORE EN TIEMPO REAL
  const docRef = db.collection("licenses").doc(deviceId);

  docRef.onSnapshot((doc) => {
    const nowMs = new Date().getTime();

    if (!doc.exists) {
      const trialMs = 3 * 24 * 60 * 60 * 1000;
      const expireTime = nowMs + trialMs;

      docRef.set({
        createdAt: nowMs,
        expirationDate: expireTime,
        status: 'trial'
      });
      return;
    }

    const data = doc.data();
    const expireTime = data.expirationDate;
    const diffMs = expireTime - nowMs;
    const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffMs <= 0) {
      mainApp.style.display = 'none';
      lockScreen.style.display = 'flex';
    } else {
      lockScreen.style.display = 'none';
      mainApp.style.display = 'block';

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
  });

  loadProductOptions();

  // --- LÓGICA DE MOVIMIENTOS Y CAJA ---
  let movements = JSON.parse(localStorage.getItem('cashMovements')) || [];
  let closedDays = JSON.parse(localStorage.getItem('closedDaysHistory')) || [];

  const movDescInput = document.getElementById('movDesc');
  const movQtyInput = document.getElementById('movQty');
  const movAmountInput = document.getElementById('movAmount');
  const movTypeSelect = document.getElementById('movType');
  const btnAddMov = document.getElementById('btnAddMov');
  const btnCloseDay = document.getElementById('btnCloseDay');
  const btnClearHistory = document.getElementById('btnClearHistory');
  const monthSelector = document.getElementById('monthSelector');
  const btnWhatsApp = document.getElementById('btnWhatsApp');

  const movList = document.getElementById('movList');
  const closedDaysList = document.getElementById('closedDaysList');
  const lblTotalIncome = document.getElementById('lblTotalIncome');
  const lblTotalExpense = document.getElementById('lblTotalExpense');
  const lblNetBalance = document.getElementById('lblNetBalance');

  const lblMonthIncome = document.getElementById('lblMonthIncome');
  const lblMonthExpense = document.getElementById('lblMonthExpense');
  const lblMonthMargin = document.getElementById('lblMonthMargin');
  const lblMonthNet = document.getElementById('lblMonthNet');

  const dayModal = document.getElementById('dayModal');
  const modalTitle = document.getElementById('modalTitle');
  const modalMovList = document.getElementById('modalMovList');
  const btnCloseModal = document.getElementById('btnCloseModal');

  initMonthSelector();
  renderMovements();
  renderClosedDays();

  if (btnAddMov) {
    btnAddMov.addEventListener('click', () => {
      const desc = movDescInput.value.trim();
      const qty = parseInt(movQtyInput.value) || 1;
      const amount = parseFloat(movAmountInput.value);
      const type = movTypeSelect.value;

      if (!desc || isNaN(amount) || amount <= 0 || qty <= 0) {
        alert('Por favor, completa la descripción, cantidad y un monto válido.');
        return;
      }

      // Mostramos la cantidad en el detalle de la caja si es mayor a 1
      const detalleTexto = qty > 1 ? `${desc} (x${qty})` : desc;

      movements.unshift({ 
        desc: detalleTexto, 
        amount, 
        type, 
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
      });
      
      if (type === 'income') {
        descontarStockCantidad(desc, qty);
      }
      
      movDescInput.value = '';
      movQtyInput.value = '1';
      movAmountInput.value = '';
      window.precioUnitarioSeleccionado = 0;
      
      saveAndRender();
    });
  }

  function saveAndRender() {
    localStorage.setItem('cashMovements', JSON.stringify(movements));
    renderMovements();
    calculateMonthlySummary();
  }

  function renderMovements() {
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

    movements.forEach((mov, idx) => {
      if (mov.type === 'income') {
        totalIncome += mov.amount;
      } else {
        totalExpense += mov.amount;
      }

      const tr = document.createElement('tr');
      const amountClass = mov.type === 'income' ? 'text-success' : 'text-danger';
      const sign = mov.type === 'income' ? '+' : '-';

      tr.innerHTML = `
        <td><strong>${mov.desc}</strong><br><small>${mov.time}</small></td>
        <td>${mov.type === 'income' ? 'Ingreso' : 'Gasto'}</td>
        <td style="text-align: right;" class="${amountClass}"><strong>${sign}$${mov.amount.toLocaleString()}</strong></td>
        <td><button class="btn btn-danger" onclick="deleteMovement(${idx})">x</button></td>
      `;
      movList.appendChild(tr);
    });

    let net = totalIncome - totalExpense;
    lblTotalIncome.textContent = `$${totalIncome.toLocaleString()}`;
    lblTotalExpense.textContent = `$${totalExpense.toLocaleString()}`;
    lblNetBalance.textContent = `$${net.toLocaleString()}`;
    lblNetBalance.className = net >= 0 ? 'text-success' : 'text-danger';
  }

  window.deleteMovement = (idx) => {
    movements.splice(idx, 1);
    saveAndRender();
  };

  if (btnCloseDay) {
    btnCloseDay.addEventListener('click', () => {
      if (movements.length === 0) {
        alert('No hay movimientos registrados hoy para cerrar.');
        return;
      }

      if (confirm('¿Deseas realizar el cierre de caja de hoy y guardar el resumen en el historial?')) {
        let totalIncome = 0;
        let totalExpense = 0;

        movements.forEach(m => {
          if (m.type === 'income') totalIncome += m.amount;
          else totalExpense += m.amount;
        });

        let net = totalIncome - totalExpense;
        let dateStr = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });

        closedDays.unshift({
          date: dateStr,
          income: totalIncome,
          expense: totalExpense,
          net: net,
          items: [...movements]
        });

        localStorage.setItem('closedDaysHistory', JSON.stringify(closedDays));

        movements = [];
        localStorage.removeItem('cashMovements');

        renderMovements();
        renderClosedDays();
        initMonthSelector();
        alert('¡Cierre de caja guardado con éxito!');
      }
    });
  }

  function renderClosedDays() {
    if (!closedDaysList) return;
    closedDaysList.innerHTML = '';
    if (closedDays.length === 0) {
      closedDaysList.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#999;">Sin cierres anteriores guardados</td></tr>';
      return;
    }

    closedDays.forEach((day, idx) => {
      const tr = document.createElement('tr');
      const netClass = day.net >= 0 ? 'text-success' : 'text-danger';
      const sign = day.net >= 0 ? '+' : '';

      tr.innerHTML = `
        <td><strong>📅 ${day.date}</strong> <br><small style="color:#0066cc;">Ver detalle 🔍</small></td>
        <td><small>➕ $${(day.income || 0).toLocaleString()}</small><br><small>➖ $${(day.expense || 0).toLocaleString()}</small></td>
        <td style="text-align: right;" class="${netClass}"><strong>${sign}$${(day.net || 0).toLocaleString()}</strong></td>
        <td><button class="btn btn-danger-soft" onclick="event.stopPropagation(); deleteClosedDay(${idx})">x</button></td>
      `;

      tr.addEventListener('click', () => {
        openDayDetail(day);
      });

      closedDaysList.appendChild(tr);
    });
  }

  function openDayDetail(day) {
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
          <td style="text-align: right;" class="${amountClass}"><strong>${sign}$${Number(item.amount).toLocaleString()}</strong></td>
        `;
        modalMovList.appendChild(tr);
      });
    }

    dayModal.style.display = 'flex';
  }

  if (btnCloseModal) {
    btnCloseModal.addEventListener('click', () => {
      dayModal.style.display = 'none';
    });
  }

  window.addEventListener('click', (e) => {
    if (e.target === dayModal) {
      dayModal.style.display = 'none';
    }
  });

  function initMonthSelector() {
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

  if (monthSelector) {
    monthSelector.addEventListener('change', calculateMonthlySummary);
  }

  function calculateMonthlySummary() {
    if (!monthSelector || !lblMonthIncome) return;
    const selectedMonthYear = monthSelector.value; 
    if (!selectedMonthYear) {
      lblMonthIncome.textContent = '$0';
      lblMonthExpense.textContent = '$0';
      lblMonthMargin.textContent = '0%';
      lblMonthNet.textContent = '$0';
      return;
    }

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
    let profitMargin = 0;
    if (monthExpense > 0) {
      profitMargin = (monthNet / monthExpense) * 100;
    }

    lblMonthIncome.textContent = `$${monthIncome.toLocaleString()}`;
    lblMonthExpense.textContent = `$${monthMonthExpense || monthExpense.toLocaleString()}`;
    lblMonthExpense.textContent = `$${monthExpense.toLocaleString()}`;
    lblMonthMargin.textContent = `${profitMargin.toFixed(1)}%`;
    lblMonthMargin.className = profitMargin >= 0 ? 'text-success' : 'text-danger';
    
    lblMonthNet.textContent = `$${monthNet.toLocaleString()}`;
    lblMonthNet.className = monthNet >= 0 ? 'text-success' : 'text-danger';
  }

  if (btnWhatsApp) {
    btnWhatsApp.addEventListener('click', () => {
      const monthText = monthSelector.options[monthSelector.selectedIndex]?.text || '';
      const income = lblMonthIncome.textContent;
      const expense = lblMonthExpense.textContent;
      const margin = lblMonthMargin.textContent;
      const net = lblMonthNet.textContent;

      const mensaje = `📊 *Resumen de Caja - Control De Caja Ultra*\n📅 Período: ${monthText}\n\n🟢 Ventas / Ingresos: ${income}\n🔴 Compras / Gastos: ${expense}\n📈 Rentabilidad s/ Costo: ${margin}\n💵 Ganancia Neta: ${net}\n\n_Enviado desde mi app de control diario_`;

      const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(mensaje)}`;
      window.open(url, '_blank');
    });
  }

  window.deleteClosedDay = (idx) => {
    if (confirm('¿Eliminar este cierre del historial?')) {
      closedDays.splice(idx, 1);
      localStorage.setItem('closedDaysHistory', JSON.stringify(closedDays));
      renderClosedDays();
      initMonthSelector();
    }
  };

  if (btnClearHistory) {
    btnClearHistory.addEventListener('click', () => {
      if (confirm('¿Deseas borrar todo el historial de cierres?')) {
        closedDays = [];
        localStorage.removeItem('closedDaysHistory');
        renderClosedDays();
        initMonthSelector();
      }
    });
  }
});
