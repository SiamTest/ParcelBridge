<script lang="ts">
	import { onMount } from 'svelte';
	import { slide } from 'svelte/transition';
	import { inview } from '$lib/actions/inview';
	import { site, events } from '$lib/site';
	import Mark from '$lib/components/Mark.svelte';
	import Garden from '$lib/components/Garden.svelte';
	import JoinMenu from '$lib/components/JoinMenu.svelte';
	import CreativeCorner from '$lib/components/CreativeCorner.svelte';
	import ArrowUpRight from 'lucide-svelte/icons/arrow-up-right';
	import ArrowRight from 'lucide-svelte/icons/arrow-right';
	import MapPin from 'lucide-svelte/icons/map-pin';
	import BookOpen from 'lucide-svelte/icons/book-open';
	import Music from 'lucide-svelte/icons/music';
	import Palette from 'lucide-svelte/icons/palette';
	import Menu from 'lucide-svelte/icons/menu';
	import X from 'lucide-svelte/icons/x';
	import Mail from 'lucide-svelte/icons/mail';
	import Phone from 'lucide-svelte/icons/phone';
	let scrolled = $state(false);
	let menuOpen = $state(false);
	let reduced = $state(false);
	let menuButton: HTMLButtonElement;
	let aboutVisible = $state(false);
	let activitiesVisible = $state(false);
	let studioVisible = $state(false);
	let noticeVisible = $state(false);
	let contactVisible = $state(false);
	const navigation = [
		{ id: 'about', name: 'আমাদের কথা' },
		{ id: 'activities', name: 'কার্যক্রম' },
		{ id: 'creative', name: 'সৃজনশালা' },
		{ id: 'notice', name: 'নোটিশ' }
	];
	const activities = [
		{
			icon: BookOpen,
			number: '০১',
			title: 'সাহিত্যের আঙিনায়',
			text: 'পড়ার আনন্দ, গল্পের জগৎ আর নিজের ভাষায় মনের কথা—সাহিত্যের পথে ছোট ছোট পা।',
			tags: ['পাঠচর্চা', 'গল্প ও কবিতা'],
			className: 'literature'
		},
		{
			icon: Music,
			number: '০২',
			title: 'সুরে ও ছন্দে',
			text: 'গান, আবৃত্তি আর মঞ্চের আলোয় প্রকাশ পাক শিশু-কিশোরের আত্মবিশ্বাস ও সৃজনশীলতা।',
			tags: ['আবৃত্তি', 'সংস্কৃতিচর্চা'],
			className: 'music'
		},
		{
			icon: Palette,
			number: '০৩',
			title: 'কল্পনার রঙে',
			text: 'কাগজে আঁকা একটি রেখা থেকে নতুন ভাবনা। রং আর কল্পনায় নিজের পৃথিবী গড়ে নেওয়া।',
			tags: ['চিত্রচর্চা', 'সৃজনশীল ভাবনা'],
			className: 'art'
		}
	];
	const faqs = [
		{
			q: 'অংকুর কোথায়?',
			a: 'অংকুরের অবস্থান ফেনী সদর, ফেনী, চট্টগ্রাম বিভাগ। নির্দিষ্ট ঠিকানা ও যাতায়াতের বিস্তারিত জানতে সংগঠনের সাথে যোগাযোগ করুন।'
		},
		{
			q: 'কীভাবে যুক্ত হতে পারি?',
			a: 'শিশু-কিশোরদের অংশগ্রহণ সম্পর্কে জানতে অভিভাবক সংগঠনের সাথে যোগাযোগ করতে পারেন। সদস্য হওয়ার নিয়ম ও সময়সূচি সংগঠন জানাবে।'
		},
		{
			q: 'পরবর্তী আয়োজনের খবর কোথায় পাব?',
			a: 'নতুন আয়োজনের নিশ্চিত তথ্য এই ওয়েবসাইটের নোটিশ অংশে প্রকাশ করা হবে।'
		},
		{
			q: 'সৃজনশালার লেখা কি জমা হচ্ছে?',
			a: 'সৃজনশালা অনুশীলনের জন্য। লেখা বা ছবি সংগঠনের কাছে পাঠানো হয় না। খসড়া রাখলে লেখা শুধু আপনার এই ব্রাউজারে থাকে; চাইলে ফাইল হিসেবে ডাউনলোড করতে পারবেন।'
		}
	];
	onMount(() => {
		document.documentElement.classList.add('js');
		scrolled = window.scrollY > 24;
		reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
	});
	function closeMenu() {
		menuOpen = false;
		menuButton?.focus();
	}
	function dateLabel(date: string) {
		return new Intl.DateTimeFormat('bn-BD', { dateStyle: 'long', timeZone: 'Asia/Dhaka' }).format(
			new Date(`${date}T00:00:00+06:00`)
		);
	}
</script>

<svelte:head>
	<title>{site.name} | শিশু-কিশোরের সাহিত্য ও সংস্কৃতির আঙিনা</title>
	<meta
		name="description"
		content={`${site.fullName}। ${site.location}। সাহিত্য, সংস্কৃতি ও সৃজনশীলতার পথে শিশু-কিশোরদের একটি পরিচিতি।`}
	/>
	<meta name="theme-color" content="#244b3c" />
	<meta property="og:type" content="website" /><meta property="og:locale" content="bn_BD" /><meta
		property="og:site_name"
		content={site.fullName}
	/><meta property="og:title" content="অংকুর — ছোট্ট অংকুর, বড় স্বপ্ন" /><meta
		property="og:description"
		content={`শিশু-কিশোরের সাহিত্য ও সংস্কৃতির আঙিনা। ${site.location}।`}
	/>
	{#if site.url}<link rel="canonical" href={site.url} /><meta
			property="og:url"
			content={site.url}
		/><meta property="og:image" content={`${site.url.replace(/\/$/, '')}/ankur-preview.png`} />{/if}
	<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
</svelte:head>
<svelte:window
	onscroll={() => (scrolled = window.scrollY > 24)}
	onkeydown={(e) => {
		if (menuOpen && e.key === 'Escape') closeMenu();
	}}
/>
<a href="#main" class="skip-link">মূল বিষয়ে যান</a>
<div class="site-shell" id="top">
	<div class="nav-wrap" class:scrolled>
		<header class="nav-shell">
			<a class="brand" href="#top" aria-label="অংকুরের প্রথম পাতা"
				><Mark /><span>অংকুর<small>সাহিত্য · সংস্কৃতি · স্বপ্ন</small></span></a
			>
			<nav class="desktop-nav" aria-label="প্রধান নেভিগেশন">
				{#each navigation as item (item.id)}<a href={`#${item.id}`}>{item.name}</a>{/each}
			</nav>
			<a class="nav-cta" href="#contact">যোগাযোগ <ArrowUpRight size={16} /></a>
			<button
				bind:this={menuButton}
				class="menu-button"
				type="button"
				aria-label={menuOpen ? 'মেনু বন্ধ করুন' : 'মেনু খুলুন'}
				aria-expanded={menuOpen}
				aria-controls="mobile-nav"
				onclick={() => (menuOpen = !menuOpen)}
				>{#if menuOpen}<X size={22} />{:else}<Menu size={22} />{/if}</button
			>
		</header>
		{#if menuOpen}<nav
				id="mobile-nav"
				class="mobile-nav"
				aria-label="মোবাইল নেভিগেশন"
				transition:slide={{ duration: reduced ? 0 : 250 }}
			>
				{#each navigation as item (item.id)}<a
						href={`#${item.id}`}
						onclick={() => (menuOpen = false)}>{item.name}<ArrowUpRight size={16} /></a
					>{/each}<a href="#contact" onclick={() => (menuOpen = false)}
					>যোগাযোগ<ArrowUpRight size={16} /></a
				>
			</nav>{/if}
	</div>
	<main id="main">
		<section class="hero container" aria-labelledby="hero-title">
			<div class="hero-atmosphere" aria-hidden="true"></div>
			<div class="hero-copy">
				<p class="eyebrow"><span></span> ফেনী থেকে, নতুন স্বপ্নের পথে</p>
				<h1 id="hero-title">
					ছোট্ট <span class="handwritten">অংকুর,</span><br />বড়
					<span class="dream"
						>স্বপ্ন।<svg viewBox="0 0 210 18" aria-hidden="true"
							><path d="M3 10Q103-4 207 9M25 16q81-8 161-3" /></svg
						></span
					>
				</h1>
				<p class="hero-description">{site.fullName}</p>
				<p class="hero-subtitle">
					বইয়ের পাতায়, সুরের ছন্দে, কল্পনার রঙে—<br class="desktop-break" />বেড়ে উঠুক আগামী দিনের
					সৃজনশীল মন।
				</p>
				<div class="hero-actions">
					<JoinMenu /><a class="text-action" href="#activities"
						>আমাদের আঙিনা <ArrowRight size={18} /></a
					>
				</div>
				<div class="location-note"><MapPin size={16} /><span>{site.location}</span></div>
			</div>
			<div class="hero-art">
				<div class="art-label">কল্পনায় ডানা মেলুক</div>
				<Garden />
				<div class="floating-tag"><span>✦</span> শেখা হোক আনন্দে</div>
				<div class="art-caption">
					<span>একটি বই। একটি ভাবনা।</span><span>একটি নতুন পৃথিবী।</span>
				</div>
			</div>
			<a href="#about" class="scroll-note"><span></span> আরও একটু এগিয়ে যাই</a>
		</section>
		<div class="signal-strip" aria-label="আমাদের ভাবনা">
			<div class="signal-line" aria-hidden="true">
				{#each [5, 12, 18, 10, 22, 14, 27, 18, 12, 22, 8, 18, 25, 13, 7] as height, index (index)}<i
						style={`height:${height}px`}
					></i>{/each}
			</div>
			<span>পড়ি</span><b>✦</b><span>ভাবি</span><b>✦</b><span>সৃষ্টি করি</span><b>✦</b><span
				>একসাথে বেড়ে উঠি</span
			>
		</div>
		<section
			class="about-section container"
			id="about"
			use:inview={{ threshold: 0.12, onEnter: () => (aboutVisible = true) }}
		>
			<div class="section-heading reveal" class:visible={aboutVisible}>
				<p class="eyebrow">আমাদের কথা / ০১</p>
				<h2>প্রতিটি শিশুর ভেতরেই<br />একটি <em>সম্ভাবনার বীজ।</em></h2>
			</div>
			<div class="about-copy reveal reveal-delay" class:visible={aboutVisible}>
				<p class="lead">অংকুর—শিশু-কিশোরের সাহিত্য ও সংস্কৃতির একটি আঙিনা।</p>
				<p>
					ফেনীর মাটিতে শিশু-কিশোরের কল্পনা, ভাষা ও সৃজনশীলতাকে ঘিরে আমাদের পরিচয়। একটি গল্প, একটি
					কবিতা কিংবা একটি ছবি—প্রকাশের প্রতিটি পথেই লুকিয়ে থাকে নতুন কিছু শেখার আনন্দ।
				</p>
				<div class="about-note">
					<span>✳</span>
					<p>শেকড় থাকুক নিজের সংস্কৃতিতে,<br />স্বপ্ন ছড়িয়ে যাক দিগন্তে।</p>
				</div>
			</div>
		</section>
		<section
			class="activities-section"
			id="activities"
			use:inview={{ threshold: 0.08, onEnter: () => (activitiesVisible = true) }}
		>
			<div class="container">
				<div class="section-heading horizontal reveal" class:visible={activitiesVisible}>
					<div>
						<p class="eyebrow">আমাদের আঙিনা / ০২</p>
						<h2>আনন্দে শেখা,<br /><em>নিজেকে প্রকাশ করা।</em></h2>
					</div>
					<p class="section-intro">
						সাহিত্য, সংস্কৃতি আর সৃজনশীলতার<br />তিনটি দরজা—এক পৃথিবী সম্ভাবনা।
					</p>
				</div>
				<div class="activity-grid reveal reveal-delay" class:visible={activitiesVisible}>
					{#each activities as activity (activity.number)}<article
							class="activity-card {activity.className}"
						>
							<div class="card-top">
								<span>{activity.number}</span><activity.icon size={23} strokeWidth={1.5} />
							</div>
							<div class="activity-art" aria-hidden="true">
								{#if activity.className === 'literature'}<div class="book-visual">
										<div class="book-page left-page"><i></i><i></i><i></i><b>অ আ</b></div>
										<div class="book-page right-page"><span>✦</span><i></i><i></i></div>
									</div>{:else if activity.className === 'music'}<div class="music-visual">
										<span>♪</span>
										<div class="wave-bars">
											{#each [25, 42, 64, 38, 82, 52, 95, 62, 42, 78, 54, 90, 70, 44, 82, 58, 30, 68, 48, 88] as height, index (index)}<i
													style={`--height:${height}%;--delay:${index * 60}ms`}
												></i>{/each}
										</div>
									</div>{:else}<div class="art-visual">
										<div></div>
										<div></div>
										<div></div>
										<span>✳</span>
									</div>{/if}
							</div>
							<h3>{activity.title}</h3>
							<p>{activity.text}</p>
							<div class="card-tags">
								{#each activity.tags as tag (tag)}<span>{tag}</span>{/each}
							</div>
						</article>{/each}
				</div>
			</div>
		</section>
		<section
			class="creative-section container"
			id="creative"
			use:inview={{ threshold: 0.08, onEnter: () => (studioVisible = true) }}
		>
			<div class="creative-copy reveal" class:visible={studioVisible}>
				<p class="eyebrow">ছোট্ট সৃজনশালা / ০৩</p>
				<h2>আজ একটু<br /><em>সৃষ্টি হোক।</em></h2>
				<p>শুরু করতে বড় কিছু লাগে না।<br />একটি শব্দ, একটি সুর, একটি রঙই যথেষ্ট।</p>
				<ol class="workflow-list">
					<li>
						<span>০১</span>
						<div><strong>ভাবনা বেছে নাও</strong><small>কবিতা, সুর কিংবা রঙ</small></div>
					</li>
					<li>
						<span>০২</span>
						<div><strong>মনের মতো করে দেখো</strong><small>এখানে ভুল করার ভয় নেই</small></div>
					</li>
					<li>
						<span>০৩</span>
						<div><strong>নিজের সৃষ্টি রাখো</strong><small>লেখা ও ছবি ডাউনলোড করা যায়</small></div>
					</li>
				</ol>
			</div>
			<div class="studio-wrap reveal reveal-delay" class:visible={studioVisible}>
				<CreativeCorner />
				<p class="privacy-note">অনুশীলনের জায়গা। কোনো লেখা বা ছবি অনলাইনে জমা হয় না।</p>
			</div>
		</section>
		<section
			class="notice-section"
			id="notice"
			use:inview={{ threshold: 0.1, onEnter: () => (noticeVisible = true) }}
		>
			<div class="notice-grid reveal container" class:visible={noticeVisible}>
				<div class="section-heading">
					<p class="eyebrow">নোটিশ ও আয়োজন / ০৪</p>
					<h2>আবার দেখা হবে,<br /><em>নতুন কোনো আয়োজনে।</em></h2>
					<p class="section-intro">অংকুরের নতুন খবর এখানেই পাবেন।</p>
				</div>
				<div class="notice-board">
					{#if events.length}{#each events as event (event.date + event.title)}<article
								class="event"
							>
								<time datetime={event.date}>{dateLabel(event.date)}</time>
								<h3>{event.title}</h3>
								<p>{event.description}</p>
								<small><MapPin size={14} />{event.location}</small>
							</article>{/each}{:else}<div class="notice-icon" aria-hidden="true">
							<BookOpen size={32} strokeWidth={1.3} />
						</div>
						<span class="notice-chip">নতুন খবরের অপেক্ষায়</span>
						<h3>পরবর্তী আয়োজনের তথ্য<br />শিগগিরই জানানো হবে।</h3>
						<p>সময়, স্থান ও অংশগ্রহণের বিস্তারিত<br />নিশ্চিত হলে এখানে প্রকাশ করা হবে।</p>
						<a href="#contact" class="text-action">যোগাযোগের তথ্য <ArrowUpRight size={17} /></a
						>{/if}
				</div>
			</div>
		</section>
		<section class="faq-section container">
			<div class="section-heading">
				<p class="eyebrow">কিছু পরিচিত প্রশ্ন</p>
				<h2>জানতে চান?</h2>
			</div>
			<div class="faq-list">
				{#each faqs as faq (faq.q)}<details>
						<summary>{faq.q}<span aria-hidden="true">+</span></summary>
						<p>{faq.a}</p>
					</details>{/each}
			</div>
		</section>
		<section
			class="contact-section"
			id="contact"
			use:inview={{ threshold: 0.1, onEnter: () => (contactVisible = true) }}
		>
			<div class="contact-grid reveal container" class:visible={contactVisible}>
				<div>
					<p class="eyebrow">একসাথে বেড়ে ওঠার আমন্ত্রণ</p>
					<h2>আসুন,<br /><em>স্বপ্নের পাশে দাঁড়াই।</em></h2>
					<p>শিশু-কিশোর, অভিভাবক ও শুভাকাঙ্ক্ষী—<br />অংকুরের পথচলায় আপনাকে স্বাগতম।</p>
					<JoinMenu light />
				</div>
				<div class="contact-card">
					<Mark size={44} />
					<h3>{site.fullName}</h3>
					<!-- eslint-disable svelte/no-navigation-without-resolve -- Public external contact URLs. -->
					<a class="contact-row" href={site.mapUrl} target="_blank" rel="noreferrer"
						><MapPin size={19} /><span>{site.location}<small>মানচিত্রে ফেনী সদর দেখুন</small></span
						><ArrowUpRight size={17} /></a
					>{#if site.email}<a class="contact-row" href={`mailto:${site.email}`}
							><Mail size={19} /><span>{site.email}</span></a
						>{/if}{#if site.phone}<a class="contact-row" href={`tel:${site.phone}`}
							><Phone size={19} /><span>{site.phone}</span></a
						>{/if}{#if site.facebook}<a
							class="contact-row"
							href={site.facebook}
							target="_blank"
							rel="noreferrer"><span>অফিশিয়াল ফেসবুক পেজ</span><ArrowUpRight size={18} /></a
						>{/if}{#if !site.email && !site.phone && !site.facebook}<p class="contact-pending">
							সরাসরি যোগাযোগের তথ্য শিগগিরই যুক্ত হবে।
						</p>{/if}
				</div>
			</div>
			<!-- eslint-enable svelte/no-navigation-without-resolve -->
			<div class="contact-signal" aria-hidden="true">
				{#each [15, 25, 40, 20, 60, 30, 80, 45, 25, 70, 35, 90, 50, 30, 65, 40, 85, 20, 50, 75, 35, 55, 90, 40, 65, 30, 80, 50, 35, 70, 25, 55] as height, index (index)}<i
						style={`height:${height}px`}
					></i>{/each}
			</div>
		</section>
	</main>
	<footer class="container">
		<a class="brand" href="#top"
			><Mark size={32} /><span>অংকুর<small>ছোট্ট অংকুর, বড় স্বপ্ন।</small></span></a
		>
		<p>শিশু-কিশোরের সাহিত্য ও সংস্কৃতির আঙিনা</p>
		<a class="footer-top" href="#top">উপরে ফিরুন ↑</a><small
			>© {new Date().getUTCFullYear()} অংকুর</small
		>
	</footer>
</div>
