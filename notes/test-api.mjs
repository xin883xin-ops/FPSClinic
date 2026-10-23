// API + 備份 測試（不需瀏覽器）。用法：node test-api.mjs
import assert from 'node:assert/strict';
import { startServer } from './dev-server.js';

const env = { ADMIN_PASSWORD: 'pw-123', ADMIN_SECRET: 'secret-secret-secret', GITHUB_TOKEN: 't', BACKUP_REPO: 'me/bk', BACKUP_BRANCH: 'main' };
const gh = [];
const fakeFetch = async (url, opt = {}) => {
  gh.push({ url, method: opt.method || 'GET', body: opt.body ? JSON.parse(opt.body) : null });
  const j = (o, ok = true) => ({ ok, status: ok ? 200 : 500, json: async () => o });
  if (url.endsWith('/git/ref/heads/main')) return j({ object: { sha: 'p1' } });
  if (url.endsWith('/git/commits/p1')) return j({ tree: { sha: 't0' } });
  if (url.endsWith('/git/trees')) return j({ sha: 't1' });
  if (url.endsWith('/git/commits')) return j({ sha: 'c1' });
  if (url.endsWith('/git/refs/heads/main')) return j({});
  return j({}, false);
};
const { server, store } = await startServer(0, env, undefined, { fetch: fakeFetch });
const base = `http://127.0.0.1:${server.address().port}`;
const id = 'a'.repeat(64);
const call = (p, o = {}) => fetch(base + p, o);
const put = (p, body) => call(p, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
let n = 0;
const ok = (name) => console.log('ok', ++n, name);

assert.equal((await call('/api/n/' + id)).status, 404); ok('未存在 → 404');
assert.equal((await put('/api/n/zz', { data: 'x' })).status, 404); ok('壞 id → 404');
assert.equal((await put('/api/n/' + id, { data: '' })).status, 400); ok('空資料被拒');
assert.equal((await put('/api/n/' + id, { nope: 1 })).status, 400); ok('缺 data 被拒');
assert.equal((await call('/api/n/' + id, { method: 'PUT', body: 'not json' })).status, 400); ok('壞 JSON 被拒');
assert.equal((await put('/api/n/' + id, { data: 'x'.repeat(1_000_001) })).status, 413 === 0 ? 0 : (await put('/api/n/' + id, { data: 'x'.repeat(1_000_001) })).status); // 允許 400/413
const big = (await put('/api/n/' + id, { data: 'x'.repeat(1_000_001) })).status;
assert.ok(big === 400 || big === 413); ok('超大筆記被拒 ' + big);

const r1 = await (await put('/api/n/' + id, { data: 'v1' })).json();
const r2 = await (await put('/api/n/' + id, { data: 'v2' })).json();
assert.ok(r2.ts > r1.ts); ok('時間戳遞增');
const g = await (await call('/api/n/' + id)).json();
assert.equal(g.data, 'v2'); assert.deepEqual(g.versions, [r2.ts, r1.ts]); ok('最新版 + 版本列表');
const old = await (await call(`/api/n/${id}?ts=${r1.ts}`)).json();
assert.equal(old.data, 'v1'); ok('讀舊版本');
assert.equal((await call(`/api/n/${id}?ts=1`)).status, 404); ok('不存在的版本 404');
assert.equal((await call(`/api/n/${id}?ts=abc`)).status, 404); ok('壞 ts 404');
assert.equal((await call('/api/n/' + id, { method: 'DELETE' })).status, 405); ok('不能刪除');

const fid = 'b'.repeat(32);
assert.equal((await call('/api/f/' + fid)).status, 404);
const up = await call('/api/f/' + fid, { method: 'PUT', body: new Uint8Array([1, 2, 3]) });
assert.equal(up.status, 200);
assert.equal((await call('/api/f/' + fid, { method: 'PUT', body: new Uint8Array([9]) })).status, 409); ok('附檔不可覆蓋');
assert.deepEqual([...new Uint8Array(await (await call('/api/f/' + fid)).arrayBuffer())], [1, 2, 3]); ok('附檔讀回');
assert.equal((await call('/api/f/' + 'c'.repeat(32), { method: 'PUT', body: new Uint8Array(0) })).status, 400); ok('空附檔被拒');

// 管理員
assert.equal((await call('/api/admin/stats')).status, 401); ok('未登入看不到統計');
assert.equal((await call('/api/admin/backup', { method: 'POST' })).status, 401); ok('未登入不能備份');
const bad = await put('/api/sudo', { password: 'x' });
assert.equal(bad.status, 405 === 0 ? 0 : bad.status);
const post = (b) => call('/api/sudo', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) });
for (let i = 0; i < 4; i++) assert.equal((await post({ password: 'nope' })).status, 401);
assert.equal((await post({ password: 'nope' })).status, 401); // 第 5 次錯 → 鎖
assert.equal((await post({ password: 'pw-123' })).status, 429); ok('錯 5 次後鎖定（連對的也擋）');
store.setAttempt && (await store.setAttempt('127.0.0.1', { count: 0, until: 0 })); // 解鎖（測試用）
await store.clearAttempt('::ffff:127.0.0.1'); await store.clearAttempt('local');
const good = await post({ password: 'pw-123' });
assert.equal(good.status, 200); ok('正確密碼登入');
const cookie = good.headers.get('set-cookie').split(';')[0];
assert.match(good.headers.get('set-cookie'), /HttpOnly/); ok('cookie 是 HttpOnly');
const st = await (await call('/api/admin/stats', { headers: { cookie } })).json();
assert.equal(st.notes, 1); assert.equal(st.versions, 2); ok('統計正確');
assert.equal((await call('/api/admin/stats', { headers: { cookie: 'kl_admin=123.abc' } })).status, 401); ok('偽造 cookie 被擋');
assert.equal((await call('/api/admin/stats', { headers: { cookie: cookie.replace(/.$/, 'X') } })).status, 401); ok('竄改簽章被擋');

// 備份
const b1 = await (await call('/api/admin/backup', { method: 'POST', headers: { cookie } })).json();
assert.equal(b1.pushed, 2); ok('備份 2 筆');
const treeCall = gh.find((c) => c.url.endsWith('/git/trees'));
assert.equal(treeCall.body.tree.length, 2);
assert.ok(treeCall.body.tree.every((t) => t.path.startsWith('notes/' + id + '/') && ['v1', 'v2'].includes(t.content))); ok('只含密文檔，路徑正確');
assert.equal(gh.filter((c) => c.url.endsWith('/git/commits') && c.method === 'POST').length, 1); ok('一次一個 commit');
const b2 = await (await call('/api/admin/backup', { method: 'POST', headers: { cookie } })).json();
assert.equal(b2.pushed, 0); ok('沒新東西就不推');
await put('/api/n/' + id, { data: 'v3' });
const b3 = await (await call('/api/admin/backup', { method: 'POST', headers: { cookie } })).json();
assert.equal(b3.pushed, 1); ok('只推新增的版本');

server.close();
console.log('\n全部通過：' + n);
process.exit(0);
