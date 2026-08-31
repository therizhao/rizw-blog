import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { getAboutPost, getPost, getWritingPosts } from '../src/lib/content.ts';
import { renderAboutPage, renderNotFoundPage, renderPostPage, renderWritingsPage } from '../src/lib/site.ts';

const rootDir = process.cwd();
const distDir = path.join(rootDir, 'dist');

export function buildSite(): void {
  fs.rmSync(distDir, { force: true, recursive: true });
  fs.mkdirSync(distDir, { recursive: true });

  copyPublicFiles();
  copyStyles();
  copyContentAssets();
  copyImageAssets();

  const writingPosts = getWritingPosts();

  writePage('index.html', renderAboutPage(getAboutPost()));
  writePage(path.join('writings', 'index.html'), renderWritingsPage(writingPosts));

  for (const meta of writingPosts) {
    const post = getPost(meta.tab.slug, meta.slug);

    if (!post) {
      continue;
    }

    writePage(path.join(post.tab.slug, post.slug, 'index.html'), renderPostPage(post));
  }

  const notFound = renderNotFoundPage();
  writePage('404.html', notFound);
  writePage(path.join('404', 'index.html'), notFound);

  console.log(`Built ${writingPosts.length} writing posts.`);
}

function writePage(relativePath: string, html: string): void {
  const outputPath = path.join(distDir, relativePath);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, html);
}

function copyPublicFiles(): void {
  copyTree(path.join(rootDir, 'public'), distDir, (file) => {
    const relative = toPosix(path.relative(path.join(rootDir, 'public'), file));
    return !relative.startsWith('_content/') && !relative.startsWith('_images/') && path.basename(file) !== '.DS_Store';
  });
}

function copyStyles(): void {
  const stylesDir = path.join(distDir, 'styles');
  fs.mkdirSync(stylesDir, { recursive: true });
  fs.copyFileSync(path.join(rootDir, 'src', 'styles', 'global.css'), path.join(stylesDir, 'global.css'));
}

function copyContentAssets(): void {
  copyTree(path.join(rootDir, 'content'), path.join(distDir, '_content'), (file) => {
    const extension = path.extname(file).toLowerCase();
    return extension !== '.md' && extension !== '.mdx' && path.basename(file) !== '.DS_Store';
  });
}

function copyImageAssets(): void {
  copyTree(path.join(rootDir, 'images'), path.join(distDir, '_images'), (file) => path.basename(file) !== '.DS_Store');
}

function copyTree(source: string, target: string, shouldCopyFile: (file: string) => boolean): void {
  if (!fs.existsSync(source)) {
    return;
  }

  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);

    if (entry.isDirectory()) {
      copyTree(sourcePath, targetPath, shouldCopyFile);
      continue;
    }

    if (!entry.isFile() || !shouldCopyFile(sourcePath)) {
      continue;
    }

    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.copyFileSync(sourcePath, targetPath);
  }
}

function toPosix(value: string): string {
  return value.split(path.sep).join('/');
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  buildSite();
}
