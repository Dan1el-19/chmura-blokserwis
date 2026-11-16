import { defineConfig, devices } from 'playwright/test';

export default defineConfig({
	testDir: './e2e',
	testMatch: 'quotes-integrated.spec.ts',
	use: { baseURL: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3100', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
	projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }, { name: 'chromium-mobile', use: { ...devices['Pixel 7'] } }],
	webServer: process.env.E2E_EXTERNAL_APP === '1' ? undefined : {
		command: 'pnpm exec vite dev --host 127.0.0.1 --port 3100 --strictPort',
		url: 'http://127.0.0.1:3100',
		reuseExistingServer: !process.env.CI,
		env: {
			PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.PUBLIC_CLERK_PUBLISHABLE_KEY ?? 'pk_test_b3JnYW5pYy1nb3NoYXdrLTg2LmNsZXJrLmFjY291bnRzLmRldiQ',
			PUBLIC_CLOUD_API_URL: process.env.PUBLIC_CLOUD_API_URL ?? 'http://localhost:8787'
		}
	}
});
