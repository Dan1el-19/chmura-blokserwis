import { expect, test } from '@playwright/test';

test.describe('Smoke tests', () => {
	test('home page loads and redirects to login', async ({ page }) => {
		const response = await page.goto('/');
		// The app should load (it redirects to login for unauthenticated users)
		expect(response?.status()).toBeLessThan(500);
		// Should end up on the login page
		await expect(page).toHaveURL(/\/login/);
	});

	test('login page renders correctly', async ({ page }) => {
		await page.goto('/login');
		// Login page should have a form
		const emailInput = page.locator('input[type="email"]');
		await expect(emailInput).toBeVisible();
	});

	test('health check — no 500 errors on main pages', async ({ page }) => {
		const pages = ['/login'];
		for (const path of pages) {
			const response = await page.goto(path);
			expect(response?.status()).toBeLessThan(500);
		}
	});
});
