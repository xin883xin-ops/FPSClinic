-- 上架「AI 導航」整理的 32 款 AI 工具（入口都是能直接開始使用的網址），分類放 AI 工具
-- 可重複執行：網址已存在就略過。編號固定從 2001 起，和 launcher/store/catalog.json 備份一致

INSERT INTO apps(id,name,url,category,summary_zh,desc_en,featured,offline,publisher,source,listing_url,tags,sort)
SELECT 2001,'ChatGPT','https://chatgpt.com','ai','OpenAI 的 AI 聊天助理，能寫作、寫程式、分析資料與生成圖片','OpenAI''s AI assistant for writing, coding, data analysis and image generation, usable directly in the browser.',0,0,NULL,'kitlab','https://chatgpt.com','["ai-assistant", "chatbot"]',0
WHERE NOT EXISTS (SELECT 1 FROM apps WHERE url='https://chatgpt.com' OR id=2001);
INSERT INTO apps(id,name,url,category,summary_zh,desc_en,featured,offline,publisher,source,listing_url,tags,sort)
SELECT 2002,'Gemini','https://gemini.google.com','ai','Google 的 AI 助理，可對話、寫作、看圖，並串接 Google 的各項服務','Google''s AI assistant for chat, writing and image understanding, connected to Google services.',0,0,NULL,'kitlab','https://gemini.google.com','["ai-assistant", "google"]',0
WHERE NOT EXISTS (SELECT 1 FROM apps WHERE url='https://gemini.google.com' OR id=2002);
INSERT INTO apps(id,name,url,category,summary_zh,desc_en,featured,offline,publisher,source,listing_url,tags,sort)
SELECT 2003,'Microsoft Copilot','https://copilot.microsoft.com','ai','微軟的 AI 助理，可對話、搜尋、生成圖片，和 Edge、Windows 整合','Microsoft''s AI assistant for chat, search and image generation, integrated with Edge and Windows.',0,0,NULL,'kitlab','https://copilot.microsoft.com','["ai-assistant", "microsoft"]',0
WHERE NOT EXISTS (SELECT 1 FROM apps WHERE url='https://copilot.microsoft.com' OR id=2003);
INSERT INTO apps(id,name,url,category,summary_zh,desc_en,featured,offline,publisher,source,listing_url,tags,sort)
SELECT 2004,'Meta AI','https://www.meta.ai','ai','Meta 的 AI 助理，可對話與生成圖片，也內建在 Instagram、WhatsApp','Meta''s AI assistant for chat and image generation, also built into Instagram and WhatsApp.',0,0,NULL,'kitlab','https://www.meta.ai','["ai-assistant", "meta"]',0
WHERE NOT EXISTS (SELECT 1 FROM apps WHERE url='https://www.meta.ai' OR id=2004);
INSERT INTO apps(id,name,url,category,summary_zh,desc_en,featured,offline,publisher,source,listing_url,tags,sort)
SELECT 2005,'HuggingChat','https://huggingface.co/chat','ai','Hugging Face 的開源模型聊天室，可以切換不同的開源模型來對話','Hugging Face''s chat interface for open-source models, with a model switcher.',0,0,NULL,'kitlab','https://huggingface.co/chat','["open-source", "chatbot"]',0
WHERE NOT EXISTS (SELECT 1 FROM apps WHERE url='https://huggingface.co/chat' OR id=2005);
INSERT INTO apps(id,name,url,category,summary_zh,desc_en,featured,offline,publisher,source,listing_url,tags,sort)
SELECT 2006,'Poe','https://poe.com','ai','Quora 推出的多模型平台，同一個地方就能切換使用多家 AI 與自製機器人','A multi-model chat platform from Quora where you switch between many AI models and custom bots.',0,0,NULL,'kitlab','https://poe.com','["multi-model", "chatbot"]',0
WHERE NOT EXISTS (SELECT 1 FROM apps WHERE url='https://poe.com' OR id=2006);
INSERT INTO apps(id,name,url,category,summary_zh,desc_en,featured,offline,publisher,source,listing_url,tags,sort)
SELECT 2007,'DeepSeek','https://chat.deepseek.com','ai','深度求索的 AI 助理，擅長推理與寫程式，網頁版可免費對話','DeepSeek''s AI assistant, strong at reasoning and coding, with a free web chat.',0,0,NULL,'kitlab','https://chat.deepseek.com','["ai-assistant", "reasoning"]',0
WHERE NOT EXISTS (SELECT 1 FROM apps WHERE url='https://chat.deepseek.com' OR id=2007);
INSERT INTO apps(id,name,url,category,summary_zh,desc_en,featured,offline,publisher,source,listing_url,tags,sort)
SELECT 2008,'Kimi','https://www.kimi.com','ai','月之暗面的 AI 助理，擅長讀長文件、搜尋並整理資料','Moonshot AI''s assistant, good at reading long documents and researching topics.',0,0,NULL,'kitlab','https://www.kimi.com','["ai-assistant", "long-context"]',0
WHERE NOT EXISTS (SELECT 1 FROM apps WHERE url='https://www.kimi.com' OR id=2008);
INSERT INTO apps(id,name,url,category,summary_zh,desc_en,featured,offline,publisher,source,listing_url,tags,sort)
SELECT 2009,'豆包','https://www.doubao.com','ai','字節跳動的 AI 助理，可對話、寫作與生成圖片','ByteDance''s AI assistant for chat, writing and image generation.',0,0,NULL,'kitlab','https://www.doubao.com','["ai-assistant", "bytedance"]',0
WHERE NOT EXISTS (SELECT 1 FROM apps WHERE url='https://www.doubao.com' OR id=2009);
INSERT INTO apps(id,name,url,category,summary_zh,desc_en,featured,offline,publisher,source,listing_url,tags,sort)
SELECT 2010,'騰訊元寶','https://yuanbao.tencent.com','ai','騰訊的 AI 助理，整合搜尋與文件解讀，可直接對話','Tencent''s AI assistant combining search and document reading.',0,0,NULL,'kitlab','https://yuanbao.tencent.com','["ai-assistant", "tencent"]',0
WHERE NOT EXISTS (SELECT 1 FROM apps WHERE url='https://yuanbao.tencent.com' OR id=2010);
INSERT INTO apps(id,name,url,category,summary_zh,desc_en,featured,offline,publisher,source,listing_url,tags,sort)
SELECT 2011,'訊飛星火','https://xinghuo.xfyun.cn','ai','科大訊飛的 AI 助理，支援對話、寫作與語音互動','iFlytek''s AI assistant for chat, writing and voice interaction.',0,0,NULL,'kitlab','https://xinghuo.xfyun.cn','["ai-assistant", "iflytek"]',0
WHERE NOT EXISTS (SELECT 1 FROM apps WHERE url='https://xinghuo.xfyun.cn' OR id=2011);
INSERT INTO apps(id,name,url,category,summary_zh,desc_en,featured,offline,publisher,source,listing_url,tags,sort)
SELECT 2012,'智譜清言','https://chatglm.cn','ai','智譜 AI 以 GLM 模型打造的助理，可對話、寫作與分析文件','Zhipu AI''s GLM-based assistant for chat, writing and document analysis.',0,0,NULL,'kitlab','https://chatglm.cn','["ai-assistant", "glm"]',0
WHERE NOT EXISTS (SELECT 1 FROM apps WHERE url='https://chatglm.cn' OR id=2012);
INSERT INTO apps(id,name,url,category,summary_zh,desc_en,featured,offline,publisher,source,listing_url,tags,sort)
SELECT 2013,'Perplexity','https://www.perplexity.ai','ai','AI 搜尋引擎，直接給出整理好的答案並附上來源引用','An AI search engine that answers questions directly and cites its sources.',0,0,NULL,'kitlab','https://www.perplexity.ai','["ai-search", "research"]',0
WHERE NOT EXISTS (SELECT 1 FROM apps WHERE url='https://www.perplexity.ai' OR id=2013);
INSERT INTO apps(id,name,url,category,summary_zh,desc_en,featured,offline,publisher,source,listing_url,tags,sort)
SELECT 2014,'Midjourney','https://www.midjourney.com','ai','用文字描述生成高質感圖片，網頁版即可使用','Text-to-image generation known for high-quality artwork, available on the web.',0,0,NULL,'kitlab','https://www.midjourney.com','["image-generation", "art"]',0
WHERE NOT EXISTS (SELECT 1 FROM apps WHERE url='https://www.midjourney.com' OR id=2014);
INSERT INTO apps(id,name,url,category,summary_zh,desc_en,featured,offline,publisher,source,listing_url,tags,sort)
SELECT 2015,'Leonardo.Ai','https://app.leonardo.ai','ai','AI 繪圖平台，可生成圖片與設計素材，並調整風格','An AI image platform for generating pictures and design assets in custom styles.',0,0,NULL,'kitlab','https://app.leonardo.ai','["image-generation", "design"]',0
WHERE NOT EXISTS (SELECT 1 FROM apps WHERE url='https://app.leonardo.ai' OR id=2015);
INSERT INTO apps(id,name,url,category,summary_zh,desc_en,featured,offline,publisher,source,listing_url,tags,sort)
SELECT 2016,'Ideogram','https://ideogram.ai','ai','AI 圖片生成，擅長在圖中產生清晰的文字，適合海報與標誌','AI image generation that renders legible text inside images, good for posters and logos.',0,0,NULL,'kitlab','https://ideogram.ai','["image-generation", "typography"]',0
WHERE NOT EXISTS (SELECT 1 FROM apps WHERE url='https://ideogram.ai' OR id=2016);
INSERT INTO apps(id,name,url,category,summary_zh,desc_en,featured,offline,publisher,source,listing_url,tags,sort)
SELECT 2017,'Adobe Firefly','https://firefly.adobe.com','ai','Adobe 的生成式 AI，文字生圖、生成式填色與特效','Adobe''s generative AI for text-to-image, generative fill and effects.',0,0,NULL,'kitlab','https://firefly.adobe.com','["image-generation", "adobe"]',0
WHERE NOT EXISTS (SELECT 1 FROM apps WHERE url='https://firefly.adobe.com' OR id=2017);
INSERT INTO apps(id,name,url,category,summary_zh,desc_en,featured,offline,publisher,source,listing_url,tags,sort)
SELECT 2018,'Krea','https://www.krea.ai','ai','AI 圖像與影片創作工具，可即時繪圖、放大畫質與編輯','An AI creative suite for real-time image generation, upscaling and editing.',0,0,NULL,'kitlab','https://www.krea.ai','["image-generation", "upscale"]',0
WHERE NOT EXISTS (SELECT 1 FROM apps WHERE url='https://www.krea.ai' OR id=2018);
INSERT INTO apps(id,name,url,category,summary_zh,desc_en,featured,offline,publisher,source,listing_url,tags,sort)
SELECT 2019,'Runway','https://app.runwayml.com','ai','AI 影片生成與編輯平台，文字或圖片轉影片','An AI video generation and editing platform: text or image to video.',0,0,NULL,'kitlab','https://app.runwayml.com','["video-generation", "editing"]',0
WHERE NOT EXISTS (SELECT 1 FROM apps WHERE url='https://app.runwayml.com' OR id=2019);
INSERT INTO apps(id,name,url,category,summary_zh,desc_en,featured,offline,publisher,source,listing_url,tags,sort)
SELECT 2020,'Pika','https://pika.art','ai','文字或圖片轉短影片的 AI 影片生成工具','An AI tool that turns text or images into short videos.',0,0,NULL,'kitlab','https://pika.art','["video-generation"]',0
WHERE NOT EXISTS (SELECT 1 FROM apps WHERE url='https://pika.art' OR id=2020);
INSERT INTO apps(id,name,url,category,summary_zh,desc_en,featured,offline,publisher,source,listing_url,tags,sort)
SELECT 2021,'Luma Dream Machine','https://lumalabs.ai/dream-machine','ai','Luma 的 AI 影片生成，文字或圖片轉成影片','Luma''s AI video generator: text or image to video.',0,0,NULL,'kitlab','https://lumalabs.ai/dream-machine','["video-generation"]',0
WHERE NOT EXISTS (SELECT 1 FROM apps WHERE url='https://lumalabs.ai/dream-machine' OR id=2021);
INSERT INTO apps(id,name,url,category,summary_zh,desc_en,featured,offline,publisher,source,listing_url,tags,sort)
SELECT 2022,'HeyGen','https://app.heygen.com','ai','AI 數位人影片：貼上文稿讓虛擬人物開口說，還能翻譯配音','AI avatar videos: paste a script and a virtual presenter speaks it, with translation and dubbing.',0,0,NULL,'kitlab','https://app.heygen.com','["avatar-video", "dubbing"]',0
WHERE NOT EXISTS (SELECT 1 FROM apps WHERE url='https://app.heygen.com' OR id=2022);
INSERT INTO apps(id,name,url,category,summary_zh,desc_en,featured,offline,publisher,source,listing_url,tags,sort)
SELECT 2023,'可靈 Kling','https://klingai.com','ai','快手的 AI 影片生成，文字或圖片轉成影片','Kuaishou''s AI video generator: text or image to video.',0,0,NULL,'kitlab','https://klingai.com','["video-generation", "kuaishou"]',0
WHERE NOT EXISTS (SELECT 1 FROM apps WHERE url='https://klingai.com' OR id=2023);
INSERT INTO apps(id,name,url,category,summary_zh,desc_en,featured,offline,publisher,source,listing_url,tags,sort)
SELECT 2024,'即夢','https://jimeng.jianying.com','ai','字節跳動剪映團隊的 AI 創作平台，可生成圖片與影片','ByteDance''s Jianying team AI creation platform for images and video.',0,0,NULL,'kitlab','https://jimeng.jianying.com','["image-generation", "video-generation"]',0
WHERE NOT EXISTS (SELECT 1 FROM apps WHERE url='https://jimeng.jianying.com' OR id=2024);
INSERT INTO apps(id,name,url,category,summary_zh,desc_en,featured,offline,publisher,source,listing_url,tags,sort)
SELECT 2025,'ElevenLabs','https://elevenlabs.io','ai','AI 語音合成與配音，文字轉語音、多語言配音','AI voice synthesis and dubbing: text to speech and multilingual voiceover.',0,0,NULL,'kitlab','https://elevenlabs.io','["text-to-speech", "dubbing"]',0
WHERE NOT EXISTS (SELECT 1 FROM apps WHERE url='https://elevenlabs.io' OR id=2025);
INSERT INTO apps(id,name,url,category,summary_zh,desc_en,featured,offline,publisher,source,listing_url,tags,sort)
SELECT 2026,'Bolt.new','https://bolt.new','ai','在瀏覽器裡用對話生成並部署全端網頁應用','Build and deploy full-stack web apps by chatting, right in the browser.',0,0,NULL,'kitlab','https://bolt.new','["app-builder", "coding"]',0
WHERE NOT EXISTS (SELECT 1 FROM apps WHERE url='https://bolt.new' OR id=2026);
INSERT INTO apps(id,name,url,category,summary_zh,desc_en,featured,offline,publisher,source,listing_url,tags,sort)
SELECT 2027,'v0','https://v0.dev','ai','Vercel 的 AI，輸入描述就產生網頁介面與 React 程式碼','Vercel''s AI that generates web UIs and React code from a description.',0,0,NULL,'kitlab','https://v0.dev','["ui-generation", "coding"]',0
WHERE NOT EXISTS (SELECT 1 FROM apps WHERE url='https://v0.dev' OR id=2027);
INSERT INTO apps(id,name,url,category,summary_zh,desc_en,featured,offline,publisher,source,listing_url,tags,sort)
SELECT 2028,'Lovable','https://lovable.dev','ai','用對話建立網站與應用程式的 AI 平台','An AI platform for building websites and apps through conversation.',0,0,NULL,'kitlab','https://lovable.dev','["app-builder", "coding"]',0
WHERE NOT EXISTS (SELECT 1 FROM apps WHERE url='https://lovable.dev' OR id=2028);
INSERT INTO apps(id,name,url,category,summary_zh,desc_en,featured,offline,publisher,source,listing_url,tags,sort)
SELECT 2029,'Google Stitch','https://stitch.withgoogle.com','ai','Google 的 AI 介面設計工具，從描述或草圖產生介面與程式碼','Google''s AI UI design tool that turns prompts or sketches into interfaces and code.',0,0,NULL,'kitlab','https://stitch.withgoogle.com','["ui-design", "google"]',0
WHERE NOT EXISTS (SELECT 1 FROM apps WHERE url='https://stitch.withgoogle.com' OR id=2029);
INSERT INTO apps(id,name,url,category,summary_zh,desc_en,featured,offline,publisher,source,listing_url,tags,sort)
SELECT 2030,'Notion AI','https://www.notion.com','ai','筆記工具 Notion 內建的 AI，可寫作、摘要並搜尋整個工作區','Notion''s built-in AI for writing, summarising and searching the workspace.',0,0,NULL,'kitlab','https://www.notion.com','["notes", "productivity"]',0
WHERE NOT EXISTS (SELECT 1 FROM apps WHERE url='https://www.notion.com' OR id=2030);
INSERT INTO apps(id,name,url,category,summary_zh,desc_en,featured,offline,publisher,source,listing_url,tags,sort)
SELECT 2031,'Otter.ai','https://otter.ai','ai','AI 會議記錄，即時產生逐字稿與重點摘要','AI meeting notes with live transcription and summaries.',0,0,NULL,'kitlab','https://otter.ai','["transcription", "meetings"]',0
WHERE NOT EXISTS (SELECT 1 FROM apps WHERE url='https://otter.ai' OR id=2031);
INSERT INTO apps(id,name,url,category,summary_zh,desc_en,featured,offline,publisher,source,listing_url,tags,sort)
SELECT 2032,'Hugging Face','https://huggingface.co','ai','開源模型與 Demo 平台，可直接試玩各種 AI Space','The open-source model hub; try thousands of AI demos (Spaces) directly.',0,0,NULL,'kitlab','https://huggingface.co','["open-source", "models"]',0
WHERE NOT EXISTS (SELECT 1 FROM apps WHERE url='https://huggingface.co' OR id=2032);

UPDATE meta SET value=CAST(value AS INTEGER)+1 WHERE key='version';
UPDATE meta SET value=date('now') WHERE key='updated';
