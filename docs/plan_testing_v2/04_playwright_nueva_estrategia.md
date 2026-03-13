# Playwright: Nueva Estrategia V2

La suite Playwright se ha dividido en dos proyectos independientes: **Demo Suite** y **E2E Suite**.

## 1. Demo Suite (Capa 1)
- **Ruta**: `tests/demo/*.spec.ts`
- **Autenticación**: Ninguna necesaria. Usa `?demo=true` en cada `page.goto()`.
- **Rapidez**: 100% (No hay ruidos de red ni de Auth).
- **Ejecución**: `npx playwright test --project=demo-tests`

**Test Smoke Ejemplo:**
```typescript
test("Admin Dashboard (Demo Mode)", async ({ page }) => {
  await page.goto("/center/c_saludmass?demo=true&demo_role=admin");
  await expect(page.locator('[data-testid="admin-tab-bar"]')).toBeVisible();
});
```

## 2. E2E Suite (Capa 2)
- **Ruta**: `tests/admin/*.spec.ts`, `tests/doctor/*.spec.ts`
- **Autenticación**: Real. Requiere `auth.setup.ts` operativo o `login` previo.
- **Rapidez**: Moderada (Depende de Firebase).
- **Ejecución**: `npx playwright test --project=admin-tests`

## ¿Cuándo usar cada una?
- **Desarrollo de UI**: Usar **Demo Suite** para iterar rápido.
- **Auditoría de Mercado / QA Final**: Usar **E2E Suite** para validar que todo conecte con Firebase real.
