import type { Action } from 'svelte/action';

// Long press action — fires after `duration` ms of continuous press
// Cancels on move >10px or pointer up
export const longPress: Action<
	HTMLElement,
	{ duration?: number; onLongPress: () => void }
> = (node, params) => {
	let timer: ReturnType<typeof setTimeout> | null = null;
	let startX = 0;
	let startY = 0;

	function start(e: PointerEvent) {
		startX = e.clientX;
		startY = e.clientY;
		timer = setTimeout(() => {
			navigator.vibrate?.(50);
			params.onLongPress();
			timer = null;
		}, params.duration ?? 500);
	}

	function cancel() {
		if (timer) {
			clearTimeout(timer);
			timer = null;
		}
	}

	function move(e: PointerEvent) {
		if (Math.abs(e.clientX - startX) > 10 || Math.abs(e.clientY - startY) > 10) cancel();
	}

	node.addEventListener('pointerdown', start);
	node.addEventListener('pointerup', cancel);
	node.addEventListener('pointercancel', cancel);
	node.addEventListener('pointermove', move);

	return {
		update(newParams) {
			params = newParams;
		},
		destroy() {
			cancel();
			node.removeEventListener('pointerdown', start);
			node.removeEventListener('pointerup', cancel);
			node.removeEventListener('pointercancel', cancel);
			node.removeEventListener('pointermove', move);
		}
	};
};

// Swipe actions — reveals action buttons on horizontal swipe
// threshold: px to trigger reveal
export const swipeActions: Action<
	HTMLElement,
	{ threshold?: number; onSwipeLeft?: () => void; onSwipeRight?: () => void }
> = (node, params) => {
	let startX = 0;
	let startY = 0;
	let tracking = false;
	let revealed = false;
	const THRESHOLD = params.threshold ?? 60;

	function start(e: PointerEvent) {
		startX = e.clientX;
		startY = e.clientY;
		tracking = true;
	}

	function move(e: PointerEvent) {
		if (!tracking) return;
		const dx = e.clientX - startX;
		const dy = e.clientY - startY;
		// Cancel if vertical scroll dominates
		if (Math.abs(dy) > Math.abs(dx) + 10) {
			tracking = false;
			return;
		}
		// Translate element to follow finger (capped at threshold)
		const capped = Math.max(-THRESHOLD, Math.min(THRESHOLD, dx));
		node.style.transform = `translateX(${capped}px)`;
		node.style.transition = 'none';
	}

	function end(e: PointerEvent) {
		if (!tracking) return;
		tracking = false;
		const dx = e.clientX - startX;

		node.style.transition = 'transform 0.2s ease';

		if (dx < -THRESHOLD) {
			node.style.transform = `translateX(-${THRESHOLD}px)`;
			revealed = true;
			params.onSwipeLeft?.();
		} else if (dx > THRESHOLD) {
			node.style.transform = 'translateX(0)';
			revealed = false;
			params.onSwipeRight?.();
		} else {
			node.style.transform = 'translateX(0)';
			revealed = false;
		}
	}

	node.addEventListener('pointerdown', start);
	node.addEventListener('pointermove', move);
	node.addEventListener('pointerup', end);
	node.addEventListener('pointercancel', end);

	return {
		update(newParams) {
			params = newParams;
		},
		destroy() {
			node.removeEventListener('pointerdown', start);
			node.removeEventListener('pointermove', move);
			node.removeEventListener('pointerup', end);
			node.removeEventListener('pointercancel', end);
		}
	};
};
