// 每 30 分鐘把「新增的密文版本」推到 GitHub repo，一次一個 commit。
// repo 裡只有密文，看不出內容。用 Git Data API，一個 commit 可含多個檔案。

const API = 'https://api.github.com';

export async function runBackup(env, store, fetchImpl = fetch, now = Date.now) {
  if (!env.GITHUB_TOKEN || !env.BACKUP_REPO) return { pushed: 0, skipped: 'not configured' };
  const since = Number((await store.getMeta('backup_seq')) || 0);
  const rows = await store.versionsSince(since, 300);
  if (!rows.length) {
    await store.setMeta('backup_at', String(now()));
    await store.setMeta('backup_err', '');
    return { pushed: 0 };
  }
  const [owner, repo] = env.BACKUP_REPO.split('/');
  const branch = env.BACKUP_BRANCH || 'main';
  const gh = async (p, opts = {}) => {
    const res = await fetchImpl(API + p, {
      ...opts,
      headers: {
        authorization: 'Bearer ' + env.GITHUB_TOKEN,
        accept: 'application/vnd.github+json',
        'user-agent': 'kitlab-notes-backup',
        'content-type': 'application/json',
      },
    });
    if (!res.ok) throw new Error(`GitHub ${res.status} ${p}`);
    return res.json();
  };
  try {
    const ref = await gh(`/repos/${owner}/${repo}/git/ref/heads/${branch}`);
    const parent = ref.object.sha;
    const parentCommit = await gh(`/repos/${owner}/${repo}/git/commits/${parent}`);
    const tree = await gh(`/repos/${owner}/${repo}/git/trees`, {
      method: 'POST',
      body: JSON.stringify({
        base_tree: parentCommit.tree.sha,
        tree: rows.map((r) => ({ path: `notes/${r.id}/${r.ts}.txt`, mode: '100644', type: 'blob', content: r.data })),
      }),
    });
    const stamp = new Date(now()).toISOString();
    const commit = await gh(`/repos/${owner}/${repo}/git/commits`, {
      method: 'POST',
      body: JSON.stringify({ message: `backup ${stamp} (${rows.length})`, tree: tree.sha, parents: [parent] }),
    });
    await gh(`/repos/${owner}/${repo}/git/refs/heads/${branch}`, {
      method: 'PATCH',
      body: JSON.stringify({ sha: commit.sha }),
    });
    await store.setMeta('backup_seq', String(rows[rows.length - 1].seq));
    await store.setMeta('backup_at', String(now()));
    await store.setMeta('backup_err', '');
    return { pushed: rows.length, more: rows.length === 300 };
  } catch (e) {
    await store.setMeta('backup_err', String(e.message || e));
    return { pushed: 0, error: String(e.message || e) };
  }
}
