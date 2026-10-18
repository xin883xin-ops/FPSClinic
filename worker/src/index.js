/*
 * kitlab.store 整站（Cloudflare Workers：靜態網頁 + /api 後端 + D1 資料庫）
 *
 * 網站檔案（index.html、launcher/、side.html…）由 Workers 靜態資源直接提供；
 * 只有 /api/ 開頭的網址會進到這支程式。下面列的路徑都要加上 /api 前綴，例如 /api/v1/catalog。
 *
 * 公開：
 *   GET  /v1/catalog          商店整份目錄（分類、輪播、上架中的應用），邊緣快取
 *   GET  /v1/apps/:id         單一應用
 *   POST /v1/feedback         推薦新站點／回報問題（Dash 與商店共用）
 *
 * 加密同步（免登入，Header：Authorization: Bearer <由復原碼推導的權杖>）：
 *   GET    /v1/vault/:id      取回密文
 *   PUT    /v1/vault/:id      存入密文 {iv, data, base_rev}；base_rev 不符回 409（另一台裝置剛改過）
 *   DELETE /v1/vault/:id      刪除雲端資料
 *   伺服器只拿到密文；復原碼與金鑰從不離開使用者的瀏覽器。超過 400 天沒更新的保險箱會自動清掉。
 *
 * 管理（Header：Authorization: Bearer <ADMIN_TOKEN>）：
 *   GET    /v1/admin/feedback?status=new
 *   PATCH  /v1/admin/feedback/:id      {status:"done"|"spam"|"new"}
 *   POST   /v1/admin/apps              新增應用（id 不給就自動編號）
 *   PATCH  /v1/admin/apps/:id          修改任何欄位，例如 {"status":"hidden"} 下架
 *   DELETE /v1/admin/apps/:id          等同下架（保留紀錄，Dash 已安裝的人不受影響）
 *   POST   /v1/admin/publish           目錄版本號 +1，清掉快取
 *
 * 不登入、不追蹤：訪客安裝了哪些應用只存在他自己的裝置，這裡完全不知道。
 */

const APP_FIELDS = ["name", "url", "category", "summary_zh", "desc_en", "featured", "offline", "publisher", "source", "listing_url", "tags", "status", "sort"];

export default {
  /* 每天清一次：超過 400 天沒更新的同步保險箱、180 天前處理完的回報 */
  async scheduled(event, env, ctx) {
    ctx.waitUntil(env.DB.batch([
      env.DB.prepare("DELETE FROM vaults WHERE updated_at < datetime('now','-400 days')"),
      env.DB.prepare("DELETE FROM feedback WHERE status!='new' AND created_at < datetime('now','-180 days')")
    ]));
  },
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    if (url.hostname === "www.kitlab.store") { url.hostname = "kitlab.store"; return Response.redirect(url.toString(), 301); }
    if (!url.pathname.startsWith("/api/") && url.pathname !== "/api") return page(req, env, url);
    url.pathname = url.pathname.slice(4) || "/";
    const cors = corsHeaders(req, env);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    try {
      const res = await route(req, env, ctx, url);
      for (const [k, v] of Object.entries(cors)) res.headers.set(k, v);
      return res;
    } catch (e) {
      const status = e.status || 500;
      if (status === 500) console.error("API error", (e && e.stack) || e);
      return json({ ok: false, error: status === 500 ? "伺服器出錯了，請稍後再試" : e.message }, status, cors);
    }
  }
};

async function route(req, env, ctx, url) {
  const p = url.pathname.replace(/\/+$/, "");
  const m = req.method;

  if (m === "GET" && (p === "" || p === "/v1")) return json({ ok: true, name: "KitLab Dash API" });
  if (m === "GET" && p === "/v1/catalog") return catalog(req, env, ctx);
  let r;
  if (m === "GET" && (r = p.match(/^\/v1\/apps\/(\d+)$/))) {
    const row = await env.DB.prepare("SELECT * FROM apps WHERE id=? AND status='live'").bind(+r[1]).first();
    if (!row) throw httpErr(404, "找不到這個應用");
    return json({ ok: true, app: compact(row) }, 200, { "Cache-Control": "public, max-age=300" });
  }
  if (m === "POST" && p === "/v1/feedback") return feedback(req, env);
  if ((r = p.match(/^\/v1\/vault\/([0-9a-f]{64})$/))) return vault(req, env, m, r[1]);

  if (p.startsWith("/v1/admin/")) {
    requireAdmin(req, env);
    if (m === "GET" && p === "/v1/admin/feedback") {
      const st = url.searchParams.get("status") || "new";
      const { results } = await env.DB.prepare("SELECT id,kind,source,app_id,app_name,url,message,contact,status,created_at FROM feedback WHERE status=? ORDER BY id DESC LIMIT 200").bind(st).all();
      return json({ ok: true, items: results });
    }
    if (m === "PATCH" && (r = p.match(/^\/v1\/admin\/feedback\/(\d+)$/))) {
      const b = await body(req);
      if (!["new", "done", "spam"].includes(b.status)) throw httpErr(400, "status 只能是 new、done 或 spam");
      await env.DB.prepare("UPDATE feedback SET status=? WHERE id=?").bind(b.status, +r[1]).run();
      return json({ ok: true });
    }
    if (m === "POST" && p === "/v1/admin/apps") {
      const b = await body(req);
      for (const k of ["name", "url", "category", "summary_zh"]) if (!b[k]) throw httpErr(400, "缺少欄位 " + k);
      checkUrl(b.url);
      const id = b.id || ((await env.DB.prepare("SELECT COALESCE(MAX(id),0)+1 AS n FROM apps").first()).n);
      const vals = APP_FIELDS.map((k) => norm(k, b[k] ?? defaults(k)));
      await env.DB.prepare(`INSERT INTO apps(id,${APP_FIELDS.join(",")}) VALUES(?,${APP_FIELDS.map(() => "?").join(",")})`).bind(id, ...vals).run();
      await bump(env);
      return json({ ok: true, id });
    }
    if ((m === "PATCH" || m === "DELETE") && (r = p.match(/^\/v1\/admin\/apps\/(\d+)$/))) {
      const b = m === "DELETE" ? { status: "hidden" } : await body(req);
      const keys = APP_FIELDS.filter((k) => k in b);
      if (!keys.length) throw httpErr(400, "沒有要改的欄位");
      if (b.url) checkUrl(b.url);
      const q = `UPDATE apps SET ${keys.map((k) => k + "=?").join(",")}, updated_at=datetime('now') WHERE id=?`;
      const res = await env.DB.prepare(q).bind(...keys.map((k) => norm(k, b[k])), +r[1]).run();
      if (!res.meta.changes) throw httpErr(404, "找不到這個應用");
      await bump(env);
      return json({ ok: true });
    }
    if (m === "POST" && p === "/v1/admin/publish") { const v = await bump(env); return json({ ok: true, version: v }); }
  }
  throw httpErr(404, "沒有這個網址");
}

/* ---------- 網站頁面：和 GitHub Pages 一樣，/side.html、/launcher/index.html 原樣提供，不轉址 ---------- */
async function page(req, env, url) {
  if (url.pathname.endsWith(".html")) {
    const u = new URL(url);
    u.pathname = url.pathname.endsWith("/index.html") ? url.pathname.slice(0, -10) : url.pathname.slice(0, -5);
    const res = await env.ASSETS.fetch(new Request(u.toString(), req));
    if (res.status === 200) return res;
  }
  return env.ASSETS.fetch(req);
}

/* ---------- 目錄：整份給前端，依版本號在邊緣快取 ---------- */
async function catalog(req, env, ctx) {
  const ver = (await env.DB.prepare("SELECT value FROM meta WHERE key='version'").first())?.value || "0";
  const cache = caches.default;
  const key = new Request(new URL("/api/v1/catalog?v=" + ver, req.url).toString());
  const hit = await cache.match(key);
  if (hit) return new Response(hit.body, hit);

  const [cats, apps, hero, meta] = await env.DB.batch([
    env.DB.prepare("SELECT key AS k, name AS n, hue AS h FROM categories ORDER BY sort"),
    env.DB.prepare("SELECT * FROM apps WHERE status='live' ORDER BY sort, id"),
    env.DB.prepare("SELECT h.app_id AS i, h.short, h.why, h.dev, h.color, h.icon FROM hero h JOIN apps a ON a.id=h.app_id AND a.status='live' ORDER BY h.sort"),
    env.DB.prepare("SELECT key, value FROM meta")
  ]);
  const info = Object.fromEntries(meta.results.map((x) => [x.key, x.value]));
  const res = json({ ok: true, version: +ver, updated: info.updated, part: info.part, cats: cats.results, hero: hero.results, apps: apps.results.map(compact) }, 200,
    { "Cache-Control": "public, max-age=120, s-maxage=600" });
  ctx.waitUntil(cache.put(key, res.clone()));
  return res;
}

/* 前端用的精簡格式（和商店頁裡的欄位名稱一致） */
function compact(a) {
  const o = { i: a.id, n: a.name, u: a.url, c: a.category, d: a.summary_zh };
  if (a.desc_en) o.e = a.desc_en;
  if (a.featured) o.f = 1;
  if (a.offline) o.o = 1;
  if (a.publisher) o.p = a.publisher;
  if (a.source) o.s = a.source;
  if (a.listing_url) o.l = a.listing_url;
  if (a.tags) { try { const t = JSON.parse(a.tags); if (t.length) o.t = t; } catch (e) {} }
  return o;
}

/* ---------- 建議與回報 ---------- */
async function feedback(req, env) {
  const b = await body(req);
  const kind = b.kind === "fix" ? "fix" : "add";
  const message = String(b.message || "").trim().slice(0, 2000);
  const link = String(b.url || "").trim().slice(0, 500);
  if (b.website) return json({ ok: true });                      // 機器人陷阱欄位
  if (!message && !link) throw httpErr(400, "請寫一點內容再送出");
  if (link) checkUrl(link);

  const ip = req.headers.get("CF-Connecting-IP") || "0";
  const ipHash = await sha256(ip + "|" + (env.SALT || "kitlab"));
  const recent = await env.DB.prepare("SELECT COUNT(*) AS n FROM feedback WHERE ip_hash=? AND created_at > datetime('now','-1 hour')").bind(ipHash).first();
  if (recent.n >= 8) throw httpErr(429, "送出太多次了，請一小時後再試");

  await env.DB.prepare("INSERT INTO feedback(kind,source,app_id,app_name,url,message,contact,ip_hash) VALUES(?,?,?,?,?,?,?,?)")
    .bind(kind, String(b.source || "").slice(0, 20), String(b.app_id || "").slice(0, 40) || null, String(b.app_name || "").slice(0, 120) || null,
      link || null, message || "(只附網址)", String(b.contact || "").slice(0, 120) || null, ipHash).run();
  return json({ ok: true });
}

/* ---------- 加密同步保險箱 ---------- */
const VAULT_MAX = 700000; // 密文上限（base64 字元），約 500 KB 的資料
async function vault(req, env, m, id) {
  const tok = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!/^[A-Za-z0-9_-]{40,}$/.test(tok)) throw httpErr(401, "缺少同步權杖");
  const th = await sha256(tok);
  const row = await env.DB.prepare("SELECT id, auth_hash, rev, iv, data, updated_at FROM vaults WHERE id=?").bind(id).first();
  if (row && !timingSafeEqual(row.auth_hash, th)) throw httpErr(403, "復原碼不符");
  const noStore = { "Cache-Control": "no-store" };

  if (m === "GET") {
    if (!row) throw httpErr(404, "雲端沒有這組復原碼的資料");
    return json({ ok: true, rev: row.rev, iv: row.iv, data: row.data, updated: row.updated_at }, 200, noStore);
  }
  if (m === "DELETE") {
    if (row) await env.DB.prepare("DELETE FROM vaults WHERE id=?").bind(id).run();
    return json({ ok: true }, 200, noStore);
  }
  if (m === "PUT") {
    if ((req.headers.get("Content-Length") || 0) > VAULT_MAX + 4000) throw httpErr(413, "同步資料太大了");
    let b; try { b = await req.json(); } catch (e) { throw httpErr(400, "格式不對"); }
    const iv = String(b.iv || ""), data = String(b.data || "");
    if (!/^[A-Za-z0-9+/=]{16,24}$/.test(iv) || !/^[A-Za-z0-9+/=]+$/.test(data)) throw httpErr(400, "密文格式不對");
    if (data.length > VAULT_MAX) throw httpErr(413, "同步資料太大了");
    if (!row) {
      const ipHash = await sha256((req.headers.get("CF-Connecting-IP") || "0") + "|" + (env.SALT || "kitlab"));
      const n = await env.DB.prepare("SELECT COUNT(*) AS n FROM vaults WHERE ip_hash=? AND created_at > datetime('now','-1 day')").bind(ipHash).first();
      if (n.n >= 10) throw httpErr(429, "今天建立的同步太多了，明天再試");
      await env.DB.prepare("INSERT INTO vaults(id,auth_hash,rev,iv,data,size,ip_hash) VALUES(?,?,1,?,?,?,?)").bind(id, th, iv, data, data.length, ipHash).run();
      return json({ ok: true, rev: 1 }, 200, noStore);
    }
    if (b.base_rev != null && +b.base_rev !== row.rev) return json({ ok: false, error: "另一台裝置剛更新過", conflict: true, rev: row.rev }, 409, noStore);
    const res = await env.DB.prepare("UPDATE vaults SET rev=rev+1, iv=?, data=?, size=?, updated_at=datetime('now') WHERE id=? AND rev=? RETURNING rev")
      .bind(iv, data, data.length, id, row.rev).first();
    if (!res) return json({ ok: false, error: "另一台裝置剛更新過", conflict: true }, 409, noStore);
    return json({ ok: true, rev: res.rev }, 200, noStore);
  }
  throw httpErr(405, "不支援這個動作");
}

/* ---------- 工具 ---------- */
function corsHeaders(req, env) {
  const allow = (env.ALLOWED_ORIGINS || "https://kitlab.store").split(",").map((s) => s.trim());
  const origin = req.headers.get("Origin") || "";
  const ok = allow.includes(origin) || /^http:\/\/localhost(:\d+)?$/.test(origin);
  return {
    "Access-Control-Allow-Origin": ok ? origin : allow[0],
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}
function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", ...headers } });
}
function httpErr(status, message) { const e = new Error(message); e.status = status; return e; }
async function body(req) {
  if ((req.headers.get("Content-Length") || 0) > 20000) throw httpErr(413, "內容太長");
  try { return await req.json(); } catch (e) { throw httpErr(400, "格式不對，請送 JSON"); }
}
function requireAdmin(req, env) {
  const t = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!env.ADMIN_TOKEN || t.length < 16 || !timingSafeEqual(t, env.ADMIN_TOKEN)) throw httpErr(401, "需要管理權杖");
}
function timingSafeEqual(a, b) { if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; }
function checkUrl(u) { try { const x = new URL(u); if (!/^https?:$/.test(x.protocol)) throw 0; } catch (e) { throw httpErr(400, "網址格式不對，要以 https:// 開頭"); } }
function defaults(k) { return { featured: 0, offline: 0, status: "live", sort: 9999, source: "kitlab" }[k] ?? null; }
function norm(k, v) {
  if (k === "tags") return v == null ? null : (typeof v === "string" ? v : JSON.stringify(v));
  if (k === "featured" || k === "offline") return v ? 1 : 0;
  if (k === "status") { if (!["live", "hidden"].includes(v)) throw httpErr(400, "status 只能是 live 或 hidden"); return v; }
  return v ?? null;
}
async function bump(env) {
  const r = await env.DB.prepare("UPDATE meta SET value=CAST(value AS INTEGER)+1 WHERE key='version' RETURNING value").first();
  await env.DB.prepare("INSERT INTO meta(key,value) VALUES('updated',date('now')) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run();
  return r ? +r.value : 0;
}
async function sha256(s) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
