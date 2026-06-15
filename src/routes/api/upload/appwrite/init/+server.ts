import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createUserUnisourceClient } from '$lib/server/unisource';
import { createSessionClient } from '$lib/server/appwrite';
import { unisourceErrorResponse } from '$lib/server/unisource-errors';
import { unwrapItem } from '$lib/server/unisource-v2-contract';
import type { V2UploadAppwriteInitResponse } from '@unisource/sdk/v2';

export const POST: RequestHandler = async (event) => {
	if (!event.locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

	try {
		const body = await event.request.json();
		const client = await createUserUnisourceClient(event);

		// Generujemy JWT server-side (mamy dostęp do cookie __session).
		// Frontend użyje go do autoryzacji uploadu przez Appwrite browser SDK.
		const { account } = createSessionClient(event);
		const { jwt } = await account.createJWT();

		if (body.is_main_storage) {
			const init = unwrapItem<V2UploadAppwriteInitResponse['item']>(
				await client.upload.appwriteInit({
					filename: body.filename,
					size: body.size,
					mime_type: body.mime_type,
					is_main_storage: true,
					...(body.folder_id ? { folder_id: body.folder_id } : {})
				})
			);
			return json({ ...init, jwt });
		}

		const init = unwrapItem<V2UploadAppwriteInitResponse['item']>(
			await client.upload.appwriteInit({
				filename: body.filename,
				size: body.size,
				mime_type: body.mime_type,
				is_main_storage: false,
				...(body.folder_id ? { folder_id: body.folder_id } : {})
			})
		);
		return json({ ...init, jwt });
	} catch (error) {
		return unisourceErrorResponse(error, 'Failed to initialize Appwrite upload');
	}
};
