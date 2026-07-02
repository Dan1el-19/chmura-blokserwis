import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createUserUnisourceClient } from '$lib/server/unisource';
import { createSessionClient } from '$lib/server/appwrite';
import { unisourceErrorResponse } from '$lib/server/unisource-errors';
import { unwrapItem } from '$lib/server/unisource-v2-contract';
import { uploadInitSchema } from '$lib/schemas';
import type { V2UploadAppwriteInitResponse } from '@unisource/sdk/v2';

export const POST: RequestHandler = async (event) => {
	if (!event.locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

	try {
		const body = await event.request.json();
		const validated = uploadInitSchema.safeParse(body);
		if (!validated.success) {
			return json({ error: 'Validation failed', details: validated.error.issues }, { status: 400 });
		}
		const { filename, size, mime_type, is_main_storage, folder_id } = validated.data;
		const client = await createUserUnisourceClient(event);

		// Generujemy JWT server-side (mamy dostęp do cookie __session).
		// Frontend użyje go do autoryzacji uploadu przez Appwrite browser SDK.
		const { account } = createSessionClient(event);
		const { jwt } = await account.createJWT();

		if (is_main_storage) {
			const init = unwrapItem<V2UploadAppwriteInitResponse['item']>(
				await client.upload.appwriteInit({
					filename,
					size,
					mime_type,
					is_main_storage: true,
					...(folder_id ? { folder_id } : {})
				})
			);
			return json({ ...init, jwt });
		}

		const init = unwrapItem<V2UploadAppwriteInitResponse['item']>(
			await client.upload.appwriteInit({
				filename,
				size,
				mime_type,
				is_main_storage: false,
				...(folder_id ? { folder_id } : {})
			})
		);
		return json({ ...init, jwt });
	} catch (error) {
		return unisourceErrorResponse(error, 'Failed to initialize Appwrite upload');
	}
};
