/*
 * KitLab 加密雲端同步（免登入）
 *
 * 同步 kitlab.store 上這些資料：Toolkit 工具箱（捷徑、待辦、便條、外觀）、Dash 的 Dock、從商店安裝的應用、我的捷徑。
 * 1. 瀏覽器隨機產生 160 位元的復原碼，格式像 KL7Q-X2M9-…（8 組）。
 * 2. 用 HKDF 從復原碼推導三樣東西：保險箱編號、寫入權杖、AES-256-GCM 金鑰。
 * 3. 資料在這台裝置加密後才上傳；伺服器只拿到編號、權杖雜湊與密文，看不到內容，也沒有復原碼。
 * 4. 換裝置時輸入復原碼就能還原，不用帳號。復原碼弄丟就無法還原，我們也解不開。
 *
 * 頁面用法：<script src="/sync.js" defer></script>，按鈕呼叫 KitLabSync.open()。
 * 有新資料從雲端下來時會觸發 window 的 "kitlab-sync-applied" 事件；頁面沒有攔截的話會自動重新整理一次。
 */
(function () {
  "use strict";
  if (window.KitLabSync) return;
  var API = "/api";
  var KEYS = ["sd_state_v3", "sd_look_v1", "kitlab-launcher-dock", "kitlab-dash-installed", "kitlab-dash-links", "kitlab-dash-links-col"];
  var CFG_KEY = "kitlab-sync";
  var A32 = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"; // Crockford Base32，不含 I L O U，抄寫不易出錯
  var te = new TextEncoder(), td = new TextDecoder();
  var busy = null, listeners = [];

  /* ---------- 設定與狀態（只存在這台裝置） ---------- */
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  function lsDel(k) { try { localStorage.removeItem(k); } catch (e) {} }
  function cfg() { try { return JSON.parse(lsGet(CFG_KEY)) || null; } catch (e) { return null; } }
  function saveCfg(c) { if (c) lsSet(CFG_KEY, JSON.stringify(c)); else lsDel(CFG_KEY); emit(); }
  function emit() { listeners.forEach(function (f) { try { f(status()); } catch (e) {} }); }
  function status() { var c = cfg(); return { on: !!(c && c.code), last: c && c.last, error: c && c.error }; }

  /* ---------- 復原碼 ---------- */
  function newCode() {
    var b = crypto.getRandomValues(new Uint8Array(20)), bits = 0, val = 0, out = "";
    for (var i = 0; i < b.length; i++) { val = (val << 8) | b[i]; bits += 8; while (bits >= 5) { out += A32[(val >>> (bits - 5)) & 31]; bits -= 5; } }
    return out.match(/.{4}/g).join("-");
  }
  function normCode(s) {
    return String(s || "").toUpperCase().replace(/[O]/g, "0").replace(/[IL]/g, "1").replace(/[^0-9A-Z]/g, "");
  }
  function codeBytes(s) {
    var c = normCode(s); if (c.length !== 32) return null;
    var out = new Uint8Array(20), bits = 0, val = 0, j = 0;
    for (var i = 0; i < c.length; i++) { var v = A32.indexOf(c[i]); if (v < 0) return null; val = (val << 5) | v; bits += 5; if (bits >= 8) { out[j++] = (val >>> (bits - 8)) & 255; bits -= 8; } }
    return out;
  }
  function pretty(s) { return normCode(s).match(/.{1,4}/g).join("-"); }

  /* ---------- 金鑰推導與加解密 ---------- */
  var keyCache = {};
  function derive(code) {
    var n = normCode(code);
    if (keyCache[n]) return keyCache[n];
    var raw = codeBytes(n); if (!raw) return Promise.reject(new Error("復原碼格式不對，應該是 32 個字（8 組，每組 4 個）"));
    var salt = te.encode("kitlab-sync-v1");
    keyCache[n] = crypto.subtle.importKey("raw", raw, "HKDF", false, ["deriveBits", "deriveKey"]).then(function (base) {
      var p = function (info) { return { name: "HKDF", hash: "SHA-256", salt: salt, info: te.encode(info) }; };
      return Promise.all([
        crypto.subtle.deriveBits(p("vault-id"), base, 256),
        crypto.subtle.deriveBits(p("write-token"), base, 256),
        crypto.subtle.deriveKey(p("aes-gcm"), base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"])
      ]).then(function (r) { return { id: hex(r[0]), auth: b64url(r[1]), key: r[2] }; });
    });
    return keyCache[n];
  }
  function hex(buf) { return Array.prototype.map.call(new Uint8Array(buf), function (x) { return x.toString(16).padStart(2, "0"); }).join(""); }
  function b64(u8) { var s = ""; for (var i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); }
  function unb64(s) { var b = atob(s), u = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
  function b64url(buf) { return b64(new Uint8Array(buf)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
  function gz(u8, mode) {
    if (typeof CompressionStream === "undefined") return Promise.resolve(null);
    var s = new Blob([u8]).stream().pipeThrough(mode ? new CompressionStream("gzip") : new DecompressionStream("gzip"));
    return new Response(s).arrayBuffer().then(function (b) { return new Uint8Array(b); });
  }
  function seal(k, obj) {
    var plain = te.encode(JSON.stringify(obj));
    return gz(plain, true).then(function (z) {
      var body = z ? concat([1], z) : concat([0], plain), iv = crypto.getRandomValues(new Uint8Array(12));
      return crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, k.key, body).then(function (ct) { return { iv: b64(iv), data: b64(new Uint8Array(ct)) }; });
    });
  }
  function open_(k, iv, data) {
    return crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(iv) }, k.key, unb64(data)).catch(function () { throw new Error("解不開雲端資料，復原碼可能不對"); })
      .then(function (b) { var u = new Uint8Array(b); return u[0] === 1 ? gz(u.subarray(1), false) : u.subarray(1); })
      .then(function (u) { return JSON.parse(td.decode(u)); });
  }
  function concat(a, b) { var o = new Uint8Array(a.length + b.length); o.set(a, 0); o.set(b, a.length); return o; }

  /* ---------- 雲端 ---------- */
  function call(method, k, body) {
    return fetch(API + "/v1/vault/" + k.id, {
      method: method, headers: { "Authorization": "Bearer " + k.auth, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined, cache: "no-store"
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) { j.status = r.status; if (!r.ok && r.status !== 404 && r.status !== 409) throw new Error(j.error || "雲端暫時連不上"); return j; });
    }, function () { throw new Error("連不上雲端，請確認網路"); });
  }

  /* ---------- 變更追蹤：每個項目記內容雜湊與最後修改時間，兩台裝置各自改不同項目也不會互相蓋掉 ---------- */
  function h32(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36) + ":" + s.length; }
  function track(c) {
    c.track = c.track || {}; var changed = false;
    KEYS.forEach(function (k) {
      var v = lsGet(k); if (v == null) return;
      var h = h32(v), t = c.track[k];
      if (!t || t.h !== h) { c.track[k] = { h: h, t: Date.now() }; changed = true; }
    });
    return changed;
  }
  function payload(c) {
    var keys = {};
    KEYS.forEach(function (k) { var v = lsGet(k); if (v != null && c.track[k]) keys[k] = { v: v, t: c.track[k].t }; });
    return { v: 1, app: "kitlab", at: Date.now(), keys: keys };
  }
  function merge(c, remote, remoteWins) {
    var changed = [];
    Object.keys((remote && remote.keys) || {}).forEach(function (k) {
      if (KEYS.indexOf(k) < 0) return;
      var r = remote.keys[k], l = c.track[k];
      if (remoteWins || !l || r.t > l.t) {
        if (lsGet(k) !== r.v) { lsSet(k, r.v); changed.push(k); }
        c.track[k] = { h: h32(r.v), t: r.t };
      }
    });
    return changed;
  }
  function same(c, remote) {
    if (!remote) return false;
    return KEYS.every(function (k) { var a = c.track[k], b = remote.keys[k]; return (!a && !b) || (a && b && a.t === b.t && a.h === h32(b.v)); });
  }

  /* 一次完整同步：拉下雲端 → 合併 → 有差異才推上去 */
  function sync(opts) {
    opts = opts || {};
    if (busy) return busy;
    var c = cfg(); if (!c || !c.code) return Promise.resolve({ off: true });
    busy = derive(c.code).then(function (k) {
      track(c);
      return call("GET", k).then(function (g) {
        var get = g.status === 404 ? Promise.resolve(null) : open_(k, g.iv, g.data);
        return get.then(function (remote) {
          var changed = remote ? merge(c, remote, opts.remoteWins) : [];
          c.rev = remote ? g.rev : null;
          if (remote && same(c, remote)) return changed;
          return seal(k, payload(c)).then(function (box) {
            return call("PUT", k, { iv: box.iv, data: box.data, base_rev: c.rev }).then(function (p) {
              if (p.status === 409) { if (opts.retried) throw new Error("另一台裝置一直在更新，稍後再試"); busy = null; saveCfg(c); return sync({ retried: true }).then(function () { return changed; }); }
              c.rev = p.rev; return changed;
            });
          });
        });
      }).then(function (changed) {
        var c2 = cfg(); if (!c2 || c2.code !== c.code) return { changed: [] };
        c.last = new Date().toISOString(); c.error = null; saveCfg(c);
        if (changed && changed.length) applied(changed);
        return { changed: changed || [] };
      });
    }).catch(function (e) {
      var c2 = cfg(); if (c2 && c2.code) { c2.error = e.message; saveCfg(c2); }
      throw e;
    }).finally(function () { busy = null; });
    return busy;
  }
  function applied(keys) {
    var ev = new CustomEvent("kitlab-sync-applied", { cancelable: true, detail: { keys: keys } });
    if (window.dispatchEvent(ev)) {
      try { if (sessionStorage.getItem("kitlab-sync-reloaded")) return; sessionStorage.setItem("kitlab-sync-reloaded", "1"); } catch (e) {}
      location.reload();
    }
  }

  /* ---------- 開啟、還原、停止、刪除 ---------- */
  function enable(code) {
    var c = { code: pretty(code), track: {}, rev: null };
    track(c); saveCfg(c);
    return sync();
  }
  function restore(code) {
    return derive(code).then(function (k) {
      return call("GET", k).then(function (g) {
        if (g.status === 404) throw new Error("雲端沒有這組復原碼的資料，請再確認一次");
        return open_(k, g.iv, g.data).then(function (remote) {
          var c = { code: pretty(code), track: {}, rev: g.rev };
          var changed = merge(c, remote, true); track(c);
          c.last = new Date().toISOString(); saveCfg(c);
          return changed;
        });
      });
    });
  }
  function disable() { saveCfg(null); }
  function wipe() {
    var c = cfg(); if (!c) return Promise.resolve();
    return derive(c.code).then(function (k) { return call("DELETE", k); }).then(function () { saveCfg(null); });
  }

  /* ---------- 自動同步：開頁時、切回分頁時、離開前，以及每 30 秒檢查有沒有改動 ---------- */
  var pushT = null;
  function soon(ms) { clearTimeout(pushT); pushT = setTimeout(function () { sync().catch(function () {}); }, ms); }
  function changedLocally() { var c = cfg(); if (!c || !c.code) return false; var t = JSON.parse(JSON.stringify(c.track || {})), x = { track: t }; return track(x); }
  function auto() {
    if (!status().on) return;
    soon(400);
    document.addEventListener("visibilitychange", function () {
      if (!status().on) return;
      if (document.visibilityState === "visible") soon(300); else if (changedLocally()) sync().catch(function () {});
    });
    setInterval(function () { if (status().on && document.visibilityState === "visible" && changedLocally()) soon(1500); }, 30000);
  }

  /* ---------- 介面（Shadow DOM，放進哪一頁都不會被樣式干擾） ---------- */
  var host = null, root = null, view = "home", draft = null, msg = "";
  var CSS = ':host{all:initial}*{box-sizing:border-box}' +
    '.sc{position:fixed;inset:0;z-index:2147483000;background:rgba(4,6,9,.62);display:grid;place-items:center;padding:16px;font-family:"Noto Sans TC","PingFang TC","Microsoft JhengHei",system-ui,sans-serif;color:#f2f4f7;-webkit-font-smoothing:antialiased}' +
    '.pn{width:min(520px,100%);max-height:calc(100vh - 32px);overflow:auto;background:#151a21;border:1px solid #2a323d;border-radius:22px;padding:26px 26px 22px;box-shadow:0 30px 80px rgba(0,0,0,.6);font-size:15px;line-height:1.65}' +
    'h2{margin:0;font-size:22px;font-weight:700;letter-spacing:-.01em}.sub{color:#9aa4b2;margin:6px 0 0;font-size:14px}' +
    '.hd{display:flex;align-items:flex-start;gap:12px;margin-bottom:18px}.hd>div{flex:1}' +
    '.x{width:36px;height:36px;border-radius:50%;border:0;background:#222a34;color:#c9cfd8;font-size:20px;cursor:pointer;flex:none}' +
    'ul{margin:0 0 18px;padding:0;list-style:none;display:grid;gap:10px}li{display:grid;grid-template-columns:22px 1fr;gap:8px;color:#c9cfd8;font-size:14px}li b{color:#f2f4f7}' +
    'li i{width:22px;height:22px;border-radius:7px;background:#1f3a31;color:#7cf0b4;display:grid;place-items:center;font-style:normal;font-size:12px;font-weight:700}' +
    '.row{display:flex;gap:10px;flex-wrap:wrap}.btn{appearance:none;border:1px solid #33404f;background:transparent;color:#f2f4f7;font:inherit;font-weight:700;font-size:14px;padding:11px 18px;border-radius:999px;cursor:pointer}' +
    '.btn:hover{border-color:#6b7787}.btn.pri{background:#f2f4f7;color:#0a0d12;border-color:#f2f4f7}.btn.pri:hover{background:#d8dde4}.btn:disabled{opacity:.4;cursor:not-allowed}' +
    '.btn.warn{color:#ffb3b3;border-color:#5a3434}.btn.link{border:0;padding:8px 4px;color:#9aa4b2;font-weight:500}' +
    '.code{white-space:normal;font-family:"JetBrains Mono",ui-monospace,Menlo,Consolas,monospace;font-size:19px;letter-spacing:.06em;background:#0c1015;border:1px dashed #3a4656;border-radius:14px;padding:16px;text-align:center;word-break:break-all;user-select:all;-webkit-user-select:all;color:#7cf0b4;margin:4px 0 12px}' +
    '.ck{display:grid;grid-template-columns:20px 1fr;gap:10px;align-items:start;margin:10px 0;color:#c9cfd8;font-size:14px;cursor:pointer}.ck input{width:18px;height:18px;margin:2px 0 0;accent-color:#7cf0b4}' +
    'input.in{width:100%;font-family:"JetBrains Mono",ui-monospace,Menlo,monospace;font-size:17px;letter-spacing:.05em;text-transform:uppercase;background:#0c1015;color:#f2f4f7;border:1px solid #33404f;border-radius:12px;padding:13px 14px;outline:0;margin:6px 0 14px}input.in:focus{border-color:#7cf0b4}' +
    '.st{display:flex;align-items:center;gap:10px;background:#0f1a16;border:1px solid #1f3a31;border-radius:14px;padding:12px 14px;margin-bottom:16px;font-size:14px}.st b{width:9px;height:9px;border-radius:50%;background:#7cf0b4;box-shadow:0 0 10px #7cf0b4;flex:none}' +
    '.st.err{background:#1d1414;border-color:#4a2a2a}.st.err b{background:#ff8a8a;box-shadow:none}' +
    '.msg{margin:10px 0 0;font-size:13px;color:#ffb3b3;min-height:1em}.ok{color:#7cf0b4}.fine{margin-top:16px;font-size:12.5px;color:#7d8796;line-height:1.6}' +
    '.lbl{font-size:13px;color:#9aa4b2}hr{border:0;border-top:1px solid #262e38;margin:18px 0}' +
    ':focus-visible{outline:2px solid #7cf0b4;outline-offset:2px}';
  function openPanel(v) {
    if (!host) {
      host = document.createElement("div"); host.setAttribute("data-kitlab-sync", "");
      root = host.attachShadow({ mode: "open" });
      document.body.appendChild(host);
      root.addEventListener("click", onClick); root.addEventListener("change", render.bind(null, true));
      root.addEventListener("keydown", function (e) { if (e.key === "Escape") { e.stopPropagation(); close(); } }, true);
    }
    host.hidden = false; msg = ""; view = v || (status().on ? "on" : "home"); draft = null;
    render();
  }
  function close() { if (host) { host.hidden = true; root.innerHTML = ""; } }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function when(iso) { if (!iso) return "還沒同步過"; var d = new Date(iso); return d.toLocaleString("zh-TW", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }); }
  function render(keep) {
    if (!root) return;
    if (keep === true && view !== "create") return;
    if (keep === true) { var a = root.getElementById("c1"), b = root.getElementById("c2"), go = root.getElementById("go"); if (go) go.disabled = !(a.checked && b.checked); return; }
    var s = status(), c = cfg(), h = "";
    var head = function (t, sub) { return '<div class="hd"><div><h2 id="t">' + t + '</h2>' + (sub ? '<p class="sub">' + sub + "</p>" : "") + '</div><button class="x" data-a="close" aria-label="關閉">×</button></div>'; };
    if (view === "home") {
      h = head("加密雲端同步", "不用登入。換手機、換電腦時，用一組復原碼把資料帶過去。") +
        '<ul><li><i>1</i><span>同步 <b>Toolkit 工具箱</b>的捷徑、待辦、便條，和 <b>Dash</b> 的 Dock 與已安裝的應用。</span></li>' +
        '<li><i>2</i><span>資料在<b>這台裝置上先加密</b>才上傳，金鑰來自只有你知道的復原碼。KitLab 看不到內容。</span></li>' +
        '<li><i>3</i><span>不需要帳號、Email 或手機號碼。<b>復原碼弄丟就無法還原</b>，我們也解不開。</span></li></ul>' +
        '<div class="row"><button class="btn pri" data-a="new">開啟同步，產生復原碼</button><button class="btn" data-a="restore">我有復原碼，要還原</button></div>' +
        '<p class="fine">隨時可以停止同步或刪除雲端資料。超過 400 天沒有使用的雲端資料會自動刪除。</p>';
    } else if (view === "create") {
      draft = draft || newCode();
      h = head("你的復原碼", "抄下來或存在密碼管理器裡。另一台裝置輸入這組字，就能還原。") +
        '<div class="code" id="code">' + draft.replace(/-/g, "-<wbr>") + '</div>' +
        '<div class="row" style="justify-content:center;margin-bottom:8px"><button class="btn" data-a="copy">複製</button><button class="btn" data-a="dl">存成文字檔</button></div><hr>' +
        '<label class="ck"><input type="checkbox" id="c1"><span>我同意把<b>加密後</b>的資料存到 KitLab 雲端（Cloudflare）。</span></label>' +
        '<label class="ck"><input type="checkbox" id="c2"><span>我已經把復原碼存在安全的地方，知道弄丟就無法還原。</span></label>' +
        '<div class="row" style="margin-top:14px"><button class="btn pri" id="go" data-a="enable" disabled>開始同步</button><button class="btn link" data-a="home">返回</button></div>' +
        '<p class="msg" id="msg">' + esc(msg) + "</p>";
    } else if (view === "restore") {
      h = head("用復原碼還原", "雲端的資料會取代這台裝置上的捷徑、待辦、便條、Dock 與已安裝的應用。") +
        '<label class="lbl" for="rc">復原碼（大小寫、有沒有連字號都可以）</label>' +
        '<input class="in" id="rc" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX">' +
        '<div class="row"><button class="btn pri" data-a="dorestore">還原到這台裝置</button><button class="btn link" data-a="home">返回</button></div>' +
        '<p class="msg" id="msg">' + esc(msg) + "</p>";
    } else if (view === "on") {
      h = head("加密雲端同步", "這台裝置的資料會自動加密並同步。") +
        '<div class="st' + (s.error ? " err" : "") + '"><b></b><span>' + (s.error ? "上次同步失敗：" + esc(s.error) : "同步中 · 上次同步 " + when(s.last)) + "</span></div>" +
        '<div class="lbl">你的復原碼</div><div class="code" id="code" style="' + (view === "on" && !root.__show ? "filter:blur(7px)" : "") + '">' + esc(c && c.code).replace(/-/g, "-<wbr>") + '</div>' +
        '<div class="row" style="margin-bottom:6px"><button class="btn" data-a="show">' + (root.__show ? "隱藏" : "顯示") + '</button><button class="btn" data-a="copy">複製</button><button class="btn pri" data-a="now">立即同步</button></div><hr>' +
        '<div class="row"><button class="btn" data-a="off">在這台裝置停止同步</button><button class="btn warn" data-a="wipe">刪除雲端資料</button></div>' +
        '<p class="msg" id="msg">' + esc(msg) + '</p><p class="fine">停止同步只會讓這台裝置不再上傳，資料還在雲端與其他裝置上。刪除雲端資料後，所有裝置都無法再用這組復原碼還原，但各裝置上現有的資料不受影響。</p>';
    } else if (view === "wipe") {
      h = head("刪除雲端資料？", "刪除後無法復原。各裝置上目前的資料會保留，只是不再同步。") +
        '<div class="row"><button class="btn warn" data-a="dowipe">確定刪除</button><button class="btn link" data-a="on">取消</button></div><p class="msg" id="msg">' + esc(msg) + "</p>";
    }
    root.innerHTML = "<style>" + CSS + '</style><div class="sc" data-a="scrim"><div class="pn" role="dialog" aria-modal="true" aria-labelledby="t">' + h + "</div></div>";
    var f = root.querySelector(view === "restore" ? "#rc" : ".pn .btn.pri, .pn .btn"); if (f) setTimeout(function () { f.focus(); }, 20);
  }
  function setMsg(t, ok) { msg = t; var m = root && root.getElementById("msg"); if (m) { m.textContent = t; m.className = "msg" + (ok ? " ok" : ""); } }
  function copy(t) {
    var done = function () { setMsg("已複製復原碼", true); };
    if (navigator.clipboard) navigator.clipboard.writeText(t).then(done, function () { selectCode(); setMsg("請手動選取上面的復原碼複製"); });
    else { selectCode(); setMsg("請手動選取上面的復原碼複製"); }
  }
  function selectCode() { var el = root.getElementById("code"); if (!el) return; var r = document.createRange(); r.selectNodeContents(el); var s = getSelection(); s.removeAllRanges(); s.addRange(r); }
  function onClick(e) {
    var t = e.target.closest("[data-a]"); if (!t) return;
    var a = t.getAttribute("data-a");
    if (a === "scrim") { if (e.target === t) close(); return; }
    if (a === "close") return close();
    if (a === "home" || a === "new" || a === "restore" || a === "on" || a === "wipe") { msg = ""; view = a === "new" ? "create" : a; if (a === "new") draft = null; return render(); }
    if (a === "copy") return copy(view === "create" ? draft : cfg().code);
    if (a === "show") { root.__show = !root.__show; return render(); }
    if (a === "dl") {
      try {
        var blob = new Blob(["KitLab 加密雲端同步 復原碼\n\n" + draft + "\n\n在 kitlab.store 的 Toolkit 或 Dash 開啟「雲端同步」→「我有復原碼，要還原」，輸入這組字。\n弄丟就無法還原，請妥善保存，不要給別人。\n"], { type: "text/plain" });
        var u = URL.createObjectURL(blob), l = document.createElement("a"); l.href = u; l.download = "KitLab-復原碼.txt"; document.body.appendChild(l); l.click(); l.remove(); setTimeout(function () { URL.revokeObjectURL(u); }, 2000);
        setMsg("已存成文字檔", true);
      } catch (err) { copy(draft); }
      return;
    }
    if (a === "enable") { t.disabled = true; t.textContent = "加密並上傳中…"; enable(draft).then(function () { view = "on"; msg = ""; render(); }, function (err) { saveCfg(null); t.disabled = false; t.textContent = "開始同步"; setMsg(err.message); }); return; }
    if (a === "dorestore") {
      var v = root.getElementById("rc").value; t.disabled = true; t.textContent = "解密中…";
      restore(v).then(function () { setMsg("還原完成，重新整理頁面…", true); try { sessionStorage.removeItem("kitlab-sync-reloaded"); } catch (e2) {} setTimeout(function () { location.reload(); }, 700); },
        function (err) { t.disabled = false; t.textContent = "還原到這台裝置"; setMsg(err.message); });
      return;
    }
    if (a === "now") { t.disabled = true; t.textContent = "同步中…"; sync().then(function () { render(); setMsg("已同步", true); }, function (err) { render(); setMsg(err.message); }); return; }
    if (a === "off") { disable(); view = "home"; msg = ""; render(); setMsg("這台裝置已停止同步", true); return; }
    if (a === "dowipe") { t.disabled = true; wipe().then(function () { view = "home"; render(); setMsg("雲端資料已刪除", true); }, function (err) { t.disabled = false; setMsg(err.message); }); return; }
  }

  window.KitLabSync = {
    open: openPanel, sync: sync, status: status,
    onChange: function (f) { listeners.push(f); f(status()); },
    _test: { newCode: newCode, normCode: normCode, derive: derive, seal: seal, open: open_, setApi: function (u) { API = u; } }
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", auto); else auto();
})();
