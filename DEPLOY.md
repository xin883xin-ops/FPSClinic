# kitlab.store 搬到 Cloudflare

整個網站（首頁、FPSClinic、199 頁、Toolkit、Dash、Dash 應用商店）和後端 API 都放在同一個 Cloudflare Worker：
- 網站檔案由 Workers 靜態資源提供，網址和 GitHub Pages 時完全一樣（`/side.html`、`/launcher/` 都不轉址）。
- `/api/...` 是後端：商店目錄、建議與回報、加密雲端同步，資料存在 D1 資料庫。
- `wrangler.toml`、`worker/`、`package.json` 這些檔案列在 `.assetsignore`，不會公開。

## 給本機 Claude Code 的指示（整段貼上）

> 在這個資料夾把 kitlab.store 從 GitHub Pages 搬到 Cloudflare Workers，照 DEPLOY.md 做：
> 1. `npm install`，確認 `npx wrangler whoami` 已登入（沒登入就 `npx wrangler login`）。
> 2. 建 D1 資料庫 `kitlab-dash`，把 database_id 填進 wrangler.toml，執行 `npm run db:init` 匯入資料。
> 3. 到 Cloudflare 的 kitlab.store DNS，刪掉指向 GitHub Pages 的紀錄（`kitlab.store` 的 A／AAAA 指到 185.199.x.x，或 CNAME 指到 xin883xin-ops.github.io）。刪之前先列出來給我確認。
> 4. `npx wrangler deploy`，然後用 `wrangler secret put` 設定 ADMIN_TOKEN 和 SALT（各 40 字隨機），把 ADMIN_TOKEN 印給我。
> 5. 驗證：`https://kitlab.store/`、`/launcher/`、`/launcher/store/`、`/side.html` 都是 200，`/api/v1/catalog` 有 968 款，`/wrangler.toml` 是 404。
> 6. 把這個資料夾的內容 commit 並 push 到 GitHub 的 xin883xin-ops/FPSClinic（保留原始碼），然後把那個 repo 的 GitHub Pages 關掉。

## 自己用指令做（Linux）

```bash
cd ~/Downloads/kitlab-store
npm install
npx wrangler login

# 1. 資料庫
ID=$(npx wrangler d1 create kitlab-dash 2>&1 | grep -oE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' | head -1)
sed -i "s/^database_id = .*/database_id = \"$ID\"/" wrangler.toml && echo "database_id = $ID"
npm run db:init

# 2. 到 Cloudflare 網頁 → kitlab.store → DNS，刪掉指向 GitHub Pages 的 kitlab.store 紀錄
#    （A 185.199.108.153 等四筆、AAAA，或 CNAME xin883xin-ops.github.io）

# 3. 部署並設定機密值
npx wrangler deploy
ADMIN=$(tr -dc 'A-HJ-NP-Za-km-z2-9' </dev/urandom | head -c 40); SALT=$(tr -dc 'A-HJ-NP-Za-km-z2-9' </dev/urandom | head -c 40)
echo "$ADMIN" | npx wrangler secret put ADMIN_TOKEN
echo "$SALT"  | npx wrangler secret put SALT
echo "管理權杖（存進密碼管理器）：$ADMIN"

# 4. 確認
for u in / /launcher/ /launcher/store/ /side.html /wrangler.toml; do echo "$u $(curl -s -o /dev/null -w '%{http_code}' https://kitlab.store$u)"; done
curl -s https://kitlab.store/api/v1/catalog | python3 -c "import json,sys;print('應用',len(json.load(sys.stdin)['apps']))"
```

之後改網站：改好檔案執行 `npx wrangler deploy` 就上線，幾秒生效。

## 日常管理（管理權杖）

```bash
T=你的管理權杖; API=https://kitlab.store/api

curl -H "Authorization: Bearer $T" $API/v1/admin/feedback                     # 看新的建議與回報
curl -X PATCH -H "Authorization: Bearer $T" -H "Content-Type: application/json" -d '{"status":"done"}' $API/v1/admin/feedback/1

curl -X POST -H "Authorization: Bearer $T" -H "Content-Type: application/json" \
  -d '{"name":"PairDrop","url":"https://pairdrop.net","category":"tool","summary_zh":"像 AirDrop 一樣在手機和電腦之間傳檔","featured":1}' \
  $API/v1/admin/apps                                                          # 新增應用
curl -X PATCH -H "Authorization: Bearer $T" -H "Content-Type: application/json" -d '{"summary_zh":"新的介紹"}' $API/v1/admin/apps/506
curl -X DELETE -H "Authorization: Bearer $T" $API/v1/admin/apps/506          # 下架（保留紀錄）
```

分類代號：`ai` `work` `tool` `dev` `design` `music` `game` `edu` `health` `social` `biz` `life` `news`。新增或修改後，前台最晚 10 分鐘看到。

## 加密雲端同步怎麼運作

- `sync.js` 在瀏覽器隨機產生 160 位元復原碼（32 字，8 組），用 HKDF-SHA256 推導保險箱編號、寫入權杖、AES-256-GCM 金鑰。
- 資料先在瀏覽器壓縮、加密才上傳；資料庫只有編號、權杖的 SHA-256 與密文。復原碼與金鑰從不送到伺服器。
- 兩台裝置同時改：每個項目各自記修改時間，合併時取較新的；伺服器用 `rev` 擋同時寫入。
- 每天 03:17（台灣時間）自動清掉 400 天沒更新的保險箱，和 180 天前處理完的回報。

## 重新匯入整份目錄

`worker/schema.sql` 會重建 `categories`、`apps`、`hero`、`meta`，但不會動 `feedback`（回報）和 `vaults`（同步資料）。執行 `npm run db:init` 即可。
