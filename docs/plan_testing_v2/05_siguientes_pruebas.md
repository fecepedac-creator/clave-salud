# Próximas 10 Pruebas Recomendadas: ClaveSalud V2

Tras estabilizar la base técnica del **Modo Demo**, estas son las primeras pruebas recomendadas para validar el producto sin fricción de autenticación.

## Capa 1: Pruebas Demo (UI)
1. **D-01: Navegación de Dashboards**: Validar que Admin, Doctor y SuperAdmin carguen al cambiar `demo_role`.
2. **D-02: Agenda Visual**: Entrar al Admin Dashboard (`agenda` tab) y verificar que se rendericen los slots mock.
3. **D-03: Ficha de Paciente Mock**: Abrir el detalle de "Juan Pérez" en el Doctor Dashboard y validar que se visualicen sus antecedentes (HTA, DM2).
4. **D-04: Responsividad del SuperAdmin**: Validar que el Drawer lateral se abra y cierre correctamente en viewport móvil.
5. **D-05: Formulario de Paciente**: Llenar datos en `PatientForm` dentro del Admin Dashboard y validar que no haya errores de validación de RUT.
6. **D-06: Tab de Rendimiento**: Verificar que los gráficos (KPIs) se pinten aunque tengan valores mock de `INITIAL_CENTERS`.

## Capa 2: Pruebas E2E (Real - Tras estabilizar Auth)
7. **E-01: Login Real Admin**: Confirmar que al loguearse con `admin.test@clavesalud.cl`, Firebase entregue la cookie de sesión correcta.
8. **E-02: Multi-tenant Firestore**: Loguearse como Admin y tratar de acceder al ID de un centro no autorizado. Validar el mensaje "Centro No Encontrado".
9. **E-03: Reserva de Hora Real**: Realizar una reserva en el `BookingPortal` y verificar que el documento se cree efectivamente en la colección `/appointments`.
10. **E-04: Registro de Evolución Real (PSCV)**: Finalizar una consulta y confirmar que los datos se persisten en la subcolección `consultations` del paciente.

## Conclusión
Se recomienda completar primero las 6 pruebas de **Capa 1 (Demo)** para asegurar que la UI es robusta antes de seguir depurando la complejidad del login de Firebase (Capa 2).
