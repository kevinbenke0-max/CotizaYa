document.addEventListener('DOMContentLoaded', () => {
  let items = [];
  let history = JSON.parse(localStorage.getItem('quoteHistory')) || [];

  const businessNameInput = document.getElementById('businessName');
  const paymentDetailsInput = document.getElementById('paymentDetails');
  const clientNameInput = document.getElementById('clientName');
  const workTitleInput = document.getElementById('workTitle');
  const validityDaysInput = document.getElementById('validityDays');
  
  const itemDescInput = document.getElementById('itemDesc');
  const itemPriceInput = document.getElementById('itemPrice');
  const depositPercentInput = document.getElementById('depositPercent');

  const btnAddItem = document.getElementById('btnAddItem');
  const btnWhatsApp = document.getElementById('btnWhatsApp');
  const btnPrint = document.getElementById('btnPrint');
  const btnClearHistory = document.getElementById('btnClearHistory');

  const itemsList = document.getElementById('itemsList');
  const historyList = document.getElementById('historyList');
  const lblTotal = document.getElementById('lblTotal');
  const lblDeposit = document.getElementById('lblDeposit');
  const lblBalance = document.getElementById('lblBalance');
  const depositDetailsContainer = document.getElementById('depositDetailsContainer');

  // Cargar datos persistentes del negocio
  if (localStorage.getItem('bizName')) businessNameInput.value = localStorage.getItem('bizName');
  if (localStorage.getItem('bizPayment')) paymentDetailsInput.value = localStorage.getItem('bizPayment');

  businessNameInput.addEventListener('input', () => localStorage.setItem('bizName', businessNameInput.value));
  paymentDetailsInput.addEventListener('input', () => localStorage.setItem('bizPayment', paymentDetailsInput.value));

  renderHistory();

  // Agregar Ítem
  btnAddItem.addEventListener('click', () => {
    const desc = itemDescInput.value.trim();
    const price = parseFloat(itemPriceInput.value);

    if (!desc || isNaN(price) || price <= 0) {
      alert('Por favor, ingresa una descripción y un precio válido.');
      return;
    }

    items.push({ desc, price });
    itemDescInput.value = '';
    itemPriceInput.value = '';
    renderItems();
  });

  function renderItems() {
    itemsList.innerHTML = '';
    let total = 0;

    items.forEach((item, index) => {
      total += item.price;
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${item.desc}</td>
        <td>$${item.price.toLocaleString()}</td>
        <td style="text-align: right;">
          <button class="btn btn-danger" onclick="removeItem(${index})">X</button>
        </td>
      `;
      itemsList.appendChild(row);
    });

    const percent = parseFloat(depositPercentInput.value) || 0;
    lblTotal.textContent = `$${total.toLocaleString()}`;

    if (percent > 0) {
      const deposit = (total * percent) / 100;
      const balance = total - deposit;
      lblDeposit.textContent = `$${deposit.toLocaleString()}`;
      lblBalance.textContent = `$${balance.toLocaleString()}`;
      depositDetailsContainer.style.display = 'block';
    } else {
      depositDetailsContainer.style.display = 'none';
    }
  }

  window.removeItem = (index) => {
    items.splice(index, 1);
    renderItems();
  };

  depositPercentInput.addEventListener('input', renderItems);

  // Enviar presupuesto y GUARDAR
  btnWhatsApp.addEventListener('click', () => {
    if (items.length === 0) {
      alert('Agrega al menos un ítem antes de enviar.');
      return;
    }

    const biz = businessNameInput.value.trim();
    const client = clientNameInput.value.trim() || 'Cliente';
    const work = workTitleInput.value.trim() || 'Trabajo general';
    const payment = paymentDetailsInput.value.trim();
    const days = validityDaysInput.value || '7';

    let total = items.reduce((acc, i) => acc + i.price, 0);
    let percent = parseFloat(depositPercentInput.value) || 0;

    const quoteNum = Math.floor(1000 + Math.random() * 9000);

    // 1. Guardar de inmediato en el historial ANTES de abrir WhatsApp
    saveToHistory({ client, work, total, date: new Date().toLocaleDateString('es-AR') });

    let text = `📄 *COTIZACIÓN OFICIAL${biz ? ' - ' + biz.toUpperCase() : ''}*\n`;
    text += `🧾 *N°:* `#COT-${quoteNum}`\n`;
    text += `👤 *Cliente:* ${client}\n`;
    text += `🎯 *Concepto:* ${work}\n`;
    text += `⏳ *Validez:* ${days} días\n\n`;

    text += `📋 *DESGLOSE DEL PEDIDO:*\n`;
    items.forEach(i => {
      text += `• ${i.desc}: $${i.price.toLocaleString()}\n`;
    });

    text += `\n💳 *RESUMEN FINANCIERO:*\n`;
    text += `💵 *Total:* $${total.toLocaleString()}\n`;

    if (percent > 0) {
      let deposit = (total * percent) / 100;
      let balance = total - deposit;
      text += `📌 *Seña requerida (${percent}%):* $${deposit.toLocaleString()}\n`;
      text += `🔹 *Saldo a la entrega:* $${balance.toLocaleString()}\n`;
    }

    if (payment) {
      text += `\n🏦 *DATOS DE PAGO / TRANSFERENCIA:*\n${payment}\n`;
    }

    text += `\n⏱️ *Por favor, enviar comprobante por este medio para confirmar el pedido.*`;

    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    
    // Pequeño retardo para dar tiempo a que el navegador guarde los datos en pantalla
    setTimeout(() => {
      window.open(url, '_blank');
    }, 100);
  });

  // Funciones del Historial Local
  function saveToHistory(record) {
    history.unshift(record);
    if (history.length > 10) history.pop();
    localStorage.setItem('quoteHistory', JSON.stringify(history));
    renderHistory();
  }

  function renderHistory() {
    historyList.innerHTML = '';
    if (history.length === 0) {
      historyList.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#999;">Sin cotizaciones guardadas</td></tr>';
      return;
    }

    history.forEach((rec, idx) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${rec.client}</strong><br><small>${rec.date}</small></td>
        <td>${rec.work}</td>
        <td>$${rec.total.toLocaleString()}</td>
        <td><button class="btn btn-danger-soft" onclick="deleteHistoryItem(${idx})">x</button></td>
      `;
      historyList.appendChild(tr);
    });
  }

  window.deleteHistoryItem = (idx) => {
    history.splice(idx, 1);
    localStorage.setItem('quoteHistory', JSON.stringify(history));
    renderHistory();
  };

  btnClearHistory.addEventListener('click', () => {
    if (confirm('¿Deseas borrar todo el historial?')) {
      history = [];
      localStorage.removeItem('quoteHistory');
      renderHistory();
    }
  });

  // Imprimir / PDF
  btnPrint.addEventListener('click', () => {
    if (items.length === 0) {
      alert('Agrega al menos un ítem para imprimir.');
      return;
    }

    document.getElementById('printBusiness').textContent = businessNameInput.value.toUpperCase() || 'PRESUPUESTO / COTIZACIÓN';
    document.getElementById('printClient').textContent = clientNameInput.value || 'N/A';
    document.getElementById('printWork').textContent = workTitleInput.value || 'N/A';
    document.getElementById('printValidity').textContent = validityDaysInput.value || '7';
    document.getElementById('printDate').textContent = new Date().toLocaleDateString('es-AR');

    const printList = document.getElementById('printItemsList');
    printList.innerHTML = '';
    let total = 0;

    items.forEach(i => {
      total += i.price;
      printList.innerHTML += `
        <tr>
          <td>${i.desc}</td>
          <td style="text-align: right;">$${i.price.toLocaleString()}</td>
        </tr>
      `;
    });

    let percent = parseFloat(depositPercentInput.value) || 0;
    document.getElementById('printTotal').textContent = `$${total.toLocaleString()}`;

    const printDepositSection = document.getElementById('printDepositSection');
    if (percent > 0) {
      let deposit = (total * percent) / 100;
      document.getElementById('printDeposit').textContent = `$${deposit.toLocaleString()}`;
      document.getElementById('printBalance').textContent = `$${(total - deposit).toLocaleString()}`;
      printDepositSection.style.display = 'block';
    } else {
      printDepositSection.style.display = 'none';
    }

    if (paymentDetailsInput.value.trim()) {
      document.getElementById('printPayment').textContent = `Datos de Pago: ${paymentDetailsInput.value.trim()}`;
    }

    window.print();
  });
});
