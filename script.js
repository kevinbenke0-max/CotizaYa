// ==========================================
// CONFIGURACIÓN DE FIREBASE
// ==========================================
const firebaseConfig = {
  // Mantén tus credenciales actuales aquí
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();

// Variables globales para control de escáner y app
let html5QrCode = null;
let escanerContexto = ''; // 'caja' o 'catalogo'
let productosCache = [];  // Para búsqueda rápida en memoria

document.addEventListener("DOMContentLoaded", () => {
  cargarProductosCache();
});

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
// CONTROL DE CÁMARA Y ESCÁNER DE CÓDIGO DE BARRAS
// ==========================================
function abrirEscaner(contexto) {
  escanerContexto = contexto; // 'caja' o 'catalogo'
  const modal = document.getElementById('scannerModal');
  modal.style.display = 'flex';

  if (!html5QrCode) {
    html5QrCode = new Html5Qrcode("reader");
  }

  const config = { fps: 10, qrbox: { width: 250, height: 150 } };

  html5QrCode.start(
    { facingMode: "environment" },
    config,
    onScanSuccess,
    onScanFailure
  ).catch(err => {
    console.error("Error al iniciar la cámara:", err);
    alert("No se pudo acceder a la cámara. Revisa los permisos del navegador.");
    cerrarEscaner();
  });
}

function cerrarEscaner() {
  const modal = document.getElementById('scannerModal');
  modal.style.display = 'none';

  if (html5QrCode && html5QrCode.isScanning) {
    html5QrCode.stop().then(() => {
      console.log("Escáner detenido.");
    }).catch(err => {
      console.error("Error al detener el escáner:", err);
    });
  }
}

function onScanSuccess(decodedText, decodedResult) {
  console.log(`Código detectado: ${decodedText}`);
  cerrarEscaner();

  if (escanerContexto === 'catalogo') {
    const barcodeInput = document.getElementById('prodBarcode');
    if (barcodeInput) {
      barcodeInput.value = decodedText;
    }
  } else if (escanerContexto === 'caja') {
    const movDesc = document.getElementById('movDesc');
    if (movDesc) {
      movDesc.value = decodedText;
      buscarYSeleccionarPorCodigoOTexto(decodedText);
    }
  }
}

function onScanFailure(error) {
  // Ignorar errores en cada frame mientras busca
}

// ==========================================
// CACHÉ Y GESTIÓN DE PRODUCTOS / STOCK
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
            <td>$${Number(prod.price).toLocaleString()}</td>
            <td>${prod.stock}</td>
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
    barcode: barcode !== "" ? barcode : null, // Opcional
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
  }).catch(error => {
    console.error("Error al guardar producto:", error);
    alert("Hubo un error al guardar el producto.");
  });
}

function editarProducto(id, name, barcode, price, stock) {
  document.getElementById('editProductId').value = id;
  document.getElementById('prodName').value = name;
  document.getElementById('prodBarcode').value = barcode !== 'null' ? barcode : '';
  document.getElementById('prodPrice').value = price;
  document.getElementById('prodStock').value = stock;
  
  document.getElementById('formProductTitle').innerText = '✏️ Editar Producto';
  document.getElementById('btnSaveProduct').innerText = '💾 Actualizar';
  
  switchTab('catalogo');
}

function eliminarProducto(id) {
  if (confirm("¿Estás seguro de eliminar este producto del inventario?")) {
    db.collection("productos").doc(id).delete().then(() => {
      console.log("Producto eliminado");
    }).catch(err => {
      console.error("Error al eliminar:", err);
    });
  }
}

// ==========================================
// LÓGICA DE VENTAS Y BÚSQUEDA INTELIGENTE
// ==========================================
function filtrarProductosSugeridos(texto) {
  const box = document.getElementById('sugerenciasBox');
  if (!box) return;

  if (!texto || texto.trim() === "") {
    box.style.display = 'none';
    box.innerHTML = '';
    return;
  }

  const query = texto.toLowerCase();
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
  document.getElementById('movQty').focus();
}

function buscarYSeleccionarPorCodigoOTexto(valor) {
  const query = valor.trim().toLowerCase();
  const encontrado = productosCache.find(p => p.barcode === query || p.name.toLowerCase() === query);
  
  if (encontrado) {
    document.getElementById('movDesc').value = encontrado.name;
    document.getElementById('movAmount').value = encontrado.price;
    document.getElementById('sugerenciasBox').style.display = 'none';
  }
}

function actualizarMontoPorCantidad() {
  // Lógica complementaria para cantidad x precio si se requiere
}
