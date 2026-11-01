import { Code, ConnectError, type Interceptor } from '@connectrpc/connect';

export type SessionTokenOptions = { skipCache?: boolean } | undefined;
export type SessionTokenProvider = (options?: SessionTokenOptions) => Promise<string | null>;

export function createSessionInterceptor(getSessionToken: SessionTokenProvider): Interceptor {
	return (next) => async (request) => {
		const token = await getSessionToken();
		if (!token) {
			throw new ConnectError('Brak aktywnej sesji Clerk.', Code.Unauthenticated);
		}

		request.header.set('Authorization', `Bearer ${token}`);
		try {
			return await next(request);
		} catch (error) {
			if (!(error instanceof ConnectError) || error.code !== Code.Unauthenticated) throw error;

			const refreshedToken = await getSessionToken({ skipCache: true });
			if (!refreshedToken || refreshedToken === token) throw error;

			request.header.set('Authorization', `Bearer ${refreshedToken}`);
			return next(request);
		}
	};
}
