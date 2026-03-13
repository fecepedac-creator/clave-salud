# Diagnóstico de Estrategia Anterior (Testing V1)

La estrategia anterior dependía exclusivamente de **Playwright E2E** con autenticación real (`auth.setup.ts`), lo cual presentaba fallos estructurales que detenían el desarrollo.

## Problemas Detectados

1. **Dependencia de IndexedDB**: Firebase Auth guarda la sesión en la base de datos interna `indexedDB`, la cual no es capturada automáticamente por el `storageState` de Playwright (que solo lee cookies y localStorage).
2. **Setup Inestable**: Intentar "puentear" (bridge) IndexedDB a LocalStorage resultó en archivos de sesión vacíos y inconsistencias de tiempo.
3. **Lentitud de Feedback**: Cualquier pequeña edición en la UI requería ejecutar un flujo de login completo (30-60 segundos), lo que ralentiza la validación de componentes visuales.
4. **Acoplamiento de Datos**: Los tests fallaban ante cambios en la base de datos real o latencia en el backend (`onSnapshot` de Firestore), dificultando distinguir errores de UI de errores de red.

## Conclusión
La estrategia V1 era "todo o nada". Si el login fallaba (frecuentemente por `indexedDB`), no se podía testear nada de la aplicación. La V2 introduce el **Modo Demo** para desacoplar el testeo visual de la complejidad del backend.
