import type { Post, PostMeta, Tab } from './content.ts';
import { formatPostDate, formatReadingTime, getTabs } from './content.ts';

const defaultDescription = "Rizhao's notes, making logs, climbing writing, designs, and older posts.";

type LayoutOptions = {
  activeTab?: string;
  content: string;
  description?: string;
  title?: string;
};

export function renderHomePage(homePost: Post | undefined, latestPosts: PostMeta[]): string {
  const intro = homePost ? `<article class="home-intro post-content">${homePost.html}</article>` : '';
  const latest =
    latestPosts.length > 0
      ? `<section class="latest-section"><h2>Latest</h2>${renderPostList(latestPosts, true)}</section>`
      : '';

  return renderLayout({
    content: `${intro}${latest}`,
    description: homePost?.excerpt,
    title: "rizhao's garden",
  });
}

export function renderTabPage(tab: Tab): string {
  const content = tab.slug === 'designs' ? renderDesignList(tab.posts) : renderPostList(tab.posts);

  return renderLayout({
    activeTab: tab.slug,
    content,
    title: tab.label,
  });
}

export function renderPostPage(post: Post): string {
  const previous = post.previous
    ? `<div><a href="${escapeAttribute(post.previous.url)}"><span aria-hidden="true">&larr; </span>${escapeHtml(post.previous.title)}</a></div>`
    : '<div></div>';
  const next = post.next
    ? `<div><a href="${escapeAttribute(post.next.url)}">${escapeHtml(post.next.title)}<span aria-hidden="true"> &rarr;</span></a></div>`
    : '<div></div>';
  const nav = post.previous || post.next ? `<nav class="post-nav" aria-label="Adjacent posts">${previous}${next}</nav>` : '';

  return renderLayout({
    activeTab: post.tab.slug,
    content: `
      <a class="back-link" href="${escapeAttribute(post.tab.path)}">&lt; rizhao</a>
      <article class="post-page">
        <header class="post-header">
          <h1>${escapeHtml(post.title)}</h1>
          ${renderMeta(post)}
        </header>
        <div class="post-content">${post.html}</div>
      </article>
      ${nav}
    `,
    description: post.excerpt,
    title: post.title,
  });
}

export function renderNotFoundPage(): string {
  return renderLayout({
    content: `
      <article class="post-page">
        <header class="post-header">
          <h1>Not found</h1>
        </header>
        <p>The page does not exist.</p>
      </article>
    `,
    title: 'Not found',
  });
}

function renderLayout({ activeTab, content, description = defaultDescription, title = "rizhao's garden" }: LayoutOptions): string {
  const tabs = getTabs();
  const pageTitle = title === "rizhao's garden" ? title : `${title} - rizhao's garden`;
  const tabLinks = tabs
    .map((tab) => {
      const activeClass = activeTab === tab.slug ? ' active' : '';
      return `<a class="tab-link${activeClass}" href="${escapeAttribute(tab.path)}">${escapeHtml(tab.label)}</a>`;
    })
    .join('');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(pageTitle)}</title>
    <meta name="description" content="${escapeAttribute(description)}">
    <link rel="stylesheet" href="/styles/global.css">
    <link rel="icon" href="/favicon.ico" sizes="any">
    <link rel="icon" type="image/png" href="/favicon-32x32.png" sizes="32x32">
    <link rel="icon" type="image/png" href="/favicon-16x16.png" sizes="16x16">
    <link rel="apple-touch-icon" href="/apple-touch-icon.png">
  </head>
  <body>
    <div class="site-shell">
      <header class="site-header">
        <h1 class="site-title"><a href="/">rizhao</a></h1>
        <p class="site-moment">Living in the moment!</p>
      </header>
      <div class="site-body">
        <nav class="tabs" aria-label="Sections">${tabLinks}</nav>
        <main class="content-column">
          ${content}
          <footer class="site-footer"><a href="/">rizhao</a></footer>
        </main>
        <div class="right-rail" aria-hidden="true"></div>
      </div>
    </div>
  </body>
</html>`;
}

function renderPostList(posts: PostMeta[], compact = false): string {
  if (posts.length === 0) {
    return '<p class="empty-state">No posts yet.</p>';
  }

  const items = posts
    .map((post) => {
      const excerpt = post.excerpt ? `<p>${escapeHtml(post.excerpt)}</p>` : '';
      return `
        <a class="post-link" href="${escapeAttribute(post.url)}" rel="bookmark">
          <article>
            <header>
              <h2>${escapeHtml(post.title)}</h2>
              ${renderMeta(post)}
            </header>
            ${excerpt}
          </article>
        </a>
      `;
    })
    .join('');

  return `<div class="post-list${compact ? ' compact' : ''}">${items}</div>`;
}

function renderDesignList(posts: PostMeta[]): string {
  if (posts.length === 0) {
    return '<p class="empty-state">No posts yet.</p>';
  }

  const items = posts
    .map((post) => {
      const image = post.coverImage
        ? `<img src="${escapeAttribute(post.coverImage)}" alt="${escapeAttribute(post.title)}" loading="lazy" decoding="async">`
        : '';

      return `
        <a class="design-link" href="${escapeAttribute(post.url)}" rel="bookmark">
          ${image}
          <p class="design-caption">${escapeHtml(post.title)}</p>
        </a>
      `;
    })
    .join('');

  return `<p class="tab-note">Perfection doesn't exist. Accept the randomness of life!</p><div class="design-list">${items}</div>`;
}

function renderMeta(post: PostMeta): string {
  const date = formatPostDate(post.date);
  const dateText = date ? `${escapeHtml(date)}<span aria-hidden="true"> &bull; </span>` : '';

  return `<small>${dateText}${escapeHtml(formatReadingTime(post.readingMinutes))}</small>`;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replace(/"/g, '&quot;');
}
