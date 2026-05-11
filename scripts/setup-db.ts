import 'dotenv/config';
import { Client, TablesDB, IndexType } from 'node-appwrite';
import { normalizeAppwriteEnv } from '../src/lib/server/appwrite-env';

const appwriteEnv = normalizeAppwriteEnv(process.env as Record<string, string | undefined>);

const ENDPOINT = appwriteEnv.PUBLIC_APPWRITE_ENDPOINT;
const PROJECT_ID = appwriteEnv.PUBLIC_APPWRITE_PROJECT_ID;
const API_KEY = appwriteEnv.APPWRITE_API_KEY;
const DATABASE_ID = 'main';
const TABLE_ID = 'file_shares';
const TABLE_NAME = 'file_shares';

if (!ENDPOINT || !PROJECT_ID || !API_KEY) {
	console.error(
		'Błąd: Brak wymaganych zmiennych środowiskowych (PUBLIC_APPWRITE_ENDPOINT, PUBLIC_APPWRITE_PROJECT_ID lub APPWRITE_API_KEY).'
	);
	process.exit(1);
}

const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT_ID).setKey(API_KEY);

const tablesDB = new TablesDB(client);

async function setup() {
	console.log('Starting DB Setup (TablesDB syntax)...');
	console.log(`Endpoint: ${ENDPOINT}`);
	console.log(`Project: ${PROJECT_ID}`);

	try {
		console.log('Verifying database access...');
		try {
			// List databases to verify access
			await tablesDB.list({ search: DATABASE_ID });
			console.log(`Database access verified.`);
		} catch (e: any) {
			console.error(`Failed to access database. Error: ${e.message}`);
			return;
		}

		// 1. Create Table
		console.log(`Creating table '${TABLE_NAME}'...`);
		try {
			await tablesDB.createTable({
				databaseId: DATABASE_ID,
				tableId: TABLE_ID,
				name: TABLE_NAME
			});
			console.log('Table created.');
		} catch (e: any) {
			if (e.code === 409) {
				console.log('Table already exists, skipping creation.');
			} else {
				console.error(`Failed to create table: ${e.message} (Code: ${e.code})`);
			}
		}

		// 2. Create Columns
		const columns = [
			{ key: 'fileId', type: 'string', size: 36, required: false },
			{ key: 'folderId', type: 'string', size: 36, required: false },
			{ key: 'shareType', type: 'string', size: 10, required: false, defaultStr: 'file' },
			{ key: 'token', type: 'string', size: 255, required: true },
			{ key: 'label', type: 'string', size: 128, required: false },
			{ key: 'expiresAt', type: 'datetime', required: false },
			{ key: 'autoDelete', type: 'boolean', required: false, default: false },
			{ key: 'clicks', type: 'integer', required: false, default: 0 },
			{ key: 'createdBy', type: 'string', size: 36, required: true },
			{ key: 'passwordHash', type: 'string', size: 255, required: false },
			{ key: 'maxDownloads', type: 'integer', required: false },
			{ key: 'downloadCount', type: 'integer', required: false, default: 0 }
		];

		for (const col of columns) {
			console.log(`Creating column '${col.key}'...`);
			try {
				if (col.type === 'string') {
					await tablesDB.createStringColumn({
						databaseId: DATABASE_ID,
						tableId: TABLE_ID,
						key: col.key,
						size: col.size!,
						required: col.required,
						xdefault: (col as any).defaultStr
					});
				} else if (col.type === 'boolean') {
					await tablesDB.createBooleanColumn({
						databaseId: DATABASE_ID,
						tableId: TABLE_ID,
						key: col.key,
						required: col.required,
						xdefault: col.default as boolean | undefined
					});
				} else if (col.type === 'integer') {
					await tablesDB.createIntegerColumn({
						databaseId: DATABASE_ID,
						tableId: TABLE_ID,
						key: col.key,
						required: col.required,
						min: 0,
						max: 2000000000,
						xdefault: col.default as number | undefined
					});
				} else if (col.type === 'datetime') {
					await tablesDB.createDatetimeColumn({
						databaseId: DATABASE_ID,
						tableId: TABLE_ID,
						key: col.key,
						required: col.required
					});
				}
			} catch (e: any) {
				if (e.code === 409) {
					console.log(`Column '${col.key}' already exists.`);
				} else {
					console.error(`Failed to create column '${col.key}': ${e.message}`);
				}
			}
			await new Promise((r) => setTimeout(r, 200));
		}

		console.log('Waiting for columns...');
		await new Promise((r) => setTimeout(r, 2000));

		// 3. Create Indexes
		const indexes = [
			{ key: 'idx_token', type: IndexType.Unique, columns: ['token'] },
			{ key: 'idx_fileId', type: IndexType.Key, columns: ['fileId'] },
			{ key: 'idx_folderId', type: IndexType.Key, columns: ['folderId'] }
		];

		for (const idx of indexes) {
			console.log(`Creating index '${idx.key}'...`);
			try {
				await tablesDB.createIndex({
					databaseId: DATABASE_ID,
					tableId: TABLE_ID,
					key: idx.key,
					type: idx.type,
					columns: idx.columns
				});
				console.log(`Index '${idx.key}' created.`);
			} catch (e: any) {
				if (e.code === 409) {
					console.log(`Index '${idx.key}' already exists.`);
				} else {
					console.error(`Failed to create index '${idx.key}': ${e.message}`);
				}
			}
		}

		console.log('DB Setup Complete!');
	} catch (e: any) {
		console.error('Setup failed:', e);
	}
}

setup();
