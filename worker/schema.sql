-- KitLab Dash 應用商店資料庫（Cloudflare D1）
-- 依相依順序刪除（重新匯入目錄用；feedback 與 vaults 不會被刪）
DROP TABLE IF EXISTS hero;
DROP TABLE IF EXISTS apps;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS meta;

CREATE TABLE categories (
  key   TEXT PRIMARY KEY,          -- ai, work, tool …
  name  TEXT NOT NULL,             -- 顯示名稱
  hue   TEXT NOT NULL,             -- 分類色（字母圖塊、標籤用）
  sort  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE apps (
  id          INTEGER PRIMARY KEY, -- 商店編號；Dash 安裝後的 id 是 "p" + 這個數字，不要重複使用
  name        TEXT NOT NULL,
  url         TEXT NOT NULL,       -- 官方網址
  category    TEXT NOT NULL REFERENCES categories(key),
  summary_zh  TEXT NOT NULL,       -- 中文介紹（卡片與介紹頁）
  desc_en     TEXT,                -- 原文介紹
  featured    INTEGER NOT NULL DEFAULT 0,
  offline     INTEGER NOT NULL DEFAULT 0,
  publisher   TEXT,
  source      TEXT,                -- pd = pwa.directory, pm = pwamart, kitlab = 自己加的
  listing_url TEXT,
  tags        TEXT,                -- JSON 陣列
  status      TEXT NOT NULL DEFAULT 'live',  -- live 上架 / hidden 下架
  sort        INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX apps_cat ON apps(category, status);

CREATE TABLE hero (                -- 首頁輪播
  app_id INTEGER PRIMARY KEY REFERENCES apps(id),
  sort   INTEGER NOT NULL DEFAULT 0,
  short  TEXT, why TEXT, dev TEXT, color TEXT, icon TEXT
);

CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT);

CREATE TABLE IF NOT EXISTS feedback (  -- 建議新站點、回報問題
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  kind       TEXT NOT NULL,        -- add 推薦 / fix 回報
  source     TEXT,                 -- dash / store
  app_id     TEXT,                 -- 回報對象（官方站點 id 或 p123）
  app_name   TEXT,
  url        TEXT,
  message    TEXT NOT NULL,
  contact    TEXT,
  ip_hash    TEXT,                 -- 只存雜湊，用來擋洗版，不存原始 IP
  status     TEXT NOT NULL DEFAULT 'new',  -- new / done / spam
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS feedback_status ON feedback(status, created_at);
CREATE INDEX IF NOT EXISTS feedback_ip ON feedback(ip_hash, created_at);

-- 加密同步保險箱：內容在瀏覽器加密後才上傳，這裡看不到明文，也沒有復原碼
CREATE TABLE IF NOT EXISTS vaults (
  id         TEXT PRIMARY KEY,     -- 由復原碼推導出的編號（64 位十六進位）
  auth_hash  TEXT NOT NULL,        -- 寫入權杖的 SHA-256；權杖本身也由復原碼推導
  rev        INTEGER NOT NULL DEFAULT 1,
  iv         TEXT NOT NULL,        -- AES-GCM 初始向量（base64）
  data       TEXT NOT NULL,        -- 密文（base64）
  size       INTEGER NOT NULL,
  ip_hash    TEXT,                 -- 只用來限制建立次數
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS vaults_ip ON vaults(ip_hash, created_at);
CREATE INDEX IF NOT EXISTS vaults_updated ON vaults(updated_at);

-- 語音輸入報名（ip_hash 只用來限制同 IP 每分鐘一筆）
CREATE TABLE IF NOT EXISTS voice_signups (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  name       TEXT NOT NULL,
  job        TEXT,
  contact    TEXT NOT NULL,
  mail       TEXT NOT NULL,
  note       TEXT,
  ip_hash    TEXT
);
CREATE INDEX IF NOT EXISTS voice_signups_ip ON voice_signups(ip_hash, created_at);
