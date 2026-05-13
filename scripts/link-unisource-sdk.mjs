import { existsSync } from 'node:fs';
import { mkdir, rm, symlink } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const target = resolve(root, '..', 'UniSource', 'packages', 'unisource-sdk');
const linkPath = resolve(root, 'node_modules', '@unisource', 'sdk');

if (!existsSync(resolve(target, 'package.json'))) {
	console.error(`UniSource SDK checkout not found: ${target}`);
	process.exit(1);
}

await mkdir(dirname(linkPath), { recursive: true });
await rm(linkPath, { force: true, recursive: true });
await symlink(target, linkPath, process.platform === 'win32' ? 'junction' : 'dir');

console.log(`Linked @unisource/sdk -> ${target}`);
