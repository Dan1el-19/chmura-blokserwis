export const DATABASE = {
	ID: 'main',
	TABLES: {
		FILES: 'files',
		FOLDERS: 'folders',
		FILE_SHARES: 'file_shares',
		RELEASES: 'releases'
	}
} as const;

export const STORAGE = {
	LIMITS: {
		BASIC_GB: 5,
		PLUS_GB: 10,
		BASIC: 5 * 1024 * 1024 * 1024,
		PLUS: 10 * 1024 * 1024 * 1024,
		ADMIN: Infinity
	},
	MAX_ZIP_SIZE: 10 * 1024 * 1024 * 1024,
	MAX_FILENAME_LENGTH: 255
} as const;

export const UPLOAD = {
	SIGNED_URL_EXPIRES_IN: 900,
	DOWNLOAD_URL_EXPIRES_IN: 3600
} as const;

export const RATE_LIMIT = {
	STANDARD_REQUESTS_PER_MINUTE: 30,
	STRICT_REQUESTS_PER_MINUTE: 10,
	UPLOAD_REQUESTS_PER_MINUTE: 100
} as const;

export const CACHE = {
	TTL: {
		LIST: 30_000,
		FOLDER_SIZE: 60_000,
		STORAGE_USAGE: 60_000,
		METADATA: 60_000,
		DOWNLOAD_URL: 3_500_000
	}
} as const;
