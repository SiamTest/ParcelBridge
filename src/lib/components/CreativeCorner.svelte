<script lang="ts">
	import { onMount } from 'svelte';
	import Download from 'lucide-svelte/icons/download';
	import RefreshCw from 'lucide-svelte/icons/refresh-cw';
	let tab = $state('কবিতা');
	let poem = $state('');
	let message = $state('');
	let promptIndex = $state(0);
	let color = $state('#315e4b');
	let drawing: HTMLCanvasElement;
	let last: { x: number; y: number } | null = null;
	let volume = $state(0.25);
	let activeNote = $state(-1);
	let audio: AudioContext | undefined;
	let noteTimer: ReturnType<typeof setTimeout>;
	const prompts = [
		'আমার জানালার পাশে একটি ছোট্ট গাছ…',
		'ফেনীর আকাশে আজ মেঘের খেলা…',
		'বইয়ের পাতায় একটি নতুন সকাল…',
		'একটি পাখি আমাকে বলল…'
	];
	const colors = ['#315e4b', '#ce8753', '#d4ac4b', '#688baa', '#b56e7d'];
	const notes = ['সা', 'রে', 'গা', 'মা', 'পা', 'ধা', 'নি'];
	onMount(() => {
		try {
			poem = localStorage.getItem('ankur-poem') ?? '';
		} catch {
			/* Private browsing: editing still works. */
		}
		return () => {
			clearTimeout(noteTimer);
			void audio?.close();
		};
	});
	function savePoem() {
		try {
			localStorage.setItem('ankur-poem', poem);
			message = 'এই ব্রাউজারে খসড়া রাখা হয়েছে।';
		} catch {
			message = 'খসড়া রাখা যায়নি। ফাইল হিসেবে সংরক্ষণ করুন।';
		}
	}
	function download(data: string, name: string) {
		const a = document.createElement('a');
		a.href = data;
		a.download = name;
		a.click();
	}
	function exportPoem() {
		const url = URL.createObjectURL(new Blob([poem], { type: 'text/plain;charset=utf-8' }));
		download(url, 'ankur-kobita.txt');
		setTimeout(() => URL.revokeObjectURL(url), 1000);
	}
	function point(e: PointerEvent) {
		const rect = drawing.getBoundingClientRect();
		return {
			x: ((e.clientX - rect.left) * drawing.width) / rect.width,
			y: ((e.clientY - rect.top) * drawing.height) / rect.height
		};
	}
	function start(e: PointerEvent) {
		if (e.button !== 0) return;
		drawing.setPointerCapture(e.pointerId);
		last = point(e);
		draw(e);
	}
	function draw(e: PointerEvent) {
		if (!last) return;
		const next = point(e);
		const ctx = drawing.getContext('2d');
		if (ctx) {
			ctx.strokeStyle = color;
			ctx.lineWidth = 7;
			ctx.lineCap = 'round';
			ctx.beginPath();
			ctx.moveTo(last.x, last.y);
			ctx.lineTo(next.x + 0.01, next.y + 0.01);
			ctx.stroke();
		}
		last = next;
	}
	function clear() {
		drawing.getContext('2d')?.clearRect(0, 0, drawing.width, drawing.height);
	}
	function stamp() {
		const ctx = drawing.getContext('2d');
		if (!ctx) return;
		ctx.fillStyle = color;
		ctx.beginPath();
		ctx.arc(70 + Math.random() * 470, 60 + Math.random() * 180, 24, 0, Math.PI * 2);
		ctx.fill();
	}
	function exportDrawing() {
		const out = document.createElement('canvas');
		out.width = drawing.width;
		out.height = drawing.height;
		const ctx = out.getContext('2d');
		if (!ctx) return;
		ctx.fillStyle = '#fffcf5';
		ctx.fillRect(0, 0, out.width, out.height);
		ctx.drawImage(drawing, 0, 0);
		download(out.toDataURL('image/png'), 'ankur-rong.png');
	}
	async function play(index: number) {
		try {
			audio ??= new AudioContext();
			await audio.resume();
			const osc = audio.createOscillator();
			const gain = audio.createGain();
			const now = audio.currentTime;
			osc.frequency.value = [261.63, 293.66, 329.63, 349.23, 392, 440, 493.88][index];
			osc.type = 'sine';
			gain.gain.setValueAtTime(0, now);
			gain.gain.linearRampToValueAtTime(volume, now + 0.02);
			gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
			osc.connect(gain);
			gain.connect(audio.destination);
			osc.start(now);
			osc.stop(now + 0.6);
			activeNote = index;
			clearTimeout(noteTimer);
			noteTimer = setTimeout(() => (activeNote = -1), 600);
		} catch {
			message = 'এই ব্রাউজারে সুর চালানো যাচ্ছে না।';
		}
	}
</script>

<div class="creative-card">
	<div class="studio-top"><span><i></i> ছোট্ট সৃজনশালা</span><small>তোমার কল্পনার খাতা</small></div>
	<div class="studio-tabs" aria-label="সৃজনশীল মাধ্যম">
		{#each ['কবিতা', 'সুর', 'রং'] as name (name)}<button
				type="button"
				class:active={tab === name}
				aria-pressed={tab === name}
				onclick={() => {
					tab = name;
					message = '';
				}}>{name}</button
			>{/each}
	</div>
	<div hidden={tab !== 'কবিতা'} class="studio-body">
		<div class="prompt">
			<span>{prompts[promptIndex]}</span><button
				type="button"
				aria-label="নতুন লেখার ভাবনা"
				onclick={() => (promptIndex = (promptIndex + 1) % prompts.length)}
				><RefreshCw size={16} /></button
			>
		</div>
		<label class="sr-only" for="poem">তোমার কবিতা</label><textarea
			id="poem"
			bind:value={poem}
			maxlength="5000"
			placeholder="এখান থেকেই শুরু হোক তোমার গল্প…"
			spellcheck="false"></textarea>
		<div class="studio-bottom">
			<small>নিজের লেখা • সর্বোচ্চ ৫০০০ অক্ষর</small>
			<div>
				<button type="button" onclick={savePoem}>খসড়া রাখো</button><button
					type="button"
					aria-label="কবিতা ডাউনলোড"
					disabled={!poem.trim()}
					onclick={exportPoem}><Download size={16} /></button
				>
			</div>
		</div>
	</div>
	<div hidden={tab !== 'সুর'} class="studio-body music-body">
		<p>একটি সুর ছুঁয়ে দেখো</p>
		<div class="notes">
			{#each notes as note, index (index)}<button
					type="button"
					class:playing={activeNote === index}
					onclick={() => play(index)}
					aria-label={`${note} বাজাও`}>{note}</button
				>{/each}
		</div>
		<div class="equalizer" aria-hidden="true" class:playing={activeNote >= 0}>
			{#each [22, 38, 56, 30, 72, 46, 84, 52, 66, 34, 92, 62, 42, 78, 54, 96, 70, 44, 82, 58, 30, 68, 48, 88] as height, index (index)}<i
					style={`--height:${height}%;--delay:${index * 40}ms`}
				></i>{/each}
		</div>
		<label class="volume"
			>শব্দের মাত্রা <input
				type="range"
				min="0.05"
				max="0.4"
				step="0.01"
				bind:value={volume}
			/></label
		><small>বোতাম ছুঁলেই সুর বাজবে।</small>
	</div>
	<div hidden={tab !== 'রং'} class="studio-body drawing-body">
		<div class="palette" aria-label="রঙ বেছে নাও">
			{#each colors as shade, index (index)}<button
					type="button"
					class:selected={color === shade}
					style:background={shade}
					aria-label={['সবুজ', 'কমলা', 'হলুদ', 'নীল', 'গোলাপি'][index]}
					aria-pressed={color === shade}
					onclick={() => (color = shade)}
				></button>{/each}<span>আঙুল বা মাউস দিয়ে আঁকো</span>
		</div>
		<canvas
			width="640"
			height="280"
			bind:this={drawing}
			onpointerdown={start}
			onpointermove={draw}
			onpointerup={() => (last = null)}
			onpointercancel={() => (last = null)}
			aria-label="ছবি আঁকার জায়গা; কিবোর্ডে আঁকতে নিচের রঙের ছাপ বোতাম ব্যবহার করুন"
		></canvas>
		<div class="studio-bottom">
			<button type="button" onclick={stamp}>রঙের ছাপ</button>
			<div>
				<button type="button" onclick={clear}>মুছে ফেলো</button><button
					type="button"
					aria-label="ছবি ডাউনলোড"
					onclick={exportDrawing}><Download size={16} /></button
				>
			</div>
		</div>
	</div>
	<p class="studio-message" aria-live="polite">{message}</p>
</div>
