/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { clientsClaim } from 'workbox-core';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { ExpirationPlugin } from 'workbox-expiration';

type RouteMatchContext = {
	request: Request;
};

declare let self: ServiceWorkerGlobalScope & {
	__WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};

self.skipWaiting();
clientsClaim();
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

registerRoute(
	new NavigationRoute(
		new NetworkFirst({
			cacheName: 'pages',
			networkTimeoutSeconds: 3,
			plugins: [new CacheableResponsePlugin({ statuses: [200] })]
		}),
		{
			denylist: [/^\/api\//]
		}
	)
);

registerRoute(
	({ request }: RouteMatchContext) =>
		request.destination === 'script' ||
		request.destination === 'style' ||
		request.destination === 'worker',
	new StaleWhileRevalidate({
		cacheName: 'static-resources',
		plugins: [
			new CacheableResponsePlugin({ statuses: [0, 200] }),
			new ExpirationPlugin({ maxEntries: 80, maxAgeSeconds: 30 * 24 * 60 * 60 })
		]
	})
);

registerRoute(
	({ request }: RouteMatchContext) =>
		request.destination === 'image' || request.destination === 'font',
	new CacheFirst({
		cacheName: 'asset-resources',
		plugins: [
			new CacheableResponsePlugin({ statuses: [0, 200] }),
			new ExpirationPlugin({ maxEntries: 120, maxAgeSeconds: 60 * 24 * 60 * 60 })
		]
	})
);

/**
 * Uppy Golden Retriever expects the active controller to handle these messages.
 * Keep this in the PWA worker so uploads can resume without a second competing
 * service worker under the same scope.
 */
const fileCache: Record<string, Record<string, unknown>> = Object.create(null);

function getCache(name: string) {
	fileCache[name] ??= Object.create(null);
	return fileCache[name];
}

function sendMessageToAllClients(msg: unknown) {
	self.clients.matchAll().then((clientList) => {
		clientList.forEach((client) => {
			client.postMessage(msg);
		});
	});
}

self.addEventListener('message', (event) => {
	const data = event.data;

	switch (data?.type) {
		case 'uppy/ADD_FILE':
			getCache(data.store)[data.file.id] = data.file.data;
			break;
		case 'uppy/REMOVE_FILE':
			delete getCache(data.store)[data.fileID];
			break;
		case 'uppy/GET_FILES':
			sendMessageToAllClients({
				type: 'uppy/ALL_FILES',
				store: data.store,
				files: getCache(data.store)
			});
			break;
		default:
			break;
	}
});
