/* KitLab 線上聊天：全站共用，只改這一支。
   用法：頁面底部加 <script src="chat.js" defer></script>（子資料夾用 ../chat.js）。
   手機底部有固定按鈕列的頁面，加 data-lift="84"，聊天圖示就會往上抬，不蓋住按鈕。
   任何帶 data-chat 的連結或按鈕，點下去都會展開聊天視窗。 */
(function () {
  "use strict";
  var TAWK = "6acbe49bf5cc5c34c2fbba6f/1k4m7a0ct";   // tawk.to 的 propertyId/widgetId
  var me = document.currentScript;
  var lift = me ? parseInt(me.getAttribute("data-lift"), 10) || 0 : 0;

  window.Tawk_API = window.Tawk_API || {};
  window.Tawk_LoadStart = new Date();
  if (lift) Tawk_API.customStyle = { visibility: { mobile: { position: "br", xOffset: 12, yOffset: lift } } };

  var ready = false, wantOpen = false;
  var prevOnLoad = Tawk_API.onLoad;
  Tawk_API.onLoad = function () {
    ready = true;
    if (typeof prevOnLoad === "function") prevOnLoad();
    if (wantOpen) Tawk_API.maximize();
  };

  var s = document.createElement("script");
  s.async = true;
  s.src = "https://embed.tawk.to/" + TAWK;
  s.charset = "UTF-8";
  s.setAttribute("crossorigin", "*");
  document.head.appendChild(s);

  document.addEventListener("click", function (e) {
    var t = e.target && e.target.closest ? e.target.closest("[data-chat]") : null;
    if (!t) return;
    e.preventDefault();
    if (ready && typeof Tawk_API.maximize === "function") Tawk_API.maximize();
    else wantOpen = true;   // 還在載入：載好就自動展開
  });
})();
