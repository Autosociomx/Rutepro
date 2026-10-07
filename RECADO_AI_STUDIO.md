# 📮 Recado para Google AI Studio — RoutePro Elite

**Fecha:** 2026-10-07
**De:** Copilot (sesión de auditoría)
**Para:** La instancia de Gemini en Google AI Studio que continúe este proyecto
**Estado del código:** `tsc --noEmit` ✅ · `npm run build` ✅ · CodeQL 0 alertas ✅

---

## 🚫 ANTES DE TOCAR NADA — Reglas del proyecto

1. **El directorio `repolink/` es un producto independiente (RepoLink AI). NO lo elimines, NO lo muevas, NO lo refactorices.** Es zona protegida por decisión del dueño (ver `PARLAMENTO.md` § Zona Protegida). Un agente anterior lo borró por error y hubo que restaurarlo.
2. **Scope de trabajo RoutePro:** `src/`, `server.ts`, `firestore.rules`, `package.json`, `index.html`, `vite.config.ts`, configs raíz.
3. **Todo el dinero se maneja en CENTAVOS** (enteros). `$18.50 = 1850`. Nunca flotantes para dinero.
4. **Idioma de producto:** español de México. La UI, los toasts y las respuestas de IA nunca van en inglés.
5. Después de cada cambio: ejecuta `npx tsc --noEmit` y `npm run build`. Ambos deben pasar.

---

## ✅ Lo que YA se corrigió (no lo repitas, no lo rompas)

| # | Corrección | Archivo |
|---|---|---|
| 1 | Modelo inexistente `gemini-3.5-flash` → `gemini-2.0-flash` (constante `GEMINI_TEXT_MODEL`) | `server.ts` |
| 2 | `safeParseModelJson()` — parseo tolerante de respuestas Gemini con validación de estructura | `server.ts` |
| 3 | Deuda de crédito ya no suma ventas en efectivo (solo `tipoCobro === 'crédito'`) | `AdminScreen.tsx` |
| 4 | "Hora de visita" usa la venta más antigua por timestamp (antes: la última) | `AdminScreen.tsx` |
| 5 | `getClientesLedger` y `getProductPopularity` memoizados con `useMemo` | `AdminScreen.tsx` |
| 6 | Borrado total exige escribir "BORRAR" para habilitar el botón | `AdminScreen.tsx` |
| 7 | PIN de admin guardado como hash SHA-256 (con migración desde texto plano) | `LandingScreen.tsx` |
| 8 | `logo_url` validado: solo `https:` o `data:image/...;base64,` | `ConfigScreen.tsx` |
| 9 | Consulta de clientes limitada a 500 docs por vendedor | `RepartidorScreen.tsx` |
| 10 | IDs con `crypto.randomUUID()` (antes `Date.now()` con riesgo de colisión) | `ConfigScreen.tsx` |
| 11 | Título real y `lang="es-MX"` | `index.html` |

Base previa ya existente (no regresar): reglas Firestore endurecidas, guard anti-SSRF, rate limiting 30 req/min en `/api`, `validateSale()` en `src/utils/syncEngine.ts`.

---

## 🎯 Pendientes priorizados (de mayor a menor impacto)

### FASE 1 — Robustez que sí está en tus manos (código)

1. **Extraer `formatPrice()` duplicado** (está en AdminScreen, RepartidorScreen, MostradorScreen) a `src/utils/formatting.ts` e importarlo en las 3 pantallas.
2. **Extraer hook de geolocalización duplicado** (`RepartidorScreen.tsx` ~línea 325 y `MostradorScreen.tsx` ~línea 72) a `src/hooks/useGeolocation.ts`.
3. **Timeout en fetch del chat IA** (`AdminScreen.tsx` ~línea 551): envolver con `AbortSignal.timeout(15000)` y mensaje de error claro al usuario.
4. **Botones de cantidad táctiles** (`RepartidorScreen.tsx` ~línea 1002): subir de `w-5` (20px) a mínimo `w-10 h-10` (40px) — WCAG pide 44px.
5. **Contraste**: `text-emerald-400` sobre `bg-[#111520]` no llega a WCAG AA; subir a `emerald-300`.
6. **Labels/aria en modales**: el drawer de AdminScreen necesita `role="dialog"` y `aria-labelledby`; inputs de búsqueda necesitan `aria-label`.
7. **Code-splitting**: el bundle es 997 kB. Usar `React.lazy()` para `AdminScreen`, `RepartidorScreen`, `MostradorScreen`, `ConfigScreen` en `App.tsx`.
8. **`validateSale` en TODOS los puntos de entrada**: AdminScreen registra abonos/ventas manuales sin pasar por la validación que sí usan Repartidor/Mostrador.
9. **Merge offline/online con regla explícita** (`AdminScreen.tsx` ~línea 275): implementar Last-Write-Wins por `timestamp` cuando el mismo ID existe en local y nube con datos distintos.

### FASE 2 — Océanos azules (diferenciadores de negocio)

10. **Score de "Fiado Inteligente"**: con `ventas` + `abonos` ya registrados, calcular por cliente: días promedio de liquidación, % de compras a crédito, historial de pagos puntuales. Mostrar semáforo 🟢🟡🔴 en el ledger de clientes.
11. **Barra de progreso de meta diaria del repartidor**: el campo `meta_diaria` existe en el tipo `Seller` pero no se muestra. Una barra que sube con cada venta (recompensa de progreso).
12. **Cierre de caja narrativo por IA**: endpoint nuevo que resuma el día en lenguaje del dueño ("Juan dejó $4,320; la merma subió 12% vs martes pasado").
13. **Predicción con anclas**: `/api/predict` debería mostrar "tu mejor martes cargaste X kg" como ancla junto a la sugerencia.

### FASE 3 — Requiere consola de Firebase (NO está en el código; avisar al dueño)

14. **Firebase App Check** (solo la app real puede hablar con la base).
15. **Autenticación real del dueño** (correo/teléfono + custom claim admin) — hoy todo entra como anónimo.
16. **Mover el "Reset/Limpiar todo" a Cloud Function** con Admin SDK y luego poner `allow delete: if false` en `ventas`, `devoluciones`, `abonos` en `firestore.rules` (hay un comentario marcado en las reglas).

---

## 📋 Prompt listo para pegar en AI Studio

Copia el bloque de abajo tal cual:

```text
Estás continuando el desarrollo de RoutePro Elite (repo Autosociomx/Rutepro), una PWA en React 19 + TypeScript + Express + Firestore + Gemini para liquidación de rutas de reparto multigiro, en español de México.

LEE PRIMERO el archivo RECADO_AI_STUDIO.md en la raíz del repo: contiene las reglas del proyecto, lo que YA se corrigió (no lo repitas ni lo rompas) y los pendientes priorizados.

REGLAS INQUEBRANTABLES:
1. El directorio repolink/ es un producto independiente (RepoLink AI). PROHIBIDO eliminarlo, moverlo o refactorizarlo. Tu scope es: src/, server.ts, firestore.rules, index.html, vite.config.ts y configs raíz.
2. Todo el dinero se maneja en CENTAVOS (enteros). Nunca flotantes.
3. UI y respuestas de IA siempre en español de México.
4. Después de cada cambio ejecuta `npx tsc --noEmit` y `npm run build`; ambos deben pasar antes de dar por terminado.
5. No agregues dependencias nuevas sin justificarlo. No borres tests ni funciones existentes.

TU TAREA HOY (Fase 1 del recado, en este orden):
1. Extrae `formatPrice()` (duplicado en AdminScreen.tsx, RepartidorScreen.tsx, MostradorScreen.tsx) a `src/utils/formatting.ts` e impórtalo en las 3 pantallas.
2. Crea `src/hooks/useGeolocation.ts` con la lógica de geolocalización duplicada de RepartidorScreen (~línea 325) y MostradorScreen (~línea 72), y úsala en ambos.
3. En el fetch del chat IA de AdminScreen (~línea 551) agrega `AbortSignal.timeout(15000)` y muestra al usuario un mensaje claro si expira.
4. Sube los botones de cantidad +/- de RepartidorScreen (~línea 1002) de w-5 a w-10 h-10 mínimo.
5. En App.tsx aplica `React.lazy()` + `Suspense` para cargar AdminScreen, RepartidorScreen, MostradorScreen y ConfigScreen bajo demanda (el bundle pesa 997 kB).
6. En el ledger de AdminScreen (~línea 275), implementa resolución de conflictos Last-Write-Wins por campo `timestamp` cuando el mismo ID exista en localStorage y en Firestore con datos distintos.

Cuando termines cada punto, verifica tsc + build. Al final, resume en español qué cambiaste en cada archivo y qué queda pendiente del recado.
```
