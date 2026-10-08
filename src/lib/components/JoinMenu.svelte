<script lang="ts">
	import { onMount } from 'svelte';
	import ChevronDown from 'lucide-svelte/icons/chevron-down';
	import X from 'lucide-svelte/icons/x';
	import Sprout from 'lucide-svelte/icons/sprout';
	import ArrowUpRight from 'lucide-svelte/icons/arrow-up-right';
	let { light = false } = $props<{ light?: boolean }>();
	const tone = $derived(light ? 'light' : 'primary');
	const align = 'left';
	let open = $state(false);
	let isClosing = $state(false);
	let root: HTMLDivElement;
	let trigger: HTMLButtonElement;
	let title: HTMLSpanElement;
	let drawer: HTMLDivElement;
	let collapsedWidth = $state(252);
	let expandedWidth = $state(340);
	let drawerHeight = $state(160);
	let reduced = false;
	let closeTimer: ReturnType<typeof setTimeout> | undefined;
	const expanded = $derived(open && !isClosing);
	const options = [
		{
			href: '#contact',
			title: 'অভিভাবক ও শুভাকাঙ্ক্ষী',
			subtitle: 'যোগাযোগের তথ্য দেখুন',
			signal: [7, 14, 10, 19, 12, 16]
		},
		{
			href: '#activities',
			title: 'সৃজনশীলতা অন্বেষণ করুন',
			subtitle: 'আমাদের কার্যক্রমের পরিচিতি',
			signal: [12, 18, 8, 15, 20, 11]
		}
	];
	function measure() {
		expandedWidth = Math.min(340, root.parentElement?.clientWidth ?? 340);
		if (!open && title) collapsedWidth = Math.ceil(99 + title.getBoundingClientRect().width);
		if (drawer) drawerHeight = Math.ceil(drawer.scrollHeight);
	}
	function close(restoreFocus = false) {
		if (!open || isClosing) return;
		isClosing = true;
		closeTimer = setTimeout(
			() => {
				open = false;
				isClosing = false;
				if (restoreFocus) trigger.focus();
			},
			reduced ? 0 : 290
		);
	}
	function toggle() {
		if (open) close();
		else {
			measure();
			open = true;
		}
	}
	onMount(() => {
		let mounted = true;
		const motion = matchMedia('(prefers-reduced-motion: reduce)');
		const updateMotion = () => {
			reduced = motion.matches;
		};
		updateMotion();
		motion.addEventListener('change', updateMotion);
		const observer = new ResizeObserver(measure);
		if (root.parentElement) observer.observe(root.parentElement);
		observer.observe(drawer);
		measure();
		void document.fonts.ready.then(() => {
			if (mounted) measure();
		});
		return () => {
			mounted = false;
			clearTimeout(closeTimer);
			observer.disconnect();
			motion.removeEventListener('change', updateMotion);
		};
	});
</script>

<svelte:window
	onclick={(e) => {
		if (open && !root.contains(e.target as Node)) close();
	}}
	onkeydown={(e) => {
		if (open && e.key === 'Escape') {
			e.preventDefault();
			close(true);
		}
	}}
/>
<div
	class="join-menu morph-container tone-{tone} align-{align}"
	class:is-expanded={expanded}
	class:is-closing={isClosing}
	bind:this={root}
	style:--collapsed-w="{collapsedWidth}px"
	style:--expanded-width="{expandedWidth}px"
	style:--expanded-h="{58 + drawerHeight}px"
>
	<button
		class="join-trigger header-bar"
		type="button"
		bind:this={trigger}
		onclick={toggle}
		aria-expanded={expanded}
		aria-label={expanded ? 'বিকল্প বন্ধ করুন' : 'অংকুরের সাথে যুক্ত হোন'}
	>
		<span class="header-icon" aria-hidden="true"><Sprout size={16} /></span>
		<span class="header-title-track"
			><span
				class="title-slide title-collapsed"
				class:exit={expanded}
				bind:this={title}
				aria-hidden={expanded}>অংকুরের সাথে যুক্ত হোন</span
			><span class="title-slide title-expanded" class:enter={expanded} aria-hidden={!expanded}
				>আপনার পথ বেছে নিন</span
			></span
		>
		<span class="header-action-slot" aria-hidden="true"
			><span class="action-icon icon-chevron" class:hidden={expanded}
				><ChevronDown size={14} /></span
			><span class="close-button" class:visible={expanded}><X size={14} /></span></span
		>
	</button>
	<div class="drawer-wrapper" inert={!expanded} aria-hidden={!expanded}>
		<div class="drawer-content join-drawer" bind:this={drawer}>
			<div class="header-divider" aria-hidden="true"></div>
			<div class="platform-list">
				{#each options as option, index (option.href)}
					<!-- eslint-disable svelte/no-navigation-without-resolve -- Same-page section anchors. -->
					<a
						class="platform-tile"
						class:tile-win={index === 0}
						class:tile-mac={index === 1}
						href={option.href}
						onclick={() => close()}
					>
						<span class="brand-icon" class:apple={index === 1} aria-hidden="true"
							><svg viewBox="0 0 24 24"
								>{#if index === 0}<path
										d="M12 21V6M12 6C9 3 5 3 2 4v14c4-1 7 0 10 3M12 6c3-3 7-3 10-2v14c-4-1-7 0-10 3"
									/>{:else}<path
										d="M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 0-4h-1a2 2 0 0 1 0-4h4a5 5 0 0 0 0-10z"
									/><circle cx="7" cy="9" r=".7" /><circle cx="11" cy="6" r=".7" /><circle
										cx="16"
										cy="7"
										r=".7"
									/>{/if}</svg
							></span
						>
						<span class="platform-meta"
							><strong class="platform-name">{option.title}</strong><small class="platform-format"
								>{option.subtitle}</small
							></span
						>
						<span class="signal-visual" aria-hidden="true"
							>{#each option.signal as height, bar (bar)}<i style:--base-h="{height}px"
								></i>{/each}</span
						>
						<span class="download-action-icon" aria-hidden="true"><ArrowUpRight size={15} /></span>
					</a>
				{/each}
				<!-- eslint-enable svelte/no-navigation-without-resolve -->
			</div>
		</div>
	</div>
</div>

<style>
	/* ========================================================
	   CONTAINER: Unified Morph Physics (--ease-drawer)
	   ======================================================== */
	.morph-container {
		--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);
		position: relative;
		display: inline-block;
		box-sizing: border-box;
		overflow: hidden;
		width: var(--collapsed-w, 184px);
		max-width: calc(100vw - 32px);
		height: 56px;
		border-radius: 999px;
		user-select: none;
		will-change: width, height, border-radius, box-shadow;
		transition:
			width 400ms var(--ease-drawer),
			height 400ms var(--ease-drawer),
			border-radius 400ms var(--ease-drawer),
			box-shadow 400ms var(--ease-drawer),
			background-color 260ms ease,
			transform 160ms ease;
	}

	.morph-container.align-center {
		margin: 0 auto;
	}

	.morph-container.is-expanded {
		width: var(--expanded-width, 340px);
		height: var(--expanded-h, 189px);
		border-radius: 20px;
	}

	/* Tactile press response on collapsed button */
	.morph-container:not(.is-expanded):active {
		transform: scale(0.97);
	}

	/* ========================================================
	   CLOSING STATE OVERRIDE: Exit Faster Than Entrance
	   ======================================================== */
	.morph-container.is-closing {
		transition:
			width 280ms var(--ease-drawer),
			height 280ms var(--ease-drawer),
			border-radius 260ms var(--ease-drawer),
			box-shadow 280ms var(--ease-drawer),
			background-color 200ms ease;
	}

	/* ========================================================
	   TONE: PRIMARY (The White Button in the Hero section)
	   ======================================================== */
	.morph-container.tone-primary {
		background: #f4f3ee;
		color: #090909;
		border: 1px solid rgba(255, 255, 255, 0.95);
		box-shadow: 0 4px 18px rgba(0, 0, 0, 0.22);
	}

	.morph-container.tone-primary:hover:not(.is-expanded) {
		transform: translateY(-2px);
		background: #ffffff;
		box-shadow: 0 14px 38px rgba(0, 0, 0, 0.32);
	}

	.morph-container.tone-primary.is-expanded {
		background: #f4f3ee;
		border: 1px solid rgba(255, 255, 255, 0.98);
		box-shadow:
			0 28px 72px -8px rgba(0, 0, 0, 0.65),
			0 6px 24px rgba(0, 0, 0, 0.25);
	}

	/* ========================================================
	   TONE: LIGHT (The Dark Button in the Light CTA section)
	   ======================================================== */
	.morph-container.tone-light {
		background: #090a0c;
		color: #f5f3ee;
		border: 1px solid rgba(255, 255, 255, 0.12);
		box-shadow: 0 4px 18px rgba(0, 0, 0, 0.18);
	}

	.morph-container.tone-light:hover:not(.is-expanded) {
		transform: translateY(-2px);
		background: #15171c;
		box-shadow: 0 14px 38px rgba(0, 0, 0, 0.25);
	}

	.morph-container.tone-light.is-expanded {
		background: #0c0e11;
		border: 1px solid rgba(255, 255, 255, 0.15);
		box-shadow:
			0 28px 72px -12px rgba(0, 0, 0, 0.42),
			0 6px 24px rgba(0, 0, 0, 0.22);
	}

	/* ========================================================
	   HEADER BAR: Unified 3-Slot Grid Layout
	   ======================================================== */
	.header-bar {
		position: relative;
		display: flex;
		align-items: center;
		width: 100%;
		height: 56px;
		padding: 0 14px 0 18px;
		box-sizing: border-box;
		cursor: pointer;
		outline: none;
		border: 0;
		background: transparent;
	}

	.header-bar:focus-visible {
		outline: 2px solid #47d6ef;
		outline-offset: 3px;
	}

	/* Slot 1: Download icon */
	.header-icon {
		display: grid;
		place-items: center;
		width: 16px;
		height: 16px;
		margin-right: 9px;
		flex-shrink: 0;
		opacity: 0.95;
	}

	/* Slot 2: Title Roll Track (Zero overlap / zero wrapping) */
	.header-title-track {
		position: relative;
		display: inline-flex;
		align-items: center;
		height: 27px;
		overflow: hidden;
		white-space: nowrap;
		flex-grow: 1;
	}

	.title-slide {
		display: block;
		font-size: 13.5px;
		font-weight: 700;
		letter-spacing: -0.01em;
		white-space: nowrap;
		will-change: transform, opacity, filter;
		transition:
			opacity 220ms ease,
			transform 280ms cubic-bezier(0.32, 0.72, 0, 1),
			filter 220ms ease;
	}

	/* Collapsed Title */
	.title-collapsed {
		transform: translateY(0);
		opacity: 1;
		filter: blur(0px);
	}

	.title-collapsed.exit {
		transform: translateY(-115%);
		opacity: 0;
		filter: blur(2px);
		pointer-events: none;
	}

	/* Expanded Title */
	.title-expanded {
		position: absolute;
		left: 0;
		top: 0;
		transform: translateY(115%);
		opacity: 0;
		filter: blur(2px);
		pointer-events: none;
	}

	.title-expanded.enter {
		transform: translateY(0);
		opacity: 1;
		filter: blur(0px);
		pointer-events: auto;
		transition-delay: 70ms;
	}

	/* Slot 3: Action Slot (Chevron <-> Close X) */
	.header-action-slot {
		position: relative;
		display: grid;
		place-items: center;
		width: 26px;
		height: 26px;
		margin-left: auto;
		flex-shrink: 0;
	}

	.action-icon {
		position: absolute;
		display: grid;
		place-items: center;
		inset: 0;
		transition:
			opacity 180ms ease,
			transform 240ms cubic-bezier(0.32, 0.72, 0, 1);
	}

	.icon-chevron {
		opacity: 1;
		transform: rotate(0deg) scale(1);
	}

	.icon-chevron.hidden {
		opacity: 0;
		transform: rotate(90deg) scale(0.6);
		pointer-events: none;
	}

	.close-button {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		width: 26px;
		height: 26px;
		padding: 0;
		border: 0;
		border-radius: 50%;
		background: transparent;
		cursor: pointer;
		opacity: 0;
		transform: rotate(-90deg) scale(0.6);
		pointer-events: none;
		transition:
			opacity 200ms ease 70ms,
			transform 260ms cubic-bezier(0.32, 0.72, 0, 1) 70ms,
			background-color 160ms ease,
			color 160ms ease;
	}

	.close-button.visible {
		opacity: 1;
		transform: rotate(0deg) scale(1);
		pointer-events: auto;
	}

	.tone-primary .close-button {
		color: rgba(9, 9, 9, 0.6);
	}

	.tone-primary .close-button:hover {
		background: rgba(0, 0, 0, 0.08);
		color: #000;
		transform: rotate(90deg) scale(1.08);
	}

	.tone-light .close-button {
		color: rgba(245, 243, 238, 0.6);
	}

	.tone-light .close-button:hover {
		background: rgba(255, 255, 255, 0.12);
		color: #fff;
		transform: rotate(90deg) scale(1.08);
	}

	.close-button:focus-visible {
		outline: 2px solid #47d6ef;
		outline-offset: 2px;
	}

	/* ========================================================
	   CLOSING OVERRIDES FOR HEADER: Clean Snap-Free Retreat
	   ======================================================== */
	.morph-container.is-closing .title-expanded {
		opacity: 0;
		transform: translateY(115%);
		filter: blur(2px);
		transition:
			opacity 100ms ease,
			transform 130ms ease,
			filter 100ms ease;
	}

	.morph-container.is-closing .title-collapsed {
		opacity: 1;
		transform: translateY(0);
		filter: blur(0px);
		transition:
			opacity 160ms ease 70ms,
			transform 200ms cubic-bezier(0.32, 0.72, 0, 1) 70ms,
			filter 160ms ease 70ms;
	}

	.morph-container.is-closing .close-button {
		opacity: 0;
		transform: rotate(-90deg) scale(0.6);
		transition:
			opacity 90ms ease,
			transform 110ms ease;
	}

	.morph-container.is-closing .icon-chevron {
		opacity: 1;
		transform: rotate(0deg) scale(1);
		transition:
			opacity 160ms ease 70ms,
			transform 200ms cubic-bezier(0.32, 0.72, 0, 1) 70ms;
	}

	/* ========================================================
	   DRAWER: Fluid Unfold & Slide
	   ======================================================== */
	.drawer-wrapper {
		width: var(--expanded-width, 340px);
		overflow: hidden;
	}

	.drawer-content {
		display: flex;
		flex-direction: column;
		width: 100%;
		opacity: 0;
		transform: translateY(-8px);
		transition:
			opacity 220ms ease 90ms,
			transform 320ms cubic-bezier(0.32, 0.72, 0, 1) 90ms;
	}

	.is-expanded .drawer-content {
		opacity: 1;
		transform: translateY(0);
	}

	.morph-container.is-closing .drawer-content {
		opacity: 0;
		transform: translateY(-6px);
		transition:
			opacity 110ms ease,
			transform 120ms ease;
	}

	.header-divider {
		height: 1px;
		width: 100%;
		transition: opacity 200ms ease 60ms;
	}

	.tone-primary .header-divider {
		background: rgba(0, 0, 0, 0.08);
	}

	.tone-light .header-divider {
		background: rgba(255, 255, 255, 0.09);
	}

	/* ========================================================
	   PLATFORMS: Staggered Content Animation
	   ======================================================== */
	.platform-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 10px;
		box-sizing: border-box;
	}

	.tile-win,
	.tile-mac {
		opacity: 0;
		transform: translateY(8px) scale(0.98);
		transition:
			opacity 240ms cubic-bezier(0.32, 0.72, 0, 1),
			transform 280ms cubic-bezier(0.32, 0.72, 0, 1),
			background-color 160ms ease,
			border-color 160ms ease,
			box-shadow 160ms ease;
	}

	.is-expanded .tile-win {
		opacity: 1;
		transform: translateY(0) scale(1);
		transition-delay: 100ms;
	}

	.is-expanded .tile-mac {
		opacity: 1;
		transform: translateY(0) scale(1);
		transition-delay: 150ms;
	}

	.morph-container.is-closing .tile-win,
	.morph-container.is-closing .tile-mac {
		opacity: 0;
		transform: translateY(4px) scale(0.98);
		transition:
			opacity 90ms ease,
			transform 110ms ease;
		transition-delay: 0ms;
	}

	.platform-tile {
		display: grid;
		grid-template-columns: 38px minmax(0, 1fr) auto 28px;
		gap: 12px;
		align-items: center;
		min-height: 56px;
		box-sizing: border-box;
		padding: 8px 12px;
		border-radius: 12px;
		text-decoration: none;
		color: inherit;
		transition:
			transform 180ms cubic-bezier(0.32, 0.72, 0, 1),
			background-color 180ms ease,
			border-color 180ms ease,
			box-shadow 180ms ease;
	}

	/* Hardware insets */
	.tone-primary .platform-tile {
		background: #0d0f12;
		color: #f5f3ee;
		border: 1px solid rgba(0, 0, 0, 0.1);
	}

	.tone-primary .platform-tile:hover {
		background: #14171d;
		border-color: #008eb4;
		transform: translateY(-1.5px);
		box-shadow: 0 8px 24px rgba(0, 142, 180, 0.22);
	}

	.tone-light .platform-tile {
		background: rgba(255, 255, 255, 0.045);
		color: #f5f3ee;
		border: 1px solid rgba(255, 255, 255, 0.09);
	}

	.tone-light .platform-tile:hover {
		background: rgba(71, 214, 239, 0.09);
		border-color: #47d6ef;
		transform: translateY(-1.5px);
		box-shadow: 0 8px 24px rgba(71, 214, 239, 0.16);
	}

	.platform-tile:active {
		transform: scale(0.985);
	}

	.platform-tile:focus-visible {
		outline: 2px solid #47d6ef;
		outline-offset: 1px;
	}

	/* Brand icons */
	.brand-icon {
		display: grid;
		place-items: center;
		width: 38px;
		height: 38px;
		border-radius: 9px;
		background: rgba(255, 255, 255, 0.06);
		color: rgba(245, 243, 238, 0.85);
		transition:
			background-color 180ms ease,
			color 180ms ease,
			transform 180ms cubic-bezier(0.32, 0.72, 0, 1);
	}

	.brand-icon svg {
		width: 18px;
		height: 18px;
		fill: currentColor;
	}

	.brand-icon.apple svg {
		width: 19px;
		height: 19px;
	}

	.platform-tile:hover .brand-icon {
		background: #008eb4;
		color: #050505;
		transform: scale(1.05);
	}

	.tone-light .platform-tile:hover .brand-icon {
		background: #47d6ef;
		color: #050505;
	}

	/* Platform copy */
	.platform-meta {
		display: flex;
		flex-direction: column;
		gap: 2px;
		text-align: left;
	}

	.platform-name {
		font-size: 13.5px;
		font-weight: 700;
		letter-spacing: -0.01em;
		color: #f5f3ee;
	}

	.platform-format {
		font-size: 9.5px;
		letter-spacing: 0.03em;
		color: rgba(245, 243, 238, 0.52);
	}

	/* Signal equalizer visualization */
	.signal-visual {
		display: flex;
		align-items: center;
		gap: 2.5px;
		height: 22px;
	}

	.signal-visual i {
		width: 2px;
		height: var(--base-h);
		border-radius: 2px;
		background: rgba(245, 243, 238, 0.32);
		transform-origin: center;
		transition:
			background-color 180ms ease,
			transform 180ms ease;
	}

	.platform-tile:hover .signal-visual i {
		background: #47d6ef;
	}

	.platform-tile:hover .signal-visual i:nth-child(1) {
		animation: pulse-bar 500ms ease infinite 0ms;
	}
	.platform-tile:hover .signal-visual i:nth-child(2) {
		animation: pulse-bar 500ms ease infinite 80ms;
	}
	.platform-tile:hover .signal-visual i:nth-child(3) {
		animation: pulse-bar 500ms ease infinite 160ms;
	}
	.platform-tile:hover .signal-visual i:nth-child(4) {
		animation: pulse-bar 500ms ease infinite 240ms;
	}
	.platform-tile:hover .signal-visual i:nth-child(5) {
		animation: pulse-bar 500ms ease infinite 120ms;
	}
	.platform-tile:hover .signal-visual i:nth-child(6) {
		animation: pulse-bar 500ms ease infinite 40ms;
	}

	@keyframes pulse-bar {
		0%,
		100% {
			transform: scaleY(1);
		}
		50% {
			transform: scaleY(1.4);
		}
	}

	/* Download action icon */
	.download-action-icon {
		display: grid;
		place-items: center;
		width: 28px;
		height: 28px;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.08);
		color: rgba(245, 243, 238, 0.7);
		transition:
			background-color 180ms ease,
			color 180ms ease,
			transform 180ms cubic-bezier(0.32, 0.72, 0, 1);
	}

	.platform-tile:hover .download-action-icon {
		background: rgba(71, 214, 239, 0.2);
		color: #47d6ef;
		transform: translateY(1px);
	}

	/* Small mobile screen refinement (e.g. <= 360px phones) */
	@media (max-width: 360px) {
		.morph-container.is-expanded {
			border-radius: 16px;
		}

		.header-bar {
			padding: 0 12px 0 14px;
		}

		.platform-list {
			padding: 8px;
			gap: 6px;
		}

		.platform-tile {
			grid-template-columns: 32px minmax(0, 1fr) auto 24px;
			gap: 8px;
			padding: 6px 10px;
			min-height: 52px;
		}

		.brand-icon {
			width: 32px;
			height: 32px;
			border-radius: 8px;
		}

		.brand-icon svg {
			width: 15px;
			height: 15px;
		}

		.signal-visual {
			display: none;
		}

		.download-action-icon {
			width: 24px;
			height: 24px;
		}

		.platform-name {
			font-size: 12.5px;
		}

		.platform-format {
			font-size: 8.5px;
		}
	}

	/* Reduced motion accessibility */
	@media (prefers-reduced-motion: reduce) {
		.morph-container,
		.title-slide,
		.action-icon,
		.close-button,
		.drawer-content,
		.tile-win,
		.tile-mac,
		.platform-tile,
		.brand-icon,
		.signal-visual i,
		.download-action-icon {
			transition: none !important;
			animation: none !important;
		}
	}

	.morph-container {
		--menu-bg: var(--green);
		--menu-fg: var(--cream);
		--tile-bg: #ffffff08;
		--tile-hover: #ffffff12;
		--menu-line: #ffffff24;
		--accent: #dfbc73;
		max-width: 100%;
	}
	.morph-container.tone-light {
		--menu-bg: var(--cream);
		--menu-fg: var(--green);
		--tile-bg: #244b3c05;
		--tile-hover: #244b3c0c;
		--menu-line: #244b3c26;
		--accent: #8b6934;
	}
	.morph-container.tone-primary,
	.morph-container.tone-light,
	.morph-container.tone-primary.is-expanded,
	.morph-container.tone-light.is-expanded {
		background: var(--menu-bg);
		color: var(--menu-fg);
		border-color: var(--menu-line);
		box-shadow: 0 5px 20px #244b3c12;
	}
	.morph-container.tone-primary:hover:not(.is-expanded),
	.morph-container.tone-light:hover:not(.is-expanded) {
		background: var(--menu-bg);
		box-shadow: 0 12px 30px #244b3c26;
	}
	.morph-container.tone-primary.is-expanded,
	.morph-container.tone-light.is-expanded {
		box-shadow: 0 20px 45px #244b3c26;
	}
	.title-slide {
		width: max-content;
		line-height: 27px;
	}
	.header-bar {
		color: inherit;
	}
	.header-bar:focus-visible {
		outline-offset: -5px;
	}
	.tone-primary .close-button,
	.tone-light .close-button {
		color: inherit;
	}
	.tone-primary .close-button:hover,
	.tone-light .close-button:hover {
		background: var(--tile-hover);
		color: var(--accent);
	}
	.tone-primary .header-divider,
	.tone-light .header-divider {
		background: var(--menu-line);
	}
	.tone-primary .platform-tile,
	.tone-light .platform-tile {
		background: var(--tile-bg);
		color: var(--menu-fg);
		border-color: var(--menu-line);
	}
	.tone-primary .platform-tile:hover,
	.tone-light .platform-tile:hover {
		background: var(--tile-hover);
		border-color: var(--accent);
		box-shadow: 0 8px 24px #244b3c12;
	}
	.brand-icon,
	.download-action-icon {
		background: var(--tile-hover);
		color: inherit;
	}
	.brand-icon svg {
		fill: none;
		stroke: currentColor;
		stroke-width: 1.7;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.platform-tile:hover .brand-icon,
	.tone-light .platform-tile:hover .brand-icon {
		background: var(--accent);
		color: var(--green);
	}
	.platform-name {
		color: inherit;
		line-height: 1.7;
	}
	.platform-format {
		color: inherit;
		opacity: 0.72;
		line-height: 1.7;
	}
	.signal-visual i {
		background: currentColor;
		opacity: 0.32;
	}
	.platform-tile:hover .signal-visual i {
		background: var(--accent);
		opacity: 1;
	}
	.platform-tile:hover .download-action-icon {
		background: var(--tile-hover);
		color: var(--accent);
	}
	@media (max-width: 360px) {
		.platform-tile {
			grid-template-columns: 32px minmax(0, 1fr) 24px;
		}
	}
</style>
