import type { Post, PostMeta } from './content.ts';
import { formatPostDate, formatReadingTime, WRITING_TAGS } from './content.ts';

const defaultDescription = "Rizhao's writings on making, climbing, design, and life.";
const contactEmail = 'rizhaow@gmail.com';

type Section = 'about' | 'writings';

type LayoutOptions = {
  activeSection?: Section;
  content: string;
  description?: string;
  /** Markup nested beneath the Writings nav item; only the writings list uses it. */
  nestedNav?: string;
  title?: string;
};

const navItems: { href: string; label: string; section: Section }[] = [
  { href: '/', label: 'About', section: 'about' },
  { href: '/writings/', label: 'Writings', section: 'writings' },
];

export function renderAboutPage(aboutPost: Post | undefined): string {
  const intro = aboutPost ? aboutPost.html : '';

  return renderLayout({
    activeSection: 'about',
    content: `
      <article class="about-page post-content">
        ${intro}
        <p class="about-contact">Contact: <a href="mailto:${contactEmail}">${contactEmail}</a></p>
      </article>
    `,
    description: aboutPost?.excerpt,
    title: 'About',
  });
}

// Tag filters live in the sidebar as children of the Writings item. One at a time:
// nothing selected is the default and means "everything". Shown on the writings list
// and on individual post pages so the filters stay reachable everywhere under Writings.
function renderTagToggles(): string {
  const toggles = WRITING_TAGS.map(
    (tag) =>
      `<button type="button" class="tag-filter" data-tag="${tag}" aria-pressed="false">${escapeHtml(capitalize(tag))}</button>`,
  ).join('');

  return `<div class="tab-nested" role="group" aria-label="Filter writings by tag">${toggles}</div>`;
}

export function renderWritingsPage(posts: PostMeta[]): string {
  const items = posts
    .map((post) => {
      // A cover image in the frontmatter replaces the text excerpt as the preview.
      const preview = post.coverImage
        ? `<img class="post-preview" src="${escapeAttribute(post.coverImage)}" alt="" loading="lazy" decoding="async">`
        : post.excerpt
          ? `<p>${escapeHtml(post.excerpt)}</p>`
          : '';

      return `
        <a class="post-link${post.coverImage ? ' has-preview' : ''}" data-tag="${escapeAttribute(post.tag)}" href="${escapeAttribute(post.url)}" rel="bookmark">
          <article>
            <header>
              <h2>${escapeHtml(post.title)}</h2>
              ${renderMeta(post)}
            </header>
            ${preview}
          </article>
        </a>
      `;
    })
    .join('');

  const list = posts.length > 0 ? `<div class="post-list">${items}</div>` : '<p class="empty-state">No posts yet.</p>';

  return renderLayout({
    activeSection: 'writings',
    nestedNav: renderTagToggles(),
    content: `
      ${list}
      <p class="empty-state filter-empty" hidden>Nothing tagged that yet.</p>
      ${filterScript}
    `,
    title: 'Writings',
  });
}

export function renderPostPage(post: Post): string {
  return renderLayout({
    activeSection: 'writings',
    nestedNav: renderTagToggles(),
    content: `
      <article class="post-page">
        <header class="post-header">
          <h1>${escapeHtml(post.title)}</h1>
          ${renderMeta(post)}
        </header>
        <div class="post-content">${post.html}</div>
      </article>
      ${postFilterScript}
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

function renderLayout({ activeSection, content, description = defaultDescription, nestedNav = '', title = "rizhao's garden" }: LayoutOptions): string {
  const pageTitle = title === "rizhao's garden" ? title : `${title} - rizhao's garden`;
  const navLinks = navItems
    .map((item) => {
      const activeClass = activeSection === item.section ? ' active' : '';
      const currentAttribute = activeSection === item.section ? ' aria-current="page"' : '';
      const link = `<a class="tab-link${activeClass}" href="${escapeAttribute(item.href)}"${currentAttribute}>${escapeHtml(item.label)}</a>`;
      const nested = item.section === 'writings' ? nestedNav : '';

      return nested ? `<div class="tab-group">${link}${nested}</div>` : link;
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
      </header>
      <div class="site-body">
        <nav class="tabs" aria-label="Sections">${navLinks}</nav>
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

function renderMeta(post: PostMeta): string {
  const date = formatPostDate(post.date);
  const dateText = date ? `${escapeHtml(date)}<span aria-hidden="true"> &bull; </span>` : '';

  return `<small>${dateText}${escapeHtml(formatReadingTime(post.readingMinutes))}</small>`;
}

const filterScript = `<script>
(function () {
  var KEY = 'writings-filter';
  var toggles = Array.prototype.slice.call(document.querySelectorAll('.tag-filter'));
  var posts = Array.prototype.slice.call(document.querySelectorAll('.post-list .post-link'));
  var emptyNote = document.querySelector('.filter-empty');
  if (!toggles.length) return;

  var tags = toggles.map(function (button) { return button.dataset.tag; });
  // null means no filter, which shows every post.
  var active = null;

  try {
    var stored = localStorage.getItem(KEY);
    if (tags.indexOf(stored) !== -1) active = stored;
  } catch (error) {}

  function apply() {
    var visible = 0;
    posts.forEach(function (post) {
      var show = active === null || post.dataset.tag === active;
      post.hidden = !show;
      if (show) visible++;
    });
    toggles.forEach(function (button) {
      button.setAttribute('aria-pressed', button.dataset.tag === active ? 'true' : 'false');
    });
    if (emptyNote) emptyNote.hidden = visible !== 0 || !posts.length;
    try {
      if (active === null) localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, active);
    } catch (error) {}
  }

  toggles.forEach(function (button) {
    button.addEventListener('click', function () {
      // Clicking the selected tag clears it, returning to the unfiltered list.
      active = active === button.dataset.tag ? null : button.dataset.tag;
      apply();
    });
  });

  apply();
})();
</script>`;

// On a post page there is no list to filter, so a toggle just records the choice and
// sends the reader to the writings list, where filterScript picks it up from storage.
const postFilterScript = `<script>
(function () {
  var KEY = 'writings-filter';
  var toggles = Array.prototype.slice.call(document.querySelectorAll('.tag-filter'));
  if (!toggles.length) return;

  var tags = toggles.map(function (button) { return button.dataset.tag; });
  var active = null;

  try {
    var stored = localStorage.getItem(KEY);
    if (tags.indexOf(stored) !== -1) active = stored;
  } catch (error) {}

  toggles.forEach(function (button) {
    button.setAttribute('aria-pressed', button.dataset.tag === active ? 'true' : 'false');
    button.addEventListener('click', function () {
      var next = active === button.dataset.tag ? null : button.dataset.tag;
      try {
        if (next === null) localStorage.removeItem(KEY);
        else localStorage.setItem(KEY, next);
      } catch (error) {}
      window.location.href = '/writings/';
    });
  });
})();
</script>`;

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replace(/"/g, '&quot;');
}
