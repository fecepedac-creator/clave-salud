# Regla: Uso de LegalTrace_CL

- **Uso Obligatorio**: Esta habilidad debe activarse en todas las tareas que involucren:
  - Auditoría de accesos a fichas clínicas.
  - Procesos de borrado o archivado de pacientes.
  - Cambios en las `firestore.rules` que afecten la privacidad.
- **Prioridad Legal**: Ante cualquier duda sobre el manejo de un dato sensible, el agente debe priorizar las instrucciones de `LegalTrace_CL` sobre la eficiencia o rapidez de desarrollo.
- **Inmutabilidad**: Toda acción de esta habilidad debe quedar registrada en el log de auditoría del sistema con el identificador de la acción del agente.
