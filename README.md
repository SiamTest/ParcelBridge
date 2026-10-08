# অংকুর Website · 1.0.2

A Bengali website for **অংকুর শিশু - কিশোর সাহিত্য সংস্কৃতিক সংসদ**, located in **Feni Sadar, Feni, Chattogram Division**.

An original green-and-cream design adapted from the attached SoundDesigner website. It preserves the source's hero entrances, ambient visual treatment, scroll reveals, animated signal bars, card hover effects and expanding-button transitions. The Adobe demo and installer links have been replaced with an interactive poetry/music/drawing corner and organization navigation.

## Hero navigation animation

The top navigation now animates from its wide initial layout into a narrower floating pill on scroll, then expands again when you return to the top. Width, padding, corner shape, background and shadow transition together. The same effect remains visible on phones and respects reduced-motion preferences.

## Expanding join buttons

Both the hero and footer use the SoundDesigner animation: synchronized 400ms width and height expansion, rolling/blurred title, chevron-to-close rotation, staggered tiles, hover signals, and a faster 280ms retreat. Escape, outside clicks and link selection close it. Menu sizing follows the available container width, and reduced motion is respected.

## Run locally

Requires Node.js 24 and npm.

```sh
npm ci
npm run dev
```

Before release:

```sh
npm run check
npm run lint
npm test
npm run build
npm run preview
```

`build/` is the complete static website. It has no database or server-side account system.

## Publish through GitHub Actions → Cloudflare

1. Extract this ZIP. Upload **the contents of `Ankur-Website/` to the root of a GitHub repository**, including `.github/workflows/deploy.yml`, `package-lock.json` and `wrangler.jsonc`. Do not put the whole project inside another directory.
2. In Cloudflare, open your profile → **API Tokens** → **Create Token**. Use the **Edit Cloudflare Workers** template, scoped to the target account. Copy the token. Find your **Account ID** in the Cloudflare dashboard.
3. In the GitHub repository, open **Settings → Secrets and variables → Actions → Secrets** and add:

   | Secret                  | Value                      |
   | ----------------------- | -------------------------- |
   | `CLOUDFLARE_API_TOKEN`  | Cloudflare API token       |
   | `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare Account ID |

4. Optional: under **Variables**, add `CLOUDFLARE_WORKER_NAME` (default: `ankur-website`). Use lowercase letters, digits and hyphens, up to 63 characters.
5. Push to `main` or `master`, or open **Actions → Check and deploy to Cloudflare → Run workflow** on either branch. The optional `worker_name` input overrides the saved variable for that run.
6. Checks run before publication. Pull requests run checks/build only. Wrangler creates or updates the Worker and prints the deployed `workers.dev` URL in the deployment log. If the account requires a workers.dev subdomain, choose it in Cloudflare's Workers & Pages settings first.
7. To connect your own domain, open the deployed Worker in Cloudflare → **Settings → Domains & Routes → Add → Custom Domain**. The domain must be in the relevant Cloudflare account.

Manual deployment is also available with `npm run deploy` after configuring Wrangler authentication.

References: [Cloudflare GitHub Actions](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/) · [Worker static assets](https://developers.cloudflare.com/workers/static-assets/) · [SvelteKit static adapter](https://svelte.dev/docs/kit/adapter-static).

## Fill in the real organization information

Edit **`src/lib/site.ts`**:

- `email`, `phone`, `facebook`: leave blank until official public contacts are confirmed. Filled fields appear automatically; blank fields do not create broken buttons.
- `url`: set the final `https://` website URL after deployment, then push again. This enables the canonical URL and social share image metadata.
- `mapUrl`: currently shows the Feni Sadar area; update it to the exact premises once confirmed.
- `events`: add verified announcements with dates in `YYYY-MM-DD` format. The website formats dates for Bangladesh. An empty array shows an honest “new announcements coming” state.

Example event:

```ts
export const events: Event[] = [
	{
		title: 'Your confirmed event title',
		date: '2026-11-01', // Example only — replace with a confirmed date.
		location: 'Confirmed venue',
		description: 'Confirmed event details'
	}
];
```

The supplied Bengali organization name is kept as provided. Descriptions of literature, music and art are introductory themes, not claims about a verified class schedule. No founding date, membership count, team names, fake photos, exact address or invented contact information is included. The book-and-sprout emblem is a provisional website mark; replace it if the organization has an official logo.

## Interactive creative corner

- **কবিতা:** rotate writing prompts, type a poem, explicitly save a draft in this browser, or download a UTF-8 `.txt` file.
- **সুর:** tap seven note buttons and adjust volume. Audio starts only after a visitor presses a button.
- **রং:** draw with touch or mouse, choose colors, use keyboard-accessible color stamps, clear the drawing and export a `.png`.

These tools are for practice. Nothing is submitted to the organization. A saved poem stays only in that browser's local storage; drawings and notes are not uploaded. No signup or children's personal-data collection is included.

## Accessibility & performance

Responsive navigation, skip link, keyboard focus, Escape-to-close menus, native FAQ disclosure elements, Bengali document language, reduced-motion support and readable no-JavaScript content. Continuous animation uses CSS transforms; there is no embedded Adobe app, large demo bundle or autoplay audio. Bengali Noto variable fonts are hosted with the website, with `font-display: swap` and system fallbacks. No external font request is needed.

## Attribution

Animation patterns and the IntersectionObserver action were adapted from the user-supplied SoundDesigner-Website source. This package is a distinct organization website. Dependencies retain their own licenses. Noto fonts are distributed under the SIL Open Font License (see `licenses/`).
