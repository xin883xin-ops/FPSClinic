import { handle } from './handler.js';
import { runBackup } from './backup.js';
import { d1Store } from './d1store.js';

export default {
  // wrangler.toml 設 run_worker_first = ["/api/*"]，其餘由靜態檔案直接回應
  async fetch(req, env) {
    const store = d1Store(env.DB, env.FILES);
    return handle(req, env, store, { runBackup: () => runBackup(env, store) });
  },
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(runBackup(env, d1Store(env.DB, env.FILES)));
  },
};
