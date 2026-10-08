interface InViewOptions {
	rootMargin?: string;
	threshold?: number | number[];
	once?: boolean;
	onEnter?: () => void;
	onLeave?: () => void;
}

interface ResolvedInViewOptions {
	rootMargin: string;
	threshold: number | number[];
	once: boolean;
	onEnter?: () => void;
	onLeave?: () => void;
}

function resolveOptions(options: InViewOptions): ResolvedInViewOptions {
	return {
		rootMargin: options.rootMargin ?? '0px',
		threshold: options.threshold ?? 0,
		once: options.once ?? true,
		onEnter: options.onEnter,
		onLeave: options.onLeave
	};
}

export function inview(node: HTMLElement, initialOptions: InViewOptions = {}) {
	let options = resolveOptions(initialOptions);
	let observer: IntersectionObserver;

	function handleIntersect(entries: IntersectionObserverEntry[]) {
		for (const entry of entries) {
			if (entry.isIntersecting) {
				options.onEnter?.();
				if (options.once) observer.unobserve(node);
			} else {
				options.onLeave?.();
			}
		}
	}

	function observe() {
		observer = new IntersectionObserver(handleIntersect, {
			rootMargin: options.rootMargin,
			threshold: options.threshold
		});
		observer.observe(node);
	}

	observe();

	return {
		update(nextOptions: InViewOptions) {
			observer.disconnect();
			options = resolveOptions(nextOptions);
			observe();
		},
		destroy() {
			observer.disconnect();
		}
	};
}
