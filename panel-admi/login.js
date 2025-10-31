// ==================================================
// 🔥 Importar Firebase desde CDN (modo módulo)
// ==================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";

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
const auth = getAuth(app);

// UID del dueño
const UID_DUENO = "SQ7BKwG5qqdHlmECFH9oDTyj96V2";

// ==================================================
// 🧠 Lógica del formulario
// ==================================================
const form = document.getElementById("loginForm");
const errorMessage = document.getElementById("errorMessage");
const successMessage = document.getElementById("successMessage");

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  // Ocultar mensajes previos
  errorMessage.style.display = "none";
  successMessage.style.display = "none";

  try {
    // Intentar iniciar sesión con Firebase Auth
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // ✅ Verificar UID del dueño
    if (user.uid === UID_DUENO) {
      successMessage.style.display = "block";
      successMessage.textContent = "¡Inicio de sesión exitoso!";
      setTimeout(() => {
        window.location.href = "panel.html"; // Redirige al panel
      }, 1500);
    } else {
      errorMessage.style.display = "block";
      errorMessage.textContent = "Acceso denegado. Solo el dueño puede entrar.";
    }

  } catch (error) {
    console.error("Error en el login:", error.message);
    errorMessage.style.display = "block";
    errorMessage.textContent = "Correo o contraseña incorrectos.";
  }
});
