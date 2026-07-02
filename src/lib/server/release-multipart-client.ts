import type { createAdminUnisourceClient } from '$lib/server/unisource';
import { unwrapItem } from '$lib/server/unisource-v2-contract';
import type {
	V2ReleaseLifecycleResponse,
	V2ReleaseMultipartCreateResponse,
	V2ReleaseMultipartSignPartResponse
} from '@unisource/sdk/v2';

type AdminUnisourceClient = ReturnType<typeof createAdminUnisourceClient>;

export function releaseMultipart(client: AdminUnisourceClient) {
	return {
		create: async (
			body: Parameters<AdminUnisourceClient['releases']['multipartCreate']>[0],
			signal?: AbortSignal
		) =>
			unwrapItem<V2ReleaseMultipartCreateResponse['item']>(
				await client.releases.multipartCreate(body, signal)
			),
		signPart: async (uploadId: string, partNumber: number, signal?: AbortSignal) =>
			unwrapItem<V2ReleaseMultipartSignPartResponse['item']>(
				await client.releases.multipartSignPart(uploadId, partNumber, signal)
			),
		listParts: async (uploadId: string, signal?: AbortSignal) => ({
			parts: (await client.releases.multipartListParts(uploadId, signal)).items
		}),
		complete: async (
			body: { upload_id: string; parts: Array<{ PartNumber: number; ETag: string }> },
			signal?: AbortSignal
		) =>
			unwrapItem<V2ReleaseLifecycleResponse['item']>(
				await client.releases.multipartComplete(body.upload_id, body.parts, signal)
			),
		abort: async (uploadId: string, signal?: AbortSignal) =>
			unwrapItem<V2ReleaseLifecycleResponse['item']>(
				await client.releases.multipartAbort(uploadId, signal)
			)
	};
}
