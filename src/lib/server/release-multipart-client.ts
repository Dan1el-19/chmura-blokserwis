import type {
	MultipartAbortResponse,
	MultipartCompleteRequest,
	MultipartCompleteResponse,
	MultipartCreateResponse,
	MultipartListPartsResponse,
	MultipartSignPartResponse
} from '@unisource/sdk';
import type { createAdminUnisourceClient } from '$lib/server/unisource';

type AdminUnisourceClient = ReturnType<typeof createAdminUnisourceClient>;

type ReleaseMultipartCreateRequest = {
	name: string;
	filename: string;
	mime_type: string;
	tags?: string[];
	notes?: string | null;
	force_update?: boolean;
};

type ReleaseMultipartApi = {
	create: (
		body: ReleaseMultipartCreateRequest,
		signal?: AbortSignal
	) => Promise<MultipartCreateResponse>;
	signPart: (
		uploadId: string,
		partNumber: number,
		signal?: AbortSignal
	) => Promise<MultipartSignPartResponse>;
	listParts: (uploadId: string, signal?: AbortSignal) => Promise<MultipartListPartsResponse>;
	complete: (
		body: MultipartCompleteRequest,
		signal?: AbortSignal
	) => Promise<MultipartCompleteResponse>;
	abort: (uploadId: string, signal?: AbortSignal) => Promise<MultipartAbortResponse>;
};

type ReleaseMultipartClient = AdminUnisourceClient & {
	releases: AdminUnisourceClient['releases'] & {
		upload: AdminUnisourceClient['releases']['upload'] & {
			multipart: ReleaseMultipartApi;
		};
	};
};

export function releaseMultipart(client: AdminUnisourceClient): ReleaseMultipartApi {
	return (client as ReleaseMultipartClient).releases.upload.multipart;
}
