---
name: "MultiTenantIsolationGuard"
description: "Habilidad para garantizar el aislamiento total de datos entre diferentes centros médicos (multi-tenancy) en Clave Salud."
---

# MultiTenantIsolationGuard: Aislamiento Multitenant

Esta habilidad asegura que el `centerId` funcione como una frontera lógica infranqueable, evitando que los datos de un centro médico sean visibles o modificables por usuarios de otros centros.

## Capacidades
1. **Validación de CenterContext**: Asegura que cada consulta y operación de escritura incluya el filtro `centerId` correspondiente al contexto del usuario por defecto.
2. **Excepción de Continuidad Clínica**: Permite que un profesional acceda a la historia de un paciente en el Centro A si ya existe una relación previa documentada (vía `careTeamUids` o `ownerUid`), incluso si el profesional está operando actualmente desde el Centro B.
3. **Gestión de Profesionales Multi-Centro**: Controla el acceso de médicos que trabajan en múltiples sucursales, asegurando la visibilidad legítima basada tanto en la sede como en la relación con el paciente.
4. **Detección de Cross-Tenant Leakage**: Identifica accesos no justificados (sin relación previa ni mismo `centerId`).

## Seguridad y Privacidad
- **Aislamiento por Diseño**: Los datos nunca deben mezclarse en la capa de aplicación ni en la de base de datos sin una clave de segregación explícita.
- **Jerarquía SuperAdmin**: Permite la visibilidad global solo para roles con privilegios `SuperAdmin` debidamente autenticados, manteniendo pistas de auditoría cruzada.

## Herramientas
- `scripts/verify_tenant_isolation.js`: Script para auditar la base de datos en busca de registros huérfanos o mal segregados.

## Instrucciones de Uso
Activar cuando se pida: "Configura un nuevo centro médico", "¿Están seguros los datos del Centro A?", o "Verifica que este médico no vea pacientes de mis otros centros".
