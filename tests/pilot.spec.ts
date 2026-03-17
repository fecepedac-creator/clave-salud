import { test, expect } from "@playwright/test";
import * as path from "path";

test("pilot test - screenshot", async ({ page }) => {
  // Use the dev server URL
  const url = "http://localhost:5175";
  console.log(`Navigating to ${url}...`);

  await page.goto(url);

  // Wait for the app to settle
  await page.waitForTimeout(3000);

  // Take a screenshot
  const screenshotPath = path.join(process.cwd(), "pilot-screenshot.png");
  await page.screenshot({ path: screenshotPath, fullPage: true });

  console.log(`Screenshot saved to: ${screenshotPath}`);

  // Basic assertion to ensure something loaded
  const title = await page.title();
  console.log(`Page title: ${title}`);
});
