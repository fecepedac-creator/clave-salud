import { test, expect } from "@playwright/test";

test.describe("Fase 1: Concurrencia de Agendamiento", () => {
  test("Simular reserva simultánea - Solo una debe tener éxito", async ({ browser }) => {
    test.setTimeout(120000); // Dar 2 minutos para producción
    // Configuración del centro real (Los Andes)
    const centerId = "c_eji2qv61";
    const url = `https://clavesalud-2.web.app/center/${centerId}/agendar`;

    // Creamos dos contextos independientes para simular dos pacientes reales
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();

    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    // Función para llevar la página hasta el último paso de confirmación
    const prepararReserva = async (page, name, rut) => {
      // Capturar logs del navegador
      page.on("console", (msg) => console.log(`[BROWSER][${name}] ${msg.text()}`));
      page.on("pageerror", (err) => console.error(`[BROWSER][${name}] ERROR: ${err.message}`));

      console.log(`[${name}] Navegando a la home...`);
      await page.goto("https://clavesalud-2.web.app/", { waitUntil: "domcontentloaded" });

      // Saltar Onboarding si aparece
      console.log(`[${name}] Intentando saltar onboarding...`);
      try {
        const saltarBtn = page.getByText("Saltar tutorial").first();
        await saltarBtn.waitFor({ timeout: 15000 });
        await saltarBtn.click({ force: true });
        console.log(`[${name}] Onboarding saltado.`);
      } catch (e) {
        console.log(`[${name}] Onboarding no detectado o ya saltado.`);
      }

      // Buscar y clickear Los Andes
      console.log(`[${name}] Buscando Centro Medico Los Andes...`);
      const centerCard = page
        .locator("div")
        .filter({ hasText: /^Centro Medico Los Andes/i })
        .first();
      await centerCard.waitFor({ timeout: 30000 });
      await centerCard.click({ force: true });

      // 1. Tipo de atención
      console.log(`[${name}] Esperando portal de agendamiento...`);
      await page.waitForSelector("text=/¿Qué tipo de atención necesitas?/i", { timeout: 40000 });

      const careTypeBtn = page
        .locator("div")
        .filter({ hasText: /^Consulta Médica/ })
        .first();
      await careTypeBtn.click({ force: true });

      // Verificar si avanzó, si no, reintentar click más específico
      try {
        await page.waitForSelector('text="Selecciona Especialidad"', { timeout: 10000 });
      } catch (e) {
        console.log(`[${name}] Transición fallida, reintentando click...`);
        await careTypeBtn.click({ force: true }); // Use the defined careTypeBtn
        await page.waitForSelector('text="Selecciona Especialidad"', { timeout: 15000 });
      }
      await page.waitForTimeout(2000);

      // 2. Especialidad
      console.log(`[${name}] Seleccionando especialidad...`);
      await page.locator("button >> .font-bold.text-xl").first().click({ force: true });
      await page.waitForTimeout(2000);

      // 3. Profesional
      console.log(`[${name}] Seleccionando profesional...`);
      await page.waitForSelector('text="Seleccione Profesional"', { timeout: 20000 });
      // Click en la primera tarjeta de profesional (que tiene font-bold y text-xl)
      await page.locator(".font-bold.text-xl").first().click({ force: true });
      await page.waitForTimeout(3000);

      // 4. Calendario y Slot
      console.log(`[${name}] Seleccionando fecha y hora (Target: 23 Marzo)...`);
      await page.waitForSelector("text=/Marzo/i", { timeout: 30000 });

      // Intentar encontrar el día 23 con clase verde
      const targetDay = page
        .locator(".bg-white.text-emerald-700")
        .filter({ hasText: /^23$/ })
        .first();

      if (!(await targetDay.isVisible())) {
        console.log(
          `[${name}] Día 23 no detectado como disponible directamente, buscando cualquier slot verde...`
        );
        const availableDay = page.locator(".bg-white.text-emerald-700").first();
        await availableDay.waitFor({ state: "visible", timeout: 10000 });
        await availableDay.click({ force: true });
      } else {
        await targetDay.click({ force: true });
      }

      await page.waitForTimeout(2000);

      const slotBtn = page
        .locator("button")
        .filter({ hasText: /^\d{2}:\d{2}$/ })
        .first();
      await slotBtn.waitFor({ state: "visible", timeout: 20000 });
      await slotBtn.click({ force: true });
      await page.waitForTimeout(2000);

      // 5. Formulario de contacto
      console.log(`[${name}] Llenando formulario...`);
      await page.waitForSelector('text="Confirmar Reserva"', { timeout: 15000 });
      await page.fill('input[placeholder="12.345.678-9"]', rut);
      await page.fill('input[placeholder="Juan Pérez"]', name);
      await page.fill('input[placeholder="12345678"]', "98765432");

      return page.locator('button:has-text("Confirmar Reserva")');
    };

    console.log("Iniciando preparación de Paciente A...");
    const btnA = await prepararReserva(pageA, "Paciente A (Simultaneo)", "11.111.111-1");

    console.log("Iniciando preparación de Paciente B...");
    const btnB = await prepararReserva(pageB, "Paciente B (Simultaneo)", "22.222.222-2");

    console.log(">>> Disparando clicks simultáneos! <<<");
    // Disparamos ambos clicks al mismo tiempo lo más cerca posible en milisegundos
    await Promise.all([btnA.click(), btnB.click()]);

    // Esperamos a que la red y las transacciones de Firestore se completen
    await pageA.waitForTimeout(5000);
    await pageB.waitForTimeout(5000);

    // Verificamos resultados en ambos contextos
    const exitoA = await pageA.locator('text="¡Reserva Exitosa!"').isVisible();
    const exitoB = await pageB.locator('text="¡Reserva Exitosa!"').isVisible();

    const errorA = await pageA.locator('text="Este horario acaba de ser reservado"').isVisible();
    const errorB = await pageB.locator('text="Este horario acaba de ser reservado"').isVisible();

    console.log(`[Paciente A] Éxito: ${exitoA} | Error Detectado: ${errorA}`);
    console.log(`[Paciente B] Éxito: ${exitoB} | Error Detectado: ${errorB}`);

    // VALIDACIÓN CRÍTICA (Fase 1):
    // Exactamente uno DEBE tener éxito.
    // Exactamente uno DEBE fallar con el mensaje de colisión.
    const totalExitos = (exitoA ? 1 : 0) + (exitoB ? 1 : 0);
    const totalErrores = (errorA ? 1 : 0) + (errorB ? 1 : 0);

    if (totalExitos > 1) {
      throw new Error(
        "CRÍTICO: ¡Se ha permitido OVERBOOKING! Ambos pacientes reservaron el mismo slot."
      );
    }

    expect(totalExitos).toBe(1);
    expect(totalErrores).toBe(1);

    console.log("Test de Concurrencia PASADO: La integridad de la reserva está blindada.");

    await contextA.close();
    await contextB.close();
  });
});
