import type { RequestEvent } from '@sveltejs/kit';
import type { ReleaseUpdateRequest } from '@unisource/sdk';
import { createAdminUnisourceClient } from '$lib/server/unisource';
import { mapRelease, type ParsedRelease } from '$lib/types/releases';

type RuntimeEvent = Pick<RequestEvent, 'platform'> | undefined;

function client(event?: RuntimeEvent) {
	return createAdminUnisourceClient(event);
}

export async function listReleases(event?: RuntimeEvent): Promise<ParsedRelease[]> {
	const result = await client(event).releases.list({ limit: 100 });
	return result.items.map(mapRelease);
}

export async function getRelease(releaseId: string, event?: RuntimeEvent): Promise<ParsedRelease> {
	const dto = await client(event).releases.get(releaseId);
	return mapRelease(dto);
}

export async function getReleaseByName(
	name: string,
	event?: RuntimeEvent
): Promise<ParsedRelease | null> {
	const result = await client(event).releases.list();
	const found = result.items.find((r) => r.name === name && r.upload_status === 'completed');
	return found ? mapRelease(found) : null;
}

export async function updateRelease(
	releaseId: string,
	data: ReleaseUpdateRequest,
	event?: RuntimeEvent
): Promise<ParsedRelease> {
	const dto = await client(event).releases.update(releaseId, data);
	return mapRelease(dto);
}

export async function deleteRelease(releaseId: string, event?: RuntimeEvent): Promise<void> {
	await client(event).releases.delete(releaseId);
}
