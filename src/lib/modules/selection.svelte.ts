export class SelectionState {
	selected = $state<Set<string>>(new Set());
	isSelectionMode = $state(false);

	toggle(id: string) {
		const next = new Set(this.selected);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		this.selected = next;
		this.isSelectionMode = next.size > 0;
	}

	selectRange(allIds: string[], fromId: string, toId: string) {
		const a = allIds.indexOf(fromId);
		const b = allIds.indexOf(toId);
		if (a === -1 || b === -1) return;
		const [start, end] = a < b ? [a, b] : [b, a];
		const next = new Set(this.selected);
		for (let i = start; i <= end; i++) next.add(allIds[i]);
		this.selected = next;
		this.isSelectionMode = next.size > 0;
	}

	add(id: string) {
		if (this.selected.has(id)) return;
		this.selected = new Set([...this.selected, id]);
		this.isSelectionMode = true;
	}

	clear() {
		this.selected = new Set();
		this.isSelectionMode = false;
	}

	get count() {
		return this.selected.size;
	}

	has(id: string) {
		return this.selected.has(id);
	}
}
