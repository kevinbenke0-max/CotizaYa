// ==========================================
// CONFIGURACIÓN DE FIREBASE
// ==========================================
const firebaseConfig = {
  // Coloca aquí tus credenciales de Firebase
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();

// Variables globales
let html5QrCode = null;
let escanerContexto = ''; // 'caja' o 'catalogo'
let productosCache = [];

document.addEventListener("DOMContentLoaded", () => {
  verificarSuscripcionYArrancar();
});

// ==========================================
// VERIFICACIÓN DE SUSCRIPCIÓN Y ESTADO
// ==========================================
function verificarSuscripcionYArrancar() {
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

  const badge = document.getElementById('trialBadge');

  db.collection("suscripciones").doc(deviceId).get().then((doc) => {
    let activo = false;

    if (doc.exists) {
      const data = doc.data();
      const expDate = data.expirationDate ? new Date(data.expirationDate) : null;
      if (expDate && expDate > new Date()) {
        activo = true;
        if (badge) {
          badge.innerText = "⭐ Suscripción Activa";
          badge.style.background = "#d4edda";
          badge.style.color = "#155724";
        }
      }
    }

    if (!activo && badge) {
      badge.innerText = "🟢 Versión Activa";
      badge.style.background = "#d4edda";
      badge.style.color = "#155724";
    }

    inicializarAplicacion();
  }).catch((err) => {
    console.error("Error al verificar suscripción:", err);
    if (badge) {
      badge.innerText = "🟢 Sistema Operativo";
      badge.style.background = "#d4edda";
      badge.style.color = "#155724";
    }
    inicializarAplicacion();
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
// ESCÁNER DE CÓDIGO DE BARRAS (CÁMARA)
// ==========================================
function abrirEscaner(contexto) {
  escanerContexto = contexto;
  const modal = document.getElementById('scannerModal');
  modal.style.display = 'flex';

  if (typeof Html5Qrcode === 'undefined') {
    alert("La librería del escáner está cargando. Reintenta en unos segundos.");
    cerrarEscaner();
    return;
  }

  if (!html5QrCode) {
    html5QrCode = new Html5Qrcode("reader");
  }

  const config = {
    fps: 15,
    qrbox: { width: 250, height: 150 },
    aspectRatio: 1.0
  };

  html5QrCode.start(
    { facingMode: { exact: "environment" } },
    config,
    onScanSuccess,
    onScanFailure
  ).catch(() => {
    // Reintento genérico si el modo 'exact environment' falla en el dispositivo
    html5QrCode.start(
      { facingMode: "environment" },
      config,
      onScanSuccess,
      onScanFailure
    ).catch((err) => {
      console.error("Error al iniciar cámara:", err);
      alert("No se pudo iniciar la cámara. Verifica los permisos de la aplicación en tu navegador.");
      cerrarEscaner();
    });
  });
}

function cerrarEscaner() {
  const modal = document.getElementById('scannerModal');
  modal.style.display = 'none';

  if (html5QrCode) {
    try {
      if (html5QrCode.isScanning) {
        html5QrCode.stop().then(() => {
          html5QrCode.clear();
        }).catch(err => console.error("Error al detener escáner:", err));
      }
    } catch (e) {
      console.log("Escáner cerrado");
    }
  }
}

function onScanSuccess(decodedText) {
  cerrarEscaner();

  if (escanerContexto === 'catalogo') {
    const barcodeInput = document.getElementById('prodBarcode');
    if (barcodeInput) barcodeInput.value = decodedText;
  } else if (escanerContexto === 'caja') {
    const movDesc = document.getElementById('movDesc');
    if (movDesc) {
      movDesc.value = decodedText;
      buscarYSeleccionarPorCodigoOTexto(decodedText);
    }
  }
}

function onScanFailure(error) {
  // Búsqueda continua en cada fotograma
}

// ==========================================
// CATÁLOGO Y PRODUCTOS (INVENTARIO)
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
            <td><code>${prod.barcode || '-'}</code></td>
            <td><strong>${prod.name}</strong></td>
            <td>$${Number(prod.price || 0).toLocaleString()}</td>
            <td>${prod.stock || 0}</td>
            <td style="text-align: right;">
              <button class="btn btn-secondary" style="padding: 4px 8px; font-size: 0.8rem;" onclick="editarProducto('${prod.id}', '${prod.name}', '${prod.barcode || ''}', ${prod.price}, ${prod.stock})">✏️</button>
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
  const barcode = document.getElementById('prodBarcode').value.trim();
  const price = parseFloat(document.getElementById('prodPrice').value);
  const stock = parseInt(document.getElementById('prodStock').value);

  const productoData = {
    name: name,
    barcode: barcode !== "" ? barcode : null,
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
    alert("¡Producto guardado con éxito!");
  }).catch((err) => {
    console.error("Error al guardar producto:", err);
    alert("Error al intentar guardar el producto.");
  });
}

function editarProducto(id, name, barcode, price, stock) {
  document.getElementById('editProductId').value = id;
  document.getElementById('prodName').value = name;
  document.getElementById('prodBarcode').value = (barcode && barcode !== 'null') ? barcode : '';
  document.getElementById('prodPrice').value = price;
  document.getElementById('prodStock').value = stock;

  document.getElementById('formProductTitle').innerText = '✏️ Editar Producto';
  document.getElementById('btnSaveProduct').innerText = '💾 Actualizar';

  switchTab('catalogo');
}

function eliminarProducto(id) {
  if (confirm("¿Estás seguro de eliminar este producto del catálogo?")) {
    db.collection("productos").doc(id).delete();
  }
}

// ==========================================
// REGISTRO DE MOVIMIENTOS Y BÚSQUEDA
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
  const filtrados = productosCache.filter(p =>
    p.name.toLowerCase().includes(query) || (p.barcode && p.barcode.toLowerCase().includes(query))
  );

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

function buscarYSeleccionarPorCodigoOTexto(valor) {
  const query = valor.trim().toLowerCase();
  const encontrado = productosCache.find(p => (p.barcode && p.barcode.toLowerCase() === query) || p.name.toLowerCase() === query);

  if (encontrado) {
    document.getElementById('movDesc').value = encontrado.name;
    document.getElementById('movAmount').value = encontrado.price;
    document.getElementById('sugerenciasBox').style.display = 'none';
    actualizarMontoPorCantidad();
  }
}

function actualizarMontoPorCantidad() {
  const desc = document.getElementById('movDesc').value.trim().toLowerCase();
  const qty = parseInt(document.getElementById('movQty').value) || 1;
  const encontrado = productosCache.find(p => p.name.toLowerCase() === desc || (p.barcode && p.barcode.toLowerCase() === desc));

  if (encontrado) {
    document.getElementById('movAmount').value = encontrado.price * qty;
  }
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
  // Lógica de métricas de rentabilidad y saldo mensual
}
