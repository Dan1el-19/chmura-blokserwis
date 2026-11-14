import { expect, test } from 'playwright/test';

test('pokazuje sam formularz Clerk bez dodatkowej karty logowania', async ({ page }) => {
	await page.setViewportSize({ width: 320, height: 800 });
	await page.goto('/');
	await expect(page.locator('.cl-card')).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Zaloguj się', exact: true })).toHaveCount(0);
	await expect(page.getByText('Dostęp do chmury jest dostępny dla zaproszonych użytkowników.')).toHaveCount(0);
	await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});
