import { navigating } from '$app/state';

/**
 * Reactive flag that becomes `true` when SvelteKit is in the middle of a
 * cross-route navigation where the predicate returns true, and stays `false`
 * otherwise.
 *
 * The flag waits {@link delayMs} ms before flipping on so that fast loads do
 * not cause skeleton flicker. It clears immediately when the navigation ends
 * or the predicate returns false.
 *
 * @param predicate Function that receives `(fromRouteId, toRouteId)` and
 *   returns true if the navigation should trigger the loading flag.
 * @param delayMs Defaults to 100 ms.
 */
export function createCrossRouteNavigationLoading(
	predicate: (from: string | null, to: string | null) => boolean,
	delayMs = 100
) {
	let visible = $state(false);
	let timer: ReturnType<typeof setTimeout> | null = null;

	function clear() {
		if (timer !== null) {
			clearTimeout(timer);
			timer = null;
		}
	}

	$effect(() => {
		const from = navigating.from?.route?.id ?? null;
		const to = navigating.to?.route?.id ?? null;
		const matches = !!navigating.to && predicate(from, to);

		if (matches) {
			clear();
			timer = setTimeout(() => {
				visible = true;
				timer = null;
			}, delayMs);
		} else {
			clear();
			visible = false;
		}

		return clear;
	});

	return {
		get current() {
			return visible;
		}
	};
}
