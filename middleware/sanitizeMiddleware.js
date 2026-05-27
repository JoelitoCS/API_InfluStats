// -----------------------------------------------------------------------------
// middleware/sanitizeMiddleware.js
//
// Middleware global de saneamiento de datos de entrada.
//
// Objetivo:
//   Antes de que un controlador use req.body, limpiamos los datos recibidos para
//   reducir riesgos habituales:
//     - HTML o scripts enviados en campos de texto.
//     - Caracteres de control invisibles.
//     - Claves especiales capaces de alterar prototipos de objetos JS.
//
// Importante:
//   Esto NO sustituye a las validaciones de negocio. Por ejemplo, un email sigue
//   teniendo que validarse como email y una metrica sigue teniendo que ser numero.
//   Este middleware solo deja el body mas limpio antes de esas validaciones.
// -----------------------------------------------------------------------------

// Claves que nunca deben copiarse desde input externo a objetos internos.
// Evita "prototype pollution", un ataque donde alguien intenta modificar el
// prototipo base de Object usando propiedades como __proto__.
const DANGEROUS_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

// Caracteres de control ASCII que no se ven en pantalla y no aportan valor en
// campos normales de la API. Se eliminan para evitar datos raros o payloads
// ocultos dentro de strings.
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

// Bloques completos <script>...</script>. Se eliminan antes que el resto de
// etiquetas para borrar tambien el contenido JavaScript entre apertura y cierre.
const SCRIPT_TAGS = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi;

// Cualquier etiqueta HTML restante, por ejemplo <b>, <img>, <a>, </div>, etc.
// Dejamos el texto interior, pero quitamos la marca HTML.
const HTML_TAGS = /<\/?[^>]+>/g;

// Limpia un valor de tipo string:
//   1. Quita caracteres de control.
//   2. Elimina scripts completos.
//   3. Elimina etiquetas HTML restantes.
//   4. Recorta espacios al principio y al final.
const sanitizeString = (value) => {
  return value
    .replace(CONTROL_CHARS, '')
    .replace(SCRIPT_TAGS, '')
    .replace(HTML_TAGS, '')
    .trim();
};

// Limpia cualquier valor que pueda llegar en req.body.
//
// Funciona de forma recursiva porque un body puede tener estructuras anidadas:
//   { profile: { name: "<b>Ana</b>" }, tags: ["<i>gaming</i>"] }
//
// Segun el tipo de dato:
//   - string: se limpia con sanitizeString.
//   - array: se limpia cada elemento.
//   - object: se limpian sus propiedades, ignorando claves peligrosas.
//   - number/boolean/null/etc.: se devuelven tal cual.
const sanitizeValue = (value) => {
  if (typeof value === 'string') {
    return sanitizeString(value);
  }

  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }

  if (value && typeof value === 'object') {
    // Creamos un objeto nuevo en vez de mutar el original. Asi evitamos conservar
    // propiedades raras y copiamos solo lo que consideramos seguro.
    const sanitized = {};

    for (const [key, nestedValue] of Object.entries(value)) {
      // No copiamos claves peligrosas aunque vengan dentro de objetos anidados.
      if (DANGEROUS_KEYS.has(key)) continue;

      // Cada valor se sanea tambien, por si contiene strings, arrays u objetos.
      sanitized[key] = sanitizeValue(nestedValue);
    }

    return sanitized;
  }

  return value;
};

// Middleware de Express.
//
// Se ejecuta despues de express.json(), cuando Express ya ha convertido el JSON
// recibido en req.body. Si hay body y es un objeto, lo reemplazamos por su version
// saneada. Despues llamamos a next() para continuar hacia rutas y controladores.
export const sanitizeInput = (req, res, next) => {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeValue(req.body);
  }

  next();
};
