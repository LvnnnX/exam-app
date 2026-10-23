import { test, expect } from '@playwright/test';

const securityHeaders = [
  'x-content-type-options',
  'referrer-policy',
  'x-frame-options',
  'permissions-policy',
  'content-security-policy',
];

test('homepage loads', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toBeVisible();
  await expect(page.getByRole('button', { name: /begin session/i })).toBeVisible();
});

test('admin page loads', async ({ page }) => {
  await page.goto('/admin');
  await expect(page.locator('h1')).toBeVisible();
});

test('security headers are set', async ({ request }) => {
  const response = await request.get('/');

  for (const header of securityHeaders) {
    await expect(response.headers()[header]).toBeTruthy();
  }

  await expect(response.headers()['x-frame-options']).toBe('DENY');
  await expect(response.headers()['x-content-type-options']).toBe('nosniff');
});