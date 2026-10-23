'use strict';
/* 帶鎖筆記：所有加解密都在這裡（瀏覽器）完成，伺服器只拿得到密文。 */

const $ = (s, r = document) => r.querySelector(s);
const enc = new TextEncoder();
const dec = new TextDecoder();
const hex = (u) => [...u].map((b) => b.toString(16).padStart(2, '0')).join('');
const b64 = (u) => {
  let s = '';
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(s);
};
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const rnd = (n) => crypto.getRandomValues(new Uint8Array(n));
const norm = (k) => k.normalize('NFKC').trim().toLowerCase();

function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v);
  }
  for (const c of kids) if (c != null) el.append(c);
  return el;
}
const svg = (d, size = 20) => {
  const t = document.createElement('template');
  t.innerHTML = `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  return t.content.firstChild;
};
const ICON_DOC = '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5"/>';
const ICON_DL = '<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>';
const ICON_LINK = '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>';

/* ---------- 加密 ---------- */
const ctxCache = new Map();
async function derive(key) {
  if (ctxCache.has(key)) return ctxCache.get(key);
  const base = await crypto.subtle.importKey('raw', enc.encode(key), 'PBKDF2', false, ['deriveBits']);
  const bits = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: enc.encode('kitlab-notes-v1'), iterations: 200000, hash: 'SHA-256' },
      base,
      512
    )
  );
  const aes = await crypto.subtle.importKey('raw', bits.slice(32), 'AES-GCM', false, ['encrypt', 'decrypt']);
  const ctx = { id: hex(bits.slice(0, 32)), aes };
  ctxCache.set(key, ctx);
  return ctx;
}
async function seal(aes, bytes) {
  const iv = rnd(12);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aes, bytes));
  const out = new Uint8Array(12 + ct.length);
  out.set(iv);
  out.set(ct, 12);
  return out;
}
async function unseal(aes, u8) {
  return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: u8.slice(0, 12) }, aes, u8.slice(12)));
}
const sealJSON = async (aes, obj) => b64(await seal(aes, enc.encode(JSON.stringify(obj))));
const openJSON = async (aes, s) => JSON.parse(dec.decode(await unseal(aes, unb64(s))));

/* ---------- 小工具 ---------- */
let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('on'), 2200);
}
const pad = (n) => String(n).padStart(2, '0');
const sameDay = (a, b) => a.toDateString() === b.toDateString();
function fmtTs(ts) {
  const d = new Date(ts);
  const now = new Date();
  const y = new Date(now.getTime() - 864e5);
  const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  if (sameDay(d, now)) return `今天 ${hm}`;
  if (sameDay(d, y)) return `昨天 ${hm}`;
  return `${d.getMonth() + 1}/${d.getDate()} ${hm}`;
}
function fmtRel(ts) {
  const d = new Date(ts);
  const now = new Date();
  if (sameDay(d, now)) return '今天';
  const days = Math.round((new Date(now.toDateString()) - new Date(d.toDateString())) / 864e5);
  if (days === 1) return '昨天';
  if (days < 7) return `${days} 天前`;
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
function fmtSize(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1048576).toFixed(1)} MB`;
}

async function api(method, path, body, raw) {
  const opt = { method, headers: {}, credentials: 'same-origin' };
  if (body !== undefined) {
    if (raw) {
      opt.body = body;
      opt.headers['content-type'] = 'application/octet-stream';
    } else {
      opt.body = JSON.stringify(body);
      opt.headers['content-type'] = 'application/json';
    }
  }
  return fetch(path, opt);
}

/* ---------- 最近（只存在這台裝置） ---------- */
const RKEY = 'kl_recent';
function loadRecent() {
  try {
    const a = JSON.parse(localStorage.getItem(RKEY) || '[]');
    return Array.isArray(a) ? a : [];
  } catch {
    return [];
  }
}
function touchRecent(key, files) {
  const n = norm(key);
  const list = loadRecent().filter((r) => norm(r.k) !== n);
  list.unshift({ k: key.trim(), ts: Date.now(), f: files || 0 });
  try {
    localStorage.setItem(RKEY, JSON.stringify(list.slice(0, 500)));
  } catch {}
}
function renderRecent() {
  const q = norm($('#key').value);
  const all = loadRecent();
  const list = q ? all.filter((r) => norm(r.k).includes(q)) : all;
  const ul = $('#recent');
  ul.replaceChildren();
  for (const r of list.slice(0, 50)) {
    const meta = fmtRel(r.ts) + (r.f ? ` · ${r.f} 個附檔` : '');
    ul.append(
      h(
        'li',
        {},
        h(
          'button',
          { class: 'item', type: 'button', onclick: () => openKey(r.k) },
          h('div', { class: 'ico' }, svg(ICON_DOC)),
          h('div', { class: 't' }, h('b', { text: r.k }), h('span', { text: meta }))
        )
      )
    );
  }
  $('#count').textContent = all.length ? `共 ${all.length} 則` : '';
}

/* ---------- 畫面切換 ---------- */
const VIEWS = ['home', 'note', 'edit', 'tools', 'sudo'];
function show(name) {
  for (const v of VIEWS) $('#v-' + v).hidden = v !== name;
  $('#fab').hidden = name !== 'home';
  window.scrollTo(0, 0);
}
function goHome() {
  S.ctx = null;
  show('home');
  renderRecent();
}

/* ---------- 狀態 ---------- */
const S = { key: '', ctx: null, note: null, ts: 0, versions: [] };
const E = { files: [], links: [], existing: false };

/* ---------- 打開 ---------- */
async function openKey(raw) {
  const key = norm(raw || '');
  if (!key) return;
  if (key.startsWith('.')) return special(key);
  try {
    S.key = raw.trim();
    S.ctx = await derive(key);
    const res = await api('GET', '/api/n/' + S.ctx.id);
    if (res.status === 404) {
      S.note = { t: '', links: [], files: [] };
      S.versions = [];
      S.ts = 0;
      return startEdit(false);
    }
    if (!res.ok) throw new Error('server');
    const j = await res.json();
    S.versions = j.versions;
    S.ts = j.ts;
    S.note = await openJSON(S.ctx.aes, j.data);
    touchRecent(S.key, S.note.files.length);
    showNote();
  } catch (e) {
    toast('打不開，請再試一次');
  }
}

function special(key) {
  if (key === '.tools') return openTools();
  if (key === '.sudo') return openSudo();
  toast('沒有這個功能');
}

/* ---------- 連結辨認 ---------- */
const okId = (id) => (/^[\w-]{6,20}$/.test(id || '') ? id : null);
function ytInfo(u) {
  try {
    const x = new URL(u);
    const host = x.hostname.replace(/^(www\.|m\.|music\.)/, '');
    let id = null;
    if (host === 'youtu.be') id = okId(x.pathname.slice(1).split('/')[0]);
    else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      if (x.pathname === '/watch') id = okId(x.searchParams.get('v'));
      else {
        const m = x.pathname.match(/^\/(shorts|embed|live|v)\/([^/?]+)/);
        if (m) id = okId(m[2]);
      }
    }
    if (!id) return null;
    const t = x.searchParams.get('t') || x.searchParams.get('start') || '';
    const sec = /^\d+$/.test(t) ? t : /^(\d+)s$/.test(t) ? t.slice(0, -1) : '';
    return { id, start: sec };
  } catch {
    return null;
  }
}
function renderLink(u) {
  if (!/^https?:\/\//i.test(u)) return null;
  const yt = ytInfo(u);
  if (yt) {
    const src = `https://www.youtube-nocookie.com/embed/${yt.id}?rel=0${yt.start ? '&start=' + yt.start : ''}`;
    return h(
      'div',
      { class: 'media' },
      h('iframe', {
        src,
        title: 'YouTube 影片',
        loading: 'lazy',
        allow: 'encrypted-media; picture-in-picture; fullscreen',
        allowfullscreen: '',
        referrerpolicy: 'strict-origin-when-cross-origin',
      })
    );
  }
  let path = '';
  try {
    path = new URL(u).pathname.toLowerCase();
  } catch {
    return null;
  }
  if (/\.(jpe?g|png|gif|webp|avif|svg)$/.test(path))
    return h('div', { class: 'media' }, h('img', { src: u, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' }));
  if (/\.(mp4|webm|mov|m4v)$/.test(path))
    return h('div', { class: 'media' }, h('video', { src: u, controls: '', preload: 'metadata', playsinline: '' }));
  if (/\.(mp3|m4a|wav|ogg|flac)$/.test(path))
    return h('div', { class: 'media' }, h('audio', { src: u, controls: '', preload: 'metadata' }));
  let label = u;
  try {
    label = new URL(u).hostname + (new URL(u).pathname === '/' ? '' : new URL(u).pathname);
  } catch {}
  return h(
    'a',
    { class: 'linkcard', href: u, target: '_blank', rel: 'noopener noreferrer' },
    h('div', { class: 'ico' }, svg(ICON_LINK)),
    h('span', { text: label })
  );
}

/* ---------- 筆記內文：``` 程式碼、[[暗號]] 互連 ---------- */
function renderBody(text, el) {
  el.replaceChildren();
  const parts = text.split('```');
  parts.forEach((part, i) => {
    if (i % 2 === 1) {
      const code = part.replace(/^[^\n]*\n/, (m) => (m.trim() ? '' : m)).replace(/^\n|\n$/g, '');
      el.append(h('pre', { text: code }));
      return;
    }
    const paras = part.replace(/^\n+|\n+$/g, '').split(/\n{2,}/);
    for (const para of paras) {
      if (!para) continue;
      const p = h('p');
      para.split(/(\[\[[^\]]+\]\])/).forEach((seg, j) => {
        if (j % 2 === 1) {
          const target = seg.slice(2, -2);
          p.append(h('button', { class: 'xref', type: 'button', onclick: () => openKey(target), text: target }));
        } else {
          seg.split('\n').forEach((line, k) => {
            if (k) p.append(document.createElement('br'));
            p.append(document.createTextNode(line));
          });
        }
      });
      el.append(p);
    }
  });
}

/* ---------- 筆記畫面 ---------- */
function showNote() {
  const latest = S.versions[0];
  $('#n-title').textContent = S.key;
  const chip = $('#n-ver');
  chip.replaceChildren(svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', 14), document.createTextNode(`${fmtTs(S.ts)} · 共 ${S.versions.length} 個版本`));
  $('#n-versions').hidden = true;
  $('#n-old').hidden = S.ts === latest;
  renderBody(S.note.t || '', $('#n-body'));
  const media = $('#n-media');
  media.replaceChildren();
  for (const u of S.note.links || []) {
    const el = renderLink(u);
    if (el) media.append(el);
  }
  const ul = $('#n-files');
  ul.replaceChildren();
  for (const f of S.note.files || []) {
    ul.append(
      h(
        'li',
        {},
        h(
          'button',
          { class: 'item', type: 'button', onclick: () => downloadFile(f) },
          h('div', { class: 'ico' }, svg(ICON_DOC)),
          h('div', { class: 't' }, h('b', { text: f.name }), h('span', { text: fmtSize(f.size) })),
          svg(ICON_DL)
        )
      )
    );
  }
  show('note');
}

function toggleVersions() {
  const ul = $('#n-versions');
  if (!ul.hidden) {
    ul.hidden = true;
    return;
  }
  ul.replaceChildren();
  S.versions.forEach((ts, i) => {
    ul.append(
      h(
        'li',
        {},
        h('button', { type: 'button', 'aria-current': String(ts === S.ts), onclick: () => loadVersion(ts), text: fmtTs(ts) + (i === 0 ? ' · 目前' : '') })
      )
    );
  });
  ul.hidden = false;
}

async function loadVersion(ts) {
  try {
    const res = await api('GET', `/api/n/${S.ctx.id}?ts=${ts}`);
    if (!res.ok) throw new Error('v');
    const j = await res.json();
    S.ts = j.ts;
    S.note = await openJSON(S.ctx.aes, j.data);
    showNote();
  } catch {
    toast('讀不到這個版本');
  }
}

async function restoreVersion() {
  await persist(S.note);
}

async function downloadFile(f) {
  try {
    toast('下載中…');
    const res = await api('GET', '/api/f/' + f.fid);
    if (!res.ok) throw new Error('f');
    const plain = await unseal(S.ctx.aes, new Uint8Array(await res.arrayBuffer()));
    const url = URL.createObjectURL(new Blob([plain], { type: f.mime || 'application/octet-stream' }));
    const a = h('a', { href: url, download: f.name });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  } catch {
    toast('下載失敗');
  }
}

/* ---------- 新增 / 編輯 ---------- */
function startEdit(existing) {
  E.existing = existing;
  E.files = (S.note.files || []).slice();
  E.links = (S.note.links || []).slice();
  const keyEl = $('#e-key');
  keyEl.value = S.key;
  keyEl.readOnly = !!S.ctx && (existing || !!S.key);
  $('#e-title').textContent = existing ? '編輯' : '新增';
  $('#e-text').value = S.note.t || '';
  $('#e-link').value = '';
  $('#e-fstatus').textContent = '附加檔案';
  renderEditLists();
  show('edit');
  (keyEl.readOnly ? $('#e-text') : keyEl).focus();
}
function newBlank() {
  S.key = '';
  S.ctx = null;
  S.note = { t: '', links: [], files: [] };
  S.versions = [];
  S.ts = 0;
  startEdit(false);
}
function renderEditLists() {
  const fl = $('#e-files');
  fl.replaceChildren();
  E.files.forEach((f, i) =>
    fl.append(
      h('li', {}, h('span', { text: `${f.name} · ${fmtSize(f.size)}` }), h('button', { type: 'button', 'aria-label': '移除', onclick: () => { E.files.splice(i, 1); renderEditLists(); }, text: '×' }))
    )
  );
  const ll = $('#e-links');
  ll.replaceChildren();
  E.links.forEach((u, i) =>
    ll.append(
      h('li', {}, h('span', { text: u }), h('button', { type: 'button', 'aria-label': '移除', onclick: () => { E.links.splice(i, 1); renderEditLists(); }, text: '×' }))
    )
  );
}
function addLink() {
  const v = $('#e-link').value.trim();
  if (!v) return true;
  if (!/^https?:\/\/\S+$/i.test(v)) {
    toast('連結要以 http:// 或 https:// 開頭');
    return false;
  }
  E.links.push(v);
  $('#e-link').value = '';
  renderEditLists();
  return true;
}
async function editCtx() {
  if (S.ctx) return S.ctx;
  const k = norm($('#e-key').value);
  if (!k || k.startsWith('.')) return null;
  return derive(k);
}
async function pickFiles(files) {
  const ctx = await editCtx();
  if (!ctx) return toast('先輸入暗號');
  for (const file of files) {
    if (file.size > 25 * 1024 * 1024) {
      toast(`${file.name} 超過 25 MB`);
      continue;
    }
    try {
      $('#e-fstatus').textContent = `上傳中 ${file.name}…`;
      const sealed = await seal(ctx.aes, new Uint8Array(await file.arrayBuffer()));
      const fid = hex(rnd(16));
      const res = await api('PUT', '/api/f/' + fid, sealed, true);
      if (!res.ok) throw new Error('up');
      E.files.push({ fid, name: file.name, size: file.size, mime: file.type });
    } catch {
      toast(`${file.name} 上傳失敗`);
    }
  }
  $('#e-fstatus').textContent = '附加檔案';
  renderEditLists();
}

async function persist(note) {
  const res = await api('PUT', '/api/n/' + S.ctx.id, { data: await sealJSON(S.ctx.aes, note) });
  if (!res.ok) throw new Error('save');
  const j = await api('GET', '/api/n/' + S.ctx.id).then((r) => r.json());
  S.versions = j.versions;
  S.ts = j.ts;
  S.note = note;
  touchRecent(S.key, note.files.length);
  toast('已存入');
  showNote();
}

async function save() {
  if (!addLink()) return;
  const raw = $('#e-key').value;
  const k = norm(raw);
  if (!k) return toast('要有暗號');
  if (k.startsWith('.')) return toast('點號開頭是保留字');
  const note = { t: $('#e-text').value, links: E.links.slice(), files: E.files.slice() };
  if (!note.t.trim() && !note.links.length && !note.files.length) return toast('沒有內容');
  const btn = $('#e-save');
  btn.disabled = true;
  try {
    if (!S.ctx) {
      const ctx = await derive(k);
      const ex = await api('GET', '/api/n/' + ctx.id);
      if (ex.ok) {
        S.key = raw.trim();
        S.ctx = ctx;
        toast('這個暗號已經有內容，已為你打開');
        return openKey(raw);
      }
      S.key = raw.trim();
      S.ctx = ctx;
    }
    await persist(note);
  } catch {
    toast('存不進去，請再試一次');
  } finally {
    btn.disabled = false;
  }
}

/* ---------- 工具箱 ---------- */
function openTools() {
  $('#t-pass').value = '';
  $('#t-in').value = '';
  $('#t-out').value = '';
  show('tools');
}
async function toolKey(pass, salt) {
  const base = await crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 200000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
async function toolEncrypt() {
  const pass = $('#t-pass').value;
  const text = $('#t-in').value;
  if (!pass || !text) return toast('密語和文字都要填');
  const salt = rnd(16);
  const sealed = await seal(await toolKey(pass, salt), enc.encode(text));
  const out = new Uint8Array(16 + sealed.length);
  out.set(salt);
  out.set(sealed, 16);
  $('#t-out').value = 'KL1.' + b64(out);
}
async function toolDecrypt() {
  const pass = $('#t-pass').value;
  const text = $('#t-in').value.trim();
  if (!pass || !text) return toast('密語和密文都要填');
  try {
    if (!text.startsWith('KL1.')) throw new Error('fmt');
    const raw = unb64(text.slice(4));
    const plain = await unseal(await toolKey(pass, raw.slice(0, 16)), raw.slice(16));
    $('#t-out').value = dec.decode(plain);
  } catch {
    $('#t-out').value = '';
    toast('解不開：密語不對，或密文不完整');
  }
}
async function toolHash() {
  const text = $('#t-in').value;
  if (!text) return toast('先輸入文字');
  $('#t-out').value = hex(new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(text))));
}
async function toolCopy() {
  const v = $('#t-out').value;
  if (!v) return toast('沒有結果');
  try {
    await navigator.clipboard.writeText(v);
    toast('已複製');
  } catch {
    $('#t-out').select();
    toast('請手動複製');
  }
}

/* ---------- 管理員 ---------- */
async function openSudo() {
  $('#s-pass').value = '';
  $('#s-login').hidden = false;
  $('#s-panel').hidden = true;
  show('sudo');
  loadStats(true);
}
async function loadStats(silent) {
  const res = await api('GET', '/api/admin/stats');
  if (!res.ok) {
    if (!silent) toast('需要重新登入');
    return false;
  }
  const s = await res.json();
  $('#s-login').hidden = true;
  $('#s-panel').hidden = false;
  const box = $('#s-stats');
  box.replaceChildren();
  const line = (label, val) => box.append(h('div', {}, document.createTextNode(label + '：'), h('b', { text: val })));
  line('暗號數', String(s.notes));
  line('版本數', String(s.versions));
  line('備份 repo', s.repo || '未設定');
  line('上次備份', s.backupAt ? fmtTs(s.backupAt) : '尚未');
  if (s.backupErr) line('備份錯誤', s.backupErr);
  return true;
}
async function sudoLogin(e) {
  e.preventDefault();
  const password = $('#s-pass').value;
  if (!password) return;
  const res = await api('POST', '/api/sudo', { password });
  $('#s-pass').value = '';
  if (res.status === 429) return toast('錯太多次，請稍後再試');
  if (!res.ok) return toast(res.status === 503 ? '伺服器還沒設定管理員密碼' : '密碼不對');
  loadStats(false);
}
async function sudoBackup() {
  const res = await api('POST', '/api/admin/backup');
  if (!res.ok) return toast('備份功能無法使用');
  const j = await res.json();
  toast(j.error ? '備份失敗：' + j.error : j.skipped ? '備份尚未設定' : `已備份 ${j.pushed} 筆`);
  loadStats(true);
}

/* ---------- 綁定 ---------- */
$('#f-open').addEventListener('submit', (e) => {
  e.preventDefault();
  const v = $('#key').value;
  $('#key').value = '';
  openKey(v);
});
$('#key').addEventListener('input', renderRecent);
$('#fab').addEventListener('click', newBlank);
$('#lock').addEventListener('click', () => {
  ctxCache.clear();
  S.key = '';
  S.note = null;
  $('#key').value = '';
  goHome();
  toast('已鎖上');
});
$('#n-edit').addEventListener('click', () => startEdit(true));
$('#n-ver').addEventListener('click', toggleVersions);
$('#n-restore').addEventListener('click', restoreVersion);
$('#e-pick').addEventListener('click', () => $('#e-file').click());
$('#e-file').addEventListener('change', (e) => {
  const files = [...e.target.files];
  e.target.value = '';
  pickFiles(files);
});
$('#e-addlink').addEventListener('click', addLink);
$('#e-link').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    addLink();
  }
});
$('#e-save').addEventListener('click', save);
$('#t-enc').addEventListener('click', toolEncrypt);
$('#t-dec').addEventListener('click', toolDecrypt);
$('#t-hash').addEventListener('click', toolHash);
$('#t-copy').addEventListener('click', toolCopy);
$('#s-login').addEventListener('submit', sudoLogin);
$('#s-backup').addEventListener('click', sudoBackup);

for (const b of document.querySelectorAll('.back')) {
  b.addEventListener('click', () => {
    const cur = b.closest('section').id;
    if (cur === 'v-edit' && E.existing && S.note) return showNote();
    goHome();
  });
}

// 彩蛋：連點「最近」5 下
let taps = 0;
let tapTimer;
$('#lbl-recent').addEventListener('click', () => {
  taps++;
  clearTimeout(tapTimer);
  tapTimer = setTimeout(() => (taps = 0), 1500);
  if (taps >= 5) {
    taps = 0;
    return openTools();
  }
  if (taps >= 3) toast(`再 ${5 - taps} 下`);
});

goHome();
