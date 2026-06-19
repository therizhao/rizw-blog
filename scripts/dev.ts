import fs from 'node:fs';
import path from 'node:path';
import { buildSite } from './build.ts';
import { serve } from './serve.ts';

const rootDir = process.cwd();
const watchTargets = ['content', 'images', 'public', 'src'].map((name) => path.join(rootDir, name));
let timer: NodeJS.Timeout | undefined;

buildSite();
serve();

for (const target of watchTargets) {
  if (!fs.existsSync(target)) {
    continue;
  }

  fs.watch(target, { recursive: true }, (_event, filename) => {
    if (!filename || shouldIgnore(filename.toString())) {
      return;
    }

    clearTimeout(timer);
    timer = setTimeout(() => {
      try {
        buildSite();
      } catch (error) {
        console.error(error);
      }
    }, 150);
  });
}

function shouldIgnore(filename: string): boolean {
  return filename.includes('node_modules') || filename.includes('.DS_Store') || filename.startsWith('_content') || filename.startsWith('_images');
}
