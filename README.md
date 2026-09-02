# RoutePro

Control de **rutas de reparto, mostrador, fiado y corte de caja** para distribuidores,
panaderías con ruta, mayoristas y última milla.

Funciona sin señal (el repartidor cobra igual) y respalda cada operación en Supabase
en cuanto vuelve la conexión.

---

## Qué hace

| Módulo | Para quién | Qué resuelve |
|---|---|---|
| **Ruta** | Repartidor | Carga del día, venta por cliente, mermas y devoluciones, cierre de ruta |
| **Mostrador** | Cajero | Cobro rápido, ticket imprimible, ubicación de la venta |
| **Panel del Dueño** | Dueño / admin | Balance, cartera de fiado, abonos, auditorías, corte |
| **Dashboard** | Dueño | Tendencia de ventas y comparativo por vendedor |
| **Demo aislada** | Prospecto | Prueba con catálogo de su giro, sin tocar la base real |

Los cobros se registran contra funciones transaccionales de Postgres
(`registrar_operacion`, `registrar_abono`, `abrir_ruta`, `cerrar_ruta`) con clave de
idempotencia: reintentar tras una caída de red **nunca** duplica un cobro.

---

## Puesta en marcha

**Requisitos:** Node.js 20+ y un proyecto de Supabase.

### 1. Base de datos

En el SQL Editor de Supabase, ejecuta el archivo completo:

```
supabase/routepro_sellable_migration.sql
```

Crea las tablas (`rp_*`), las políticas RLS por negocio, las funciones
`SECURITY DEFINER` y publica los cambios en Realtime. Es idempotente: se puede
volver a ejecutar sin romper datos existentes.

### 2. Variables de entorno

Copia `.env.example` a `.env.local` y llena:

```bash
VITE_SUPABASE_URL="https://tu-proyecto.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="tu-publishable-key"   # nunca la service_role
GEMINI_API_KEY="..."                                  # asistente de IA y generador de logo
GOOGLE_MAPS_PLATFORM_KEY="..."                        # mapa y verificación de ubicación
```

Sin las dos primeras la app arranca en **modo demo**: todo funciona en memoria y
nada se guarda en la nube.

### 3. Correr

```bash
npm install
npm run dev     # http://localhost:3000
```

### 4. Producción

```bash
npm run build   # front a dist/ + servidor a dist/server.cjs
npm start
```

---

## Primer uso

1. **Registro** → crea la cuenta con correo y contraseña.
2. **Alta de negocio** → nombre, giro y color. Tu cuenta queda como dueña.
3. **Configuración** → carga productos y da de alta vendedores/rutas.
4. **PIN del panel** → la primera vez que entras al Panel del Dueño defines un PIN
   de 4–8 dígitos. Se guarda **solo en ese dispositivo**; es lo que protege el
   balance y el borrado de datos cuando el equipo queda en manos de un empleado.
5. **Operar** → el repartidor entra a *Ruta*, el cajero a *Mostrador*.

---

## Cómo funciona sin señal

Toda venta, merma y abono se escribe primero en el dispositivo y se encola
(`src/services/cloudSync.ts`). La cola se vacía sola:

- al recuperar conexión (`online`),
- al volver a la pestaña,
- cada minuto como red de seguridad,
- o al tocar el indicador de estado en el Panel del Dueño.

Ese indicador dice la verdad en todo momento: **Respaldado en la nube**,
*N por subir* o *N con error · revisar*. Un fallo de red no consume reintentos;
un rechazo de negocio (por ejemplo, un total que no cuadra) se marca tras varios
intentos para que el dueño lo revise en lugar de reintentarse en ciclo.

---

## Seguridad

- **Aislamiento por negocio (RLS).** Cada tabla filtra por membresía activa; un
  negocio no puede leer ni escribir datos de otro.
- **El dinero solo se mueve por RPC.** Las tablas de operaciones, fiados y abonos
  no aceptan `INSERT`/`UPDATE` directos desde el cliente: solo funciones
  `SECURITY DEFINER` que validan rol, pertenencia, stock a bordo y que el total
  cuadre con la suma de los renglones.
- **Idempotencia obligatoria** en cada operación y abono.
- **Endpoints de IA** con límite de tamaño de cuerpo y rate limit por IP (llaman
  APIs de pago).
- **Protección SSRF** en el generador de configuración por URL: solo destinos
  http(s) públicos, con resolución DNS y bloqueo de rangos internos.

Ver `AUDITORIA_RUTA_PAGO.md` y `security_spec.md` para el detalle.

> **Antes de vender:** revisa `PENDIENTES_VENTA.md` — lista lo que queda fuera de
> alcance del código (facturación/suscripción, dominio, respaldos) y los límites
> conocidos.

---

## Estructura

```
src/
  components/     Pantallas (Landing, Config, Ruta, Mostrador, Admin, Dashboard, Onboarding)
  context/        AuthContext (sesión) y BusinessContext (negocio, rol, catálogo)
  services/
    routeproRepository.ts   Acceso tipado a Supabase y a los RPC
    cloudSync.ts            Cola offline-first e idempotencia
  utils/syncEngine.ts       Validación local de ventas
  lib/supabase.ts           Cliente y validación de configuración
server.ts         Express + endpoints de IA (Gemini) y build de producción
supabase/         Migración SQL completa
```
