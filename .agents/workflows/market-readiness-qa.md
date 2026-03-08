---
description: Auditoría de Integridad y Operación de Mercado (QA Autónomo)
---

Este flujo de trabajo documenta el proceso de auditoría y pruebas críticas para asegurar que **Clave Salud** sea apto para el lanzamiento comercial. Se enfoca en la robustez técnica, seguridad de datos y cumplimiento legal.

## Fase 1: Prevención de Colisiones en Agendamiento (Concurrency)
**Hipótesis:** El sistema de agendamiento debe ser capaz de manejar peticiones simultáneas sin generar "overbooking" mediante transacciones atómicas.
- [ ] Implementar un test de Playwright que simule dos clics de reserva en el mismo milisegundo.
- [ ] Verificar que Firestore rechace la segunda escritura preservando la integridad del slot.
- [ ] Ajustar lógica en `useBooking.ts` o Cloud Functions si se detectan fallos.

## Fase 2: Blindaje Multi-Tenant (Data Isolation)
**Hipótesis:** Un usuario de un Centro A no puede acceder a datos sensibles de un Centro B, incluso forzando el ID en la URL o API.
- [ ] Ejecutar tests de intrusión con dos contextos de navegador diferentes (Playwright Auth).
- [ ] Intentar inyectar IDs de pacientes de otros centros en las peticiones de consulta.
- [ ] Validar que las nuevas `firestore.rules` bloqueen efectivamente el acceso asimétrico.

## Fase 3: Integridad Semántica (FHIR / SNOMED-CT)
**Hipótesis:** El guardado de antecedentes y atenciones clínicos debe persistir códigos internacionales y no solo texto.
- [ ] Realizar una atención de prueba completa.
- [ ] Inspeccionar el documento generado en Firestore para verificar la presencia de `snomedCode` y `system` en el array de `medicalHistory`.
- [ ] Validar el formato de `fhirMetadata` en la ficha del paciente.

## Fase 4: Validez Legal y Firma de Documentos
**Hipótesis:** Las recetas y certificados generados deben ser auditables y técnicamente válidos.
- [ ] Probar la generación de PDF desde el módulo de Profesional.
- [ ] Verificar que los campos de firma y RUT profesional se incluyan correctamente.
- [ ] Evaluar la implementación de un sistema de verificación QR para habilitar la validez de mercado.

## Reporte Final de Certificación
Al terminar cada fase, se actualizará este documento con los hallazgos:
| Fase | Estado | Hallazgos | Acción Realizada |
| :--- | :--- | :--- | :--- |
| Concurrencia | Pendiente | - | - |
| Multi-tenant | Pendiente | - | - |
| FHIR Integrity | Pendiente | - | - |
| Legal/PDF | Pendiente | - | - |
