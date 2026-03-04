# Regla: Privacidad y Anonimización de Datos

- **Uso de Datos en Reportes**: Todo reporte generado para el nivel de SuperAdmin o para exportaciones de análisis masivo debe pasar obligatoriamente por un proceso de anonimización.
- **Protección de PII**: Queda estrictamente prohibido mostrar RUTs o nombres completos en interfaces de estadísticas generales o tableros de gestión poblacional.
- **Seudonimización Preferente**: Cuando se requiera seguir la evolución de un paciente de forma anónima, se debe preferir el uso de hashes seguros o IDs temporales sobre los datos reales.
- **Activación de Skill**: El agente debe activar `ClinicalDataAnonymizer` antes de procesar cualquier conjunto de datos clínicos que vaya a ser compartido fuera del círculo de cuidado directo del paciente.
