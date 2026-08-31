# rizw-blog

TypeScript static blog built from the root `content/` folder.

## Structure

The site has two sections: **About** (`/`, sourced from `content/notes/hey 👋.md`) and
**Writings** (`/writings/`), a filterable list of every other post.

Each direct subfolder in `content/` maps to one writing tag used by the `/writings/`
toggle filters. One tag can be active at a time; none selected shows everything.

| Folder                        | Tag      |
| ----------------------------- | -------- |
| `content/climbing/`           | `climb`  |
| `content/notes/`, `old-posts/`| `blog`   |
| `content/designs/`            | `design` |
| `content/make/`               | `make`   |

Tag order in the sidebar comes from `WRITING_TAGS` in `src/lib/content.ts`.

Add a markdown file anywhere inside one of those folders and it becomes a post:

- `content/notes/My note.md` -> `/notes/my-note/`
- `content/designs/my-project/index.md` -> `/designs/my-project/`

Markdown frontmatter is optional:

```md
---
title: My post title
date: 2026-06-19
spoiler: Short listing excerpt
image: cover.jpg
---
```

Relative media next to a post is supported, as are Obsidian image embeds like `![[image.png|500]]`. Files in the root `images/` folder are copied into the built site during `npm run build`.

## Development

```sh
npm install
npm run dev
```

## Cloudflare Workers

Deployed as a Worker serving static assets from `dist/`.

Build command: `npm run build`

Deploy command: `npx wrangler deploy`

The asset directory and 404 handling are captured in `wrangler.toml` under
`[assets]`. The `public/_headers` file is honored by Workers static assets.
