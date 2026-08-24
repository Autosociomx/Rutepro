# ConnectX Core

This folder is the transition boundary between the current RoutePro implementation and ConnectX Negocio OS.

## Rules

1. Existing production flows keep working while adapters are introduced.
2. New reusable domain contracts live here, never inside a customer-specific screen.
3. No live database migration is executed from this branch.
4. All operational writes must eventually be scoped by tenant/business and support idempotency.
5. AI may propose configuration or recommendations, but deterministic services execute critical sales, payment, inventory and closing operations.

## Migration order

- `legacyRouteProAdapter.ts`: current RoutePro config -> BusinessConfig.
- Next: current RoutePro sales/returns -> RouteRun/RouteSale contracts.
- Then: Mora/Campestre adapters -> LocalOrder/ProductionTask.
- Finally: persistence and RLS once auth/membership design is implemented.
