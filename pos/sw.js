/* KitLab 點餐收銀機 service worker：把整個 App 存在裝置裡，沒有網路也能開。
   改了任何檔案後，把 VERSION 加 1，裝置下次有網路時就會自動更新。 */
const VERSION = "pos-v1";
const CORE = [
  "./", "index.html", "pos.css", "art.js", "core.js", "ui.js", "kiosk.js", "staff.js", "app.js",
  "manifest.webmanifest", "icons/icon.svg", "icons/icon-192.png", "icons/icon-512.png", "icons/icon-180.png", "icons/icon-maskable-512.png"
];
const FONT_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith("pos-") && k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const same = url.origin === location.origin;
  if (!same && !FONT_HOSTS.includes(url.hostname)) return;
  if (same && !url.pathname.startsWith(new URL("./", location.href).pathname)) return;

  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const hit = await cache.match(req, { ignoreSearch: true });
    // 先給快取（離線也立刻能開），同時在背景更新
    const net = fetch(req).then(res => {
      if (res && (res.ok || res.type === "opaque")) cache.put(req, res.clone());
      return res;
    }).catch(() => null);
    if (hit) { e.waitUntil(net); return hit; }
    const res = await net;
    if (res) return res;
    if (req.mode === "navigate") { const home = await cache.match("index.html"); if (home) return home; }
    return new Response("", { status: 504, statusText: "offline" });
  })());
});
