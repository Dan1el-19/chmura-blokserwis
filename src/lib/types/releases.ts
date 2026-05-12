import type { ReleaseDTO } from '@unisource/sdk';

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
	upload_status: ReleaseDTO['upload_status'];
}

export function mapRelease(dto: ReleaseDTO): ParsedRelease {
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
