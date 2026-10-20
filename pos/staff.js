/* 店員／收銀畫面：訂單、菜單、報表、設定 */
"use strict";
(function () {
  const { $, esc, money, pad } = P;
  let root = null, T = null, tick = 0;

  const addDays = (day, n) => { const d = new Date(day + "T00:00:00"); d.setDate(d.getDate() + n); return P.dayOf(d); };
  const weekday = day => "日一二三四五六"[new Date(day + "T00:00:00").getDay()];
  const ACTIVE = ["pending", "making", "ready"];
  const isCounted = o => o.status !== "cancelled";
  const ssel = (cur, v) => cur === v ? " selected" : "";

  P.staff = {
    mount(el, actions) {
      root = el;
      T = { tab: "orders", filter: "active", day: P.dayOf(), range: "today", from: P.dayOf(), to: P.dayOf(), fresh: new Set(), actions };
      root.innerHTML = `
        <section class="staff">
          <header class="st-head">
            <b class="st-brand">${esc(P.settings.shop)}<small>收銀</small></b>
            <nav class="st-tabs" role="tablist" id="stTabs">
              <button type="button" role="tab" data-t="orders">訂單<i id="stBadge" hidden></i></button>
              <button type="button" role="tab" data-t="menu">菜單</button>
              <button type="button" role="tab" data-t="report">報表</button>
              <button type="button" role="tab" data-t="settings">設定</button>
            </nav>
            <div class="st-actions">
              <button type="button" class="btn" id="stAssist">代客點餐</button>
              <button type="button" class="btn primary" id="stKiosk">客人畫面</button>
            </div>
          </header>
          <div class="st-body" id="stBody"></div>
        </section>`;
      $("stTabs").addEventListener("click", e => { const b = e.target.closest("button[data-t]"); if (b) setTab(b.dataset.t); });
      $("stAssist").addEventListener("click", () => actions.assist());
      $("stKiosk").addEventListener("click", () => actions.kiosk());
      setTab("orders");
      clearInterval(tick); tick = setInterval(() => { if (T && T.tab === "orders") renderOrders(); }, 30000);
      backupNag();
    },
    unmount() { clearInterval(tick); root = null; T = null; },
    onEvent(type, data) {
      if (!root || !T) return;
      if (type === "orders") {
        if (data && data.isNew) T.fresh.add(data.id);
        if (T.tab === "orders") renderOrders(); else updateBadge();
      } else if (type === "menu" && T.tab === "menu") renderMenu();
    }
  };

  function setTab(t) {
    T.tab = t;
    root.querySelectorAll("#stTabs button").forEach(b => b.setAttribute("aria-selected", b.dataset.t === t));
    ({ orders: renderOrders, menu: renderMenu, report: renderReport, settings: renderSettings })[t]();
    updateBadge();
  }
  async function updateBadge() {
    const list = await P.ordersByDay(P.dayOf());
    const n = list.filter(o => o.status === "pending").length, b = $("stBadge");
    if (!b) return;
    b.hidden = n === 0; b.textContent = n;
  }
  async function backupNag() {
    if (P.volatile) return P.alert("這台裝置的瀏覽器不讓網頁保存資料（可能是無痕模式）。關掉頁面後訂單和菜單會消失，請改用一般視窗開啟。", "資料無法保存");
    const all = await P.ordersAll();
    if (!all.length) return;
    // 從「上次備份」或「最早一筆訂單」算起，超過 7 天沒備份才提醒
    const since = Math.max(P.settings.lastBackup || 0, Math.min(...all.map(o => o.ts)));
    if ((Date.now() - since) / 864e5 > 7) P.toast("已經超過 7 天沒有備份了，建議到「設定」按「下載備份檔」", 5000);
  }

  /* =====================================================================
     訂單
     ===================================================================== */
  async function renderOrders() {
    const body = $("stBody"); if (!body || T.tab !== "orders") return;
    const isToday = T.day === P.dayOf();
    const all = (await P.ordersByDay(T.day)).sort((a, b) => a.no - b.no);
    const cnt = k => all.filter(o => o.status === k).length;
    const active = all.filter(o => ACTIVE.includes(o.status));
    const F = [["active", `進行中`, active.length], ["pending", "待收款", cnt("pending")], ["making", "製作中", cnt("making")], ["ready", "可取餐", cnt("ready")], ["done", "已完成", cnt("done")], ["cancelled", "已取消", cnt("cancelled")], ["all", "全部", all.length]];
    let list = T.filter === "active" ? active : T.filter === "all" ? all : all.filter(o => o.status === T.filter);
    const newest = ["done", "cancelled", "all"].includes(T.filter);
    list = newest ? list.slice().reverse() : list;
    const rev = all.filter(o => isCounted(o) && o.paid).reduce((s, o) => s + o.total, 0);
    const unpaid = all.filter(o => isCounted(o) && !o.paid).reduce((s, o) => s + o.total, 0);

    body.innerHTML = `
      <div class="od-bar">
        <div class="daynav">
          <button type="button" class="btn sm" data-d="-1" aria-label="前一天">‹</button>
          <label class="dateinp"><input type="date" id="stDay" value="${T.day}"><span>${T.day}（${weekday(T.day)}）</span></label>
          <button type="button" class="btn sm" data-d="1" aria-label="後一天" ${isToday ? "disabled" : ""}>›</button>
          ${isToday ? "" : `<button type="button" class="btn sm" data-d="today">回到今天</button>`}
        </div>
        <div class="od-sum"><span>收款 <b>${money(rev)}</b></span><span>未收款 <b class="${unpaid ? "warn" : ""}">${money(unpaid)}</b></span><span>共 <b>${all.filter(isCounted).length}</b> 單</span></div>
      </div>
      <div class="chips st-chips" id="stFilter">${F.map(([k, l, n]) => `<button type="button" data-f="${k}" aria-pressed="${T.filter === k}">${l}<i>${n}</i></button>`).join("")}</div>
      <div class="od-grid" id="odGrid">${list.length ? list.map(card).join("") : `<div class="empty-big">${all.length ? "這個分類沒有訂單" : isToday ? "今天還沒有訂單。客人下單後會出現在這裡。" : "這天沒有訂單"}</div>`}</div>`;
    body.querySelector(".daynav").addEventListener("click", e => {
      const b = e.target.closest("button[data-d]"); if (!b || b.disabled) return;
      T.day = b.dataset.d === "today" ? P.dayOf() : addDays(T.day, +b.dataset.d); renderOrders();
    });
    $("stDay").addEventListener("change", e => { if (e.target.value) { T.day = e.target.value > P.dayOf() ? P.dayOf() : e.target.value; renderOrders(); } });
    $("stFilter").addEventListener("click", e => { const b = e.target.closest("button[data-f]"); if (b) { T.filter = b.dataset.f; renderOrders(); } });
    $("odGrid").addEventListener("click", onCardAct);
    // 新訂單閃一下
    if (T.fresh.size) { T.fresh.forEach(id => { const el = body.querySelector(`[data-oid="${id}"]`); if (el) el.classList.add("fresh"); }); setTimeout(() => T && T.fresh.clear(), 4000); }
    updateBadge();
  }

  function card(o) {
    const pay = o.status === "cancelled" ? (o.paid ? `<span class="pill warn">已收款，需退 ${money(o.total)}</span>` : "")
      : o.paid ? `<span class="pill ok">已收款${o.change ? "・找 " + money(o.change) : ""}</span>` : `<span class="pill warn">未收款</span>`;
    const A = [];
    const b = (act, label, kind = "") => A.push(`<button type="button" class="btn ${kind}" data-act="${act}" data-id="${o.id}">${label}</button>`);
    if (o.status === "pending") { b("pay", "收款", "primary"); b("make", "先製作"); b("cancel", "取消", "ghost"); }
    else if (o.status === "making") { b("ready", "可取餐了", "primary"); if (!o.paid) b("pay", "收款"); b("cancel", "取消", "ghost"); }
    else if (o.status === "ready") { b("done", o.paid ? "已取餐" : "收款並結單", "primary"); b("cancel", "取消", "ghost"); }
    else if (o.status === "done") { b("reopen", "還原", "ghost"); }
    else if (o.status === "cancelled") { b("restore", "還原", "ghost"); }
    A.push(`<button type="button" class="btn ghost icon" data-act="print" data-id="${o.id}" aria-label="列印單號" title="列印單號">🖨</button>`);
    return `<article class="oc s-${o.status}" data-oid="${o.id}">
      <div class="oc-top"><span class="no">${pad(o.no, 3)}</span>
        <span class="meta">${esc(o.dine)}${o.label ? "・" + esc(o.label) : ""}<br><small>${P.timeOf(o.ts)}・${esc(o.source)}</small></span>
        <span class="st">${P.STATUS[o.status]}</span></div>
      <ul class="oc-lines">${o.items.map(i => `<li><span>${esc(i.name)} <em>× ${i.qty}</em></span><b>${money(i.price * i.qty)}</b></li>`).join("")}</ul>
      ${o.note ? `<div class="oc-note">備註：${esc(o.note)}</div>` : ""}
      <div class="oc-foot"><span class="tot">${money(o.total)}</span>${pay}</div>
      <div class="oc-acts">${A.join("")}</div></article>`;
  }

  async function onCardAct(e) {
    const btn = e.target.closest("button[data-act]"); if (!btn) return;
    const id = btn.dataset.id, act = btn.dataset.act, o = await P.orderGet(id); if (!o) return;
    if (act === "pay") { await payFlow(o); }
    else if (act === "make") await P.updateOrder(id, { status: "making" });
    else if (act === "ready") await P.updateOrder(id, { status: "ready" });
    else if (act === "done") { if (!o.paid && !(await payFlow(o, true))) return; await P.updateOrder(id, { status: "done" }); }
    else if (act === "cancel") {
      if (await P.confirm(`取消 ${pad(o.no, 3)} 號訂單？` + (o.paid ? `\n這張單已收款 ${money(o.total)}，記得退錢給客人。` : ""), "確定取消", true)) await P.updateOrder(id, { status: "cancelled" });
    }
    else if (act === "reopen") await P.updateOrder(id, { status: "ready" });
    else if (act === "restore") await P.updateOrder(id, { status: o.paid ? "making" : "pending" });
    else if (act === "print") return P.printSlip(o);
    renderOrders();
  }

  /* 收款：輸入收到多少錢，算出找零 */
  async function payFlow(o, thenDone) {
    const t = o.total;
    const quick = [...new Set([t, Math.ceil(t / 100) * 100, Math.ceil(t / 500) * 500, Math.ceil(t / 1000) * 1000, 100, 500, 1000].filter(v => v >= t))].sort((a, b) => a - b).slice(0, 5);
    let recv = t;
    const res = await P.modal({
      title: `收款・${pad(o.no, 3)} 號`, cls: "pay",
      body: `<div class="pay-total"><span>應收</span><b>${money(t)}</b></div>
        <div class="pay-q" id="payQ">${quick.map(v => `<button type="button" data-v="${v}" class="${v === t ? "on" : ""}">${v === t ? "剛好 " : ""}${money(v)}</button>`).join("")}</div>
        <label>實收金額<input id="payIn" type="number" inputmode="numeric" min="${t}" value="${t}"></label>
        <div class="pay-chg" id="payChg">找零 <b>$0</b></div>`,
      actions: [{ label: "取消", value: null }, { label: thenDone ? "收款並結單" : "確認收款", kind: "primary", value: "ok", keep: true, onClick: (el, close) => { const v = +el.querySelector("#payIn").value; if (!(v >= t)) { el.querySelector("#payChg").innerHTML = `<span class="warn">實收金額不足</span>`; return false; } close(v); return false; } }],
      onOpen: el => {
        const inp = el.querySelector("#payIn"), chg = el.querySelector("#payChg");
        const upd = () => { recv = +inp.value || 0; chg.innerHTML = recv >= t ? `找零 <b>${money(recv - t)}</b>` : `<span class="warn">還差 ${money(t - recv)}</span>`; el.querySelectorAll("#payQ button").forEach(b => b.classList.toggle("on", +b.dataset.v === recv)); };
        el.querySelector("#payQ").addEventListener("click", e => { const b = e.target.closest("button"); if (b) { inp.value = b.dataset.v; upd(); } });
        inp.addEventListener("input", upd); inp.select();
      }
    });
    if (typeof res !== "number") return false;
    await P.updateOrder(o.id, { paid: true, received: res, change: res - t, paidTs: Date.now(), status: o.status === "pending" ? "making" : o.status });
    if (!thenDone) renderOrders();
    return true;
  }

  /* =====================================================================
     菜單
     ===================================================================== */
  function renderMenu() {
    const body = $("stBody"); if (!body || T.tab !== "menu") return;
    const cats = [...P.menu.cats]; P.menu.items.forEach(i => { if (!cats.includes(i.cat)) cats.push(i.cat); });
    const sold = P.menu.items.filter(i => i.soldOut).length;
    body.innerHTML = `
      <div class="mn-bar">
        <div><b>${P.menu.items.length}</b> 道餐點${sold ? `，<span class="warn">${sold} 道售完</span>` : ""}</div>
        <div class="mn-acts"><button type="button" class="btn" id="mnCats">分類管理</button><button type="button" class="btn primary" id="mnAdd">＋ 新增餐點</button></div>
      </div>
      ${P.menu.items.length ? cats.map(c => {
        const L = P.menu.items.filter(i => i.cat === c); if (!L.length) return "";
        return `<h3 class="mn-cat">${esc(c)}</h3><div class="mn-list">${L.map(i => `<div class="mn-row${i.soldOut ? " out" : ""}">
          <span class="thumb">${P.artHTML(i)}</span>
          <span class="mid"><b>${esc(i.name)}</b><small>${esc((i.tags || []).join("・"))}</small></span>
          <span class="pr">${money(i.price)}</span>
          <label class="sw" title="標示今天售完"><input type="checkbox" data-sold="${esc(i.id)}" ${i.soldOut ? "checked" : ""}><span>售完</span></label>
          <button type="button" class="btn sm" data-edit="${esc(i.id)}">編輯</button></div>`).join("")}</div>`;
      }).join("") : `<div class="empty-big">菜單還是空的。按右上角「＋ 新增餐點」開始，或到「設定」載入示範菜單。</div>`}`;
    $("mnAdd").addEventListener("click", () => editItem(null));
    $("mnCats").addEventListener("click", editCats);
    body.onchange = async e => {
      const c = e.target.closest("input[data-sold]"); if (!c) return;
      const it = P.menu.items.find(i => i.id === c.dataset.sold); if (!it) return;
      it.soldOut = c.checked; await P.saveMenu(); renderMenu();
    };
    body.onclick = e => { const b = e.target.closest("button[data-edit]"); if (b) editItem(b.dataset.edit); };
  }

  async function editItem(id) {
    const old = id ? P.menu.items.find(i => i.id === id) : null;
    const it = old ? JSON.parse(JSON.stringify(old)) : { id: P.newId(), cat: P.menu.cats[0] || "餐點", name: "", price: 0, desc: "", tags: [], soldOut: false };
    const cats = P.menu.cats.length ? P.menu.cats : [it.cat];
    const res = await P.modal({
      title: old ? "編輯餐點" : "新增餐點", wide: true, cls: "edit",
      body: `<div class="ed-grid">
        <div class="ed-photo"><div class="thumb big" id="edThumb">${P.artHTML(it)}</div>
          <label class="btn" for="edFile">${it.img ? "換照片" : "上傳照片"}</label><input id="edFile" type="file" accept="image/*" hidden>
          <button type="button" class="btn ghost sm" id="edNoImg" ${it.img ? "" : "hidden"}>移除照片</button>
          <small>照片會自動縮小存在這台裝置</small></div>
        <div class="ed-fields">
          <label>名稱<input id="edName" maxlength="24" value="${esc(it.name)}" placeholder="例如 三杯雞"></label>
          <label>價格<input id="edPrice" type="number" inputmode="numeric" min="0" value="${it.price || ""}" placeholder="例如 220"></label>
          <label>分類<select id="edCat">${cats.map(c => `<option${ssel(it.cat, c)}>${esc(c)}</option>`).join("")}<option value="__new">＋ 新分類…</option></select></label>
          <label>簡短說明（選填）<input id="edDesc" maxlength="40" value="${esc(it.desc)}" placeholder="例如 麻油、薑和九層塔"></label>
          <label>標籤（選填，用逗號分開）<input id="edTags" maxlength="30" value="${esc((it.tags || []).join(","))}" placeholder="例如 招牌,辣"></label>
        </div></div>`,
      actions: [
        ...(old ? [{ label: "刪除", kind: "danger ghost", value: "del" }] : []),
        { label: "取消", value: null },
        { label: "儲存", kind: "primary", keep: true, onClick: (el, close) => {
            const name = el.querySelector("#edName").value.trim(), price = Math.round(+el.querySelector("#edPrice").value);
            if (!name) { P.toast("請輸入名稱"); el.querySelector("#edName").focus(); return false; }
            if (!(price >= 0) || isNaN(price)) { P.toast("請輸入價格"); el.querySelector("#edPrice").focus(); return false; }
            it.name = name; it.price = price; it.desc = el.querySelector("#edDesc").value.trim();
            it.tags = el.querySelector("#edTags").value.split(/[,，、]/).map(s => s.trim()).filter(Boolean).slice(0, 4);
            const c = el.querySelector("#edCat").value;
            it.cat = c === "__new" ? (el._newCat || cats[0]) : c;
            close("save"); return false;
          } }
      ],
      onOpen: el => {
        const refresh = () => { el.querySelector("#edThumb").innerHTML = P.artHTML(it); el.querySelector("#edNoImg").hidden = !it.img; el.querySelector("label.btn").textContent = it.img ? "換照片" : "上傳照片"; };
        el.querySelector("#edFile").addEventListener("change", async e => {
          const f = e.target.files[0]; if (!f) return;
          try { it.img = await P.shrinkImage(f); refresh(); } catch (_) { P.toast("這張圖片讀不出來，請換一張"); }
        });
        el.querySelector("#edNoImg").addEventListener("click", () => { delete it.img; refresh(); });
        el.querySelector("#edCat").addEventListener("change", async e => {
          if (e.target.value !== "__new") return;
          const name = await askText("新分類名稱", "", "例如 小菜");
          if (name) { el._newCat = name; const o = document.createElement("option"); o.textContent = name; e.target.insertBefore(o, e.target.lastElementChild); e.target.value = name; el._newCat = name; }
          else e.target.value = it.cat;
        });
      }
    });
    if (res === "save") {
      if (!P.menu.cats.includes(it.cat)) P.menu.cats.push(it.cat);
      const k = P.menu.items.findIndex(i => i.id === it.id);
      if (k >= 0) P.menu.items[k] = it; else P.menu.items.push(it);
      await P.saveMenu(); renderMenu(); P.toast("已儲存");
    } else if (res === "del") {
      if (await P.confirm(`刪除「${old.name}」？已經送出的訂單不受影響。`, "刪除", true)) {
        P.menu.items = P.menu.items.filter(i => i.id !== old.id); await P.saveMenu(); renderMenu();
      }
    }
  }

  function askText(title, val = "", ph = "") {
    return P.modal({ title, body: `<input id="txIn" maxlength="16" value="${esc(val)}" placeholder="${esc(ph)}">`, cls: "ask",
      actions: [{ label: "取消", value: null }, { label: "確定", kind: "primary", keep: true, onClick: (el, close) => { const v = el.querySelector("#txIn").value.trim(); if (!v) return false; close(v); return false; } }],
      onOpen: (el, close) => el.querySelector("#txIn").addEventListener("keydown", e => { if (e.key === "Enter") { const v = e.target.value.trim(); if (v) close(v); } }) });
  }

  async function editCats() {
    const render = el => {
      el.querySelector("#catList").innerHTML = P.menu.cats.map((c, i) => `<div class="cat-row"><b>${esc(c)}</b><small>${P.menu.items.filter(x => x.cat === c).length} 道</small>
        <button type="button" class="btn sm" data-a="up" data-i="${i}" ${i === 0 ? "disabled" : ""} aria-label="上移">↑</button>
        <button type="button" class="btn sm" data-a="dn" data-i="${i}" ${i === P.menu.cats.length - 1 ? "disabled" : ""} aria-label="下移">↓</button>
        <button type="button" class="btn sm" data-a="rn" data-i="${i}">改名</button>
        <button type="button" class="btn sm ghost" data-a="rm" data-i="${i}">刪除</button></div>`).join("") || `<p class="plain">還沒有分類</p>`;
    };
    await P.modal({ title: "分類管理", wide: true, body: `<div id="catList"></div><button type="button" class="btn" id="catAdd">＋ 新增分類</button>`,
      actions: [{ label: "完成", kind: "primary", value: true }],
      onOpen: el => {
        render(el);
        el.addEventListener("click", async e => {
          if (e.target.closest("#catAdd")) { const n = await askText("新分類名稱", "", "例如 小菜"); if (n && !P.menu.cats.includes(n)) { P.menu.cats.push(n); await P.saveMenu(); render(el); } return; }
          const b = e.target.closest("button[data-a]"); if (!b) return;
          const i = +b.dataset.i, a = b.dataset.a, c = P.menu.cats[i];
          if (a === "up" || a === "dn") { const j = a === "up" ? i - 1 : i + 1; [P.menu.cats[i], P.menu.cats[j]] = [P.menu.cats[j], P.menu.cats[i]]; }
          else if (a === "rn") { const n = await askText("分類新名稱", c); if (!n || n === c) return; if (P.menu.cats.includes(n)) return P.toast("已經有這個分類"); P.menu.cats[i] = n; P.menu.items.forEach(x => { if (x.cat === c) x.cat = n; }); }
          else if (a === "rm") {
            if (P.menu.items.some(x => x.cat === c)) return P.alert("這個分類裡還有餐點，請先把餐點移到別的分類，或刪掉餐點。");
            P.menu.cats.splice(i, 1);
          }
          await P.saveMenu(); render(el); renderMenu();
        });
      } });
    renderMenu();
  }

  /* =====================================================================
     報表
     ===================================================================== */
  function rangeOf() {
    const today = P.dayOf();
    if (T.range === "today") return [today, today];
    if (T.range === "yesterday") { const y = addDays(today, -1); return [y, y]; }
    if (T.range === "week") return [addDays(today, -6), today];
    if (T.range === "month") return [today.slice(0, 8) + "01", today];
    return [T.from <= T.to ? T.from : T.to, T.from <= T.to ? T.to : T.from];
  }
  async function renderReport() {
    const body = $("stBody"); if (!body || T.tab !== "report") return;
    const [from, to] = rangeOf();
    const orders = await P.ordersRange(from, to);
    const ok = orders.filter(o => isCounted(o));
    const paid = ok.filter(o => o.paid), unpaid = ok.filter(o => !o.paid);
    const rev = paid.reduce((s, o) => s + o.total, 0), unp = unpaid.reduce((s, o) => s + o.total, 0);
    const cancelled = orders.length - ok.length;
    const dineIn = ok.filter(o => o.dine === "內用").length, take = ok.length - dineIn;
    const items = {};
    ok.forEach(o => o.items.forEach(i => { const r = items[i.name] || (items[i.name] = { name: i.name, qty: 0, amt: 0 }); r.qty += i.qty; r.amt += i.price * i.qty; }));
    const rank = Object.values(items).sort((a, b) => b.qty - a.qty || b.amt - a.amt);
    const days = {}; ok.forEach(o => { const d = days[o.day] || (days[o.day] = { n: 0, rev: 0 }); d.n++; if (o.paid) d.rev += o.total; });
    const hours = Array(24).fill(0); ok.forEach(o => hours[new Date(o.ts).getHours()]++);
    const hmax = Math.max(1, ...hours);
    const hs = hours.findIndex(v => v), he = 23 - [...hours].reverse().findIndex(v => v);
    const R = [["today", "今天"], ["yesterday", "昨天"], ["week", "近 7 天"], ["month", "本月"], ["custom", "自訂"]];

    body.innerHTML = `
      <div class="rp-bar">
        <div class="chips st-chips" id="rpR">${R.map(([k, l]) => `<button type="button" data-r="${k}" aria-pressed="${T.range === k}">${l}</button>`).join("")}</div>
        ${T.range === "custom" ? `<div class="rp-custom"><input type="date" id="rpFrom" value="${T.from}"> ～ <input type="date" id="rpTo" value="${T.to}"></div>` : ""}
        <div class="rp-acts"><button type="button" class="btn" id="rpCsv">匯出明細（Excel）</button><button type="button" class="btn" id="rpPrint">列印</button></div>
      </div>
      <div class="rp-print" id="rpPrintArea">
      <h3 class="rp-title">${esc(P.settings.shop)}　${from === to ? from : from + " ～ " + to}</h3>
      <div class="rp-cards">
        <div class="rc big"><span>營收（已收款）</span><b>${money(rev)}</b></div>
        <div class="rc"><span>訂單數</span><b>${ok.length}</b></div>
        <div class="rc"><span>平均客單</span><b>${ok.length ? money(Math.round(ok.reduce((s, o) => s + o.total, 0) / ok.length)) : "$0"}</b></div>
        <div class="rc"><span>未收款</span><b class="${unp ? "warn" : ""}">${money(unp)}</b></div>
        <div class="rc"><span>內用／外帶</span><b>${dineIn}／${take}</b></div>
        <div class="rc"><span>已取消</span><b>${cancelled}</b></div>
      </div>
      ${ok.length ? `
      ${from !== to ? `<h4>每日</h4><table class="tbl"><thead><tr><th>日期</th><th>訂單</th><th>營收</th></tr></thead><tbody>${Object.keys(days).sort().map(d => `<tr><td>${d}（${weekday(d)}）</td><td>${days[d].n}</td><td>${money(days[d].rev)}</td></tr>`).join("")}</tbody></table>` : ""}
      <h4>什麼時段最忙</h4>
      <div class="hours">${hours.slice(hs, he + 1).map((v, i) => `<div class="hb" title="${hs + i} 點：${v} 單"><i style="height:${Math.max(4, v / hmax * 100)}%"></i><span>${hs + i}</span><em>${v || ""}</em></div>`).join("")}</div>
      <h4>賣得最好的</h4>
      <table class="tbl"><thead><tr><th>#</th><th>餐點</th><th>份數</th><th>金額</th></tr></thead><tbody>${rank.map((r, i) => `<tr><td>${i + 1}</td><td>${esc(r.name)}</td><td>${r.qty}</td><td>${money(r.amt)}</td></tr>`).join("")}</tbody></table>`
      : `<div class="empty-big">這段時間沒有訂單</div>`}
      </div>`;
    $("rpR").addEventListener("click", e => { const b = e.target.closest("button[data-r]"); if (b) { T.range = b.dataset.r; renderReport(); } });
    if ($("rpFrom")) { $("rpFrom").addEventListener("change", e => { T.from = e.target.value || T.from; renderReport(); }); $("rpTo").addEventListener("change", e => { T.to = e.target.value || T.to; renderReport(); }); }
    $("rpCsv").addEventListener("click", () => exportCsv(orders, from, to));
    $("rpPrint").addEventListener("click", () => { document.body.classList.add("print-report"); setTimeout(() => { window.print(); setTimeout(() => document.body.classList.remove("print-report"), 400); }, 60); });
  }

  function exportCsv(orders, from, to) {
    if (!orders.length) return P.toast("這段時間沒有資料可以匯出");
    const q = v => '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"';
    const rows = [["日期", "時間", "單號", "內用外帶", "桌號或姓名", "狀態", "付款", "品項", "單價", "數量", "小計", "訂單合計", "實收", "找零", "備註", "來源"]];
    orders.sort((a, b) => a.ts - b.ts).forEach(o => o.items.forEach(i => rows.push([o.day, P.timeOf(o.ts), pad(o.no, 3), o.dine, o.label, P.STATUS[o.status], o.paid ? "已收款" : "未收款", i.name, i.price, i.qty, i.price * i.qty, o.total, o.received || "", o.change || "", o.note, o.source])));
    P.download(`訂單明細_${from}${from === to ? "" : "_" + to}.csv`, "﻿" + rows.map(r => r.map(q).join(",")).join("\r\n"), "text/csv;charset=utf-8");
  }

  /* =====================================================================
     設定
     ===================================================================== */
  async function renderSettings() {
    const body = $("stBody"); if (!body || T.tab !== "settings") return;
    const s = P.settings, nOrders = (await P.ordersAll()).length;
    let persisted = null; try { persisted = navigator.storage && navigator.storage.persisted ? await navigator.storage.persisted() : null; } catch (_) {}
    const bk = s.lastBackup ? new Date(s.lastBackup).toLocaleString("zh-TW", { hour12: false }) : "還沒備份過";
    const SW = ["#ffcf4a", "#ff8a4c", "#ee4b2b", "#ff6fa5", "#8f7cff", "#4cc3ff", "#3ddc97", "#e8e4d8"];
    body.innerHTML = `
      <div class="set-grid">
        <section class="set"><h3>店家</h3>
          <label>店名（顯示在客人畫面）<input id="sShop" maxlength="16" value="${esc(s.shop)}"></label>
          <div class="lbl">主題色</div>
          <div class="swatches" id="sSw">${SW.map(c => `<button type="button" data-c="${c}" style="--c:${c}" aria-label="${c}" aria-pressed="${c.toLowerCase() === (s.accent || "").toLowerCase()}"></button>`).join("")}</div>
          <label>客人閒置幾秒後自動回到開始畫面<input id="sIdle" type="number" inputmode="numeric" min="20" max="600" value="${s.idleSec}"></label>
          <button type="button" class="btn primary" id="sSave">儲存</button>
          <button type="button" class="btn" id="sPin">更改店員密碼</button>
        </section>

        <section class="set"><h3>備份</h3>
          <p class="plain">所有資料都只存在這台裝置裡。換裝置、清除瀏覽器資料或重灌前，請先下載備份。</p>
          <p class="plain ${s.lastBackup && (Date.now() - s.lastBackup) < 7 * 864e5 ? "" : "warn"}">上次備份：${bk}（目前有 ${nOrders} 筆訂單）</p>
          <button type="button" class="btn primary" id="sBackup">下載備份檔</button>
          <label class="btn" for="sRestore">還原備份…</label><input id="sRestore" type="file" accept=".json,application/json" hidden>
          <p class="plain small">${persisted === true ? "✓ 瀏覽器已承諾保留這份資料" : persisted === false ? "瀏覽器可能在空間不足時清掉資料，建議把網頁加到主畫面並定期備份" : ""}</p>
        </section>

        <section class="set"><h3>啟用狀態</h3>
          ${P.license ? `<p class="plain ok">✓ 已啟用：${esc(P.license.s || "")}　<small>${esc(P.license.d || "")}</small></p>` :
            `<p class="plain">目前是<b>試用版</b>：功能完整，但每天最多 ${P.DEMO_LIMIT} 筆訂單。購買後會拿到啟用碼或啟用連結。</p>
             <label>啟用碼<textarea id="sCode" rows="3" placeholder="貼上以 KL1. 開頭的啟用碼"></textarea></label>
             <button type="button" class="btn primary" id="sAct">啟用</button>`}
        </section>

        <section class="set"><h3>安裝到這台裝置</h3>
          <p class="plain">加到主畫面後可以全螢幕使用，也比較不會被瀏覽器清掉資料。第一次一定要連網開啟一次，之後沒有網路也能用。</p>
          <button type="button" class="btn" id="sInstall" ${P.installPrompt ? "" : "hidden"}>安裝</button>
          <p class="plain small" id="sInstallHint">${P.installPrompt ? "" : "iPad／iPhone：Safari 按分享鈕 →「加入主畫面」。Android／電腦 Chrome：網址列右邊的安裝圖示，或選單裡的「安裝應用程式」。"}</p>
          <p class="plain small" id="sOffline"></p>
        </section>

        <section class="set"><h3>資料</h3>
          <button type="button" class="btn" id="sDemo">載入示範菜單</button>
          <button type="button" class="btn" id="sClearMenu">清空菜單</button>
          <button type="button" class="btn danger ghost" id="sClearOrders">清除所有訂單</button>
          <button type="button" class="btn danger ghost" id="sReset">全部重設</button>
        </section>

        <section class="set"><h3>關於</h3>
          <p class="plain small">KitLab 點餐收銀機　版本 ${P.VERSION}<br>離線可用，資料存在這台裝置。本系統不開立發票，是否需要開立、如何開立，請店家依法自行處理。</p>
        </section>
      </div>`;
    let accent = s.accent;
    $("sSw").addEventListener("click", e => { const b = e.target.closest("button[data-c]"); if (!b) return; accent = b.dataset.c; $("sSw").querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", x === b)); P.settings.accent = accent; P.applyAccent(); });
    $("sSave").addEventListener("click", async () => {
      P.settings.shop = $("sShop").value.trim() || "我的小店"; P.settings.accent = accent;
      P.settings.idleSec = Math.max(20, Math.min(600, Math.round(+$("sIdle").value) || 90));
      await P.saveSettings(); P.applyAccent(); root.querySelector(".st-brand").firstChild.textContent = P.settings.shop; P.toast("已儲存");
    });
    $("sPin").addEventListener("click", () => P.changePin());
    $("sBackup").addEventListener("click", async () => {
      const d = await P.exportAll();
      P.download(`kitlab-pos-備份-${P.dayOf()}.json`, JSON.stringify(d));
      P.settings.lastBackup = Date.now(); await P.saveSettings(); renderSettings(); P.toast("備份檔已下載，請存到別的地方");
    });
    $("sRestore").addEventListener("change", async e => {
      const f = e.target.files[0]; e.target.value = ""; if (!f) return;
      try {
        const data = JSON.parse(await f.text());
        if (!(await P.confirm(`用這份備份取代目前的所有資料？\n備份內有 ${data.orders ? data.orders.length : 0} 筆訂單，匯出時間 ${data.exportedAt || "不明"}。`, "取代", true))) return;
        await P.importAll(data); P.toast("已還原"); renderSettings();
      } catch (_) { P.alert("這個檔案不是正確的備份檔。"); }
    });
    if ($("sAct")) $("sAct").addEventListener("click", async () => {
      const info = await P.activate($("sCode").value);
      if (info) { P.toast("啟用成功：" + (info.s || "")); renderSettings(); } else P.alert("啟用碼不正確，請確認有完整貼上（以 KL1. 開頭）。");
    });
    if ($("sInstall")) $("sInstall").addEventListener("click", async () => { if (P.installPrompt) { P.installPrompt.prompt(); P.installPrompt = null; } });
    $("sOffline").textContent = (navigator.serviceWorker && navigator.serviceWorker.controller) ? "✓ 離線功能已就緒，沒有網路也能開啟。" : "離線功能尚未就緒（需要用 https 網址開啟過一次，並等頁面載完）。";
    $("sDemo").addEventListener("click", async () => { if (P.menu.items.length && !(await P.confirm("目前的菜單會被示範菜單取代。", "取代", true))) return; P.menu = P.demoMenu(); await P.saveMenu(); P.toast("已載入示範菜單"); });
    $("sClearMenu").addEventListener("click", async () => { if (await P.confirm("清空整個菜單？已送出的訂單不受影響。", "清空", true)) { P.menu = { cats: [], items: [] }; await P.saveMenu(); P.toast("已清空"); } });
    $("sClearOrders").addEventListener("click", async () => {
      if (!(await P.confirm(`刪除全部 ${nOrders} 筆訂單與報表資料？這個動作無法復原，建議先下載備份。`, "刪除", true))) return;
      await P.ordersClear(); await P.kvSet("seq", null); P.emit("orders", {}); P.toast("訂單已清除"); renderSettings();
    });
    $("sReset").addEventListener("click", async () => {
      if (!(await P.confirm("清掉菜單、訂單、密碼和所有設定，回到第一次使用的樣子？（啟用狀態會保留）", "全部重設", true))) return;
      await P.ordersClear(); await P.kvSet("seq", null);
      P.settings = P.defaults(); await P.saveSettings(); P.menu = { cats: [], items: [] }; await P.kvSet("menu", P.menu);
      location.reload();
    });
  }
})();
