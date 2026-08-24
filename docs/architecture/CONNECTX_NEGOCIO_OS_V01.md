# ConnectX Negocio OS v0.1

## Objetivo

Unificar la experiencia operativa probada en Campestre de Mora, María Belén, La Favorita y RoutePro en un solo producto configurable, multiempresa y extensible.

La regla principal es: **ninguna función nueva se programa para un cliente específico**. Toda capacidad debe pertenecer al Core o a uno de los módulos activables por configuración.

## Producto

### Core común

- negocio y sucursales
- usuarios, membresías y permisos
- catálogo, productos, categorías y precios
- clientes
- pagos y caja
- inventario y movimientos
- configuración del negocio
- eventos y auditoría

### ConnectX Local

Operación dentro del establecimiento.

Flujo canónico:

`cliente -> mesa/persona -> pedido -> estación -> producción -> entrega -> cuenta -> pago -> corte`

Casos de origen: Campestre de Mora.

### ConnectX Rutas

Operación fuera del establecimiento.

Flujo canónico:

`matriz -> carga -> repartidor -> ruta -> cliente -> entrega/venta -> devolución/fiado -> cierre -> conciliación`

Casos de origen: María Belén, La Favorita y RoutePro.

### ConnectX Web

Canal digital generado desde el mismo catálogo y configuración:

- sitio público
- menú o catálogo
- pedidos online
- QR
- pickup/delivery
- WhatsApp

### ConnectX Growth

Capa de crecimiento conectada con resultados reales:

`dato -> oportunidad -> campaña -> creativo -> publicación -> pedido -> ingreso -> atribución`

## Decisión técnica

Se adopta **monolito modular** en lugar de microservicios para v0.x.

Motivos:

1. Menor complejidad operativa.
2. Un equipo puede evolucionar el producto sin coordinar despliegues distribuidos.
3. Permite separar dominios sin pagar el costo de infraestructura de microservicios.
4. Los límites de módulo quedan explícitos y pueden extraerse más adelante si el volumen lo exige.

## Persistencia

PostgreSQL será la fuente de verdad objetivo. Supabase puede ser la primera plataforma de ejecución, pero la arquitectura no debe depender de APIs propietarias para la semántica del dominio.

Toda entidad operacional debe quedar aislada por `tenant_id` y `business_id`. Cuando exista operación por sucursal, también por `location_id`.

## Offline-first

ConnectX Rutas y las superficies de operación crítica de ConnectX Local deben tolerar pérdida de conectividad.

Patrón:

`UI -> IndexedDB/local queue -> Sync Engine -> API -> PostgreSQL`

Cada comando crítico debe llevar `idempotency_key` para evitar ventas, pagos o movimientos duplicados durante reintentos.

## BusinessConfig

El comportamiento de cada cliente se expresa como configuración, no como forks de código.

Ejemplo de módulos:

```json
{
  "modules": {
    "local": true,
    "routes": false,
    "web": true,
    "growth": true
  }
}
```

La IA puede generar un borrador de configuración desde una descripción, menú o sitio web. El borrador debe ser aprobado antes de afectar reglas operativas críticas.

## Eventos canónicos iniciales

- `order.created`
- `order.sent`
- `production.started`
- `production.completed`
- `sale.completed`
- `payment.received`
- `cash.closed`
- `route.started`
- `route.stop.completed`
- `delivery.completed`
- `return.registered`
- `credit.created`
- `credit.payment_received`
- `inventory.moved`
- `campaign.created`
- `creative.generated`
- `web.order.created`

## Migración

No se hará Big Bang Rewrite.

1. v0.1 Core multiempresa y contratos de dominio.
2. v0.2 Rutas: absorber María Belén + La Favorita + RoutePro.
3. v0.3 Local: absorber Mora/Campestre.
4. v0.4 Web + Growth.

Los repositorios y bases actuales permanecen como referencias operativas durante la migración.
