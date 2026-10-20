/* KitLab 點餐收銀機 · 共用核心：資料庫、設定、菜單、訂單、啟用碼
   所有資料都存在這台裝置的瀏覽器（IndexedDB），不需要網路。 */
"use strict";
const P = window.P = {};
P.VERSION = "1.0.0";
P.$ = id => document.getElementById(id);
P.money = n => "$" + Math.round(Number(n) || 0).toLocaleString("en-US");
P.esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
P.pad = (n, w = 2) => String(n).padStart(w, "0");
P.dayOf = (d = new Date()) => d.getFullYear() + "-" + P.pad(d.getMonth() + 1) + "-" + P.pad(d.getDate());
P.timeOf = ts => { const d = new Date(ts); return P.pad(d.getHours()) + ":" + P.pad(d.getMinutes()); };
P.REDUCE = matchMedia("(prefers-reduced-motion: reduce)").matches;
P.DEMO_LIMIT = 20; // 試用版每天最多幾筆訂單

/* ---------- 資料庫（IndexedDB；不能用時退回記憶體，並提醒） ---------- */
const DB_NAME = "kitlab-pos";
let _db = null;
P.volatile = false;
const _mem = { kv: new Map(), orders: new Map() };

function openDB() {
  return new Promise(resolve => {
    if (!window.indexedDB) { P.volatile = true; return resolve(null); }
    let req;
    try { req = indexedDB.open(DB_NAME, 1); } catch (_) { P.volatile = true; return resolve(null); }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("kv")) db.createObjectStore("kv");
      if (!db.objectStoreNames.contains("orders")) db.createObjectStore("orders", { keyPath: "id" }).createIndex("day", "day");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = req.onblocked = () => { P.volatile = true; resolve(null); };
  });
}
const wrap = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

P.kvGet = async key => {
  if (!_db) return _mem.kv.get(key);
  return wrap(_db.transaction("kv").objectStore("kv").get(key));
};
P.kvSet = async (key, val) => {
  if (!_db) { _mem.kv.set(key, val); return; }
  await wrap(_db.transaction("kv", "readwrite").objectStore("kv").put(val, key));
};
P.orderPut = async o => {
  if (!_db) { _mem.orders.set(o.id, o); return; }
  await wrap(_db.transaction("orders", "readwrite").objectStore("orders").put(o));
};
P.orderGet = async id => {
  if (!_db) return _mem.orders.get(id);
  return wrap(_db.transaction("orders").objectStore("orders").get(id));
};
P.ordersByDay = async day => {
  if (!_db) return [..._mem.orders.values()].filter(o => o.day === day);
  return wrap(_db.transaction("orders").objectStore("orders").index("day").getAll(day));
};
P.ordersRange = async (from, to) => {
  if (!_db) return [..._mem.orders.values()].filter(o => o.day >= from && o.day <= to);
  return wrap(_db.transaction("orders").objectStore("orders").index("day").getAll(IDBKeyRange.bound(from, to)));
};
P.ordersAll = async () => {
  if (!_db) return [..._mem.orders.values()];
  return wrap(_db.transaction("orders").objectStore("orders").getAll());
};
P.ordersClear = async () => {
  if (!_db) { _mem.orders.clear(); return; }
  await wrap(_db.transaction("orders", "readwrite").objectStore("orders").clear());
};
/* 取下一個號碼：在同一個交易裡讀、加、寫，兩個分頁同時下單也不會撞號 */
P.nextNo = day => new Promise((resolve, reject) => {
  if (!_db) {
    const s = _mem.kv.get("seq") || { day, n: 0 };
    if (s.day !== day) { s.day = day; s.n = 0; }
    s.n++; _mem.kv.set("seq", s); return resolve(s.n);
  }
  const tx = _db.transaction("kv", "readwrite"), st = tx.objectStore("kv");
  const g = st.get("seq");
  let n = 1;
  g.onsuccess = () => {
    let s = g.result;
    if (!s || s.day !== day) s = { day, n: 0 };
    s.n++; n = s.n; st.put(s, "seq");
  };
  tx.oncomplete = () => resolve(n);
  tx.onerror = tx.onabort = () => reject(tx.error);
});

/* ---------- 跨分頁通知（同一台裝置開兩個視窗，例如客人螢幕和收銀螢幕） ---------- */
const chan = "BroadcastChannel" in window ? new BroadcastChannel("kitlab-pos") : null;
const listeners = [];
P.on = fn => listeners.push(fn);
P.emit = (type, data) => { listeners.forEach(f => { try { f(type, data, true); } catch (_) {} }); if (chan) chan.postMessage({ type, data }); };
if (chan) chan.onmessage = e => listeners.forEach(f => { try { f(e.data.type, e.data.data, false); } catch (_) {} });

/* ---------- 設定與菜單 ---------- */
P.defaults = () => ({
  setupDone: false, shop: "我的小店", accent: "#ffcf4a", pinHash: "", pinSalt: "",
  idleSec: 90, lastBackup: 0, created: Date.now()
});
P.settings = P.defaults();
P.menu = { cats: [], items: [] };
P.license = null; // { shop, d } 通過驗證才有

P.saveSettings = async () => { await P.kvSet("settings", P.settings); };
P.saveMenu = async () => { await P.kvSet("menu", P.menu); P.emit("menu"); };

P.applyAccent = () => {
  const c = /^#[0-9a-f]{6}$/i.test(P.settings.accent) ? P.settings.accent : "#ffcf4a";
  document.documentElement.style.setProperty("--lantern", c);
  // 亮色底配深字，暗色底配白字
  const r = parseInt(c.slice(1, 3), 16), g = parseInt(c.slice(3, 5), 16), b = parseInt(c.slice(5, 7), 16);
  document.documentElement.style.setProperty("--on-lantern", (r * 299 + g * 587 + b * 114) / 1000 > 140 ? "#2a1d00" : "#ffffff");
};

/* 示範菜單（和店面範例同一套插圖） */
P.demoMenu = () => ({
  cats: ["主食", "熱炒", "湯", "飲料"],
  items: [
    { id: "danfan", cat: "主食", name: "蛋炒飯", price: 70, desc: "粒粒分明，鍋氣很足。", tags: ["現炒"], art: "danfan" },
    { id: "chaomian", cat: "主食", name: "肉絲炒麵", price: 80, desc: "麵吸飽了湯汁，配高麗菜和肉絲。", tags: ["現炒"], art: "chaomian" },
    { id: "rice", cat: "主食", name: "白飯", price: 10, desc: "配熱炒吃的白飯。", tags: [], art: "rice" },
    { id: "sanbei", cat: "熱炒", name: "三杯雞", price: 220, desc: "麻油、薑和九層塔，一鍋都是香氣。", tags: ["招牌"], art: "sanbei" },
    { id: "beef", cat: "熱炒", name: "蔥爆牛肉", price: 250, desc: "大火快炒，牛肉嫩，蔥很香。", tags: ["現炒"], art: "beef" },
    { id: "kongxin", cat: "熱炒", name: "蒜炒空心菜", price: 120, desc: "脆脆的，蒜香很夠。", tags: ["當季"], art: "kongxin" },
    { id: "kugua", cat: "熱炒", name: "鹹蛋苦瓜", price: 150, desc: "鹹蛋壓過苦味，很下飯。", tags: [], art: "kugua" },
    { id: "caipu", cat: "熱炒", name: "菜脯蛋", price: 100, desc: "菜脯脆脆的，蛋煎得金黃。", tags: [], art: "caipu" },
    { id: "geli", cat: "湯", name: "蛤蠣湯", price: 100, desc: "薑絲和九層塔，湯頭很鮮。", tags: [], art: "geli" },
    { id: "gongwan", cat: "湯", name: "貢丸湯", price: 60, desc: "貢丸加芹菜，簡單的湯。", tags: [], art: "gongwan" },
    { id: "dong", cat: "飲料", name: "冬瓜茶", price: 30, desc: "自己熬的，不太甜。", tags: ["冰"], art: "dong" },
    { id: "hong", cat: "飲料", name: "古早味紅茶", price: 25, desc: "紅茶濃，沒有奶。", tags: ["冰"], art: "hong" }
  ].map(i => Object.assign({ soldOut: false }, i))
});

P.newId = () => "i" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

/* 菜色圖：照片優先，其次內建插圖，最後用名字第一個字做底圖 */
P.artHTML = it => {
  if (it.img) return `<img src="${it.img}" alt="" draggable="false">`;
  if (it.art && window.POS_ART && POS_ART.ART[it.art]) return `<svg viewBox="0 0 200 200" aria-hidden="true">${POS_ART.ART[it.art]()}</svg>`;
  let h = 0; for (const ch of String(it.name || it.id)) h = (h * 31 + ch.codePointAt(0)) % 360;
  const t = P.esc([...String(it.name || "?")][0] || "?");
  return `<svg viewBox="0 0 200 200" aria-hidden="true"><circle cx="100" cy="107" r="84" fill="#000" opacity=".28"/><circle cx="100" cy="100" r="84" fill="hsl(${h} 45% 38%)"/><circle cx="100" cy="100" r="72" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="3"/><text x="100" y="124" text-anchor="middle" font-size="76" font-weight="900" fill="#fff" font-family="inherit">${t}</text></svg>`;
};

/* ---------- PIN ---------- */
P.hashPin = async (pin, salt) => {
  const s = salt + ":" + pin;
  if (window.crypto && crypto.subtle) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
  }
  let h = 5381; for (const c of s) h = ((h << 5) + h + c.charCodeAt(0)) | 0; return "x" + h;
};
P.setPin = async pin => {
  P.settings.pinSalt = Math.random().toString(36).slice(2, 10);
  P.settings.pinHash = await P.hashPin(pin, P.settings.pinSalt);
  await P.saveSettings();
};
P.checkPin = async pin => P.settings.pinHash && (await P.hashPin(pin, P.settings.pinSalt)) === P.settings.pinHash;

/* ---------- 啟用碼（用公鑰離線驗證，不需要連線） ---------- */
const PUB = { kty: "EC", x: "AKDJpElmYzBG525hgqMNIC4IcYECbnJzaSKzNu2Fg34", y: "wb9phZxVVlkHGknxIBBrKD7ZYNtdM9quhZxNBfd2kEU", crv: "P-256", ext: true };
const unb64u = s => { s = s.replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "="; const b = atob(s); return Uint8Array.from(b, c => c.charCodeAt(0)); };
P.verifyCode = async code => {
  try {
    code = String(code || "").trim().replace(/\s+/g, "");
    const m = /^KL1\.([\w-]+)\.([\w-]+)$/.exec(code);
    if (!m || !(window.crypto && crypto.subtle)) return null;
    const key = await crypto.subtle.importKey("jwk", PUB, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
    const ok = await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, key, unb64u(m[2]), new TextEncoder().encode(m[1]));
    if (!ok) return null;
    return JSON.parse(new TextDecoder().decode(unb64u(m[1])));
  } catch (_) { return null; }
};
P.activate = async code => {
  const info = await P.verifyCode(code);
  if (!info) return null;
  code = String(code).trim().replace(/\s+/g, "");
  await P.kvSet("license", { code });
  P.license = info;
  if (info.s && (!P.settings.setupDone || P.settings.shop === "我的小店")) { P.settings.shop = info.s; await P.saveSettings(); }
  P.emit("license");
  return info;
};

/* ---------- 訂單 ---------- */
P.STATUS = { pending: "待收款", making: "製作中", ready: "可取餐", done: "已完成", cancelled: "已取消" };

P.todayCount = async () => (await P.ordersByDay(P.dayOf())).length;

/* lines: [{id, qty}] ；opts: {dine, label, note, source} */
P.placeOrder = async (lines, opts = {}) => {
  const items = [];
  for (const l of lines) {
    const it = P.menu.items.find(x => x.id === l.id);
    if (!it || it.soldOut || l.qty < 1) continue;
    items.push({ id: it.id, name: it.name, price: it.price, qty: l.qty });
  }
  if (!items.length) throw new Error("empty");
  const day = P.dayOf();
  if (!P.license && (await P.todayCount()) >= P.DEMO_LIMIT) throw new Error("demo-limit");
  const no = await P.nextNo(day);
  const order = {
    id: day + "-" + P.pad(no, 3), no, day, ts: Date.now(), items,
    total: items.reduce((s, i) => s + i.price * i.qty, 0),
    dine: opts.dine || "內用", label: (opts.label || "").trim().slice(0, 30), note: (opts.note || "").trim().slice(0, 120),
    source: opts.source || "客人", status: "pending", paid: false, received: 0, change: 0, paidTs: 0
  };
  await P.orderPut(order);
  P.emit("orders", { id: order.id, isNew: true, source: order.source });
  return order;
};
P.updateOrder = async (id, patch) => {
  const o = await P.orderGet(id);
  if (!o) return null;
  Object.assign(o, patch);
  await P.orderPut(o);
  P.emit("orders", { id, isNew: false });
  return o;
};

/* ---------- 備份 ---------- */
P.exportAll = async () => ({
  app: "kitlab-pos", v: 1, exportedAt: new Date().toISOString(),
  settings: P.settings, menu: P.menu, seq: await P.kvGet("seq"), orders: await P.ordersAll()
});
P.importAll = async data => {
  if (!data || data.app !== "kitlab-pos" || !data.settings || !data.menu || !Array.isArray(data.orders)) throw new Error("格式不對");
  await P.ordersClear();
  for (const o of data.orders) await P.orderPut(o);
  P.settings = Object.assign(P.defaults(), data.settings); P.menu = data.menu;
  await P.saveSettings(); await P.kvSet("menu", P.menu);
  if (data.seq) await P.kvSet("seq", data.seq);
  P.applyAccent(); P.emit("menu"); P.emit("orders", {});
};
P.download = (name, text, type = "application/json") => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
};

/* ---------- 啟動 ---------- */
P.init = async () => {
  _db = await openDB();
  const s = await P.kvGet("settings");
  if (s) P.settings = Object.assign(P.defaults(), s);
  const m = await P.kvGet("menu");
  if (m && Array.isArray(m.items)) P.menu = m;
  const lic = await P.kvGet("license");
  if (lic && lic.code) P.license = await P.verifyCode(lic.code);
  P.applyAccent();
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (_) {}
};
