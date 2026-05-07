export type PublicUserRole = 'basic' | 'plus' | 'admin';

export interface PublicUser {
	id: string | null;
	$id: string | null;
	email: string | null;
	name: string | null;
	avatar: string | null;
	role: PublicUserRole | null;
	createdAt: string | null;
	updatedAt: string | null;
}

type SerializableUserSource = {
	id?: unknown;
	$id?: unknown;
	email?: unknown;
	name?: unknown;
	avatar?: unknown;
	role?: unknown;
	labels?: unknown;
	$createdAt?: unknown;
	createdAt?: unknown;
	$updatedAt?: unknown;
	updatedAt?: unknown;
};

function stringOrNull(value: unknown): string | null {
	return typeof value === 'string' ? value : null;
}

function toPublicRole(user: SerializableUserSource): PublicUserRole | null {
	if (user.role === 'admin' || user.role === 'plus' || user.role === 'basic') {
		return user.role;
	}

	if (Array.isArray(user.labels)) {
		if (user.labels.includes('admin')) return 'admin';
		if (user.labels.includes('plus')) return 'plus';
		return 'basic';
	}

	return null;
}

export function toPublicUser(user: SerializableUserSource | null | undefined): PublicUser | null {
	if (!user) return null;

	const id = stringOrNull(user.$id) ?? stringOrNull(user.id);

	return {
		id,
		$id: id,
		email: stringOrNull(user.email),
		name: stringOrNull(user.name),
		avatar: stringOrNull(user.avatar),
		role: toPublicRole(user),
		createdAt: stringOrNull(user.$createdAt) ?? stringOrNull(user.createdAt),
		updatedAt: stringOrNull(user.$updatedAt) ?? stringOrNull(user.updatedAt)
	};
}
