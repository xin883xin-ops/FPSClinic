/* KitLab 商店 service worker：離線可看已載入過的頁面。
   改了頁面或樣式後，把下面的版本號加 1，使用者下次開啟就會更新。 */
const VERSION = "v25";
const CACHE = "skillstore-" + VERSION;
const CORE = [
  "./", "index.html", "terms.html", "store.css", "style.css", "main.js", "side.html", "fpsclinic.html", "images/lol-demo.jpg", "manifest.webmanifest",
  "site199/", "site199/index.html", "drivers/", "drivers/index.html",
  "sync.js", "icons/icon.svg", "icons/icon-192.png", "icons/icon-512.png", "icons/maskable-512.png", "icons/apple-touch-icon.png",
  "pos/about.html", "waffle.js", "pos/preview.jpg", "site199/samplesite/thumbs/pos.jpg",
  "launcher/", "launcher/index.html", "launcher/about.html", "launcher/store/", "launcher/store/index.html", "launcher/sites.json", "launcher/manifest.webmanifest", "launcher/preview.jpg",
  "launcher/icons/app-192.png", "launcher/icons/app-512.png", "launcher/icons/app-apple-touch.png",
  "launcher/icons/squoosh.png", "launcher/icons/excalidraw.png", "launcher/icons/photopea.svg", "launcher/icons/tldraw.png",
  "launcher/icons/pairdrop.png", "launcher/icons/svgomg.png", "launcher/icons/xbox.svg", "launcher/icons/nvidia.svg",
  "launcher/icons/drawio.png", "launcher/icons/hoppscotch.png", "launcher/icons/kitlab-pos.png", "launcher/icons/kitlab-drivers.svg"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("skillstore-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // 頁面：先連網路拿最新，失敗再用快取（離線也打得開）
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); return res; })
        // 失敗時退回快取。嵌在頁面裡的 iframe（例如首頁的工具箱）找不到就直接失敗，不能退回首頁，
        // 否則工具箱會顯示成首頁、看起來像「按了沒反應又跳回首頁」。
        .catch(() => caches.match(req, { ignoreSearch: req.destination === "iframe" })
          .then((r) => r || (req.destination === "iframe" ? Response.error() : caches.match("index.html"))))
    );
    return;
  }

  // 啟動台的站點清單：先連網路拿最新一期，離線才用快取
  if (url.origin === location.origin && url.pathname.endsWith("/launcher/sites.json")) {
    e.respondWith(
      fetch(req)
        .then((res) => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); } return res; })
        .catch(() => caches.match(req, { ignoreSearch: true }))
    );
    return;
  }

  // 同網站的檔案：先給快取，背景更新
  if (url.origin === location.origin) {
    e.respondWith(
      caches.match(req).then((hit) => {
        const net = fetch(req)
          .then((res) => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); } return res; })
          .catch(() => hit);
        return hit || net;
      })
    );
  }
  // 其他網站（Google Fonts 等）不攔截，離線時用系統字型
});
