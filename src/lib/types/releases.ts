import type { AppwriteDocument } from './storage';

export interface ReleaseDocument extends AppwriteDocument {
	name: string;
	size: number;
	r2Key: string;
	tags: string | null;
	uploadedBy: string;
	notes: string | null;
}

export interface ReleaseMetadata {
	name: string;
	size: number;
	r2Key: string;
	tags?: string[];
	uploadedBy: string;
	notes?: string;
}

export interface ParsedRelease extends Omit<ReleaseDocument, 'tags'> {
	tags: string[];
}

export interface ReleaseDownloadResult {
	release: ParsedRelease;
	url: string;
}
