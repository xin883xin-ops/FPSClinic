var SCRIPT_URL = (document.currentScript && document.currentScript.src) || location.href;

/* 站長設定：全站只改這裡 ------------------------------------------- */
var FPS_URL = "fpsclinic.html";          // FPSClinic 頁面網址（相對路徑）
var SITE199_URL = "site199/";           // 199 一頁式網頁服務頁（相對路徑）

/* 技能清單：搜尋與「找對技能」都讀這一份。之後新增技能包，在這裡加一筆 */
var SKILLS = [
  { id: "fps",  name: "遊戲效能遠端優化", by: "FPSClinic", url: FPS_URL, price: "試營運免費",
    words: "遊戲 卡頓 掉幀 fps 效能 優化 內顯 筆電 團戰 英雄聯盟 lol 電腦 慢", cat: "遊戲／電腦" },
  { id: "s199", name: "30 分鐘一頁式網頁", by: "KitLab 官方", url: SITE199_URL, price: "NT$199",
    words: "網站 網頁 一頁 店家 商店 介紹頁 上線 部署 網域 官網", cat: "網站／上線" },
  { id: "launcher", name: "KitLab Dash 精選站點啟動台", by: "KitLab 官方", url: "launcher/about.html", price: "免費",
    words: "dash kitlab 免費 啟動台 啟動器 launcher pwa 雲遊戲 cloud game 工具 網站 收藏 推薦 車機", cat: "免費工具" },
  { id: "app",  name: "Android App 開發", by: "KitLab 官方", url: "#", price: "即將推出", soon: true,
    words: "app 應用程式 安卓 android flutter 上架 play 開發", cat: "App 開發" }
];

(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* 手機選單 */
  var burger = $("#burger"), menu = $("#menu");
  if (burger && menu) {
    burger.addEventListener("click", function () {
      var open = menu.classList.toggle("open");
      burger.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  /* 工具箱：右側滑出的側邊欄（內容是 side.html 的嵌入模式）。手機上撐滿整個畫面。
     第一次靠近或點按鈕時才載入內容；Esc、點遮罩、側邊欄裡的 ✕ 都會收合。 */
  var tbBtn = $("#open-toolbox"), tb = $("#toolbox"), tbScrim = $("#toolbox-scrim"), tbFrame = $("#toolbox-frame"), tbOpen = false, tbTimer = null;
  function loadToolbox() { if (tbFrame && !tbFrame.getAttribute("src")) tbFrame.src = tbFrame.getAttribute("data-src"); }
  function setToolbox(on) {
    if (!tb || on === tbOpen) return;
    tbOpen = on; clearTimeout(tbTimer);
    if (on) {
      loadToolbox();
      tb.removeAttribute("inert"); tb.classList.add("open");
      tbScrim.hidden = false; requestAnimationFrame(function () { tbScrim.classList.add("on"); });
      document.documentElement.classList.add("toolbox-open");
      if (tbBtn) tbBtn.setAttribute("aria-expanded", "true");
      tbTimer = setTimeout(function () { try { tbFrame.contentWindow.focus(); } catch (e) {} }, 360);
    } else {
      tb.classList.remove("open"); tb.setAttribute("inert", "");
      tbScrim.classList.remove("on"); tbTimer = setTimeout(function () { if (!tbOpen) tbScrim.hidden = true; }, 320);
      document.documentElement.classList.remove("toolbox-open");
      if (tbBtn) { tbBtn.setAttribute("aria-expanded", "false"); tbBtn.focus(); }
    }
  }
  if (tb && tbScrim && tbFrame) {
    if (tbBtn) {
      tbBtn.addEventListener("click", function () { setToolbox(!tbOpen); });
      ["pointerenter", "focus", "touchstart"].forEach(function (ev) { tbBtn.addEventListener(ev, loadToolbox, { once: true, passive: true }); });
    }
    tbScrim.addEventListener("click", function () { setToolbox(false); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && tbOpen) setToolbox(false); });
    window.addEventListener("message", function (e) {
      if (e.origin !== location.origin || !e.data || e.data.type !== "toolbox-close") return;
      setToolbox(false);
    });
  }

  /* 搜尋面板 */
  var panel = $("#search"), input = $("#q"), out = $("#results");
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function render(term) {
    if (!out) return;
    var t = (term || "").trim().toLowerCase();
    var hit = SKILLS.filter(function (s) {
      return !t || (s.name + " " + s.by + " " + s.words + " " + s.cat).toLowerCase().indexOf(t) > -1;
    });
    if (!hit.length) {
      out.innerHTML = '<p class="none">還沒有這個技能。<a href="#" data-chat>告訴我們你想要什麼</a>，我們會排進清單。</p>';
      return;
    }
    out.innerHTML = hit.map(function (s) {
      return '<a href="' + esc(s.url) + '"' + (s.soon ? ' aria-disabled="true"' : '') + '><b>' + esc(s.name) + '</b><span>' +
        esc(s.cat) + ' · ' + esc(s.price) + '</span></a>';
    }).join("");
  }
  function openSearch() { if (!panel) return; panel.classList.add("open"); render(""); setTimeout(function () { input && input.focus(); }, 30); }
  function closeSearch() { panel && panel.classList.remove("open"); }
  $$("[data-open-search]").forEach(function (b) { b.addEventListener("click", openSearch); });
  if (panel) {
    panel.addEventListener("click", function (e) { if (e.target === panel) closeSearch(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeSearch(); });
    input && input.addEventListener("input", function () { render(input.value); });
    $("form", panel).addEventListener("submit", function (e) { e.preventDefault(); render(input.value); });
    $$(".pop button", panel).forEach(function (b) {
      b.addEventListener("click", function () { input.value = b.textContent; render(b.textContent); input.focus(); });
    });
  }

  /* 左右滑動的卡片列：箭頭（桌機）與頁碼點 */
  $$(".rail-wrap").forEach(function (wrap) {
    var rail = $(".rail", wrap), prev = $("[data-prev]", wrap), next = $("[data-next]", wrap);
    if (!rail) return;
    function step() { var c = rail.firstElementChild; return c ? c.getBoundingClientRect().width + 18 : rail.clientWidth * 0.8; }
    function sync() {
      var max = rail.scrollWidth - rail.clientWidth - 2;
      if (prev) prev.hidden = rail.scrollLeft <= 2;
      if (next) next.hidden = rail.scrollLeft >= max || max <= 0;
    }
    if (prev) prev.addEventListener("click", function () { rail.scrollBy({ left: -step(), behavior: "smooth" }); });
    if (next) next.addEventListener("click", function () { rail.scrollBy({ left: step(), behavior: "smooth" }); });
    rail.addEventListener("scroll", sync, { passive: true });
    window.addEventListener("resize", sync);
    sync();
  });

  /* 方塊頁碼：每個 [data-dots="#id"] 對應一個 rail */
  $$("[data-dots]").forEach(function (box) {
    var rail = $(box.getAttribute("data-dots"));
    if (!rail) return;
    var kids = Array.prototype.slice.call(rail.children);
    kids.forEach(function (k, i) {
      var d = document.createElement("button");
      d.type = "button"; d.setAttribute("aria-label", "第 " + (i + 1) + " 個");
      d.addEventListener("click", function () { rail.scrollTo({ left: k.offsetLeft - rail.offsetLeft, behavior: "smooth" }); });
      box.appendChild(d);
    });
    function mark() {
      var x = rail.scrollLeft, best = 0, bestD = 1e9;
      kids.forEach(function (k, i) { var dd = Math.abs((k.offsetLeft - rail.offsetLeft) - x); if (dd < bestD) { bestD = dd; best = i; } });
      if (rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 2) best = kids.length - 1;
      $$("button", box).forEach(function (d, i) { d.setAttribute("aria-current", i === best ? "true" : "false"); });
    }
    rail.addEventListener("scroll", mark, { passive: true });
    mark();
  });

  /* 滑鼠拖曳左右捲動（手機本來就能滑） */
  $$(".rail").forEach(function (rail) {
    var down = false, moved = false, sx = 0, sl = 0;
    rail.addEventListener("pointerdown", function (e) {
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      down = true; moved = false; sx = e.clientX; sl = rail.scrollLeft;
    });
    window.addEventListener("pointermove", function (e) {
      if (!down) return;
      var dx = e.clientX - sx;
      if (!moved && Math.abs(dx) > 5) { moved = true; rail.classList.add("dragging"); }
      if (moved) rail.scrollLeft = sl - dx;
    });
    window.addEventListener("pointerup", function () {
      if (!down) return;
      down = false; rail.classList.remove("dragging");
    });
    rail.addEventListener("click", function (e) { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } }, true);
    rail.addEventListener("dragstart", function (e) { e.preventDefault(); });
  });

  /* 捲動顯示 */
  var items = $$(".rv");
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
    }, { threshold: 0.12 });
    items.forEach(function (el) { io.observe(el); });
  } else { items.forEach(function (el) { el.classList.add("in"); }); }

  /* PWA：安裝到桌面／主畫面，並註冊離線快取 */
  var installBtns = $$("[data-install]"), tip = $("#install-tip"), deferred = null;
  var standalone = (window.matchMedia && matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;
  function showInstall(on) { installBtns.forEach(function (b) { b.hidden = !on; }); }
  window.addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); deferred = e; if (!standalone) showInstall(true); });
  window.addEventListener("appinstalled", function () { deferred = null; showInstall(false); if (tip) tip.hidden = true; });
  var ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (ios && !standalone) showInstall(true);
  installBtns.forEach(function (b) {
    b.addEventListener("click", function () {
      if (deferred) {
        deferred.prompt();
        deferred.userChoice.then(function () { deferred = null; showInstall(false); });
      } else if (tip) { tip.hidden = !tip.hidden; }
    });
  });
  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register(new URL("sw.js", SCRIPT_URL).href).catch(function () {});
    });
  }
})();
