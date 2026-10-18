-- 上架 PosiFocus（免登入的個人頁：感恩、重要事項、人際關係、今日待辦），設為精選
-- 已經執行過舊版也沒關係：沒有就新增，有就更新成下面的介紹
INSERT INTO apps(id,name,url,category,summary_zh,desc_en,featured,offline,publisher,source,listing_url,tags,sort)
SELECT (SELECT COALESCE(MAX(id),0)+1 FROM apps),'PosiFocus','https://posifocus.surge.sh/','work','',NULL,1,0,NULL,'kitlab','https://posifocus.surge.sh/',NULL,-1
WHERE NOT EXISTS (SELECT 1 FROM apps WHERE url='https://posifocus.surge.sh/');
UPDATE apps SET
  category='work',
  summary_zh='免登入的正向生活面板：上傳大頭貼做成個人頁，記錄感恩的事、人生重要事項與專案、多久沒聯絡的朋友和今日待辦，可雲端同步',
  desc_en='A login-free personal dashboard built on positive habits: a profile page with your photo and motto, a gratitude list, priorities broken into projects and tasks, a relationships tracker showing days since last contact, and a focused list of today''s tasks, with optional cloud sync.',
  featured=1, tags='["no-login","gratitude","relationships","todo"]', updated_at=datetime('now')
WHERE url='https://posifocus.surge.sh/';
UPDATE meta SET value=CAST(value AS INTEGER)+1 WHERE key='version';
UPDATE meta SET value=date('now') WHERE key='updated';
