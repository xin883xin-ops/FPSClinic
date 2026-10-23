// 把 help 和三個 .info 說明寫進萬物說明書（帶鎖筆記）。
// 加密方式與 public/app.js 完全相同（暗號推導出代號與金鑰，伺服器只拿到密文），不需要任何管理員密碼或金鑰。
// 用法：node seed-info.mjs [網址]        預設 https://notes.kitlab.store
//       node seed-info.mjs --force      暗號已有內容時，新增一個新版本（舊版仍留在歷史裡）
// 已經有內容的暗號預設略過，不會覆蓋。寫完會讀回來解密比對。

const BASE = (process.argv.find((a) => /^https?:\/\//.test(a)) || 'https://notes.kitlab.store').replace(/\/$/, '');
const FORCE = process.argv.includes('--force');

const enc = new TextEncoder();
const dec = new TextDecoder();
const hex = (u) => [...u].map((b) => b.toString(16).padStart(2, '0')).join('');
const b64 = (u) => Buffer.from(u).toString('base64');
const unb64 = (s) => new Uint8Array(Buffer.from(s, 'base64'));
const norm = (k) => k.normalize('NFKC').trim().toLowerCase();

async function derive(key) {
  const base = await crypto.subtle.importKey('raw', enc.encode(key), 'PBKDF2', false, ['deriveBits']);
  const bits = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: enc.encode('kitlab-notes-v1'), iterations: 200000, hash: 'SHA-256' },
      base,
      512
    )
  );
  const aes = await crypto.subtle.importKey('raw', bits.slice(32), 'AES-GCM', false, ['encrypt', 'decrypt']);
  return { id: hex(bits.slice(0, 32)), aes };
}
async function sealJSON(aes, obj) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aes, enc.encode(JSON.stringify(obj))));
  const out = new Uint8Array(12 + ct.length);
  out.set(iv);
  out.set(ct, 12);
  return b64(out);
}
async function openJSON(aes, s) {
  const u8 = unb64(s);
  return JSON.parse(dec.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: u8.slice(0, 12) }, aes, u8.slice(12))));
}

const ENTRIES = {
  help: `萬物說明書是一個「輸入暗號就打開內容」的地方。

用法：在輸入框打一組暗號，按確認，對應的內容就會打開。

暗號用橫線連接，例如 kitlab-pos。在暗號後面加 .info，可以看那個東西的說明，例如 kitlab-pos.info。

可以先試試：

[[kitlab.info]]

[[kitlab-dash.info]]

[[kitlab-pos.info]]`,

  'kitlab.info': `KitLab 是放實用工具與服務的地方，目標是讓小店家和一般使用者用最少的步驟，把需要的東西做起來。

目前有點餐收銀機、精選站點啟動台，以及遊戲效能遠端優化、30 分鐘一頁式網頁、語音名片等服務。網址是 kitlab.store。`,

  'kitlab-dash.info': `KitLab Dash 是精選站點啟動台。官方挑選的 PWA 與雲遊戲站點，做成車機風的全螢幕畫面，一點就開，不用再翻書籤。

免費使用，不用登入，不收集資料，每兩週更新一期。`,

  'kitlab-pos.info': `KitLab 點餐收銀機給小店使用：客人自助點餐、櫃檯接單收款、當日報表，裝在店裡的平板或電腦上，沒有網路也能用。

買斷、不收月費，資料只存在你的裝置。可以免費試用，試用版功能完整，每天 20 筆訂單。網址是 kitlab.store/pos。`,
};

let failed = 0;
for (const [rawKey, text] of Object.entries(ENTRIES)) {
  const key = norm(rawKey);
  try {
    const ctx = await derive(key);
    const url = `${BASE}/api/n/${ctx.id}`;
    const ex = await fetch(url);
    if (ex.ok && !FORCE) {
      console.log(`略過  ${key}（已經有內容；要新增一個新版本請加 --force）`);
      continue;
    }
    if (!ex.ok && ex.status !== 404) throw new Error(`讀取失敗 HTTP ${ex.status}`);
    const note = { t: text, links: [], files: [] };
    const put = await fetch(url, { method: 'PUT', body: JSON.stringify({ data: await sealJSON(ctx.aes, note) }) });
    if (!put.ok) throw new Error(`寫入失敗 HTTP ${put.status}`);
    const back = await (await fetch(url)).json();
    const opened = await openJSON(ctx.aes, back.data);
    if (opened.t !== text) throw new Error('讀回來的內容和寫入的不一致');
    console.log(`已寫入  ${key}（${back.versions.length} 個版本）`);
  } catch (e) {
    failed++;
    console.log(`失敗  ${key}：${e.message}`);
  }
}
process.exit(failed ? 1 : 0);
