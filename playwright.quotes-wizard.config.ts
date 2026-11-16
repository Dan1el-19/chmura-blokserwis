import { defineConfig, devices } from 'playwright/test';
import layout from './playwright.quotes-layout.config';

export default defineConfig({
	...layout,
	testMatch: ['wizard-agent.spec.ts', 'quotes-v2-layout.spec.ts'],
	outputDir: 'test-results/quotes-wizard',
	workers: 2,
	projects: [
		{ name: 'chromium', use: { ...devices['Pixel 7'], browserName: 'chromium' } },
		{ name: 'webkit', use: { ...devices['iPhone 13'], browserName: 'webkit' } }
	]
});
