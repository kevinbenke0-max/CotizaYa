document.addEventListener('DOMContentLoaded', () => {
  let movements = JSON.parse(localStorage.getItem('cashMovements')) || [];

  const movDescInput = document.getElementById('movDesc');
  const movAmountInput = document.getElementById('movAmount');
  const movTypeSelect = document.getElementById('movType');
  const btnAddMov = document.getElementById('btnAddMov');
  const btnClearDay = document.getElementById('btnClearDay');

  const movList = document.getElementById('movList');
  const lblTotalIncome = document.getElementById('lblTotalIncome');
  const lblTotalExpense = document.getElementById('lblTotalExpense');
  const lblNetBalance = document.getElementById('lblNetBalance');

  renderMovements();

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

  btnClearDay.addEventListener('click', () => {
    if (confirm('¿Deseas vaciar los registros y cerrar la caja de hoy?')) {
      movements = [];
      localStorage.removeItem('cashMovements');
      renderMovements();
    }
  });
});
