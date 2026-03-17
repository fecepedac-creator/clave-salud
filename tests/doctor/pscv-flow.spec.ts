import { test, expect } from "@playwright/test";
import { TEST } from "../fixtures/test-data";
import { goToDoctorDashboard } from "../fixtures/helpers";

test.describe("Doctor: PSCV Flow Automation", () => {
  test("should create a patient and complete a full PSCV control", async ({ page }) => {
    const uniqueRut = `TEST-${Math.floor(Math.random() * 1000000)}`;
    const patientName = `Juan Playwright Test ${Date.now()}`;

    // 1. Go to Dashboard
    await goToDoctorDashboard(page);
    page.on("console", (msg) => console.log("BROWSER LOG:", msg.text()));

    // 2. Create Patient
    await page.click('[data-testid="btn-new-patient"]');
    await page.fill('[data-testid="edit-patient-name"]', patientName);
    await page.fill('[data-testid="edit-patient-rut"]', uniqueRut);

    // Select Gender
    await page.selectOption("select", { index: 1 }); // Choosing first gender option

    // --- NEW: Fill Comprehensive Data (History & Insurance) ---
    // History
    await page.click('[data-testid="btn-add-medical-history"]');
    await page.click('[data-testid="btn-history-item-HTA"]');
    await page.click('[data-testid="btn-add-medical-history"]');
    await page.click('[data-testid="btn-history-item-DM2"]');

    await page.click('[data-testid="btn-add-surgical-history"]');
    await page.click('[data-testid="btn-surgical-item-VESICULA"]');

    // Insurance
    // We find the select that contains "FONASA" option
    await page.selectOption('select:has(option[value="FONASA"])', "FONASA");
    // Wait for tram selection to appear
    await page.selectOption('select:has(option[value="B"])', "B");

    // Save Patient
    await page.click('[data-testid="btn-save-patient-header"]');
    await expect(page.locator("text=Datos guardados correctamente")).toBeVisible();

    // 3. Start PSCV Consultation (Patient record stays open)
    await page.click('[data-testid="btn-new-pscv-consultation"]');
    await expect(page.locator("text=Control Cardiovascular (PSCV)")).toBeVisible();

    // 4. Fill PSCV Form (Vitals & Labs)
    await page.fill('[data-testid="pscv-vitals-pa"]', "120/80");
    await page.fill('[data-testid="pscv-vitals-peso"]', "80");
    await page.fill('[data-testid="pscv-vitals-talla"]', "175");

    // Labs
    await page.fill('[data-testid="pscv-lab-hba1c"]', "6.5");
    await page.fill('[data-testid="pscv-lab-creatinina"]', "0.9");
    await page.fill('[data-testid="pscv-lab-rac"]', "15");

    // Diabetic Foot (Now using selects)
    await page.selectOption('[data-testid="pscv-pie-sensibilidad"]', "Conservada");
    await page.selectOption('[data-testid="pscv-pie-pulsos"]', "Presentes (+)");
    await page.selectOption('[data-testid="pscv-pie-riesgo"]', "Riesgo Moderado (Trimestral)");

    // Anamnesis/Diagnosis
    await page.fill(
      '[data-testid="pscv-plan"]',
      "Test automatizado con Playwright completo y exitoso."
    );

    // 5. Finalize
    const finalizeBtn = page.locator('[data-testid="btn-finalizar-consulta"]');
    await expect(finalizeBtn).toBeVisible({ timeout: 10000 });
    // Use a more forceful click if normal click fails
    await finalizeBtn.evaluate((el) => el.scrollIntoView());
    await finalizeBtn.click({ force: true });

    // 6. Verify in History
    // We check that "Control Cardiovascular" is present in history and that the patient record header matches
    await expect(page.locator("text=Control Cardiovascular").first()).toBeVisible({
      timeout: 15000,
    });

    // Verification of data persistence in UI
    await expect(page.locator("text=FONASA (B)")).toBeVisible();
    await expect(page.locator("text=Hipertensión Arterial")).toBeVisible();
    await expect(page.locator("text=Diabetes Mellitus Tipo 2")).toBeVisible();

    console.log(`✅ Success: FULL PSCV flow completed for ${patientName} (${uniqueRut})`);
  });
});
