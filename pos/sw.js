/* KitLab 點餐收銀機 service worker：把整個 App 存在裝置裡，沒有網路也能開。
   所有檔案都先連網路拿最新，連不上才用裝置裡存的，所以改了程式不用動版本號。 */
const VERSION = "pos-v2";
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

  // 先連網路拿最新（改了程式不用動版本號），連不上才用裝置裡存的（沒網路也能開）
  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    try {
      const res = await fetch(req);
      if (res && (res.ok || res.type === "opaque")) cache.put(req, res.clone());
      return res;
    } catch (_) {
      const hit = await cache.match(req, { ignoreSearch: true });
      if (hit) return hit;
      if (req.mode === "navigate") { const home = await cache.match("index.html"); if (home) return home; }
      return new Response("", { status: 504, statusText: "offline" });
    }
  })());
});
