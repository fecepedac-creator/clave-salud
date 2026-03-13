# Resumen Ejecutivo: Migración a Agente de Agendamiento ClaveSalud

Esta propuesta técnica detalla la evolución del chatbot actual de WhatsApp (basado en una máquina de estados rígida) hacia un **Agente Agentic** capaz de razonar sobre la agenda médica de **ClaveSalud**.

## 🎯 Objetivo
Transformar el flujo conversacional en una experiencia fluida que entienda lenguaje natural, permitiendo a los pacientes agendar horas, consultar dudas y recibir asistencia para el "Auto-Rescate de Controles" sin las frustraciones de un bot de "Botones" tradicional.

## 💡 Propuesta: Arquitectura Híbrida "Gemini-Tools"
No buscamos delegar el control total a una IA, sino centralizar el **razonamiento** en Gemini 1.5 Flash y la **ejecución** en herramientas (tools) determinísticas escritas en TypeScript.

1.  **Razonador**: Gemini 1.5 Flash (Bajo costo, baja latencia).
2.  **Operadores (Tools)**: Funciones de Firebase que interactúan con Firestore de forma segura.
3.  **Memoria**: Persistencia en la colección `conversations` para trazabilidad y contexto.

## 🚀 Impacto Esperado
- **Menor Tasa de Abandono**: El paciente no tiene que repetir información si ya la dio en su primer mensaje (*"Hola, quiero con el Dr. Cepeda para mañana"*).
- **Escalabilidad Multi-centro**: El centro médico (ej: Los Andes) se inyecta como contexto dinámico, manteniendo el aislamiento de datos.
- **Preparación Clínica**: Automatización de instrucciones de preparación para exámenes según el servicio reservado.
