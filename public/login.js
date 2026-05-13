// Configuracion del cliente estatico legacy de login.
const API_URL = 'http://localhost:3001/api';

// Referencias al DOM usadas para leer campos y mostrar feedback.
const loginForm = document.getElementById('loginForm');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginBtn = document.getElementById('loginBtn');
const alerta = document.getElementById('alerta');

// Muestra alertas visuales dentro del formulario.
function mostrarAlerta(mensaje, tipo = 'info') {
    alerta.textContent = mensaje;
    alerta.className = `alert show ${tipo}`;

    if (tipo === 'info') {
        setTimeout(() => {
            alerta.classList.remove('show');
        }, 3000);
    }
}

// Valida un formato simple de email antes de llamar al backend.
function validarEmail(email) {
    const emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
    return emailRegex.test(email);
}

// Manejo del formulario de login.
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
        mostrarAlerta('Por favor completa todos los campos', 'error');
        return;
    }

    if (!validarEmail(email)) {
        mostrarAlerta('Por favor proporciona un email valido', 'error');
        return;
    }

    await realizarLogin(email, password);
});

async function realizarLogin(email, password) {
    loginBtn.disabled = true;
    loginBtn.innerHTML = 'Iniciando sesion<span class="spinner"></span><span class="spinner"></span><span class="spinner"></span>';

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
            localStorage.setItem('token', data.token);
            localStorage.setItem('userEmail', data.usuario.email);

            loginForm.reset();

            setTimeout(() => {
                alert('Login exitoso. Te redirigiremos a tu dashboard.');
            }, 2000);
        } else {
            mostrarAlerta(data.message || 'Error al iniciar sesion', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        mostrarAlerta('Error de conexion. Verifica que el servidor este corriendo.', 'error');
    } finally {
        loginBtn.disabled = false;
        loginBtn.innerHTML = 'Iniciar Sesion';
    }
}
