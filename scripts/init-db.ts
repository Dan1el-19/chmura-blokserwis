import { Client, TablesDB, IndexType } from 'node-appwrite';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { normalizeAppwriteEnv } from '../src/lib/server/appwrite-env';

function loadEnv() {
	try {
		const envPath = resolve(process.cwd(), '.env');
		const envFile = readFileSync(envPath, 'utf8');
		envFile.split('\n').forEach((line) => {
			const [key, ...values] = line.split('=');
			const value = values.join('=');
			if (key && value) {
				process.env[key.trim()] = value.trim().replace(/^["']|["']$/g, '');
			}
		});
	} catch (e) {
		console.log('No .env file found, relying on process.env');
	}
}

loadEnv();

const appwriteEnv = normalizeAppwriteEnv(process.env as Record<string, string | undefined>);

const ENDPOINT = appwriteEnv.PUBLIC_APPWRITE_ENDPOINT;
const PROJECT_ID = appwriteEnv.PUBLIC_APPWRITE_PROJECT_ID;
const API_KEY = appwriteEnv.APPWRITE_API_KEY;
const DATABASE_ID = 'main';

if (!ENDPOINT || !PROJECT_ID || !API_KEY) {
	console.error('Missing required environment variables.');
	process.exit(1);
}

const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT_ID).setKey(API_KEY);

const tablesDB = new TablesDB(client);

async function createCollections() {
	console.log(`Initializing Database (${DATABASE_ID})...`);

	try {
		const dbList = await tablesDB.list({ queries: [], search: DATABASE_ID });
		const dbExists = dbList.databases.some((db) => db.$id === DATABASE_ID);
		if (dbExists) {
			console.log(`Database '${DATABASE_ID}' exists.`);
		} else {
			throw { code: 404 };
		}
	} catch (e: any) {
		if (e.code === 404) {
			console.log(`Database '${DATABASE_ID}' not found. Creating...`);
			await tablesDB.create({ databaseId: DATABASE_ID, name: 'main', enabled: true });
		} else {
			console.error('Error fetching database:', e.message);
			process.exit(1);
		}
	}

	try {
		console.log("Creating 'folders' collection...");
		try {
			await tablesDB.createTable({
				databaseId: DATABASE_ID,
				tableId: 'folders',
				name: 'Folders'
			});
			console.log("Created 'folders' collection.");
		} catch (e: any) {
			if (e.code === 409) console.log("'folders' collection already exists.");
			else console.error("Error creating 'folders':", e.message);
		}

		console.log("Creating attributes for 'folders'...");
		const folderAttrs = [
			() =>
				tablesDB.createStringColumn({
					databaseId: DATABASE_ID,
					tableId: 'folders',
					key: 'name',
					size: 255,
					required: true
				}),
			() =>
				tablesDB.createStringColumn({
					databaseId: DATABASE_ID,
					tableId: 'folders',
					key: 'parentFolderId',
					size: 36,
					required: false
				}),
			() =>
				tablesDB.createStringColumn({
					databaseId: DATABASE_ID,
					tableId: 'folders',
					key: 'ownerId',
					size: 36,
					required: true
				}),
			() =>
				tablesDB.createStringColumn({
					databaseId: DATABASE_ID,
					tableId: 'folders',
					key: 'path',
					size: 4096,
					required: true
				})
		];
		await runAttributes(folderAttrs);

		console.log("Creating 'files' collection...");
		try {
			await tablesDB.createTable({
				databaseId: DATABASE_ID,
				tableId: 'files',
				name: 'Files'
			});
			console.log("Created 'files' collection.");
		} catch (e: any) {
			if (e.code === 409) console.log("'files' collection already exists.");
			else console.error("Error creating 'files':", e.message);
		}

		console.log("Creating attributes for 'files'...");
		const fileAttrs = [
			() =>
				tablesDB.createStringColumn({
					databaseId: DATABASE_ID,
					tableId: 'files',
					key: 'name',
					size: 255,
					required: true
				}),
			() =>
				tablesDB.createIntegerColumn({
					databaseId: DATABASE_ID,
					tableId: 'files',
					key: 'size',
					required: true
				}),
			() =>
				tablesDB.createStringColumn({
					databaseId: DATABASE_ID,
					tableId: 'files',
					key: 'mimeType',
					size: 127,
					required: true
				}),
			() =>
				tablesDB.createStringColumn({
					databaseId: DATABASE_ID,
					tableId: 'files',
					key: 'r2Key',
					size: 1024,
					required: true
				}),
			() =>
				tablesDB.createStringColumn({
					databaseId: DATABASE_ID,
					tableId: 'files',
					key: 'bucketId',
					size: 255,
					required: true
				}),
			() =>
				tablesDB.createStringColumn({
					databaseId: DATABASE_ID,
					tableId: 'files',
					key: 'ownerId',
					size: 36,
					required: true
				}),
			() =>
				tablesDB.createStringColumn({
					databaseId: DATABASE_ID,
					tableId: 'files',
					key: 'parentFolderId',
					size: 36,
					required: false
				})
		];
		await runAttributes(fileAttrs);

		console.log("Creating 'releases' collection...");
		try {
			await tablesDB.createTable({
				databaseId: DATABASE_ID,
				tableId: 'releases',
				name: 'Releases'
			});
			console.log("Created 'releases' collection.");
		} catch (e: any) {
			if (e.code === 409) console.log("'releases' collection already exists.");
			else console.error("Error creating 'releases':", e.message);
		}

		console.log("Creating attributes for 'releases'...");
		const releaseAttrs = [
			() =>
				tablesDB.createStringColumn({
					databaseId: DATABASE_ID,
					tableId: 'releases',
					key: 'name',
					size: 255,
					required: true
				}),
			() =>
				tablesDB.createIntegerColumn({
					databaseId: DATABASE_ID,
					tableId: 'releases',
					key: 'size',
					required: true
				}),
			() =>
				tablesDB.createStringColumn({
					databaseId: DATABASE_ID,
					tableId: 'releases',
					key: 'r2Key',
					size: 512,
					required: true
				}),
			() =>
				tablesDB.createStringColumn({
					databaseId: DATABASE_ID,
					tableId: 'releases',
					key: 'tags',
					size: 1024,
					required: false
				}),
			() =>
				tablesDB.createStringColumn({
					databaseId: DATABASE_ID,
					tableId: 'releases',
					key: 'uploadedBy',
					size: 36,
					required: true
				}),
			() =>
				tablesDB.createStringColumn({
					databaseId: DATABASE_ID,
					tableId: 'releases',
					key: 'notes',
					size: 2048,
					required: false
				})
		];
		await runAttributes(releaseAttrs);

		console.log('Creating indexes...');
		await createIndexes();

		console.log('✅ Database Schema initialized successfully.');
	} catch (err: any) {
		console.error('Fatal error during migration:', err);
	}
}

async function runAttributes(attrFunctions: Array<() => Promise<any>>) {
	for (const fn of attrFunctions) {
		try {
			await fn();
			await new Promise((r) => setTimeout(r, 500));
		} catch (e: any) {
			if (e.code !== 409) {
				console.error('  Error creating attribute:', e.message);
			}
		}
	}
}

async function createIndexes() {
	const indexes = [
		{ tableId: 'files', key: 'files_ownerId_idx', columns: ['ownerId'] },
		{ tableId: 'files', key: 'files_parentFolderId_idx', columns: ['parentFolderId'] },
		{ tableId: 'files', key: 'files_owner_parent_idx', columns: ['ownerId', 'parentFolderId'] },
		{ tableId: 'folders', key: 'folders_ownerId_idx', columns: ['ownerId'] },
		{ tableId: 'folders', key: 'folders_parentFolderId_idx', columns: ['parentFolderId'] },
		{ tableId: 'folders', key: 'folders_owner_parent_idx', columns: ['ownerId', 'parentFolderId'] },
		{ tableId: 'releases', key: 'releases_name_idx', columns: ['name'] }
	];

	for (const idx of indexes) {
		try {
			await tablesDB.createIndex({
				databaseId: DATABASE_ID,
				tableId: idx.tableId,
				key: idx.key,
				type: IndexType.Key,
				columns: idx.columns
			});
			console.log(`  Created index: ${idx.key}`);
			await new Promise((r) => setTimeout(r, 500));
		} catch (e: any) {
			if (e.code === 409) {
				console.log(`  Index ${idx.key} already exists.`);
			} else {
				console.error(`  Error creating index ${idx.key}:`, e.message);
			}
		}
	}
}

createCollections();
