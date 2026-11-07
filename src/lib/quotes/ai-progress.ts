const labels: Record<string, string> = {
	introduction: 'Wstęp', scope: 'Zakres prac', technical_description: 'Opis techniczny', conclusion: 'Zakończenie'
};

export function partialDescription(raw: string): { label: string; text: string }[] {
	const result: { label: string; text: string }[] = [];
	const fields = /"(introduction|scope|technical_description|conclusion)"\s*:\s*"((?:\\.|[^"\\])*)("|$)/g;
	for (const match of raw.matchAll(fields)) {
		let encoded = match[2];
		while (encoded.length) {
			try {
				const text: string = JSON.parse(`"${encoded}"`);
				if (text) result.push({ label: labels[match[1]], text });
				break;
			} catch { encoded = encoded.slice(0, -1); }
		}
	}
	return result;
}

export function researchSources(searches: { sources: { title: string; url: string }[] }[]) {
	const sources: { title: string; url: string }[] = [];
	const seen = new Set<string>();
	for (const search of searches) for (const source of search.sources) {
		try {
			const url = new URL(source.url);
			if (!['http:', 'https:'].includes(url.protocol) || seen.has(source.url)) continue;
			seen.add(source.url);
			sources.push({ title: source.title || url.hostname, url: source.url });
		} catch { /* Ignore malformed provider links. */ }
	}
	return sources;
}
