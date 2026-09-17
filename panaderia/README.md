# RutePro · Panadería

Instalación lista para vender: mostrador, rutas de reparto, control de mermas,
cuentas por cobrar y panel del dueño. Copia de la plantilla RutePro con la base
de datos migrada de **Firebase a Supabase (Postgres)**.

---

## Estado de esta instalación

| | |
|---|---|
| Proyecto Supabase | `rutepro-panaderia` (org `contex.os`, región us-east-2) |
| Referencia | `jqjhtibqcvdexinbuxdb` |
| Esquema | aplicado y verificado — 0 hallazgos del linter de seguridad |
| Base | vacía, lista para el primer arranque |
| Credenciales | en `.env.local` (fuera del repositorio) |

**Falta un paso manual**, que sólo se puede dar desde el panel de Supabase:
**Authentication → Providers → Anonymous sign-ins: ON**. Sin eso la app no
lee ni escribe, porque las políticas exigen sesión iniciada.

---

## Puesta en marcha desde cero (otra instalación)

### 1. Crear el proyecto en Supabase
[supabase.com](https://supabase.com) → **New project**. Región sugerida para
México: `us-east-2` (Ohio) o `us-west-1`. Guarda la contraseña de la base.

### 2. Cargar el esquema
Supabase → **SQL Editor** → ejecuta en orden los archivos de
[`supabase/migrations/`](supabase/migrations): primero
`0001_esquema_inicial.sql` (tablas, índices, validaciones de dinero, RLS,
tiempo real y vistas de reporte) y luego
`0002_endurecer_vistas_y_funciones.sql` (correcciones del linter de
seguridad de Supabase).

### 3. Habilitar la sesión de dispositivo
Supabase → **Authentication → Providers → Anonymous sign-ins: ON**.

Sin esto la app no lee ni escribe: las políticas exigen sesión iniciada.

### 4. Credenciales
```bash
cp .env.example .env.local
```
Llena `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` con lo que aparece en
Supabase → **Project Settings → API**.

### 5. Arrancar
```bash
npm install
npm run dev          # http://localhost:3000
```

La primera vez que abre, el programa publica en la base la configuración de
`src/data.ts` y queda listo para cobrar.

---

## Configurar el negocio

Dos caminos, y ambos terminan en la misma tabla `config`:

- **Antes de instalar:** edita [`src/data.ts`](src/data.ts) — nombre, color,
  catálogo con precios en centavos y personal con sus rutas.
- **Ya instalado:** el dueño entra a **Configuración** desde la app y cambia
  productos, precios y vendedores sin tocar código.

También conviene cambiar el nombre en `index.html` y en
`public/manifest.webmanifest` (es lo que se ve en la pestaña y en el ícono
cuando se instala en la tablet).

---

## Qué cambió respecto a la plantilla

| | Plantilla original | Esta copia |
|---|---|---|
| Base de datos | Firebase / Firestore | Supabase / Postgres |
| Lectura de ventas y clientes | pública (`allow read: if true`) | sólo con sesión iniciada (RLS) |
| Validación de montos | reglas de Firestore | `CHECK` en la base, aplica a todo el que escriba |
| Borrado de ventas | se perdía sin rastro | queda copiado en `bitacora_borrados` |
| Pantalla de demos | podía sobrescribir la configuración real | eliminada |
| "Cerrar sesión" | borraba datos locales y remotos | sólo cierra la sesión del dispositivo |
| Reportes | sólo dentro de la app | vistas SQL `v_ventas` y `v_corte_diario` |

El acceso a datos vive completo en [`src/lib/db.ts`](src/lib/db.ts): las cinco
pantallas no saben qué base hay debajo, así que un cambio de esquema —o una
futura versión multi-sucursal— se hace en un solo archivo.

---

## Modo sin conexión

El repartidor puede vender sin señal: cada venta y cada merma se guardan en el
dispositivo y se suben solas al volver la red (`src/utils/syncEngine.ts`, que
reintenta cada 12 segundos y al recuperar conexión).

En la tablet conviene instalarla como app: Chrome → *Instalar aplicación*.

---

## Publicar

```bash
npm run build        # genera dist/ (front) y dist/server.cjs (API)
npm start            # sirve el programa ya compilado
```

Variables del servicio en producción: `VITE_SUPABASE_URL`,
`VITE_SUPABASE_ANON_KEY`, y opcionalmente `GEMINI_API_KEY` (funciones de IA) y
`GOOGLE_MAPS_PLATFORM_KEY` (mapa de clientes). **La llave de Maps viaja al
navegador**: restringe por referrer y por API en Google Cloud Console.

---

## Respaldo

- Supabase → **Database → Backups** (respaldo diario administrado).
- Exportación manual para el dueño: `select * from v_ventas;` → *Download CSV*
  desde el SQL Editor.

---

## Antes de cobrar la mensualidad

Lo que falta para una operación multi-cliente sin sobresaltos:

- [ ] **Usuario por vendedor** (correo o teléfono) en vez de sesión anónima:
      hoy la pista de auditoría dice *qué* se cobró, no *quién* lo cobró.
- [ ] **Mover "Limpiar todo" a una función RPC** con verificación de admin y
      cerrar el `delete` desde el navegador.
- [ ] **PIN del dueño con respaldo en servidor**: hoy es local del dispositivo
      y se recupera limpiando el navegador.
- [ ] Aviso de privacidad y contrato de licencia firmados con el cliente.
