---
name: "LegalTrace_CL"
description: "Habilidad especializada en la auditoría y cumplimiento de la normativa chilena para fichas clínicas electrónicas (Ley 20.584, 19.628, 21.656)."
---

# LegalTrace_CL: Auditoría y Trazabilidad de Salud

Esta habilidad capacita al agente para gestionar, verificar y auditar el manejo de datos de salud en Clave Salud, asegurando que cada acción sea legalmente rastreable.

## Capacidades
1. **Verificación de Auditoría**: Puede analizar logs en `auditLogs` para confirmar quién accedió a qué ficha y por qué.
2. **Control de Retención**: Identifica registros que superan los 15 años de antigüedad obligatoria (Ley 20.584, Art. 13).
3. **Manejo de Derecho al Olvido**: Gestiona la eliminación de antecedentes de pacientes oncológicos tras 5 años del alta clínica (Ley 21.656).
4. **Validación de Roles**: Asegura que solo profesionales autorizados o care teams accedan a datos sensibles.

## Seguridad y Privacidad
- **Acceso Restringido**: Esta habilidad solo debe operar bajo el contexto de una solicitud explícita de auditoría o mantenimiento de datos.
- **Sin PII innecesaria**: No debe mostrar ni almacenar RUTs o nombres completos en logs temporales más allá de lo estrictamente necesario para la auditoría.
- **Cumplimiento**: Almacena trazas inmutables en Firestore.

## Herramientas
- `scripts/verify_audit_trace.js`: Script para validar la existencia de logs de auditoría para un paciente o sesión específica.

## Instrucciones de Uso
Activar cuando se pida: "Revisa quién vio la ficha de X", "Audita los accesos de este mes", o "¿Este paciente cumple con el derecho al olvido?".
