// ==================================================
// 🔥 Importar Firebase desde CDN (modo módulo)
// ==================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { getFirestore, collection, addDoc, doc, getDoc, updateDoc, runTransaction } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

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
// VARIABLES Y ELEMENTOS DEL DOM
// ============================================

const hamburger = document.getElementById('hamburger');
const mobileMenu = document.getElementById('mobileMenu');
const navLinks = document.querySelectorAll('.nav-link, .mobile-nav-link');
const cartBadgeDesktop = document.getElementById('cartBadgeDesktop');
const cartBadgeMobile = document.getElementById('cartBadgeMobile');

// ============================================
// FUNCIÓN: TOGGLE MENÚ MÓVIL
// ============================================

hamburger.addEventListener('click', function() {
    hamburger.classList.toggle('active');
    mobileMenu.classList.toggle('active');
});

// ============================================
// FUNCIÓN: CERRAR MENÚ AL HACER CLICK EN UN LINK
// ============================================

navLinks.forEach(link => {
    link.addEventListener('click', function() {
        hamburger.classList.remove('active');
        mobileMenu.classList.remove('active');

        navLinks.forEach(l => l.classList.remove('active'));
        this.classList.add('active');
    });
});

// ============================================
// FUNCIÓN: DETECTAR PÁGINA ACTUAL
// ============================================

function setActivePage() {
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    
    navLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (href === currentPage || (currentPage === '' && href === 'index.html')) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
}

// ============================================
// FUNCIÓN: ACTUALIZAR BADGE DEL CARRITO
// ============================================

function updateCartBadge() {
    const cart = JSON.parse(localStorage.getItem('cart')) || [];
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

    if (totalItems > 0) {
        cartBadgeDesktop.textContent = totalItems;
        cartBadgeDesktop.style.display = 'flex';
        cartBadgeMobile.textContent = totalItems;
        cartBadgeMobile.style.display = 'flex';
    } else {
        cartBadgeDesktop.style.display = 'none';
        cartBadgeMobile.style.display = 'none';
    }
}

// ============================================
// FUNCIÓN: MONITOREAR CAMBIOS EN CARRITO
// ============================================

function watchCartChanges() {
    setInterval(() => {
        updateCartBadge();
    }, 500);

    window.addEventListener('storage', function(e) {
        if (e.key === 'cart') {
            updateCartBadge();
        }
    });

    document.addEventListener('cartUpdated', function() {
        updateCartBadge();
    });
}

// ============================================
// FUNCIÓN: CERRAR MENÚ AL HACER CLICK AFUERA
// ============================================

document.addEventListener('click', function(event) {
    const isClickInsideNav = document.getElementById('navbar').contains(event.target);
    
    if (!isClickInsideNav && mobileMenu.classList.contains('active')) {
        hamburger.classList.remove('active');
        mobileMenu.classList.remove('active');
    }
});

// ============================================
// FUNCIÓN: PREVENIR QUE LINKS DEL CARRITO
// CIERREN EL MENÚ CUANDO NO NECESITA
// ============================================

const cartLink = document.querySelector('.cart-link');
if (cartLink) {
    cartLink.addEventListener('click', function(e) {
        e.stopPropagation();
    });
}

// ============================================
// FUNCIÓN: DISPONER EVENTO GLOBAL PARA
// ACTUALIZAR EL CARRITO DESDE OTRAS PÁGINAS
// ============================================

window.notifyCartUpdate = function() {
    const event = new CustomEvent('cartUpdated');
    document.dispatchEvent(event);
    updateCartBadge();
};

// ============================================
// INICIALIZACIÓN
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        setActivePage();
        updateCartBadge();
        watchCartChanges();
    }, 100);
});

window.addEventListener('focus', function() {
    updateCartBadge();
});

window.addEventListener('blur', function() {
    updateCartBadge();
});

// ============================================
// ========== SISTEMA DE CARRITO =============
// ============================================

function addToCart(productId, productName, productPrice) {
    let cart = JSON.parse(localStorage.getItem('cart')) || [];
    
    const productCard = document.querySelector(`[data-id="${productId}"]`);
    const categorySection = productCard.closest('.category-section');
    const categoryName = categorySection.querySelector('.category-title').textContent;
    
    const fullProductName = `${categoryName} - ${productName}`;
    
    const existingProduct = cart.find(item => item.id === productId);
    
    if (existingProduct) {
        existingProduct.quantity += 1;
    } else {
        cart.push({
            id: productId,
            name: fullProductName,
            price: productPrice,
            quantity: 1
        });
    }
    
    localStorage.setItem('cart', JSON.stringify(cart));
    
    window.notifyCartUpdate();
    
    showNotification('✅ Producto agregado al carrito');
}

// ============================================
// FUNCIÓN: MOSTRAR NOTIFICACIÓN
// ============================================

function showNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'cart-notification';
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);
    
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 3000);
}

// ============================================
// FUNCIÓN: INICIALIZAR BOTONES DE AGREGAR
// ============================================

function initAddButtons() {
    const addButtons = document.querySelectorAll('.add-btn');
    
    addButtons.forEach(button => {
        button.addEventListener('click', function() {
            const productCard = this.closest('.product-card');
            const productId = productCard.getAttribute('data-id');
            const productName = productCard.querySelector('.product-name').textContent;
            const productPrice = parseInt(productCard.getAttribute('data-price'));
            
            addToCart(productId, productName, productPrice);
        });
    });
}

// ============================================
// FUNCIÓN: CARGAR PRODUCTOS EN CARRITO
// ============================================

function loadCartItems() {
    const cart = JSON.parse(localStorage.getItem('cart')) || [];
    const cartItemsContainer = document.getElementById('cartItems');
    const emptyCart = document.getElementById('emptyCart');
    const cartContent = document.getElementById('cartContent');
    
    if (!cartItemsContainer) return;
    
    if (cart.length === 0) {
        emptyCart.style.display = 'block';
        cartContent.style.display = 'none';
    } else {
        emptyCart.style.display = 'none';
        cartContent.style.display = 'block';
        
        cartItemsContainer.innerHTML = '';
        
        cart.forEach(item => {
            const cartItem = document.createElement('div');
            cartItem.className = 'cart-item';
            cartItem.innerHTML = `
                <div class="cart-item-info">
                    <h3 class="cart-item-name">${item.name}</h3>
                    <p class="cart-item-price">$${item.price}</p>
                </div>
                <div class="cart-item-controls">
                    <button class="qty-btn minus" data-id="${item.id}">-</button>
                    <span class="cart-item-qty">${item.quantity}</span>
                    <button class="qty-btn plus" data-id="${item.id}">+</button>
                    <button class="remove-btn" data-id="${item.id}">🗑️</button>
                </div>
                <div class="cart-item-total">
                    $${item.price * item.quantity}
                </div>
            `;
            
            cartItemsContainer.appendChild(cartItem);
        });
        
        addCartControlListeners();
        
        updateCartSummary();
    }
}

// ============================================
// FUNCIÓN: AGREGAR LISTENERS A CONTROLES
// ============================================

function addCartControlListeners() {
    document.querySelectorAll('.qty-btn.plus').forEach(btn => {
        btn.addEventListener('click', function() {
            const productId = this.getAttribute('data-id');
            updateQuantity(productId, 1);
        });
    });
    
    document.querySelectorAll('.qty-btn.minus').forEach(btn => {
        btn.addEventListener('click', function() {
            const productId = this.getAttribute('data-id');
            updateQuantity(productId, -1);
        });
    });
    
    document.querySelectorAll('.remove-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const productId = this.getAttribute('data-id');
            removeFromCart(productId);
        });
    });
}

// ============================================
// FUNCIÓN: ACTUALIZAR CANTIDAD
// ============================================

function updateQuantity(productId, change) {
    let cart = JSON.parse(localStorage.getItem('cart')) || [];
    
    const product = cart.find(item => item.id === productId);
    
    if (product) {
        product.quantity += change;
        
        if (product.quantity <= 0) {
            cart = cart.filter(item => item.id !== productId);
        }
        
        localStorage.setItem('cart', JSON.stringify(cart));
        window.notifyCartUpdate();
        loadCartItems();
    }
}

// ============================================
// FUNCIÓN: ELIMINAR DEL CARRITO
// ============================================

function removeFromCart(productId) {
    let cart = JSON.parse(localStorage.getItem('cart')) || [];
    cart = cart.filter(item => item.id !== productId);
    
    localStorage.setItem('cart', JSON.stringify(cart));
    window.notifyCartUpdate();
    loadCartItems();
    
    showNotification('🗑️ Producto eliminado del carrito');
}

// ============================================
// FUNCIÓN: ACTUALIZAR RESUMEN DEL CARRITO
// ============================================

function updateCartSummary() {
    const cart = JSON.parse(localStorage.getItem('cart')) || [];
    
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const delivery = 0;
    const total = subtotal + delivery;
    
    const subtotalElement = document.getElementById('subtotal');
    const deliveryElement = document.getElementById('delivery');
    const totalElement = document.getElementById('totalPrice');
    
    if (subtotalElement) subtotalElement.textContent = `$${subtotal}`;
    if (deliveryElement) deliveryElement.textContent = `$${delivery}`;
    if (totalElement) totalElement.textContent = `$${total}`;
}

// ============================================
// FUNCIÓN: VERIFICAR SI ESTÁ ABIERTO
// ============================================

function isRestaurantOpen() {
    const now = new Date();
    const day = now.getDay();
    const hours = now.getHours();
    
    if (day === 0) {
        return { open: false, reason: 'sunday' };
    }
    
    if (hours >= 11 && hours < 23) {
        return { open: true };
    }
    
    return { open: false, reason: 'closed' };
}

// ============================================
// FUNCIÓN: MOSTRAR MODAL DE CERRADO
// ============================================

function showClosedModal(reason) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    
    let message = '';
    if (reason === 'sunday') {
        message = `
            <div class="closed-icon">😴</div>
            <h3>¡Descansamos los Domingos!</h3>
            <p>Los domingos no hacemos pedidos.</p>
            <p>Volvé a visitarnos de Lunes a Sábado.</p>
            <p class="schedule">Horario: 11:00 - 23:00 hs</p>
        `;
    } else {
        message = `
            <div class="closed-icon">🕐</div>
            <h3>¡Estamos Cerrados!</h3>
            <p>Nuestro horario de atención es:</p>
            <p class="schedule">Lunes a Sábado<br>11:00 - 23:00 hs</p>
            <p>Volvé en nuestro horario para hacer tu pedido.</p>
        `;
    }
    
    modal.innerHTML = `
        <div class="modal-content">
            <div class="closed-message">
                ${message}
            </div>
            <button class="btn-primary" style="width: 100%; margin-top: 20px;" onclick="this.closest('.modal-overlay').remove()">
                Entendido
            </button>
            <button class="modal-close">✕</button>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    setTimeout(() => modal.classList.add('show'), 10);
    
    modal.querySelector('.modal-close').addEventListener('click', () => {
        closeModal(modal);
    });
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal(modal);
        }
    });
}

// ============================================
// FUNCIÓN: MOSTRAR MODAL DE TIPO DE PEDIDO
// ============================================

function showOrderTypeModal() {
    const status = isRestaurantOpen();
    if (!status.open) {
        showClosedModal(status.reason);
        return;
    }
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content">
            <h2 class="modal-title">¿Cómo querés recibir tu pedido?</h2>
            <div class="order-type-buttons">
                <button class="order-type-btn" data-type="local">
                    <span class="order-icon">🏪</span>
                    <span class="order-label">Retiro en Local</span>
                </button>
                <button class="order-type-btn" data-type="delivery">
                    <span class="order-icon">🏍️</span>
                    <span class="order-label">Delivery</span>
                </button>
            </div>
            <button class="modal-close">✕</button>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    setTimeout(() => modal.classList.add('show'), 10);
    
    modal.querySelector('.modal-close').addEventListener('click', () => {
        closeModal(modal);
    });
    
    modal.querySelector('[data-type="local"]').addEventListener('click', () => {
        closeModal(modal);
        confirmLocalOrder();
    });
    
    modal.querySelector('[data-type="delivery"]').addEventListener('click', () => {
        closeModal(modal);
        showDeliveryForm();
    });
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal(modal);
        }
    });
}

// ============================================
// FUNCIÓN: CERRAR MODAL
// ============================================

function closeModal(modal) {
    modal.classList.remove('show');
    setTimeout(() => modal.remove(), 300);
}

// ============================================
// FUNCIÓN: MOSTRAR MODAL DE CONFIRMACIÓN CON NÚMERO DE PEDIDO - CORREGIDO
// ============================================

function showOrderConfirmationModal(orderNumber, phone, type) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content modal-confirmation">
            <button class="modal-close" id="btnCloseModal">✕</button>
            
            <div style="text-align: center; padding: 10px;">
                <div style="display: flex; align-items: center; justify-content: center; gap: 15px; margin-bottom: 25px;">
                    <div class="confirmation-icon">✅</div>
                    <h2 class="confirmation-title" style="margin: 0;">¡Pedido Confirmado!</h2>
                </div>
                
                <div class="order-number-box">
                    <p class="order-number-label">Tu número de pedido es:</p>
                    <div class="order-number-display">#${orderNumber}</div>
                    <p class="order-number-info">Guardá este número para consultar el estado de tu pedido</p>
                </div>
                
                <div class="confirmation-details">
                    ${type === 'delivery' ? `
                        <p>📦 <strong>Delivery</strong> - Llegamos en 30-45 minutos</p>
                        <p>📞 Teléfono: <strong>${phone}</strong></p>
                    ` : type === 'retiro' ? `
                        <p>🏪 <strong>Retiro en Local</strong></p>
                        <p>📞 Teléfono: <strong>${phone}</strong></p>
                        <p>Te avisaremos cuando esté listo</p>
                    ` : `
                        <p>🏪 <strong>Pedido en Local</strong></p>
                        <p>📞 Teléfono: <strong>${phone}</strong></p>
                    `}
                </div>
                
                <div class="confirmation-buttons">
                    <a href="consultar-estado.html" class="btn-track-order">
                        📦 Ver Estado del Pedido
                    </a>
                    <button class="btn-continue-shopping" id="btnContinueShopping">
                        Continuar
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    setTimeout(() => modal.classList.add('show'), 10);
    
    // Event listener para el botón X de cerrar
    const btnClose = modal.querySelector('#btnCloseModal');
    if (btnClose) {
        btnClose.addEventListener('click', () => {
            closeModal(modal);
        });
    }
    
    // Event listener para el botón de continuar
    const btnContinue = modal.querySelector('#btnContinueShopping');
    if (btnContinue) {
        btnContinue.addEventListener('click', () => {
            closeModal(modal);
        });
    }
    
    // Cerrar al hacer click fuera del modal
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal(modal);
        }
    });
}

// ============================================
// FUNCIÓN: MOSTRAR FORMULARIO LOCAL
// ============================================

function confirmLocalOrder() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content modal-delivery">
            <h2 class="modal-title">Datos para Retiro en Local</h2>
            <form class="delivery-form" id="localOrderForm">
                <div class="form-group">
                    <label for="localName">Nombre completo *</label>
                    <input type="text" id="localName" placeholder="Ej: Juan Pérez" required>
                </div>
                
                <div class="form-group">
                    <label for="localPhone">Teléfono *</label>
                    <input type="tel" id="localPhone" placeholder="Ej: 11 2345 6789" required>
                </div>
                
                <div class="form-group">
                    <label for="localPayment">Método de pago *</label>
                    <select id="localPayment" required>
                        <option value="">Seleccionar método</option>
                        <option value="Efectivo">Efectivo</option>
                        <option value="Transferencia">Transferencia</option>
                    </select>
                </div>
                
                <div class="form-buttons">
                    <button type="submit" class="btn-submit-delivery">Confirmar Pedido</button>
                    <button type="button" class="btn-cancel-delivery">Cancelar</button>
                </div>
            </form>
            <button class="modal-close">✕</button>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    setTimeout(() => modal.classList.add('show'), 10);
    
    modal.querySelector('.modal-close').addEventListener('click', () => {
        closeModal(modal);
    });
    
    modal.querySelector('.btn-cancel-delivery').addEventListener('click', () => {
        closeModal(modal);
    });
    
    modal.querySelector('#localOrderForm').addEventListener('submit', (e) => {
        e.preventDefault();
        
        const name = document.getElementById('localName').value.trim();
        const phone = document.getElementById('localPhone').value.trim();
        const payment = document.getElementById('localPayment').value;
        
        if (!name || !phone || !payment) {
            showNotification('❌ Por favor completá todos los campos');
            return;
        }
        
        closeModal(modal);
        finalizeLocalOrder(name, phone, payment);
    });
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal(modal);
        }
    });
}

// ============================================
// FUNCIÓN: FINALIZAR PEDIDO LOCAL
// ============================================

async function finalizeLocalOrder(name, phone, payment) {
  const cart = JSON.parse(localStorage.getItem('cart')) || [];
  
  const orderNumber = await getNextOrderNumber();
  
  const normalizedPayment = payment.charAt(0).toUpperCase() + payment.slice(1).toLowerCase();
  
  const orderData = {
      orderNumber: orderNumber,
      hora: new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
      timestamp: Date.now(),
      items: cart.map(item => ({
          name: item.name,
          quantity: item.quantity,
          price: item.price
      })),
      total: cart.reduce((sum, item) => sum + (item.price * item.quantity), 0),
      estado: 'Pendiente',
      clientName: name,
      telefono: phone,
      observations: '',
      paymentMethod: normalizedPayment,
      type: 'retiro'
  };

  try {
      await addDoc(collection(db, "orders", "retiro", "lista"), orderData);
      console.log("✅ Pedido guardado en Firebase:", orderData);
      
      // Mostrar modal de confirmación
      showOrderConfirmationModal(orderNumber, phone, 'retiro');
      
      // Limpiar carrito después de mostrar confirmación
      setTimeout(() => {
          localStorage.removeItem('cart');
          window.notifyCartUpdate();
          loadCartItems();
      }, 1000);
      
  } catch (error) {
      console.error("❌ Error al guardar pedido:", error);
      showNotification('❌ Error al guardar el pedido: ' + error.message);
  }
}

// ============================================
// FUNCIÓN: MOSTRAR FORMULARIO DE DELIVERY
// ============================================

function showDeliveryForm() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content modal-delivery">
            <h2 class="modal-title">Datos para Delivery</h2>
            <form class="delivery-form" id="deliveryForm">
                <div class="form-group">
                    <label for="deliveryName">Nombre completo *</label>
                    <input type="text" id="deliveryName" placeholder="Ej: Juan Pérez" required>
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label for="deliveryAddress">Dirección completa *</label>
                        <input type="text" id="deliveryAddress" placeholder="Ej: Av. Corrientes 1234" required>
                    </div>
                    
                    <div class="form-group">
                        <label for="deliveryFloor">Piso / Depto</label>
                        <input type="text" id="deliveryFloor" placeholder="Ej: 5° A">
                    </div>
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label for="deliveryPhone">Teléfono *</label>
                        <input type="tel" id="deliveryPhone" placeholder="Ej: 11 2345 6789" required>
                    </div>
                    
                    <div class="form-group">
                        <label for="deliveryPayment">Método de pago *</label>
                        <select id="deliveryPayment" required>
                            <option value="">Seleccionar</option>
                            <option value="Efectivo">Efectivo</option>
                            <option value="Transferencia">Transferencia</option>
                        </select>
                    </div>
                </div>
                
                <div class="form-group">
                    <label for="deliveryNotes">Indicaciones</label>
                    <input type="text" id="deliveryNotes" placeholder="Ej: Timbre 2">
                </div>
                
                <div class="form-buttons">
                    <button type="submit" class="btn-submit-delivery">Confirmar Pedido</button>
                    <button type="button" class="btn-cancel-delivery">Cancelar</button>
                </div>
            </form>
            <button class="modal-close">✕</button>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    setTimeout(() => modal.classList.add('show'), 10);
    
    modal.querySelector('.modal-close').addEventListener('click', () => {
        closeModal(modal);
    });
    
    modal.querySelector('.btn-cancel-delivery').addEventListener('click', () => {
        closeModal(modal);
    });
    
    modal.querySelector('#deliveryForm').addEventListener('submit', (e) => {
        e.preventDefault();
        
        const name = document.getElementById('deliveryName').value.trim();
        const address = document.getElementById('deliveryAddress').value.trim();
        const floor = document.getElementById('deliveryFloor').value.trim();
        const phone = document.getElementById('deliveryPhone').value.trim();
        const payment = document.getElementById('deliveryPayment').value;
        const notes = document.getElementById('deliveryNotes').value.trim();
        
        if (!name || !address || !phone || !payment) {
            showNotification('❌ Por favor completá todos los campos obligatorios');
            return;
        }
        
        validateDeliveryZone(name, address, floor, phone, payment, notes, modal);
    });
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal(modal);
        }
    });
}

// ============================================
// FUNCIÓN: VALIDAR ZONA DE DELIVERY
// ============================================

function validateDeliveryZone(name, address, floor, phone, payment, notes, modal) {
    const zonasPermitidas = [
        'palermo', 'recoleta', 'belgrano', 'nuñez', 'colegiales',
        'almagro', 'caballito', 'villa crespo', 'villa urquiza',
        'saavedra', 'coghlan', 'parque chas'
    ];
    
    const addressLower = address.toLowerCase();
    
    const zonaValida = zonasPermitidas.some(zona => 
        addressLower.includes(zona)
    );
    
    if (zonaValida) {
        closeModal(modal);
        confirmDeliveryOrder(name, address, floor, phone, payment, notes);
    } else {
        showNotification('❌ Lo sentimos, no llegamos a esa zona todavía');
        const formElement = document.getElementById('deliveryForm');
        
        let errorMsg = formElement.querySelector('.zone-error');
        if (!errorMsg) {
            errorMsg = document.createElement('div');
            errorMsg.className = 'zone-error';
            errorMsg.innerHTML = `
                ⚠️ No realizamos envíos a esta zona.<br>
                <small>Zonas disponibles: Palermo, Recoleta, Belgrano, Nuñez, Colegiales, Almagro, Caballito, Villa Crespo, Villa Urquiza, Saavedra, Coghlan, Parque Chas</small>
            `;
            formElement.insertBefore(errorMsg, formElement.querySelector('.btn-submit-delivery'));
        }
    }
}

// ============================================
// FUNCIÓN: CONFIRMAR PEDIDO DELIVERY
// ============================================

async function confirmDeliveryOrder(name, address, floor, phone, payment, notes) {
  const cart = JSON.parse(localStorage.getItem('cart')) || [];
  
  const orderNumber = await getNextOrderNumber();
  
  const normalizedPayment = payment.charAt(0).toUpperCase() + payment.slice(1).toLowerCase();
  
  const orderData = {
      orderNumber: orderNumber,
      hora: new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
      timestamp: Date.now(),
      items: cart.map(item => ({
          name: item.name,
          quantity: item.quantity,
          price: item.price
      })),
      total: cart.reduce((sum, item) => sum + (item.price * item.quantity), 0),
      estado: 'Pendiente',
      clientName: name,
      direccion: address,
      piso: floor,
      telefono: phone,
      paymentMethod: normalizedPayment,
      indicaciones: notes,
      observations: '',
      type: 'delivery'
  };

  try {
      await addDoc(collection(db, "orders", "delivery", "lista"), orderData);
      console.log("✅ Pedido guardado en Firebase:", orderData);
      
      // Mostrar modal de confirmación
      showOrderConfirmationModal(orderNumber, phone, 'delivery');
      
      // Limpiar carrito después de mostrar confirmación
      setTimeout(() => {
          localStorage.removeItem('cart');
          window.notifyCartUpdate();
          loadCartItems();
      }, 1000);
      
  } catch (error) {
      console.error("❌ Error al guardar pedido:", error);
      showNotification('❌ Error al guardar el pedido: ' + error.message);
  }
}

// ============================================
// FUNCIÓN: CONFIRMAR PEDIDO
// ============================================

function initCheckout() {
    const checkoutBtn = document.getElementById('btnCheckout');
    
    if (checkoutBtn) {
        checkoutBtn.addEventListener('click', function() {
            const cart = JSON.parse(localStorage.getItem('cart')) || [];
            
            if (cart.length === 0) {
                showNotification('❌ Tu carrito está vacío');
                return;
            }
            
            showOrderTypeModal();
        });
    }
}

// ============================================
// INICIALIZACIÓN DEL SISTEMA DE CARRITO
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    if (document.querySelector('.menu-section')) {
        initAddButtons();
    }
    
    if (document.querySelector('.cart-section')) {
        loadCartItems();
        initCheckout();
    }
});