import { test, expect } from '@playwright/test';

test('homepage loads', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toBeVisible();
});

test('admin page loads', async ({ page }) => {
  await page.goto('/admin');
  await expect(page.locator('h1')).toBeVisible();
});