// Configuración
const API_URL = 'http://localhost:3000/api';

// DOM Elements
const loginForm = document.getElementById('loginForm');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginBtn = document.getElementById('loginBtn');
const alerta = document.getElementById('alerta');

// Mostrar alerta
function mostrarAlerta(mensaje, tipo = 'info') {
    alerta.textContent = mensaje;
    alerta.className = `alert show ${tipo}`;

    if (tipo === 'info') {
        setTimeout(() => {
            alerta.classList.remove('show');
        }, 3000);
    }
}

// Validar email
function validarEmail(email) {
    const emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
    return emailRegex.test(email);
}

// Manejo del formulario
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    // Validaciones
    if (!email || !password) {
        mostrarAlerta('Por favor completa todos los campos', 'error');
        return;
    }

    if (!validarEmail(email)) {
        mostrarAlerta('Por favor proporciona un email válido', 'error');
        return;
    }

    // Enviar login
    await realizarLogin(email, password);
});

async function realizarLogin(email, password) {
    loginBtn.disabled = true;
    loginBtn.innerHTML = 'Iniciando sesión<span class="spinner"></span><span class="spinner"></span><span class="spinner"></span>';

    try {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email,
                password
            })
        });

        const data = await response.json();

        if (data.success) {
            mostrarAlerta(data.message, 'success');
            
            // Guardar token
            localStorage.setItem('token', data.token);
            localStorage.setItem('userEmail', data.usuario.email);

            // Limpiar formulario
            loginForm.reset();

            // Redirigir después de 2 segundos
            setTimeout(() => {
                alert('¡Login exitoso! Te redirigiremos a tu dashboard.');
                // window.location.href = '/dashboard';
            }, 2000);

        } else {
            mostrarAlerta(data.message || 'Error al iniciar sesión', 'error');
        }

    } catch (error) {
        console.error('Error:', error);
        mostrarAlerta('Error de conexión. Verifica que el servidor esté corriendo.', 'error');
    } finally {
        loginBtn.disabled = false;
        loginBtn.innerHTML = 'Iniciar Sesión';
    }
}
