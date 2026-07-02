const requiredSecrets = [
	'APPWRITE_API_KEY',
	'UNISOURCE_URL',
	'UNISOURCE_SERVICE_ID',
	'UNISOURCE_API_KEY',
	'UPSTASH_REDIS_REST_URL',
	'UPSTASH_REDIS_REST_TOKEN',
	'PUBLIC_APPWRITE_ENDPOINT',
	'PUBLIC_APPWRITE_PROJECT_ID',
	'R2_ENDPOINT',
	'R2_ACCESS_KEY_ID',
	'R2_SECRET_ACCESS_KEY',
	'R2_BUCKET_NAME'
];

const missing = requiredSecrets.filter((name) => !process.env[name]);

if (missing.length > 0) {
	console.error(`Missing beta runtime secrets: ${missing.join(', ')}`);
	process.exit(1);
}

process.stdout.write(
	JSON.stringify(Object.fromEntries(requiredSecrets.map((name) => [name, process.env[name]])))
);
