import { defineConfig, devices } from 'playwright/test';

export default defineConfig({
	testDir: './e2e',
	testMatch: 'quotes-layout.spec.ts',
	use: { baseURL: 'http://127.0.0.1:3100', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
	projects: [{ name: 'mobile', use: { ...devices['Pixel 7'], defaultBrowserType: 'chromium' } }],
	webServer: {
		command: 'pnpm exec vite dev --host 127.0.0.1 --port 3100 --strictPort',
		url: 'http://127.0.0.1:3100',
		reuseExistingServer: false,
		env: {
			PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_b3JnYW5pYy1nb3NoYXdrLTg2LmNsZXJrLmFjY291bnRzLmRldiQ',
			PUBLIC_CLOUD_API_URL: 'http://localhost:8787',
			PUBLIC_QUOTES_API_URL: 'http://localhost:8788'
		}
	}
});
