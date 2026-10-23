# 帶鎖筆記（Cloudflare Worker + D1 + R2）

## 部署（一次）
```
npm i -g wrangler        # 或用 npx wrangler
wrangler login
wrangler d1 create kitlab-notes          # 把給的 database_id 填進 wrangler.toml
wrangler d1 execute kitlab-notes --remote --file=schema.sql
wrangler r2 bucket create kitlab-notes-files
wrangler secret put ADMIN_PASSWORD       # 管理員密碼（.sudo 用）
wrangler secret put ADMIN_SECRET         # 隨機長字串（簽登入憑證）
wrangler secret put GITHUB_TOKEN         # 只給備份 repo 的 Contents 讀寫
# wrangler.toml 的 BACKUP_REPO 改成「你的帳號/備份 repo」（建議 private，且要先有一個 commit）
wrangler deploy
```

## 入口
- 暗號欄輸入 `.tools`：工具箱（加解密、SHA-256）
- 暗號欄輸入 `.sudo`：管理員登入（統計、立即備份）
- 彩蛋：點「最近」兩個字連點 5 下 → 工具箱

## 本機測試
```
node dev-server.js     # http://127.0.0.1:8787 ，管理員密碼 letmein
node test-api.mjs      # 伺服器與備份 28 項
node test-ui.mjs       # 瀏覽器 27 項（需 playwright）
```

## 已知限制
- 「最近」清單只存在各裝置的瀏覽器，不跨裝置。
- 備份推 GitHub 的部分只用假的 GitHub 測過，真的要部署後按「立即備份」驗證一次。
- 任何人知道暗號就能讀寫；伺服器沒有寫入次數限制（要防濫用可在 Cloudflare 加 rate limit 規則）。
