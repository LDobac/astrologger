# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`astrologger` (jaehee.dev) is a personal blog built with Astro. Content is authored as Markdown files with a `posts` content collection; pages are statically generated (SSG) and deployed as static assets.

## Commands

Package manager is Yarn (Berry, `yarn@4.12.0` via corepack, `.yarnrc.yml` + `.yarn/`). Use `yarn`, not `npm`.

- `yarn dev` / `yarn start` — start the Astro dev server
- `yarn build` — runs `astro check && tsc --noEmit && astro build`; treat all three as required to pass, not just the final build step
- `yarn preview` — preview the production build locally
- `yarn deploy` — publish `dist/` to GitHub Pages via `gh-pages` (this pushes to a remote branch — confirm with the user before running)
- `yarn astro ...` — run arbitrary Astro CLI commands

There is no test runner or lint script configured in this project.

## Architecture

### Content pipeline

Posts live under `src/content/posts/**/*.md` (freely nested into subfolders, e.g. `2021_11_23/`, `leet_code/`), validated against the Zod schema in [config.ts](src/content/config.ts). Frontmatter fields: `title`, `description?`, `date`, `editDate?`, `series?`, `tags?`, `og? { img, alt }`. Post-adjacent images live alongside the markdown in per-post `images/` folders and are referenced via Astro's `image()` schema helper.

Routing does not use the post's file slug — every page derives a URL slug by running `post.data.title` through `github-slugger`'s `slug()` at request/build time (see [src/pages/posts/[slug]/index.astro](src/pages/posts/[slug]/index.astro), the OG image routes, and `rss.xml.ts`). Changing a post's `title` therefore changes its canonical URL.

`src/utils/GetPosts.ts` is the single access point for reading the collection: it module-level caches `getCollection("posts")` results (unsorted, sorted-by-date, and per-series) so repeated calls across pages during the static build don't re-scan the collection. `GetSeriesList.ts` / `GetTagList.ts` derive the distinct series/tag sets by scanning all posts. `GetPostDescription.ts` renders a post's Markdown body through `marked` + `html-to-text` and truncates it to `DESC_LEN` (see [Constants.ts](src/utils/Constants.ts)) as a fallback when frontmatter has no `description`; results are cached per post id.

### Page/route structure

Dynamic list pages (`src/pages/posts/[page].astro`, `series/[series]/[page].astro`, `tags/[tag]/[page].astro`) all use Astro's built-in `paginate()` from `getStaticPaths`, sized by `PAGE_SIZE` (Constants.ts), and share `PostList`/`Paginator` components. Series and tag route params are also slugified with `github-slugger`.

### OG / thumbnail images

Two image-generation code paths exist and both re-fetch a Google-hosted IBM Plex Mono font per build via `GetOgFonts.ts`:
- `src/pages/blog_og_image.png.ts` and `src/pages/image/thumbnail/[slug]-og.png.ts` render PNGs using `@vercel/og`'s `ImageResponse`.
- `src/pages/image/thumbnail/[slug].svg.ts` renders an SVG for the same layout using `satori` directly.

Post-level OG image resolution order (see [posts/[slug]/index.astro](src/pages/posts/[slug]/index.astro)): use frontmatter `og.img`/`og.alt` if present, otherwise fall back to the generated `-og.png` thumbnail route.

### Layouts

`Layout.astro` is the HTML shell (meta/OG tags, fonts, GA + Naver site verification behind `import.meta.env.PROD`, global Tailwind directives). `PostLayout.astro` renders a single post's content plus, when the post belongs to a `series`, a "neighbor posts in this series" block (up to 4 posts before/after in sorted series order).

### Path aliases

TypeScript path aliases (see [tsconfig.json](tsconfig.json)) map `@components/*`, `@content/*`, `@layouts/*`, `@pages/*`, `@assets/*`, `@utils/*` to `src/*` — use these instead of relative imports.

### Markdown processing

Configured in [astro.config.ts](astro.config.ts): `remark-math` + `rehype-katex` for math, `remark-toc` (Korean-aware heading matcher for 목차/index/toc), `rehype-pretty-code` with the `one-dark-pro` theme for syntax highlighting (Astro's built-in syntax highlighter is disabled in favor of this). KaTeX CSS is loaded conditionally per-page only when a post's body matches a math-syntax regex, not globally.

### Deployment

Static site, no SSR adapter. `astro.config.ts` sets `site` to `https://jaehee.dev` only when `NODE_ENV=production`, and `build.assets` to `asset_dir`. Deployment is manual (`yarn deploy` → `gh-pages`), no CI workflow is configured.
