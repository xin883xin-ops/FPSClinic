// Cloudflare 版 store：D1 放筆記密文與設定，R2 放附檔密文。

export function d1Store(db, files) {
  return {
    async putNote(id, data, now) {
      const last = await db.prepare('SELECT MAX(ts) AS t FROM notes WHERE id = ?').bind(id).first();
      let ts = now;
      if (last && last.t && ts <= last.t) ts = last.t + 1;
      await db.prepare('INSERT INTO notes (id, ts, data) VALUES (?, ?, ?)').bind(id, ts, data).run();
      return ts;
    },
    async listVersions(id) {
      const r = await db.prepare('SELECT ts FROM notes WHERE id = ? ORDER BY ts DESC').bind(id).all();
      return r.results.map((x) => x.ts);
    },
    async getNote(id, ts) {
      const r = await db.prepare('SELECT data FROM notes WHERE id = ? AND ts = ?').bind(id, ts).first();
      return r ? r.data : null;
    },
    async versionsSince(seq, limit) {
      const r = await db
        .prepare('SELECT seq, id, ts, data FROM notes WHERE seq > ? ORDER BY seq LIMIT ?')
        .bind(seq, limit)
        .all();
      return r.results;
    },
    async stats() {
      const a = await db.prepare('SELECT COUNT(DISTINCT id) AS n, COUNT(*) AS v FROM notes').first();
      return { notes: a.n, versions: a.v };
    },
    async hasFile(fid) {
      return !!(await files.head(fid));
    },
    async putFile(fid, buf) {
      await files.put(fid, buf);
    },
    async getFile(fid) {
      const o = await files.get(fid);
      return o ? o.body : null;
    },
    async getMeta(k) {
      const r = await db.prepare('SELECT v FROM meta WHERE k = ?').bind(k).first();
      return r ? r.v : null;
    },
    async setMeta(k, v) {
      await db.prepare('INSERT INTO meta (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v').bind(k, v).run();
    },
    async getAttempt(ip) {
      const r = await db.prepare('SELECT count, until FROM attempts WHERE ip = ?').bind(ip).first();
      return r || null;
    },
    async setAttempt(ip, a) {
      await db
        .prepare('INSERT INTO attempts (ip, count, until) VALUES (?, ?, ?) ON CONFLICT(ip) DO UPDATE SET count = excluded.count, until = excluded.until')
        .bind(ip, a.count, a.until)
        .run();
    },
    async clearAttempt(ip) {
      await db.prepare('DELETE FROM attempts WHERE ip = ?').bind(ip).run();
    },
  };
}
