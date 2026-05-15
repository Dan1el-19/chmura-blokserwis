import type { Action } from 'svelte/action';

// Click outside action — fires callback when a pointer lands outside the node.
export const clickOutside: Action<
	HTMLElement,
	{ enabled: boolean; callback: () => void }
> = (node, params) => {
	function handler(e: PointerEvent) {
		if (!params.enabled) return;
		if (node.contains(e.target as Node)) return;
		params.callback();
	}
	document.addEventListener('pointerdown', handler);
	return {
		update(newParams) {
			params = newParams;
		},
		destroy() {
			document.removeEventListener('pointerdown', handler);
		}
	};
};

type SwipeActionParams = {
	threshold?: number;
	maxOffset?: number;
	onSwipeLeft?: () => void;
	onSwipeRight?: () => void;
	leftLabel?: string;
	rightLabel?: string;
	leftColor?: string;
	rightColor?: string;
	disabled?: boolean;
};

// Swipe-to-action — full swipe past threshold triggers action and animates row out.
// Below threshold the row snaps back. Vertical scroll is preserved (touch-action: pan-y).
export const swipeAction: Action<HTMLElement, SwipeActionParams> = (node, params) => {
	let startX = 0;
	let startY = 0;
	let tracking = false;
	let activated = false;
	let pointerId: number | null = null;
	let currentDx = 0;

	const bg = document.createElement('div');
	bg.style.cssText =
		'position:absolute;inset:0;display:flex;align-items:center;justify-content:space-between;padding:0 24px;pointer-events:none;opacity:0;border-radius:inherit;';

	const rightSide = document.createElement('div');
	rightSide.style.cssText = 'display:flex;align-items:center;gap:8px;color:white;font-weight:500;';
	const leftSide = document.createElement('div');
	leftSide.style.cssText =
		'display:flex;align-items:center;gap:8px;color:white;font-weight:500;margin-left:auto;';

	bg.appendChild(rightSide);
	bg.appendChild(leftSide);

	function paint() {
		const threshold = params.threshold ?? 80;
		const past = Math.abs(currentDx) >= threshold;
		bg.style.opacity = Math.min(1, Math.abs(currentDx) / threshold).toString();

		if (currentDx > 0) {
			bg.style.background = params.rightColor ?? '#3b82f6';
			rightSide.innerHTML = past
				? `<span style="display:inline-flex;align-items:center;gap:6px;"><svg width="20" height="20" viewBox="0 0 256 256" fill="currentColor"><path d="M214,72H142a8,8,0,0,1,0-16h82.69a8,8,0,0,1,5.65,2.34l32,32a8,8,0,0,1,0,11.32l-32,32A8,8,0,0,1,224,136a8,8,0,0,1-5.66-13.66L237.66,103.34Z"/></svg>${params.rightLabel ?? 'Udostępnij'}</span>`
				: `<span style="opacity:0.7">${params.rightLabel ?? 'Udostępnij'}</span>`;
			leftSide.innerHTML = '';
		} else if (currentDx < 0) {
			bg.style.background = params.leftColor ?? '#dc2626';
			leftSide.innerHTML = past
				? `<span style="display:inline-flex;align-items:center;gap:6px;">${params.leftLabel ?? 'Usuń'}<svg width="20" height="20" viewBox="0 0 256 256" fill="currentColor"><path d="M216,48H176V40a24,24,0,0,0-24-24H104A24,24,0,0,0,80,40v8H40a8,8,0,0,0,0,16h8V208a16,16,0,0,0,16,16H192a16,16,0,0,0,16-16V64h8a8,8,0,0,0,0-16ZM112,168a8,8,0,0,1-16,0V104a8,8,0,0,1,16,0Zm48,0a8,8,0,0,1-16,0V104a8,8,0,0,1,16,0Z"/></svg></span>`
				: `<span style="opacity:0.7">${params.leftLabel ?? 'Usuń'}</span>`;
			rightSide.innerHTML = '';
		}
	}

	function start(e: PointerEvent) {
		if (params.disabled) return;
		if (e.pointerType !== 'touch' && e.pointerType !== 'pen') return;
		startX = e.clientX;
		startY = e.clientY;
		tracking = true;
		activated = false;
		pointerId = e.pointerId;
		currentDx = 0;
		node.style.transition = 'none';
	}

	function move(e: PointerEvent) {
		if (!tracking || e.pointerId !== pointerId) return;
		const dx = e.clientX - startX;
		const dy = e.clientY - startY;

		if (!activated) {
			if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) {
				tracking = false;
				return;
			}
			if (Math.abs(dx) < 8) return;
			activated = true;
			node.style.position = 'relative';
			if (!bg.parentElement) {
				const parent = node.parentElement;
				if (parent) {
					const computed = getComputedStyle(parent);
					if (computed.position === 'static') parent.style.position = 'relative';
					parent.insertBefore(bg, node);
				}
			}
		}

		const max = params.maxOffset ?? node.offsetWidth * 0.4;
		currentDx = Math.max(-max, Math.min(max, dx));
		node.style.transform = `translateX(${currentDx}px)`;
		paint();
	}

	function end(e: PointerEvent) {
		if (!tracking || e.pointerId !== pointerId) return;
		tracking = false;
		pointerId = null;
		const threshold = params.threshold ?? 80;

		if (currentDx <= -threshold && params.onSwipeLeft) {
			params.onSwipeLeft();
			resetRow();
		} else if (currentDx >= threshold && params.onSwipeRight) {
			params.onSwipeRight();
			resetRow();
		} else {
			node.style.transition = 'transform 0.2s ease';
			node.style.transform = 'translateX(0)';
			bg.style.transition = 'opacity 0.15s ease';
			bg.style.opacity = '0';
		}
		currentDx = 0;
	}

	function resetRow() {
		node.style.transition = 'none';
		node.style.transform = 'translateX(0)';
		bg.style.opacity = '0';
	}

	node.style.touchAction = 'pan-y';
	node.addEventListener('pointerdown', start);
	node.addEventListener('pointermove', move);
	node.addEventListener('pointerup', end);
	node.addEventListener('pointercancel', end);

	return {
		update(newParams) {
			params = newParams;
		},
		destroy() {
			node.style.touchAction = '';
			node.style.transform = '';
			node.style.transition = '';
			node.removeEventListener('pointerdown', start);
			node.removeEventListener('pointermove', move);
			node.removeEventListener('pointerup', end);
			node.removeEventListener('pointercancel', end);
			bg.remove();
		}
	};
};
