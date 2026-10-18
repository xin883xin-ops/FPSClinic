-- 上架 Enclosed（端對端加密筆記分享），設為精選
INSERT INTO apps(id,name,url,category,summary_zh,desc_en,featured,offline,publisher,source,listing_url,tags,sort)
VALUES((SELECT COALESCE(MAX(id),0)+1 FROM apps),'Enclosed','https://enclosed.cc','tool',
'開源的端對端加密筆記分享：可加密碼、設到期時間或閱後即焚，也能附檔案，免帳號',
'Enclosed is a minimalist, open-source app for sending private notes and files. Notes are end-to-end encrypted in the browser, can be protected with a password, expire after a set time or self-destruct after being read. No account required, and it can be self-hosted.',
1,0,'Corentin Thomasset','kitlab','https://github.com/CorentinTh/enclosed','["encrypted-notes","self-destruct","open-source"]',-1);
UPDATE meta SET value=CAST(value AS INTEGER)+1 WHERE key='version';
UPDATE meta SET value=date('now') WHERE key='updated';
