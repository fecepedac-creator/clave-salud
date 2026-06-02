import { test, expect } from "@playwright/test";

test("debug superadmin dashboard", async ({ page }) => {
  console.log("Navigating to SuperAdmin...");
  await page.goto("http://localhost:5175/superadmin?agent_test=true&demo_role=superadmin");

  console.log("Current URL:", page.url());

  // Wait a bit
  await page.waitForTimeout(5000);

  console.log("URL after 5s:", page.url());

  // Take screenshot
  await page.screenshot({ path: "debug-sa.png", fullPage: true });

  // Check if root exists
  const root = await page.locator('[data-testid="superadmin-dashboard-root"]').count();
  console.log("Root count:", root);

  // Get all text content
  const text = await page.evaluate(() => document.body.innerText);
  console.log("Page text excerpt:", text.substring(0, 500));

  // Check for any obvious errors
  const hasError = text.toLowerCase().includes("error");
  console.log('Has "error" text:', hasError);
});
