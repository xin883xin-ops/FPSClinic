-- 修正：PosiFocus 被上架了兩次，刪掉重複的那筆，並換成新的介紹
DELETE FROM apps WHERE url='https://posifocus.surge.sh/' AND id <> (SELECT MIN(id) FROM apps WHERE url='https://posifocus.surge.sh/');
UPDATE apps SET category='work',
  summary_zh='免登入的正向生活面板：上傳大頭貼做成個人頁，記錄感恩的事、人生重要事項與專案、多久沒聯絡的朋友和今日待辦，可雲端同步',
  desc_en='A login-free personal dashboard built on positive habits: a profile page with your photo and motto, a gratitude list, priorities broken into projects and tasks, a relationships tracker showing days since last contact, and a focused list of today''s tasks, with optional cloud sync.',
  featured=1, tags='["no-login","gratitude","relationships","todo"]', updated_at=datetime('now')
WHERE url='https://posifocus.surge.sh/';
UPDATE meta SET value=CAST(value AS INTEGER)+1 WHERE key='version';
