import { expect, test } from 'playwright/test';

test('formularz logowania mieści się na telefonie i przejmuje ciemny motyw', async ({ page }) => {
	await page.setViewportSize({ width: 320, height: 800 });
	await page.emulateMedia({ colorScheme: 'dark' });
	await page.goto('/');
	const card = page.locator('.cl-card');
	await expect(card).toBeVisible();
	const dimensions = await card.evaluate((element) => ({
		right: element.getBoundingClientRect().right,
		background: getComputedStyle(element).backgroundColor
	}));
	expect(dimensions.right).toBeLessThanOrEqual(320);
	expect(dimensions.background).not.toBe('rgb(255, 255, 255)');
	const googleButton = page.getByRole('button', { name: /google/i });
	await expect(googleButton).toBeVisible();
	expect(await googleButton.locator('.cl-socialButtonsBlockButtonText').evaluate((element) => getComputedStyle(element).color)).not.toBe('rgb(0, 0, 0)');
	await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});
