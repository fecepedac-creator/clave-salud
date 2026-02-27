---
name: "DigitalPrescriptionExpert"
description: "Habilidad para asegurar que las recetas clínicas y documentos médicos cumplan con el Decreto 41 del MINSAL y estándares de la Superintendencia de Salud de Chile."
---

# DigitalPrescriptionExpert: Estándares de Prescripción

Esta habilidad guía al asistente en la generación y validación de documentos clínicos legales, asegurando que cada prescripción emitida en Clave Salud sea válida y segura.

## Capacidades
1. **Validación Normativa**: Revisa que las recetas contengan: Nombre del profesional, RUT, Registro SIS, Fecha, Vigencia y Dosificación clara (Decreto 41).
2. **Gestión de Recetas Retenidas**: Instruye sobre el formato obligatorio para fármacos sujetos a control de stock, incluyendo la imprenta y datos del paciente.
3. **Firmas Digitales**: Valida la integridad de los documentos firmados digitalmente según la Ley 19.799.
4. **Plantillas Legales**: Asegura que las interconsultas y certificados sigan la estructura oficial para ser aceptados en la red pública y privada.

## Seguridad y Privacidad
- **Integridad Documental**: Una vez emitida una receta final, no se permiten modificaciones sin generar una nueva versión y anular la anterior.
- **Identificación de Emisor**: Garantiza que el emisor de la receta tenga los privilegios activos y el rol de MEDICO u ODONTOLOGO (según corresponda).

## Instrucciones de Uso
Activar cuando se pida: "Crea una receta para el paciente X", "Genera una interconsulta", o "¿Cumple esta receta con las normas del MINSAL?".
