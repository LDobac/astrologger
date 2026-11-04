# CLAUDE.md

`astrologger` (jaehee.dev): personal blog. Astro 7, Markdown posts, fully static (SSG).

## Commands

Use Yarn 4 (Berry, via corepack), not npm. Node `>=22.12.0`.

- `yarn dev` — dev server.
- `yarn game:install` — install `games/LLM_Corpora` submodule deps (after init/update).
- `yarn build` — `astro check && tsc --noEmit && astro build`. All three must pass. The `llm-corpora-static-game` integration then builds the game into `dist/games/LLM_Corpora/`.
- `yarn test` — build-script tests (Node built-in test runner, `scripts/*.test.mjs`).
- `yarn preview` — preview the build.
- `yarn deploy` — `gh-pages -d dist --nojekyll --no-history`. Force-pushes; **confirm with the user first**.

No linter.

## Dependency policy

- Prefer Astro built-ins and official/native packages (e.g. `@astrojs/*`, `@shikijs/transformers`).
- Add third-party deps only when no native option exists (current: `katex`, `satori`, `html-to-text`, `github-slugger`).
- Verify dependency swaps against real posts before committing.

## Architecture

### Content

- Posts: `src/content/posts/**/*.md`, any nesting. Schema in [content.config.ts](src/content.config.ts) (Content Layer `glob()` loader; import `z` from `astro/zod`).
- Frontmatter: `title`, `description?`, `date`, `editDate?`, `series?`, `tags?`, `og? { img, alt }`.
- Images sit in per-post `images/` folders, referenced via `image()`.
- `post.body` may be `undefined` — use `?? ""`. Render with `render(post)` from `astro:content`.
- **URL slug = `slug(post.data.title)` (github-slugger), not the file name.** Renaming a title changes its URL.

### Utils (`src/utils/`)

- `GetPosts.ts` — the only way to read the collection. Caches results at module level.
- `GetSeriesList.ts` / `GetTagList.ts` — sort by `id` first. `getCollection` order is not guaranteed.
- `GetPostDescription.ts` — fallback when `description` is missing: `post.rendered.html` → `html-to-text`, truncated to `DESC_LEN`. Must skip `nav.toc`. Images show blank (Astro strips `alt`/`src`). Currently unused: every post sets `description`.
- Constants (`PAGE_SIZE`, `DESC_LEN`) live in [Constants.ts](src/utils/Constants.ts).

### Routes

- List pages (`posts/[page]`, `series/[series]/[page]`, `tags/[tag]/[page]`) use built-in `paginate()` and share `PostList`/`Paginator`.
- Series/tag params are slugified with github-slugger.

### OG images

- All rendered with raw `satori` (no `@vercel/og`, so no `tw` prop — use `style` objects).
- PNG: `blog_og_image.png.ts`, `image/thumbnail/[slug]-og.png.ts`, via `RenderOgPng.ts` (satori → sharp).
- SVG: `image/thumbnail/[slug].svg.ts`.
- Fonts fetched each build by `GetOgFonts.ts`.
- Post OG: frontmatter `og` if set, else the generated `-og.png`.

### Layouts

- `Layout.astro` — HTML shell. Must import `global.css` as its first statement. GA/Naver only in `PROD`.
- `PostLayout.astro` — post body plus up to 4 neighbor posts per side in the same series.

### Path aliases

Use `@components`, `@layouts`, `@pages`, `@assets`, `@styles`, `@utils` (→ `src/*`). No `@content` alias.

### Tailwind v4

- Via `@tailwindcss/vite`. No config file; everything is in `src/styles/global.css`.
- Colors: `--rgb-*` triplets per theme (`:root` / `:root.dark`); `@theme` maps them to `--color-*`.
- `dark`/`hover` variants are pinned to v3 selectors. Keep them.
- A custom `space-y-*` restores v3 behavior (margin on all but the first child). Keep it.
- `PostLayout.astro`'s `<style is:global>` needs `@reference "../styles/global.css";` first.

### Markdown

- Processor: Sätteri (`@astrojs/markdown-satteri`), not remark/rehype.
- Plugins in `src/plugins/`:
  - `satteri-katex.ts` — renders math with `katex.renderToString`.
  - `satteri-toc.ts` — builds `<nav class="toc">` after a "목차/toc/contents/index" heading. Scans raw source, skipping code fences. Mirrors `remark-toc` behavior.
  - `line-numbers.ts` — Shiki transformer for the `showLineNumbers` fence flag.
- Shiki: dual theme (`github-light`/`github-dark`), `defaultColor: false`. Supports `{1,3-4}` and `/word/` highlights.
- Heading IDs use github-slugger.
- KaTeX CSS loads only on posts containing math.

### Deployment

- No SSR adapter. `site` (domain read from `public/CNAME`) is set only when `NODE_ENV=production`.
- Keep `compressHTML: true`. Astro 7's `'jsx'` default breaks `Footer.astro` links.
- `build.assets` = `asset_dir`. Deploy is manual; no CI.

### LLM Corpora game

- `games/LLM_Corpora` is a Git submodule. On Windows, init with `git -c core.longpaths=true submodule update --init --recursive`; Git LFS content must be hydrated before building.
- `scripts/llm-corpora-integration.mjs` runs in `astro:build:done`: builds the game with `LLM_CORPORA_BASE_PATH=/games/LLM_Corpora/`, then `scripts/stage-llm-corpora.mjs` replaces only `dist/games/LLM_Corpora/`. Staging checks root `index.html`, `CNAME` vs `public/CNAME`, incomplete output and LFS pointer files.
- Never deploy the game to `gh-pages` separately: the next `--no-history` blog deploy replaces it. URL: `/games/LLM_Corpora/`.
