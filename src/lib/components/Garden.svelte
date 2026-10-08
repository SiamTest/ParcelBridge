<svg
	class="garden"
	viewBox="0 0 580 550"
	fill="none"
	role="img"
	aria-label="খোলা বই থেকে অঙ্কুরিত গাছ, রোদ ও পাখির অলংকরণ"
>
	<defs
		><linearGradient id="paper" x1="85" y1="370" x2="490" y2="450" gradientUnits="userSpaceOnUse"
			><stop stop-color="#fffdf3" /><stop offset="1" stop-color="#eadfbf" /></linearGradient
		></defs
	>
	<circle cx="300" cy="267" r="213" fill="#e3e8d5" />
	<circle cx="407" cy="130" r="57" fill="#e6b963" />
	<g class="sun-rays" stroke="#c9a250" stroke-width="2"
		><path
			d="M407 56V41m53 36 10-10m14 63h16m-30 53 10 10m-73 11v15m-53-36-10 10m-13-63h-15m38-53-10-10"
		/></g
	>
	<g class="bird" stroke="#315e4b" stroke-width="3" stroke-linecap="round"
		><path d="M94 156q12-16 25 0 12-16 25 0M137 116q8-10 16 0 8-10 16 0" /></g
	>
	<path d="M65 475q225-50 447 0" stroke="#c0ceb4" stroke-width="2" />
	<ellipse cx="286" cy="450" rx="190" ry="25" fill="#244b3c" opacity=".1" />
	<path d="m88 366 197 36 194-36 28 61-222 54-223-54z" fill="#295642" />
	<path
		d="M86 352q95-9 199 40 93-50 196-40l-5 70q-103-8-191 39-103-49-203-39z"
		fill="url(#paper)"
	/>
	<path d="M285 392v69" stroke="#cec5a6" stroke-width="2" />
	<g stroke="#cdc4a7" stroke-width="2" stroke-linecap="round"
		><path
			d="m112 377 118 26m-120-10 132 28m-132-11 106 23m110-31 120-26m-120 44 122-26m-122 43 104-23"
		/></g
	>
	<g class="plant"
		><path
			d="M285 393c0-98-4-166 27-242"
			stroke="#315e4b"
			stroke-width="7"
			stroke-linecap="round"
		/>
		<path d="M290 327C222 339 183 292 178 252c71-9 113 24 112 75Z" fill="#769675" />
		<path d="M290 290c71 12 119-27 125-78-73-7-112 29-125 78Z" fill="#315e4b" />
		<path d="M295 245c-57-2-86-42-88-85 63 1 88 38 88 85Z" fill="#4f795d" />
		<path d="M308 187c51 3 88-33 88-74-54 4-81 35-88 74Z" fill="#91ab72" />
		<g stroke="#e3e8d5" stroke-width="1.5" opacity=".6"
			><path d="m289 326-83-54m86 16 96-57m-92 11-66-60m78 3 63-56" /></g
		></g
	>
	<g fill="#b57c51"
		><circle cx="124" cy="302" r="5" /><circle cx="447" cy="333" r="4" /><circle
			cx="183"
			cy="87"
			r="3"
		/></g
	>
	<g stroke="#b57c51" stroke-width="2"><path d="M446 264v20m-10-10h20M138 220v14m-7-7h14" /></g>
</svg>

<style>
	.garden {
		width: 100%;
		height: auto;
		overflow: visible;
	}
	.plant {
		transform-origin: 285px 390px;
		animation: sway 7s ease-in-out infinite;
	}
	.bird {
		animation: bird 8s ease-in-out infinite;
	}
	.sun-rays {
		transform-origin: 407px 130px;
		animation: turn 70s linear infinite;
	}
	@keyframes sway {
		50% {
			transform: rotate(2deg);
		}
	}
	@keyframes bird {
		50% {
			transform: translate(6px, -4px);
		}
	}
	@keyframes turn {
		to {
			transform: rotate(360deg);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.plant,
		.bird,
		.sun-rays {
			animation: none;
		}
	}
</style>
