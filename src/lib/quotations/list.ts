type SortableQuotation = {
	document: { number?: string; title: string };
	updatedAt: string;
};

export function quotationNumberSortValue(number: string | undefined): number {
	const match = number?.match(/^W\/(\d+)\/(\d{4})$/);
	return match ? Number(match[2]) * 1_000_000 + Number(match[1]) : -1;
}

export function sortQuotations<T extends SortableQuotation>(quotations: T[]): T[] {
	return [...quotations].sort((left, right) => {
		const numberOrder =
			quotationNumberSortValue(right.document.number) -
			quotationNumberSortValue(left.document.number);
		if (numberOrder !== 0) return numberOrder;

		const dateOrder = new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
		return dateOrder || left.document.title.localeCompare(right.document.title, 'pl');
	});
}
