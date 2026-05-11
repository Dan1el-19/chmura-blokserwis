import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

import { getPublicFileInfo, unlockPublicFile } from '$lib/server/unisource';
import { publicShareErrorState } from '$lib/server/unisource-errors';
import { mapPublicFileFromUnisource } from '$lib/server/unisource-mappers';

export const load: PageServerLoad = async (event) => {
	try {
		const response = await getPublicFileInfo(event, event.params.slug);
		return mapPublicFileFromUnisource(response);
	} catch (e) {
		const state = publicShareErrorState(e);
		if (state) return state;
		error(404, 'Link nie istnieje.');
	}
};

export const actions: Actions = {
	unlock: async (event) => {
		const formData = await event.request.formData();
		const password = formData.get('password') as string;

		if (!password) {
			return fail(400, { error: 'Hasło jest wymagane' });
		}

		try {
			const response = await unlockPublicFile(event, event.params.slug, password);
			const data = mapPublicFileFromUnisource(response);
			if (data.requiresPassword) {
				return fail(401, { error: 'Nieprawidłowe hasło' });
			}

			return {
				success: true,
				downloadUrl: data.downloadUrl,
				remainingDownloads: data.remainingDownloads
			};
		} catch (e) {
			const state = publicShareErrorState(e);
			if (state?.limitReached) return fail(403, { error: 'Limit pobrań został wyczerpany' });
			if (state?.expired) return fail(410, { error: 'Link wygasł' });
			return fail(401, { error: 'Nieprawidłowe hasło' });
		}
	}
};
