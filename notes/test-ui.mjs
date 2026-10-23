import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire('/opt/npm-tools/node_modules/');
const { chromium } = require('playwright');
import { startServer } from './dev-server.js';

const env = { ADMIN_PASSWORD: 'pw-123', ADMIN_SECRET: 'secret-secret-secret' };
const { server, store } = await startServer(0, env);
const base = `http://127.0.0.1:${server.address().port}/`;
const exe = fs.existsSync('/opt/pw-browsers/chromium') ? undefined : undefined;
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|ERR_|Failed to load resource/.test(m.text())) errors.push('console ' + m.text()); });
let n = 0; const ok = (s) => console.log('ok', ++n, s);
const vis = (sel) => page.locator(sel).isVisible();

await page.goto(base);
assert.ok(await vis('#v-home')); ok('首頁出現');

// 新增：輸入暗號 → 空白編輯
await page.fill('#key', 'Windows-Robocopy');
await page.press('#key', 'Enter');
await page.waitForSelector('#v-edit:not([hidden])');
assert.equal(await page.inputValue('#e-key'), 'Windows-Robocopy');
assert.ok(await page.$eval('#e-key', (e) => e.readOnly)); ok('不存在的暗號 → 直接進編輯');
await page.fill('#e-text', '複製大量檔案：\n\n```\nrobocopy A B /E /MT:16\n```\n\n參考 [[linux-ip]]');
await page.fill('#e-link', 'https://youtu.be/dQw4w9WgXcQ?t=42');
await page.press('#e-link', 'Enter');
await page.fill('#e-link', 'https://example.com/a/b');
fs.writeFileSync('/tmp/hello.txt', 'hello 檔案');
await page.setInputFiles('#e-file', '/tmp/hello.txt');
await page.waitForFunction(() => document.querySelector('#e-files li'));
await page.click('#e-save');
await page.waitForSelector('#v-note:not([hidden])');
assert.equal(await page.textContent('#n-title'), 'Windows-Robocopy');
assert.ok((await page.textContent('#n-ver')).includes('共 1 個版本')); ok('存入後顯示筆記與版本');
assert.equal(await page.textContent('#n-body pre'), 'robocopy A B /E /MT:16'); ok('程式碼區塊');
assert.equal(await page.textContent('#n-body .xref'), 'linux-ip'); ok('[[互連]]');
const src = await page.getAttribute('#n-media iframe', 'src');
assert.equal(src, 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0&start=42'); ok('YouTube 自動變播放器');
assert.equal(await page.locator('#n-media a.linkcard').count(), 1); ok('一般網址是連結卡片');
const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#n-files .item')]);
const p = await dl.path();
assert.equal(fs.readFileSync(p, 'utf8'), 'hello 檔案'); assert.equal(dl.suggestedFilename(), 'hello.txt'); ok('附檔下載後與原檔相同');

// 伺服器裡只有密文
const all = JSON.stringify(store.notes);
assert.ok(!all.includes('robocopy') && !all.includes('youtu') && !all.includes('Windows')); ok('伺服器資料看不到明文');
assert.ok(store.notes[0].id.match(/^[0-9a-f]{64}$/)); ok('伺服器只有雜湊 id');

// 重新整理後：最近 + 不分大小寫打開
await page.reload();
assert.equal(await page.locator('#recent .item').count(), 1);
assert.ok((await page.textContent('#count')).includes('共 1 則')); ok('最近列表（本機）');
await page.fill('#key', 'robo');
assert.equal(await page.locator('#recent .item').count(), 1);
await page.fill('#key', 'zzz');
assert.equal(await page.locator('#recent .item').count(), 0); ok('輸入時即時篩選');
await page.fill('#key', '  WINDOWS-robocopy ');
await page.press('#key', 'Enter');
await page.waitForSelector('#v-note:not([hidden])');
assert.equal(await page.locator('#n-media iframe').count(), 1); ok('大小寫、前後空白不影響暗號');

// 編輯 → 第 2 版 → 版本列表 → 看舊版 → 還原
await page.click('#n-edit');
assert.ok((await page.inputValue('#e-text')).includes('robocopy'));
await page.fill('#e-text', '第二版內容');
await page.click('#e-save');
await page.waitForFunction(() => document.querySelector('#n-ver').textContent.includes('共 2 個版本'));
assert.equal(await page.textContent('#n-body'), '第二版內容'); ok('編輯產生第 2 版');
await page.click('#n-ver');
assert.equal(await page.locator('#n-versions button').count(), 2);
await page.locator('#n-versions button').nth(1).click();
await page.waitForSelector('#n-old:not([hidden])');
assert.ok((await page.textContent('#n-body')).includes('複製大量檔案')); ok('可看舊版本');
await page.click('#n-restore');
await page.waitForFunction(() => document.querySelector('#n-ver').textContent.includes('共 3 個版本'));
assert.ok((await page.textContent('#n-body')).includes('複製大量檔案')); assert.ok(await page.locator('#n-old').isHidden()); ok('還原 = 新增第 3 版（舊版都保留）');

// 新增（FAB）撞到已存在的暗號
await page.click('#v-note .back');
await page.click('#fab');
await page.fill('#e-key', 'windows-robocopy');
await page.fill('#e-text', '不該覆蓋');
await page.click('#e-save');
await page.waitForSelector('#v-note:not([hidden])');
assert.ok((await page.textContent('#n-body')).includes('複製大量檔案')); ok('新增撞到既有暗號 → 直接打開，不覆蓋');
await page.click('#v-note .back');

// 保留字
await page.fill('#key', '.nothing'); await page.press('#key', 'Enter');
assert.ok((await page.textContent('#toast')).includes('沒有這個功能')); ok('未知點號功能');

// .tools
await page.fill('#key', '.tools'); await page.press('#key', 'Enter');
assert.ok(await vis('#v-tools'));
await page.fill('#t-pass', '密語'); await page.fill('#t-in', '祕密 secret');
await page.click('#t-enc');
await page.waitForFunction(() => document.querySelector('#t-out').value);
const cipher = await page.inputValue('#t-out');
assert.ok(cipher.startsWith('KL1.'));
await page.fill('#t-in', cipher); await page.click('#t-dec');
await page.waitForFunction(() => document.querySelector('#t-out').value === '祕密 secret');
assert.equal(await page.inputValue('#t-out'), '祕密 secret'); ok('工具箱：加密後可解密');
await page.fill('#t-pass', '錯的'); await page.click('#t-dec');
await page.waitForFunction(() => document.querySelector('#toast').textContent.includes('解不開'));
assert.equal(await page.inputValue('#t-out'), ''); ok('密語錯 → 解不開');
await page.fill('#t-in', 'abc'); await page.click('#t-hash');
await page.waitForFunction(() => document.querySelector('#t-out').value.length === 64);
assert.equal(await page.inputValue('#t-out'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'); ok('SHA-256 正確');
await page.click('#v-tools .back');

// 彩蛋
for (let i = 0; i < 3; i++) await page.click('#lbl-recent');
assert.ok((await page.textContent('#toast')).includes('再 2 下'));
await page.click('#lbl-recent'); await page.click('#lbl-recent');
assert.ok(await vis('#v-tools')); ok('連點「最近」5 下進工具箱');
await page.click('#v-tools .back');

// .sudo
await page.fill('#key', '.sudo'); await page.press('#key', 'Enter');
await page.fill('#s-pass', 'wrong'); await page.press('#s-pass', 'Enter');
await page.waitForFunction(() => document.querySelector('#toast').textContent.includes('密碼不對'));
assert.ok(await page.locator('#s-panel').isHidden()); ok('錯密碼進不去');
await page.fill('#s-pass', 'pw-123'); await page.press('#s-pass', 'Enter');
await page.waitForSelector('#s-panel:not([hidden])');
assert.ok((await page.textContent('#s-stats')).includes('暗號數：1')); ok('正確密碼 → 管理面板');
await page.click('#v-sudo .back');

// 鎖上
await page.click('#lock');
assert.equal(await page.inputValue('#key'), ''); ok('鎖上回首頁');

// 版面：手機寬度無橫向捲動
const sw = await page.evaluate(() => document.documentElement.scrollWidth);
assert.ok(sw <= 390, 'scrollWidth ' + sw); ok('手機寬度沒有橫向捲動');
await page.screenshot({ path: '/tmp/ui-home.png' });
await page.fill('#key', 'windows-robocopy'); await page.press('#key', 'Enter');
await page.waitForSelector('#v-note:not([hidden])');
await page.waitForTimeout(300);
await page.screenshot({ path: '/tmp/ui-note.png', fullPage: true });

assert.deepEqual(errors, []); ok('沒有 JS 錯誤');
await browser.close(); server.close();
console.log('\n全部通過：' + n);
process.exit(0);
