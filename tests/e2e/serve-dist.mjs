// dist를 /sub/path/ 하위 경로로 서비스하는 최소 정적 서버 (GitHub Pages 저장소 경로와 같은 조건)
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const port = Number(process.argv[2] ?? 4173);
const root = fileURLToPath(new URL('../../dist/', import.meta.url));
const base = '/sub/path/';
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png' };

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://x');
  if (!url.pathname.startsWith(base)) {
    res.writeHead(404).end('not under base');
    return;
  }
  let rel = decodeURIComponent(url.pathname.slice(base.length)) || 'index.html';
  const file = normalize(join(root, rel));
  if (!file.startsWith(root)) {
    res.writeHead(403).end();
    return;
  }
  try {
    const st = await stat(file);
    const path = st.isDirectory() ? join(file, 'index.html') : file;
    const body = await readFile(path);
    res.writeHead(200, { 'content-type': types[extname(path)] ?? 'application/octet-stream' }).end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
}).listen(port, '127.0.0.1', () => console.log(`serving dist at http://127.0.0.1:${port}${base}`));
