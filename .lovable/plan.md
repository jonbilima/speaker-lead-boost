## Goal
Remove every Lovable-branded asset from the app's shared-link previews and icons, replacing them with NextMIC branding.

## What's there now
- `index.html` sets both `og:image` and `twitter:image` to `https://lovable.dev/opengraph-image-p98pqg.png` — that's the Lovable heart image showing in the shared link screenshot.
- Favicon already points to `/images/nextmic-logo.svg` (fine), and `apple-touch-icon` / PWA icons are NextMIC-generated already.
- The published site also renders the "Edit with Lovable" badge, which is a publish setting, not code.

## Changes

1. **Create a branded 1200x630 OG image**
   - Generate `public/images/og-image.png` (1200x630) using the NextMIC gradient mark + wordmark on the dark brand background, with the tagline "AI Lead Generation for Public Speakers".

2. **Update `index.html` head**
   - Point `og:image` and `twitter:image` at `https://app.nextmic.ai/images/og-image.png` (absolute URL required by crawlers; the custom domain is live).
   - Add `og:url`, `og:site_name` ("NextMIC"), `og:image:width`/`height`, and `twitter:image:alt`.
   - Add `<link rel="canonical" href="https://app.nextmic.ai/" />`.
   - Verify no remaining `lovable.dev` references in the head.

3. **Sweep the rest of the project for Lovable branding**
   - Search `index.html`, `public/manifest.webmanifest`, `public/sw.js`, `README.md`, and `src/` for `lovable` references tied to user-visible branding, and replace/remove those (leaving internal platform code such as `src/pwa.ts` preview-host detection and Supabase config untouched, since those are functional, not branding).

4. **Hide the "Edit with Lovable" badge on published deploys**
   - Toggle the badge visibility setting off so the published site at app.nextmic.ai shows no Lovable badge.

## Note on caching
Social platforms (iMessage, Slack, LinkedIn, Facebook) cache previews. After publishing, the old Lovable image can persist until they re-scrape; forcing a refresh through each platform's link-preview debugger clears it faster.

## Technical detail
This is a static Vite SPA, so the head in `index.html` is what crawlers read — no per-route social previews are possible without SSR. One accurate app-level set of tags is the correct target here.