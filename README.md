# RoutePro Elite

**Sistema de Inteligencia Operativa para negocios de distribución.**

Recupera el control del dinero que hoy no puedes ver.

---

## ¿Qué es RoutePro Elite?

RoutePro Elite no es una app de reparto.

Es un sistema que convierte cada venta, cobro y entrega de tu operación en información visible y accionable — en tiempo real, desde el celular, sin internet.

Diseñado para:

- Tortillerías
- Panaderías
- Carnicerías
- Distribuidoras
- Purificadoras
- Negocios de reparto local

---

## El problema que resuelve

- ¿Cuánto te deben tus clientes hoy?
- ¿Dónde está tu repartidor y cuánto lleva cobrado?
- ¿Cuánto producto se perdió sin registrar?
- ¿Por qué la caja no cuadra al cierre del día?

Si no puedes responder esas preguntas ahora mismo, tienes dinero que no puedes ver.

---

## Stack técnico

- **Frontend:** React 19 + TypeScript 5.8 + Vite 6
- **Estilos:** Tailwind CSS 4
- **Backend:** Firebase 12 (Auth + Firestore con persistencia offline)
- **IA:** Google Gemini 2.0 Flash (configuración express, chat de ruta)
- **Offline-first:** IndexedDB + Firestore persistent cache

---

## Módulos

| Módulo | Descripción |
|---|---|
| **Repartidor** | Registro de ventas en ruta, crédito, devoluciones y GPS |
| **Mostrador** | Punto de venta por unidad o monto, tipos de cobro |
| **Admin** | Dashboard en tiempo real, cierres, historial, métricas por vendedor |
| **Configuración** | Catálogo, vendedores, metas diarias, PIN de acceso |

---

## Desarrollo local

```bash
npm install
cp .env.local.example .env.local   # agregar GEMINI_API_KEY y Firebase config
npm run dev
```

---

## Arquitectura de colaboración

Este proyecto se desarrolla con dos agentes de IA en paralelo:

- **Silla A:** Claude (Anthropic)
- **Silla B:** Gemini (Google AI Studio)

La coordinación, decisiones técnicas y acuerdos entre sillas se documentan en [`PARLAMENTO.md`](./PARLAMENTO.md).

---

> "Recupera el control del dinero que hoy no puedes ver."
>
> — RoutePro Elite
