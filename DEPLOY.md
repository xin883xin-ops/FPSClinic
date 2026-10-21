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

## 點餐收銀機（/pos/）

離線優先的網頁 App：客人自助點餐、櫃檯接單收款、報表與備份。資料都存在店家那台裝置的瀏覽器裡，伺服器只負責提供檔案，沒有資料庫。

- 網址：`https://kitlab.store/pos/`（頁面目前加了 `noindex`，等有銷售頁再開放搜尋）。
- 改了 `pos/` 裡任何檔案後，把 `pos/sw.js` 的 `VERSION` 加 1，店家的裝置下次有網路時就會更新。
- 啟用碼用橢圓曲線簽章，App 裡只放公鑰，離線就能驗證。發碼：`node tools/pos-license.mjs "店名"`。私鑰在 `~/.kitlab/pos-private.jwk`，**不要放進 git，也要另外備份**；弄丟了就沒辦法再發碼（`--init` 可以重做一對，但舊的碼全部失效）。
- 發出去的連結 `https://kitlab.store/pos/#key=KL1.…`，店家點開就自動啟用。
- 試用版：功能完整，每天最多 20 筆訂單（`pos/core.js` 的 `DEMO_LIMIT`）。
- 不開立發票。這點已寫在第一次設定畫面和「設定 → 關於」。
- 同一台裝置開兩個視窗（一個客人畫面、一個 `…/pos/#staff` 收銀畫面）會即時同步；兩台不同的裝置還不能同步，是下一版的工作。

## 機密值清單（secret）

只列名稱與用途，**值不要寫進程式碼、文件、git 或對話**。值存在 Cloudflare secret，另外自己備一份在密碼管理器。
Cloudflare secret 設好後無法讀回，遺失只能重建再覆蓋。

| 名稱 | 用途 | 遺失時怎麼辦 |
|---|---|---|
| `ADMIN_TOKEN` | 管理 API（`/api/v1/admin/*`、`GET /api/voice-signups`） | 自己產一組 40 字隨機值，覆蓋即可 |
| `SALT` | IP／來訪雜湊的鹽 | 覆蓋即可（只影響限流與當日計數） |
| `WA_PHONE`、`WA_APIKEY` | 新訪客 WhatsApp 通知（選用） | CallMeBot 重新取得 |
| `RESEND_API_KEY` | 語音名片登記後寄信 | Resend 後台 → API Keys 重建，權限選 Sending access，撤銷舊的 |
| `RESEND_FROM` | 寄件人，例如 `KitLab <noreply@kitlab.store>`（父網域已在 Resend 驗證） | 直接重設 |
| `TAWK_MAIL` | 收登記通知的 tawk.to 工單信箱 | 直接重設 |

設定：`npx wrangler secret put 名稱`（需要 Node 22；這台機器預設 `node` 是 v10，要用 `/usr/bin/node node_modules/wrangler/bin/wrangler.js secret put 名稱`）。
沒設 `RESEND_*`／`TAWK_MAIL` 時，登記照常寫入，只是不寄信。
