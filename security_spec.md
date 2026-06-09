# Pliego de Seguridad (Security Specification) for RoutePro Elite Firestore Rules

Este documento detalla las invariantes de seguridad de datos, las vulnerabilidades mitigadas mediante las reglas de Firestore, y los vectores de ataque prevenidos.

## 1. Invariantes Core de Datos (Data Invariants)

- **Configuración Global (`/config/global`)**:
  - Solo el ID `global` está permitido.
  - El campo `nombre` no de exceder los 100 caracteres.
  - El campo `color_principal` debe coincidir estrictamente con el formato de patrón hexadecimal de color (`#RRGGBB` o `#RGB`).
- **Registros de Ventas (`/ventas/{ventaId}`)**:
  - El monto total (`monto`) de la venta debe ser entero positivo o cero (medido en centavos).
  - El nombre del vendedor (`vendedorNombre`) debe estar presente y ser cadena de texto.
  - La eliminación de ventas está deshabilitada globalmente para conservar pistas de auditoría financiera (anti-fraude).
- **Registros de Devoluciones (`/devoluciones/{devolucionId}`)**:
  - La cantidad devuelta (`cantidad`) debe ser entera positiva o cero.
  - Las eliminaciones también están estrictamente bloqueadas.
- **Historial de Cierres (`/historial_cierres/{cierreId}`)**:
  - El efectivo total recolectado en ventas (`ventas_efectivo`) debe ser entero positivo o cero.

## 2. Mitigación del "Dirty Dozen" (Payload Attack Scenarios)

1. **Inyección de Configuración Masiva**: Un usuario malintencionado intenta sobrescribir `/config/global` con datos arbitrarios o gigantescos.
   - *Mitigación:* Se valida tipo de datos `string` en `nombre` <= 100 caracteres.
2. **Inyección de Atributos de Color SQL/HTML**: Intentos de romper hojas de estilo inyectando colores extraños (ej. `#D97706; font-size:900px`).
   - *Mitigación:* Se valida color mediante la expresión regular estricta `^[A-Fa-f0-9]{3,6}$`.
3. **Monto Negativo de Ventas (Lavado/Reembolso Falso)**: Un repartidor manda una transacción con `monto: -50000` centavos para vaciar ficticiamente las ventas reportadas en su ruta.
   - *Mitigación:* Las reglas exigen `monto >= 0`.
4. **Venta con Atributos de Tipado Malicioso**: Envío de arreglos complejos o valores nulos en el nombre del vendedor.
   - *Mitigación:* Exige `vendedorNombre is string`.
5. **Eliminación Arbitraria de Transacciones**: Un usuario malintencionado quiere borrar registros de ventas de la noche a la mañana.
   - *Mitigación:* Se aplica `allow delete: if false` en la colección de `/ventas` y `/devoluciones`.
6. **Polución de Rutas Métricas**: Ataques que intentan escribir métricas utilizando IDs de ruta que no corresponden.
   - *Mitigación:* Valida formato de ID seguro (`isValidId(metricId)`).
7. **Peticiones masivas de escaneo de base de datos**: Intento de listar la base de datos completa barriendo el wildcard.
   - *Mitigación:* Se eliminó el wildcard abierto `{document=**}` y se configuró a `if false`, restringiendo lecturas arbitrarias.

---
*Fin del Pliego de Seguridad.*
