// KitLab 點餐收銀機：發啟用碼的小工具（只在你自己的電腦上執行，不會公開到網站）
// 用法：
//   node tools/pos-license.mjs "阿新快炒"        發一組啟用碼
//   node tools/pos-license.mjs --init            重新產生一對金鑰（舊的啟用碼會全部失效，請小心）
// 私鑰檔預設放在 ~/.kitlab/pos-private.jwk（也可用環境變數 POS_KEY 指定路徑）。私鑰不要放進 git。
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createPrivateKey, sign, generateKeyPairSync } from "node:crypto";
import { homedir } from "node:os";
import { join } from "node:path";

const shop = process.argv[2];
if (shop === "--init") {
  const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  const dir = join(homedir(), ".kitlab"); mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "pos-private.jwk"), JSON.stringify(privateKey.export({ format: "jwk" })), { mode: 0o600 });
  console.log("私鑰已存到 " + join(dir, "pos-private.jwk") + "（請備份，不要放進 git）");
  console.log("把下面這行公鑰貼到 pos/core.js 的 PUB（並把 pos/sw.js 的 VERSION 加 1）：\n");
  const j = publicKey.export({ format: "jwk" });
  console.log(JSON.stringify({ kty: j.kty, x: j.x, y: j.y, crv: j.crv, ext: true }));
  process.exit(0);
}
if (!shop) { console.error('用法：node tools/pos-license.mjs "店名"'); process.exit(1); }
const keyPath = process.env.POS_KEY || join(homedir(), ".kitlab", "pos-private.jwk");
let jwk;
try { jwk = JSON.parse(readFileSync(keyPath, "utf8")); }
catch { console.error("找不到私鑰檔：" + keyPath); process.exit(1); }

const b64u = (buf) => Buffer.from(buf).toString("base64url");
const payload = b64u(JSON.stringify({ s: shop, d: new Date().toISOString().slice(0, 10) }));
const sig = sign("sha256", Buffer.from(payload), { key: createPrivateKey({ key: jwk, format: "jwk" }), dsaEncoding: "ieee-p1363" });
const code = "KL1." + payload + "." + b64u(sig);
console.log("店名：" + shop);
console.log("啟用碼：\n" + code);
console.log("\n直接開通的連結（客人點開就會自動啟用）：\nhttps://kitlab.store/pos/#key=" + code);
