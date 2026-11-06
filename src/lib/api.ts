import { createClient } from '@connectrpc/connect';
import { createConnectTransport } from '@connectrpc/connect-web';
import { PUBLIC_CLOUD_API_URL, PUBLIC_QUOTES_API_URL } from '$app/env/public';
import {
	createSessionInterceptor,
	type SessionTokenProvider
} from './session-interceptor.js';
import { CatalogService, ShareService, TrashService } from './gen/unisourcecfl/catalog/v1/catalog_pb.js';
import { IdentityService } from './gen/unisourcecfl/identity/v1/identity_pb.js';
import { UploadService } from './gen/unisourcecfl/upload/v1/upload_pb.js';
import { MultipartService } from './gen/unisourcecfl/upload/v1/multipart_pb.js';
import { StorageSettingsService } from './gen/unisourcecfl/storage/v1/storage_pb.js';

import { QuoteService } from './gen/unisource/v2/quotes_pb.js';

let getSessionToken: SessionTokenProvider = async () => null;

export function setSessionTokenProvider(provider: SessionTokenProvider): void {
	getSessionToken = provider;
}

const transport = createConnectTransport({
	baseUrl: PUBLIC_CLOUD_API_URL || 'http://localhost:8787',
	interceptors: [createSessionInterceptor((options) => getSessionToken(options))]
});

export const identity = createClient(IdentityService, transport);
export const catalog = createClient(CatalogService, transport);
export const shareLinks = createClient(ShareService, transport);
export const trash = createClient(TrashService, transport);
export const uploads = createClient(UploadService, transport);
export const multipartUploads = createClient(MultipartService, transport);
export const storageSettings = createClient(StorageSettingsService, transport);

export function getQuoteClient() {
	if (!PUBLIC_QUOTES_API_URL) throw new Error('Moduł wycen jest niedostępny.');
	return createClient(QuoteService, createConnectTransport({
		baseUrl: PUBLIC_QUOTES_API_URL,
		useBinaryFormat: true,
		interceptors: [createSessionInterceptor((options) => getSessionToken(options))]
	}));
}
