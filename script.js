document.addEventListener('DOMContentLoaded', () => {
  let movements = JSON.parse(localStorage.getItem('cashMovements')) || [];
  let closedDays = JSON.parse(localStorage.getItem('closedDaysHistory')) || [];

  const movDescInput = document.getElementById('movDesc');
  const movAmountInput = document.getElementById('movAmount');
  const movTypeSelect = document.getElementById('movType');
  const btnAddMov = document.getElementById('btnAddMov');
  const btnCloseDay = document.getElementById('btnCloseDay');
  const btnClearHistory = document.getElementById('btnClearHistory');

  const movList = document.getElementById('movList');
  const closedDaysList = document.getElementById('closedDaysList');
  const lblTotalIncome = document.getElementById('lblTotalIncome');
  const lblTotalExpense = document.getElementById('lblTotalExpense');
  const lblNetBalance = document.getElementById('lblNetBalance');

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

  // Botón para Cerrar el Día y guardarlo en el historial
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

      // Guardar en el historial de días cerrados
      closedDays.unshift({
        date: dateStr,
        income: totalIncome,
        expense: totalExpense,
        net: net
      });

      localStorage.setItem('closedDaysHistory', JSON.stringify(closedDays));

      // Vaciar los movimientos del día actual
      movements = [];
      localStorage.removeItem('cashMovements');

      renderMovements();
      renderClosedDays();
      alert('¡Cierre de caja guardado con éxito en el historial!');
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

  window.deleteClosedDay = (idx) => {
    if (confirm('¿Eliminar este cierre del historial?')) {
      closedDays.splice(idx, 1);
      localStorage.setItem('closedDaysHistory', JSON.stringify(closedDays));
      renderClosedDays();
    }
  };

  btnClearHistory.addEventListener('click', () => {
    if (confirm('¿Deseas borrar todo el historial de cierres anteriores?')) {
      closedDays = [];
      localStorage.removeItem('closedDaysHistory');
      renderClosedDays();
    }
  });
});
