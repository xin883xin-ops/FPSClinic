/* 啟動、第一次設定、客人畫面／店員畫面切換 */
"use strict";
(function () {
  const { $, esc } = P;
  let mode = "";            // "setup" | "kiosk" | "staff" | "assist"
  let fails = 0, lockUntil = 0;

  function showKiosk() {
    if (mode === "staff") P.staff.unmount();
    if (mode === "kiosk" || mode === "assist") P.kiosk.unmount();
    mode = "kiosk";
    document.body.dataset.mode = "kiosk";
    P.kiosk.mount($("app"));
  }
  function showStaff() {
    if (mode === "kiosk" || mode === "assist") P.kiosk.unmount();
    if (mode === "staff") P.staff.unmount();
    mode = "staff";
    document.body.dataset.mode = "staff";
    P.primeAudio();
    P.staff.mount($("app"), { kiosk: showKiosk, assist: startAssist });
  }
  function startAssist() {
    P.staff.unmount();
    mode = "assist";
    document.body.dataset.mode = "kiosk";
    P.kiosk.mount($("app"), { assist: true, onExit: showStaff });
  }

  /* 店員密碼：連錯 5 次鎖 30 秒 */
  P.requestStaff = async () => {
    if (mode === "staff" || mode === "setup") return;
    if (!P.settings.pinHash) return showStaff();
    if (Date.now() < lockUntil) return P.alert(`輸入錯誤太多次，請 ${Math.ceil((lockUntil - Date.now()) / 1000)} 秒後再試。`);
    let hint = "";
    for (;;) {
      const pin = await P.askPin("店員密碼", hint);
      if (pin == null) return;
      if (await P.checkPin(pin)) { fails = 0; return showStaff(); }
      if (++fails >= 5) { fails = 0; lockUntil = Date.now() + 30000; return P.alert("輸入錯誤太多次，鎖定 30 秒。"); }
      hint = "密碼不對，再試一次（還有 " + (5 - fails) + " 次）";
    }
  };

  P.changePin = async () => {
    for (;;) {
      const cur = await P.askPin("更改密碼", "先輸入目前的密碼");
      if (cur == null) return;
      if (await P.checkPin(cur)) break;
      P.toast("目前的密碼不對");
    }
    const a = await P.askPin("新密碼", "請輸入 4 到 6 位數字"); if (a == null) return;
    const b = await P.askPin("再輸入一次", "確認新密碼"); if (b == null) return;
    if (a !== b) return P.alert("兩次輸入的密碼不一樣，沒有更改。");
    await P.setPin(a); P.toast("密碼已更改");
  };

  /* ---------- 第一次設定 ---------- */
  function showSetup() {
    mode = "setup";
    document.body.dataset.mode = "setup";
    $("app").innerHTML = `
      <section class="setup"><div class="setup-card">
        <div class="lights" aria-hidden="true"></div>
        <h1>KitLab 點餐收銀機</h1>
        <p class="lead">客人自己點餐，櫃檯接單收款，當天報表一鍵看。<br>第一次請<b>連著網路</b>開啟一次，之後<b>沒有網路也能用</b>，資料都存在這台裝置。</p>
        <form id="sf" autocomplete="off">
          <label>店名<input id="fShop" maxlength="16" value="${esc(P.settings.shop === "我的小店" ? "" : P.settings.shop)}" placeholder="例如 阿新快炒" required></label>
          <div class="two">
            <label>店員密碼（4–6 位數字）<input id="fPin" type="password" inputmode="numeric" pattern="\\d{4,6}" maxlength="6" required></label>
            <label>再輸入一次<input id="fPin2" type="password" inputmode="numeric" pattern="\\d{4,6}" maxlength="6" required></label>
          </div>
          <fieldset><legend>菜單</legend>
            <label class="rd"><input type="radio" name="fm" value="demo" checked> 先用示範菜單看看（之後可以改）</label>
            <label class="rd"><input type="radio" name="fm" value="blank"> 從空白開始，自己加</label>
          </fieldset>
          <label>啟用碼（沒有的話先用試用版，每天 ${P.DEMO_LIMIT} 筆訂單）<textarea id="fCode" rows="2" placeholder="KL1.…（選填）">${P.license ? "（已啟用）" : ""}</textarea></label>
          <p class="err" id="fErr" role="alert"></p>
          <button class="go wide" type="submit">開始使用</button>
        </form>
        <p class="fine">本系統不開立發票；是否需要開立、如何開立，請店家依法自行處理。</p>
      </div></section>`;
    $("sf").addEventListener("submit", async e => {
      e.preventDefault();
      const err = $("fErr"); err.textContent = "";
      const shop = $("fShop").value.trim(), pin = $("fPin").value, pin2 = $("fPin2").value, code = $("fCode").value.trim();
      if (!shop) { err.textContent = "請輸入店名"; return; }
      if (!/^\d{4,6}$/.test(pin)) { err.textContent = "密碼要是 4 到 6 位數字"; return; }
      if (pin !== pin2) { err.textContent = "兩次輸入的密碼不一樣"; return; }
      if (code && code.startsWith("KL1.")) { if (!(await P.activate(code))) { err.textContent = "啟用碼不正確，請確認有完整貼上。不填也可以先用試用版。"; return; } }
      P.settings.shop = shop; P.settings.setupDone = true;
      await P.setPin(pin);
      const demo = document.querySelector('input[name="fm"]:checked').value === "demo";
      P.menu = demo ? P.demoMenu() : { cats: [], items: [] };
      await P.saveMenu(); await P.saveSettings();
      if (demo) { showKiosk(); P.toast("設定好了。點右下角「店員」可以進入收銀畫面", 4500); } else { showStaff(); P.toast("設定好了，先到「菜單」加幾道餐點", 4500); }
    });
  }

  /* ---------- 啟動 ---------- */
  async function boot() {
    try { await P.init(); } catch (e) { console.error(e); }
    // 從連結啟用： https://kitlab.store/pos/#key=KL1.…
    const m = /[#&]key=([\w.\-]+)/.exec(location.hash);
    let activated = null;
    if (m) {
      activated = await P.activate(decodeURIComponent(m[1]));
      history.replaceState(null, "", location.pathname + location.search);
    }
    if (!P.settings.setupDone) showSetup();
    else if (location.hash === "#staff") { showKiosk(); P.requestStaff(); }
    else showKiosk();
    const b = $("boot"); if (b) { b.classList.add("off"); setTimeout(() => b.remove(), 400); }
    if (m) setTimeout(() => P.toast(activated ? "已啟用：" + (activated.s || "") : "啟用連結不正確", 4500), 400);
  }

  /* ---------- 事件 ---------- */
  P.on((type, data) => {
    if (type === "orders" && data && data.isNew && data.source !== "櫃檯") P.beep();
    if (mode === "staff") P.staff.onEvent(type, data);
  });
  document.addEventListener("pointerdown", () => P.primeAudio(), { once: true, capture: true });
  // 設定完成後，第一次碰螢幕就進入全螢幕、保持螢幕不休眠（瀏覽器規定要有人點一下才准）。只自動做一次，店員按 Esc 離開後不會再被拉回去。
  let fsTried = false;
  document.addEventListener("pointerdown", () => {
    if (mode === "setup") return;
    P.keepAwake();
    if (fsTried) return;
    fsTried = true;
    if (P.settings.autoFullscreen) P.goFullscreen();
  }, true);
  window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); P.installPrompt = e; });

  /* 離線快取（只在 https 或 localhost 才有效） */
  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1")) {
    const had = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register("sw.js").catch(() => {});
    navigator.serviceWorker.addEventListener("controllerchange", () => { if (had) P.toast("有新版本，下次重新開啟後生效", 5000); });
  }

  boot();
})();
