// Configuración
const API_URL = 'http://localhost:3000/api';

// DOM Elements
const registroForm = document.getElementById('registroForm');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const passwordConfirmInput = document.getElementById('passwordConfirm');
const registroBtn = document.getElementById('registroBtn');
const alerta = document.getElementById('alerta');
const tokenDisplay = document.getElementById('tokenDisplay');
const tokenText = document.getElementById('tokenText');

// Requisitos de contraseña
const passwordRequirements = {
    length: document.getElementById('req-length'),
    uppercase: document.getElementById('req-uppercase'),
    lowercase: document.getElementById('req-lowercase'),
    number: document.getElementById('req-number')
};

// Validaciones de contraseña en tiempo real
passwordInput.addEventListener('input', validarRequisitosContrasena);
passwordConfirmInput.addEventListener('input', validarCoincidencia);

function validarRequisitosContrasena() {
    const password = passwordInput.value;

    // Validar longitud
    const lengthValid = password.length >= 8;
    updateRequirement(passwordRequirements.length, lengthValid);

    // Validar mayúsculas
    const uppercaseValid = /[A-Z]/.test(password);
    updateRequirement(passwordRequirements.uppercase, uppercaseValid);

    // Validar minúsculas
    const lowercaseValid = /[a-z]/.test(password);
    updateRequirement(passwordRequirements.lowercase, lowercaseValid);

    // Validar números
    const numberValid = /\d/.test(password);
    updateRequirement(passwordRequirements.number, numberValid);

    validarCoincidencia();
}

function validarCoincidencia() {
    const passwordMatch = document.getElementById('passwordMatch');
    const password = passwordInput.value;
    const passwordConfirm = passwordConfirmInput.value;

    if (passwordConfirm === '') {
        passwordMatch.textContent = '';
        return;
    }

    if (password === passwordConfirm) {
        passwordMatch.textContent = '✓ Las contraseñas coinciden';
        passwordMatch.style.color = '#4caf50';
    } else {
        passwordMatch.textContent = '✗ Las contraseñas no coinciden';
        passwordMatch.style.color = '#f44336';
    }
}

function updateRequirement(element, isValid) {
    if (isValid) {
        element.classList.add('valid');
        element.classList.remove('invalid');
    } else {
        element.classList.add('invalid');
        element.classList.remove('valid');
    }
}

// Mostrar alerta
function mostrarAlerta(mensaje, tipo = 'info') {
    alerta.textContent = mensaje;
    alerta.className = `alert show ${tipo}`;

    // Auto-desaparición para mensajes de info
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
registroForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const passwordConfirm = passwordConfirmInput.value;

    // Validaciones
    if (!email || !password || !passwordConfirm) {
        mostrarAlerta('Por favor completa todos los campos', 'error');
        return;
    }

    if (!validarEmail(email)) {
        mostrarAlerta('Por favor proporciona un email válido', 'error');
        return;
    }

    if (password.length < 8) {
        mostrarAlerta('La contraseña debe tener mínimo 8 caracteres', 'error');
        return;
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(password)) {
        mostrarAlerta('La contraseña debe contener mayúsculas, minúsculas y números', 'error');
        return;
    }

    if (password !== passwordConfirm) {
        mostrarAlerta('Las contraseñas no coinciden', 'error');
        return;
    }

    // Enviar registro
    await realizarRegistro(email, password, passwordConfirm);
});

async function realizarRegistro(email, password, passwordConfirm) {
    registroBtn.disabled = true;
    registroBtn.innerHTML = 'Registrando<span class="spinner"></span><span class="spinner"></span><span class="spinner"></span>';

    try {
        const response = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email,
                password,
                passwordConfirm
            })
        });

        const data = await response.json();

        if (data.success) {
            mostrarAlerta(data.message, 'success');
            
            // Guardar token
            localStorage.setItem('token', data.token);
            localStorage.setItem('userEmail', data.usuario.email);

            // Mostrar token
            tokenDisplay.style.display = 'block';
            tokenText.textContent = data.token;

            // Limpiar formulario
            registroForm.reset();
            validarRequisitosContrasena();

            // Redirigir después de 2 segundos
            setTimeout(() => {
                alert('¡Registro exitoso! Tu token ha sido guardado. En breve serás redirigido a tu dashboard.');
                // window.location.href = '/dashboard';
            }, 2000);

        } else {
            mostrarAlerta(data.message || 'Error al registrar', 'error');
        }

    } catch (error) {
        console.error('Error:', error);
        mostrarAlerta('Error de conexión. Verifica que el servidor esté corriendo.', 'error');
    } finally {
        registroBtn.disabled = false;
        registroBtn.innerHTML = 'Crear Cuenta';
    }
}

// Función para mostrar login (futura implementación)
function mostrarLogin() {
    window.location.href = '/login.html';
}

// Inicializar validación de requisitos
validarRequisitosContrasena();
