export function uploadNameKey(name: string): string {
	return name.normalize('NFC').toLowerCase().normalize('NFC');
}

export function nextAvailableUploadName(name: string, occupied: ReadonlySet<string>): string {
	const normalized = name.normalize('NFC');
	const dot = normalized.lastIndexOf('.');
	const extension = dot > 0 ? normalized.slice(dot) : '';
	const stem = dot > 0 ? normalized.slice(0, dot) : normalized;
	for (let index = 1; ; index++) {
		const suffix = ` (${index})`;
		let prefix = stem;
		while (prefix && new TextEncoder().encode(prefix + suffix + extension).length > 255)
			prefix = Array.from(prefix).slice(0, -1).join('');
		if (!prefix) throw new Error('Nie można dobrać nazwy pliku mieszczącej się w limicie.');
		const candidate = prefix + suffix + extension;
		if (!occupied.has(uploadNameKey(candidate))) return candidate;
	}
}
