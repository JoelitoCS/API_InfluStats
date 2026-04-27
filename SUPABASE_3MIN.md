# ⚡ Supabase en 3 minutos

## 🚀 Setup rápido

### 1️⃣ Crear cuenta (1 minuto)
```
1. Ve a https://supabase.com
2. Click en "Sign Up"
3. Usa GitHub o email
```

### 2️⃣ Crear proyecto (1 minuto)
```
1. Click "New project"
2. Nombre: influStats
3. Password: (guárdalo)
4. Region: N. Virginia
5. Click "Create"
⏳ Espera 1-2 minutos
```

### 3️⃣ Obtener conexión (1 minuto)
```
1. Settings → Database
2. Connection Pooling → Session mode
3. Copia la URL (contiene tu password)
```

### 4️⃣ Guardar en .env
```env
DATABASE_URL="postgresql://postgres:password@host:port/postgres"
```

---

## 🔧 Ejecutar

```bash
# 1. Generar cliente
npm run prisma:generate

# 2. Crear tabla
npm run prisma:migrate
# Escribe: create_user_table

# 3. Iniciar servidor
npm run dev

# 4. Probar
Abre: http://localhost:3000
```

---

## 🎯 Listo

✅ BD configurada
✅ Tablas creadas
✅ API funcionando

¡Prueba registrando un usuario! 🎉

---

## 🆘 Si algo falla

| Error | Solución |
|-------|----------|
| "ECONNREFUSED" | DATABASE_URL mal copiado |
| "authentication failed" | Contraseña incorrecta |
| "relation User not exist" | Ejecuta `npm run prisma:migrate` |

---

Para detalles, lee: `SUPABASE_SETUP.md`
