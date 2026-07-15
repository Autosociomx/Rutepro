# Auditoría de Seguridad — Ruta de Pago (RoutePro / Rutepro)

**Fecha:** 2026-07-12
**Alcance:** Flujo de cobros, ventas, abonos (crédito), cierres y acceso al Panel del Dueño.
**Objetivo:** Dejar la app lo bastante sólida para que un empleado la use **sin la presencia del dueño** y para que resista una prueba de intrusión (*pentest*) básica.

> Resumen ejecutivo: la app funcionaba, pero la "seguridad" era en gran parte cosmética. El
> candado del Panel del Dueño aceptaba **cualquier** PIN (y tenía un botón para saltárselo), y
> las reglas de la base de datos **no protegían el dinero**: los abonos no validaban el monto,
> así que cualquiera podía saldar deudas falsas. Se corrigieron los puntos que se pueden arreglar
> desde el código; quedan 2 puntos que requieren la consola de Firebase (ver §4).

---

## 1. Hallazgos críticos (corregidos en este cambio)

### C1 — El PIN del Panel del Dueño era falso 🔴
**Antes:** `LandingScreen.tsx` aceptaba el acceso con la condición
`if (adminPin === '1234' || adminPin.trim() !== '')` — es decir, **cualquier texto no vacío
entraba**. Además había un botón visible *"🔓 Entrar directo (Sí, yo le doy)"* que saltaba el
PIN por completo, y la pantalla imprimía el PIN por defecto (`1234`).
**Riesgo:** cualquier persona con el equipo (un empleado, un cliente curioso) llegaba al panel
con todos los balances, el registro de abonos y **el botón de borrar todo**.
**Corregido:**
- Se eliminó la aceptación de "cualquier valor" y el botón de bypass.
- La primera vez, la app **obliga al dueño a crear un PIN** propio (4–8 dígitos, con confirmación).
- El acceso ahora exige coincidencia **exacta** con ese PIN.
- El PIN se guarda **solo en el dispositivo** (`localStorage`), nunca en la nube pública.

### C2 — Los abonos (pagos a crédito) no validaban el monto 🔴
**Antes:** en `firestore.rules`, la colección `abonos` solo pedía un ID válido — **ningún control
sobre `monto`**. Como el saldo del cliente se calcula `saldo = compras − abonos`, cualquiera
podía escribir un abono con monto enorme (o negativo) y **borrar deudas reales** o corromper la
cartera de "El Fiado".
**Corregido:** las reglas ahora exigen que `monto` sea numérico, ≥ 0 y ≤ $1,000,000 (en centavos),
y que exista `clienteNombre`.

### C3 — Las ventas no tenían integridad en el servidor 🔴
**Antes:** las reglas solo checaban `monto is number && monto >= 0`. La validación real
(que el total cuadre con la suma de los productos) vivía **solo en el navegador**
(`validateSale`), y se salta escribiendo directo a Firestore con la API key pública.
**Corregido:** las reglas ahora exigen en cada venta: monto acotado y no negativo,
`vendedorNombre` presente, `clienteNombre` presente, `items` como lista **no vacía** y
`tipoCobro` dentro de un conjunto permitido. La validación de cliente también se endureció
(rechaza montos no finitos, negativos o fuera de rango).

---

## 2. Hallazgos altos (corregidos)

### A1 — SSRF en `/api/generate-config-from-url` 🟠
**Antes:** el servidor hacía `fetch()` a **cualquier URL** enviada por el cliente, sin filtrar.
Un atacante podía apuntar al endpoint interno de metadatos de la nube
(`http://169.254.169.254/…`) o a servicios internos (`localhost`, `10.x`, `192.168.x`), lo que en
Cloud Run puede **filtrar tokens de la cuenta de servicio**.
**Corregido:** se agregó `assertPublicHttpUrl()`, que:
- solo permite `http`/`https`;
- bloquea `localhost`, `.local`, `.internal` y el host de metadatos;
- **resuelve el DNS** y rechaza si apunta a rangos privados/loopback/link-local (IPv4 e IPv6);
- ya no sigue redirecciones automáticas (`redirect: 'manual'`) y limita el tamaño de la respuesta.

### A2 — Endpoints de IA sin límite de uso 🟠
**Antes:** `/api/predict`, `/api/generate-config`, `/api/generate-logo`, `/api/chat`,
`/api/mystery-shop` eran abiertos y llamaban a la API **de pago** de Gemini. Cualquiera podía
dispararlos en bucle y **agotar tu cuota / inflar el costo** (especialmente la generación de
logos con imágenes).
**Corregido:** se añadió un *rate limiter* en memoria (30 req/min por IP) sobre `/api`, un tope de
tamaño de body (`256kb`) y respuestas `429` con `Retry-After`.

### A3 — `config/global` con validación débil 🟠
**Antes:** se validaba `nombre` y color, pero `productos` y `vendedores` no: se podía inyectar
cualquier cosa (incluso sobrescribir todo el catálogo con precios en cero).
**Corregido:** las reglas exigen que `productos` y `vendedores` sean listas cuando estén presentes.
Se reforzaron también `historial_cierres` (valida `ventas_efectivo`/`gastos_total`) y `clientes`.

---

## 3. Robustez ("que no se rompa nada")

- **Cachés corruptas ya no tumban la pantalla.** `handleSelectSeller` en `RepartidorScreen`
  hacía `JSON.parse(localStorage…)` sin protección: un dato corrupto rompía la selección de
  vendedor. Se introdujo `safeParseArray()` (devuelve `[]` ante cualquier error) y se aplicó ahí.
- **`validateSale` endurecida:** rechaza cantidades/precios/montos no finitos (`NaN`, `Infinity`),
  negativos o por encima del máximo, y compara centavos redondeados para evitar falsos rechazos
  por aritmética de punto flotante.

---

## 4. Riesgos residuales — requieren la consola de Firebase (no se pueden cerrar solo con código)

Estos son los puntos que un pentester señalaría como pendientes. **No** se pueden resolver
editando el repo; necesitan configuración en el proyecto de Firebase:

### R1 — Todos entran como el mismo usuario anónimo 🟠
La app usa `signInAnonymously`, así que `request.auth != null` en las reglas **lo cumple
cualquiera** que abra la página. Las reglas limitan *qué forma* pueden tener los datos, pero no
*quién* escribe. **Recomendación:** activar **Firebase App Check** (para que solo tu app real
pueda hablar con la base) y, para el panel del dueño, usar **autenticación real** (correo/contraseña
o teléfono) con un *custom claim* de administrador.

### R2 — El borrado de registros financieros sigue del lado del cliente 🟠
La función "Limpiar todo / Reset" del panel borra ventas, devoluciones y abonos con *batch
deletes* desde el navegador, por lo que las reglas **deben** permitir `delete`. Eso contradice el
principio de pista de auditoría inmutable del `security_spec.md`. **Recomendación:** mover el
reset a una **Cloud Function** con el Admin SDK (verificando que quien llama es admin) y luego
poner `allow delete: if false` en `ventas`, `devoluciones` y `abonos`. Está marcado con un
comentario en `firestore.rules`.

### R3 — Notas menores
- El PIN de administrador es un control **local del dispositivo**; sube la barra contra un
  empleado casual, pero no sustituye a la autenticación real (R1). Si se olvida, se recupera
  limpiando el `localStorage` del navegador.
- La API key de Firebase en `firebase-applet-config.json` es pública **por diseño** (así funciona
  Firebase web); la protección real la dan las reglas + App Check, no ocultar la key.
- Inyección de *prompt* vía contenido web raspado en los endpoints de IA: de bajo impacto (no hay
  ejecución de herramientas más allá de búsqueda), pero conviene tenerlo presente.

---

## 5. Checklist para "entregar el equipo sin el dueño"

- [x] PIN de administrador real y obligatorio (sin bypass).
- [x] Reglas de Firestore que impiden falsear montos de ventas y abonos.
- [x] SSRF y abuso de costo en los endpoints de IA mitigados.
- [x] La app tolera cachés locales corruptas sin romperse.
- [ ] **Pendiente (consola):** activar Firebase App Check.
- [ ] **Pendiente (consola):** autenticación real para el Panel del Dueño (custom claim admin).
- [ ] **Pendiente (consola):** mover el "Reset" a Cloud Function y bloquear `delete` en el cliente.

## 6. Archivos modificados
- `firestore.rules` — validación estricta de dinero e integridad por colección.
- `src/components/LandingScreen.tsx` — PIN real, sin bypass, con configuración inicial.
- `server.ts` — guard anti-SSRF, rate limiting y tope de body.
- `src/utils/syncEngine.ts` — `safeParseArray()` y `validateSale` endurecida.
- `src/components/RepartidorScreen.tsx` — parseo seguro de caché local.

> Verificado: `tsc --noEmit` sin errores y `npm run build` (cliente + servidor) exitoso.
