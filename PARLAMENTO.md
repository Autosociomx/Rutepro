# 🪑 Parlamento de las Sillas — Bitácora de Colaboración

Este archivo es la **mesa de trabajo compartida** entre las dos IAs que desarrollan RoutePro Elite:

- **Silla A → Claude** (Anthropic / Claude Code)
- **Silla B → Gemini** (Google AI Studio)

---

## ✅ Verificación de Sincronía

Antes de trabajar, cada IA debe confirmar que leyó este archivo llenando esta tabla:

| Silla | IA | Última lectura | Último commit leído | Confirmación |
|-------|----|----------------|---------------------|--------------|
| A | Claude | 2026-06-09 | `468408e` | ✓ Sincronizado |
| B | Gemini | — | — | ⏳ Pendiente de confirmar |

> **Gemini:** cuando entres al repo, actualiza tu fila con la fecha y el hash del último commit que veas en `git log --oneline -1`. Eso confirma que estamos en el mismo punto de partida.

---

## Protocolo

Cada vez que una IA haga un cambio al repo, agrega una entrada aquí con:
- Quién hizo el cambio
- Qué archivos tocó
- Qué problema resolvió
- Qué quedó pendiente para la otra silla
- Fecha

La otra IA debe leer este archivo **antes** de empezar a trabajar para saber el estado actual del proyecto.

---

## Registro de Trabajo

---

### [Claude] — 2026-06-09

**Archivos modificados:**
- `server.ts`
- `src/App.tsx`
- `package.json`
- `package-lock.json`

**Qué se hizo:**

1. **`server.ts` — Modelo de Gemini corregido**
   Se reemplazó `'gemini-3.5-flash'` (modelo inexistente) por `'gemini-2.0-flash'` en los 5 endpoints de IA: `/api/predict`, `/api/generate-config`, `/api/generate-config-from-url`, `/api/generate-logo` (prompt expansion), y `/api/chat`.
   - El endpoint `/api/generate-logo` usa correctamente `imagen-3.0-generate-002` y `gemini-2.5-flash-image` para generación de imágenes — esos NO se tocaron, estaban bien.

2. **`src/App.tsx` — Estrategia offline-first en guardado de config**
   `handleSaveConfig` y `handleLaunchDemoObject` tenían un bug de try/catch anidado: si Firestore fallaba, el `localStorage.setItem` y el `setCfg` nunca se ejecutaban. Ahora el orden es: primero localStorage (siempre funciona), luego Firestore sin bloquear la UX.

3. **`src/App.tsx` — Variable CSS `--oro-l` corregida**
   `--oro-l` recibía el mismo valor hex que `--oro` (sin aclarar). Se agregó `lightenHex()` que mezcla el color con blanco al 30% y ahora `--oro-l` es una variante luminosa real.

4. **`package.json` — Nombre del paquete**
   Renombrado de `'react-example'` a `'rutepro'`.

**Qué queda pendiente para Gemini (Silla B):**

- [ ] **Firestore rules** (`firestore.rules`): Todas las reglas son `allow read, write: if true`. Mientras no haya autenticación real esto es necesario para que la app funcione, pero hay que planearlo. Cuando Gemini implemente auth, las reglas deben actualizarse colección por colección.
- [ ] **Tipos `any`** en los componentes: Las interfaces de `src/types.ts` están bien definidas (`Seller`, `Product`, `Venta`, etc.) pero los componentes usan `any[]` para `productos` y `vendedores`. Sería bueno tiparlos.
- [ ] **Ventas en localStorage** (`rp_ventas`): Las ventas del día viven en el navegador, no en Firestore. Si el repartidor cambia de dispositivo o limpia caché, se pierden. Considerar migrarlas a Firestore bajo una colección con ID de sesión o fecha.
- [ ] **Auth**: `getAuth()` está inicializado en `src/firebase.ts` pero nunca se usa para proteger rutas ni datos. Cuando se implemente login, las Firestore rules también necesitan actualizarse.

**Notas adicionales:**
- El `firebase-applet-config.json` está commiteado al repo. Las credenciales de Firebase web son técnicamente públicas, pero si se quiere mayor seguridad se puede mover a variables de entorno.
- El campo `demoSel.insight` usa `dangerouslySetInnerHTML` en `App.tsx:338`. El contenido viene de `src/data.ts` (estático), así que no es XSS real ahora, pero si en el futuro `insight` viene de Firestore/usuario hay que sanitizarlo.

---

> *Próxima silla en trabajar: agrega tu entrada abajo siguiendo el mismo formato.*
