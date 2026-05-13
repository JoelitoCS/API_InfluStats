// Configuracion del cliente estatico legacy de registro.
const API_URL = 'http://localhost:3001/api';

// Referencias al DOM usadas para leer campos y mostrar feedback.
const registroForm = document.getElementById('registroForm');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const passwordConfirmInput = document.getElementById('passwordConfirm');
const registroBtn = document.getElementById('registroBtn');
const alerta = document.getElementById('alerta');
const tokenDisplay = document.getElementById('tokenDisplay');
const tokenText = document.getElementById('tokenText');

// Requisitos de contrasena que se actualizan en tiempo real.
const passwordRequirements = {
    length: document.getElementById('req-length'),
    uppercase: document.getElementById('req-uppercase'),
    lowercase: document.getElementById('req-lowercase'),
    number: document.getElementById('req-number')
};

// Conecta los eventos de validacion visual mientras el usuario escribe.
passwordInput.addEventListener('input', validarRequisitosContrasena);
passwordConfirmInput.addEventListener('input', validarCoincidencia);

function validarRequisitosContrasena() {
    const password = passwordInput.value;

    updateRequirement(passwordRequirements.length, password.length >= 8);
    updateRequirement(passwordRequirements.uppercase, /[A-Z]/.test(password));
    updateRequirement(passwordRequirements.lowercase, /[a-z]/.test(password));
    updateRequirement(passwordRequirements.number, /\d/.test(password));

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
        passwordMatch.textContent = 'OK Las contrasenas coinciden';
        passwordMatch.style.color = '#4caf50';
    } else {
        passwordMatch.textContent = 'NO Las contrasenas no coinciden';
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

// Manejo del formulario de registro.
registroForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const passwordConfirm = passwordConfirmInput.value;

    if (!email || !password || !passwordConfirm) {
        mostrarAlerta('Por favor completa todos los campos', 'error');
        return;
    }

    if (!validarEmail(email)) {
        mostrarAlerta('Por favor proporciona un email valido', 'error');
        return;
    }

    if (password.length < 8) {
        mostrarAlerta('La contrasena debe tener minimo 8 caracteres', 'error');
        return;
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(password)) {
        mostrarAlerta('La contrasena debe contener mayusculas, minusculas y numeros', 'error');
        return;
    }

    if (password !== passwordConfirm) {
        mostrarAlerta('Las contrasenas no coinciden', 'error');
        return;
    }

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
            localStorage.setItem('token', data.token);
            localStorage.setItem('userEmail', data.usuario.email);

            tokenDisplay.style.display = 'block';
            tokenText.textContent = data.token;

            registroForm.reset();
            validarRequisitosContrasena();

            setTimeout(() => {
                alert('Registro exitoso. Tu token ha sido guardado.');
            }, 2000);
        } else {
            mostrarAlerta(data.message || 'Error al registrar', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        mostrarAlerta('Error de conexion. Verifica que el servidor este corriendo.', 'error');
    } finally {
        registroBtn.disabled = false;
        registroBtn.innerHTML = 'Crear Cuenta';
    }
}

// Navega a la pagina legacy de login.
function mostrarLogin() {
    window.location.href = '/login.html';
}

// Inicializa validacion de requisitos al cargar la pagina.
validarRequisitosContrasena();
