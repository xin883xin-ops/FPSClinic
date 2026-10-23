// 伺服器核心：不認得任何明文。只收「暗號雜湊 id」與「密文」。
// 在 Cloudflare Worker 與 Node 測試伺服器共用。store 介面見 d1store.js / dev-server.js。

const HEX64 = /^[0-9a-f]{64}$/;
const HEX32 = /^[0-9a-f]{32}$/;
export const MAX_NOTE = 1_000_000;
export const MAX_FILE = 25 * 1024 * 1024;
const MAX_FAILS = 5;
const LOCK_MS = 10 * 60 * 1000;
const SESSION_MS = 12 * 60 * 60 * 1000;

const json = (o, status = 200, headers = {}) =>
  new Response(JSON.stringify(o), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers },
  });

const te = new TextEncoder();
const b64u = (buf) =>
  btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function sha256(s) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', te.encode(s)));
}

async function sameSecret(a, b) {
  const [x, y] = await Promise.all([sha256(a), sha256(b)]);
  let d = 0;
  for (let i = 0; i < x.length; i++) d |= x[i] ^ y[i];
  return d === 0;
}

async function hmac(secret, msg) {
  const k = await crypto.subtle.importKey('raw', te.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64u(await crypto.subtle.sign('HMAC', k, te.encode(msg)));
}

async function makeToken(secret, now) {
  const exp = String(now + SESSION_MS);
  return exp + '.' + (await hmac(secret, exp));
}

async function checkToken(secret, token, now) {
  if (!token) return false;
  const [exp, sig] = token.split('.');
  if (!exp || !sig || !(Number(exp) > now)) return false;
  return sameSecret(sig, await hmac(secret, exp));
}

function getCookie(req, name) {
  const c = req.headers.get('cookie') || '';
  for (const part of c.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return v.join('=');
  }
  return '';
}

async function requireAdmin(req, env, now) {
  if (!env.ADMIN_SECRET) return false;
  return checkToken(env.ADMIN_SECRET, getCookie(req, 'kl_admin'), now);
}

export async function handle(req, env, store, deps = {}) {
  const now = (deps.now || Date.now)();
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;

  try {
    let m;

    // ---- 筆記（密文） ----
    if ((m = path.match(/^\/api\/n\/([0-9a-f]{64})$/)) && HEX64.test(m[1])) {
      const id = m[1];
      if (method === 'GET') {
        const tsParam = url.searchParams.get('ts');
        const versions = await store.listVersions(id);
        if (!versions.length) return json({ error: 'none' }, 404);
        let ts = versions[0];
        if (tsParam !== null) {
          ts = Number(tsParam);
          if (!versions.includes(ts)) return json({ error: 'no such version' }, 404);
        }
        const data = await store.getNote(id, ts);
        return json({ ts, data, versions });
      }
      if (method === 'PUT') {
        const raw = await req.text();
        if (raw.length > MAX_NOTE * 1.4) return json({ error: 'too large' }, 413);
        let body;
        try {
          body = JSON.parse(raw);
        } catch {
          return json({ error: 'bad json' }, 400);
        }
        if (!body || typeof body.data !== 'string' || !body.data.length || body.data.length > MAX_NOTE)
          return json({ error: 'bad data' }, 400);
        const ts = await store.putNote(id, body.data, now);
        return json({ ts });
      }
      return json({ error: 'method' }, 405);
    }

    // ---- 附檔（密文） ----
    if ((m = path.match(/^\/api\/f\/([0-9a-f]{32})$/)) && HEX32.test(m[1])) {
      const fid = m[1];
      if (method === 'PUT') {
        if (await store.hasFile(fid)) return json({ error: 'exists' }, 409);
        const len = Number(req.headers.get('content-length') || 0);
        if (len > MAX_FILE) return json({ error: 'too large' }, 413);
        const buf = await req.arrayBuffer();
        if (!buf.byteLength) return json({ error: 'empty' }, 400);
        if (buf.byteLength > MAX_FILE) return json({ error: 'too large' }, 413);
        await store.putFile(fid, buf);
        return json({ ok: true });
      }
      if (method === 'GET') {
        const body = await store.getFile(fid);
        if (!body) return json({ error: 'none' }, 404);
        return new Response(body, {
          headers: { 'content-type': 'application/octet-stream', 'cache-control': 'private, max-age=31536000, immutable' },
        });
      }
      return json({ error: 'method' }, 405);
    }

    // ---- 管理員 ----
    if (path === '/api/sudo' && method === 'POST') {
      if (!env.ADMIN_PASSWORD || !env.ADMIN_SECRET) return json({ error: 'not configured' }, 503);
      const ip = req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for') || 'local';
      const att = (await store.getAttempt(ip)) || { count: 0, until: 0 };
      if (att.until > now) return json({ error: 'locked', retryMs: att.until - now }, 429);
      let body = {};
      try {
        body = await req.json();
      } catch {}
      const pw = typeof body.password === 'string' ? body.password : '';
      if (!(await sameSecret(pw, env.ADMIN_PASSWORD))) {
        const count = (att.until && att.until <= now ? 0 : att.count) + 1;
        await store.setAttempt(ip, { count: count >= MAX_FAILS ? 0 : count, until: count >= MAX_FAILS ? now + LOCK_MS : 0 });
        return json({ error: 'wrong' }, 401);
      }
      await store.clearAttempt(ip);
      const token = await makeToken(env.ADMIN_SECRET, now);
      const secure = url.protocol === 'https:' ? '; Secure' : '';
      return json({ ok: true }, 200, {
        'set-cookie': `kl_admin=${token}; Path=/api; HttpOnly; SameSite=Strict; Max-Age=${SESSION_MS / 1000}${secure}`,
      });
    }

    if (path === '/api/admin/stats' && method === 'GET') {
      if (!(await requireAdmin(req, env, now))) return json({ error: 'auth' }, 401);
      const s = await store.stats();
      const last = Number((await store.getMeta('backup_seq')) || 0);
      const lastAt = Number((await store.getMeta('backup_at')) || 0);
      const lastErr = (await store.getMeta('backup_err')) || '';
      return json({ ...s, backupSeq: last, backupAt: lastAt, backupErr: lastErr, repo: env.BACKUP_REPO || '' });
    }

    if (path === '/api/admin/backup' && method === 'POST') {
      if (!(await requireAdmin(req, env, now))) return json({ error: 'auth' }, 401);
      if (!deps.runBackup) return json({ error: 'not available' }, 501);
      const r = await deps.runBackup();
      return json(r);
    }

    return json({ error: 'not found' }, 404);
  } catch (e) {
    return json({ error: 'server', detail: String((e && e.message) || e) }, 500);
  }
}
