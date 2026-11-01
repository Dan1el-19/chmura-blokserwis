import { readdir, readFile, mkdtemp, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

async function filesUnder(directory, extension, prefix = '') {
	const files = new Map();
	for (const entry of await readdir(directory, { withFileTypes: true })) {
		const name = join(prefix, entry.name);
		if (entry.isDirectory()) {
			for (const [childName, contents] of await filesUnder(join(directory, entry.name), extension, name)) {
				files.set(childName, contents);
			}
		} else if (entry.name.endsWith(extension)) {
			files.set(name, await readFile(join(directory, entry.name), 'utf8'));
		}
	}
	return files;
}

async function compare(actualDirectory, expectedDirectory, extension) {
	const actual = await filesUnder(actualDirectory, extension);
	const expected = await filesUnder(expectedDirectory, extension);
	const changed = [...new Set([...actual.keys(), ...expected.keys()])]
		.filter((name) => normalize(actual.get(name), extension) !== normalize(expected.get(name), extension)).sort();
	if (changed.length) throw new Error(`Protobuf mismatch:\n${changed.join('\n')}`);
}

function normalize(contents, extension) {
	return extension === '.ts' ? contents.replace(/\n+$/, '\n') : contents;
}

const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== '--backend')) {
	throw new Error('Usage: node scripts/check-proto.mjs [--backend /path/to/UniSourceCFL]');
}

if (args.length) {
	await compare('proto', join(resolve(args[1]), 'proto'), '.proto');
	console.log('Frontend Protobuf snapshot matches the backend.');
}

// Generate outside the checkout so a failed check cannot repair and hide drift.
const output = await mkdtemp(join(tmpdir(), 'unisource-cloud-proto-'));
try {
	const result = spawnSync('buf', ['generate', '--output', output], { stdio: 'inherit' });
	if (result.error) throw result.error;
	if (result.status !== 0) throw new Error(`buf generate failed (${result.status}).`);
	await compare('src/lib/gen', join(output, 'src/lib/gen'), '.ts');
	console.log('Generated Protobuf client is up to date.');
} finally {
	await rm(output, { recursive: true, force: true });
}
