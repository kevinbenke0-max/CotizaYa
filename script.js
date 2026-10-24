document.addEventListener('DOMContentLoaded', () => {
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
  const lblMonthNet = document.getElementById('lblMonthNet');

  initMonthSelector();
  renderMovements();
  renderClosedDays();

  // Registrar Movimiento
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

  function saveAndRender() {
    localStorage.setItem('cashMovements', JSON.stringify(movements));
    renderMovements();
    calculateMonthlySummary();
  }

  function renderMovements() {
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

  // Cerrar el Día
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
        net: net
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

  function renderClosedDays() {
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
        <td><strong>${day.date}</strong></td>
        <td><small>➕ $${day.income.toLocaleString()}</small><br><small>➖ $${day.expense.toLocaleString()}</small></td>
        <td style="text-align: right;" class="${netClass}"><strong>${sign}$${day.net.toLocaleString()}</strong></td>
        <td><button class="btn btn-danger-soft" onclick="deleteClosedDay(${idx})">x</button></td>
      `;
      closedDaysList.appendChild(tr);
    });
  }

  function initMonthSelector() {
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

  monthSelector.addEventListener('change', calculateMonthlySummary);

  function calculateMonthlySummary() {
    const selectedMonthYear = monthSelector.value; 
    if (!selectedMonthYear) {
      lblMonthIncome.textContent = '$0';
      lblMonthExpense.textContent = '$0';
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
          monthIncome += day.income;
          monthExpense += day.expense;
        }
      }
    });

    let monthNet = monthIncome - monthExpense;

    lblMonthIncome.textContent = `$${monthIncome.toLocaleString()}`;
    lblMonthExpense.textContent = `$${monthExpense.toLocaleString()}`;
    lblMonthNet.textContent = `$${monthNet.toLocaleString()}`;
    lblMonthNet.className = monthNet >= 0 ? 'text-success' : 'text-danger';
  }

  // Enviar Resumen por WhatsApp
  btnWhatsApp.addEventListener('click', () => {
    const monthText = monthSelector.options[monthSelector.selectedIndex]?.text || '';
    const income = lblMonthIncome.textContent;
    const expense = lblMonthExpense.textContent;
    const net = lblMonthNet.textContent;

    const mensaje = `📊 *Resumen de Caja - ControlCaja Pro*\n📅 Período: ${monthText}\n\n🟢 Ventas / Ingresos: ${income}\n🔴 Compras / Gastos: ${expense}\n💵 Ganancia Neta: ${net}\n\n_Enviado desde mi app de control diario_`;

    const encodedMsg = encodeURIComponent(mensaje);
    const waAppUrl = `whatsapp://send?text=${encodedMsg}`;

    window.location.href = waAppUrl;
  });

  window.deleteClosedDay = (idx) => {
    if (confirm('¿Eliminar este cierre del historial?')) {
      closedDays.splice(idx, 1);
      localStorage.setItem('closedDaysHistory', JSON.stringify(closedDays));
      renderClosedDays();
      initMonthSelector();
    }
  };

  btnClearHistory.addEventListener('click', () => {
    if (confirm('¿Deseas borrar todo el historial de cierres?')) {
      closedDays = [];
      localStorage.removeItem('closedDaysHistory');
      renderClosedDays();
      initMonthSelector();
    }
  });
});
