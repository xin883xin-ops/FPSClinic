/* 站長設定：全站只改這裡 ------------------------------------------- */
var LINE_ID = "xin883xin";              // 個人 ID 直接填；官方帳號請連 @ 一起填，例如 "@xxxx"
var FPS_URL = "https://xin883xin-ops.github.io/FPSClinic/"; // FPSClinic 頁面網址
var SITE199_URL = "site199/";           // 199 一頁式網頁服務頁（相對路徑）

/* 技能清單：搜尋與「找對技能」都讀這一份。之後新增技能包，在這裡加一筆 */
var SKILLS = [
  { id: "fps",  name: "遊戲效能遠端優化", by: "FPSClinic", url: FPS_URL, price: "試營運免費",
    words: "遊戲 卡頓 掉幀 fps 效能 優化 內顯 筆電 團戰 英雄聯盟 lol 電腦 慢", cat: "遊戲／電腦" },
  { id: "s199", name: "30 分鐘一頁式網頁", by: "官方", url: SITE199_URL, price: "NT$199",
    words: "網站 網頁 一頁 店家 商店 介紹頁 上線 部署 網域 官網", cat: "網站／上線" },
  { id: "app",  name: "Android App 開發", by: "官方", url: "#", price: "即將推出", soon: true,
    words: "app 應用程式 安卓 android flutter 上架 play 開發", cat: "App 開發" }
];

(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* LINE 連結與文字：所有 .line-link / .line-id 一起換 */
  var id = (LINE_ID || "").trim();
  if (id) {
    var url = id.charAt(0) === "@"
      ? "https://line.me/R/ti/p/" + encodeURIComponent(id)
      : "https://line.me/ti/p/~" + encodeURIComponent(id);
    $$("a.line-link").forEach(function (a) { a.href = url; a.target = "_blank"; a.rel = "noopener"; });
    $$(".line-id").forEach(function (el) { el.textContent = id; el.classList.remove("tbd"); });
  }

  /* 手機選單 */
  var burger = $("#burger"), menu = $("#menu");
  if (burger && menu) {
    burger.addEventListener("click", function () {
      var open = menu.classList.toggle("open");
      burger.setAttribute("aria-expanded", open ? "true" : "false");
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
      out.innerHTML = '<p class="none">還沒有這個技能。<a class="line-link" href="#wish">告訴我們你想要什麼</a>，我們會排進清單。</p>';
      if (id) $$("a.line-link", out).forEach(function (a) { a.href = url; a.target = "_blank"; });
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

  /* 找對技能 */
  var answer = $("#answer");
  var picks = {
    game: ['玩遊戲會卡、會掉幀。', "遊戲效能遠端優化", FPS_URL, "看 FPS 優化"],
    web:  ['想要一個自己的網站或店家頁面。', "30 分鐘一頁式網頁（NT$199）", SITE199_URL, "看一頁式網頁"],
    app:  ['想做一個 App。', "Android App 開發，目前還在準備中，先告訴我們你的想法。", "#wish", "留下需求"],
    other: ['都不像，或說不上來。', "沒關係，直接描述你遇到的狀況，我們看能不能處理。", "#wish", "描述我的問題"]
  };
  $$(".chips button").forEach(function (b) {
    b.addEventListener("click", function () {
      $$(".chips button").forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
      var p = picks[b.getAttribute("data-pick")];
      if (!p || !answer) return;
      answer.innerHTML = '<p><b>' + esc(p[0]) + '</b> 適合：' + esc(p[1]) + '</p><a class="btn small" href="' + esc(p[2]) + '">' + esc(p[3]) + ' →</a>';
      answer.classList.add("show");
    });
  });

  /* 捲動顯示 */
  var items = $$(".rv");
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
    }, { threshold: 0.12 });
    items.forEach(function (el) { io.observe(el); });
  } else { items.forEach(function (el) { el.classList.add("in"); }); }
})();
