document.addEventListener('DOMContentLoaded', () => {
  let items = [];

  const clientNameInput = document.getElementById('clientName');
  const workTitleInput = document.getElementById('workTitle');
  const itemDescInput = document.getElementById('itemDesc');
  const itemPriceInput = document.getElementById('itemPrice');
  const depositPercentInput = document.getElementById('depositPercent');

  const btnAddItem = document.getElementById('btnAddItem');
  const btnWhatsApp = document.getElementById('btnWhatsApp');
  const btnPrint = document.getElementById('btnPrint');

  const itemsList = document.getElementById('itemsList');
  const lblTotal = document.getElementById('lblTotal');
  const lblDeposit = document.getElementById('lblDeposit');
  const lblBalance = document.getElementById('lblBalance');
  const depositDetailsContainer = document.getElementById('depositDetailsContainer');

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

  // Renderizar tabla y calcular totales
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

    // Mostrar u ocultar la sección de seña según si el porcentaje es mayor a 0
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

  // Eliminar ítem
  window.removeItem = (index) => {
    items.splice(index, 1);
    renderItems();
  };

  depositPercentInput.addEventListener('input', renderItems);

  // Enviar mensaje por WhatsApp (Sin saludo repetido)
  btnWhatsApp.addEventListener('click', () => {
    const client = clientNameInput.value.trim();
    const work = workTitleInput.value.trim();

    if (items.length === 0) {
      alert('Agrega al menos un ítem antes de enviar.');
      return;
    }

    let total = items.reduce((acc, i) => acc + i.price, 0);
    let percent = parseFloat(depositPercentInput.value) || 0;

    let text = `📌 *Cotización${work ? ' para ' + work : ''}*${client ? ' (' + client + ')' : ''}:\n\n`;
    text += `📋 *Detalle:*\n`;

    items.forEach(i => {
      text += `• ${i.desc}: $${i.price.toLocaleString()}\n`;
    });

    text += `\n💵 *Total General:* $${total.toLocaleString()}\n`;
    
    // Solo incluye la seña si el porcentaje es mayor a 0
    if (percent > 0) {
      let deposit = (total * percent) / 100;
      let balance = total - deposit;
      text += `💳 *Seña requerida (${percent}%):* $${deposit.toLocaleString()}\n`;
      text += `📌 *Saldo restante:* $${balance.toLocaleString()}\n`;
    }

    text += `\n¿Te gustaría confirmarlo o tenés alguna consulta?`;

    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  });

  // Preparar e imprimir en PDF
  btnPrint.addEventListener('click', () => {
    if (items.length === 0) {
      alert('Agrega al menos un ítem para imprimir.');
      return;
    }

    document.getElementById('printClient').textContent = clientNameInput.value || 'N/A';
    document.getElementById('printWork').textContent = workTitleInput.value || 'N/A';
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

    window.print();
  });
});
