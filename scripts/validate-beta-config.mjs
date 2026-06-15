import { readFile } from 'node:fs/promises';

const config = JSON.parse(await readFile(new URL('../wrangler.jsonc', import.meta.url), 'utf8'));
const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const workflow = await readFile(
	new URL('../.github/workflows/beta-deploy.yml', import.meta.url),
	'utf8'
);

const failures = [];
const failUnless = (condition, message) => {
	if (!condition) failures.push(message);
};

const stableRoute = typeof config.route === 'string' ? config.route : config.route?.pattern;
const beta = config.env?.beta;
const betaRoute = typeof beta?.route === 'string' ? beta.route : beta?.route?.pattern;
const stableSecrets = [...(config.secrets?.required ?? [])].sort();
const betaSecrets = [...(beta?.secrets?.required ?? [])].sort();

failUnless(
	config.name === 'chmura-blokserwis',
	'Stable Worker name must remain chmura-blokserwis.'
);
failUnless(
	stableRoute === 'chmura.blokserwis.pl/*',
	'Stable route must remain chmura.blokserwis.pl/*.'
);
failUnless(
	beta?.name === 'chmura-blokserwis-beta',
	'Beta Worker name must be chmura-blokserwis-beta.'
);
failUnless(beta?.workers_dev === false, 'Beta workers_dev must be disabled.');
failUnless(
	betaRoute === 'beta.chmura.blokserwis.pl/*',
	'Beta route must be beta.chmura.blokserwis.pl/*.'
);
failUnless(betaRoute !== stableRoute, 'Beta route must differ from the stable route.');
failUnless(
	beta?.vars?.ORIGIN === 'https://beta.chmura.blokserwis.pl',
	'Beta ORIGIN must point to beta.'
);
failUnless(
	JSON.stringify(betaSecrets) === JSON.stringify(stableSecrets),
	'Beta must declare the same required secret names as stable.'
);

for (const scriptName of ['deploy:beta', 'deploy:beta:dry']) {
	const script = packageJson.scripts?.[scriptName] ?? '';
	failUnless(script.includes('--env beta'), `${scriptName} must always pass --env beta.`);
}

failUnless(
	workflow.includes('environment: beta'),
	'Beta workflow must use the beta GitHub environment.'
);
failUnless(
	workflow.includes('pnpm deploy:beta'),
	'Beta workflow must call the guarded beta deploy script.'
);
failUnless(
	workflow.includes('wrangler secret bulk --env beta'),
	'Beta workflow must sync runtime secrets only to the beta Worker.'
);
failUnless(
	!/branches:\s*\n\s*-\s*main\b/.test(workflow),
	'Beta workflow must never trigger on main.'
);
failUnless(
	!workflow.includes('wrangler deploy\n'),
	'Beta workflow must not call an unscoped wrangler deploy.'
);

if (failures.length > 0) {
	console.error('Beta deployment guard failed:');
	for (const failure of failures) console.error(`- ${failure}`);
	process.exit(1);
}

console.log('Beta deployment guard passed.');
