import { test, expect } from "@playwright/test";

const COMPANY_NAME = `Refined-Test-${Date.now()}`;
const TASK_TITLE = "Define first 3 strategic milestones";

test.describe("Refined Onboarding wizard", () => {
  test("completes streamlined flow with new defaults", async ({ page }) => {
    await page.goto("/");

    // Step 1
    const companyNameInput = page.locator('input[placeholder="Acme Corp"]');
    await expect(companyNameInput).toBeVisible({ timeout: 15_000 });
    await companyNameInput.fill(COMPANY_NAME);
    await page.getByRole("button", { name: "Next" }).click();

    // Step 2 - Should be simpler now
    await expect(
      page.locator("h2", { hasText: "Create your first agent" })
    ).toBeVisible({ timeout: 10_000 });
    
    // Check for "CEO" default
    const agentNameInput = page.locator('input[placeholder="CEO"]');
    await expect(agentNameInput).toHaveValue("CEO");

    // Verify "CEO Builder" is pre-selected or the default behavior
    // (We'll implement the UI for this)
    
    await page.getByRole("button", { name: "Next" }).click();

    // Step 3 - Should have new default task
    await expect(
      page.locator("h2", { hasText: "Give it something to do" })
    ).toBeVisible({ timeout: 10_000 });

    const taskTitleInput = page.locator('input[id="onboarding-task-title"]');
    // Assert new default title
    await expect(taskTitleInput).toHaveValue("Define first 3 strategic milestones");

    await page.getByRole("button", { name: "Next" }).click();

    // Step 4
    await expect(
      page.locator("h2", { hasText: "Ready to launch" })
    ).toBeVisible({ timeout: 10_000 });

    await page.getByRole("button", { name: "Create & Open Issue" }).click();

    await expect(page).toHaveURL(/\/issues\//, { timeout: 10_000 });
  });
});
