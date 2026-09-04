// Talks to the GitHub Contents API directly over fetch() (built into the
// Node 18+ runtime Vercel functions run on) instead of an SDK. This is a
// handful of endpoints — a full client library was more dependency (and,
// on Vercel, more bundling risk — @octokit/rest v20+ ships ESM-only,
// which broke under this project's CommonJS require()) than it was worth.

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function target() {
  return {
    owner: requireEnv("GITHUB_OWNER"),
    repo: requireEnv("GITHUB_REPO"),
    branch: process.env.GITHUB_BRANCH || "main",
  };
}

async function gh(path, options = {}) {
  const res = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${requireEnv("GITHUB_TOKEN")}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "bitnikgames-cms",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  return res;
}

// Lists files directly inside a directory (non-recursive). Returns [] if the
// directory doesn't exist yet instead of throwing, so a brand new collection
// folder isn't a hard error.
async function listDir(path) {
  const { owner, repo, branch } = target();
  const res = await gh(`/repos/${owner}/${repo}/contents/${path}?ref=${branch}`);
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`GitHub listDir ${path} failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  if (!Array.isArray(data)) return [];
  return data.filter((entry) => entry.type === "file");
}

// Returns { content, sha } or null if the file doesn't exist.
async function getFile(path) {
  const { owner, repo, branch } = target();
  const res = await gh(`/repos/${owner}/${repo}/contents/${path}?ref=${branch}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub getFile ${path} failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  if (Array.isArray(data) || data.type !== "file") return null;
  return { content: Buffer.from(data.content, "base64").toString("utf8"), sha: data.sha };
}

// Creates or updates a file. Pass `sha` (from getFile) when updating an
// existing file — GitHub rejects the write otherwise, which is the API's
// own built-in protection against clobbering a concurrent edit.
// Returns the new commit's sha — the caller uses it to poll Vercel for when
// that exact commit finishes deploying (see api/deploy-status.js).
async function putFile(path, content, message, sha) {
  const { owner, repo, branch } = target();
  const res = await gh(`/repos/${owner}/${repo}/contents/${path}`, {
    method: "PUT",
    body: JSON.stringify({
      message,
      branch,
      content: Buffer.from(content, "utf8").toString("base64"),
      sha,
    }),
  });
  if (!res.ok) throw new Error(`GitHub putFile ${path} failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.commit?.sha;
}

async function deleteFile(path, message, sha) {
  const { owner, repo, branch } = target();
  const res = await gh(`/repos/${owner}/${repo}/contents/${path}`, {
    method: "DELETE",
    body: JSON.stringify({ message, branch, sha }),
  });
  if (!res.ok) throw new Error(`GitHub deleteFile ${path} failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.commit?.sha;
}

module.exports = { listDir, getFile, putFile, deleteFile, target };
