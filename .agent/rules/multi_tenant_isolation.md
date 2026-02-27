# Regla: Aislamiento Multitenant (Multi-Tenant Isolation)

- **Filtro por Defecto**: Las consultas deben filtrar por `centerId` para mantener el orden administrativo del centro actual.
- **Excepción de Continuidad**: Se permite y fomenta el acceso a la historia clínica de un paciente en otros centros siempre que el profesional solicitante sea parte del `careTeamUids` o sea el `ownerUid` de dicho registro en el centro de origen.
- **Prioridad del Profesional**: El sistema debe facilitar la "vista unificada" del paciente para el médico que ya lo conoce, rompiendo el aislamiento de centro solo para ese vínculo específico (Profesional-Paciente).
- **Activación de Skill**: El agente debe activar `MultiTenantIsolationGuard` para validar que estos accesos "cross-center" sean legítimos y no fugas accidentales.
