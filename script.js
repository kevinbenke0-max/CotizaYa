window.onerror = function(msg, url, line) {
  alert("Error en la app: " + msg + " (Línea: " + line + ")");
};

// ==========================================
// CONFIGURACIÓN DE FIREBASE
// ==========================================
const firebaseConfig = {
  // Mantén tus credenciales aquí
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();

let productosCache = [];

document.addEventListener("DOMContentLoaded", () => {
  verificarSuscripcionYArrancar();
  
  // Vinculamos el botón de Registrar Movimiento de forma segura
  const btnAddMov = document.getElementById('btnAddMov');
  if (btnAddMov) {
    btnAddMov.addEventListener('click', registrarMovimiento);
  }
});

// ==========================================
// VERIFICACIÓN DE LICENCIA (Conectado a 'licenses')
// ==========================================
function verificarSuscripcionYArrancar() {
  const badge = document.getElementById('trialBadge');
  
  let deviceId = localStorage.getItem("device_id");
  if (!deviceId) {
    deviceId = 'dev_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
    localStorage.setItem("device_id", deviceId);
  }

  const deviceIdEl = document.getElementById('userDeviceId');
  if (deviceIdEl) deviceIdEl.innerText = deviceId;

  const btnWA = document.getElementById('btnRenovarWA');
  if (btnWA) {
    btnWA.href = `https://api.whatsapp.com/send?phone=5493755449964&text=Hola,%20quiero%20renovar%20la%20suscripción%20para%20mi%20dispositivo:%20${deviceId}`;
  }

  let appIniciada = false;
  const arrancarAppSegura = (dias, activo) => {
    if (appIniciada) return;
    appIniciada = true;

    if (badge) {
      if (activo) {
        badge.innerText = `⭐ Suscripción Activa (${dias} días)`;
        badge.style.background = "#d4edda";
        badge.style.color = "#155724";
      } else {
        badge.innerText = `⚠️ Suscripción Vencida`;
        badge.style.background = "#f8d7da";
        badge.style.color = "#721c24";
      }
    }

    inicializarAplicacion();
  };

  // Temporizador de seguridad: si Firebase tarda más de 1.5 segundos, arranca igual con 30 días para no trabar jamás la app
  const timerSeguridad = setTimeout(() => {
    arrancarAppSegura(30, true);
  }, 1500);

  // Consultamos tu colección 'licenses'
  db.collection("licenses").doc(deviceId).get().then((doc) => {
    clearTimeout(timerSeguridad);
    let diasRestantes = 30;
    let activo = true;

    if (doc.exists) {
      const data = doc.data();
      if (data.expirationDate) {
        let expDate;
        if (typeof data.expirationDate.toDate === 'function') {
          expDate = data.expirationDate.toDate();
        } else {
          expDate = new Date(data.expirationDate);
        }

        const hoy = new Date();
        const diferenciaTiempo = expDate - hoy;
        diasRestantes = Math.ceil(diferenciaTiempo / (1000 * 60 * 60 * 24));
        if (diasRestantes < 0) {
          diasRestantes = 0;
          activo = false;
        }
      }
    } else {
      // Si el dispositivo no existe en licenses, le creamos su registro inicial automáticamente
      const fechaExp = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      db.collection("licenses").doc(deviceId).set({
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        expirationDate: fechaExp.getTime(),
        status: "true"
      }).catch(e => console.log("Error creando licencia:", e));

      diasRestantes = 30;
      activo = true;
    }

    arrancarAppSegura(diasRestantes, activo);
  }).catch((err) => {
    clearTimeout(timerSeguridad);
    console.warn("Aviso de red en licenses:", err);
    arrancarAppSegura(30, true);
  });
}

function inicializarAplicacion() {
  cargarProductosCache();
  cargarMovimientosHoy();
  cargarHistorialCierres();
  cargarResumenMensual();
}

// ==========================================
// GESTIÓN DE PESTAÑAS (Caja / Catálogo)
// ==========================================
function switchTab(tab) {
  const secCaja = document.getElementById('sectionCaja');
  const secCatalogo = document.getElementById('sectionCatalogo');
  const btnCaja = document.getElementById('btnTabCaja');
  const btnCatalogo = document.getElementById('btnTabCatalogo');

  if (tab === 'caja') {
    secCaja.style.display = 'block';
    secCatalogo.style.display = 'none';
    btnCaja.className = 'btn btn-primary';
    btnCaja.style.background = '';
    btnCaja.style.color = '';
    btnCatalogo.className = 'btn btn-secondary';
    btnCatalogo.style.background = '#333';
    btnCatalogo.style.color = '#ccc';
  } else {
    secCaja.style.display = 'none';
    secCatalogo.style.display = 'block';
    btnCatalogo.className = 'btn btn-primary';
    btnCatalogo.style.background = '';
    btnCatalogo.style.color = '';
    btnCaja.className = 'btn btn-secondary';
    btnCaja.style.background = '#333';
    btnCaja.style.color = '#ccc';
  }
}

// ==========================================
// CATÁLOGO Y PRODUCTOS
// ==========================================
function cargarProductosCache() {
  db.collection("productos").onSnapshot((snapshot) => {
    productosCache = [];
    const productList = document.getElementById('productList');
    if (productList) productList.innerHTML = '';

    snapshot.forEach((doc) => {
      const prod = { id: doc.id, ...doc.data() };
      productosCache.push(prod);

      if (productList) {
        productList.innerHTML += `
          <tr>
            <td><strong>${prod.name}</strong></td>
            <td>$${Number(prod.price || 0).toLocaleString()}</td>
            <td>${prod.stock || 0}</td>
            <td style="text-align: right;">
              <button class="btn btn-secondary" style="padding: 4px 8px; font-size: 0.8rem;" onclick="editarProducto('${prod.id}', '${prod.name}', ${prod.price}, ${prod.stock})">✏️</button>
              <button class="btn btn-danger-soft" style="padding: 4px 8px; font-size: 0.8rem;" onclick="eliminarProducto('${prod.id}')">🗑️</button>
            </td>
          </tr>
        `;
      }
    });
  });
}

function saveProduct(event) {
  event.preventDefault();

  const editId = document.getElementById('editProductId').value;
  const name = document.getElementById('prodName').value.trim();
  const price = parseFloat(document.getElementById('prodPrice').value);
  const stock = parseInt(document.getElementById('prodStock').value);

  const productoData = {
    name: name,
    price: price,
    stock: stock,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  const action = editId ?
    db.collection("productos").doc(editId).update(productoData) :
    db.collection("productos").add({ ...productoData, createdAt: firebase.firestore.FieldValue.serverTimestamp() });

  action.then(() => {
    document.getElementById('formProduct').reset();
    document.getElementById('editProductId').value = '';
    document.getElementById('formProductTitle').innerText = '📦 Agregar Producto';
    document.getElementById('btnSaveProduct').innerText = '💾 Guardar';
    alert("¡Producto guardado correctamente!");
  }).catch((err) => {
    console.error("Error al guardar producto:", err);
    alert("Hubo un error al guardar el producto.");
  });
}

function editarProducto(id, name, price, stock) {
  document.getElementById('editProductId').value = id;
  document.getElementById('prodName').value = name;
  document.getElementById('prodPrice').value = price;
  document.getElementById('prodStock').value = stock;

  document.getElementById('formProductTitle').innerText = '✏️ Editar Producto';
  document.getElementById('btnSaveProduct').innerText = '💾 Actualizar';

  switchTab('catalogo');
}

function eliminarProducto(id) {
  if (confirm("¿Estás seguro de eliminar este producto?")) {
    db.collection("productos").doc(id).delete();
  }
}

// ==========================================
// MOVIMIENTOS Y VENTAS (REGISTRO DIARIO)
// ==========================================
function filtrarProductosSugeridos(texto) {
  const box = document.getElementById('sugerenciasBox');
  if (!box) return;

  if (!texto || texto.trim() === "") {
    box.style.display = 'none';
    box.innerHTML = '';
    return;
  }

  const query = texto.toLowerCase().trim();
  const filtrados = productosCache.filter(p => p.name.toLowerCase().includes(query));

  if (filtrados.length === 0) {
    box.style.display = 'none';
    box.innerHTML = '';
    return;
  }

  box.style.display = 'block';
  box.innerHTML = filtrados.map(p => `
    <div style="padding: 8px 12px; cursor: pointer; border-bottom: 1px solid #eee;" onclick="seleccionarProductoVenta('${p.name}', ${p.price})">
      <strong>${p.name}</strong> - $${p.price} <small style="color: #666;">(Stock: ${p.stock})</small>
    </div>
  `).join('');
}

function seleccionarProductoVenta(nombre, precio) {
  document.getElementById('movDesc').value = nombre;
  document.getElementById('movAmount').value = precio;
  document.getElementById('sugerenciasBox').style.display = 'none';
  actualizarMontoPorCantidad();
}

function actualizarMontoPorCantidad() {
  const desc = document.getElementById('movDesc').value.trim().toLowerCase();
  const qty = parseInt(document.getElementById('movQty').value) || 1;
  const encontrado = productosCache.find(p => p.name.toLowerCase() === desc);

  if (encontrado) {
    document.getElementById('movAmount').value = encontrado.price * qty;
  }
}

function registrarMovimiento() {
  const desc = document.getElementById('movDesc').value.trim();
  const qty = parseInt(document.getElementById('movQty').value) || 1;
  const amount = parseFloat(document.getElementById('movAmount').value);
  const type = document.getElementById('movType').value;

  if (!desc || isNaN(amount) || amount <= 0) {
    alert("Por favor completa el detalle y un monto válido.");
    return;
  }

  const hoyStr = new Date().toISOString().split('T')[0];

  db.collection("movimientos").add({
    desc: desc,
    qty: qty,
    amount: amount,
    type: type,
    fechaStr: hoyStr,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  }).then(() => {
    document.getElementById('movDesc').value = '';
    document.getElementById('movQty').value = '1';
    document.getElementById('movAmount').value = '';
    document.getElementById('movType').value = 'income';
  }).catch((err) => {
    console.error("Error al registrar movimiento:", err);
    alert("Hubo un error al registrar el movimiento.");
  });
}

function cargarMovimientosHoy() {
  const hoyStr = new Date().toISOString().split('T')[0];
  db.collection("movimientos").where("fechaStr", "==", hoyStr).onSnapshot((snapshot) => {
    const movList = document.getElementById('movList');
    if (!movList) return;

    movList.innerHTML = '';
    let totalIngresos = 0;
    let totalGastos = 0;

    snapshot.forEach((doc) => {
      const mov = doc.data();
      const monto = Number(mov.amount) || 0;

      if (mov.type === 'income') totalIngresos += monto;
      else totalGastos += monto;

      movList.innerHTML += `
        <tr>
          <td>${mov.desc} x${mov.qty || 1}</td>
          <td>${mov.type === 'income' ? '🟢 Ingreso' : '🔴 Gasto'}</td>
          <td style="text-align: right;">$${monto.toLocaleString()}</td>
          <td><button class="btn btn-danger-soft" onclick="eliminarMovimiento('${doc.id}')">🗑️</button></td>
        </tr>
      `;
    });

    document.getElementById('lblTotalIncome').innerText = `$${totalIngresos.toLocaleString()}`;
    document.getElementById('lblTotalExpense').innerText = `$${totalGastos.toLocaleString()}`;
    document.getElementById('lblNetBalance').innerText = `$${(totalIngresos - totalGastos).toLocaleString()}`;
  });
}

function eliminarMovimiento(id) {
  if (confirm("¿Deseas eliminar este movimiento?")) {
    db.collection("movimientos").doc(id).delete();
  }
}

function cargarHistorialCierres() {
  db.collection("cierres").orderBy("createdAt", "desc").onSnapshot((snapshot) => {
    const list = document.getElementById('closedDaysList');
    if (!list) return;

    list.innerHTML = '';
    snapshot.forEach((doc) => {
      const data = doc.data();
      list.innerHTML += `
        <tr>
          <td>${data.fecha || '-'}</td>
          <td><small>Ing: $${data.totalIngresos || 0}</small></td>
          <td style="text-align: right; font-weight: bold;">$${data.neto || 0}</td>
          <td><button class="btn btn-secondary" onclick="verDetalleCierre('${doc.id}')">👁️</button></td>
        </tr>
      `;
    });
  });
}

function cargarResumenMensual() {
  // Lógica de rentabilidad mensual
}
