---
name: "PatientConsentManager"
description: "Habilidad para gestionar, verificar y auditar los consentimientos informados de los pacientes, asegurando el cumplimiento de la Ley 20.584 y Ley 21.656 (Chile)."
---

# PatientConsentManager: Gestor de Consentimientos

Esta habilidad dota al asistente de la capacidad de administrar los derechos del paciente sobre su información clínica, garantizando que cada intervención cuente con la autorización debida.

## Capacidades
1. **Clasificación de Consentimientos**:
   - **General**: Para atención y tratamiento básico.
   - **Telemedicina**: Específico para atenciones remotas (NCh3442).
   - **Interoperabilidad**: Autorización para compartir datos vía HL7 FHIR con la red nacional (Ley 21.656).
   - **Investigación**: Para uso de datos anonimizados en estudios.
2. **Derecho al Olvido Oncología**: Implementa la lógica de la Ley 21.656 para ocultar antecedentes oncológicos tras 5 años de finalizado el tratamiento radial/curativo.
3. **Control de Revocación**: Permite al paciente retirar sus permisos en cualquier momento, inhabilitando inmediatamente los flujos dependientes.
4. **Trazabilidad Inmutable**: Vincula cada consentimiento con el historial de auditoría de `LegalTrace_CL`.

## Seguridad y Privacidad
- **Consentimiento Explícito**: No se asume consentimiento por omisión para telemedicina o interoperabilidad.
- **Validación de Capacidad**: Verifica si el paciente es menor de edad para requerir la firma del tutor legal.

## Herramientas
- `scripts/check_consent_validity.js`: Script para validar si una acción clínica está autorizada por el paciente.

## Instrucciones de Uso
Activar cuando se pida: "Revisa si el paciente autorizó interoperabilidad", "Aplica el derecho al olvido para este caso", o "¿Podemos realizar telemedicina con este usuario?".
