# Pendientes antes de vender

Estado del código tras la revisión del 2 de septiembre de 2026. Lo que sigue **no**
está en el código: son decisiones de negocio o pasos de operación.

---

## 0. Ya hecho (2 de septiembre de 2026)

### 0.1 Migración ejecutada ✅
`supabase/routepro_sellable_migration.sql` **ya está aplicada** en el proyecto
Supabase `Rutepro` (`gizfikiwsjylemdrpvkx`), en 8 migraciones versionadas
(`routepro_01_…` a `routepro_08_…`).

Verificado después de aplicarla:
- Las 13 tablas `rp_*` existen, **todas con RLS activo y con políticas**.
- Los advisors de seguridad no reportan **ningún** error sobre tablas `rp_*`.
- Ninguna función de RoutePro es ejecutable por el rol `anon`.
- Las tablas del otro sistema que vive en ese mismo proyecto (`cm_*`, `pulso_*`)
  quedaron intactas: la migración solo toca objetos `rp_*` y da permisos función
  por función, nunca `ON ALL`.

> Nota: ese proyecto de Supabase es compartido con tu sistema de comandas.
> Funciona, pero si RoutePro va a crecer como producto conviene moverlo a un
> proyecto propio (facturación, respaldos y límites separados).

### 0.2 Bug crítico encontrado y corregido ✅
Al probar el ciclo de dinero contra la base real apareció un error que **solo se
ve ejecutando**: `registrar_abono` hacía `SELECT SUM(...) ... FOR UPDATE`, y
Postgres prohíbe `FOR UPDATE` junto a una función de agregado. Efecto: **todos
los abonos fallaban, siempre**. Ya está corregido en la base y en el archivo SQL
(se bloquean las filas primero y se suman después).

### 0.3 Ciclo de dinero probado ✅
Prueba ejecutada contra la base real (los datos de prueba ya fueron borrados):

| Caso | Resultado |
|---|---|
| Alta de negocio con dueño | crea negocio + membresía en una transacción |
| Venta en efectivo | registrada |
| Reintento con la misma clave de idempotencia | **no duplica** |
| Total que no cuadra con los renglones | **rechazado** |
| Venta a crédito | genera el fiado y sube el saldo del cliente |
| Abono mayor a la deuda | **rechazado** |
| Abono parcial de $50 sobre deuda de $114 | saldo queda en $64, fiado "parcial" |
| Reintento del mismo abono | **no recobra** |

---

## 1. Obligatorio antes del primer cliente que paga

### 1.1 Variables de entorno en producción
La app necesita estas dos para salir del modo demo (ya probadas en local):

```bash
VITE_SUPABASE_URL="https://gizfikiwsjylemdrpvkx.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="<la publishable key del proyecto>"
```

La publishable key se copia de Supabase → Settings → API Keys. **Nunca** uses la
`service_role` en el front. El archivo `.env.local` no se sube al repositorio a
propósito.

### 1.2 Probar el ciclo desde la aplicación
El corazón (los RPC) ya está probado contra la base, pero **el recorrido desde la
interfaz falta hacerlo**: el entorno donde se hizo esta revisión no tiene salida
de red hacia Supabase desde el navegador, así que el registro y el login por
pantalla no se pudieron ejercitar. Recórrelo una vez en tu máquina:

1. Registro → alta de negocio → cargar catálogo en Configuración.
2. Venta en Mostrador → confirmar que aparece en `rp_operaciones`.
3. Venta a crédito en Ruta → confirmar el fiado y el saldo del cliente.
4. Abono desde el Panel del Dueño → confirmar que baja el saldo.
5. Modo avión, cobrar 3 ventas, reconectar → las 3 suben y **ninguna se duplica**.
6. Abrir el Dashboard en otro dispositivo → ve las mismas ventas.

### 1.3 Correo transaccional
El registro usa el correo por defecto de Supabase, que tiene límite bajo y suele
caer en spam. Configurar un SMTP propio (Resend, Postmark, SendGrid) en
`Authentication → Emails` antes de dar de alta clientes reales.

### 1.4 Dominio y despliegue
Definir dónde vive la app (Cloud Run, Vercel, VPS), apuntar el dominio y cargar
las variables de entorno de producción. `npm run build && npm start` es
suficiente para servirla; el servidor Express ya sirve el front compilado.

### 1.5 Respaldos
Activar los backups automáticos del proyecto de Supabase (Settings → Database) y
comprobar una restauración antes de tener datos de clientes.

---

## 2. Falta funcionalidad de negocio (no de operación)

### 2.1 Cobro de suscripción
**No hay nada de facturación en el código.** No hay planes, ni pasarela de pago,
ni control de "cuenta vencida". Hoy cualquier cuenta registrada usa la app
completa e indefinidamente. Para cobrar hace falta decidir el modelo (por negocio,
por vendedor, por volumen) y conectar una pasarela (Stripe, Mercado Pago,
Conekta) más un campo de estado de suscripción en `rp_negocios`.

### 2.2 Invitar empleados
Un dueño puede crear su negocio, pero **no puede invitar a su cajero o repartidor
desde la app**: hoy hay que insertar la fila en `rp_memberships` a mano desde
Supabase. El esquema y las políticas ya soportan varios usuarios por negocio con
rol (`dueño`, `admin`, `mostrador`, `repartidor`); falta la pantalla de invitación.

Es lo primero que va a pedir el segundo cliente.

### 2.3 Rutas con carga de inventario
Las funciones `abrir_ruta` / `cerrar_ruta` existen, validan stock a bordo y
generan el corte — pero **ninguna pantalla las llama todavía**. Mientras tanto las
ventas de ruta se registran sin `ruta_id`, así que se contabilizan correctamente
pero no descuentan carga ni generan corte automático.

---

## 3. Límites conocidos del comportamiento actual

- **El PIN del panel es por dispositivo.** Se guarda en el navegador, no en la
  nube. Si el dueño cambia de teléfono, define un PIN nuevo; si olvida el suyo, se
  restablece borrando los datos del sitio. Es deliberado (no viaja por la red),
  pero hay que explicárselo al cliente.
- **Productos y clientes se enlazan por nombre.** Una venta capturada sin señal
  se ata a su producto en `rp_productos` comparando el nombre. Si alguien renombra
  un producto mientras la ruta está en la calle, la venta sube igual pero no
  descuenta inventario de ese producto.
- **El borrado del panel limpia solo el dispositivo.** El historial de la nube es
  el registro contable y se conserva a propósito. La app ya lo dice así, pero es
  lo contrario de lo que espera quien pulsa "borrar todo".
- **Los módulos de IA necesitan `GEMINI_API_KEY`.** Sin ella el asistente, el
  generador de logo y el Mystery Shopper caen a respuestas heurísticas. Los
  endpoints tienen límite de 30 peticiones por minuto por IP; si se venden muchas
  cuentas conviene mover ese límite a un contador por negocio.
- **Restos de Firebase.** `src/firebase.ts`, `firestore.rules` y
  `firebase-applet-config.json` son de la arquitectura anterior y ya no se usan
  (todo el dato vive en Supabase). No estorban ni entran al bundle, pero conviene
  borrarlos para que nadie los tome como fuente de verdad.

---

## 4. Regresiones corregidas en esta revisión

La carpeta entregada había perdido cinco arreglos de seguridad que el repositorio
ya tenía. Se restauraron todos:

| # | Qué estaba mal | Estado |
|---|---|---|
| 1 | El PIN del Panel del Dueño aceptaba **cualquier** texto y tenía un botón "Entrar directo" que lo saltaba | Corregido y probado |
| 2 | `/api/generate-config-from-url` hacía `fetch` a cualquier URL (SSRF hacia el endpoint de metadatos de la nube) | Corregido y probado |
| 3 | Los endpoints de IA (que cuestan dinero) no tenían límite de peticiones ni de tamaño de cuerpo | Corregido y probado |
| 4 | El mostrador podía quedarse trabado esperando el GPS, sin poder cobrar | Corregido y probado |
| 5 | Las ventas nunca salían del navegador: no había ninguna escritura a la nube | Corregido |
| 6 | `registrar_abono` usaba `SUM(...) FOR UPDATE` (ilegal en Postgres): **todo abono fallaba** | Corregido y probado |
