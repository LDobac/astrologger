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
- Add third-party deps only when no native option exists (current: `katex`, `satori`, `html-to-text`, `github-slugger`; dev-only for the editor: `codemirror` + `@codemirror/*`, `yaml`).
- Verify dependency swaps against real posts before committing.

## Architecture

### Content

- Posts: one folder per post, `src/content/posts/<tree...>/<post>/index.md`. Folders without `index.md` are trees (categories, e.g. `leet_code/`). Schema in [content.config.ts](src/content.config.ts) (Content Layer `glob()` loader; import `z` from `astro/zod`).
- `_draft/` (editor drafts) is excluded from the collection and gitignored. The glob loader does **not** skip `_`-prefixed paths by itself.
- Frontmatter: `title`, `description?`, `date`, `editDate?`, `series?`, `tags?`, `og? { img, alt }`.
- Images sit in the post's `attachments/` folder, referenced as `./attachments/<file>`. Only images are supported: Astro does not copy non-image files linked from Markdown.
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
- `PostLayout.astro` — post body plus up to 4 neighbor posts per side in the same series. Body styles live in `src/styles/post-content.css` (shared with the editor preview).

### Path aliases

Use `@components`, `@layouts`, `@pages`, `@assets`, `@styles`, `@utils` (→ `src/*`). No `@content` alias.

### Tailwind v4

- Via `@tailwindcss/vite`. No config file. Site CSS is `src/styles/global.css`; `@custom-variant`/`@theme` live in `src/styles/theme.css` (shared with the editor).
- Colors: `--rgb-*` triplets per theme (`:root` / `:root.dark`); `@theme` maps them to `--color-*`.
- `dark`/`hover` variants are pinned to v3 selectors. Keep them.
- A custom `space-y-*` restores v3 behavior (margin on all but the first child). Keep it.
- `post-content.css` needs `@reference "./global.css";` first.
- `global.css` has `@source not "../editor"` so editor classes never reach production CSS. The editor builds its own CSS (`src/editor/editor.css`).

### Markdown

- Processor: Sätteri (`@astrojs/markdown-satteri`), not remark/rehype.
- Plugins in `src/plugins/`:
  - `satteri-katex.ts` — renders math with `katex.renderToString`.
  - `satteri-toc.ts` — builds `<nav class="toc">` after a "목차/toc/contents/index" heading. Scans raw source, skipping code fences. Mirrors `remark-toc` behavior. Sätteri `position.offset` is a UTF-8 **byte** offset, not a string index.
  - `line-numbers.ts` — Shiki transformer for the `showLineNumbers` fence flag.
- Shiki: dual theme (`github-light`/`github-dark`), `defaultColor: false`. Supports `{1,3-4}` and `/word/` highlights.
- Heading IDs use github-slugger.
- KaTeX CSS loads only on posts containing math.

### Editor (dev only)

- `src/editor/integration.ts` registers `/__editor` (tree), `/__editor/edit` (editor), `/__editor/preview` (iframe) and the `/__editor/api` middleware **only when `command === "dev"`**. Nothing reaches `dist`.
- Preview uses the configured `markdown.processor.createRenderer()`, so output matches the real pipeline. Local image markers are rewritten to `/__editor/api/file`.
- Drafts: `src/content/posts/_draft/<id>/{index.md, draft.json, attachments/}`. `new-<timestamp>` for new posts, `edit-<dir with / → __>` for existing ones (reopening resumes the draft).
- Publish writes `index.md`, moves referenced draft attachments, deletes unreferenced files in the post's `attachments/`, and removes the draft. Rejects URL (slug) collisions and missing attachments.
- After writing or deleting `index.md`, publish and delete emit `add`/`change`/`unlink` on Vite's `server.watcher` (`server/watcher.ts`). The glob loader then updates without relying on the real file watcher, which can miss events (seen right after a dev restart).
- Delete (`DELETE /__editor/api/post`, from the tree or the editor) removes the post folder with its attachments, that post's edit draft, and any trees left empty. It refuses if the post folder contains a directory other than `attachments/`.
- Astro bug (still present in 7.4.5): when an entry is updated and ends up with no images, the data store never marks the image-import list as changed, so `.astro/content-assets.mjs` keeps importing deleted files. Every page then fails with `ImageNotFound`, and a dev restart doesn't fix it. After pruning attachments, publish calls `dropStaleContentAssets()` (`store.ts`), which removes imports of missing files from that file. Deleting images by hand outside the editor can still trigger the bug.
- Never import `sharp` in editor server code. A second copy in the dev-server process breaks Astro's `/_image` ("MissingSharp"). Upload webp conversion runs `sharp` in a child process (`toWebp` in `store.ts`).
- Frontmatter is edited with `yaml` `parseDocument` (dates stay unquoted strings, so Astro still parses them as dates).
- Floating buttons: `EditorFab.astro`, loaded by `Layout.astro` behind `import.meta.env.DEV` (inline styles only).
- `astro dev` runs as a background daemon in non-TTY shells (`astro dev stop` / `astro dev logs`).

### Comments / views (client)

- API: `services/comment_and_view` (Cloudflare Worker). Base URL is `COMMENT_API_URL` in [Constants.ts](src/utils/Constants.ts): `127.0.0.1:8787` in dev, `*.workers.dev` in prod. Client wrapper: `src/utils/CommentApi.ts`.
- `Comments.astro` (below the post body) and `ViewCount.astro` (post header only; POST, falls back to GET) are vanilla `<script>`s initialized on `astro:page-load` (ClientRouter).
- Render comment text with `textContent` only. Slug = `slug(title)`.

### Deployment

- No SSR adapter. `site` (domain read from `public/CNAME`) is set only when `NODE_ENV=production`.
- Keep `compressHTML: true`. Astro 7's `'jsx'` default breaks `Footer.astro` links.
- `build.assets` = `asset_dir`. Deploy is manual; no CI.

### LLM Corpora game

- `games/LLM_Corpora` is a Git submodule. On Windows, init with `git -c core.longpaths=true submodule update --init --recursive`; Git LFS content must be hydrated before building.
- `scripts/llm-corpora-integration.mjs` runs in `astro:build:done`: builds the game with `LLM_CORPORA_BASE_PATH=/games/LLM_Corpora/`, then `scripts/stage-llm-corpora.mjs` replaces only `dist/games/LLM_Corpora/`. Staging checks root `index.html`, `CNAME` vs `public/CNAME`, incomplete output and LFS pointer files.
- Never deploy the game to `gh-pages` separately: the next `--no-history` blog deploy replaces it. URL: `/games/LLM_Corpora/`.
