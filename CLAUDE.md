# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`astrologger` (jaehee.dev) is a personal blog built with Astro 7. Content is authored as Markdown files with a `posts` content collection; pages are statically generated (SSG) and deployed as static assets.

## Commands

Package manager is Yarn (Berry, `yarn@4.12.0` via corepack, `.yarnrc.yml` + `.yarn/`). Use `yarn`, not `npm`.

- `yarn dev` / `yarn start` — start the Astro dev server
- `yarn build` — runs `astro check && tsc --noEmit && astro build`; treat all three as required to pass, not just the final build step
- `yarn preview` — preview the production build locally
- `yarn deploy` — publish `dist/` to GitHub Pages via `gh-pages` (this pushes to a remote branch — confirm with the user before running)
- `yarn astro ...` — run arbitrary Astro CLI commands

There is no test runner or lint script configured in this project. Node `>=22.12.0` is required (see `engines` in `package.json`).

## Dependency policy

New dependencies default to **1st-party / Astro-native first**: an Astro built-in or an official `@astrojs/*`/framework-adjacent package (e.g. `@shikijs/transformers`, which Astro's own Shiki integration accepts directly via `shikiConfig.transformers`) is preferred over an equivalent third-party package. A third-party (2nd-tier) dependency is only introduced when no built-in/native path can do the job — e.g. `katex` (no built-in math renderer), `satori` (no built-in OG image renderer), `html-to-text` and `github-slugger` (no built-in equivalents). When evaluating a dependency swap, prefer it only when it can be verified against real content; an unverifiable code path (e.g. one no current post ever exercises) is left alone rather than "upgraded" on faith — see `GetPostDescription.ts` below.

## Architecture

### Content pipeline

Posts live under `src/content/posts/**/*.md` (freely nested into subfolders, e.g. `2021_11_23/`, `leet_code/`), validated against the Zod schema in [content.config.ts](src/content.config.ts) using the Content Layer `glob()` loader (`base: "./src/content/posts"`, `pattern: "**/*.md"`; `z` is imported from `astro/zod`, not `astro:content`). Frontmatter fields: `title`, `description?`, `date`, `editDate?`, `series?`, `tags?`, `og? { img, alt }`. Post-adjacent images live alongside the markdown in per-post `images/` folders (excluded from the glob automatically since it only matches `*.md`) and are referenced via Astro's `image()` schema helper. `post.body` is `string | undefined` under Content Layer — guard with `?? ""` at call sites. `render(post)` (imported from `astro:content`) replaces the legacy `post.render()`.

Routing does not use the post's file slug — every page derives a URL slug by running `post.data.title` through `github-slugger`'s `slug()` at request/build time (see [src/pages/posts/[slug]/index.astro](src/pages/posts/[slug]/index.astro), the OG image routes, and `rss.xml.ts`). Changing a post's `title` therefore changes its canonical URL.

`src/utils/GetPosts.ts` is the single access point for reading the collection: it module-level caches `getCollection("posts")` results (unsorted, sorted-by-date, and per-series) so repeated calls across pages during the static build don't re-scan the collection. `GetSeriesList.ts` / `GetTagList.ts` derive the distinct series/tag sets by scanning all posts — both explicitly sort by `id` before deriving the set, because `getCollection`'s iteration order is not a guaranteed contract across loader implementations (confirmed empirically when migrating off the legacy collections API: the tag/series appearance order shifted with no way to reconstruct the old order, since it depended on undocumented filesystem traversal). `GetPostDescription.ts` renders a post's Markdown body through `marked` + `html-to-text` and truncates it to `DESC_LEN` (see [Constants.ts](src/utils/Constants.ts)) as a fallback when frontmatter has no `description`; results are cached per post id. **Every current post sets `description` explicitly**, so this fallback path is presently dead code — `marked` is kept anyway rather than swapped for `post.rendered.html`, precisely because an unexercised path can't be verified against real content.

### Page/route structure

Dynamic list pages (`src/pages/posts/[page].astro`, `series/[series]/[page].astro`, `tags/[tag]/[page].astro`) all use Astro's built-in `paginate()` from `getStaticPaths` (typed via `PaginateFunction` from `"astro"`), sized by `PAGE_SIZE` (Constants.ts), and share `PostList`/`Paginator` components. Series and tag route params are also slugified with `github-slugger`.

### OG / thumbnail images

Two image-generation code paths exist, both rendering through `satori` directly (no `@vercel/og`) and both re-fetching a font per build via `GetOgFonts.ts` (IBM Plex Mono from `www.1001fonts.com`, plus a Korean glyph subset scraped from Google's CSS API for whichever text is actually being rendered):
- `src/pages/blog_og_image.png.ts` and `src/pages/image/thumbnail/[slug]-og.png.ts` render PNGs via `src/utils/RenderOgPng.ts`, a small `satori(...) → sharp(...).png()` helper (`sharp` is Astro's own default image-service rasterizer). `@vercel/og`'s `tw` (Tailwind-in-JS) prop isn't available on raw `satori`, so these routes build explicit `style` objects instead.
- `src/pages/image/thumbnail/[slug].svg.ts` renders an SVG for the same layout using `satori` directly.

All three routes now share one `satori` version (previously the PNG path used a different bundled `satori` than the SVG path).

Post-level OG image resolution order (see [posts/[slug]/index.astro](src/pages/posts/[slug]/index.astro)): use frontmatter `og.img`/`og.alt` if present, otherwise fall back to the generated `-og.png` thumbnail route.

### Layouts

`Layout.astro` is the HTML shell (meta/OG tags, Google Fonts `<link>`, GA + Naver site verification behind `import.meta.env.PROD`). It imports [src/styles/global.css](src/styles/global.css) as its first frontmatter statement — that ordering matters, see Tailwind below. `PostLayout.astro` renders a single post's content plus, when the post belongs to a `series`, a "neighbor posts in this series" block (up to 4 posts before/after in sorted series order).

### Path aliases

TypeScript path aliases (see [tsconfig.json](tsconfig.json)) map `@components/*`, `@layouts/*`, `@pages/*`, `@assets/*`, `@styles/*`, `@utils/*` to `src/*` — use these instead of relative imports. (There is no `@content/*` alias — no import ever needed one, and `src/content.config.ts` lives at `src/` root, not under `src/content/`.)

### Tailwind (v4)

Tailwind is wired via `@tailwindcss/vite` in `astro.config.ts` (`vite.plugins`), not `@astrojs/tailwind` (that integration has no Astro 6/7-compatible release). There is no `tailwind.config.ts` — configuration is CSS-first in `src/styles/global.css`:
- The seven semantic color tokens (`canvas`, `canvas-subtle`, `fg`, `fg-muted`, `line`, `accent`, `accent-subtle`) keep their RGB-channel-triplet values under `--rgb-*` custom properties (set per-theme in `:root` / `:root.dark`), with `@theme` deriving Tailwind's `--color-*` namesake from `rgb(var(--rgb-*))`. This split exists because `--color-*` is Tailwind v4's own theme namespace and can't hold a bare channel triplet directly.
- `@custom-variant dark (&:is(.dark *))` and `@custom-variant hover (&:hover)` pin the v3-era selectors (v4's defaults — `:where(.dark, .dark *)` and a `@media (hover: hover)` wrapper — would otherwise change cascade/touch-device behavior).
- An `@layer utilities` block restores v3's `space-y-*` semantics (margin on all-but-*first* child) over v4's default (all-but-*last*, via `:where()`, zero specificity) — the two only produce the same layout when a `space-y-*` container's own top margin doesn't matter, which isn't always true here.
- `PostLayout.astro`'s separate `<style is:global>` block needs `@reference "../styles/global.css";` as its first line for `@apply` to resolve theme values.

### Markdown processing

Configured in [astro.config.ts](astro.config.ts) via `markdown.processor: satteri({...})` — Astro's native Rust markdown pipeline (`@astrojs/markdown-satteri`), not the remark/rehype `unified()` pipeline. Three custom plugins in `src/plugins/` extend it:
- `satteri-katex.ts` — an mdast plugin handling the `math`/`inlineMath` nodes `features: { math: true }` produces; Sätteri parses math but has no built-in renderer, so this calls `katex.renderToString` directly (the same call `rehype-katex` used to make) and returns `{ rawHtml }` to replace the node.
- `satteri-toc.ts` — an mdast plugin that, on a heading matching the "목차/toc/contents/index" regex, scans the *raw* source text after it (skipping fenced code blocks, so a C++ `#include` never gets mistaken for a heading) to build a nested `<ol>` table of contents. This replicates `remark-toc`/`mdast-util-toc`'s actual behavior: collection doesn't start until a heading at the same-or-shallower depth as the "목차" heading is seen (a latch), then every subsequent heading is included regardless of depth.
- `line-numbers.ts` — a Shiki transformer that turns a `showLineNumbers` fence-meta flag into `data-line-numbers`/`data-line-numbers-max-digits` attributes on `<code>`, which `PostLayout.astro`'s CSS counter rules consume.

Syntax highlighting is Astro's built-in Shiki (`markdown.shikiConfig`), themed dual light/dark (`github-light`/`github-dark`) with `defaultColor: false` so *both* themes emit as `--shiki-light`/`--shiki-dark` CSS custom properties rather than one being a literal inline color — `PostLayout.astro`'s "Shiki - Dual Theme" CSS block picks between them per `html.dark`. `@shikijs/transformers`' `transformerMetaHighlight`/`transformerMetaWordHighlight` handle the `{1,3-4}` line-range and `/word/` fence-meta syntax (unchanged from before — Shiki accepts the same meta-string syntax rehype-pretty-code did).

Heading IDs are generated automatically by Sätteri's own `createHeadingIdsPlugin` using `github-slugger` internally — the same library this project's own URL-slugging uses, so anchors match what they always have.

KaTeX CSS is loaded conditionally per-page (see `posts/[slug]/index.astro`) only when a post's body matches a math-syntax regex, not globally.

### Deployment

Static site, no SSR adapter. `astro.config.ts` sets `site` to `https://jaehee.dev` only when `NODE_ENV=production`, `compressHTML: true` explicitly (Astro 7's new default, `'jsx'`, compresses inter-element whitespace differently and would break a newline-joined `<a>` in `Footer.astro`), and `build.assets` to `asset_dir`. Deployment is manual (`yarn deploy` → `gh-pages`), no CI workflow is configured.
