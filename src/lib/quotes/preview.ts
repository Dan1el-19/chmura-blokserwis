export function quotePreviewDocument(html: string): string {
	// The API's A4 templates declare their print margins before any @page footer rules.
	const page = html.match(/@page\s*\{([^{}]*)/i)?.[1];
	const margin = page?.match(/(?:^|;)\s*margin\s*:\s*([^;]+)/i)?.[1].trim();
	const length = /^(?:0|\d+(?:\.\d+)?(?:mm|cm|in|pt|px))$/i;
	const values = margin?.split(/\s+/) ?? [];
	const padding = values.length >= 1 && values.length <= 4 && values.every((value) => length.test(value))
		? values.join(' ') : '18mm';
	const style = `<style data-quote-preview>
@media screen {
	html { margin: 0; padding: 16px; background: #e5e7eb; color-scheme: light; }
	body { box-sizing: border-box; width: 210mm; min-height: 297mm; margin: 0 auto; padding: ${padding}; background: #fff; box-shadow: 0 2px 12px #0002; }
}
</style>`;
	return /<\/head\s*>/i.test(html) ? html.replace(/<\/head\s*>/i, `${style}</head>`) : style + html;
}
