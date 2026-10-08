import assert from 'node:assert/strict';
import { test } from 'node:test';
import { inview } from '../src/lib/actions/inview.ts';
import { site, events } from '../src/lib/site.ts';

test('scroll reveals enter once, release their observer and clean up on unmount', () => {
	let latest;
	globalThis.IntersectionObserver = class {
		constructor(callback) {
			this.callback = callback;
			// eslint-disable-next-line @typescript-eslint/no-this-alias -- Capture the browser observer for its lifecycle check.
			latest = this;
		}
		observe(node) {
			this.node = node;
		}
		unobserve(node) {
			assert.equal(node, this.node);
			this.unobserved = true;
		}
		disconnect() {
			this.disconnected = true;
		}
	};
	let enters = 0;
	const node = {};
	const action = inview(node, { onEnter: () => enters++ });
	latest.callback([{ isIntersecting: true }]);
	assert.equal(enters, 1);
	assert.ok(latest.unobserved);
	const previous = latest;
	action.update({ once: false, onEnter: () => enters++ });
	assert.ok(previous.disconnected);
	latest.callback([{ isIntersecting: true }]);
	assert.equal(enters, 2);
	assert.ok(!latest.unobserved);
	action.destroy();
	assert.ok(latest.disconnected);
	delete globalThis.IntersectionObserver;
});

test('public content has valid contact URLs and real calendar dates', () => {
	assert.ok(site.fullName.includes('অংকুর'));
	for (const url of [site.url, site.facebook, site.mapUrl].filter(Boolean)) {
		assert.equal(new URL(url).protocol, 'https:');
	}
	for (const event of events) {
		assert.match(event.date, /^\d{4}-\d{2}-\d{2}$/);
		assert.equal(new Date(`${event.date}T00:00:00Z`).toISOString().slice(0, 10), event.date);
		assert.ok(event.title.trim() && event.description.trim() && event.location.trim());
	}
});
