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

## Cómo trabaja la ruta

El negocio vende bolillo en ruta, así que la app del repartidor se reduce a
tres momentos (`src/components/RutaScreen.tsx`):

1. **Carga de la mañana** — cuántas piezas se lleva. Queda registrada con hora
   y nombre; es el dato que pidió el dueño como prioridad.
2. **Venta en la calle** — botones rápidos (+1 a +50) y teclado para la
   cantidad exacta (7, 8, 15…). Dos toques: cantidad y cobrar. El cliente es
   opcional: por omisión es venta de calle, y se puede asignar a una tiendita
   cuando haga falta llevarle cuenta o venderle a crédito.
3. **Cierre** — cargó X, vendió Y, debería traer Z y $N en efectivo. El
   repartidor captura los sobrantes y ahí queda la merma del día.

Mientras la jornada está abierta se va grabando el recorrido
(`src/utils/gps.ts`). Está hecho para durar la jornada: pide la posición por
red en vez de GPS fino, acepta lecturas de hasta 30 segundos y sólo guarda una
migaja cuando el repartidor se movió 40 metros o pasó un minuto, con un latido
cada 5 minutos si está parado. Cada venta deja además su propia migaja.

**Todo funciona sin señal.** Ventas, jornadas y migajas se guardan en el
teléfono y suben solas cuando vuelve el internet (`src/utils/syncEngine.ts`).

Para volver a la pantalla completa de la plantilla (varios productos, carrito,
devoluciones, asistente), pon `MODO_RUTA_SIMPLE = false` en `src/data.ts`.

---

## Para el bot de Telegram

La base ya trae la consulta armada: **`v_ruta_hoy`** devuelve un renglón por
repartidor con todo lo que el dueño suele preguntar, sin que el bot tenga que
calcular nada.

```sql
select * from v_ruta_hoy where vendedor ilike '%ana%';
```

| Pregunta del dueño | Columna |
|---|---|
| ¿Cuánto lleva vendido? | `vendido_pesos`, `piezas_vendidas`, `ventas` |
| ¿Cuánto pan le queda? | `piezas_cargadas`, `piezas_restantes` |
| ¿Dónde fue su última venta? | `ultima_venta_hora`, `ultima_venta_cliente`, `ultima_venta_mapa` |
| ¿Por dónde anda? | `ultima_posicion_mapa`, `minutos_sin_reportar` |

`ultima_venta_mapa` y `ultima_posicion_mapa` ya vienen como enlace de Google
Maps, listo para mandarse en el mensaje. Para dibujar el recorrido completo de
un día está `v_recorrido`.

Un aviso para cuando se conecte el bot: responde con lo último que el teléfono
alcanzó a subir. Si el repartidor anda sin señal, `minutos_sin_reportar` dice
hace cuánto se supo de él — conviene que el bot lo mencione en vez de dar por
hecho que está ahí.

---

## Demostración para el cliente

`demo/Superpan-Demo-v4.html` es **un solo archivo**: se manda por
WhatsApp o correo, se copia a una memoria y se abre con doble clic. No
necesita internet, ni servidor, ni base de datos — todo vive en el navegador
de esa computadora y nada sale de ahí.

Trae dos semanas de operación simulada (≈260 ventas de mostrador y de dos
rutas, clientes con crédito, abonos, mermas y auditorías), así que el panel
del dueño se ve con movimiento desde el primer momento.

El archivo lleva la versión en el nombre y en la insignia de abajo a la
derecha (**DEMO v4**): así se distingue de descargas anteriores, que el
navegador guarda como copias aparte. Al abrir una versión nueva, los datos de
muestra se renuevan solos.

Frente al cliente:

| Para qué | Cómo |
|---|---|
| Entrar al Panel del Dueño | Toca el logotipo y usa el PIN **1234** |
| Ponerle el nombre del negocio del cliente | Botón **✎ Nombre** (abajo a la derecha): se renombra toda la app al instante |
| Dejarla como estaba | Botón **↻ Reiniciar** |

Diferencias con la instalación real, a propósito: no pide ubicación al
cobrar, no muestra las herramientas dirigidas al vendedor y el PIN viene
puesto. Las funciones de IA responden con su modo sin conexión, porque no hay
servidor detrás.

Para regenerarla (por ejemplo, tras cambiar el catálogo en `src/data.ts`):

```bash
npm run demo
```

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
