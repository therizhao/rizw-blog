# rizw-blog

TypeScript static blog built from the root `content/` folder.

## Authoring

Each direct subfolder in `content/` becomes a top-level tab. Add a markdown file anywhere inside a tab folder and it becomes a post:

- `content/notes/My note.md` -> `/notes/my-note/`
- `content/daily/2026-06-19.md` -> `/daily/2026-06-19/`
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
