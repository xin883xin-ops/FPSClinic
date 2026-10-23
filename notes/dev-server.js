// 本機測試用：記憶體版 store + 靜態檔案。用法：node dev-server.js
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handle } from './src/handler.js';
import { runBackup } from './src/backup.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), 'public');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css' };

export function memStore() {
  const notes = [];
  const files = new Map();
  const meta = new Map();
  const attempts = new Map();
  let seq = 0;
  return {
    notes,
    async putNote(id, data, now) {
      const last = Math.max(0, ...notes.filter((n) => n.id === id).map((n) => n.ts));
      const ts = now <= last ? last + 1 : now;
      notes.push({ seq: ++seq, id, ts, data });
      return ts;
    },
    async listVersions(id) {
      return notes.filter((n) => n.id === id).map((n) => n.ts).sort((a, b) => b - a);
    },
    async getNote(id, ts) {
      const n = notes.find((x) => x.id === id && x.ts === ts);
      return n ? n.data : null;
    },
    async versionsSince(s, limit) {
      return notes.filter((n) => n.seq > s).slice(0, limit);
    },
    async stats() {
      return { notes: new Set(notes.map((n) => n.id)).size, versions: notes.length };
    },
    async hasFile(f) {
      return files.has(f);
    },
    async putFile(f, buf) {
      files.set(f, buf);
    },
    async getFile(f) {
      return files.get(f) || null;
    },
    async getMeta(k) {
      return meta.has(k) ? meta.get(k) : null;
    },
    async setMeta(k, v) {
      meta.set(k, v);
    },
    async getAttempt(ip) {
      return attempts.get(ip) || null;
    },
    async setAttempt(ip, a) {
      attempts.set(ip, a);
    },
    async clearAttempt(ip) {
      attempts.delete(ip);
    },
  };
}

export function startServer(port, env = {}, store = memStore(), deps = {}) {
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname.startsWith('/api/')) {
        const chunks = [];
        for await (const c of req) chunks.push(c);
        const body = Buffer.concat(chunks);
        const r = new Request(url, {
          method: req.method,
          headers: req.headers,
          body: ['GET', 'HEAD'].includes(req.method) ? undefined : body,
        });
        const out = await handle(r, env, store, { runBackup: () => runBackup(env, store, deps.fetch), ...deps });
        const headers = {};
        out.headers.forEach((v, k) => (headers[k] = v));
        res.writeHead(out.status, headers);
        res.end(Buffer.from(await out.arrayBuffer()));
        return;
      }
      let p = url.pathname === '/' ? '/index.html' : url.pathname;
      p = path.normalize(p).replace(/^(\.\.[/\\])+/, '');
      const data = await fs.readFile(path.join(root, p));
      res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' });
      res.end(data);
    } catch (e) {
      res.writeHead(e.code === 'ENOENT' ? 404 : 500);
      res.end('error');
    }
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve({ server, store })));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const env = { ADMIN_PASSWORD: 'letmein', ADMIN_SECRET: 'dev-secret-dev-secret' };
  startServer(8787, env).then(() => console.log('http://127.0.0.1:8787'));
}
