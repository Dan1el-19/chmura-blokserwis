import { defineConfig, devices, firefox } from 'playwright/test';
import {
	chmodSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync
} from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';

function getFirefoxLaunchOptions() {
	if (process.platform !== 'darwin') return {};
	const macOSMajor = Number(
		execFileSync('/usr/bin/sw_vers', ['-productVersion'], { encoding: 'utf8' }).trim().split('.')[0]
	);
	if (macOSMajor < 27) return {};

	// macOS 27 protects Firefox's shared Application Support folder with TCC. The
	// Playwright build uses the same Firefox identity, so launch an isolated copy.
	const bundledExecutable = firefox.executablePath();
	const bundledApp = dirname(dirname(dirname(bundledExecutable)));
	const temporaryRoot = mkdtempSync(join(tmpdir(), 'playwright-firefox-e2e-'));
	process.once('exit', () => rmSync(temporaryRoot, { recursive: true, force: true }));
	const appCopy = join(temporaryRoot, basename(bundledApp));
	execFileSync('/bin/cp', ['-cR', bundledApp, appCopy]);
	const resources = join(appCopy, 'Contents', 'Resources');
	const source = readFileSync(join(resources, 'application.ini'), 'utf8');
	const isolatedIdentity = source
		.replace(/^Vendor=Mozilla$/m, 'Vendor=Playwright')
		.replace(/^Name=Firefox$/m, 'Name=PlaywrightFirefoxE2E')
		.replace(/^RemotingName=firefox-default$/m, 'RemotingName=playwright-firefox-e2e');
	if (source === isolatedIdentity) {
		throw new Error('Could not create an isolated application identity for Playwright Firefox.');
	}
	const applicationInfoDirectory = join(resources, 'browser');
	mkdirSync(applicationInfoDirectory, { recursive: true });
	const applicationInfo = join(applicationInfoDirectory, 'application.ini');
	writeFileSync(applicationInfo, isolatedIdentity);

	const launcher = join(temporaryRoot, 'firefox-launcher');
	writeFileSync(
		launcher,
		'#!/bin/sh\nexec "$PW_FIREFOX_EXECUTABLE" -app "$PW_FIREFOX_APPLICATION_INFO" "$@"\n'
	);
	chmodSync(launcher, 0o755);

	return {
		launchOptions: {
			executablePath: launcher,
			env: {
				...process.env,
				PW_FIREFOX_EXECUTABLE: join(appCopy, 'Contents', 'MacOS', 'firefox'),
				PW_FIREFOX_APPLICATION_INFO: applicationInfo
			}
		}
	};
}

export default defineConfig({
	testDir: './e2e',
	testIgnore: 'quotes-layout.spec.ts',
	fullyParallel: true,
	use: {
		baseURL: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3100',
		trace: 'retain-on-failure',
		screenshot: 'only-on-failure'
	},
	projects: [
		{ name: 'chromium', use: { ...devices['Desktop Chrome'] } },
		{ name: 'firefox', use: { ...devices['Desktop Firefox'], ...getFirefoxLaunchOptions() } },
		{ name: 'mobile', use: { ...devices['Pixel 7'], defaultBrowserType: 'chromium' } }
	],
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
