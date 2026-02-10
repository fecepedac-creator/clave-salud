# Fase 0 — Auditoría rápida (mapa de layout, navegación y roles)

Este documento resume los puntos clave del layout y la navegación actual para ubicar rápidamente
los puntos de inserción de nuevas páginas, enlaces en header/footer y secciones SuperAdmin.

## Entrada principal y enrutamiento interno
- La navegación de vistas se controla en `App.tsx` mediante el estado `view`, con múltiples ramas
  como `home`, `select-center`, `doctor-dashboard`, `admin-dashboard` y `superadmin-dashboard`.
- El `renderByView()` resuelve qué dashboard cargar y controla la sesión de usuario y el centro
  activo. Esto es el punto central para agregar nuevas vistas públicas o rutas internas.

## Layout y navegación por rol
### Admin Dashboard
- El header principal del administrador se renderiza en `AdminDashboard` con acciones rápidas
  (compartir app, política de conservación, backup/restore y logout).
- La navegación por secciones dentro del dashboard admin se organiza en tabs (doctors, agenda,
  whatsapp, audit, preadmissions, marketing).

### Doctor/Profesional Dashboard
- La vista clínica principal vive en `DoctorDashboard`.
- El layout principal incluye `PatientSidebar` para navegación interna de ficha clínica.

### SuperAdmin Dashboard
- El SuperAdmin posee un `aside` fijo con opciones (Visión General, Centros, Finanzas,
  Comunicación) y un bloque de acciones (modo demo y logout).
- Este sidebar es el principal punto para agregar nuevas métricas o enlaces administrativos.

## Componentes reutilizables de navegación
- `Sidebar` es un componente genérico para sidebars con items, activación por módulos y footer
  custom, útil para agregar nuevos enlaces o secciones de ayuda.

## Roles y control de acceso
- La verificación de SuperAdmin se centraliza en `useAuth` mediante claims y una whitelist de
  correos permitidos.
- `App.tsx` depende de `isSuperAdminClaim` para habilitar vistas y dashboards.

## Próximos puntos de inserción sugeridos
- **Footer global**: actualmente no existe un footer global de app; se podría añadir en `App.tsx`
  o como parte de un layout envolvente.
- **Links legales**: podrían añadirse en el header del Admin Dashboard y el sidebar del SuperAdmin
  y/o una ruta pública en `App.tsx`.
- **Landing pública**: la vista `home` en `App.tsx` es el mejor lugar para crear una landing
  separada de la app autenticada.
