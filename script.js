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

document.addEventListener('DOMContentLoaded', () => {
  // Generar o recuperar ID único del dispositivo
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

  // Actualizar enlace de WhatsApp dinámicamente según lo que escriba el usuario
  function updateWhatsAppLink() {
    if (!btnRenovarWA) return;
    const userName = lockUserName.value.trim() || "No especificado";
    const text = `Hola, realicé el pago de mi suscripción de Control De Caja Ultra.\nMi nombre en el comprobante es: *${userName}*\nMi ID es: *${deviceId}*`;
    btnRenovarWA.href = `https://api.whatsapp.com/send?phone=5493755449964&text=${encodeURIComponent(text)}`;
  }

  if (lockUserName) {
    lockUserName.addEventListener('input', updateWhatsAppLink);
  }
  updateWhatsAppLink();

  // CONSULTAR LICENCIA EN FIREBASE FIRESTORE EN TIEMPO REAL
  const docRef = db.collection("licenses").doc(deviceId);

  docRef.onSnapshot((doc) => {
    const nowMs = new Date().getTime();

    if (!doc.exists) {
      // Registrar usuario nuevo con 3 días de prueba gratis
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
      // SUSCRIPCIÓN EXPIRADA -> BLOQUEAR ACCESO
      mainApp.style.display = 'none';
      lockScreen.style.display = 'flex';
    } else {
      // SUSCRIPCIÓN O PRUEBA ACTIVA
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


  // --- LÓGICA DE MOVIMIENTOS Y CAJA ---
  let movements = JSON.parse(localStorage.getItem('cashMovements')) || [];
  let closedDays = JSON.parse(localStorage.getItem('closedDaysHistory')) || [];

  const movDescInput = document.getElementById('movDesc');
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
      const amount = parseFloat(movAmountInput.value);
      const type = movTypeSelect.value;

      if (!desc || isNaN(amount) || amount <= 0) {
        alert('Por favor, ingresa una descripción y un monto válido.');
        return;
      }

      movements.unshift({ 
        desc, 
        amount, 
        type, 
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
      });
      
      movDescInput.value = '';
      movAmountInput.value = '';
      
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
      "01": "Enero", "02": "Febrero", "03": "Marzo", "04": "Abryl",
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
