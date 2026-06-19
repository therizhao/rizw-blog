import fs from 'node:fs';
import path from 'node:path';
import MarkdownIt from 'markdown-it';
import { parse as parseYaml } from 'yaml';

const rootDir = process.cwd();
const contentDir = path.join(rootDir, 'content');
const imageDir = path.join(rootDir, 'images');

const preferredTabOrder = ['notes', 'make', 'daily', 'climbing', 'designs', 'old-posts'];
const assetExtensions = new Set([
  '.avif',
  '.gif',
  '.jpeg',
  '.jpg',
  '.pdf',
  '.png',
  '.svg',
  '.webp',
]);

export type Frontmatter = Record<string, unknown>;

export type Tab = {
  folder: string;
  label: string;
  path: string;
  posts: PostMeta[];
  slug: string;
};

export type PostMeta = {
  body: string;
  coverImage?: string;
  date?: string;
  excerpt?: string;
  filePath: string;
  frontmatter: Frontmatter;
  readingMinutes: number;
  slug: string;
  sourcePath: string;
  tab: Omit<Tab, 'posts'>;
  title: string;
  url: string;
};

export type Post = PostMeta & {
  html: string;
  next?: PostMeta;
  previous?: PostMeta;
};

type MarkdownEnv = {
  currentFile: string;
  linkLookup: Map<string, string>;
};

const markdown = new MarkdownIt({
  breaks: false,
  html: true,
  linkify: true,
  typographer: false,
});

markdown.renderer.rules.image = (tokens, index, options, env: MarkdownEnv, self) => {
  const token = tokens[index];
  const src = token.attrGet('src');

  if (src) {
    token.attrSet('src', resolveAssetSrc(src, env.currentFile));
  }

  if (!token.attrGet('alt')) {
    token.attrSet('alt', '');
  }

  token.attrSet('loading', 'lazy');
  token.attrSet('decoding', 'async');

  return self.renderToken(tokens, index, options);
};

markdown.renderer.rules.link_open = (tokens, index, options, env: MarkdownEnv, self) => {
  const token = tokens[index];
  const href = token.attrGet('href');

  if (href) {
    token.attrSet('href', normalizeLinkHref(href, env.currentFile, env.linkLookup));
  }

  return self.renderToken(tokens, index, options);
};

export function getTabs(): Tab[] {
  if (!fs.existsSync(contentDir)) {
    return [];
  }

  return fs
    .readdirSync(contentDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const tabBase = {
        folder: entry.name,
        label: humanizeLabel(entry.name),
        path: `/${slugify(entry.name)}/`,
        slug: slugify(entry.name),
      };

      return {
        ...tabBase,
        posts: getPostsForTab(tabBase),
      };
    })
    .sort(sortTabs);
}

export function getTab(tabSlug: string | undefined): Tab | undefined {
  if (!tabSlug) {
    return undefined;
  }

  return getTabs().find((tab) => tab.slug === tabSlug);
}

export function getAllPosts(): PostMeta[] {
  return getTabs().flatMap((tab) => tab.posts);
}

export function getLatestPosts(limit = 6): PostMeta[] {
  return [...getAllPosts()].sort(sortPosts).slice(0, limit);
}

export function getHomePost(): Post | undefined {
  const homeMeta = getAllPosts().find((post) => post.slug === 'hey');

  if (!homeMeta) {
    return undefined;
  }

  return getPost(homeMeta.tab.slug, homeMeta.slug);
}

export function getPost(tabSlug: string | undefined, postSlug: string | undefined): Post | undefined {
  const tab = getTab(tabSlug);

  if (!tab || !postSlug) {
    return undefined;
  }

  const index = tab.posts.findIndex((post) => post.slug === postSlug);

  if (index === -1) {
    return undefined;
  }

  const post = tab.posts[index];
  const linkLookup = buildLinkLookup(getAllPosts());
  const html = renderMarkdown(post.body, post.filePath, linkLookup);

  return {
    ...post,
    html,
    next: index > 0 ? tab.posts[index - 1] : undefined,
    previous: index < tab.posts.length - 1 ? tab.posts[index + 1] : undefined,
  };
}

export function formatPostDate(date: string | undefined): string | undefined {
  if (!date) {
    return undefined;
  }

  const [year, month, day] = date.split('-').map(Number);
  const monthName = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ][month - 1];

  if (!year || !monthName || !day) {
    return date;
  }

  return `${monthName} ${day}, ${year}`;
}

export function formatReadingTime(minutes: number): string {
  return `${minutes} min read`;
}

function getPostsForTab(tab: Omit<Tab, 'posts'>): PostMeta[] {
  const tabDir = path.join(contentDir, tab.folder);
  const markdownFiles = walk(tabDir).filter((file) => ['.md', '.mdx'].includes(path.extname(file).toLowerCase()));
  const usedSlugs = new Map<string, number>();

  return markdownFiles
    .map((filePath) => buildPost(filePath, tab, usedSlugs))
    .sort(sortPosts);
}

function buildPost(filePath: string, tab: Omit<Tab, 'posts'>, usedSlugs: Map<string, number>): PostMeta {
  const sourcePath = toPosix(path.relative(contentDir, filePath));
  const raw = fs.readFileSync(filePath, 'utf8');
  const parsed = parseFrontmatter(raw);
  const frontmatter = parsed.data as Frontmatter;
  const title = getTitle(filePath, frontmatter);
  const slug = getUniqueSlug(getSlugSource(filePath), usedSlugs);
  const date = normalizeDate(frontmatter.date) ?? extractDate(sourcePath);
  const coverImage = typeof frontmatter.image === 'string' ? resolveAssetSrc(frontmatter.image, filePath) : undefined;
  const excerpt = getExcerpt(frontmatter, parsed.content);
  const readingMinutes = getReadingMinutes(parsed.content);

  return {
    body: parsed.content,
    coverImage,
    date,
    excerpt,
    filePath,
    frontmatter,
    readingMinutes,
    slug,
    sourcePath,
    tab,
    title,
    url: `${tab.path}${slug}/`,
  };
}

function parseFrontmatter(raw: string): { content: string; data: Frontmatter } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/);

  if (!match) {
    return { content: raw, data: {} };
  }

  const parsed = parseYaml(match[1] ?? '');

  return {
    content: raw.slice(match[0].length),
    data: isRecord(parsed) ? parsed : {},
  };
}

function isRecord(value: unknown): value is Frontmatter {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function walk(directory: string): string[] {
  if (!fs.existsSync(directory)) {
    return [];
  }

  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      return walk(entryPath);
    }

    return entry.isFile() ? [entryPath] : [];
  });
}

function sortTabs(a: Tab, b: Tab): number {
  const aIndex = preferredTabOrder.indexOf(a.slug);
  const bIndex = preferredTabOrder.indexOf(b.slug);

  if (aIndex !== -1 || bIndex !== -1) {
    return (aIndex === -1 ? Number.MAX_SAFE_INTEGER : aIndex) - (bIndex === -1 ? Number.MAX_SAFE_INTEGER : bIndex);
  }

  return a.label.localeCompare(b.label);
}

function sortPosts(a: PostMeta, b: PostMeta): number {
  if (a.date && b.date && a.date !== b.date) {
    return b.date.localeCompare(a.date);
  }

  if (a.date && !b.date) {
    return -1;
  }

  if (!a.date && b.date) {
    return 1;
  }

  return a.title.localeCompare(b.title);
}

function getTitle(filePath: string, frontmatter: Frontmatter): string {
  if (typeof frontmatter.title === 'string' && frontmatter.title.trim()) {
    return frontmatter.title.trim();
  }

  const base = getSlugSource(filePath);
  return humanizeTitle(base);
}

function getSlugSource(filePath: string): string {
  const extension = path.extname(filePath);
  const stem = path.basename(filePath, extension);

  if (stem.toLowerCase() === 'index') {
    return path.basename(path.dirname(filePath));
  }

  return stem;
}

function getUniqueSlug(source: string, usedSlugs: Map<string, number>): string {
  const base = slugify(source);
  const previousCount = usedSlugs.get(base) ?? 0;
  usedSlugs.set(base, previousCount + 1);

  if (previousCount === 0) {
    return base;
  }

  return `${base}-${previousCount + 1}`;
}

function normalizeDate(value: unknown): string | undefined {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === 'string') {
    const match = value.match(/\d{4}-\d{2}-\d{2}/);
    return match?.[0];
  }

  return undefined;
}

function extractDate(value: string): string | undefined {
  return value.match(/\d{4}-\d{2}-\d{2}/)?.[0];
}

function getExcerpt(frontmatter: Frontmatter, markdownSource: string): string | undefined {
  if (typeof frontmatter.spoiler === 'string' && frontmatter.spoiler.trim()) {
    return frontmatter.spoiler.trim();
  }

  const text = markdownToText(markdownSource);

  if (!text) {
    return undefined;
  }

  return text.length > 180 ? `${text.slice(0, 177).trim()}...` : text;
}

function getReadingMinutes(markdownSource: string): number {
  const words = markdownToText(markdownSource).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 220));
}

function renderMarkdown(markdownSource: string, currentFile: string, linkLookup: Map<string, string>): string {
  const withWikiSyntax = transformWikiSyntax(markdownSource, currentFile, linkLookup);
  const withHtmlUrls = rewriteRawHtmlUrls(withWikiSyntax, currentFile, linkLookup);
  return markdown.render(withHtmlUrls, { currentFile, linkLookup });
}

function transformWikiSyntax(markdownSource: string, currentFile: string, linkLookup: Map<string, string>): string {
  return markdownSource
    .replace(/!\[\[([^\]]+)\]\]/g, (_match, body: string) => {
      const [targetPart, labelPart] = body.split('|');
      const target = targetPart.trim();
      const label = labelPart?.trim();
      const width = label && /^\d+$/.test(label) ? Number(label) : undefined;
      const alt = width ? path.basename(target, path.extname(target)) : label || path.basename(target, path.extname(target));
      const style = width ? ` style="max-width: min(100%, ${width}px);"` : '';

      return `<img src="${escapeHtmlAttribute(resolveAssetSrc(target, currentFile))}" alt="${escapeHtmlAttribute(alt)}" loading="lazy" decoding="async"${style} />`;
    })
    .replace(/\[\[([^\]]+)\]\]/g, (_match, body: string) => {
      const [targetPart, labelPart] = body.split('|');
      const target = targetPart.trim();
      const label = labelPart?.trim() || target;
      const href = resolveWikiHref(target, linkLookup);

      return `[${label}](${href})`;
    });
}

function rewriteRawHtmlUrls(markdownSource: string, currentFile: string, linkLookup: Map<string, string>): string {
  return markdownSource
    .replace(/(<(?:img|source)\b[^>]*\bsrc=["'])([^"']+)(["'][^>]*>)/gi, (_match, before: string, src: string, after: string) => {
      return `${before}${escapeHtmlAttribute(resolveAssetSrc(src, currentFile))}${after}`;
    })
    .replace(/(<a\b[^>]*\bhref=["'])([^"']+)(["'][^>]*>)/gi, (_match, before: string, href: string, after: string) => {
      return `${before}${escapeHtmlAttribute(normalizeLinkHref(href, currentFile, linkLookup))}${after}`;
    });
}

function normalizeLinkHref(href: string, currentFile: string, linkLookup: Map<string, string>): string {
  if (isAlreadyRoutable(href)) {
    return href;
  }

  const { pathname, suffix } = splitReference(href);
  const extension = path.extname(pathname).toLowerCase();

  if (extension === '.md' || extension === '.mdx') {
    const resolved = resolveMarkdownHref(pathname, currentFile, linkLookup);
    return resolved ? `${resolved}${suffix}` : href;
  }

  if (assetExtensions.has(extension)) {
    return resolveAssetSrc(href, currentFile);
  }

  return href;
}

function resolveWikiHref(target: string, linkLookup: Map<string, string>): string {
  const [withoutHash, hash] = target.split('#');
  const key = slugify(path.basename(withoutHash, path.extname(withoutHash)));
  const href = linkLookup.get(`slug:${key}`) ?? linkLookup.get(`title:${key}`);

  if (!href) {
    return target;
  }

  return hash ? `${href}#${slugify(hash)}` : href;
}

function resolveMarkdownHref(reference: string, currentFile: string, linkLookup: Map<string, string>): string | undefined {
  const decoded = decodeUriPath(reference);
  const absolutePath = path.resolve(path.dirname(currentFile), decoded);
  const relativePath = stripIndex(toPosix(path.relative(contentDir, absolutePath)).replace(/\.mdx?$/, ''));

  return linkLookup.get(`path:${relativePath}`);
}

function resolveAssetSrc(reference: string, currentFile: string): string {
  if (isAlreadyRoutable(reference)) {
    return reference;
  }

  const { pathname, suffix } = splitReference(reference);
  const decodedPathname = decodeUriPath(pathname);
  const fromCurrentFile = path.resolve(path.dirname(currentFile), decodedPathname);

  if (isInside(fromCurrentFile, contentDir) && fs.existsSync(fromCurrentFile)) {
    return `/_content/${encodeUrlPath(toPosix(path.relative(contentDir, fromCurrentFile)))}${suffix}`;
  }

  const fromImages = path.join(imageDir, decodedPathname);

  if (fs.existsSync(fromImages)) {
    return `/_images/${encodeUrlPath(toPosix(path.relative(imageDir, fromImages)))}${suffix}`;
  }

  const fromContentRoot = path.join(contentDir, decodedPathname);

  if (fs.existsSync(fromContentRoot)) {
    return `/_content/${encodeUrlPath(toPosix(path.relative(contentDir, fromContentRoot)))}${suffix}`;
  }

  const currentDirectory = toPosix(path.relative(contentDir, path.dirname(currentFile)));
  const fallbackPath = currentDirectory === '' ? decodedPathname : `${currentDirectory}/${decodedPathname}`;

  return `/_content/${encodeUrlPath(fallbackPath)}${suffix}`;
}

function buildLinkLookup(posts: PostMeta[]): Map<string, string> {
  const lookup = new Map<string, string>();

  for (const post of posts) {
    const sourceWithoutExtension = stripIndex(post.sourcePath.replace(/\.mdx?$/, ''));
    lookup.set(`path:${sourceWithoutExtension}`, post.url);
    lookup.set(`slug:${post.slug}`, post.url);
    lookup.set(`title:${slugify(post.title)}`, post.url);
    lookup.set(`file:${slugify(getSlugSource(post.filePath))}`, post.url);
  }

  return lookup;
}

function stripIndex(value: string): string {
  return value.endsWith('/index') ? value.slice(0, -'/index'.length) : value;
}

function splitReference(reference: string): { pathname: string; suffix: string } {
  const match = reference.match(/^([^?#]*)([?#].*)?$/);

  return {
    pathname: match?.[1] ?? reference,
    suffix: match?.[2] ?? '',
  };
}

function isAlreadyRoutable(value: string): boolean {
  return /^(?:[a-z][a-z0-9+.-]*:|#|\/)/i.test(value);
}

function isInside(child: string, parent: string): boolean {
  const relative = path.relative(parent, child);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function slugify(value: string): string {
  const slug = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['']/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug || 'post';
}

function humanizeLabel(value: string): string {
  return humanizeWords(value).toLowerCase();
}

function humanizeTitle(value: string): string {
  return humanizeWords(value);
}

function humanizeWords(value: string): string {
  return value
    .replace(/\.[^.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function markdownToText(markdownSource: string): string {
  return markdownSource
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[\[[^\]]+\]\]/g, ' ')
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/<[^>]*>/g, ' ')
    .replace(/[#>*_`~=-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeHtmlAttribute(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function decodeUriPath(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function encodeUrlPath(value: string): string {
  return value.split('/').map(encodeURIComponent).join('/');
}

function toPosix(value: string): string {
  return value.split(path.sep).join('/');
}
