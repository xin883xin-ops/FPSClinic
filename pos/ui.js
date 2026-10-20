/* 共用介面小工具：彈窗、確認、提示、數字鍵盤、提示音 */
"use strict";
(function () {
  const { $, esc } = P;

  /* ---- 提示 ---- */
  let toastT = 0;
  P.toast = (msg, ms = 2600) => {
    const t = $("toast");
    t.textContent = msg; t.classList.add("on");
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("on"), ms);
  };

  /* ---- 彈窗 ----
     P.modal({ title, body(html), actions:[{label, kind, value, keep}], wide, onOpen(el) }) → Promise<value>
     點遮罩、按 Esc 回傳 undefined */
  const stack = [];
  P.modal = opts => new Promise(resolve => {
    const root = $("modals");
    const wrap = document.createElement("div");
    wrap.className = "mdl" + (opts.wide ? " wide" : "") + (opts.cls ? " " + opts.cls : "");
    wrap.innerHTML = `<div class="mdl-card" role="dialog" aria-modal="true" aria-label="${esc(opts.title || "")}">
      ${opts.title ? `<h2>${esc(opts.title)}</h2>` : ""}
      <div class="mdl-body">${opts.body || ""}</div>
      ${opts.actions && opts.actions.length ? `<div class="mdl-acts">${opts.actions.map((a, i) => `<button type="button" class="btn ${a.kind || ""}" data-i="${i}">${esc(a.label)}</button>`).join("")}</div>` : ""}
    </div>`;
    const prevFocus = document.activeElement;
    let done = false;
    const close = v => {
      if (done) return; done = true;
      wrap.classList.remove("on");
      const k = stack.indexOf(close); if (k >= 0) stack.splice(k, 1);
      setTimeout(() => wrap.remove(), 200);
      if (prevFocus && prevFocus.focus) try { prevFocus.focus({ preventScroll: true }); } catch (_) {}
      resolve(v);
    };
    stack.push(close);
    wrap.addEventListener("click", e => {
      if (e.target === wrap && !opts.locked) return close(undefined);
      const b = e.target.closest(".mdl-acts button");
      if (!b) return;
      const a = opts.actions[+b.dataset.i];
      if (a.onClick) { const r = a.onClick(wrap, close); if (r === false) return; }
      if (!a.keep) close(a.value);
    });
    root.appendChild(wrap);
    requestAnimationFrame(() => wrap.classList.add("on"));
    if (opts.onOpen) opts.onOpen(wrap, close);
    const first = wrap.querySelector("input,select,textarea") || wrap.querySelector(".mdl-acts .btn.primary") || wrap.querySelector(".btn");
    if (first && !opts.noFocus) try { first.focus({ preventScroll: true }); } catch (_) {}
  });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && stack.length) stack[stack.length - 1](undefined); });

  P.confirm = (msg, okLabel = "確定", danger = false, title = "請確認") =>
    P.modal({ title, body: `<p class="plain">${esc(msg).replace(/\n/g, "<br>")}</p>`,
      actions: [{ label: "取消", value: false }, { label: okLabel, kind: danger ? "danger" : "primary", value: true }] }).then(v => v === true);

  P.alert = (msg, title = "提示") => P.modal({ title, body: `<p class="plain">${esc(msg).replace(/\n/g, "<br>")}</p>`, actions: [{ label: "知道了", kind: "primary", value: true }] });

  /* ---- 數字鍵盤（輸入 PIN） ---- */
  P.askPin = (title, hint = "") => new Promise(resolve => {
    let val = "";
    const body = `<p class="plain hint">${esc(hint)}</p><div class="pin-dots" id="pinDots" aria-live="polite">${"<i></i>".repeat(6)}</div>
      <div class="pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9, "", 0, "⌫"].map(k => k === "" ? "<span></span>" : `<button type="button" data-k="${k}" aria-label="${k === "⌫" ? "刪除" : k}">${k}</button>`).join("")}</div>
      <p class="pin-err" id="pinErr" role="alert"></p>`;
    P.modal({ title, body, locked: false, cls: "pin", noFocus: true,
      actions: [{ label: "取消", value: null }, { label: "確定", kind: "primary", keep: true, onClick: (el, close) => { if (val.length < 4) { el.querySelector("#pinErr").textContent = "請輸入 4 到 6 位數字"; return false; } close(val); return false; } }],
      onOpen: (el, close) => {
        const dots = [...el.querySelectorAll("#pinDots i")];
        const paint = () => dots.forEach((d, i) => d.classList.toggle("on", i < val.length));
        el.addEventListener("click", e => {
          const b = e.target.closest(".pad button"); if (!b) return;
          const k = b.dataset.k;
          el.querySelector("#pinErr").textContent = "";
          if (k === "⌫") val = val.slice(0, -1); else if (val.length < 6) val += k;
          paint();
        });
        const key = e => {
          if (!document.body.contains(el)) return document.removeEventListener("keydown", key);
          if (/^\d$/.test(e.key) && val.length < 6) { val += e.key; paint(); }
          else if (e.key === "Backspace") { val = val.slice(0, -1); paint(); }
          else if (e.key === "Enter" && val.length >= 4) { document.removeEventListener("keydown", key); close(val); }
        };
        document.addEventListener("keydown", key);
        el.shake = () => { el.querySelector(".mdl-card").classList.remove("shake"); void el.offsetWidth; el.querySelector(".mdl-card").classList.add("shake"); val = ""; paint(); };
        P._pinEl = el;
      }
    }).then(resolve);
  });
  P.pinError = msg => { const el = P._pinEl; if (el && document.body.contains(el)) { el.querySelector("#pinErr").textContent = msg; el.shake && el.shake(); } };

  /* ---- 提示音（新訂單） ---- */
  let actx = null;
  P.primeAudio = () => {
    try {
      if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === "suspended") actx.resume();
    } catch (_) {}
  };
  P.beep = () => {
    try {
      if (!actx) return;
      const t = actx.currentTime;
      [[880, 0], [1175, 0.16]].forEach(([f, d]) => {
        const o = actx.createOscillator(), g = actx.createGain();
        o.type = "sine"; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t + d); g.gain.exponentialRampToValueAtTime(0.35, t + d + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.28);
        o.connect(g); g.connect(actx.destination); o.start(t + d); o.stop(t + d + 0.3);
      });
    } catch (_) {}
  };

  /* ---- 列印單號小條 ---- */
  P.printSlip = o => {
    const s = $("slip");
    s.innerHTML = `<div class="s-shop">${esc(P.settings.shop)}</div><div class="s-no">${P.pad(o.no, 3)}</div>
      <div class="s-meta">${esc(o.dine)}${o.label ? "　" + esc(o.label) : ""}　${o.day} ${P.timeOf(o.ts)}</div>
      <hr>${o.items.map(i => `<div class="s-line"><span>${esc(i.name)} × ${i.qty}</span><span>${P.money(i.price * i.qty)}</span></div>`).join("")}
      <hr><div class="s-line s-total"><span>合計</span><span>${P.money(o.total)}</span></div>${o.note ? `<div class="s-note">備註：${esc(o.note)}</div>` : ""}${P.license ? "" : `<div class="s-trial">試用版</div>`}`;
    document.body.classList.add("printing");
    setTimeout(() => { window.print(); setTimeout(() => document.body.classList.remove("printing"), 400); }, 60);
  };

  /* ---- 圖片縮小（店家上傳菜色照片，存成小圖，不佔太多空間） ---- */
  P.shrinkImage = (file, max = 520, q = 0.82) => new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      const r = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * r); c.height = Math.round(img.height * r);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", q));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("無法讀取圖片")); };
    img.src = url;
  });
})();
