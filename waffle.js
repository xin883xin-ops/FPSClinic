/* KitLab 全家桶：右上角九個小點，點開是 KitLab 所有的作品（像 Google、Microsoft 的應用程式選單）。
   新增作品：在下面 APPS 加一筆。每個頁面只要 <script src="…/waffle.js" defer></script>，會自動放進 .top .wrap（或 Dash 的 .bar）。 */
(function () {
  "use strict";
  var src = (document.currentScript && document.currentScript.src) || "";
  var ROOT = src ? src.replace(/waffle\.js(\?.*)?$/, "") : "/";
  var G = function (bg, inner) { return "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><rect width="96" height="96" rx="22" fill="' + bg + '"/>' + inner + "</svg>"); };
  var APPS = [
    { n: "KitLab 商店", u: "", ic: "icons/icon-192.png" },
    { n: "Dash 啟動台", u: "launcher/", ic: "launcher/icons/app-192.png" },
    { n: "點餐收銀機", u: "pos/about.html", ic: "pos/icons/icon-192.png" },
    { n: "驅動檢查備份", u: "drivers/", data: G("#1B3A44", '<g fill="none" stroke="#5FD3BC" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"><rect x="18" y="26" width="60" height="30" rx="6"/><path d="M48 56v14M34 72h28M30 41h8M46 41h20"/></g>') },
    { n: "遊戲效能優化", u: "fpsclinic.html", data: G("#14323A", '<path d="M14 50h18l9-24 12 46 9-22h20" fill="none" stroke="#5FD3BC" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>') }
  ];
  var here = location.pathname.replace(/index\.html$/, "");

  var css = '.kw{position:relative;flex:none;margin-left:auto}.kw+*{margin-left:0;white-space:nowrap;flex:none}' +
    '@media(max-width:340px){.kw+.btn{padding-left:12px;padding-right:12px;font-size:13px}}' +
    '.kw-b{width:40px;height:40px;border-radius:50%;border:0;background:transparent;color:inherit;display:grid;place-items:center;cursor:pointer;padding:0}' +
    '.kw-b:hover,.kw-b[aria-expanded="true"]{background:rgba(128,138,150,.22)}' +
    '.kw-b:focus-visible{outline:2px solid #5FD3BC;outline-offset:2px}' +
    '.kw-b svg{width:22px;height:22px;fill:currentColor;display:block}' +
    '.kw-p{position:fixed;top:60px;right:12px;z-index:200;width:min(332px,calc(100vw - 24px));box-sizing:border-box;padding:18px 14px 14px;border-radius:20px;background:#16242D;color:#EAF2F5;border:1px solid rgba(255,255,255,.12);box-shadow:0 24px 60px -12px rgba(0,0,0,.55);font:500 14px/1.4 system-ui,-apple-system,"Noto Sans TC",sans-serif}' +
    '.kw-p[hidden]{display:none}' +
    '.kw-p h3{margin:0 8px 12px;font-size:12px;letter-spacing:.12em;font-weight:600;color:#8FA6B0}' +
    '.kw-g{display:grid;grid-template-columns:repeat(3,1fr);gap:4px}' +
    '.kw-g a{display:flex;flex-direction:column;align-items:center;gap:8px;padding:12px 4px 10px;border-radius:14px;color:inherit;text-decoration:none;text-align:center}' +
    '.kw-g a:hover,.kw-g a:focus-visible{background:rgba(255,255,255,.09);outline:none}' +
    '.kw-g a[aria-current="page"]{background:rgba(95,211,188,.14)}' +
    '.kw-g img{width:46px;height:46px;border-radius:12px;display:block;object-fit:cover}' +
    '.kw-g span{font-size:13px;line-height:1.3}' +
    '.kw-f{margin:10px 8px 0;padding-top:10px;border-top:1px solid rgba(255,255,255,.1);font-size:12px;color:#8FA6B0}';
  var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);

  var box = document.createElement("div"); box.className = "kw";
  var dots = ""; for (var i = 0; i < 9; i++) dots += '<circle cx="' + (5 + (i % 3) * 7) + '" cy="' + (5 + Math.floor(i / 3) * 7) + '" r="2"/>';
  box.innerHTML = '<button class="kw-b" type="button" aria-haspopup="true" aria-expanded="false" aria-label="KitLab 全家桶" title="KitLab 全家桶" data-nav><svg viewBox="0 0 24 24" aria-hidden="true">' + dots + '</svg></button>' +
    '<div class="kw-p" hidden role="menu" aria-label="KitLab 全家桶"><h3>KITLAB</h3><div class="kw-g">' +
    APPS.map(function (a) {
      var href = ROOT + a.u, cur = a.u && (here.indexOf(new URL(href, location.href).pathname.replace(/index\.html$/, "")) === 0);
      return '<a role="menuitem" href="' + href + '"' + (cur ? ' aria-current="page"' : "") + ' data-nav><img src="' + (a.data || ROOT + a.ic) + '" alt="" width="46" height="46"><span>' + a.n + "</span></a>";
    }).join("") + '</div><div class="kw-f">KitLab 官方作品</div></div>';

  var btn = box.firstChild, pan = box.lastChild;
  function place() {
    var h = document.querySelector(".top,.bar"), br = btn.getBoundingClientRect(), w = pan.offsetWidth, vw = window.innerWidth;
    pan.style.top = ((h && !h.classList.contains("bar") ? h.getBoundingClientRect().bottom : br.bottom) + 6) + "px";
    /* 面板右邊對齊按鈕，但不能讓左邊超出視窗：窄螢幕就退到右邊留 12px */
    pan.style.right = Math.max(12, Math.min(Math.round(vw - br.right), vw - w - 12)) + "px";
  }
  function set(on) { pan.hidden = !on; btn.setAttribute("aria-expanded", on ? "true" : "false"); if (on) place(); }
  window.addEventListener("resize", function () { if (!pan.hidden) place(); });
  btn.addEventListener("click", function (e) { e.stopPropagation(); set(pan.hidden); });
  document.addEventListener("click", function (e) { if (!pan.hidden && !box.contains(e.target)) set(false); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !pan.hidden) { set(false); btn.focus(); e.stopPropagation(); } }, true);

  function mount() {
    var host = document.querySelector(".top .wrap") || document.querySelector(".bar");
    if (!host) return;
    /* 順序：九個點在選單（或最右邊的按鈕）左邊，選單永遠在最右。
       把九個點插在最後一個元素前面；如果那個元素原本靠 margin-left:auto 推到右邊，這個推力改由九個點接手。 */
    var last = host.lastElementChild;
    if (!last) { host.appendChild(box); return; }
    var push = (parseFloat(getComputedStyle(last).marginLeft) || 0) > 8;
    host.insertBefore(box, last);
    if (push) last.style.marginLeft = "0";
    box.style.marginLeft = push ? "auto" : (host.classList.contains("bar") ? "4px" : "0");
    if (!push && !host.classList.contains("bar")) {
      /* 如果前面的元素沒有把這組按鈕推到最右，自己用 auto 推過去 */
      var hr = host.getBoundingClientRect(), lr = last.getBoundingClientRect(), pad = parseFloat(getComputedStyle(host).paddingRight) || 0;
      if (hr.right - pad - lr.right > 8) box.style.marginLeft = "auto";
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount); else mount();
})();
