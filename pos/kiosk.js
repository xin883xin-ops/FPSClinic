/* 客人點餐畫面：開始畫面 → 轉盤點餐 → 送出訂單 → 顯示號碼 */
"use strict";
(function () {
  const { $, esc, money } = P;
  let root = null, S = null;
  let idleTimer = 0, last = 0, tapN = 0, tapT = 0, doneT = 0, fitRO = null, raf = 0;

  const ROW = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--row")) || 72;
  const availItems = () => P.menu.items;
  const listNow = () => S.cat === "全部" ? availItems() : availItems().filter(i => i.cat === S.cat);
  const BY = id => P.menu.items.find(i => i.id === id);
  const total = () => [...S.cart].reduce((s, [id, q]) => { const it = BY(id); return s + (it ? it.price * q : 0); }, 0);
  const count = () => [...S.cart.values()].reduce((a, b) => a + b, 0);

  /* ---------- 進入 / 離開 ---------- */
  P.kiosk = {
    /* opts.assist：店員在櫃檯幫客人點（直接進入點餐，不顯示開始畫面） */
    mount(el, opts = {}) {
      root = el;
      S = { view: "attract", dine: "內用", cat: "全部", sel: 0, cart: new Map(), assist: !!opts.assist, onExit: opts.onExit || null };
      root.innerHTML = `<section class="kiosk" id="kiosk"></section>`;
      P.kiosk.onMenu = () => { if (!root || !S) return; syncCart(); if (S.view === "attract") renderAttract(); else { renderChips(); renderWheel(); renderCart(); } };
      if (S.assist) { S.view = "order"; renderOrder(); } else renderAttract();
      bindIdle();
    },
    unmount() { clearIdle(); clearTimeout(doneT); if (fitRO) { fitRO.disconnect(); fitRO = null; } root = null; S = null; }
  };
  P.on(type => {
    if (!root || !S) return;
    if (type === "menu" && P.kiosk.onMenu) P.kiosk.onMenu();
    else if (type === "orders" && S.view === "attract") refreshStaffBadge();
  });
  /* 開始畫面右下角的「店員」鈕，顯示還有幾張單沒處理，店員一眼就知道 */
  async function refreshStaffBadge() {
    const b = $("kStaff"); if (!b) return;
    const n = (await P.ordersByDay(P.dayOf())).filter(o => o.status === "pending" || o.status === "making" || o.status === "ready").length;
    b.innerHTML = n ? `店員<i>${n}</i>` : "店員";
    b.classList.toggle("has", n > 0);
  }

  /* 菜單被改過（例如剛賣完）：把買不到的拿掉並提醒 */
  function syncCart() {
    for (const [id] of [...S.cart]) {
      const it = BY(id);
      if (!it || it.soldOut) { S.cart.delete(id); if (it) P.toast(`「${it.name}」剛賣完了，已從訂單移除`); }
    }
    if (S.cat !== "全部" && !P.menu.cats.includes(S.cat)) S.cat = "全部";
  }

  /* ---------- 開始畫面 ---------- */
  function renderAttract() {
    S.view = "attract";
    const k = $("kiosk");
    const items = availItems().filter(i => !i.soldOut);
    const pick = [0, 1, 2].map(n => items.length ? items[Math.floor(n * items.length / 3 + (items.length > 3 ? 0 : 0)) % items.length] : null).filter(Boolean);
    const uniq = [...new Set(pick)];
    k.innerHTML = `
      <div class="k-attract">
        <div class="lights" aria-hidden="true"></div>
        ${P.license ? "" : `<div class="k-demo-tag">試用版</div>`}
        <div class="k-attract-in">
          <h1 id="kShop">${esc(P.settings.shop)}</h1>
          <p class="k-sub">${items.length ? "輕鬆點餐，點好了直接領號碼" : "還沒有建立菜單，請店員先設定"}</p>
          <div class="k-floats" aria-hidden="true">${uniq.map((it, i) => `<div class="fl f${i}">${P.artHTML(it)}</div>`).join("")}</div>
          ${items.length ? `<div class="k-start">
            <button type="button" class="big" data-dine="內用"><b>內用</b><span>在店裡吃</span></button>
            <button type="button" class="big alt" data-dine="外帶"><b>外帶</b><span>帶著走</span></button>
          </div>` : ""}
        </div>
        <button type="button" class="k-staff" id="kStaff">店員</button>
      </div>`;
    k.querySelector(".k-start") && k.querySelector(".k-start").addEventListener("click", e => {
      const b = e.target.closest("button[data-dine]"); if (!b) return;
      S.dine = b.dataset.dine; S.cart.clear(); S.cat = "全部"; S.sel = 0; renderOrder();
    });
    $("kStaff").addEventListener("click", () => P.requestStaff && P.requestStaff());
    refreshStaffBadge();
    $("kShop").addEventListener("click", () => {
      const now = Date.now(); tapN = now - tapT > 3000 ? 1 : tapN + 1; tapT = now;
      if (tapN >= 5) { tapN = 0; P.requestStaff && P.requestStaff(); }
    });
  }

  /* ---------- 點餐畫面 ---------- */
  function renderOrder() {
    S.view = "order";
    const k = $("kiosk");
    k.innerHTML = `
      <div class="k-order">
        <header class="k-head">
          <button type="button" class="k-back" id="kBack">${S.assist ? "← 回收銀" : "← 重選"}</button>
          <div class="k-title"><b>${esc(P.settings.shop)}</b><span class="k-dine" id="kDine">${S.assist ? "櫃檯點餐" : esc(S.dine)}</span></div>
          ${P.license ? "<span></span>" : `<span class="k-demo-tag s">試用版</span>`}
        </header>
        <div class="k-main">
          <section class="k-hero" aria-live="polite">
            <div class="stage" id="kStage"><div class="art" id="kArt"></div><span class="badge" id="kBadge">1</span></div>
            <h2 id="kName"></h2>
            <p class="desc" id="kDesc"></p>
            <div class="pricing" id="kPrice"></div>
            <div class="k-addrow">
              <button type="button" class="minus" id="kMinus" aria-label="少一份">−</button>
              <button type="button" class="add" id="kAdd">加入</button>
            </div>
          </section>
          <section class="k-pick">
            <div class="chips" id="kChips" role="group" aria-label="分類"></div>
            <div class="wheel-wrap"><div class="wheel" id="kWheel" role="listbox" aria-label="菜單轉盤" tabindex="0"></div></div>
          </section>
        </div>
        <div class="k-cart" id="kCart">
          <div class="sum"><span id="kCnt">還沒點東西</span><b id="kTotal">$0</b></div>
          <button type="button" class="go" id="kOpen" disabled>看訂單</button>
        </div>
      </div>
      <div class="k-scrim" id="kScrim"></div>
      <div class="k-sheet" id="kSheet" role="dialog" aria-modal="true" aria-label="我的訂單"></div>
      <div class="k-idle" id="kIdle" hidden></div>`;
    $("kBack").addEventListener("click", async () => {
      if (S.assist) return exit();
      if (count() && !(await P.confirm("要清掉這份訂單，回到開始畫面嗎？", "清掉重來", true))) return;
      S.cart.clear(); renderAttract();
    });
    $("kAdd").addEventListener("click", addCurrent);
    $("kMinus").addEventListener("click", minusCurrent);
    $("kOpen").addEventListener("click", openSheet);
    $("kScrim").addEventListener("click", closeSheet);
    const wheel = $("kWheel");
    wheel.addEventListener("scroll", onScroll, { passive: true });
    wheel.addEventListener("click", e => { const b = e.target.closest(".row"); if (b) goTo(+b.dataset.i); });
    wheel.addEventListener("keydown", e => {
      if (e.key === "ArrowDown") { e.preventDefault(); goTo(S.sel + 1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); goTo(S.sel - 1); }
      else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); addCurrent(); }
    });
    renderChips(); renderWheel(); renderCart();
    if (fitRO) fitRO.disconnect();
    if ("ResizeObserver" in window) { fitRO = new ResizeObserver(fitWheel); fitRO.observe(wheel); }
    fitWheel();
  }

  function exit() { const cb = S.onExit; P.kiosk.unmount(); cb && cb(); }

  function renderChips() {
    const cats = ["全部", ...P.menu.cats.filter(c => P.menu.items.some(i => i.cat === c))];
    const el = $("kChips");
    el.innerHTML = cats.map(c => `<button type="button" data-c="${esc(c)}" aria-pressed="${c === S.cat}">${esc(c)}</button>`).join("");
    el.onclick = e => {
      const b = e.target.closest("button"); if (!b) return;
      S.cat = b.dataset.c; S.sel = 0; renderChips(); renderWheel(); $("kWheel").scrollTop = 0;
    };
  }

  function renderWheel() {
    const L = listNow(), wheel = $("kWheel");
    wheel.innerHTML = L.map((it, i) => `<button class="row${it.soldOut ? " out" : ""}" type="button" role="option" data-i="${i}" aria-selected="false">
      <span class="thumb">${P.artHTML(it)}</span>
      <span class="mid"><span class="nm">${esc(it.name)}</span><span class="sb">${it.soldOut ? "今天賣完了" : esc((it.tags || []).join("・") || it.cat)}</span></span>
      <span class="pr">${it.soldOut ? "售完" : money(it.price)}</span></button>`).join("");
    S.sel = Math.max(0, Math.min(S.sel, L.length - 1));
    fitWheel(); paintRows(); showHero(false);
  }

  function fitWheel() {
    const wheel = $("kWheel"); if (!wheel) return;
    const h = wheel.clientHeight, r = ROW();
    wheel.style.paddingBlock = Math.max(0, (h - r) / 2) + "px";
    wheel.scrollTop = S.sel * r;
    paintRows();
  }

  function paintRows() {
    const wheel = $("kWheel"); if (!wheel) return;
    const r = ROW(), pos = wheel.scrollTop / r;
    [...wheel.children].forEach((el, i) => {
      const d = Math.abs(i - pos);
      el.style.setProperty("--s", (1 - Math.min(.16, d * .07)).toFixed(3));
      el.style.setProperty("--o", (1 - Math.min(.7, d * .28)).toFixed(3));
      el.setAttribute("aria-selected", i === S.sel);
    });
  }
  function onScroll() {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      const wheel = $("kWheel"); if (!wheel) return;
      const L = listNow(), i = Math.max(0, Math.min(L.length - 1, Math.round(wheel.scrollTop / ROW())));
      if (i !== S.sel) { S.sel = i; showHero(true); }
      paintRows();
    });
  }
  function goTo(i) {
    const L = listNow(); i = Math.max(0, Math.min(L.length - 1, i));
    $("kWheel").scrollTo({ top: i * ROW(), behavior: P.REDUCE ? "auto" : "smooth" });
  }

  function pop() {
    const st = $("kStage"); if (!st || P.REDUCE) return;
    st.classList.remove("pop"); void st.offsetWidth; st.classList.add("pop");
  }
  function showHero(animate) {
    const it = listNow()[S.sel];
    if (!it) {
      $("kArt").innerHTML = ""; $("kName").textContent = "這個分類還沒有餐點"; $("kDesc").textContent = ""; $("kPrice").innerHTML = "";
      $("kStage").classList.remove("out"); $("kAdd").disabled = true; $("kMinus").hidden = true; $("kBadge").classList.remove("on"); return;
    }
    $("kArt").innerHTML = P.artHTML(it);
    $("kName").textContent = it.name;
    $("kDesc").textContent = it.desc || "";
    $("kPrice").innerHTML = `<b>${it.soldOut ? "售完" : money(it.price)}</b>` + (it.tags || []).map(t => `<span class="tag">${esc(t)}</span>`).join("");
    $("kStage").classList.toggle("out", !!it.soldOut);
    $("kAdd").disabled = !!it.soldOut;
    $("kAdd").textContent = it.soldOut ? "今天賣完了" : "加入 " + it.name;
    if (animate) pop();
    updateBadge();
  }
  function updateBadge() {
    const it = listNow()[S.sel]; if (!it) return;
    const q = S.cart.get(it.id) || 0, b = $("kBadge");
    b.textContent = q; b.classList.toggle("on", q > 0);
    $("kMinus").hidden = q === 0;
  }

  /* ---------- 購物車 ---------- */
  let shown = 0, tween = 0;
  function renderCart() {
    const t = total(), n = count();
    const el = $("kTotal"); if (!el) return;
    cancelAnimationFrame(tween);
    const from = shown, t0 = performance.now(), dur = P.REDUCE ? 0 : 360;
    const step = now => { const k = dur ? Math.min(1, (now - t0) / dur) : 1, e = 1 - Math.pow(1 - k, 3); shown = Math.round(from + (t - from) * e); el.textContent = money(shown); if (k < 1) tween = requestAnimationFrame(step); };
    tween = requestAnimationFrame(step);
    if (!P.REDUCE && t !== from) { el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump"); }
    $("kCnt").textContent = n ? `共 ${n} 份` : "還沒點東西";
    const open = $("kOpen"); open.disabled = n === 0; open.textContent = n ? "看訂單・送出" : "看訂單";
    updateBadge();
  }
  function addCurrent() {
    const it = listNow()[S.sel]; if (!it || it.soldOut) return;
    S.cart.set(it.id, (S.cart.get(it.id) || 0) + 1);
    renderCart(); pop(); fly();
    if (navigator.vibrate) try { navigator.vibrate(12); } catch (_) {}
  }
  function minusCurrent() {
    const it = listNow()[S.sel]; if (!it) return;
    const q = (S.cart.get(it.id) || 0) - 1;
    if (q <= 0) S.cart.delete(it.id); else S.cart.set(it.id, q);
    renderCart();
  }
  /* 菜色飛進購物車的小動畫 */
  function fly() {
    if (P.REDUCE) return;
    const art = $("kArt"), to = $("kTotal"); if (!art || !to || !art.animate) return;
    const a = art.getBoundingClientRect(), b = to.getBoundingClientRect();
    const c = art.cloneNode(true); c.removeAttribute("id");
    Object.assign(c.style, { position: "fixed", left: a.left + "px", top: a.top + "px", width: a.width + "px", height: a.height + "px", zIndex: 30, pointerEvents: "none", margin: 0 });
    document.body.appendChild(c);
    const dx = b.left + b.width / 2 - (a.left + a.width / 2), dy = b.top + b.height / 2 - (a.top + a.height / 2);
    const an = c.animate([{ transform: "translate(0,0) scale(1)", opacity: .95 }, { transform: `translate(${dx * .6}px,${dy * .35 - 40}px) scale(.55)`, opacity: .9, offset: .55 }, { transform: `translate(${dx}px,${dy}px) scale(.08)`, opacity: .2 }], { duration: 520, easing: "cubic-bezier(.5,0,.7,.4)" });
    an.onfinish = () => c.remove();
  }

  /* ---------- 訂單面板 ---------- */
  function openSheet() {
    if (!count()) return;
    const sh = $("kSheet");
    sh.innerHTML = `
      <div class="grab"></div>
      <h3>我的訂單 <button type="button" class="x" id="kClose">繼續點</button></h3>
      <div class="body">
        <div id="kLines"></div>
        <div class="opts">
          <div class="seg" role="group" aria-label="用餐方式">
            <button type="button" data-dine="內用" aria-pressed="${S.dine === "內用"}">內用</button>
            <button type="button" data-dine="外帶" aria-pressed="${S.dine === "外帶"}">外帶</button>
          </div>
          <label>桌號或姓名（選填）<input id="kLabel" type="text" maxlength="30" placeholder="例如 3 號桌，或王小姐" autocomplete="off"></label>
          <label>備註（選填）<textarea id="kNote" rows="2" maxlength="120" placeholder="例如 不要香菜、飯少一點"></textarea></label>
        </div>
      </div>
      <div class="foot">
        <div class="tot"><span id="kSCnt"></span><b id="kSTot"></b></div>
        <div class="msg" id="kMsg" role="alert"></div>
        <button type="button" class="go wide" id="kSend">送出訂單</button>
      </div>`;
    $("kClose").addEventListener("click", closeSheet);
    sh.querySelector(".seg").addEventListener("click", e => {
      const b = e.target.closest("button[data-dine]"); if (!b) return;
      S.dine = b.dataset.dine;
      sh.querySelectorAll(".seg button").forEach(x => x.setAttribute("aria-pressed", x === b));
      if (!S.assist) $("kDine").textContent = S.dine;
    });
    $("kLines").addEventListener("click", e => {
      const b = e.target.closest("button[data-id]"); if (!b) return;
      const id = b.dataset.id, d = +b.dataset.d, q = (S.cart.get(id) || 0) + d;
      if (q <= 0) S.cart.delete(id); else S.cart.set(id, q);
      renderCart(); renderLines();
      if (!count()) closeSheet();
    });
    $("kSend").addEventListener("click", send);
    renderLines();
    $("kScrim").classList.add("on"); sh.classList.add("on");
  }
  function renderLines() {
    const rows = [...S.cart].map(([id, q]) => ({ it: BY(id), q })).filter(x => x.it);
    $("kLines").innerHTML = rows.map(({ it, q }) => `<div class="line">
      <span class="t">${esc(it.name)}</span><span class="c">${money(it.price)} × ${q}</span>
      <span class="step"><button type="button" data-id="${esc(it.id)}" data-d="-1" aria-label="少一份">−</button><span>${q}</span><button type="button" data-id="${esc(it.id)}" data-d="1" aria-label="多一份">＋</button></span>
      <span class="p">${money(it.price * q)}</span></div>`).join("");
    $("kSCnt").textContent = `共 ${count()} 份`; $("kSTot").textContent = money(total());
  }
  function closeSheet() { const s = $("kSheet"); if (!s) return; s.classList.remove("on"); $("kScrim").classList.remove("on"); }

  let sending = false;
  async function send() {
    if (sending) return;
    sending = true;
    const btn = $("kSend"), msg = $("kMsg"); btn.disabled = true; msg.textContent = "";
    try {
      const lines = [...S.cart].map(([id, qty]) => ({ id, qty }));
      const o = await P.placeOrder(lines, { dine: S.dine, label: $("kLabel").value, note: $("kNote").value, source: S.assist ? "櫃檯" : "客人" });
      closeSheet(); S.cart.clear(); shown = 0;
      showDone(o);
    } catch (err) {
      msg.textContent = err.message === "demo-limit" ? `試用版每天最多 ${P.DEMO_LIMIT} 筆訂單。請洽店員。` :
        err.message === "empty" ? "這份訂單裡的餐點剛賣完了，請重新選擇。" : "訂單送出失敗，請再試一次，或請店員協助。";
      btn.disabled = false;
    }
    sending = false;
  }

  function showDone(o) {
    clearIdle();
    const k = $("kiosk");
    k.innerHTML = `
      <div class="k-done">
        <div class="lights" aria-hidden="true"></div>
        <div class="k-done-in">
          <p class="k-ok">訂單送出了</p>
          <div class="k-no" aria-label="您的號碼 ${P.pad(o.no, 3)}">${P.pad(o.no, 3)}</div>
          <p class="k-tell">${S.assist ? "已送到櫃檯。" : "請記住這個號碼，<br>到櫃檯付款，叫到號碼時來取餐。"}</p>
          <ul class="k-sum">${o.items.map(i => `<li><span>${esc(i.name)} × ${i.qty}</span><span>${money(i.price * i.qty)}</span></li>`).join("")}</ul>
          <div class="k-sum-t"><span>合計</span><b>${money(o.total)}</b></div>
          <button type="button" class="go wide" id="kAgain">${S.assist ? "回收銀畫面" : "好，下一位"}</button>
          <p class="k-count" id="kCount"></p>
        </div>
      </div>`;
    const finish = () => { clearTimeout(doneT); if (S.assist) exit(); else { renderAttract(); bindIdle(); } };
    $("kAgain").addEventListener("click", finish);
    let left = S.assist ? 0 : 20;
    if (left) {
      const tick = () => { if (!$("kCount")) return; $("kCount").textContent = `${left} 秒後回到開始畫面`; if (left-- <= 0) return finish(); doneT = setTimeout(tick, 1000); };
      tick();
    }
  }

  /* ---------- 閒置自動重來（客人走掉時） ---------- */
  function clearIdle() { clearInterval(idleTimer); idleTimer = 0; document.removeEventListener("pointerdown", touch, true); document.removeEventListener("keydown", touch, true); }
  function touch() { last = Date.now(); }
  function bindIdle() {
    clearIdle();
    if (S.assist) return;
    last = Date.now();
    document.addEventListener("pointerdown", touch, true); document.addEventListener("keydown", touch, true);
    idleTimer = setInterval(() => {
      if (!S || S.view !== "order") return;
      const idle = (Date.now() - last) / 1000, limit = Math.max(20, P.settings.idleSec || 90);
      const box = $("kIdle");
      if (!box) return;
      if (idle < limit) { if (!box.hidden) box.hidden = true; return; }
      const left = Math.ceil(limit + 15 - idle);
      if (!count() && !$("kSheet").classList.contains("on")) { S.cart.clear(); renderAttract(); return; }
      if (left <= 0) { closeSheet(); S.cart.clear(); renderAttract(); return; }
      box.hidden = false;
      box.innerHTML = `<div class="idle-card"><p>還在點餐嗎？</p><b>${left}</b><span>秒後會清除訂單，回到開始畫面</span><button type="button" class="go" id="kStay">我還在，繼續點</button></div>`;
      $("kStay").onclick = () => { last = Date.now(); box.hidden = true; };
    }, 1000);
  }
})();
