// ==================================================
// 🔥 Importar Firebase desde CDN (modo módulo)
// ==================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { getFirestore, collection, onSnapshot, doc, updateDoc, addDoc, getDocs, deleteDoc, query, where, runTransaction } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

// ==================================================
// ⚙️ Configuración de tu proyecto Firebase
// ==================================================
const firebaseConfig = {
  apiKey: "AIzaSyDFtBfNZKQijXbqxcSqVferaLXKdVEhHf8",
  authDomain: "panchelo.firebaseapp.com",
  projectId: "panchelo",
  storageBucket: "panchelo.firebasestorage.app",
  messagingSenderId: "1085862146003",
  appId: "1:1085862146003:web:e5e16f0fafe32ffff4c926"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ============================================
// FUNCIÓN: OBTENER FECHA ARGENTINA
// ============================================
function getArgentinaDate() {
    const now = new Date();
    const argTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' }));
    return argTime;
}

function getArgentinaDateString() {
    const argDate = getArgentinaDate();
    const year = argDate.getFullYear();
    const month = String(argDate.getMonth() + 1).padStart(2, '0');
    const day = String(argDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// ============================================
// FUNCIÓN: OBTENER SIGUIENTE NÚMERO DE PEDIDO
// ============================================
async function getNextOrderNumber() {
  const counterRef = doc(db, "counters", "orderCounter");
  
  try {
    const newNumber = await runTransaction(db, async (transaction) => {
      const counterDoc = await transaction.get(counterRef);
      
      if (!counterDoc.exists()) {
        transaction.set(counterRef, { current: 1 });
        return 1;
      }
      
      const currentNumber = counterDoc.data().current;
      const nextNumber = currentNumber + 1;
      
      transaction.update(counterRef, { current: nextNumber });
      return nextNumber;
    });
    
    return String(newNumber).padStart(3, '0');
    
  } catch (error) {
    console.error("Error al obtener número de pedido:", error);
    return String(Date.now()).slice(-6);
  }
}

// ============================================
// VARIABLES GLOBALES
// ============================================

let orders = {
    local: [],
    delivery: [],
    retiro: []
};

let lastOrderCount = 0;
let notificationSound = null;
let isFirstLoad = true;
let closeCashCheckShown = false;
let cashClosedToday = false;
let selectedProducts = [];

// ============================================
// INICIALIZACIÓN
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('Panel Admin cargado');
    
    initNavigation();
    initNotificationSound();
    initFilterButtons();
    initHorizontalForm();
    initCloseCashSystem();
    initCalendarSystem();
    
    checkIfCashClosedToday();
    listenToFirestoreOrders();
    
    setTimeout(() => {
        isFirstLoad = false;
        console.log('Primera carga completada - notificaciones activas');
    }, 3000);
    
    setInterval(() => {
        checkNewOrders();
    }, 5000);
    
    setInterval(() => {
        checkAutoCloseCash();
        checkAutomaticCloseCash();
        checkMidnightReset();
    }, 60000);
});

// ============================================
// SISTEMA DE CIERRE DE CAJA
// ============================================

function initCloseCashSystem() {
    const btnCloseCash = document.getElementById('btnCloseCash');
    const modal = document.getElementById('modalCierreCaja');
    const btnConfirm = document.getElementById('btnConfirmClose');
    const btnCancel = document.getElementById('btnCancelClose');
    
    btnCloseCash.addEventListener('click', () => {
        if (cashClosedToday) {
            showNotification('⚠️ La caja ya fue cerrada hoy. Se puede volver a cerrar mañana.');
            return;
        }
        openCloseCashModal();
    });
    
    btnCancel.addEventListener('click', () => {
        modal.style.display = 'none';
        closeCashCheckShown = true;
    });
    
    btnConfirm.addEventListener('click', async () => {
        await executeCloseCash();
        modal.style.display = 'none';
    });
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });
}

function openCloseCashModal() {
    if (cashClosedToday) {
        showNotification('⚠️ La caja ya fue cerrada hoy. Se puede volver a cerrar mañana.');
        return;
    }
    
    const modal = document.getElementById('modalCierreCaja');
    const summary = document.getElementById('modalSummary');
    
    const allOrders = [...orders.local, ...orders.delivery, ...orders.retiro];
    const completedOrders = allOrders.filter(o => o.estado === 'Completado');
    const totalRecaudado = completedOrders.reduce((sum, o) => sum + o.total, 0);
    const totalPedidos = completedOrders.length;
    const efectivo = completedOrders.filter(o => o.paymentMethod === 'Efectivo').reduce((sum, o) => sum + o.total, 0);
    const transferencia = completedOrders.filter(o => o.paymentMethod === 'Transferencia').reduce((sum, o) => sum + o.total, 0);
    
    summary.innerHTML = `
        <div class="summary-row">
            <span>💵 Total Recaudado:</span>
            <strong>${totalRecaudado}</strong>
        </div>
        <div class="summary-row">
            <span>📦 Pedidos Completados:</span>
            <strong>${totalPedidos}</strong>
        </div>
        <div class="summary-row">
            <span>💵 Efectivo:</span>
            <strong>${efectivo}</strong>
        </div>
        <div class="summary-row">
            <span>📱 Transferencia:</span>
            <strong>${transferencia}</strong>
        </div>
    `;
    
    modal.style.display = 'flex';
}

async function executeCloseCash() {
    try {
        const allOrders = [...orders.local, ...orders.delivery, ...orders.retiro];
        const dateStr = getArgentinaDateString();
        const completedOrders = allOrders.filter(o => o.estado === 'Completado');
        
        const summaryData = {
            fecha: dateStr,
            timestamp: Date.now(),
            totalRecaudado: completedOrders.reduce((sum, o) => sum + o.total, 0),
            totalPedidos: completedOrders.length,
            efectivo: completedOrders.filter(o => o.paymentMethod === 'Efectivo').reduce((sum, o) => sum + o.total, 0),
            transferencia: completedOrders.filter(o => o.paymentMethod === 'Transferencia').reduce((sum, o) => sum + o.total, 0),
            pedidos: allOrders.map(order => ({
                ...order,
                paymentMethod: order.paymentMethod || 'Efectivo',
                tipo: orders.local.includes(order) ? 'local' : orders.delivery.includes(order) ? 'delivery' : 'retiro'
            }))
        };
        
        await addDoc(collection(db, "historial"), summaryData);
        
        const tipos = ['local', 'delivery', 'retiro'];
        for (const tipo of tipos) {
            const ordersRef = collection(db, "orders", tipo, "lista");
            const snapshot = await getDocs(ordersRef);
            
            for (const docSnap of snapshot.docs) {
                await deleteDoc(doc(db, "orders", tipo, "lista", docSnap.id));
            }
        }
        
        cashClosedToday = true;
        localStorage.setItem('cashClosedDate', dateStr);
        disableCloseCashButton();
        
        showNotification('✅ Caja cerrada correctamente. Resumen guardado en historial.');
        closeCashCheckShown = false;
        
    } catch (error) {
        console.error('Error al cerrar caja:', error);
        showNotification('❌ Error al cerrar la caja');
    }
}

function checkAutoCloseCash() {
    const argDate = getArgentinaDate();
    const hour = argDate.getHours();
    
    if (hour === 23 && !closeCashCheckShown && !cashClosedToday) {
        openCloseCashModal();
        playNotificationSound();
        closeCashCheckShown = true;
    }
}

async function checkAutomaticCloseCash() {
    const argDate = getArgentinaDate();
    const hour = argDate.getHours();
    const minute = argDate.getMinutes();
    
    if (hour === 0 && minute === 0 && !cashClosedToday) {
        console.log('🔒 Cierre automático de caja - medianoche');
        await executeCloseCash();
        showNotification('🔒 La caja se cerró automáticamente a las 00:00');
    }
}

function checkMidnightReset() {
    const argDate = getArgentinaDate();
    const hour = argDate.getHours();
    const minute = argDate.getMinutes();
    
    if (hour === 0 && minute === 1) {
        closeCashCheckShown = false;
        cashClosedToday = false;
        localStorage.removeItem('cashClosedDate');
        enableCloseCashButton();
        console.log('✅ Nuevo día - sistema reseteado - botón habilitado');
    }
}

function checkIfCashClosedToday() {
    const today = getArgentinaDateString();
    const lastClosedDate = localStorage.getItem('cashClosedDate');
    
    if (lastClosedDate === today) {
        cashClosedToday = true;
        disableCloseCashButton();
        console.log('La caja ya fue cerrada hoy');
    } else {
        cashClosedToday = false;
        enableCloseCashButton();
    }
}

function disableCloseCashButton() {
    const btnCloseCash = document.getElementById('btnCloseCash');
    if (btnCloseCash) {
        btnCloseCash.style.opacity = '0.5';
        btnCloseCash.style.cursor = 'not-allowed';
        btnCloseCash.title = 'La caja ya fue cerrada hoy';
    }
}

function enableCloseCashButton() {
    const btnCloseCash = document.getElementById('btnCloseCash');
    if (btnCloseCash) {
        btnCloseCash.style.opacity = '1';
        btnCloseCash.style.cursor = 'pointer';
        btnCloseCash.title = 'Cerrar Caja';
    }
}

// ============================================
// SISTEMA DE CALENDARIO E HISTORIAL
// ============================================

function initCalendarSystem() {
    const dateSelector = document.getElementById('dateSelector');
    const btnPrint = document.getElementById('btnPrintReport');
    
    dateSelector.value = getArgentinaDateString();
    loadHistoryByDate(dateSelector.value);
    
    dateSelector.addEventListener('change', () => {
        loadHistoryByDate(dateSelector.value);
    });
    
    btnPrint.addEventListener('click', () => {
        printDayReport(dateSelector.value);
    });
}

async function loadHistoryByDate(dateStr) {
    try {
        const historialRef = collection(db, "historial");
        const q = query(historialRef, where("fecha", "==", dateStr));
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
            const today = getArgentinaDateString();
            if (dateStr === today) {
                console.log('Es HOY - mostrando pedidos actuales de Firebase');
                
                setTimeout(() => {
                    const allOrders = [
                        ...orders.local.map(o => ({...o, tipo: 'local'})),
                        ...orders.delivery.map(o => ({...o, tipo: 'delivery'})),
                        ...orders.retiro.map(o => ({...o, tipo: 'retiro'}))
                    ];
                    
                    if (allOrders.length > 0) {
                        updateHistorySection();
                    } else {
                        showEmptyHistory();
                    }
                }, 500);
            } else {
                showEmptyHistory();
            }
            return;
        }
        
        const historyData = snapshot.docs[0].data();
        displayHistoryData(historyData);
        
    } catch (error) {
        console.error('Error al cargar historial:', error);
        showEmptyHistory();
    }
}

function displayHistoryData(historyData) {
    const tbody = document.getElementById('historyTableBody');
    
    if (!historyData.pedidos || historyData.pedidos.length === 0) {
        showEmptyHistory();
        return;
    }
    
    tbody.innerHTML = historyData.pedidos.map(order => {
        const normalizedPayment = order.paymentMethod 
            ? order.paymentMethod.charAt(0).toUpperCase() + order.paymentMethod.slice(1).toLowerCase()
            : 'Efectivo';
        
        return `
            <tr class="history-row" 
                data-type="${order.tipo}" 
                data-estado="${order.estado.toLowerCase()}"
                data-payment="${normalizedPayment}">
                <td>${order.hora}</td>
                <td>#${order.orderNumber || order.id.substring(0, 8)}</td>
                <td>
                    <span class="type-badge type-${order.tipo}">
                        ${getTypeIcon(order.tipo)} ${getTypeName(order.tipo)}
                    </span>
                </td>
                <td>${order.items.length} items</td>
                <td>
                    <span class="payment-badge">
                        ${normalizedPayment === 'Efectivo' ? '💵' : '📱'} ${normalizedPayment}
                    </span>
                </td>
                <td class="table-price">$${order.total}</td>
                <td>
                    <span class="status-badge status-${getEstadoClass(order.estado)}">
                        ${order.estado}
                    </span>
                </td>
            </tr>
        `;
    }).join('');
}

function showEmptyHistory() {
    const tbody = document.getElementById('historyTableBody');
    tbody.innerHTML = `
        <tr class="empty-row">
            <td colspan="7">
                <div class="empty-state-small">
                    <p>No hay pedidos en esta fecha</p>
                </div>
            </td>
        </tr>
    `;
}

function printDayReport(dateStr) {
    const date = new Date(dateStr + 'T00:00:00');
    const dateFormatted = date.toLocaleDateString('es-AR', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
    
    const rows = document.querySelectorAll('.history-row');
    
    if (rows.length === 0) {
        showNotification('❌ No hay datos para imprimir');
        return;
    }
    
    let totalRecaudado = 0;
    let totalPedidos = 0;
    let efectivo = 0;
    let transferencia = 0;
    let tableContent = '';
    
    rows.forEach(row => {
        if (row.style.display !== 'none') {
            const cells = row.querySelectorAll('td');
            const precio = parseInt(cells[5].textContent.replace('$', '').replace(/\./g, ''));
            const metodoPago = cells[4].textContent.includes('Efectivo') ? 'Efectivo' : 'Transferencia';
            
            totalPedidos++;
            totalRecaudado += precio;
            
            if (metodoPago === 'Efectivo') {
                efectivo += precio;
            } else {
                transferencia += precio;
            }
            
            tableContent += `
                <tr>
                    <td>${cells[0].textContent}</td>
                    <td>${cells[1].textContent}</td>
                    <td>${cells[2].textContent.replace(/\s+/g, ' ').trim()}</td>
                    <td>${cells[3].textContent}</td>
                    <td>${cells[4].textContent.replace(/\s+/g, ' ').trim()}</td>
                    <td>${cells[5].textContent}</td>
                    <td>${cells[6].textContent.trim()}</td>
                </tr>
            `;
        }
    });
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Reporte - ${dateFormatted}</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; }
                .header { text-align: center; margin-bottom: 30px; border-bottom: 3px solid #FFC107; padding-bottom: 20px; }
                .header h1 { color: #FFC107; margin: 0; }
                .header h2 { color: #666; margin: 10px 0 0 0; font-weight: normal; }
                .summary { background: #f9f9f9; padding: 20px; border-radius: 10px; margin-bottom: 30px; border: 2px solid #FFC107; }
                .summary-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #ddd; }
                .summary-row:last-child { border-bottom: none; font-size: 1.2em; font-weight: bold; color: #FFC107; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th { background: #000; color: #FFC107; padding: 12px; text-align: left; font-weight: bold; }
                td { padding: 10px 12px; border-bottom: 1px solid #ddd; }
                tr:hover { background: #f9f9f9; }
                .footer { margin-top: 40px; text-align: center; color: #666; font-size: 0.9em; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>🌭 PANCHELO</h1>
                <h2>Reporte de Ventas</h2>
                <p>${dateFormatted}</p>
            </div>
            <div class="summary">
                <div class="summary-row"><span>📦 Total de Pedidos:</span><strong>${totalPedidos}</strong></div>
                <div class="summary-row"><span>💵 Efectivo:</span><strong>$${efectivo}</strong></div>
                <div class="summary-row"><span>📱 Transferencia:</span><strong>$${transferencia}</strong></div>
                <div class="summary-row"><span>💰 TOTAL RECAUDADO:</span><strong>$${totalRecaudado}</strong></div>
            </div>
            <table>
                <thead>
                    <tr><th>Hora</th><th>N° Pedido</th><th>Tipo</th><th>Items</th><th>Pago</th><th>Total</th><th>Estado</th></tr>
                </thead>
                <tbody>${tableContent}</tbody>
            </table>
            <div class="footer"><p>Generado el ${new Date().toLocaleString('es-AR')}</p></div>
        </body>
        </html>
    `);
    
    printWindow.document.close();
    setTimeout(() => { printWindow.print(); }, 500);
}

// ============================================
// FORMULARIO HORIZONTAL
// ============================================

function initHorizontalForm() {
    const accordionBtns = document.querySelectorAll('.accordion-btn-inline');
    accordionBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const content = this.nextElementSibling;
            const isOpen = content.classList.contains('open');
            
            document.querySelectorAll('.accordion-content-inline').forEach(c => c.classList.remove('open'));
            document.querySelectorAll('.accordion-btn-inline').forEach(b => b.classList.remove('active'));
            
            if (!isOpen) {
                content.classList.add('open');
                this.classList.add('active');
            }
        });
    });
    
    const productRows = document.querySelectorAll('.product-row-inline');
    productRows.forEach(row => {
        row.addEventListener('click', function() {
            const id = this.getAttribute('data-id');
            const name = this.getAttribute('data-name');
            const price = parseInt(this.getAttribute('data-price'));
            addProductToCart(id, name, price);
        });
    });
    
    const btnClear = document.getElementById('btnClearInline');
    if (btnClear) {
        btnClear.addEventListener('click', clearHorizontalForm);
    }
    
    const form = document.getElementById('formLocalOrder');
    if (form) {
        form.addEventListener('submit', handleHorizontalFormSubmit);
    }
}

function addProductToCart(id, name, price) {
    const existing = selectedProducts.find(p => p.id === id);
    
    if (existing) {
        existing.quantity += 1;
    } else {
        selectedProducts.push({ id, name, price, quantity: 1 });
    }
    
    updateHorizontalCart();
}

function updateHorizontalCart() {
    const cartItemsBox = document.getElementById('cartItemsBox');
    const totalInline = document.getElementById('totalInline');
    
    if (selectedProducts.length === 0) {
        cartItemsBox.innerHTML = '<div class="empty-cart-msg">Seleccioná productos para comenzar</div>';
        totalInline.textContent = '$0';
        
        document.querySelectorAll('.product-row-inline').forEach(row => {
            row.classList.remove('selected');
        });
        return;
    }
    
    document.querySelectorAll('.product-row-inline').forEach(row => {
        const id = row.getAttribute('data-id');
        const isSelected = selectedProducts.some(p => p.id === id);
        row.classList.toggle('selected', isSelected);
    });
    
    cartItemsBox.innerHTML = selectedProducts.map(product => `
        <div class="cart-item-inline">
            <div class="cart-item-info-inline">
                <span class="cart-item-name-inline">${product.name}</span>
                <span class="cart-item-price-inline">$${product.price} c/u</span>
            </div>
            <div class="cart-controls-inline">
                <button type="button" class="qty-btn-inline-cart" onclick="changeQuantity('${product.id}', -1)">-</button>
                <span class="qty-inline-cart">${product.quantity}</span>
                <button type="button" class="qty-btn-inline-cart" onclick="changeQuantity('${product.id}', 1)">+</button>
                <button type="button" class="remove-inline-cart" onclick="removeProduct('${product.id}')">🗑️</button>
            </div>
        </div>
    `).join('');
    
    const total = selectedProducts.reduce((sum, p) => sum + (p.price * p.quantity), 0);
    totalInline.textContent = `$${total}`;
}

window.changeQuantity = function(id, change) {
    const product = selectedProducts.find(p => p.id === id);
    if (!product) return;
    
    product.quantity += change;
    
    if (product.quantity <= 0) {
        selectedProducts = selectedProducts.filter(p => p.id !== id);
    }
    
    updateHorizontalCart();
};

window.removeProduct = function(id) {
    selectedProducts = selectedProducts.filter(p => p.id !== id);
    updateHorizontalCart();
};

function clearHorizontalForm() {
    if (selectedProducts.length > 0 || 
        document.getElementById('clientNameInline').value.trim() !== '' ||
        document.getElementById('observationsInline').value.trim() !== '') {
        if (confirm('¿Seguro que querés limpiar todo el pedido?')) {
            selectedProducts = [];
            document.getElementById('clientNameInline').value = '';
            document.getElementById('observationsInline').value = '';
            document.getElementById('paymentInline').value = 'Efectivo';
            updateHorizontalCart();
        }
    }
}

async function handleHorizontalFormSubmit(e) {
    e.preventDefault();
    
    if (selectedProducts.length === 0) {
        showNotification('❌ Agregá al menos un producto');
        return;
    }
    
    const clientName = document.getElementById('clientNameInline').value.trim();
    const observations = document.getElementById('observationsInline').value.trim();
    const paymentMethod = document.getElementById('paymentInline').value;
    
    const total = selectedProducts.reduce((sum, p) => sum + (p.price * p.quantity), 0);
    const orderNumber = await getNextOrderNumber();
    const normalizedPayment = paymentMethod.charAt(0).toUpperCase() + paymentMethod.slice(1).toLowerCase();
    
    const orderData = {
        orderNumber: orderNumber,
        hora: new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
        timestamp: Date.now(),
        items: selectedProducts.map(p => ({
            name: p.name,
            quantity: p.quantity,
            price: p.price
        })),
        total: total,
        estado: 'Pendiente',
        clientName: clientName,
        observations: observations,
        paymentMethod: normalizedPayment,
        type: 'local'
    };
    
    try {
        await addDoc(collection(db, "orders", "local", "lista"), orderData);
        showNotification('✅ Pedido agregado correctamente');
        
        selectedProducts = [];
        document.getElementById('clientNameInline').value = '';
        document.getElementById('observationsInline').value = '';
        document.getElementById('paymentInline').value = 'Efectivo';
        updateHorizontalCart();
        
        document.querySelectorAll('.accordion-content-inline').forEach(c => c.classList.remove('open'));
        document.querySelectorAll('.accordion-btn-inline').forEach(b => b.classList.remove('active'));
        
    } catch (error) {
        console.error('Error al guardar pedido:', error);
        showNotification('❌ Error al guardar el pedido');
    }
}

// ============================================
// NAVEGACIÓN
// ============================================

function initNavigation() {
    const navButtons = document.querySelectorAll('.nav-btn');
    const sections = document.querySelectorAll('.content-section');
    
    navButtons.forEach(button => {
        button.addEventListener('click', function() {
            const targetSection = this.getAttribute('data-section');
            
            navButtons.forEach(btn => btn.classList.remove('active'));
            sections.forEach(section => section.classList.remove('active'));
            
            this.classList.add('active');
            document.getElementById(`section-${targetSection}`).classList.add('active');
        });
    });
}

// ============================================
// NOTIFICACIÓN SONORA
// ============================================

function initNotificationSound() {
    notificationSound = document.getElementById('notificationSound');
}

function playNotificationSound() {
    if (!isFirstLoad && notificationSound) {
        notificationSound.currentTime = 0;
        notificationSound.play().catch(err => {
            console.log('No se pudo reproducir el sonido:', err);
        });
    }
}

// ============================================
// VERIFICAR NUEVOS PEDIDOS
// ============================================

function checkNewOrders() {
    const currentTotal = orders.local.length + orders.delivery.length + orders.retiro.length;
    
    if (!isFirstLoad && currentTotal > lastOrderCount) {
        const webOrders = orders.delivery.length + orders.retiro.length;
        const previousWebOrders = lastOrderCount - orders.local.length;
        
        if (webOrders > previousWebOrders) {
            playNotificationSound();
            showNotification('🔔 ¡Nuevo pedido recibido desde la web!');
        }
    }
    
    lastOrderCount = currentTotal;
}

// ============================================
// ESCUCHAR PEDIDOS DESDE FIRESTORE
// ============================================

function listenToFirestoreOrders() {
    const tipos = ["local", "delivery", "retiro"];

    tipos.forEach(tipo => {
        const colRef = collection(db, "orders", tipo, "lista");

        onSnapshot(colRef, (snapshot) => {
            orders[tipo] = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            console.log(`Pedidos ${tipo} actualizados:`, orders[tipo]);
            updateAllSections();
        });
    });
}

// ============================================
// ACTUALIZAR TODAS LAS SECCIONES
// ============================================

function updateAllSections() {
    updateOrdersSection('local');
    updateOrdersSection('delivery');
    updateOrdersSection('retiro');
    updateBadges();
    updateSalesSection();
    updateHistorySection();
}

// ============================================
// ACTUALIZAR BADGES
// ============================================

function updateBadges() {
    const activeLocal = orders.local.filter(o => o.estado !== 'Completado' && o.estado !== 'Cancelado').length;
    const activeDelivery = orders.delivery.filter(o => o.estado !== 'Completado' && o.estado !== 'Cancelado').length;
    const activeRetiro = orders.retiro.filter(o => o.estado !== 'Completado' && o.estado !== 'Cancelado').length;
    
    document.getElementById('badgeLocal').textContent = activeLocal;
    document.getElementById('badgeDelivery').textContent = activeDelivery;
    document.getElementById('badgeRetiro').textContent = activeRetiro;
    
    document.getElementById('badgeLocal').style.display = activeLocal > 0 ? 'flex' : 'none';
    document.getElementById('badgeDelivery').style.display = activeDelivery > 0 ? 'flex' : 'none';
    document.getElementById('badgeRetiro').style.display = activeRetiro > 0 ? 'flex' : 'none';
}

// ============================================
// ACTUALIZAR SECCIÓN DE PEDIDOS
// ============================================

function updateOrdersSection(type) {
    const container = document.getElementById(`orders${capitalize(type)}`);
    const ordersList = orders[type].filter(o => o.estado !== 'Completado' && o.estado !== 'Cancelado');
    
    if (ordersList.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">${getTypeIcon(type)}</div>
                <h3>No hay pedidos de ${getTypeName(type)}</h3>
                <p>Los pedidos aparecerán aquí automáticamente</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = ordersList.map(order => createOrderCard(order, type)).join('');
    attachOrderEventListeners(type);
}

// ============================================
// CREAR TARJETA DE PEDIDO
// ============================================

function createOrderCard(order, type) {
    const estadoClass = getEstadoClass(order.estado);
    const showDeliveryInfo = type === 'delivery' && order.direccion;
    const showClientName = order.clientName && order.clientName.trim() !== '';
    const showObservations = order.observations;
    const displayNumber = order.orderNumber || order.id.substring(0, 8);
    
    return `
        <div class="order-card ${estadoClass}" data-order-id="${order.id}" data-type="${type}">
            <div class="order-header">
                <div class="order-number">
                    <span class="order-label">PEDIDO</span>
                    <span class="order-id">#${displayNumber}</span>
                </div>
                <div class="order-time">${order.hora}</div>
            </div>
            
            ${showClientName ? `
                <div class="client-info">
                    <div class="client-row">
                        <span class="client-icon">👤</span>
                        <span>${order.clientName}</span>
                    </div>
                </div>
            ` : ''}
            
            <div class="order-items">
                ${order.items.map(item => `
                    <div class="order-item">
                        <span class="item-qty">${item.quantity}x</span>
                        <span class="item-name">${item.name}</span>
                        <span class="item-price">${item.price * item.quantity}</span>
                    </div>
                `).join('')}
            </div>
            
            ${showObservations ? `
                <div class="order-observations">
                    <div class="obs-header">
                        <span class="obs-icon">📝</span>
                        <span class="obs-title">Observaciones:</span>
                    </div>
                    <p class="obs-text">${order.observations}</p>
                </div>
            ` : ''}
            
            ${showDeliveryInfo ? `
                <div class="delivery-info">
                    <div class="delivery-row">
                        <span class="delivery-icon">📍</span>
                        <span>${order.direccion}</span>
                    </div>
                    ${order.piso ? `
                        <div class="delivery-row">
                            <span class="delivery-icon">🏢</span>
                            <span>Piso/Depto: ${order.piso}</span>
                        </div>
                    ` : ''}
                    <div class="delivery-row">
                        <span class="delivery-icon">📞</span>
                        <span>${order.telefono}</span>
                    </div>
                    ${order.indicaciones ? `
                        <div class="delivery-row">
                            <span class="delivery-icon">💬</span>
                            <span>${order.indicaciones}</span>
                        </div>
                    ` : ''}
                </div>
            ` : ''}
            
            <div class="order-total">
                <span>Total:</span>
                <span class="total-amount">${order.total}</span>
            </div>
            
            ${order.paymentMethod ? `
                <div class="payment-method-display">
                    <span class="payment-icon-display">${order.paymentMethod === 'Efectivo' ? '💵' : '📱'}</span>
                    <span class="payment-text-display">${order.paymentMethod}</span>
                </div>
            ` : ''}
            
            ${order.estado === 'Pendiente' ? `
                <div class="order-actions">
                    <button class="btn-action btn-accept" data-action="accept">
                        ✓ Aceptar
                    </button>
                    <button class="btn-action btn-reject" data-action="reject">
                        ✕ Rechazar
                    </button>
                </div>
            ` : `
                <div class="order-status">
                    <span class="status-badge status-${estadoClass}">${order.estado}</span>
                </div>
                
                <div class="order-actions">
                    ${order.estado === 'Preparando' ? `
                        ${type === 'delivery' ? `
                            <button class="btn-action btn-next" data-action="encamino">
                                🏍️ En Camino
                            </button>
                        ` : `
                            <button class="btn-action btn-next" data-action="listo">
                                ✓ Listo
                            </button>
                        `}
                    ` : ''}
                    
                    ${order.estado === 'En Camino' ? `
                        <button class="btn-action btn-next" data-action="entregado">
                            ✓ Entregado
                        </button>
                    ` : ''}
                    
                    ${order.estado === 'Listo' ? `
                        <button class="btn-action btn-next" data-action="entregado">
                            ✓ Entregado
                        </button>
                    ` : ''}
                </div>
            `}
        </div>
    `;
}

// ============================================
// EVENT LISTENERS DE PEDIDOS
// ============================================

function attachOrderEventListeners(type) {
    const container = document.getElementById(`orders${capitalize(type)}`);
    
    container.querySelectorAll('.btn-action').forEach(button => {
        button.addEventListener('click', function() {
            const card = this.closest('.order-card');
            const orderId = card.getAttribute('data-order-id');
            const action = this.getAttribute('data-action');
            
            handleOrderAction(orderId, type, action);
        });
    });
}

// ============================================
// MANEJAR ACCIONES DE PEDIDOS
// ============================================

async function handleOrderAction(orderId, type, action) {
    const order = orders[type].find(o => o.id === orderId);
    if (!order) return;
    
    let newEstado = order.estado;
    
    switch(action) {
        case 'accept':
            newEstado = 'Preparando';
            showNotification('✅ Pedido aceptado');
            break;
            
        case 'reject':
            if (confirm('¿Está seguro que desea rechazar este pedido?')) {
                newEstado = 'Cancelado';
                showNotification('❌ Pedido cancelado');
            } else {
                return;
            }
            break;
            
        case 'encamino':
            newEstado = 'En Camino';
            showNotification('🏍️ Pedido en camino');
            break;
            
        case 'listo':
            newEstado = 'Listo';
            showNotification('✅ Pedido listo para retirar');
            break;
            
        case 'entregado':
            newEstado = 'Completado';
            showNotification('✅ Pedido completado');
            break;
    }
    
    try {
        const docRef = doc(db, "orders", type, "lista", orderId);
        await updateDoc(docRef, {
            estado: newEstado,
            horaCompletado: newEstado === 'Completado' ? new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : null
        });
        console.log('Estado actualizado en Firebase');
    } catch (error) {
        console.error('Error al actualizar estado:', error);
        showNotification('❌ Error al actualizar el pedido');
    }
}

// ============================================
// ACTUALIZAR SECCIÓN DE VENTAS
// ============================================

function updateSalesSection() {
    const allOrders = [...orders.local, ...orders.delivery, ...orders.retiro];
    const completedOrders = allOrders.filter(o => o.estado === 'Completado');
    
    const totalRecaudado = completedOrders.reduce((sum, o) => sum + o.total, 0);
    const totalPedidos = completedOrders.length;
    const ticketPromedio = totalPedidos > 0 ? Math.round(totalRecaudado / totalPedidos) : 0;
    const totalDelivery = orders.delivery.filter(o => o.estado === 'Completado').length;
    
    document.getElementById('totalRecaudado').textContent = `${totalRecaudado}`;
    document.getElementById('totalPedidos').textContent = totalPedidos;
    document.getElementById('ticketPromedio').textContent = `${ticketPromedio}`;
    document.getElementById('totalDelivery').textContent = totalDelivery;
    
    const efectivoOrders = completedOrders.filter(o => o.paymentMethod === 'Efectivo');
    const transferenciaOrders = completedOrders.filter(o => o.paymentMethod === 'Transferencia');
    
    document.getElementById('montoEfectivo').textContent = `${efectivoOrders.reduce((sum, o) => sum + o.total, 0)}`;
    document.getElementById('montoTransferencia').textContent = `${transferenciaOrders.reduce((sum, o) => sum + o.total, 0)}`;
    
    const completedLocal = orders.local.filter(o => o.estado === 'Completado');
    const completedDelivery = orders.delivery.filter(o => o.estado === 'Completado');
    const completedRetiro = orders.retiro.filter(o => o.estado === 'Completado');
    
    document.getElementById('cantidadLocal').textContent = completedLocal.length;
    document.getElementById('montoLocal').textContent = `${completedLocal.reduce((sum, o) => sum + o.total, 0)}`;
    
    document.getElementById('cantidadDelivery').textContent = completedDelivery.length;
    document.getElementById('montoDelivery').textContent = `${completedDelivery.reduce((sum, o) => sum + o.total, 0)}`;
    
    document.getElementById('cantidadRetiro').textContent = completedRetiro.length;
    document.getElementById('montoRetiro').textContent = `${completedRetiro.reduce((sum, o) => sum + o.total, 0)}`;
    
    const completados = allOrders.filter(o => o.estado === 'Completado');
    const pendientes = allOrders.filter(o => o.estado === 'Pendiente' || o.estado === 'Preparando' || o.estado === 'En Camino' || o.estado === 'Listo');
    const cancelados = allOrders.filter(o => o.estado === 'Cancelado');
    
    document.getElementById('cantidadCompletados').textContent = completados.length;
    document.getElementById('montoCompletados').textContent = `${completados.reduce((sum, o) => sum + o.total, 0)}`;
    
    document.getElementById('cantidadPendientes').textContent = pendientes.length;
    document.getElementById('montoPendientes').textContent = `${pendientes.reduce((sum, o) => sum + o.total, 0)}`;
    
    document.getElementById('cantidadCancelados').textContent = cancelados.length;
    document.getElementById('montoCancelados').textContent = `${cancelados.reduce((sum, o) => sum + o.total, 0)}`;
}

// ============================================
// ACTUALIZAR SECCIÓN DE HISTORIAL
// ============================================

function updateHistorySection() {
    const tbody = document.getElementById('historyTableBody');
    const allOrders = [
        ...orders.local.map(o => ({...o, tipo: 'local'})),
        ...orders.delivery.map(o => ({...o, tipo: 'delivery'})),
        ...orders.retiro.map(o => ({...o, tipo: 'retiro'}))
    ].sort((a, b) => b.timestamp - a.timestamp);
    
    if (allOrders.length === 0) {
        tbody.innerHTML = `
            <tr class="empty-row">
                <td colspan="7">
                    <div class="empty-state-small">
                        <p>No hay pedidos en el historial</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = allOrders.map(order => {
        const displayNumber = order.orderNumber || order.id.substring(0, 8);
        const normalizedPayment = order.paymentMethod 
            ? order.paymentMethod.charAt(0).toUpperCase() + order.paymentMethod.slice(1).toLowerCase()
            : 'Efectivo';
        
        return `
            <tr class="history-row" 
                data-type="${order.tipo}" 
                data-estado="${order.estado.toLowerCase()}"
                data-payment="${normalizedPayment}">
                <td>${order.hora}</td>
                <td>#${displayNumber}</td>
                <td>
                    <span class="type-badge type-${order.tipo}">
                        ${getTypeIcon(order.tipo)} ${getTypeName(order.tipo)}
                    </span>
                </td>
                <td>${order.items.length} items</td>
                <td>
                    <span class="payment-badge">
                        ${normalizedPayment === 'Efectivo' ? '💵' : '📱'} ${normalizedPayment}
                    </span>
                </td>
                <td class="table-price">${order.total}</td>
                <td>
                    <span class="status-badge status-${getEstadoClass(order.estado)}">
                        ${order.estado}
                    </span>
                </td>
            </tr>
        `;
    }).join('');
}

// ============================================
// FILTROS DE HISTORIAL - CORREGIDO ✅
// ============================================

function initFilterButtons() {
    const filterButtons = document.querySelectorAll('.filter-btn');
    
    filterButtons.forEach(button => {
        button.addEventListener('click', function() {
            const filter = this.getAttribute('data-filter');
            
            filterButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            
            applyHistoryFilter(filter);
        });
    });
}

function applyHistoryFilter(filter) {
    const rows = document.querySelectorAll('.history-row');
    
    rows.forEach(row => {
        const tipo = row.getAttribute('data-type');
        const estado = row.getAttribute('data-estado');
        const payment = row.getAttribute('data-payment');
        
        let shouldShow = false;
        
        if (filter === 'all') {
            shouldShow = true;
        } 
        else if (filter === 'local' || filter === 'delivery' || filter === 'retiro') {
            shouldShow = tipo === filter;
        } 
        else if (filter === 'completado' || filter === 'cancelado') {
            shouldShow = estado === filter;
        } 
        else if (filter === 'efectivo' || filter === 'transferencia') {
            const normalizedFilter = filter.charAt(0).toUpperCase() + filter.slice(1).toLowerCase();
            const normalizedPayment = payment ? payment.charAt(0).toUpperCase() + payment.slice(1).toLowerCase() : 'Efectivo';
            
            shouldShow = normalizedPayment === normalizedFilter;
            
            console.log('Filtro:', normalizedFilter, '| Payment:', normalizedPayment, '| Coincide:', shouldShow);
        }
        
        row.style.display = shouldShow ? '' : 'none';
    });
}

// ============================================
// FUNCIONES AUXILIARES
// ============================================

function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function getTypeIcon(type) {
    const icons = {
        local: '🏪',
        delivery: '🏍️',
        retiro: '📦'
    };
    return icons[type] || '📦';
}

function getTypeName(type) {
    const names = {
        local: 'En Local',
        delivery: 'Delivery',
        retiro: 'Para Retirar'
    };
    return names[type] || type;
}

function getEstadoClass(estado) {
    const classes = {
        'Pendiente': 'pending',
        'Preparando': 'preparing',
        'En Camino': 'delivery',
        'Listo': 'ready',
        'Completado': 'completed',
        'Cancelado': 'cancelled'
    };
    return classes[estado] || 'pending';
}

// ============================================
// NOTIFICACIÓN TEMPORAL
// ============================================

function showNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'toast-notification';
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => notification.classList.add('show'), 10);
    
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}