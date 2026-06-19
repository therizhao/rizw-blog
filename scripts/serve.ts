import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const rootDir = process.cwd();
const distDir = path.join(rootDir, 'dist');

const contentTypes: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

export function serve(preferredPort = getPreferredPort()): http.Server {
  const server = http.createServer((request, response) => {
    const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
    const filePath = resolveFile(url.pathname);
    const extension = path.extname(filePath);

    response.setHeader('Content-Type', contentTypes[extension] ?? 'application/octet-stream');
    fs.createReadStream(filePath).pipe(response);
  });

  server.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
      server.listen(preferredPort + 1);
      return;
    }

    throw error;
  });

  server.listen(preferredPort, () => {
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : preferredPort;
    console.log(`Serving http://localhost:${port}`);
  });

  return server;
}

function resolveFile(urlPath: string): string {
  const decodedPath = decodeURIComponent(urlPath);
  const safePath = path
    .normalize(decodedPath)
    .replace(/^(\.\.(\/|\\|$))+/, '')
    .replace(/^\/+/, '');
  const basePath = path.join(distDir, safePath);
  const candidates = [
    basePath,
    path.join(basePath, 'index.html'),
    path.join(distDir, '404.html'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }

  return path.join(distDir, '404.html');
}

function getPreferredPort(): number {
  const value = process.env.PORT ?? process.argv[2] ?? '4321';
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : 4321;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  serve();
}
