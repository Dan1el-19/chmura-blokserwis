import { Client, Databases, Permission, Role, ID } from 'node-appwrite';

// Read env vars from process.env
const ENDPOINT = process.env.PUBLIC_APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1';
const PROJECT_ID = process.env.PUBLIC_APPWRITE_PROJECT_ID || 'effinity-cloud';
const API_KEY = process.env.APPWRITE_API_KEY;
const DATABASE_ID = 'main';
const COLLECTION_ID = 'file_shares';
const COLLECTION_NAME = 'file_shares';

if (!API_KEY) {
	console.error('Error: APPWRITE_API_KEY environment variable is required.');
	process.exit(1);
}

const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT_ID).setKey(API_KEY);

const databases = new Databases(client);

async function setup() {
	console.log('Starting DB Setup...');
	console.log(`Endpoint: ${ENDPOINT}`);
	console.log(`Project: ${PROJECT_ID}`);

	try {
		console.log('Verifying database access...');
		try {
			await databases.get(DATABASE_ID);
			console.log(`Database '${DATABASE_ID}' found.`);
		} catch (e: any) {
			console.error(
				`Failed to get database '${DATABASE_ID}'. Error: ${e.message} (Code: ${e.code})`
			);
			return;
		}

		// 1. Create Collection
		console.log(`Creating collection '${COLLECTION_NAME}'...`);
		try {
			// Updated signature for newer SDKs might be needed, but assuming standard:
			// createCollection(databaseId, collectionId, name, permissions, documentSecurity, enabled)
			await databases.createCollection(DATABASE_ID, COLLECTION_ID, COLLECTION_NAME, [
				Permission.read(Role.users()),
				Permission.write(Role.users()),
				Permission.update(Role.users()),
				Permission.delete(Role.users())
			]);
			console.log('Collection created.');
		} catch (e: any) {
			if (e.code === 409) {
				console.log('Collection already exists, skipping creation.');
			} else {
				console.error(`Failed to create collection: ${e.message} (Code: ${e.code})`);
				// Continue to attributes anyway, maybe it exists but attributes are missing
			}
		}

		// 2. Create Attributes
		const attributes = [
			{ key: 'fileId', type: 'string', size: 36, required: true },
			{ key: 'token', type: 'string', size: 255, required: true },
			{ key: 'label', type: 'string', size: 128, required: false },
			{ key: 'expiresAt', type: 'datetime', required: false },
			{ key: 'autoDelete', type: 'boolean', required: false, default: false }, // Required must be false for default to work
			{ key: 'clicks', type: 'integer', required: false, default: 0 },
			{ key: 'createdBy', type: 'string', size: 36, required: true }
		];

		for (const attr of attributes) {
			console.log(`Creating attribute '${attr.key}'...`);
			try {
				if (attr.type === 'string') {
					await databases.createStringAttribute(
						DATABASE_ID,
						COLLECTION_ID,
						attr.key,
						attr.size!,
						attr.required
					);
				} else if (attr.type === 'boolean') {
					await databases.createBooleanAttribute(
						DATABASE_ID,
						COLLECTION_ID,
						attr.key,
						attr.required,
						attr.default
					);
				} else if (attr.type === 'integer') {
					await databases.createIntegerAttribute(
						DATABASE_ID,
						COLLECTION_ID,
						attr.key,
						attr.required,
						0,
						2000000000,
						attr.default
					);
				} else if (attr.type === 'datetime') {
					await databases.createDatetimeAttribute(
						DATABASE_ID,
						COLLECTION_ID,
						attr.key,
						attr.required
					);
				}
			} catch (e: any) {
				if (e.code === 409) {
					console.log(`Attribute '${attr.key}' already exists.`);
				} else {
					console.error(`Failed to create attribute '${attr.key}': ${e.message}`);
				}
			}
			await new Promise((r) => setTimeout(r, 200));
		}

		console.log('Waiting for attributes...');
		await new Promise((r) => setTimeout(r, 2000));

		// 3. Create Indexes
		const indexes = [
			{ key: 'idx_token', type: 'unique', attributes: ['token'] },
			{ key: 'idx_fileId', type: 'key', attributes: ['fileId'] }
		];

		for (const idx of indexes) {
			console.log(`Creating index '${idx.key}'...`);
			try {
				// createIndex(databaseId, collectionId, key, type, attributes, orders)
				await databases.createIndex(
					DATABASE_ID,
					COLLECTION_ID,
					idx.key,
					idx.type as any,
					idx.attributes
				);
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
