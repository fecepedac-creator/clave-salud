# Protocolo de Autonomía: Modo "Full Agent"

Este documento describe cómo interactuar con el equipo de agentes de **Clave Salud** para maximizar la velocidad de desarrollo sin sacrificar la seguridad médica.

## 1. Cómo Iniciar una Tarea
Simplemente describe el requerimiento en el chat de Antigravity (ej: *"Quiero que el dashboard de médico muestre una alerta si el paciente es fumador activo"*).

## 2. El Ciclo de Desarrollo
1.  **Análisis (Autónomo)**: El **Guardian** activará a **Archie**, **Dex**, **Pyro** y **Q-Bit** para diseñar el cambio.
2.  **Plan Maestro**: Recibirás un único `implementation_plan.md` que resume los cambios en Frontend, Backend y Seguridad.
3.  **Tu Única Aprobación**: Solo necesitas dar el "OK" al Plan Maestro. No te pediremos aprobación para cambiar archivos individuales.
4.  **Ejecución y Test**: Los agentes trabajarán en conjunto para implementar y verificar la solución.
5.  **Entrega**: Recibirás un `walkthrough.md` con los resultados finales.

## 3. Niveles de Autonomía
| Acción | Nivel de Autonomía |
| :--- | :--- |
| Definir modelos de datos | Alta (Agente propone, tú apruebas plan) |
| Refactorizar código | Total (Agente decide según ARCHIE.md) |
| Borrar registros de pacientes | Cero (Requiere tu intervención manual) |
| Cambiar reglas de seguridad | Media (Requiere test de Q-BIT y aprobación de GUARDIAN) |

---
> [!TIP]
> Si en algún momento deseas entrar en "modo detalle", puedes pedirle al **Guardian** un desglose técnico de lo que hizo cada agente específico.
