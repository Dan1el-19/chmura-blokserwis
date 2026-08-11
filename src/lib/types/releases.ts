import type { V2Release } from '@unisource/sdk/v2';

// Mapped release — uses Appwrite-style $id/$createdAt for component compatibility
export interface ParsedRelease {
	$id: string;
	$createdAt: string;
	name: string;
	size: number;
	r2_key: string;
	r2Key: string;
	tags: string[];
	notes: string | null;
	force_update: boolean;
	uploaded_by: string;
	upload_status: V2Release['upload_status'];
}

export interface ReleaseUploadDefaults {
	versionCode: number;
	minSupportedVersionCode: number;
	rollout: number;
	certificateSha256: string;
	suggestedVersion: string | null;
	sourceReleaseName: string | null;
}

export function mapRelease(dto: V2Release): ParsedRelease {
	return {
		$id: dto.id,
		$createdAt: dto.created_at,
		name: dto.name,
		size: dto.size,
		r2_key: dto.r2_key,
		r2Key: dto.r2_key,
		tags: dto.tags,
		notes: dto.notes,
		force_update: dto.force_update,
		uploaded_by: dto.uploaded_by,
		upload_status: dto.upload_status
	};
}
