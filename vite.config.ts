import devtoolsJson from 'vite-plugin-devtools-json';
import tailwindcss from '@tailwindcss/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit(),
		SvelteKitPWA({
			srcDir: 'src',
			filename: 'sw.ts',
			strategies: 'injectManifest',
			registerType: 'autoUpdate',
			injectRegister: 'script-defer',
			includeAssets: [
				'favicon.svg',
				'favicon.png',
				'pwa-192.png',
				'pwa-512.png',
				'pwa-maskable-512.png',
				'apple-touch-icon.png'
			],
			manifest: {
				id: '/',
				name: 'Chmura Blokserwis',
				short_name: 'Blokserwis',
				description: 'Bezpieczna chmura plikow Blokserwis',
				lang: 'pl',
				start_url: '/',
				scope: '/',
				display: 'standalone',
				background_color: '#f9fafb',
				theme_color: '#2d57b3',
				icons: [
					{
						src: '/favicon.svg',
						sizes: 'any',
						type: 'image/svg+xml',
						purpose: 'any'
					},
					{
						src: '/pwa-192.png',
						sizes: '192x192',
						type: 'image/png',
						purpose: 'any'
					},
					{
						src: '/pwa-512.png',
						sizes: '512x512',
						type: 'image/png',
						purpose: 'any'
					},
					{
						src: '/pwa-maskable-512.png',
						sizes: '512x512',
						type: 'image/png',
						purpose: 'maskable'
					}
				],
				shortcuts: [
					{
						name: 'Pliki',
						short_name: 'Pliki',
						url: '/',
						icons: [{ src: '/pwa-192.png', sizes: '192x192', type: 'image/png' }]
					},
					{
						name: 'Kosz',
						short_name: 'Kosz',
						url: '/trash',
						icons: [{ src: '/pwa-192.png', sizes: '192x192', type: 'image/png' }]
					}
				],
				categories: ['productivity', 'utilities']
			},
			injectManifest: {
				globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
				maximumFileSizeToCacheInBytes: 10 * 1024 * 1024
			},
			devOptions: {
				enabled: true,
				type: 'module'
			}
		}),
		devtoolsJson()
	],

	test: {
		expect: { requireAssertions: true },

		projects: [
			{
				extends: true,
				resolve: {
					conditions: ['browser']
				},

				test: {
					name: 'client',
					environment: 'jsdom',
					include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
					exclude: ['src/lib/server/**']
				}
			},

			{
				extends: true,

				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	}
});
