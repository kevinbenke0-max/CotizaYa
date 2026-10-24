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

  const movList = document.getElementById('movList');
  const closedDaysList = document.getElementById('closedDaysList');
  const lblTotalIncome = document.getElementById('lblTotalIncome');
  const lblTotalExpense = document.getElementById('lblTotalExpense');
  const lblNetBalance = document.getElementById('lblNetBalance');

  const lblMonthIncome = document.getElementById('lblMonthIncome');
  const lblMonthExpense = document.getElementById('lblMonthExpense');
  const lblMonthNet = document.getElementById('lblMonthNet');

  renderMovements();
  renderClosedDays();
  initMonthSelector();

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
    initMonthSelector();
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

  // Inicializar y poblar el Selector de Meses basados en los datos guardados
  function initMonthSelector() {
    // Recopilar todos los meses disponibles (del día actual y de los cierres)
    let availableMonths = new Set();
    
    // Mes actual
    const now = new Date();
    const currentVal = `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
    availableMonths.add(currentVal);

    // Meses de los cierres guardados
    closedDays.forEach(day => {
      const parts = day.date.split('/');
      if (parts.length === 3) {
        availableMonths.add(`${parts[1]}/${parts[2]}`);
      }
    });

    const currentSelected = monthSelector.value; // Guardar selección si ya había una
    monthSelector.innerHTML = '';

    // Ordenar meses del más nuevo al más antiguo
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

  // Cambio de mes en el selector
  monthSelector.addEventListener('change', calculateMonthlySummary);

  // Cálculo del Resumen para el Mes Seleccionado
  function calculateMonthlySummary() {
    const selectedMonthYear = monthSelector.value; // Formato "MM/YYYY"
    if (!selectedMonthYear) return;

    let monthIncome = 0;
    let monthExpense = 0;

    const [selM, selY] = selectedMonthYear.split('/');

    // 1. Si el mes seleccionado es el actual, sumar los movimientos de hoy
    const now = new Date();
    const currentM = String(now.getMonth() + 1).padStart(2, '0');
    const currentY = String(now.getFullYear());

    if (selM === currentM && selY === currentY) {
      movements.forEach(m => {
        if (m.type === 'income') monthIncome += m.amount;
        else monthExpense += m.amount;
      });
    }

    // 2. Sumar los días cerrados que coincidan con el mes y año seleccionado
    closedDays.forEach(day => {
      const parts = day.date.split('/'); // DD/MM/YYYY
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
