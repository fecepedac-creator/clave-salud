# Arquitectura Interna y Políticas de Importación

Para asegurar la escalabilidad y prevenir dependencias circulares en Clave Salud, seguimos esta jerarquía de capas:

## 1. Capa de Datos y Tipos (Hojas)
- **Archivos**: `types.ts`, `constants.ts`, `firebase.ts`, `CenterContext.ts`.
- **Regla**: NO pueden importar nada de las capas superiores (hooks, componentes, App).
- **Dependencias**: Librerías externas (Firebase, React) y otros archivos de esta misma capa.

## 2. Capa de Utilidades
- **Carpeta**: `utils/`.
- **Regla**: NO pueden importar hooks ni componentes.
- **Dependencias**: Capa 1 y otras utilidades.

## 3. Capa de Hooks
- **Carpeta**: `hooks/`.
- **Regla**: NO pueden importar componentes ni `App.tsx`.
- **Dependencias**: Capas 1, 2 y otros hooks.

## 4. Capa de Componentes
- **Carpeta**: `components/`.
- **Regla**: NO pueden importar desde `App.tsx` o `index.tsx`.
- **Dependencias**: Capas 1, 2, 3 y otros componentes.

## 5. Raíz de la Aplicación
- **Archivos**: `App.tsx`, `index.tsx`.
- **Regla**: Orquestador principal. Puede importar de todas las capas anteriores.

---

## Prevención de Ciclos
Si detectas que un componente A necesita algo de un componente B y viceversa:
1. **Extrae la lógica compartida** a un Hook (Capa 3) o una Utilidad (Capa 2).
2. **Usa Contextos** (Capa 1) para pasar estado sin importar componentes pesados.
3. **Tipado**: Asegúrate de que las interfaces estén en `types.ts` y no definidas dentro de archivos de componentes que deban ser importados en otros lugares.
