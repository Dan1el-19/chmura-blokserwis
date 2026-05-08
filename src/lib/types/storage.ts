export interface AppwriteDocument {
	$id: string;
	$createdAt: string;
	$updatedAt: string;
	$collectionId: string;
	$databaseId: string;
}

export interface FileMetadata {
	name: string;
	size: number;
	mimeType: string;
	r2Key: string;
	bucketId: string;
	ownerId: string;
	parentFolderId?: string | null;
}

export interface FileDocument extends AppwriteDocument {
	name: string;
	size: number;
	mimeType: string;
	r2Key: string | null;
	bucketId: string;
	ownerId: string;
	parentFolderId: string | null;
}

export interface FolderDocument extends AppwriteDocument {
	name: string;
	ownerId: string;
	parentFolderId: string | null;
	path: string;
}

export interface FolderWithSize extends FolderDocument {
	size: number;
}

export interface ListResult<T> {
	total: number;
	rows: T[];
}

export interface FileDownloadResult {
	file: FileDocument;
	url: string;
}

export type ShareType = 'file' | 'folder' | 'zip';

export interface FileShare extends AppwriteDocument {
	fileId: string | null;
	folderId: string | null;
	shareType: ShareType;
	token: string;
	label: string | null;
	expiresAt: string | null;
	autoDelete: boolean;
	clicks: number;
	createdBy: string;
	passwordHash: string | null;
	maxDownloads: number | null;
	downloadCount: number;
}
