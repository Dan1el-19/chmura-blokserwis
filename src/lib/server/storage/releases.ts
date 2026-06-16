import type { RequestEvent } from '@sveltejs/kit';
import type { V2ReleaseUpdateRequest } from '@unisource/sdk/v2';
import {
	createAdminUnisourceClient,
	createRequestAdminUnisourceClient
} from '$lib/server/unisource';
import { unwrapItem } from '$lib/server/unisource-v2-contract';
import { mapRelease, type ParsedRelease } from '$lib/types/releases';

type RuntimeEvent = RequestEvent | Pick<RequestEvent, 'platform'> | undefined;

function hasUser(event: RuntimeEvent): event is RequestEvent {
	return Boolean(event && 'locals' in event && event.locals.user);
}

async function client(event?: RuntimeEvent) {
	if (hasUser(event)) {
		return createRequestAdminUnisourceClient(event);
	}
	return createAdminUnisourceClient(event);
}

export async function listReleases(event?: RuntimeEvent): Promise<ParsedRelease[]> {
	const result = await (await client(event)).releases.list({ limit: 100 });
	return result.items.map(mapRelease);
}

export async function getRelease(releaseId: string, event?: RuntimeEvent): Promise<ParsedRelease> {
	const dto = await (await client(event)).releases.get(releaseId);
	return mapRelease(unwrapItem(dto));
}

export async function getReleaseByName(
	name: string,
	event?: RuntimeEvent
): Promise<ParsedRelease | null> {
	const result = await (await client(event)).releases.list();
	const found = result.items.find((r) => r.name === name && r.upload_status === 'completed');
	return found ? mapRelease(found) : null;
}

export async function updateRelease(
	releaseId: string,
	data: V2ReleaseUpdateRequest,
	event?: RuntimeEvent
): Promise<ParsedRelease> {
	const dto = await (await client(event)).releases.update(releaseId, data);
	return mapRelease(unwrapItem(dto));
}

export async function deleteRelease(releaseId: string, event?: RuntimeEvent): Promise<void> {
	await (await client(event)).releases.delete(releaseId);
}

/** Returns the most recent completed release tagged with the given channel (stable|beta). */
export async function getLatestByChannel(
	channel: string,
	event?: RuntimeEvent
): Promise<ParsedRelease | null> {
	const result = await (await client(event)).releases.list({ limit: 100 });
	const match = result.items
		.filter((r) => r.upload_status === 'completed' && r.tags.includes(channel))
		.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
	return match.length > 0 ? mapRelease(match[0]) : null;
}

/**
 * Strips `latest` from all releases in the given channel, then adds `latest` to `newLatestId`.
 * Call this after a new upload completes or after deleting the current latest.
 */
export async function promoteLatest(
	channel: string,
	newLatestId: string | null,
	event?: RuntimeEvent
): Promise<void> {
	const c = await client(event);
	const result = await c.releases.list({ limit: 100 });

	// Strip `latest` from all completed releases in this channel that currently have it
	const toStrip = result.items.filter(
		(r) =>
			r.upload_status === 'completed' &&
			r.tags.includes(channel) &&
			r.tags.includes('latest') &&
			r.id !== newLatestId
	);
	await Promise.all(
		toStrip.map((r) =>
			c.releases.update(r.id, { tags: r.tags.filter((t: string) => t !== 'latest') })
		)
	);

	// Add `latest` to the new release
	if (newLatestId) {
		const target = result.items.find((r) => r.id === newLatestId);
		if (target && !target.tags.includes('latest')) {
			await c.releases.update(newLatestId, { tags: [...target.tags, 'latest'] });
		}
	}
}
