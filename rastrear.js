// ==================================================
// 🔥 Importar Firebase desde CDN (modo módulo)
// ==================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { getFirestore, collection, query, where, onSnapshot, getDocs, doc, updateDoc } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

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

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Variables globales
let currentOrderData = null;
let unsubscribeListener = null;

// ============================================
// INICIALIZACIÓN
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    initTrackingForm();
    initNavigation();
});

// ============================================
// NAVEGACIÓN (reutilizado de java.js)
// ============================================

function initNavigation() {
    const hamburger = document.getElementById('hamburger');
    const mobileMenu = document.getElementById('mobileMenu');
    const navLinks = document.querySelectorAll('.nav-link, .mobile-nav-link');

    if (hamburger) {
        hamburger.addEventListener('click', function() {
            hamburger.classList.toggle('active');
            mobileMenu.classList.toggle('active');
        });
    }

    navLinks.forEach(link => {
        link.addEventListener('click', function() {
            if (hamburger) hamburger.classList.remove('active');
            if (mobileMenu) mobileMenu.classList.remove('active');
        });
    });
}

// ============================================
// FORMULARIO DE RASTREO
// ============================================

function initTrackingForm() {
    const form = document.getElementById('trackForm');
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const orderNumber = document.getElementById('orderNumber').value.trim();
        const phoneNumber = document.getElementById('phoneNumber').value.trim();
        
        if (!orderNumber || !phoneNumber) {
            showNotification('❌ Por favor completá todos los campos');
            return;
        }
        
        await searchOrder(orderNumber, phoneNumber);
    });
}

// ============================================
// BUSCAR PEDIDO EN FIREBASE - CORREGIDO
// ============================================

async function searchOrder(orderNumber, phoneNumber) {
    showNotification('🔍 Buscando tu pedido...');
    
    try {
        // Limpiar el número de teléfono del usuario (quitar espacios, guiones)
        const cleanPhone = phoneNumber.replace(/\s|-/g, '');
        
        console.log('Buscando pedido:', orderNumber);
        console.log('Teléfono limpio:', cleanPhone);
        
        // 🔥 BUSCAR EN DELIVERY Y RETIRO (no en local)
        const tipos = ['delivery', 'retiro'];
        let foundOrder = null;
        let foundType = null;
        let foundDocId = null;
        
        for (const tipo of tipos) {
            console.log(`Buscando en colección: orders/${tipo}/lista`);
            
            const ordersRef = collection(db, "orders", tipo, "lista");
            const q = query(ordersRef, where("orderNumber", "==", orderNumber));
            const snapshot = await getDocs(q);
            
            console.log(`Documentos encontrados en ${tipo}:`, snapshot.size);
            
            if (!snapshot.empty) {
                const orderDoc = snapshot.docs[0];
                const orderData = orderDoc.data();
                
                console.log('Datos del pedido encontrado:', orderData);
                
                // 🔥 CORREGIDO: Verificar que tenga teléfono
                let orderPhone = '';
                if (orderData.telefono) {
                    orderPhone = orderData.telefono.replace(/\s|-/g, '');
                } else {
                    console.log('⚠️ Este pedido no tiene teléfono registrado');
                    continue; // Seguir buscando en otros tipos
                }
                
                console.log('Teléfono del pedido limpio:', orderPhone);
                
                // 🔥 CORREGIDO: Comparar teléfonos limpios
                if (orderPhone === cleanPhone) {
                    foundOrder = {
                        id: orderDoc.id,
                        ...orderData
                    };
                    foundType = tipo;
                    foundDocId = orderDoc.id;
                    console.log('✅ Pedido encontrado y verificado!');
                    break;
                } else {
                    console.log('❌ Teléfono no coincide');
                }
            }
        }
        
        if (foundOrder) {
            currentOrderData = { ...foundOrder, type: foundType, docId: foundDocId };
            showOrderTracking(foundOrder, foundType, foundDocId);
            startRealtimeTracking(foundDocId, foundType);
        } else {
            console.log('❌ No se encontró el pedido o el teléfono no coincide');
            showNotification('❌ No encontramos tu pedido. Verificá el número y teléfono.');
        }
        
    } catch (error) {
        console.error('Error al buscar pedido:', error);
        showNotification('❌ Error al buscar el pedido. Intentá de nuevo.');
    }
}

// ============================================
// MOSTRAR SEGUIMIENTO DEL PEDIDO
// ============================================

function showOrderTracking(order, type, docId) {
    const loginBox = document.getElementById('trackLoginBox');
    const statusBox = document.getElementById('trackStatusBox');
    
    loginBox.style.display = 'none';
    statusBox.style.display = 'block';
    
    statusBox.innerHTML = generateTrackingHTML(order, type, docId);
    
    // Agregar botón de volver
    const btnBack = statusBox.querySelector('#btnBackToSearch');
    if (btnBack) {
        btnBack.addEventListener('click', () => {
            if (unsubscribeListener) {
                unsubscribeListener();
            }
            loginBox.style.display = 'block';
            statusBox.style.display = 'none';
        });
    }
    
    // Agregar botón de cancelar
    const btnCancel = statusBox.querySelector('#btnCancelOrder');
    if (btnCancel) {
        btnCancel.addEventListener('click', () => {
            confirmCancelOrder(docId, type);
        });
    }
}

// ============================================
// GENERAR HTML DEL SEGUIMIENTO
// ============================================

function generateTrackingHTML(order, type, docId) {
    const estado = order.estado;
    const isDelivery = type === 'delivery';
    const isCompleted = estado === 'Completado';
    const isCancelled = estado === 'Cancelado';
    
    // 🔥 CORREGIDO: Solo se puede cancelar si está Pendiente o Preparando
    const canCancel = estado === 'Pendiente' || estado === 'Preparando';
    
    // Determinar los pasos según el tipo
    let steps = [];
    if (isDelivery) {
        steps = [
            { name: 'Pendiente', icon: '⏳', status: 'Pendiente' },
            { name: 'Preparando', icon: '👨‍🍳', status: 'Preparando' },
            { name: 'En Camino', icon: '🏍️', status: 'En Camino' },
            { name: 'Entregado', icon: '✅', status: 'Completado' }
        ];
    } else {
        steps = [
            { name: 'Pendiente', icon: '⏳', status: 'Pendiente' },
            { name: 'Preparando', icon: '👨‍🍳', status: 'Preparando' },
            { name: 'Listo', icon: '✅', status: 'Listo' },
            { name: 'Retirado', icon: '🎉', status: 'Completado' }
        ];
    }
    
    // Determinar qué paso está activo
    let currentStepIndex = steps.findIndex(s => s.status === estado);
    if (currentStepIndex === -1) currentStepIndex = 0;
    
    return `
        <div class="track-header-status">
            <button class="track-back-btn" id="btnBackToSearch">← Buscar otro pedido</button>
            <div class="track-order-number-display">
                <span class="track-order-label">PEDIDO</span>
                <span class="track-order-id">#${order.orderNumber}</span>
            </div>
        </div>
        
        ${isCancelled ? `
            <div class="track-cancelled-banner">
                <div class="track-cancelled-icon">❌</div>
                <h3>Pedido Cancelado</h3>
                <p>Este pedido fue cancelado. Si tenés dudas, contactanos.</p>
            </div>
        ` : isCompleted ? `
            <div class="track-completed-banner">
                <div class="track-completed-icon">🎉</div>
                <h3>¡Pedido ${isDelivery ? 'Entregado' : 'Retirado'}!</h3>
                <p>Gracias por tu compra. ¡Esperamos que lo disfrutes!</p>
                <p class="track-completed-time">${isDelivery ? 'Entregado' : 'Retirado'} a las ${order.horaCompletado || order.hora}</p>
            </div>
        ` : ''}
        
        <div class="track-progress-container">
            <h3 class="track-progress-title">Estado de tu pedido</h3>
            <div class="track-steps">
                ${steps.map((step, index) => {
                    const isActive = index === currentStepIndex;
                    const isDone = index < currentStepIndex;
                    const className = isCancelled ? 'cancelled' : (isDone ? 'done' : isActive ? 'active' : 'pending');
                    
                    return `
                        <div class="track-step ${className}">
                            <div class="track-step-icon">${step.icon}</div>
                            <div class="track-step-line"></div>
                            <div class="track-step-label">${step.name}</div>
                            ${isActive && !isCancelled && !isCompleted ? '<div class="track-step-pulse"></div>' : ''}
                        </div>
                    `;
                }).join('')}
            </div>
            
            ${!isCancelled && !isCompleted ? `
                <div class="track-current-status">
                    <div class="status-message">
                        ${getStatusMessage(estado, isDelivery)}
                    </div>
                </div>
            ` : ''}
        </div>
        
        <div class="track-details">
            <h3 class="track-details-title">Detalles del Pedido</h3>
            
            <div class="track-detail-row">
                <span class="track-detail-label">📦 Tipo:</span>
                <span class="track-detail-value">${getTypeName(type)}</span>
            </div>
            
            <div class="track-detail-row">
                <span class="track-detail-label">⏰ Hora:</span>
                <span class="track-detail-value">${order.hora}</span>
            </div>
            
            <div class="track-detail-row">
                <span class="track-detail-label">💰 Total:</span>
                <span class="track-detail-value">$${order.total}</span>
            </div>
            
            ${order.paymentMethod ? `
                <div class="track-detail-row">
                    <span class="track-detail-label">💳 Pago:</span>
                    <span class="track-detail-value">${order.paymentMethod === 'Efectivo' ? '💵' : '📱'} ${order.paymentMethod}</span>
                </div>
            ` : ''}
            
            ${order.clientName ? `
                <div class="track-detail-row">
                    <span class="track-detail-label">👤 Nombre:</span>
                    <span class="track-detail-value">${order.clientName}</span>
                </div>
            ` : ''}
            
            ${order.direccion ? `
                <div class="track-detail-row">
                    <span class="track-detail-label">📍 Dirección:</span>
                    <span class="track-detail-value">${order.direccion}${order.piso ? `, ${order.piso}` : ''}</span>
                </div>
            ` : ''}
        </div>
        
        <div class="track-items-box">
            <h3 class="track-items-title">Productos</h3>
            ${order.items.map(item => `
                <div class="track-item">
                    <span class="track-item-qty">${item.quantity}x</span>
                    <span class="track-item-name">${item.name}</span>
                    <span class="track-item-price">$${item.price * item.quantity}</span>
                </div>
            `).join('')}
        </div>
        
        ${canCancel ? `
            <div class="track-cancel-section">
                <button class="btn-cancel-order" id="btnCancelOrder">
                    ❌ Cancelar Pedido
                </button>
                <p class="cancel-warning">Si cancelás el pedido, no podrás revertirlo</p>
            </div>
        ` : ''}
        
        <div class="track-refresh-notice">
            <p>✨ Esta página se actualiza automáticamente cuando cambia el estado</p>
        </div>
    `;
}

// ============================================
// OBTENER MENSAJE DE ESTADO
// ============================================

function getStatusMessage(estado, isDelivery) {
    const messages = {
        'Pendiente': '⏳ Estamos revisando tu pedido...',
        'Preparando': '👨‍🍳 Tu pedido se está preparando con mucho amor',
        'En Camino': '🏍️ Tu pedido va en camino. ¡Llegamos pronto!',
        'Listo': '✅ Tu pedido está listo para retirar en el local'
    };
    
    return messages[estado] || '';
}

// ============================================
// CONFIRMAR CANCELACIÓN DE PEDIDO
// ============================================

function confirmCancelOrder(docId, type) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content modal-confirm">
            <div class="modal-icon-warning">⚠️</div>
            <h2>¿Cancelar Pedido?</h2>
            <p>¿Estás seguro que querés cancelar este pedido?</p>
            <p class="warning-text">Esta acción no se puede deshacer</p>
            <div class="modal-buttons">
                <button class="btn-confirm-cancel" id="btnConfirmCancel">Sí, Cancelar</button>
                <button class="btn-keep-order" id="btnKeepOrder">No, Mantener</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    setTimeout(() => modal.classList.add('show'), 10);
    
    modal.querySelector('#btnConfirmCancel').addEventListener('click', async () => {
        await cancelOrder(docId, type);
        closeModal(modal);
    });
    
    modal.querySelector('#btnKeepOrder').addEventListener('click', () => {
        closeModal(modal);
    });
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal(modal);
        }
    });
}

// ============================================
// CANCELAR PEDIDO
// ============================================

async function cancelOrder(docId, type) {
    try {
        const docRef = doc(db, "orders", type, "lista", docId);
        await updateDoc(docRef, {
            estado: 'Cancelado',
            horaCancelado: new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
        });
        
        showNotification('✅ Pedido cancelado correctamente');
        console.log('Pedido cancelado:', docId);
        
    } catch (error) {
        console.error('Error al cancelar pedido:', error);
        showNotification('❌ Error al cancelar el pedido. Intentá de nuevo.');
    }
}

// ============================================
// ESCUCHAR CAMBIOS EN TIEMPO REAL
// ============================================

function startRealtimeTracking(orderId, type) {
    const orderDocRef = doc(db, "orders", type, "lista", orderId);
    
    unsubscribeListener = onSnapshot(orderDocRef, (docSnapshot) => {
        if (docSnapshot.exists()) {
            const updatedOrder = {
                id: docSnapshot.id,
                ...docSnapshot.data()
            };
            
            // Verificar si cambió el estado
            if (currentOrderData && currentOrderData.estado !== updatedOrder.estado) {
                showStateChangeNotification(updatedOrder.estado, type);
                
                if (updatedOrder.estado === 'Completado') {
                    showCompletedAnimation();
                }
            }
            
            currentOrderData = { ...updatedOrder, type, docId: orderId };
            showOrderTracking(updatedOrder, type, orderId);
        }
    });
}

// ============================================
// NOTIFICACIÓN DE CAMBIO DE ESTADO
// ============================================

function showStateChangeNotification(newState, type) {
    let message = '';
    
    switch(newState) {
        case 'Preparando':
            message = '👨‍🍳 ¡Tu pedido está siendo preparado!';
            break;
        case 'En Camino':
            message = '🏍️ ¡Tu pedido va en camino!';
            break;
        case 'Listo':
            message = '✅ ¡Tu pedido está listo para retirar!';
            break;
        case 'Completado':
            message = type === 'delivery' ? '🎉 ¡Tu pedido fue entregado!' : '🎉 ¡Gracias por tu compra!';
            break;
        case 'Cancelado':
            message = '❌ Tu pedido fue cancelado';
            break;
        default:
            message = '📦 Estado actualizado';
    }
    
    showNotification(message);
    playNotificationSound();
}

// ============================================
// ANIMACIÓN DE PEDIDO COMPLETADO
// ============================================

function showCompletedAnimation() {
    const confetti = document.createElement('div');
    confetti.className = 'confetti-animation';
    confetti.innerHTML = '🎉🎊✨🌟💫';
    
    document.body.appendChild(confetti);
    
    setTimeout(() => confetti.remove(), 3000);
}

// ============================================
// REPRODUCIR SONIDO DE NOTIFICACIÓN
// ============================================

function playNotificationSound() {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = 800;
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.5);
    } catch (error) {
        console.log('No se pudo reproducir sonido:', error);
    }
}

// ============================================
// CERRAR MODAL
// ============================================

function closeModal(modal) {
    modal.classList.remove('show');
    setTimeout(() => modal.remove(), 300);
}

// ============================================
// FUNCIONES AUXILIARES
// ============================================

function getTypeName(type) {
    const names = {
        local: 'En Local',
        delivery: 'Delivery',
        retiro: 'Para Retirar'
    };
    return names[type] || type;
}

function showNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'cart-notification';
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => notification.classList.add('show'), 10);
    
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}